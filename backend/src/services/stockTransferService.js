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
import { validateCapability } from './locationService.js';
import { recordLedgerEntry } from './inventoryLedgerService.js';
import { consumeInventoryFIFO } from './inventoryCostingService.js';
import { logger } from '../utils/logger.js';
import { 
  withTransactionAndRetry, 
  sortLocationsForLocking,
  withTransferSerialization
} from '../utils/concurrencyControl.js';

/**
 * Generate unique transfer number
 * Format: TRF-YYYYMMDD-XXXXX
 * @param {Object} companyDB - Company database connection
 * @returns {Promise<string>} Unique transfer number
 */
const generateTransferNumber = async (companyDB) => {
  const StockTransfer = getStockTransferModel(companyDB);
  
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `TRF-${dateStr}-`;
  
  // Find the last transfer number for today
  const lastTransfer = await StockTransfer.findOne({
    transferNumber: { $regex: `^${prefix}` }
  })
    .sort({ transferNumber: -1 })
    .select('transferNumber')
    .lean();
  
  let sequence = 1;
  if (lastTransfer) {
    const lastSequence = parseInt(lastTransfer.transferNumber.split('-')[2]);
    sequence = lastSequence + 1;
  }
  
  const transferNumber = `${prefix}${sequence.toString().padStart(5, '0')}`;
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
      fromLocation: transferData.fromLocation,
      toLocation: transferData.toLocation,
      transferType: transferData.transferType,
      items: transferData.items,
      status: 'pending',
      requestedBy: transferData.requestedBy,
      requestDate: new Date(),
      notes: transferData.notes
    });

    await transfer.save();

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
        // Sort locations for deterministic lock ordering (prevents deadlocks)
        const sortedLocations = sortLocationsForLocking([
          transfer.fromLocation,
          transfer.toLocation
        ]);

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

          // Update item with actual quantities
          if (!item.requestedQuantity) {
            item.requestedQuantity = requestedQty;
          }
          item.sentQuantity = actualSentQty;
          item.backorderedQuantity = backorderedQty;

          // Create backorder record if there's unfulfilled quantity
          if (backorderedQty > 0) {
            const backorder = new StockBackorder({
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
              performedBy: userId,
              notes: backorderedQty > 0
                ? `Transfer partially approved (in-transit): ${currentTransfer.transferNumber} (sent: ${actualSentQty}, backordered: ${backorderedQty})`
                : `Transfer approved (in-transit): ${currentTransfer.transferNumber}`,
              correlationId: currentTransfer._id.toString()
            },
            companyId
          );
        }

        // Update transfer status
        currentTransfer.status = 'approved';
        currentTransfer.approvedBy = userId;
        currentTransfer.approvedDate = new Date();
        await currentTransfer.save({ session });

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
          
          // Update item with received quantity
          item.receivedQuantity = receivedQty;

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

          let costInfo = null;

          // If source uses FIFO costing, we would have consumed from batches during approval
          // For now, we'll record the ledger entry without specific cost information
          // (Task 31 will add batch cost tracking to transfers)
          
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
              unitCost: costInfo?.unitCost,
              totalValue: costInfo?.totalValue,
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

        // Update transfer status
        currentTransfer.status = 'completed';
        currentTransfer.completedBy = userId;
        currentTransfer.completedDate = new Date();
        await currentTransfer.save({ session });

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

    const transfer = await StockTransfer.findById(transferId)
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

    // Build query
    const query = {};

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

    // Build query
    const query = { status };

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
          fromLocation: currentBackorder.fromLocation,
          toLocation: currentBackorder.toLocation,
          transferType: originalTransfer.transferType,
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
          notes: `Backorder fulfillment for transfer ${originalTransfer.transferNumber} (Backorder ID: ${currentBackorder._id})`
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

    // Build query
    const query = {
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

    const backorder = await StockBackorder.findById(backorderId)
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
