/**
 * Stock Adjustment Service
 * Business logic for stock adjustment operations
 * Handles manual stock corrections for physical count discrepancies, damage, theft, expiry
 * Includes optimistic locking and retry logic for concurrent operations
 */

import { getCompanyDB } from '../config/database.js';
import { getStockAdjustmentModel } from '../models/company/StockAdjustment.js';
import { getLocationModel } from '../models/company/Location.js';
import { getInventoryItemLocationModel } from '../models/company/InventoryItemLocation.js';
import { getInventoryBatchLocationModel } from '../models/company/InventoryBatchLocation.js';
import { recordLedgerEntry } from './inventoryLedgerService.js';
import { publishDomainEvent } from './domainEventService.js';
import { logger } from '../utils/logger.js';
import { withTransactionAndRetry } from '../utils/concurrencyControl.js';

/**
 * Generate unique adjustment number
 * Format: ADJ-YYYYMMDD-XXXXX
 * @param {Object} companyDB - Company database connection
 * @returns {Promise<string>} Unique adjustment number
 */
const generateAdjustmentNumber = async (companyDB) => {
  const StockAdjustment = getStockAdjustmentModel(companyDB);
  
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `ADJ-${dateStr}-`;
  
  // Find the last adjustment number for today
  const lastAdjustment = await StockAdjustment.findOne({
    adjustmentNumber: { $regex: `^${prefix}` }
  })
    .sort({ adjustmentNumber: -1 })
    .select('adjustmentNumber')
    .lean();
  
  let sequence = 1;
  if (lastAdjustment) {
    const lastSequence = parseInt(lastAdjustment.adjustmentNumber.split('-')[2]);
    sequence = lastSequence + 1;
  }
  
  const adjustmentNumber = `${prefix}${sequence.toString().padStart(5, '0')}`;
  return adjustmentNumber;
};

/**
 * Create a new stock adjustment
 * @param {Object} adjustmentData - Adjustment data
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Created adjustment
 */
export const createAdjustment = async (adjustmentData, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockAdjustment = getStockAdjustmentModel(companyDB);
    const Location = getLocationModel(companyDB);

    // Validate required fields
    const requiredFields = ['locationId', 'adjustmentType', 'items', 'createdBy'];
    const missingFields = requiredFields.filter(field => !adjustmentData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate adjustment type
    const validTypes = [
      'physical_count',
      'damage',
      'expiry',
      'theft',
      'found',
      'system_correction',
      'other'
    ];
    
    if (!validTypes.includes(adjustmentData.adjustmentType)) {
      throw new Error(
        `Invalid adjustment type: ${adjustmentData.adjustmentType}. ` +
        `Must be one of: ${validTypes.join(', ')}`
      );
    }

    // Validate items array
    if (!Array.isArray(adjustmentData.items) || adjustmentData.items.length === 0) {
      throw new Error('At least one item is required');
    }

    // Validate each item has required fields
    for (const item of adjustmentData.items) {
      if (!item.inventoryItem) {
        throw new Error('Each item must have an inventoryItem');
      }
      if (item.currentQuantity === undefined || item.currentQuantity === null) {
        throw new Error('Each item must have a currentQuantity');
      }
      if (item.adjustedQuantity === undefined || item.adjustedQuantity === null) {
        throw new Error('Each item must have an adjustedQuantity');
      }
      if (!item.reason) {
        throw new Error('Each item must have a reason');
      }
      
      // Calculate quantityDelta
      item.quantityDelta = item.adjustedQuantity - item.currentQuantity;
    }

    // Validate location exists and is active
    const location = await Location.findOne({
      _id: adjustmentData.locationId,
      isActive: true,
      isArchived: false
    });

    if (!location) {
      throw new Error('Location not found or inactive');
    }

    // Generate unique adjustment number
    const adjustmentNumber = await generateAdjustmentNumber(companyDB);

    // Create adjustment
    const adjustment = new StockAdjustment({
      adjustmentNumber,
      locationId: adjustmentData.locationId,
      adjustmentType: adjustmentData.adjustmentType,
      items: adjustmentData.items,
      status: 'draft',
      createdBy: adjustmentData.createdBy,
      createdDate: new Date(),
      notes: adjustmentData.notes,
      attachments: adjustmentData.attachments || [],
      stockCountSessionId: adjustmentData.stockCountSessionId,
      isActive: true
    });

    await adjustment.save();

    // Publish domain event
    await publishDomainEvent(companyDB, {
      eventType: 'ADJUSTMENT_CREATED',
      entityType: 'ADJUSTMENT',
      entityId: adjustment._id,
      payload: {
        adjustmentNumber: adjustment.adjustmentNumber,
        adjustmentType: adjustment.adjustmentType,
        locationId: adjustment.locationId,
        itemCount: adjustment.items.length,
        status: adjustment.status
      },
      userId: adjustmentData.createdBy,
      locationId: adjustment.locationId
    }, companyId);

    logger.info(
      `Stock adjustment created: ${adjustment.adjustmentNumber} ` +
      `(${adjustment.adjustmentType}) at ${location.name} for company: ${companyId}`
    );

    return adjustment;
  } catch (error) {
    logger.error('Error creating stock adjustment:', error);
    throw error;
  }
};

/**
 * Approve a stock adjustment
 * Updates inventory quantities and creates ledger entries
 * @param {string} adjustmentId - Adjustment ID
 * @param {string} userId - User approving the adjustment
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Approved adjustment
 */
/**
 * Approve a stock adjustment
 * Updates inventory quantities and creates ledger entries
 * Uses transaction with retry logic for concurrent operations
 * @param {string} adjustmentId - Adjustment ID
 * @param {string} userId - User approving the adjustment
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Approved adjustment
 */
export const approveAdjustment = async (adjustmentId, userId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockAdjustment = getStockAdjustmentModel(companyDB);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);
    const InventoryBatchLocation = getInventoryBatchLocationModel(companyDB);

    // Get adjustment (outside transaction to validate early)
    const adjustment = await StockAdjustment.findById(adjustmentId);
    
    if (!adjustment) {
      throw new Error(`Stock adjustment not found: ${adjustmentId}`);
    }

    // Validate status
    if (adjustment.status !== 'draft' && adjustment.status !== 'pending_approval') {
      throw new Error(
        `Cannot approve adjustment with status '${adjustment.status}'. ` +
        `Adjustment must be in 'draft' or 'pending_approval' status.`
      );
    }

    // Execute with transaction and retry logic
    const result = await withTransactionAndRetry(
      companyDB,
      async (session) => {
        // Re-fetch adjustment within transaction to ensure latest state
        const currentAdjustment = await StockAdjustment.findById(adjustmentId).session(session);
        
        if (!currentAdjustment) {
          throw new Error(`Stock adjustment not found: ${adjustmentId}`);
        }

        // Re-validate status (may have changed)
        if (currentAdjustment.status !== 'draft' && currentAdjustment.status !== 'pending_approval') {
          throw new Error(
            `Cannot approve adjustment with status '${currentAdjustment.status}'`
          );
        }

        // Process each item in the adjustment
        for (const item of currentAdjustment.items) {
          // Get inventory at location
          const inventory = await InventoryItemLocation.findOne({
            locationId: currentAdjustment.locationId,
            inventoryItem: item.inventoryItem,
            isActive: true
          }).session(session);

          if (!inventory) {
            throw new Error(
              `Inventory item ${item.inventoryItem} not found at location ${currentAdjustment.locationId}`
            );
          }

          // Record quantities before changes
          const beforeAvailable = inventory.availableQuantity;
          const beforeReserved = inventory.reservedQuantity;
          const beforeInTransit = inventory.inTransitQuantity;

          // Update inventory quantity
          inventory.availableQuantity += item.quantityDelta;

          // Validate non-negative quantity
          if (inventory.availableQuantity < 0) {
            throw new Error(
              `Adjustment would result in negative available quantity for item ${item.inventoryItem}. ` +
              `Current: ${beforeAvailable}, Delta: ${item.quantityDelta}, Result: ${inventory.availableQuantity}`
            );
          }

          inventory.version += 1;
          await inventory.save({ session });

          // If batch number is specified, update batch quantity
          if (item.batchNumber) {
            const batch = await InventoryBatchLocation.findOne({
              locationId: currentAdjustment.locationId,
              inventoryItem: item.inventoryItem,
              batchNumber: item.batchNumber,
              isActive: true
            }).session(session);

            if (batch) {
              batch.availableQuantity += item.quantityDelta;
              
              // Validate non-negative batch quantity
              if (batch.availableQuantity < 0) {
                throw new Error(
                  `Adjustment would result in negative batch quantity for batch ${item.batchNumber}. ` +
                  `Current: ${batch.availableQuantity - item.quantityDelta}, Delta: ${item.quantityDelta}`
                );
              }

              batch.version += 1;
              await batch.save({ session });
            }
          }

          // Record ledger entry
          await recordLedgerEntry(
            {
              inventoryItem: item.inventoryItem,
              locationId: currentAdjustment.locationId,
              batchNumber: item.batchNumber,
              movementType: 'adjustment',
              quantityDelta: item.quantityDelta,
              beforeAvailable: beforeAvailable,
              afterAvailable: inventory.availableQuantity,
              beforeReserved: beforeReserved,
              afterReserved: inventory.reservedQuantity,
              beforeInTransit: beforeInTransit,
              afterInTransit: inventory.inTransitQuantity,
              referenceType: 'ADJUSTMENT',
              referenceId: currentAdjustment._id,
              referenceNumber: currentAdjustment.adjustmentNumber,
              performedBy: userId,
              reason: item.reason,
              notes: item.notes || `${currentAdjustment.adjustmentType} adjustment: ${currentAdjustment.adjustmentNumber}`,
              correlationId: currentAdjustment._id.toString()
            },
            companyId
          );
        }

        // Update adjustment status
        currentAdjustment.status = 'approved';
        currentAdjustment.approvedBy = userId;
        currentAdjustment.approvedDate = new Date();
        await currentAdjustment.save({ session });

        // Publish domain event
        await publishDomainEvent(companyDB, {
          eventType: 'ADJUSTMENT_APPROVED',
          entityType: 'ADJUSTMENT',
          entityId: currentAdjustment._id,
          payload: {
            adjustmentNumber: currentAdjustment.adjustmentNumber,
            adjustmentType: currentAdjustment.adjustmentType,
            locationId: currentAdjustment.locationId,
            itemCount: currentAdjustment.items.length
          },
          userId: userId,
          locationId: currentAdjustment.locationId
        }, companyId);

        return currentAdjustment;
      },
      {
        operationName: `Approve adjustment ${adjustment.adjustmentNumber}`,
        maxRetries: 3
      }
    );

    logger.info(
      `Stock adjustment approved: ${result.adjustmentNumber} by user ${userId} for company: ${companyId}`
    );

    return result;
  } catch (error) {
    logger.error('Error approving stock adjustment:', error);
    throw error;
  }
};

/**
 * Reject a stock adjustment
 * @param {string} adjustmentId - Adjustment ID
 * @param {string} userId - User rejecting the adjustment
 * @param {string} rejectionReason - Reason for rejection
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Rejected adjustment
 */
export const rejectAdjustment = async (adjustmentId, userId, rejectionReason, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockAdjustment = getStockAdjustmentModel(companyDB);

    // Get adjustment
    const adjustment = await StockAdjustment.findById(adjustmentId);
    
    if (!adjustment) {
      throw new Error(`Stock adjustment not found: ${adjustmentId}`);
    }

    // Validate status
    if (adjustment.status !== 'draft' && adjustment.status !== 'pending_approval') {
      throw new Error(
        `Cannot reject adjustment with status '${adjustment.status}'. ` +
        `Adjustment must be in 'draft' or 'pending_approval' status.`
      );
    }

    // Validate rejection reason
    if (!rejectionReason || rejectionReason.trim() === '') {
      throw new Error('Rejection reason is required');
    }

    // Update adjustment status
    adjustment.status = 'rejected';
    adjustment.rejectedBy = userId;
    adjustment.rejectedDate = new Date();
    adjustment.rejectionReason = rejectionReason;
    
    await adjustment.save();

    // Publish domain event
    await publishDomainEvent(companyDB, {
      eventType: 'ADJUSTMENT_REJECTED',
      entityType: 'ADJUSTMENT',
      entityId: adjustment._id,
      payload: {
        adjustmentNumber: adjustment.adjustmentNumber,
        adjustmentType: adjustment.adjustmentType,
        locationId: adjustment.locationId,
        rejectionReason: rejectionReason
      },
      userId: userId,
      locationId: adjustment.locationId
    }, companyId);

    logger.info(
      `Stock adjustment rejected: ${adjustment.adjustmentNumber} by user ${userId} for company: ${companyId}`
    );

    return adjustment;
  } catch (error) {
    logger.error('Error rejecting stock adjustment:', error);
    throw error;
  }
};

/**
 * Get adjustment by ID
 * @param {string} adjustmentId - Adjustment ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Adjustment
 */
export const getAdjustment = async (adjustmentId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockAdjustment = getStockAdjustmentModel(companyDB);

    const adjustment = await StockAdjustment.findById(adjustmentId)
      .populate('locationId', 'name code type')
      .populate('items.inventoryItem', 'name code unit')
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .lean();

    if (!adjustment) {
      throw new Error('Stock adjustment not found');
    }

    return adjustment;
  } catch (error) {
    logger.error('Error getting stock adjustment:', error);
    throw error;
  }
};

/**
 * Get adjustments by location
 * @param {string} locationId - Location ID
 * @param {string} companyId - Company ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Paginated adjustments
 */
export const getAdjustmentsByLocation = async (locationId, companyId, filters = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockAdjustment = getStockAdjustmentModel(companyDB);

    const {
      page = 1,
      limit = 10,
      status = '',
      adjustmentType = '',
      startDate = '',
      endDate = '',
      sortBy = 'createdDate',
      sortOrder = 'desc'
    } = filters;

    // Build query
    const query = {
      locationId,
      isActive: true
    };

    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Adjustment type filter
    if (adjustmentType && adjustmentType !== 'all') {
      query.adjustmentType = adjustmentType;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdDate = {};
      if (startDate) {
        query.createdDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdDate.$lte = new Date(endDate);
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const [adjustments, total] = await Promise.all([
      StockAdjustment.find(query)
        .populate('locationId', 'name code type')
        .populate('createdBy', 'name email')
        .populate('approvedBy', 'name email')
        .populate('rejectedBy', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      StockAdjustment.countDocuments(query)
    ]);

    return {
      adjustments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting adjustments by location:', error);
    throw error;
  }
};

/**
 * Get adjustments by status
 * @param {string} status - Adjustment status
 * @param {string} companyId - Company ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Paginated adjustments
 */
export const getAdjustmentsByStatus = async (status, companyId, filters = {}) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockAdjustment = getStockAdjustmentModel(companyDB);

    // Validate status
    const validStatuses = ['draft', 'pending_approval', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      throw new Error(
        `Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`
      );
    }

    const {
      page = 1,
      limit = 10,
      locationId = '',
      adjustmentType = '',
      startDate = '',
      endDate = '',
      sortBy = 'createdDate',
      sortOrder = 'desc'
    } = filters;

    // Build query
    const query = {
      status,
      isActive: true
    };

    // Location filter
    if (locationId) {
      query.locationId = locationId;
    }

    // Adjustment type filter
    if (adjustmentType && adjustmentType !== 'all') {
      query.adjustmentType = adjustmentType;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdDate = {};
      if (startDate) {
        query.createdDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdDate.$lte = new Date(endDate);
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const [adjustments, total] = await Promise.all([
      StockAdjustment.find(query)
        .populate('locationId', 'name code type')
        .populate('createdBy', 'name email')
        .populate('approvedBy', 'name email')
        .populate('rejectedBy', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      StockAdjustment.countDocuments(query)
    ]);

    return {
      adjustments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error getting adjustments by status:', error);
    throw error;
  }
};
