/**
 * Idempotency Middleware
 * Prevents duplicate transactions from network retries
 * Implements Requirements: 28.1, 28.2, 28.6
 */

import { getIdempotencyRecordModel } from '../models/company/IdempotencyRecord.js';
import { logger } from '../utils/logger.js';

/**
 * Idempotency middleware factory
 * @param {string} operationType - Type of operation (TRANSFER_APPROVAL, GRN_CREATION, ADJUSTMENT_APPROVAL)
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
          logger.warn(`Idempotency key reused for different operation type: ${idempotencyKey}`);
          return res.status(409).json({
            success: false,
            message: 'Idempotency key already used for a different operation type',
            details: {
              existingOperationType: existingRecord.operationType,
              requestedOperationType: operationType
            }
          });
        }
        
        // Check status
        if (existingRecord.status === 'completed') {
          // Return cached response
          logger.info(`Returning cached response for idempotency key: ${idempotencyKey}`);
          return res.status(200).json(existingRecord.responseData);
        } else if (existingRecord.status === 'processing') {
          // Request is still being processed
          logger.info(`Request still processing for idempotency key: ${idempotencyKey}`);
          return res.status(409).json({
            success: false,
            message: 'Request is currently being processed',
            retryAfter: 5 // Suggest retry after 5 seconds
          });
        } else if (existingRecord.status === 'failed') {
          // Previous attempt failed, allow retry
          logger.info(`Previous attempt failed for idempotency key: ${idempotencyKey}, allowing retry`);
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
        requestDate: new Date()
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

export default idempotencyMiddleware;
