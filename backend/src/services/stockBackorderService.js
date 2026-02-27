/**
 * Stock Backorder Service
 * Business logic for backorder management operations
 * Handles backorder fulfillment and cancellation with transaction support
 */

import { getCompanyDB } from '../config/database.js';
import { getStockBackorderModel } from '../models/company/StockBackorder.js';
import { getStockTransferModel } from '../models/company/StockTransfer.js';
import { getCounterModel } from '../models/company/Counter.js';
import { logger } from '../utils/logger.js';
import { withTransactionAndRetry } from '../utils/concurrencyControl.js';

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
 * Fulfill a backorder by creating a new stock transfer
 * Validates backorder status is 'pending' before fulfillment
 * Creates new StockTransfer with backorder quantity
 * Transitions backorder status to 'fulfilled'
 * Links transfer via fulfilledTransferId
 * 
 * @param {string} backorderId - Backorder ID to fulfill
 * @param {string} userId - User fulfilling the backorder
 * @param {string} companyId - Company ID
 * @param {Object} options - Additional options (ipAddress, deviceInfo, notes)
 * @returns {Promise<Object>} Object containing fulfilled backorder and created transfer
 * @throws {Error} If backorder not found, status is not 'pending', or already fulfilled
 */
export const fulfillBackorder = async (backorderId, userId, companyId, options = {}) => {
  try {
    const { ipAddress, deviceInfo, notes } = options;
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

        // Get original transfer or request for reference
        let originalReference = null;
        let originalReferenceNumber = null;
        
        if (currentBackorder.originalRequestId) {
          // New workflow: reference the stock request
          const StockRequest = companyDB.model('StockRequest');
          originalReference = await StockRequest.findById(
            currentBackorder.originalRequestId
          ).session(session);
          originalReferenceNumber = originalReference?.requestNumber;
        } else if (currentBackorder.originalTransferId) {
          // Legacy workflow: reference the original transfer
          originalReference = await StockTransfer.findById(
            currentBackorder.originalTransferId
          ).session(session);
          originalReferenceNumber = originalReference?.transferNumber;
        }

        if (!originalReference) {
          throw new Error(
            `Original reference not found for backorder ${backorderId}`
          );
        }

        // Generate new transfer number
        const transferNumber = await generateTransferNumber(companyDB);

        // Create new transfer for backorder fulfillment
        const newTransfer = new StockTransfer({
          transferNumber,
          companyId,
          destinationLocation: currentBackorder.destinationLocation,
          sourceLocation: currentBackorder.sourceLocation,
          transferType: originalReference.transferType || 'request',
          priority: originalReference.priority || 'normal',
          systemGenerated: true, // Mark as system-generated for audit clarity
          items: [{
            inventoryItem: currentBackorder.inventoryItem,
            requestedQuantity: currentBackorder.backorderedQuantity,
            sentQuantity: currentBackorder.backorderedQuantity,
            backorderedQuantity: 0,
            unit: currentBackorder.unit,
            notes: notes || `Backorder fulfillment for ${originalReferenceNumber}`
          }],
          status: 'approved', // Start at 'approved' status per new workflow
          requestedBy: userId,
          requestDate: new Date(),
          notes: notes || `Backorder fulfillment for ${originalReferenceNumber} (Backorder ID: ${currentBackorder._id})`,
          originalRequestId: currentBackorder.originalRequestId, // Link to original request if exists
          version: 0
        });

        await newTransfer.save({ session });

        // Update backorder status
        currentBackorder.status = 'fulfilled';
        currentBackorder.fulfilledTransferId = newTransfer._id;
        currentBackorder.fulfilledDate = new Date();
        currentBackorder.fulfilledBy = userId;
        
        // Add audit fields if provided
        if (ipAddress) {
          currentBackorder.fulfilledIpAddress = ipAddress;
        }
        if (deviceInfo) {
          currentBackorder.fulfilledDeviceInfo = deviceInfo;
        }
        
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
 * Validates user authorization and requires non-empty cancellationReason
 * Updates backorder status to 'cancelled' with audit trail
 * 
 * @param {string} backorderId - Backorder ID to cancel
 * @param {string} userId - User cancelling the backorder
 * @param {string} cancellationReason - Reason for cancellation (required)
 * @param {string} companyId - Company ID
 * @param {Object} options - Additional options (ipAddress, deviceInfo)
 * @returns {Promise<Object>} Cancelled backorder
 * @throws {Error} If backorder not found, status is not 'pending', or cancellationReason is empty
 */
export const cancelBackorder = async (backorderId, userId, cancellationReason, companyId, options = {}) => {
  try {
    const { ipAddress, deviceInfo } = options;
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
        
        // Add audit fields if provided
        if (ipAddress) {
          currentBackorder.cancelledIpAddress = ipAddress;
        }
        if (deviceInfo) {
          currentBackorder.cancelledDeviceInfo = deviceInfo;
        }
        
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
 * Supports filtering by destinationLocation or sourceLocation
 * 
 * @param {string} locationId - Location ID (can be destinationLocation or sourceLocation)
 * @param {string} direction - 'from' or 'to' to specify location role
 * @param {string} companyId - Company ID
 * @param {Object} options - Query options (itemId, limit, skip)
 * @returns {Promise<Array>} List of pending backorders with populated references
 */
export const getPendingBackorders = async (locationId, direction, companyId, options = {}) => {
  try {
    const { itemId, limit = 100, skip = 0 } = options;
    
    const companyDB = getCompanyDB(companyId);
    const StockBackorder = getStockBackorderModel(companyDB);

    // Build query with companyId filter
    const query = {
      companyId,
      status: 'pending'
    };

    if (direction === 'from') {
      query.destinationLocation = locationId;
    } else if (direction === 'to') {
      query.sourceLocation = locationId;
    } else {
      // Both directions
      query.$or = [
        { destinationLocation: locationId },
        { sourceLocation: locationId }
      ];
    }

    if (itemId) {
      query.inventoryItem = itemId;
    }

    const backorders = await StockBackorder.find(query)
      .populate('inventoryItem', 'name code')
      .populate('destinationLocation', 'name code')
      .populate('sourceLocation', 'name code')
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
 * Get backorder by ID with populated references
 * 
 * @param {string} backorderId - Backorder ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Backorder with populated references
 * @throws {Error} If backorder not found
 */
export const getBackorder = async (backorderId, companyId) => {
  try {
    const companyDB = getCompanyDB(companyId);
    const StockBackorder = getStockBackorderModel(companyDB);

    const backorder = await StockBackorder.findOne({
      _id: backorderId,
      companyId
    })
      .populate('inventoryItem', 'name code')
      .populate('destinationLocation', 'name code')
      .populate('sourceLocation', 'name code')
      .populate('originalTransferId')
      .populate('originalRequestId')
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
