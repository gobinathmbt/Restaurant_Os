/**
 * Stock Transfer Service
 * Business logic for stock transfer operations with location-based architecture
 * Supports push and request transfer types with strict state machine validation
 * Includes optimistic locking and retry logic for concurrent operations
 */

import { getCompanyDB } from '../config/database.js';
import { getStockTransferModel } from '../models/company/StockTransfer.js';
import { getStockBackorderModel } from '../models/company/StockBackorder.js';
import { getLocationModel } from '../models/company/Location.js';
import { getInventoryItemLocationModel } from '../models/company/InventoryItemLocation.js';
import { getInventoryBatchLocationModel } from '../models/company/InventoryBatchLocation.js';
import { getCounterModel } from '../models/company/Counter.js';
import { validateCapability } from './locationService.js';
import { recordLedgerEntry } from './inventoryLedgerService.js';
import { consumeInventoryFIFO } from './inventoryCostingService.js';
import { publishDomainEvent } from './domainEventService.js';
import { logger } from '../utils/logger.js';
import { 
  withTransactionAndRetry, 
  sortLocationsForLocking,
  withTransferSerialization
} from '../utils/concurrencyControl.js';
import notificationService from './notificationService.js';
import locationNotificationRouter from './locationNotificationRouter.js';
import stockRequestEmailService from './emailTemplates/stockRequestEmailService.js';

/**
 * Generate unique transfer number using atomic counter
 * Format: TRF-YYYYMMDD-XXXXX
 * Uses atomic findOneAndUpdate to prevent race conditions
 * @param {Object} companyDB - Company database connection
 * @returns {Promise<string>} Unique transfer number
 */
const generateTransferNumber = async (companyDB) => {
  const Counter = getCounterModel(companyDB);
  
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const counterId = `TRANSFER_${dateStr}`;
  
  // Atomic increment to prevent race conditions
  const counter = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { sequence: 1 } },
    { 
      upsert: true, 
      new: true,
      setDefaultsOnInsert: true
    }
  );
  
  const transferNumber = `TRF-${dateStr}-${counter.sequence.toString().padStart(5, '0')}`;
  return transferNumber;
};

/**
 * Validate transfer state transition
 * @param {string} currentStatus - Current transfer status
 * @param {string} newStatus - Requested new status
 * @returns {boolean} True if transition is valid
 */
const isValidStateTransition = (currentStatus, newStatus) => {
  const validTransitions = {
    pending: ['approved', 'rejected', 'cancelled'],
    approved: ['completed', 'returned'],
    completed: [],
    rejected: [],
    cancelled: [],
    returned: []
  };
  
  return validTransitions[currentStatus]?.includes(newStatus) || false;
};

/**
 * Create a new stock transfer
 * @param {Object} transferData - Transfer data
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Created transfer
 */
export const createTransfer = async (transferData, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);
    const Location = getLocationModel(companyDB);

    // Validate required fields
    const requiredFields = ['fromLocation', 'toLocation', 'transferType', 'items', 'requestedBy'];
    const missingFields = requiredFields.filter(field => !transferData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate transfer type
    if (!['push', 'request'].includes(transferData.transferType)) {
      throw new Error(`Invalid transfer type: ${transferData.transferType}. Must be 'push' or 'request'`);
    }

    // Validate items array
    if (!Array.isArray(transferData.items) || transferData.items.length === 0) {
      throw new Error('At least one item is required');
    }

    // Validate item quantities
    for (const item of transferData.items) {
      if (!item.requestedQuantity || item.requestedQuantity <= 0) {
        throw new Error(
          `Invalid requested quantity for item ${item.inventoryItem}. ` +
          `Quantity must be greater than zero.`
        );
      }
    }

    // Validate source and destination are different
    if (transferData.fromLocation.toString() === transferData.toLocation.toString()) {
      throw new Error('Source and destination locations must be different');
    }

    // Validate locations exist and are active
    const [sourceLocation, destLocation] = await Promise.all([
      Location.findOne({
        _id: transferData.fromLocation,
        isActive: true,
        isArchived: false
      }),
      Location.findOne({
        _id: transferData.toLocation,
        isActive: true,
        isArchived: false
      })
    ]);

    if (!sourceLocation) {
      throw new Error(`Source location not found or inactive`);
    }

    if (!destLocation) {
      throw new Error(`Destination location not found or inactive`);
    }

    // Validate inter-company transfer constraint (Requirement 36.2)
    // Since each company has its own database, both locations must exist in the same database
    // This validation ensures no cross-company transfers are attempted
    // Note: If either location is not found above, this check is redundant but provides clarity
    if (!sourceLocation || !destLocation) {
      throw new Error(
        'Inter-company transfers are not supported. Source and destination locations must belong to the same company. ' +
        'For inter-company inventory movements, please use the manual workaround process documented in the operations guide.'
      );
    }

    // Validate source location has canDispatchStock capability
    if (!sourceLocation.capabilities.canDispatchStock) {
      throw new Error(
        `Location '${sourceLocation.name}' cannot dispatch stock (canDispatchStock=false)`
      );
    }

    // Validate destination location has canReceiveStock capability
    if (!destLocation.capabilities.canReceiveStock) {
      throw new Error(
        `Location '${destLocation.name}' cannot receive stock (canReceiveStock=false)`
      );
    }

    // Generate unique transfer number
    const transferNumber = await generateTransferNumber(companyDB);

    // Create transfer
    const transfer = new StockTransfer({
      transferNumber,
      companyId, // Add company isolation
      fromLocation: transferData.fromLocation,
      toLocation: transferData.toLocation,
      transferType: transferData.transferType,
      priority: transferData.priority || 'normal',
      expectedDeliveryDate: transferData.expectedDeliveryDate,
      items: transferData.items,
      status: 'pending',
      requestedBy: transferData.requestedBy,
      requestDate: new Date(),
      notes: transferData.notes,
      version: 0
    });

    await transfer.save();

    // Publish domain event
    await publishDomainEvent(companyDB, {
      eventType: 'TRANSFER_CREATED',
      entityType: 'TRANSFER',
      entityId: transfer._id,
      payload: {
        transferNumber: transfer.transferNumber,
        transferType: transfer.transferType,
        fromLocation: transfer.fromLocation,
        toLocation: transfer.toLocation,
        itemCount: transfer.items.length,
        status: transfer.status
      },
      userId: transferData.requestedBy,
      locationId: transfer.fromLocation
    }, companyId);

    logger.info(
      `Transfer created: ${transfer.transferNumber} (${transfer.transferType}) ` +
      `from ${sourceLocation.name} to ${destLocation.name} for company: ${companyId}`
    );

    return transfer;
  } catch (error) {
    logger.error('Error creating transfer:', error);
    throw error;
  }
};


/**
 * Approve a stock transfer
 * Deducts from source availableQuantity and adds to destination inTransitQuantity
 * Records ledger entries for both locations
 * Uses transaction with retry logic for concurrent operations
 * @param {string} transferId - Transfer ID
 * @param {string} userId - User approving the transfer
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Approved transfer
 */
export const approveTransfer = async (transferId, userId, companyId, options = {}) => {
  try {
    const { allowPartialFulfillment = true } = options;
    
    const companyDB = getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
    const StockBackorder = getStockBackorderModel(companyDB);

    // Get transfer (outside transaction to validate early)
    const transfer = await StockTransfer.findById(transferId);
    
    if (!transfer) {
      throw new Error(`Transfer not found: ${transferId}`);
    }

    // Validate state transition
    if (!isValidStateTransition(transfer.status, 'approved')) {
      throw new Error(
        `Cannot transition transfer from '${transfer.status}' to 'approved'. ` +
        `Valid transitions from '${transfer.status}': ${
          ['pending'].includes(transfer.status) 
            ? 'approved, rejected, cancelled' 
            : 'none'
        }`
      );
    }

    // Serialize transfers between same location pairs to prevent deadlocks
    const result = await withTransferSerialization(
      transfer.fromLocation,
      transfer.toLocation,
      async () => {
        // Execute with transaction and retry logic
        return await withTransactionAndRetry(
      companyDB,
      async (session) => {
        // Re-fetch transfer within transaction to ensure latest state
        const currentTransfer = await StockTransfer.findById(transferId).session(session);
        
        if (!currentTransfer) {
          throw new Error(`Transfer not found: ${transferId}`);
        }

        // Re-validate state transition (may have changed)
        if (!isValidStateTransition(currentTransfer.status, 'approved')) {
          throw new Error(
            `Cannot transition transfer from '${currentTransfer.status}' to 'approved'`
          );
        }

        const backordersCreated = [];

        // Process each item in the transfer
        for (const item of currentTransfer.items) {
          // Get source inventory
          const sourceInventory = await InventoryItemLocation.findOne({
            locationId: currentTransfer.fromLocation,
            inventoryItem: item.inventoryItem,
            isActive: true
          }).session(session);

          if (!sourceInventory) {
            throw new Error(
              `Inventory item ${item.inventoryItem} not found at source location`
            );
          }

          // Determine actual quantity to send (partial fulfillment logic)
          const requestedQty = item.requestedQuantity || item.sentQuantity;
          const availableQty = sourceInventory.availableQuantity;
          
          // Validate quantities are positive
          if (requestedQty < 0) {
            throw new Error(
              `Invalid requested quantity for item ${item.inventoryItem}: ${requestedQty}. ` +
              `Quantity cannot be negative.`
            );
          }

          let actualSentQty = requestedQty;
          let backorderedQty = 0;

          if (availableQty < requestedQty) {
            if (!allowPartialFulfillment) {
              throw new Error(
                `Insufficient available quantity for item ${item.inventoryItem}. ` +
                `Requested: ${requestedQty}, Available: ${availableQty}`
              );
            }
            
            // Partial fulfillment: send what's available
            actualSentQty = Math.min(availableQty, requestedQty);
            backorderedQty = requestedQty - actualSentQty;
          }

          // Additional safety check for negative quantities
          if (actualSentQty < 0 || backorderedQty < 0) {
            throw new Error(
              `Quantity calculation error for item ${item.inventoryItem}. ` +
              `Sent: ${actualSentQty}, Backordered: ${backorderedQty}`
            );
          }

          // Update item with actual quantities
          if (!item.requestedQuantity) {
            item.requestedQuantity = requestedQty;
          }
          item.sentQuantity = actualSentQty;
          item.backorderedQuantity = backorderedQty;

          // Create backorder record if there's unfulfilled quantity
          if (backorderedQty > 0) {
            const backorder = new StockBackorder({
              companyId, // Add company isolation
              originalTransferId: currentTransfer._id,
              fromLocation: currentTransfer.fromLocation,
              toLocation: currentTransfer.toLocation,
              inventoryItem: item.inventoryItem,
              backorderedQuantity: backorderedQty,
              unit: item.unit,
              status: 'pending',
              createdBy: userId,
              notes: `Backorder created from partial approval of transfer ${currentTransfer.transferNumber}`
            });
            
            await backorder.save({ session });
            backordersCreated.push(backorder);
          }

          // Skip inventory updates if nothing is being sent
          if (actualSentQty === 0) {
            continue;
          }

          // Get or create destination inventory
          let destInventory = await InventoryItemLocation.findOne({
            locationId: currentTransfer.toLocation,
            inventoryItem: item.inventoryItem,
            isActive: true
          }).session(session);

          if (!destInventory) {
            // Create destination inventory if it doesn't exist
            destInventory = new InventoryItemLocation({
              inventoryItem: item.inventoryItem,
              locationId: currentTransfer.toLocation,
              availableQuantity: 0,
              reservedQuantity: 0,
              inTransitQuantity: 0,
              minimumStock: 0,
              maximumStock: 0,
              reorderPoint: 0,
              costingMethod: sourceInventory.costingMethod || 'FIFO',
              isActive: true,
              isArchived: false,
              version: 0
            });
            await destInventory.save({ session });
          }

          // Record quantities before changes
          const sourceBeforeAvailable = sourceInventory.availableQuantity;
          const sourceBeforeReserved = sourceInventory.reservedQuantity;
          const sourceBeforeInTransit = sourceInventory.inTransitQuantity;
          
          const destBeforeAvailable = destInventory.availableQuantity;
          const destBeforeReserved = destInventory.reservedQuantity;
          const destBeforeInTransit = destInventory.inTransitQuantity;

          // For FIFO costing, consume batches and record costs with atomic updates
          let batchCosts = [];
          let totalCost = 0;
          
          if (sourceInventory.costingMethod === 'FIFO') {
            // Get batches ordered by FIFO (expiry date ascending, then created date ascending)
            const InventoryBatchLocation = getInventoryBatchLocationModel(companyDB);
            const batches = await InventoryBatchLocation.find({
              locationId: currentTransfer.fromLocation,
              inventoryItem: item.inventoryItem,
              status: 'active',
              availableQuantity: { $gt: 0 },
              isActive: true
            })
              .sort({ expiryDate: 1, createdAt: 1 })
              .session(session);

            let remainingToConsume = actualSentQty;

            for (const batch of batches) {
              if (remainingToConsume <= 0) break;

              const consumeFromBatch = Math.min(batch.availableQuantity, remainingToConsume);
              
              // Atomic batch consumption with version check
              const updated = await InventoryBatchLocation.findOneAndUpdate(
                {
                  _id: batch._id,
                  availableQuantity: { $gte: consumeFromBatch }
                },
                {
                  $inc: { 
                    availableQuantity: -consumeFromBatch,
                    version: 1
                  }
                },
                { 
                  session,
                  new: true
                }
              );

              if (!updated) {
                throw new Error(
                  `Concurrent batch modification detected for batch ${batch._id}. ` +
                  `Required: ${consumeFromBatch}, Available: ${batch.availableQuantity}`
                );
              }

              // Calculate cost for this batch
              const batchCost = consumeFromBatch * batch.unitCost;
              totalCost += batchCost;

              // Record batch cost information
              batchCosts.push({
                sourceBatchId: batch._id,
                quantity: consumeFromBatch,
                unitCost: batch.unitCost,
                totalCost: batchCost
              });

              remainingToConsume -= consumeFromBatch;
            }
          }

          // Store batch costs and average unit cost in transfer item
          if (batchCosts.length > 0) {
            item.batchCosts = batchCosts;
            item.totalCost = totalCost;
            item.averageUnitCostAtApproval = totalCost / actualSentQty;
          }

          // Inventory underflow protection
          if (sourceInventory.availableQuantity < actualSentQty) {
            throw new Error(
              `Inventory underflow detected for item ${item.inventoryItem}. ` +
              `Available: ${sourceInventory.availableQuantity}, Required: ${actualSentQty}`
            );
          }

          // Update source inventory: deduct from available
          sourceInventory.availableQuantity -= actualSentQty;
          sourceInventory.version += 1;
          await sourceInventory.save({ session });

          // Update destination inventory: add to in-transit
          destInventory.inTransitQuantity += actualSentQty;
          destInventory.version += 1;
          await destInventory.save({ session });

          // Record ledger entry for source (transfer_out)
          await recordLedgerEntry(
            {
              inventoryItem: item.inventoryItem,
              locationId: currentTransfer.fromLocation,
              movementType: 'transfer_out',
              quantityDelta: -actualSentQty,
              beforeAvailable: sourceBeforeAvailable,
              afterAvailable: sourceInventory.availableQuantity,
              beforeReserved: sourceBeforeReserved,
              afterReserved: sourceInventory.reservedQuantity,
              beforeInTransit: sourceBeforeInTransit,
              afterInTransit: sourceInventory.inTransitQuantity,
              referenceType: 'TRANSFER',
              referenceId: currentTransfer._id,
              referenceNumber: currentTransfer.transferNumber,
              unitCost: batchCosts.length > 0 ? totalCost / actualSentQty : undefined,
              totalValue: batchCosts.length > 0 ? totalCost : undefined,
              performedBy: userId,
              notes: backorderedQty > 0 
                ? `Transfer partially approved: ${currentTransfer.transferNumber} (sent: ${actualSentQty}, backordered: ${backorderedQty})`
                : `Transfer approved: ${currentTransfer.transferNumber}`,
              correlationId: currentTransfer._id.toString()
            },
            companyId
          );

          // Record ledger entry for destination (transfer_in to in-transit)
          await recordLedgerEntry(
            {
              inventoryItem: item.inventoryItem,
              locationId: currentTransfer.toLocation,
              movementType: 'transfer_in',
              quantityDelta: actualSentQty,
              beforeAvailable: destBeforeAvailable,
              afterAvailable: destInventory.availableQuantity,
              beforeReserved: destBeforeReserved,
              afterReserved: destInventory.reservedQuantity,
              beforeInTransit: destBeforeInTransit,
              afterInTransit: destInventory.inTransitQuantity,
              referenceType: 'TRANSFER',
              referenceId: currentTransfer._id,
              referenceNumber: currentTransfer.transferNumber,
              unitCost: batchCosts.length > 0 ? totalCost / actualSentQty : undefined,
              totalValue: batchCosts.length > 0 ? totalCost : undefined,
              performedBy: userId,
              notes: backorderedQty > 0
                ? `Transfer partially approved (in-transit): ${currentTransfer.transferNumber} (sent: ${actualSentQty}, backordered: ${backorderedQty})`
                : `Transfer approved (in-transit): ${currentTransfer.transferNumber}`,
              correlationId: currentTransfer._id.toString()
            },
            companyId
          );
        }

        // Update transfer status with TRUE optimistic locking (version enforcement in query)
        const updateData = {
          status: 'approved',
          approvedBy: userId,
          approvedDate: new Date()
        };
        
        // Capture IP and device info if provided in options
        if (options.ipAddress) {
          updateData.approvedIpAddress = options.ipAddress;
        }
        if (options.deviceInfo) {
          updateData.approvedDeviceInfo = options.deviceInfo;
        }
        
        // Enforce version in update query for true optimistic locking
        const updatedTransfer = await StockTransfer.findOneAndUpdate(
          {
            _id: currentTransfer._id,
            version: currentTransfer.version // Enforce current version
          },
          {
            $set: updateData,
            $inc: { version: 1 }
          },
          {
            session,
            new: true
          }
        );
        
        if (!updatedTransfer) {
          throw new Error(
            `Concurrent modification detected for transfer ${currentTransfer.transferNumber}. ` +
            `Please retry the operation.`
          );
        }
        
        // Update reference for domain event
        Object.assign(currentTransfer, updatedTransfer.toObject());

        // Publish domain event
        await publishDomainEvent(companyDB, {
          eventType: 'TRANSFER_APPROVED',
          entityType: 'TRANSFER',
          entityId: currentTransfer._id,
          payload: {
            transferNumber: currentTransfer.transferNumber,
            transferType: currentTransfer.transferType,
            fromLocation: currentTransfer.fromLocation,
            toLocation: currentTransfer.toLocation,
            itemCount: currentTransfer.items.length,
            backordersCreated: backordersCreated.length
          },
          userId: userId,
          locationId: currentTransfer.fromLocation
        }, companyId);

        return { transfer: currentTransfer, backorders: backordersCreated };
      },
      {
        operationName: `Approve transfer ${transfer.transferNumber}`,
        maxRetries: 3
      }
    );
      },
      {
        operationName: `Approve transfer ${transfer.transferNumber} (serialized)`
      }
    );

    logger.info(
      `Transfer approved: ${result.transfer.transferNumber} by user ${userId} for company: ${companyId}` +
      (result.backorders.length > 0 ? ` with ${result.backorders.length} backorder(s) created` : '')
    );

    return result;
  } catch (error) {
    logger.error('Error approving transfer:', error);
    throw error;
  }
};


/**
 * Ship a stock transfer (Warehouse Admin execution)
 * Validates transfer status is 'approved'
 * Transitions status to 'in_transit' with optimistic locking
 * Consumes InventoryBatchLocation documents in FIFO order (oldest createdAt first)
 * Excludes expired batches and prioritizes by earliest expiryDate within FIFO (FEFO)
 * Decrements availableQuantity and reservedQuantity at fromLocation
 * Records specific batch identifiers, quantities, unitCost, totalCost in transfer's batchCosts array
 * @param {string} transferId - Transfer ID
 * @param {string} userId - User shipping the transfer (Warehouse Admin)
 * @param {string} companyId - Company ID
 * @param {Object} options - Additional options (ipAddress, deviceInfo, notes)
 * @returns {Promise<Object>} Shipped transfer
 */
export const shipTransfer = async (transferId, userId, companyId, options = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
    const InventoryBatchLocation = getInventoryBatchLocationModel(companyDB);

    // Get transfer (outside transaction to validate early)
    const transfer = await StockTransfer.findById(transferId);
    
    if (!transfer) {
      throw new Error(`Transfer not found: ${transferId}`);
    }

    // Validate state transition
    if (transfer.status !== 'approved') {
      throw new Error(
        `Cannot ship transfer with status '${transfer.status}'. ` +
        `Transfer must be in 'approved' status to be shipped.`
      );
    }

    // Serialize transfers between same location pairs to prevent deadlocks
    const result = await withTransferSerialization(
      transfer.fromLocation,
      transfer.toLocation,
      async () => {
        // Execute with transaction and retry logic
        return await withTransactionAndRetry(
          companyDB,
          async (session) => {
            // Re-fetch transfer within transaction to ensure latest state
            const currentTransfer = await StockTransfer.findById(transferId).session(session);
            
            if (!currentTransfer) {
              throw new Error(`Transfer not found: ${transferId}`);
            }

            // Re-validate state transition (may have changed)
            if (currentTransfer.status !== 'approved') {
              throw new Error(
                `Cannot ship transfer with status '${currentTransfer.status}'`
              );
            }

            // Process each item in the transfer
            for (const item of currentTransfer.items) {
              const sentQty = item.sentQuantity || item.requestedQuantity;

              // Skip if nothing to send
              if (sentQty === 0) {
                continue;
              }

              // Get source inventory
              const sourceInventory = await InventoryItemLocation.findOne({
                locationId: currentTransfer.fromLocation,
                inventoryItem: item.inventoryItem,
                isActive: true
              }).session(session);

              if (!sourceInventory) {
                throw new Error(
                  `Inventory item ${item.inventoryItem} not found at source location`
                );
              }

              // Record quantities before changes
              const sourceBeforeAvailable = sourceInventory.availableQuantity;
              const sourceBeforeReserved = sourceInventory.reservedQuantity;
              const sourceBeforeInTransit = sourceInventory.inTransitQuantity;

              // Consume batches in FIFO order with FEFO prioritization
              // Get batches ordered by FIFO (createdAt ascending), then by FEFO (expiryDate ascending)
              const currentDate = new Date();
              const batches = await InventoryBatchLocation.find({
                locationId: currentTransfer.fromLocation,
                inventoryItem: item.inventoryItem,
                status: 'active',
                availableQuantity: { $gt: 0 },
                isActive: true,
                $or: [
                  { expiryDate: { $exists: false } },
                  { expiryDate: null },
                  { expiryDate: { $gt: currentDate } }
                ]
              })
                .sort({ createdAt: 1, expiryDate: 1 })
                .session(session);

              let remainingToConsume = sentQty;
              let batchCosts = [];
              let totalCost = 0;

              for (const batch of batches) {
                if (remainingToConsume <= 0) break;

                const consumeFromBatch = Math.min(batch.availableQuantity, remainingToConsume);
                
                // Atomic batch consumption with version check
                const updated = await InventoryBatchLocation.findOneAndUpdate(
                  {
                    _id: batch._id,
                    availableQuantity: { $gte: consumeFromBatch }
                  },
                  {
                    $inc: { 
                      availableQuantity: -consumeFromBatch,
                      version: 1
                    }
                  },
                  { 
                    session,
                    new: true
                  }
                );

                if (!updated) {
                  throw new Error(
                    `Concurrent batch modification detected for batch ${batch._id}. ` +
                    `Required: ${consumeFromBatch}, Available: ${batch.availableQuantity}`
                  );
                }

                // Calculate cost for this batch
                const batchCost = consumeFromBatch * batch.unitCost;
                totalCost += batchCost;

                // Record batch cost information
                batchCosts.push({
                  sourceBatchId: batch._id,
                  batchNumber: batch.batchNumber,
                  expiryDate: batch.expiryDate,
                  manufacturingDate: batch.manufacturingDate,
                  supplier: batch.supplier,
                  quantity: consumeFromBatch,
                  unitCost: batch.unitCost,
                  totalCost: batchCost
                });

                remainingToConsume -= consumeFromBatch;
              }

              // Verify we consumed the full quantity
              if (remainingToConsume > 0) {
                throw new Error(
                  `Insufficient available quantity for item ${item.inventoryItem}. ` +
                  `Required: ${sentQty}, Available: ${sentQty - remainingToConsume}`
                );
              }

              // Store batch costs in transfer item
              item.batchCosts = batchCosts;
              item.totalCost = totalCost;
              item.averageUnitCostAtApproval = totalCost / sentQty;

              // Verify batch cost summation
              const sumBatchCosts = batchCosts.reduce((sum, bc) => sum + bc.totalCost, 0);
              if (Math.abs(sumBatchCosts - totalCost) > 0.01) {
                throw new Error(
                  `Batch cost summation error for item ${item.inventoryItem}. ` +
                  `Sum: ${sumBatchCosts}, Expected: ${totalCost}`
                );
              }

              // Inventory underflow protection
              if (sourceInventory.availableQuantity < sentQty) {
                throw new Error(
                  `Inventory underflow detected for item ${item.inventoryItem}. ` +
                  `Available: ${sourceInventory.availableQuantity}, Required: ${sentQty}`
                );
              }

              if (sourceInventory.reservedQuantity < sentQty) {
                throw new Error(
                  `Reserved quantity underflow detected for item ${item.inventoryItem}. ` +
                  `Reserved: ${sourceInventory.reservedQuantity}, Required: ${sentQty}`
                );
              }

              // Update source inventory: decrement both available and reserved
              sourceInventory.availableQuantity -= sentQty;
              sourceInventory.reservedQuantity -= sentQty;
              sourceInventory.version += 1;
              await sourceInventory.save({ session });

              // Record ledger entry for source (shipment)
              await recordLedgerEntry(
                {
                  inventoryItem: item.inventoryItem,
                  locationId: currentTransfer.fromLocation,
                  movementType: 'transfer_shipped',
                  quantityDelta: -sentQty,
                  beforeAvailable: sourceBeforeAvailable,
                  afterAvailable: sourceInventory.availableQuantity,
                  beforeReserved: sourceBeforeReserved,
                  afterReserved: sourceInventory.reservedQuantity,
                  beforeInTransit: sourceBeforeInTransit,
                  afterInTransit: sourceInventory.inTransitQuantity,
                  referenceType: 'TRANSFER',
                  referenceId: currentTransfer._id,
                  referenceNumber: currentTransfer.transferNumber,
                  unitCost: totalCost / sentQty,
                  totalValue: totalCost,
                  performedBy: userId,
                  notes: `Transfer shipped: ${currentTransfer.transferNumber}`,
                  correlationId: currentTransfer._id.toString()
                },
                companyId
              );
            }

            // Update transfer status with optimistic locking
            const updateData = {
              status: 'in_transit',
              shippedBy: userId,
              shippedDate: new Date(),
              items: currentTransfer.items // Include updated items with batch costs
            };
            
            // Capture IP and device info if provided
            if (options.ipAddress) {
              updateData.shippedIpAddress = options.ipAddress;
            }
            if (options.deviceInfo) {
              updateData.shippedDeviceInfo = options.deviceInfo;
            }
            if (options.notes) {
              updateData.notes = (currentTransfer.notes || '') + '\n' + options.notes;
            }
            
            // Enforce version in update query for true optimistic locking
            const updatedTransfer = await StockTransfer.findOneAndUpdate(
              {
                _id: currentTransfer._id,
                version: currentTransfer.version
              },
              {
                $set: updateData,
                $inc: { version: 1 }
              },
              {
                session,
                new: true
              }
            );
            
            if (!updatedTransfer) {
              throw new Error(
                `Concurrent modification detected for transfer ${currentTransfer.transferNumber}. ` +
                `Please retry the operation.`
              );
            }
            
            // Update reference for domain event
            Object.assign(currentTransfer, updatedTransfer.toObject());

            // Publish domain event
            await publishDomainEvent(companyDB, {
              eventType: 'TRANSFER_SHIPPED',
              entityType: 'TRANSFER',
              entityId: currentTransfer._id,
              payload: {
                transferNumber: currentTransfer.transferNumber,
                transferType: currentTransfer.transferType,
                fromLocation: currentTransfer.fromLocation,
                toLocation: currentTransfer.toLocation,
                itemCount: currentTransfer.items.length
              },
              userId: userId,
              locationId: currentTransfer.fromLocation
            }, companyId);

            return currentTransfer;
          },
          {
            operationName: `Ship transfer ${transfer.transferNumber}`,
            maxRetries: 3
          }
        );
      },
      {
        operationName: `Ship transfer ${transfer.transferNumber} (serialized)`
      }
    );

    logger.info(
      `Transfer shipped: ${result.transferNumber} by user ${userId} for company: ${companyId}`
    );

    // Send notification to Branch_Admin at toLocation
    try {
      const branchAdmins = await locationNotificationRouter.getBranchAdmins(
        companyId,
        result.toLocation.toString()
      );

      // Populate transfer for notification
      const StockTransfer = getStockTransferModel(getCompanyDB(companyId));
      const populatedTransfer = await StockTransfer.findById(result._id)
        .populate('fromLocation')
        .populate('toLocation')
        .populate('shippedBy');

      const fromLocationName = populatedTransfer.fromLocation?.name || 'Unknown location';
      const toLocationName = populatedTransfer.toLocation?.name || 'Unknown location';
      const shipperName = populatedTransfer.shippedBy?.name || 'Unknown user';
      const itemCount = populatedTransfer.items?.length || 0;

      // Notify Branch Admins at toLocation
      for (const admin of branchAdmins) {
        await notificationService.sendToCompanyUser(companyId, admin._id, {
          category: 'inventory',
          event: 'transfer_shipped',
          title: 'Transfer Shipped',
          message: `Transfer ${result.transferNumber} has been shipped by ${shipperName}. From: ${fromLocationName}, To: ${toLocationName}, Items: ${itemCount}`,
          data: {
            transferId: result._id,
            transferNumber: result.transferNumber,
            fromLocationName,
            toLocationName,
            itemCount,
            shipperName
          },
          priority: 'medium',
          actionUrl: `/inventory/stock-transfers/${result._id}`
        }).catch(error => {
          logger.error(`Failed to send shipment notification to branch admin ${admin._id}:`, error);
        });

        // Send email notification
        if (admin.email) {
          await stockRequestEmailService.sendTransferShippedNotification(admin.email, {
            transfer: populatedTransfer,
            recipientName: admin.name
          }).catch(error => {
            logger.error(`Failed to send shipment email to branch admin ${admin.email}:`, error);
          });
        }
      }

      logger.info(`Shipment notifications sent for transfer ${result.transferNumber}: ${branchAdmins.length} branch admins`);
    } catch (notificationError) {
      // Log but don't fail the shipment
      logger.error('Error sending shipment notifications:', notificationError);
    }

    return result;
  } catch (error) {
    logger.error('Error shipping transfer:', error);
    throw error;
  }
};


/**
 * Receive a stock transfer (Branch Admin completion)
 * Validates transfer status is 'in_transit'
 * Transitions status to 'completed' with optimistic locking
 * Creates new InventoryBatchLocation documents at toLocation
 * Preserves unitCost from source batches
 * Copies batch metadata (batchNumber, expiryDate, manufacturingDate, supplier)
 * Calculates discrepancyQuantity if receivedQuantity differs from sentQuantity
 * Increments availableQuantity at toLocation
 * @param {string} transferId - Transfer ID
 * @param {string} userId - User receiving the transfer (Branch Admin)
 * @param {Object} receivedQuantities - Map of item IDs to received quantities
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Completed transfer
 */
export const receiveTransfer = async (transferId, userId, receivedQuantities, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
    const InventoryBatchLocation = getInventoryBatchLocationModel(companyDB);

    // Get transfer (outside transaction to validate early)
    const transfer = await StockTransfer.findById(transferId);
    
    if (!transfer) {
      throw new Error(`Transfer not found: ${transferId}`);
    }

    // Validate state transition
    if (transfer.status !== 'in_transit') {
      throw new Error(
        `Cannot receive transfer with status '${transfer.status}'. ` +
        `Transfer must be in 'in_transit' status to be received.`
      );
    }

    // Serialize transfers between same location pairs to prevent deadlocks
    const result = await withTransferSerialization(
      transfer.fromLocation,
      transfer.toLocation,
      async () => {
        // Execute with transaction and retry logic
        return await withTransactionAndRetry(
          companyDB,
          async (session) => {
            // Re-fetch transfer within transaction to ensure latest state
            const currentTransfer = await StockTransfer.findById(transferId).session(session);
            
            if (!currentTransfer) {
              throw new Error(`Transfer not found: ${transferId}`);
            }

            // Re-validate state transition (may have changed)
            if (currentTransfer.status !== 'in_transit') {
              throw new Error(
                `Cannot receive transfer with status '${currentTransfer.status}'`
              );
            }

            // Process each item in the transfer
            for (const item of currentTransfer.items) {
              const sentQty = item.sentQuantity || item.requestedQuantity;
              
              // Get received quantity (default to sent quantity if not specified)
              const receivedQty = receivedQuantities?.[item.inventoryItem.toString()] ?? sentQty;
              
              // Validate received quantity does not exceed sent quantity
              if (receivedQty > sentQty) {
                throw new Error(
                  `Received quantity (${receivedQty}) cannot exceed sent quantity (${sentQty}) ` +
                  `for item ${item.inventoryItem}`
                );
              }

              // Validate received quantity is not negative
              if (receivedQty < 0) {
                throw new Error(
                  `Received quantity cannot be negative for item ${item.inventoryItem}: ${receivedQty}`
                );
              }
              
              // Update item with received quantity and calculate discrepancy
              item.receivedQuantity = receivedQty;
              item.discrepancyQuantity = sentQty - receivedQty;

              // Get or create destination inventory
              let destInventory = await InventoryItemLocation.findOne({
                locationId: currentTransfer.toLocation,
                inventoryItem: item.inventoryItem,
                isActive: true
              }).session(session);

              if (!destInventory) {
                // Get source inventory to copy costing method
                const sourceInventory = await InventoryItemLocation.findOne({
                  locationId: currentTransfer.fromLocation,
                  inventoryItem: item.inventoryItem,
                  isActive: true
                }).session(session);

                // Create destination inventory if it doesn't exist
                destInventory = new InventoryItemLocation({
                  inventoryItem: item.inventoryItem,
                  locationId: currentTransfer.toLocation,
                  availableQuantity: 0,
                  reservedQuantity: 0,
                  inTransitQuantity: 0,
                  minimumStock: 0,
                  maximumStock: 0,
                  reorderPoint: 0,
                  costingMethod: sourceInventory?.costingMethod || 'FIFO',
                  isActive: true,
                  isArchived: false,
                  version: 0
                });
                await destInventory.save({ session });
              }

              // Record quantities before changes
              const destBeforeAvailable = destInventory.availableQuantity;
              const destBeforeReserved = destInventory.reservedQuantity;
              const destBeforeInTransit = destInventory.inTransitQuantity;

              // Create destination batches with costs from source batches
              let totalCost = 0;

              if (item.batchCosts && item.batchCosts.length > 0) {
                // Calculate proportional distribution if received quantity differs from sent quantity
                const proportionReceived = receivedQty / sentQty;
                
                for (const batchCost of item.batchCosts) {
                  // Proportionally distribute received quantity across batch costs
                  const batchReceivedQty = batchCost.quantity * proportionReceived;
                  const batchReceivedCost = batchCost.totalCost * proportionReceived;
                  
                  if (batchReceivedQty > 0) {
                    // Create new batch at destination with same unit cost as source
                    const destBatch = new InventoryBatchLocation({
                      locationId: currentTransfer.toLocation,
                      inventoryItem: item.inventoryItem,
                      batchNumber: batchCost.batchNumber || `TRF-${currentTransfer.transferNumber}-${batchCost.sourceBatchId}`,
                      availableQuantity: batchReceivedQty,
                      unitCost: batchCost.unitCost,
                      expiryDate: batchCost.expiryDate,
                      manufacturingDate: batchCost.manufacturingDate,
                      supplier: batchCost.supplier,
                      status: 'active',
                      grnReference: currentTransfer._id,
                      isActive: true,
                      version: 0
                    });

                    await destBatch.save({ session });
                    totalCost += batchReceivedCost;
                  }
                }
              }

              // Update destination inventory: add to available
              destInventory.availableQuantity += receivedQty;
              destInventory.version += 1;
              await destInventory.save({ session });

              // Calculate average unit cost
              const averageUnitCost = receivedQty > 0 ? totalCost / receivedQty : 0;
              
              // Record ledger entry for destination (receipt)
              await recordLedgerEntry(
                {
                  inventoryItem: item.inventoryItem,
                  locationId: currentTransfer.toLocation,
                  movementType: 'transfer_received',
                  quantityDelta: receivedQty,
                  beforeAvailable: destBeforeAvailable,
                  afterAvailable: destInventory.availableQuantity,
                  beforeReserved: destBeforeReserved,
                  afterReserved: destInventory.reservedQuantity,
                  beforeInTransit: destBeforeInTransit,
                  afterInTransit: destInventory.inTransitQuantity,
                  referenceType: 'TRANSFER',
                  referenceId: currentTransfer._id,
                  referenceNumber: currentTransfer.transferNumber,
                  unitCost: averageUnitCost > 0 ? averageUnitCost : undefined,
                  totalValue: totalCost > 0 ? totalCost : undefined,
                  performedBy: userId,
                  notes: receivedQty !== sentQty 
                    ? `Transfer received: ${currentTransfer.transferNumber}. Received ${receivedQty} of ${sentQty} sent. Discrepancy: ${item.discrepancyQuantity}`
                    : `Transfer received: ${currentTransfer.transferNumber}`,
                  correlationId: currentTransfer._id.toString()
                },
                companyId
              );

              // If received quantity differs from sent quantity, add note to item
              if (receivedQty !== sentQty) {
                item.notes = (item.notes || '') + 
                  ` [Discrepancy: Sent ${sentQty}, Received ${receivedQty}]`;
              }
            }

            // Update transfer status with optimistic locking
            const updateData = {
              status: 'completed',
              receivedBy: userId,
              receivedDate: new Date(),
              items: currentTransfer.items // Include updated items with received quantities
            };
            
            // Capture IP and device info if provided in receivedQuantities object
            if (receivedQuantities?.ipAddress) {
              updateData.receivedIpAddress = receivedQuantities.ipAddress;
            }
            if (receivedQuantities?.deviceInfo) {
              updateData.receivedDeviceInfo = receivedQuantities.deviceInfo;
            }
            
            // Enforce version in update query for true optimistic locking
            const updatedTransfer = await StockTransfer.findOneAndUpdate(
              {
                _id: currentTransfer._id,
                version: currentTransfer.version
              },
              {
                $set: updateData,
                $inc: { version: 1 }
              },
              {
                session,
                new: true
              }
            );
            
            if (!updatedTransfer) {
              throw new Error(
                `Concurrent modification detected for transfer ${currentTransfer.transferNumber}. ` +
                `Please retry the operation.`
              );
            }
            
            // Update reference for domain event
            Object.assign(currentTransfer, updatedTransfer.toObject());

            // Publish domain event
            await publishDomainEvent(companyDB, {
              eventType: 'TRANSFER_RECEIVED',
              entityType: 'TRANSFER',
              entityId: currentTransfer._id,
              payload: {
                transferNumber: currentTransfer.transferNumber,
                transferType: currentTransfer.transferType,
                fromLocation: currentTransfer.fromLocation,
                toLocation: currentTransfer.toLocation,
                itemCount: currentTransfer.items.length
              },
              userId: userId,
              locationId: currentTransfer.toLocation
            }, companyId);

            return currentTransfer;
          },
          {
            operationName: `Receive transfer ${transfer.transferNumber}`,
            maxRetries: 3
          }
        );
      },
      {
        operationName: `Receive transfer ${transfer.transferNumber} (serialized)`
      }
    );

    logger.info(
      `Transfer received: ${result.transferNumber} by user ${userId} for company: ${companyId}`
    );

    // Send notification to Warehouse_Admin at fromLocation
    try {
      const warehouseAdmins = await locationNotificationRouter.getWarehouseAdmins(
        companyId,
        result.fromLocation.toString()
      );

      // Populate transfer for notification
      const StockTransfer = getStockTransferModel(getCompanyDB(companyId));
      const populatedTransfer = await StockTransfer.findById(result._id)
        .populate('fromLocation')
        .populate('toLocation')
        .populate('receivedBy');

      const fromLocationName = populatedTransfer.fromLocation?.name || 'Unknown location';
      const toLocationName = populatedTransfer.toLocation?.name || 'Unknown location';
      const receiverName = populatedTransfer.receivedBy?.name || 'Unknown user';
      const itemCount = populatedTransfer.items?.length || 0;

      // Check if there were any discrepancies
      const hasDiscrepancies = populatedTransfer.items.some(item => 
        item.discrepancyQuantity && item.discrepancyQuantity !== 0
      );

      // Notify Warehouse Admins at fromLocation
      for (const admin of warehouseAdmins) {
        await notificationService.sendToCompanyUser(companyId, admin._id, {
          category: 'inventory',
          event: 'transfer_completed',
          title: 'Transfer Completed',
          message: `Transfer ${result.transferNumber} has been received by ${receiverName}. From: ${fromLocationName}, To: ${toLocationName}, Items: ${itemCount}${hasDiscrepancies ? ' (with discrepancies)' : ''}`,
          data: {
            transferId: result._id,
            transferNumber: result.transferNumber,
            fromLocationName,
            toLocationName,
            itemCount,
            receiverName,
            hasDiscrepancies
          },
          priority: hasDiscrepancies ? 'high' : 'low',
          actionUrl: `/inventory/stock-transfers/${result._id}`
        }).catch(error => {
          logger.error(`Failed to send completion notification to warehouse admin ${admin._id}:`, error);
        });

        // Send email notification
        if (admin.email) {
          await stockRequestEmailService.sendTransferCompletedNotification(admin.email, {
            transfer: populatedTransfer,
            recipientName: admin.name
          }).catch(error => {
            logger.error(`Failed to send completion email to warehouse admin ${admin.email}:`, error);
          });
        }
      }

      logger.info(`Completion notifications sent for transfer ${result.transferNumber}: ${warehouseAdmins.length} warehouse admins`);
    } catch (notificationError) {
      // Log but don't fail the receipt
      logger.error('Error sending completion notifications:', notificationError);
    }

    return result;
  } catch (error) {
    logger.error('Error receiving transfer:', error);
    throw error;
  }
};


/**
 * Cancel an approved stock transfer
 * Validates transfer status is 'approved'
 * Decrements reservedQuantity at fromLocation to release inventory lock
 * Updates status to 'cancelled' with optimistic locking
 * @param {string} transferId - Transfer ID
 * @param {string} userId - User cancelling the transfer
 * @param {string} cancellationReason - Reason for cancellation
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Cancelled transfer
 */
export const cancelApprovedTransfer = async (transferId, userId, cancellationReason, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);

    // Validate cancellation reason
    if (!cancellationReason || cancellationReason.trim().length === 0) {
      throw new Error('Cancellation reason is required');
    }

    // Get transfer (outside transaction to validate early)
    const transfer = await StockTransfer.findById(transferId);
    
    if (!transfer) {
      throw new Error(`Transfer not found: ${transferId}`);
    }

    // Validate state - must be approved
    if (transfer.status !== 'approved') {
      throw new Error(
        `Cannot cancel transfer with status '${transfer.status}'. ` +
        `Transfer must be in 'approved' status to be cancelled.`
      );
    }

    // Serialize transfers between same location pairs to prevent deadlocks
    const result = await withTransferSerialization(
      transfer.fromLocation,
      transfer.toLocation,
      async () => {
        // Execute with transaction and retry logic
        return await withTransactionAndRetry(
          companyDB,
          async (session) => {
            // Re-fetch transfer within transaction to ensure latest state
            const currentTransfer = await StockTransfer.findById(transferId).session(session);
            
            if (!currentTransfer) {
              throw new Error(`Transfer not found: ${transferId}`);
            }

            // Re-validate state (may have changed)
            if (currentTransfer.status !== 'approved') {
              throw new Error(
                `Cannot cancel transfer with status '${currentTransfer.status}'`
              );
            }

            // Process each item to release reserved inventory
            for (const item of currentTransfer.items) {
              const sentQty = item.sentQuantity || item.requestedQuantity;

              // Skip if nothing was reserved
              if (sentQty === 0) {
                continue;
              }

              // Get source inventory
              const sourceInventory = await InventoryItemLocation.findOne({
                locationId: currentTransfer.fromLocation,
                inventoryItem: item.inventoryItem,
                isActive: true
              }).session(session);

              if (!sourceInventory) {
                throw new Error(
                  `Inventory item ${item.inventoryItem} not found at source location`
                );
              }

              // Validate reserved quantity
              if (sourceInventory.reservedQuantity < sentQty) {
                throw new Error(
                  `Insufficient reserved quantity for item ${item.inventoryItem}. ` +
                  `Expected: ${sentQty}, Reserved: ${sourceInventory.reservedQuantity}`
                );
              }

              // Record quantities before changes
              const sourceBeforeAvailable = sourceInventory.availableQuantity;
              const sourceBeforeReserved = sourceInventory.reservedQuantity;
              const sourceBeforeInTransit = sourceInventory.inTransitQuantity;

              // Release reserved quantity
              sourceInventory.reservedQuantity -= sentQty;
              sourceInventory.version += 1;
              await sourceInventory.save({ session });

              // Record ledger entry for source (cancellation)
              await recordLedgerEntry(
                {
                  inventoryItem: item.inventoryItem,
                  locationId: currentTransfer.fromLocation,
                  movementType: 'transfer_cancelled',
                  quantityDelta: 0, // No change to available quantity
                  beforeAvailable: sourceBeforeAvailable,
                  afterAvailable: sourceInventory.availableQuantity,
                  beforeReserved: sourceBeforeReserved,
                  afterReserved: sourceInventory.reservedQuantity,
                  beforeInTransit: sourceBeforeInTransit,
                  afterInTransit: sourceInventory.inTransitQuantity,
                  referenceType: 'TRANSFER',
                  referenceId: currentTransfer._id,
                  referenceNumber: currentTransfer.transferNumber,
                  performedBy: userId,
                  reason: cancellationReason,
                  notes: `Transfer cancelled: ${currentTransfer.transferNumber}. Reason: ${cancellationReason}`,
                  correlationId: currentTransfer._id.toString()
                },
                companyId
              );
            }

            // Update transfer status with optimistic locking
            const updateData = {
              status: 'cancelled',
              cancelledBy: userId,
              cancelledDate: new Date(),
              cancellationReason: cancellationReason
            };
            
            // Enforce version in update query for true optimistic locking
            const updatedTransfer = await StockTransfer.findOneAndUpdate(
              {
                _id: currentTransfer._id,
                version: currentTransfer.version
              },
              {
                $set: updateData,
                $inc: { version: 1 }
              },
              {
                session,
                new: true
              }
            );
            
            if (!updatedTransfer) {
              throw new Error(
                `Concurrent modification detected for transfer ${currentTransfer.transferNumber}. ` +
                `Please retry the operation.`
              );
            }
            
            // Update reference for domain event
            Object.assign(currentTransfer, updatedTransfer.toObject());

            // Publish domain event
            await publishDomainEvent(companyDB, {
              eventType: 'TRANSFER_CANCELLED',
              entityType: 'TRANSFER',
              entityId: currentTransfer._id,
              payload: {
                transferNumber: currentTransfer.transferNumber,
                transferType: currentTransfer.transferType,
                fromLocation: currentTransfer.fromLocation,
                toLocation: currentTransfer.toLocation,
                cancellationReason: cancellationReason
              },
              userId: userId,
              locationId: currentTransfer.fromLocation
            }, companyId);

            return currentTransfer;
          },
          {
            operationName: `Cancel approved transfer ${transfer.transferNumber}`,
            maxRetries: 3
          }
        );
      },
      {
        operationName: `Cancel approved transfer ${transfer.transferNumber} (serialized)`
      }
    );

    logger.info(
      `Approved transfer cancelled: ${result.transferNumber} by user ${userId} for company: ${companyId}. ` +
      `Reason: ${cancellationReason}`
    );

    return result;
  } catch (error) {
    logger.error('Error cancelling approved transfer:', error);
    throw error;
  }
};


/**
 * Complete a stock transfer
 * Subtracts from destination inTransitQuantity and adds to destination availableQuantity
 * Uses FIFO costing for batch-aware consumption if applicable
 * Records ledger entries with cost information
 * Uses transaction with retry logic for concurrent operations
 * @param {string} transferId - Transfer ID
 * @param {string} userId - User completing the transfer
 * @param {Object} receivedQuantities - Map of item IDs to received quantities
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Completed transfer
 */
export const completeTransfer = async (transferId, userId, receivedQuantities, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);

    // Get transfer (outside transaction to validate early)
    const transfer = await StockTransfer.findById(transferId);
    
    if (!transfer) {
      throw new Error(`Transfer not found: ${transferId}`);
    }

    // Validate state transition
    if (!isValidStateTransition(transfer.status, 'completed')) {
      throw new Error(
        `Cannot transition transfer from '${transfer.status}' to 'completed'. ` +
        `Transfer must be in 'approved' status to be completed.`
      );
    }

    // Serialize transfers between same location pairs to prevent deadlocks
    const result = await withTransferSerialization(
      transfer.fromLocation,
      transfer.toLocation,
      async () => {
        // Execute with transaction and retry logic
        return await withTransactionAndRetry(
      companyDB,
      async (session) => {
        // Re-fetch transfer within transaction to ensure latest state
        const currentTransfer = await StockTransfer.findById(transferId).session(session);
        
        if (!currentTransfer) {
          throw new Error(`Transfer not found: ${transferId}`);
        }

        // Re-validate state transition (may have changed)
        if (!isValidStateTransition(currentTransfer.status, 'completed')) {
          throw new Error(
            `Cannot transition transfer from '${currentTransfer.status}' to 'completed'`
          );
        }

        // Process each item in the transfer
        for (const item of currentTransfer.items) {
          // Get received quantity (default to sent quantity if not specified)
          const receivedQty = receivedQuantities?.[item.inventoryItem.toString()] ?? item.sentQuantity;
          
          // CRITICAL: Validate received quantity does not exceed sent quantity
          if (receivedQty > item.sentQuantity) {
            throw new Error(
              `Received quantity (${receivedQty}) cannot exceed sent quantity (${item.sentQuantity}) ` +
              `for item ${item.inventoryItem}`
            );
          }

          // Validate received quantity is not negative
          if (receivedQty < 0) {
            throw new Error(
              `Received quantity cannot be negative for item ${item.inventoryItem}: ${receivedQty}`
            );
          }
          
          // Update item with received quantity and calculate discrepancy
          item.receivedQuantity = receivedQty;
          item.discrepancyQuantity = item.sentQuantity - receivedQty;

          // Get destination inventory
          const destInventory = await InventoryItemLocation.findOne({
            locationId: currentTransfer.toLocation,
            inventoryItem: item.inventoryItem,
            isActive: true
          }).session(session);

          if (!destInventory) {
            throw new Error(
              `Inventory item ${item.inventoryItem} not found at destination location`
            );
          }

          // Validate in-transit quantity
          if (destInventory.inTransitQuantity < item.sentQuantity) {
            throw new Error(
              `Insufficient in-transit quantity for item ${item.inventoryItem}. ` +
              `Expected: ${item.sentQuantity}, In-transit: ${destInventory.inTransitQuantity}`
            );
          }

          // Record quantities before changes
          const destBeforeAvailable = destInventory.availableQuantity;
          const destBeforeReserved = destInventory.reservedQuantity;
          const destBeforeInTransit = destInventory.inTransitQuantity;

          // Update destination inventory: subtract from in-transit, add to available
          destInventory.inTransitQuantity -= item.sentQuantity;
          destInventory.availableQuantity += receivedQty;
          destInventory.version += 1;
          await destInventory.save({ session });

          // Get source inventory to check costing method
          const sourceInventory = await InventoryItemLocation.findOne({
            locationId: currentTransfer.fromLocation,
            inventoryItem: item.inventoryItem,
            isActive: true
          }).session(session);

          // Create destination batches with costs from source batches
          let totalCost = 0;
          let averageUnitCost = 0;

          if (item.batchCosts && item.batchCosts.length > 0) {
            const InventoryBatchLocation = getInventoryBatchLocationModel(companyDB);
            
            // Calculate proportional distribution if received quantity differs from sent quantity
            const proportionReceived = receivedQty / item.sentQuantity;
            
            for (const batchCost of item.batchCosts) {
              // Proportionally distribute received quantity across batch costs
              const batchReceivedQty = batchCost.quantity * proportionReceived;
              const batchReceivedCost = batchCost.totalCost * proportionReceived;
              
              if (batchReceivedQty > 0) {
                // Create or update destination batch with same unit cost as source
                const destBatch = await InventoryBatchLocation.findOneAndUpdate(
                  {
                    locationId: currentTransfer.toLocation,
                    inventoryItem: item.inventoryItem,
                    batchNumber: `TRF-${currentTransfer.transferNumber}-${batchCost.sourceBatchId}`,
                    isActive: true
                  },
                  {
                    $inc: { availableQuantity: batchReceivedQty },
                    $setOnInsert: {
                      unitCost: batchCost.unitCost,
                      status: 'active',
                      grnReference: currentTransfer._id,
                      createdAt: new Date()
                    },
                    $set: {
                      updatedAt: new Date()
                    }
                  },
                  {
                    upsert: true,
                    new: true,
                    session
                  }
                );

                totalCost += batchReceivedCost;
              }
            }
            
            // Division by zero protection
            averageUnitCost = receivedQty > 0 ? totalCost / receivedQty : 0;
          }
          
          // Record ledger entry for destination (completion)
          await recordLedgerEntry(
            {
              inventoryItem: item.inventoryItem,
              locationId: currentTransfer.toLocation,
              movementType: 'transfer_in',
              quantityDelta: receivedQty,
              beforeAvailable: destBeforeAvailable,
              afterAvailable: destInventory.availableQuantity,
              beforeReserved: destBeforeReserved,
              afterReserved: destInventory.reservedQuantity,
              beforeInTransit: destBeforeInTransit,
              afterInTransit: destInventory.inTransitQuantity,
              referenceType: 'TRANSFER',
              referenceId: currentTransfer._id,
              referenceNumber: currentTransfer.transferNumber,
              unitCost: averageUnitCost > 0 ? averageUnitCost : undefined,
              totalValue: totalCost > 0 ? totalCost : undefined,
              performedBy: userId,
              notes: receivedQty !== item.sentQuantity 
                ? `Transfer completed: ${currentTransfer.transferNumber}. Received ${receivedQty} of ${item.sentQuantity} sent.`
                : `Transfer completed: ${currentTransfer.transferNumber}`,
              correlationId: currentTransfer._id.toString()
            },
            companyId
          );

          // If received quantity differs from sent quantity, add note to item
          if (receivedQty !== item.sentQuantity) {
            item.notes = (item.notes || '') + 
              ` [Discrepancy: Sent ${item.sentQuantity}, Received ${receivedQty}]`;
          }
        }

        // Update transfer status with TRUE optimistic locking (version enforcement in query)
        const updateData = {
          status: 'completed',
          completedBy: userId,
          completedDate: new Date(),
          items: currentTransfer.items // Include updated items with received quantities
        };
        
        // Capture IP and device info if provided in receivedQuantities object
        if (receivedQuantities?.ipAddress) {
          updateData.completedIpAddress = receivedQuantities.ipAddress;
        }
        if (receivedQuantities?.deviceInfo) {
          updateData.completedDeviceInfo = receivedQuantities.deviceInfo;
        }
        
        // Enforce version in update query for true optimistic locking
        const updatedTransfer = await StockTransfer.findOneAndUpdate(
          {
            _id: currentTransfer._id,
            version: currentTransfer.version // Enforce current version
          },
          {
            $set: updateData,
            $inc: { version: 1 }
          },
          {
            session,
            new: true
          }
        );
        
        if (!updatedTransfer) {
          throw new Error(
            `Concurrent modification detected for transfer ${currentTransfer.transferNumber}. ` +
            `Please retry the operation.`
          );
        }
        
        // Update reference for domain event
        Object.assign(currentTransfer, updatedTransfer.toObject());

        // Publish domain event
        await publishDomainEvent(companyDB, {
          eventType: 'TRANSFER_COMPLETED',
          entityType: 'TRANSFER',
          entityId: currentTransfer._id,
          payload: {
            transferNumber: currentTransfer.transferNumber,
            transferType: currentTransfer.transferType,
            fromLocation: currentTransfer.fromLocation,
            toLocation: currentTransfer.toLocation,
            itemCount: currentTransfer.items.length
          },
          userId: userId,
          locationId: currentTransfer.toLocation
        }, companyId);

        return currentTransfer;
      },
      {
        operationName: `Complete transfer ${transfer.transferNumber}`,
        maxRetries: 3
      }
    );
      },
      {
        operationName: `Complete transfer ${transfer.transferNumber} (serialized)`
      }
    );

    logger.info(
      `Transfer completed: ${result.transferNumber} by user ${userId} for company: ${companyId}`
    );

    return result;
  } catch (error) {
    logger.error('Error completing transfer:', error);
    throw error;
  }
};


/**
 * Reject a stock transfer
 * Does not modify any inventory quantities
 * Records rejection reason and user
 * @param {string} transferId - Transfer ID
 * @param {string} userId - User rejecting the transfer
 * @param {string} rejectionReason - Reason for rejection
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Rejected transfer
 */
export const rejectTransfer = async (transferId, userId, rejectionReason, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);

    // Validate rejection reason
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw new Error('Rejection reason is required');
    }

    // Get transfer
    const transfer = await StockTransfer.findById(transferId);
    
    if (!transfer) {
      throw new Error(`Transfer not found: ${transferId}`);
    }

    // Validate state transition
    if (!isValidStateTransition(transfer.status, 'rejected')) {
      throw new Error(
        `Cannot transition transfer from '${transfer.status}' to 'rejected'. ` +
        `Transfer must be in 'pending' status to be rejected.`
      );
    }

    // Update transfer status (no inventory changes)
    transfer.status = 'rejected';
    transfer.rejectedBy = userId;
    transfer.rejectedDate = new Date();
    transfer.rejectionReason = rejectionReason;
    await transfer.save();

    // Publish domain event
    await publishDomainEvent(companyDB, {
      eventType: 'TRANSFER_REJECTED',
      entityType: 'TRANSFER',
      entityId: transfer._id,
      payload: {
        transferNumber: transfer.transferNumber,
        transferType: transfer.transferType,
        fromLocation: transfer.fromLocation,
        toLocation: transfer.toLocation,
        rejectionReason: rejectionReason
      },
      userId: userId,
      locationId: transfer.fromLocation
    }, companyId);

    logger.info(
      `Transfer rejected: ${transfer.transferNumber} by user ${userId} for company: ${companyId}. Reason: ${rejectionReason}`
    );

    return transfer;
  } catch (error) {
    logger.error('Error rejecting transfer:', error);
    throw error;
  }
};


/**
 * Cancel a stock transfer
 * Does not modify any inventory quantities
 * Can only be done by the initiator while transfer is pending
 * @param {string} transferId - Transfer ID
 * @param {string} userId - User cancelling the transfer
 * @param {string} cancellationReason - Reason for cancellation
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Cancelled transfer
 */
export const cancelTransfer = async (transferId, userId, cancellationReason, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);

    // Validate cancellation reason
    if (!cancellationReason || cancellationReason.trim().length === 0) {
      throw new Error('Cancellation reason is required');
    }

    // Get transfer
    const transfer = await StockTransfer.findById(transferId);
    
    if (!transfer) {
      throw new Error(`Transfer not found: ${transferId}`);
    }

    // Validate state transition
    if (!isValidStateTransition(transfer.status, 'cancelled')) {
      throw new Error(
        `Cannot transition transfer from '${transfer.status}' to 'cancelled'. ` +
        `Transfer must be in 'pending' status to be cancelled.`
      );
    }

    // Update transfer status (no inventory changes)
    transfer.status = 'cancelled';
    transfer.cancelledBy = userId;
    transfer.cancelledDate = new Date();
    transfer.cancellationReason = cancellationReason;
    await transfer.save();

    // Publish domain event
    await publishDomainEvent(companyDB, {
      eventType: 'TRANSFER_CANCELLED',
      entityType: 'TRANSFER',
      entityId: transfer._id,
      payload: {
        transferNumber: transfer.transferNumber,
        transferType: transfer.transferType,
        fromLocation: transfer.fromLocation,
        toLocation: transfer.toLocation,
        cancellationReason: cancellationReason
      },
      userId: userId,
      locationId: transfer.fromLocation
    }, companyId);

    logger.info(
      `Transfer cancelled: ${transfer.transferNumber} by user ${userId} for company: ${companyId}. Reason: ${cancellationReason}`
    );

    return transfer;
  } catch (error) {
    logger.error('Error cancelling transfer:', error);
    throw error;
  }
};


/**
 * Get a single transfer by ID
 * @param {string} transferId - Transfer ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Transfer
 */
export const getTransfer = async (transferId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);

    const transfer = await StockTransfer.findOne({
      _id: transferId,
      companyId // Filter by companyId for future-proofing
    })
      .populate('fromLocation', 'name code type address')
      .populate('toLocation', 'name code type address')
      .populate('items.inventoryItem', 'name itemCode unit')
      .populate('requestedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('completedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .populate('cancelledBy', 'name email')
      .populate('returnedBy', 'name email')
      .lean();

    if (!transfer) {
      throw new Error(`Transfer not found: ${transferId}`);
    }

    return transfer;
  } catch (error) {
    logger.error('Error getting transfer:', error);
    throw error;
  }
};


/**
 * List stock transfers with cursor pagination and location-based filtering
 * Supports filtering by status, transferType, locations, and date range
 * Uses transferNumber as cursor for consistent pagination
 * @param {string} companyId - Company ID
 * @param {Object} filters - Filter options
 * @param {Object} pagination - Pagination options (cursor, limit)
 * @returns {Promise<Object>} Paginated transfers with metadata
 */
export const listTransfers = async (companyId, filters = {}, pagination = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);

    const {
      status,
      transferType,
      fromLocation,
      toLocation,
      accessibleLocations,
      startDate,
      endDate
    } = filters;

    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    // Build query
    const query = {
      companyId,
      isArchived: false
    };

    // Apply status filter
    if (status) {
      query.status = status;
    }

    // Apply transfer type filter
    if (transferType) {
      query.transferType = transferType;
    }

    // Apply location filters
    if (fromLocation) {
      query.fromLocation = fromLocation;
    }

    if (toLocation) {
      query.toLocation = toLocation;
    }

    // Apply location-based access control
    // For non-Super Admins, show transfers where user has access to fromLocation OR toLocation
    if (accessibleLocations && accessibleLocations.length > 0) {
      query.$or = [
        { fromLocation: { $in: accessibleLocations } },
        { toLocation: { $in: accessibleLocations } }
      ];
    }

    // Apply date range filter
    if (startDate || endDate) {
      query.requestDate = {};
      if (startDate) {
        query.requestDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.requestDate.$lte = new Date(endDate);
      }
    }

    // Get total count
    const total = await StockTransfer.countDocuments(query);
    const pages = Math.ceil(total / limit);

    // Execute query with offset pagination
    const transfers = await StockTransfer.find(query)
      .populate('fromLocation', 'name code type')
      .populate('toLocation', 'name code type')
      .populate('items.inventoryItem', 'name itemCode unit')
      .populate('requestedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('shippedBy', 'name email')
      .populate('receivedBy', 'name email')
      .sort({ transferNumber: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      transfers,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages
    };
  } catch (error) {
    logger.error('Error listing transfers:', error);
    throw error;
  }
};


/**
 * Get transfers by location
 * @param {string} locationId - Location ID
 * @param {string} direction - 'from', 'to', or 'both'
 * @param {string} companyId - Company ID
 * @param {Object} options - Query options (page, limit, status, etc.)
 * @returns {Promise<Object>} Paginated transfers
 */
export const getTransfersByLocation = async (locationId, direction, companyId, options = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);

    const {
      page = 1,
      limit = 50,
      status,
      transferType,
      startDate,
      endDate
    } = options;

    // Build query with companyId filter
    const query = {
      companyId // Always filter by companyId for future-proofing
    };

    // Location filter
    if (direction === 'from') {
      query.fromLocation = locationId;
    } else if (direction === 'to') {
      query.toLocation = locationId;
    } else if (direction === 'both') {
      query.$or = [
        { fromLocation: locationId },
        { toLocation: locationId }
      ];
    } else {
      throw new Error(`Invalid direction: ${direction}. Must be 'from', 'to', or 'both'`);
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Transfer type filter
    if (transferType) {
      query.transferType = transferType;
    }

    // Date range filter
    if (startDate || endDate) {
      query.requestDate = {};
      if (startDate) {
        query.requestDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.requestDate.$lte = new Date(endDate);
      }
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [transfers, total] = await Promise.all([
      StockTransfer.find(query)
        .populate('fromLocation', 'name code type')
        .populate('toLocation', 'name code type')
        .populate('items.inventoryItem', 'name itemCode')
        .sort({ requestDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      StockTransfer.countDocuments(query)
    ]);

    return {
      transfers,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    };
  } catch (error) {
    logger.error('Error getting transfers by location:', error);
    throw error;
  }
};


/**
 * Get transfers by status
 * @param {string} status - Transfer status
 * @param {string} companyId - Company ID
 * @param {Object} options - Query options (page, limit, etc.)
 * @returns {Promise<Object>} Paginated transfers
 */
export const getTransfersByStatus = async (status, companyId, options = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);

    const {
      page = 1,
      limit = 50,
      transferType,
      startDate,
      endDate
    } = options;

    // Validate status
    const validStatuses = ['pending', 'approved', 'completed', 'rejected', 'cancelled', 'returned'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Build query with companyId filter
    const query = { 
      companyId, // Always filter by companyId for future-proofing
      status 
    };

    // Transfer type filter
    if (transferType) {
      query.transferType = transferType;
    }

    // Date range filter
    if (startDate || endDate) {
      query.requestDate = {};
      if (startDate) {
        query.requestDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.requestDate.$lte = new Date(endDate);
      }
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [transfers, total] = await Promise.all([
      StockTransfer.find(query)
        .populate('fromLocation', 'name code type')
        .populate('toLocation', 'name code type')
        .populate('items.inventoryItem', 'name itemCode')
        .sort({ requestDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      StockTransfer.countDocuments(query)
    ]);

    return {
      transfers,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    };
  } catch (error) {
    logger.error('Error getting transfers by status:', error);
    throw error;
  }
};


/**
 * Return a stock transfer
 * Subtracts from destination inTransitQuantity and adds back to source availableQuantity
 * Records ledger entries for both locations
 * Uses transaction with retry logic for concurrent operations
 * @param {string} transferId - Transfer ID
 * @param {string} userId - User returning the transfer
 * @param {string} returnReason - Reason for return
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Returned transfer
 */
export const returnTransfer = async (transferId, userId, returnReason, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockTransfer = getStockTransferModel(companyDB);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);

    // Validate return reason
    if (!returnReason || returnReason.trim().length === 0) {
      throw new Error('Return reason is required');
    }

    // Get transfer (outside transaction to validate early)
    const transfer = await StockTransfer.findById(transferId);
    
    if (!transfer) {
      throw new Error(`Transfer not found: ${transferId}`);
    }

    // Validate state transition
    if (!isValidStateTransition(transfer.status, 'returned')) {
      throw new Error(
        `Cannot transition transfer from '${transfer.status}' to 'returned'. ` +
        `Transfer must be in 'approved' status to be returned.`
      );
    }

    // Serialize transfers between same location pairs to prevent deadlocks
    const result = await withTransferSerialization(
      transfer.fromLocation,
      transfer.toLocation,
      async () => {
        // Execute with transaction and retry logic
        return await withTransactionAndRetry(
      companyDB,
      async (session) => {
        // Re-fetch transfer within transaction to ensure latest state
        const currentTransfer = await StockTransfer.findById(transferId).session(session);
        
        if (!currentTransfer) {
          throw new Error(`Transfer not found: ${transferId}`);
        }

        // Re-validate state transition (may have changed)
        if (!isValidStateTransition(currentTransfer.status, 'returned')) {
          throw new Error(
            `Cannot transition transfer from '${currentTransfer.status}' to 'returned'`
          );
        }

        // Process each item in the transfer
        for (const item of currentTransfer.items) {
          // Get destination inventory
          const destInventory = await InventoryItemLocation.findOne({
            locationId: currentTransfer.toLocation,
            inventoryItem: item.inventoryItem,
            isActive: true
          }).session(session);

          if (!destInventory) {
            throw new Error(
              `Inventory item ${item.inventoryItem} not found at destination location`
            );
          }

          // Validate in-transit quantity
          if (destInventory.inTransitQuantity < item.sentQuantity) {
            throw new Error(
              `Insufficient in-transit quantity for item ${item.inventoryItem}. ` +
              `Expected: ${item.sentQuantity}, In-transit: ${destInventory.inTransitQuantity}`
            );
          }

          // Get source inventory
          const sourceInventory = await InventoryItemLocation.findOne({
            locationId: currentTransfer.fromLocation,
            inventoryItem: item.inventoryItem,
            isActive: true
          }).session(session);

          if (!sourceInventory) {
            throw new Error(
              `Inventory item ${item.inventoryItem} not found at source location`
            );
          }

          // Record quantities before changes
          const destBeforeAvailable = destInventory.availableQuantity;
          const destBeforeReserved = destInventory.reservedQuantity;
          const destBeforeInTransit = destInventory.inTransitQuantity;
          
          const sourceBeforeAvailable = sourceInventory.availableQuantity;
          const sourceBeforeReserved = sourceInventory.reservedQuantity;
          const sourceBeforeInTransit = sourceInventory.inTransitQuantity;

          // Update destination inventory: subtract from in-transit
          destInventory.inTransitQuantity -= item.sentQuantity;
          destInventory.version += 1;
          await destInventory.save({ session });

          // Update source inventory: add back to available
          sourceInventory.availableQuantity += item.sentQuantity;
          sourceInventory.version += 1;
          await sourceInventory.save({ session });

          // Record ledger entry for destination (return_out)
          await recordLedgerEntry(
            {
              inventoryItem: item.inventoryItem,
              locationId: currentTransfer.toLocation,
              movementType: 'return_out',
              quantityDelta: -item.sentQuantity,
              beforeAvailable: destBeforeAvailable,
              afterAvailable: destInventory.availableQuantity,
              beforeReserved: destBeforeReserved,
              afterReserved: destInventory.reservedQuantity,
              beforeInTransit: destBeforeInTransit,
              afterInTransit: destInventory.inTransitQuantity,
              referenceType: 'TRANSFER',
              referenceId: currentTransfer._id,
              referenceNumber: currentTransfer.transferNumber,
              performedBy: userId,
              reason: returnReason,
              notes: `Transfer returned: ${currentTransfer.transferNumber}. Reason: ${returnReason}`,
              correlationId: currentTransfer._id.toString()
            },
            companyId
          );

          // Record ledger entry for source (return_in)
          await recordLedgerEntry(
            {
              inventoryItem: item.inventoryItem,
              locationId: currentTransfer.fromLocation,
              movementType: 'return_in',
              quantityDelta: item.sentQuantity,
              beforeAvailable: sourceBeforeAvailable,
              afterAvailable: sourceInventory.availableQuantity,
              beforeReserved: sourceBeforeReserved,
              afterReserved: sourceInventory.reservedQuantity,
              beforeInTransit: sourceBeforeInTransit,
              afterInTransit: sourceInventory.inTransitQuantity,
              referenceType: 'TRANSFER',
              referenceId: currentTransfer._id,
              referenceNumber: currentTransfer.transferNumber,
              performedBy: userId,
              reason: returnReason,
              notes: `Transfer returned: ${currentTransfer.transferNumber}. Reason: ${returnReason}`,
              correlationId: currentTransfer._id.toString()
            },
            companyId
          );
        }

        // Update transfer status
        currentTransfer.status = 'returned';
        currentTransfer.returnedBy = userId;
        currentTransfer.returnedDate = new Date();
        currentTransfer.returnReason = returnReason;
        await currentTransfer.save({ session });

        // Publish domain event
        await publishDomainEvent(companyDB, {
          eventType: 'TRANSFER_RETURNED',
          entityType: 'TRANSFER',
          entityId: currentTransfer._id,
          payload: {
            transferNumber: currentTransfer.transferNumber,
            transferType: currentTransfer.transferType,
            fromLocation: currentTransfer.fromLocation,
            toLocation: currentTransfer.toLocation,
            returnReason: returnReason
          },
          userId: userId,
          locationId: currentTransfer.toLocation
        }, companyId);

        return currentTransfer;
      },
      {
        operationName: `Return transfer ${transfer.transferNumber}`,
        maxRetries: 3
      }
    );
      },
      {
        operationName: `Return transfer ${transfer.transferNumber} (serialized)`
      }
    );

    logger.info(
      `Transfer returned: ${result.transferNumber} by user ${userId} for company: ${companyId}. Reason: ${returnReason}`
    );

    return result;
  } catch (error) {
    logger.error('Error returning transfer:', error);
    throw error;
  }
};


/**
 * Fulfill a backorder by creating a new transfer
 * Links the new transfer to the original backorder
 * Updates backorder status to fulfilled
 * @param {string} backorderId - Backorder ID
 * @param {string} userId - User fulfilling the backorder
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Object containing the new transfer and updated backorder
 */
export const fulfillBackorder = async (backorderId, userId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockBackorder = getStockBackorderModel(companyDB);
    const StockTransfer = getStockTransferModel(companyDB);

    // Get backorder (outside transaction to validate early)
    const backorder = await StockBackorder.findById(backorderId);
    
    if (!backorder) {
      throw new Error(`Backorder not found: ${backorderId}`);
    }

    // Validate backorder status
    if (backorder.status !== 'pending') {
      throw new Error(
        `Cannot fulfill backorder with status '${backorder.status}'. ` +
        `Backorder must be in 'pending' status.`
      );
    }

    // Execute with transaction
    const result = await withTransactionAndRetry(
      companyDB,
      async (session) => {
        // Re-fetch backorder within transaction to ensure latest state
        const currentBackorder = await StockBackorder.findById(backorderId).session(session);
        
        if (!currentBackorder) {
          throw new Error(`Backorder not found: ${backorderId}`);
        }

        // Re-validate status (may have changed)
        if (currentBackorder.status !== 'pending') {
          throw new Error(
            `Cannot fulfill backorder with status '${currentBackorder.status}'`
          );
        }

        // CRITICAL: Prevent duplicate fulfillment
        if (currentBackorder.fulfilledTransferId) {
          throw new Error(
            `Backorder ${backorderId} has already been fulfilled by transfer ${currentBackorder.fulfilledTransferId}`
          );
        }

        // Get original transfer for reference
        const originalTransfer = await StockTransfer.findById(
          currentBackorder.originalTransferId
        ).session(session);

        if (!originalTransfer) {
          throw new Error(
            `Original transfer not found: ${currentBackorder.originalTransferId}`
          );
        }

        // Generate new transfer number
        const transferNumber = await generateTransferNumber(companyDB);

        // Create new transfer for backorder fulfillment
        const newTransfer = new StockTransfer({
          transferNumber,
          companyId, // Add company isolation
          fromLocation: currentBackorder.fromLocation,
          toLocation: currentBackorder.toLocation,
          transferType: originalTransfer.transferType,
          priority: originalTransfer.priority || 'normal',
          systemGenerated: true, // Mark as system-generated for audit clarity
          items: [{
            inventoryItem: currentBackorder.inventoryItem,
            requestedQuantity: currentBackorder.backorderedQuantity,
            sentQuantity: currentBackorder.backorderedQuantity,
            backorderedQuantity: 0,
            unit: currentBackorder.unit,
            notes: `Backorder fulfillment for transfer ${originalTransfer.transferNumber}`
          }],
          status: 'pending',
          requestedBy: userId,
          requestDate: new Date(),
          notes: `Backorder fulfillment for transfer ${originalTransfer.transferNumber} (Backorder ID: ${currentBackorder._id})`,
          version: 0
        });

        await newTransfer.save({ session });

        // Update backorder status
        currentBackorder.status = 'fulfilled';
        currentBackorder.fulfilledTransferId = newTransfer._id;
        currentBackorder.fulfilledDate = new Date();
        currentBackorder.fulfilledBy = userId;
        await currentBackorder.save({ session });

        return { transfer: newTransfer, backorder: currentBackorder };
      },
      {
        operationName: `Fulfill backorder ${backorderId}`,
        maxRetries: 3
      }
    );

    logger.info(
      `Backorder fulfilled: ${backorderId} with new transfer ${result.transfer.transferNumber} ` +
      `by user ${userId} for company: ${companyId}`
    );

    return result;
  } catch (error) {
    logger.error('Error fulfilling backorder:', error);
    throw error;
  }
};

/**
 * Cancel a backorder
 * Updates backorder status to cancelled with reason
 * @param {string} backorderId - Backorder ID
 * @param {string} userId - User cancelling the backorder
 * @param {string} cancellationReason - Reason for cancellation
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Cancelled backorder
 */
export const cancelBackorder = async (backorderId, userId, cancellationReason, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockBackorder = getStockBackorderModel(companyDB);

    // Validate cancellation reason
    if (!cancellationReason || cancellationReason.trim().length === 0) {
      throw new Error('Cancellation reason is required');
    }

    // Get backorder (outside transaction to validate early)
    const backorder = await StockBackorder.findById(backorderId);
    
    if (!backorder) {
      throw new Error(`Backorder not found: ${backorderId}`);
    }

    // Validate backorder status
    if (backorder.status !== 'pending') {
      throw new Error(
        `Cannot cancel backorder with status '${backorder.status}'. ` +
        `Backorder must be in 'pending' status.`
      );
    }

    // Execute with transaction
    const result = await withTransactionAndRetry(
      companyDB,
      async (session) => {
        // Re-fetch backorder within transaction to ensure latest state
        const currentBackorder = await StockBackorder.findById(backorderId).session(session);
        
        if (!currentBackorder) {
          throw new Error(`Backorder not found: ${backorderId}`);
        }

        // Re-validate status (may have changed)
        if (currentBackorder.status !== 'pending') {
          throw new Error(
            `Cannot cancel backorder with status '${currentBackorder.status}'`
          );
        }

        // Update backorder status
        currentBackorder.status = 'cancelled';
        currentBackorder.cancelledDate = new Date();
        currentBackorder.cancelledBy = userId;
        currentBackorder.cancellationReason = cancellationReason;
        await currentBackorder.save({ session });

        return currentBackorder;
      },
      {
        operationName: `Cancel backorder ${backorderId}`,
        maxRetries: 3
      }
    );

    logger.info(
      `Backorder cancelled: ${backorderId} by user ${userId} for company: ${companyId}. ` +
      `Reason: ${cancellationReason}`
    );

    return result;
  } catch (error) {
    logger.error('Error cancelling backorder:', error);
    throw error;
  }
};

/**
 * Get pending backorders by location and optionally by item
 * @param {string} locationId - Location ID (can be fromLocation or toLocation)
 * @param {string} direction - 'from' or 'to' to specify location role
 * @param {string} companyId - Company ID
 * @param {Object} options - Query options (itemId, limit, skip)
 * @returns {Promise<Array>} List of pending backorders
 */
export const getPendingBackorders = async (locationId, direction, companyId, options = {}) => {
  try {
    const { itemId, limit = 100, skip = 0 } = options;
    
    const companyDB = getCompanyDB(companyId);
    const StockBackorder = getStockBackorderModel(companyDB);

    // Build query with companyId filter
    const query = {
      companyId, // Always filter by companyId for future-proofing
      status: 'pending'
    };

    if (direction === 'from') {
      query.fromLocation = locationId;
    } else if (direction === 'to') {
      query.toLocation = locationId;
    } else {
      // Both directions
      query.$or = [
        { fromLocation: locationId },
        { toLocation: locationId }
      ];
    }

    if (itemId) {
      query.inventoryItem = itemId;
    }

    const backorders = await StockBackorder.find(query)
      .populate('inventoryItem', 'name code')
      .populate('fromLocation', 'name code')
      .populate('toLocation', 'name code')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    return backorders;
  } catch (error) {
    logger.error('Error getting pending backorders:', error);
    throw error;
  }
};

/**
 * Get backorder by ID
 * @param {string} backorderId - Backorder ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Backorder
 */
export const getBackorder = async (backorderId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockBackorder = getStockBackorderModel(companyDB);

    const backorder = await StockBackorder.findOne({
      _id: backorderId,
      companyId // Filter by companyId for future-proofing
    })
      .populate('inventoryItem', 'name code')
      .populate('fromLocation', 'name code')
      .populate('toLocation', 'name code')
      .populate('originalTransferId')
      .populate('fulfilledTransferId')
      .lean();

    if (!backorder) {
      throw new Error(`Backorder not found: ${backorderId}`);
    }

    return backorder;
  } catch (error) {
    logger.error('Error getting backorder:', error);
    throw error;
  }
};
