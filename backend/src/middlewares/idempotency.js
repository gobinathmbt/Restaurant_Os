/**
 * Idempotency Middleware
 * Prevents duplicate transactions from network retries
 * Implements Requirements: 13.6-13.8, 28.1, 28.2, 28.6
 * 
 * Supports idempotency for:
 * - Stock request approval/rejection/cancellation
 * - Stock transfer shipment/receipt/cancellation
 * - Backorder fulfillment/cancellation
 * - Legacy operations (transfer approval, GRN creation, adjustment approval)
 * 
 * Features:
 * - 24-hour expiration for idempotency keys
 * - Cached response return for duplicate requests
 * - Concurrent request detection (409 Conflict)
 * - Failed request retry support
 */

import { getIdempotencyRecordModel } from '../models/company/IdempotencyRecord.js';
import { logger } from '../utils/logger.js';

/**
 * Idempotency middleware factory
 * @param {string} operationType - Type of operation:
 *   - STOCK_REQUEST_APPROVAL: Approving a stock request
 *   - STOCK_REQUEST_REJECTION: Rejecting a stock request
 *   - STOCK_REQUEST_CANCELLATION: Cancelling a stock request
 *   - STOCK_TRANSFER_SHIPMENT: Marking transfer as shipped
 *   - STOCK_TRANSFER_RECEIPT: Marking transfer as received
 *   - STOCK_TRANSFER_CANCELLATION: Cancelling a transfer
 *   - BACKORDER_FULFILLMENT: Fulfilling a backorder
 *   - BACKORDER_CANCELLATION: Cancelling a backorder
 *   - TRANSFER_APPROVAL: Legacy transfer approval
 *   - GRN_CREATION: GRN creation
 *   - ADJUSTMENT_APPROVAL: Stock adjustment approval
 * @returns {Function} Express middleware function
 */
export const idempotencyMiddleware = (operationType) => {
  return async (req, res, next) => {
    try {
      // Extract idempotency key from header
      const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
      
      // If no idempotency key provided, proceed without idempotency check
      if (!idempotencyKey) {
        return next();
      }
      
      // Validate idempotency key format (should be non-empty string)
      if (typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid idempotency key format'
        });
      }
      
      // Get company database from request context
      const companyDB = req.companyDB;
      if (!companyDB) {
        logger.error('Company database not found in request context for idempotency check');
        return res.status(500).json({
          success: false,
          message: 'Database context not available'
        });
      }
      
      const IdempotencyRecord = getIdempotencyRecordModel(companyDB);
      
      // Check for existing idempotency record
      const existingRecord = await IdempotencyRecord.findOne({ idempotencyKey });
      
      if (existingRecord) {
        // Validate operation type matches
        if (existingRecord.operationType !== operationType) {
          logger.warn(`Idempotency key reused for different operation type: ${idempotencyKey}`, {
            existingOperationType: existingRecord.operationType,
            requestedOperationType: operationType,
            userId: req.user?._id
          });
          return res.status(409).json({
            success: false,
            message: 'Idempotency key already used for a different operation type',
            details: {
              existingOperationType: existingRecord.operationType,
              requestedOperationType: operationType
            }
          });
        }
        
        // Check if record has expired (shouldn't happen due to TTL, but check anyway)
        if (existingRecord.expiresAt && existingRecord.expiresAt < new Date()) {
          logger.info(`Expired idempotency record found, allowing retry: ${idempotencyKey}`);
          await IdempotencyRecord.deleteOne({ _id: existingRecord._id });
          // Continue to create new record below
        } else if (existingRecord.status === 'completed') {
          // Return cached response (idempotent behavior)
          logger.info(`Returning cached response for idempotency key: ${idempotencyKey}`, {
            operationType,
            userId: req.user?._id,
            originalRequestDate: existingRecord.requestDate,
            completedDate: existingRecord.completedDate
          });
          return res.status(200).json(existingRecord.responseData);
        } else if (existingRecord.status === 'processing') {
          // Request is still being processed (concurrent request detected)
          logger.warn(`Concurrent request detected for idempotency key: ${idempotencyKey}`, {
            operationType,
            userId: req.user?._id,
            originalRequestDate: existingRecord.requestDate
          });
          return res.status(409).json({
            success: false,
            message: 'Request is currently being processed. Please wait and do not retry.',
            error: 'CONCURRENT_REQUEST',
            retryAfter: 5 // Suggest retry after 5 seconds
          });
        } else if (existingRecord.status === 'failed') {
          // Previous attempt failed, allow retry
          logger.info(`Previous attempt failed for idempotency key: ${idempotencyKey}, allowing retry`, {
            operationType,
            userId: req.user?._id,
            errorMessage: existingRecord.errorMessage
          });
          // Delete the failed record to allow retry
          await IdempotencyRecord.deleteOne({ _id: existingRecord._id });
        }
      }
      
      // Create new idempotency record in 'processing' state
      const newRecord = await IdempotencyRecord.create({
        idempotencyKey,
        operationType,
        status: 'processing',
        requestedBy: req.user._id,
        requestDate: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      });
      
      logger.info(`Created idempotency record for key: ${idempotencyKey}`, {
        operationType,
        userId: req.user?._id,
        expiresAt: newRecord.expiresAt
      });
      
      // Store idempotency record ID in request for later use
      req.idempotencyRecordId = newRecord._id;
      req.idempotencyKey = idempotencyKey;
      
      // Wrap res.json to capture response and update idempotency record
      const originalJson = res.json.bind(res);
      res.json = async function(data) {
        try {
          // Update idempotency record with response
          if (req.idempotencyRecordId) {
            const status = data.success !== false ? 'completed' : 'failed';
            await IdempotencyRecord.findByIdAndUpdate(req.idempotencyRecordId, { 
              status,
              responseData: data,
              completedDate: new Date(),
              errorMessage: status === 'failed' ? data.message : undefined
            });
            
            logger.info(`Updated idempotency record to ${status}: ${req.idempotencyKey}`, {
              operationType,
              userId: req.user?._id
            });
          }
        } catch (error) {
          logger.error('Error updating idempotency record:', error);
          // Don't fail the request if we can't update the record
        }
        
        return originalJson(data);
      };
      
      // Handle errors and update idempotency record
      const originalNext = next;
      next = async function(error) {
        if (error && req.idempotencyRecordId) {
          try {
            await IdempotencyRecord.findByIdAndUpdate(req.idempotencyRecordId, {
              status: 'failed',
              completedDate: new Date(),
              errorMessage: error.message || 'Unknown error'
            });
          } catch (updateError) {
            logger.error('Error updating idempotency record on error:', updateError);
          }
        }
        return originalNext(error);
      };
      
      next();
    } catch (error) {
      logger.error('Error in idempotency middleware:', error);
      // Don't fail the request if idempotency check fails
      // Log the error and proceed
      next();
    }
  };
};

/**
 * Cleanup expired idempotency records
 * Note: MongoDB TTL index handles automatic cleanup, but this can be used for manual cleanup
 */
export const cleanupExpiredRecords = async (companyDB) => {
  try {
    const IdempotencyRecord = getIdempotencyRecordModel(companyDB);
    const result = await IdempotencyRecord.deleteMany({
      expiresAt: { $lt: new Date() }
    });
    logger.info(`Cleaned up ${result.deletedCount} expired idempotency records`);
    return result.deletedCount;
  } catch (error) {
    logger.error('Error cleaning up expired idempotency records:', error);
    throw error;
  }
};

/**
 * Pre-configured idempotency middleware for stock request operations
 */
export const stockRequestApprovalIdempotency = idempotencyMiddleware('STOCK_REQUEST_APPROVAL');
export const stockRequestRejectionIdempotency = idempotencyMiddleware('STOCK_REQUEST_REJECTION');
export const stockRequestCancellationIdempotency = idempotencyMiddleware('STOCK_REQUEST_CANCELLATION');

/**
 * Pre-configured idempotency middleware for stock transfer operations
 */
export const stockTransferShipmentIdempotency = idempotencyMiddleware('STOCK_TRANSFER_SHIPMENT');
export const stockTransferReceiptIdempotency = idempotencyMiddleware('STOCK_TRANSFER_RECEIPT');
export const stockTransferCancellationIdempotency = idempotencyMiddleware('STOCK_TRANSFER_CANCELLATION');

/**
 * Pre-configured idempotency middleware for backorder operations
 */
export const backorderFulfillmentIdempotency = idempotencyMiddleware('BACKORDER_FULFILLMENT');
export const backorderCancellationIdempotency = idempotencyMiddleware('BACKORDER_CANCELLATION');

/**
 * Operation type constants for use in controllers
 */
export const OPERATION_TYPES = {
  STOCK_REQUEST_APPROVAL: 'STOCK_REQUEST_APPROVAL',
  STOCK_REQUEST_REJECTION: 'STOCK_REQUEST_REJECTION',
  STOCK_REQUEST_CANCELLATION: 'STOCK_REQUEST_CANCELLATION',
  STOCK_TRANSFER_SHIPMENT: 'STOCK_TRANSFER_SHIPMENT',
  STOCK_TRANSFER_RECEIPT: 'STOCK_TRANSFER_RECEIPT',
  STOCK_TRANSFER_CANCELLATION: 'STOCK_TRANSFER_CANCELLATION',
  BACKORDER_FULFILLMENT: 'BACKORDER_FULFILLMENT',
  BACKORDER_CANCELLATION: 'BACKORDER_CANCELLATION',
  TRANSFER_APPROVAL: 'TRANSFER_APPROVAL',
  GRN_CREATION: 'GRN_CREATION',
  ADJUSTMENT_APPROVAL: 'ADJUSTMENT_APPROVAL'
};

export default idempotencyMiddleware;
