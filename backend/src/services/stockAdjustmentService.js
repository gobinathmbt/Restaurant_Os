/**
 * Stock Adjustment Service
 * Business logic for stock adjustment operations
 * Handles manual stock corrections for physical count discrepancies, damage, theft, expiry
 * Includes optimistic locking and retry logic for concurrent operations
 */

import { getCompanyDB } from '../config/database.js';
import { getStockAdjustmentModel } from '../models/company/StockAdjustment.js';
import { getLocationModel } from '../models/company/Location.js';
import { getInventoryItemModel } from '../models/company/InventoryItem.js';
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
export const createAdjustment = async (adjustmentData, companyId, userRole) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockAdjustment = getStockAdjustmentModel(companyDB);
    const Location = getLocationModel(companyDB);
    const InventoryItem = getInventoryItemModel(companyDB);
    const InventoryItemLocation = getInventoryItemLocationModel(companyDB);

    // Validate required fields
    const requiredFields = ['locationId', 'adjustmentType', 'items', 'createdBy'];
    const missingFields = requiredFields.filter(field => !adjustmentData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate adjustment type
    const validTypes = ['increase', 'decrease', 'correction'];
    
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

    // Validate location exists and is active
    const location = await Location.findOne({
      _id: adjustmentData.locationId,
      isActive: true,
      isArchived: false
    });

    if (!location) {
      throw new Error('Location not found or inactive');
    }

    // Fetch current quantities and validate each item
    for (const item of adjustmentData.items) {
      if (!item.inventoryItem) {
        throw new Error('Each item must have an inventoryItem');
      }
      if (item.adjustedQuantity === undefined || item.adjustedQuantity === null) {
        throw new Error('Each item must have an adjustedQuantity');
      }
      if (!item.reason) {
        throw new Error('Each item must have a reason');
      }
      
      // Fetch current quantity from InventoryItemLocation
      const itemLocation = await InventoryItemLocation.findOne({
        inventoryItem: item.inventoryItem,
        locationId: adjustmentData.locationId,
        isActive: true
      });

      if (!itemLocation) {
        const inventoryItem = await InventoryItem.findById(item.inventoryItem);
        throw new Error(
          `Inventory item ${inventoryItem?.name || item.inventoryItem} not found or inactive at this location`
        );
      }

      // Set current quantity from database
      item.currentQuantity = itemLocation.availableQuantity || 0;
    
      // Calculate quantityDelta based on adjustment type
      // - 'correction': adjustedQuantity is the NEW total quantity (replace current with this exact value)
      // - 'decrease': adjustedQuantity is the amount to DECREASE (subtract from current)
      // - 'increase': adjustedQuantity is the amount to INCREASE (add to current)
      
      if (adjustmentData.adjustmentType === 'correction') {
        // adjustedQuantity represents the NEW total quantity after correction
        item.quantityDelta = item.adjustedQuantity - item.currentQuantity;
      } else if (adjustmentData.adjustmentType === 'decrease') {
        // adjustedQuantity represents the amount to DECREASE (make it negative)
        item.quantityDelta = -Math.abs(item.adjustedQuantity);
      } else if (adjustmentData.adjustmentType === 'increase') {
        // adjustedQuantity represents the amount to INCREASE (make it positive)
        item.quantityDelta = Math.abs(item.adjustedQuantity);
      }
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

    // Check if user is super admin
    const isSuperAdmin = userRole === 'company_super_admin_primary' || 
                         userRole === 'company_super_admin_secondary';
    
    if (isSuperAdmin) {
      // Auto-approve for super admins
      await approveAdjustment(adjustment._id, adjustmentData.createdBy, companyId);
      
      // Fetch the approved adjustment with populated fields
      const approvedAdjustment = await StockAdjustment.findById(adjustment._id)
        .populate('locationId', 'name code address')
        .populate('items.inventoryItem', 'name type unit sku')
        .lean();

      // Manually populate createdBy from platform database
      const { default: CompanyUser } = await import('../models/platform/CompanyUser.js');
      const createdByUser = await CompanyUser.findById(adjustmentData.createdBy)
        .select('name email')
        .lean();

      if (createdByUser) {
        approvedAdjustment.createdBy = {
          _id: createdByUser._id,
          name: createdByUser.name,
          email: createdByUser.email
        };
      }

      // Send notifications asynchronously (auto-approved)
      setImmediate(async () => {
        try {
          const notificationService = (await import('./notificationService.js')).default;
          await notificationService.notifyStockAdjustmentCreation(companyId, approvedAdjustment, true);
          logger.info(`Notifications sent for auto-approved stock adjustment ${approvedAdjustment.adjustmentNumber}`);
        } catch (notificationError) {
          logger.error('Error sending stock adjustment notifications:', notificationError);
          // Don't fail the adjustment creation if notifications fail
        }
      });

      // Publish domain event
      await publishDomainEvent(companyDB, {
        eventType: 'ADJUSTMENT_CREATED',
        entityType: 'ADJUSTMENT',
        entityId: approvedAdjustment._id,
        payload: {
          adjustmentNumber: approvedAdjustment.adjustmentNumber,
          adjustmentType: approvedAdjustment.adjustmentType,
          locationId: approvedAdjustment.locationId,
          itemCount: approvedAdjustment.items.length,
          status: approvedAdjustment.status,
          autoApproved: true
        },
        userId: adjustmentData.createdBy,
        locationId: approvedAdjustment.locationId
      }, companyId);

      logger.info(
        `Stock adjustment auto-approved: ${approvedAdjustment.adjustmentNumber} ` +
        `(${approvedAdjustment.adjustmentType}) at ${location.name} by super admin for company: ${companyId}`
      );

      return approvedAdjustment;
    } else {
      // Company admin - set to pending approval
      adjustment.status = 'pending_approval';
      await adjustment.save();

      // Populate the adjustment with related data for notifications
      const populatedAdjustment = await StockAdjustment.findById(adjustment._id)
        .populate('locationId', 'name code address')
        .populate('items.inventoryItem', 'name type unit sku')
        .lean();

      // Manually populate createdBy from platform database
      const { default: CompanyUser } = await import('../models/platform/CompanyUser.js');
      const createdByUser = await CompanyUser.findById(adjustmentData.createdBy)
        .select('name email')
        .lean();

      if (createdByUser) {
        populatedAdjustment.createdBy = {
          _id: createdByUser._id,
          name: createdByUser.name,
          email: createdByUser.email
        };
      }

      // Send notifications asynchronously (pending approval)
      setImmediate(async () => {
        try {
          const notificationService = (await import('./notificationService.js')).default;
          await notificationService.notifyStockAdjustmentCreation(companyId, populatedAdjustment, false);
          logger.info(`Notifications sent for pending stock adjustment ${populatedAdjustment.adjustmentNumber}`);
        } catch (notificationError) {
          logger.error('Error sending stock adjustment notifications:', notificationError);
          // Don't fail the adjustment creation if notifications fail
        }
      });

      // Publish domain event
      await publishDomainEvent(companyDB, {
        eventType: 'ADJUSTMENT_CREATED',
        entityType: 'ADJUSTMENT',
        entityId: populatedAdjustment._id,
        payload: {
          adjustmentNumber: populatedAdjustment.adjustmentNumber,
          adjustmentType: populatedAdjustment.adjustmentType,
          locationId: populatedAdjustment.locationId,
          itemCount: populatedAdjustment.items.length,
          status: populatedAdjustment.status
        },
        userId: adjustmentData.createdBy,
        locationId: populatedAdjustment.locationId
      }, companyId);

      logger.info(
        `Stock adjustment created (pending approval): ${populatedAdjustment.adjustmentNumber} ` +
        `(${populatedAdjustment.adjustmentType}) at ${location.name} for company: ${companyId}`
      );

      return populatedAdjustment;
    }
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

    // Send notification with properly populated data
    if (result.createdBy && result.createdBy.toString() !== userId.toString()) {
      setImmediate(async () => {
        try {
          // Fetch adjustment with populated fields for notification
          const populatedAdjustment = await StockAdjustment.findById(result._id)
            .populate('locationId', 'name code address')
            .populate('items.inventoryItem', 'name type unit sku')
            .lean();

          // Manually populate createdBy from platform database
          const { default: CompanyUser } = await import('../models/platform/CompanyUser.js');
          const createdByUser = await CompanyUser.findById(result.createdBy).select('name email').lean();
          if (createdByUser) {
            populatedAdjustment.createdBy = {
              _id: createdByUser._id,
              name: createdByUser.name,
              email: createdByUser.email
            };
          }

          // Manually populate approvedBy
          const approvedByUser = await CompanyUser.findById(result.approvedBy).select('name email').lean();
          if (approvedByUser) {
            populatedAdjustment.approvedBy = {
              _id: approvedByUser._id,
              name: approvedByUser.name,
              email: approvedByUser.email
            };
          }

          const notificationService = (await import('./notificationService.js')).default;
          await notificationService.notifyStockAdjustmentApproval(companyId, populatedAdjustment);
          logger.info(`Approval notification sent to creator for adjustment ${result.adjustmentNumber}`);
        } catch (notificationError) {
          logger.error('Error sending stock adjustment approval notification:', notificationError);
          // Don't fail the approval if notification fails
        }
      });
    }

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

    // Fetch populated adjustment for notification
    const populatedAdjustment = await StockAdjustment.findById(adjustment._id)
      .populate('locationId', 'name code address')
      .populate('items.inventoryItem', 'name type unit sku')
      .lean();

    // Notify the creator (in-app only) - async, only if not self-rejection
    if (adjustment.createdBy && adjustment.createdBy.toString() !== userId.toString()) {
      setImmediate(async () => {
        try {
          const notificationService = (await import('./notificationService.js')).default;
          await notificationService.notifyStockAdjustmentRejection(companyId, populatedAdjustment);
        } catch (error) {
          logger.error('Error sending rejection notification:', error);
        }
      });
    }

    return populatedAdjustment;
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
      .populate('locationId', 'name code type address')
      .populate('items.inventoryItem', 'name code unit type sku')
      .lean();

    if (!adjustment) {
      throw new Error('Stock adjustment not found');
    }

    // Manually populate createdBy from platform database
    if (adjustment.createdBy) {
      const { default: CompanyUser } = await import('../models/platform/CompanyUser.js');
      const user = await CompanyUser.findById(adjustment.createdBy).select('name email').lean();
      if (user) {
        adjustment.createdBy = {
          _id: user._id,
          name: user.name,
          email: user.email
        };
      }
    }

    // Manually populate approvedBy from platform database if exists
    if (adjustment.approvedBy) {
      const { default: CompanyUser } = await import('../models/platform/CompanyUser.js');
      const user = await CompanyUser.findById(adjustment.approvedBy).select('name email').lean();
      if (user) {
        adjustment.approvedBy = {
          _id: user._id,
          name: user.name,
          email: user.email
        };
      }
    }

    // Manually populate rejectedBy from platform database if exists
    if (adjustment.rejectedBy) {
      const { default: CompanyUser } = await import('../models/platform/CompanyUser.js');
      const user = await CompanyUser.findById(adjustment.rejectedBy).select('name email').lean();
      if (user) {
        adjustment.rejectedBy = {
          _id: user._id,
          name: user.name,
          email: user.email
        };
      }
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
