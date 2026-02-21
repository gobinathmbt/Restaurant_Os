/**
 * Period Lock Validation Middleware
 * Prevents backdated transactions in locked inventory periods
 * Ensures financial compliance by blocking modifications to closed periods
 */

import { getInventoryPeriodModel } from '../models/company/InventoryPeriod.js';

/**
 * Check if a transaction date falls within a locked period
 * @param {ObjectId} locationId - Location ID
 * @param {Date} transactionDate - Date of the transaction
 * @param {Object} companyDB - Company database connection
 * @returns {Promise<Object>} - { isLocked: boolean, period: Object|null }
 */
export const checkPeriodLock = async (locationId, transactionDate, companyDB) => {
  const InventoryPeriod = getInventoryPeriodModel(companyDB);
  
  // Find locked periods that contain the transaction date
  const lockedPeriod = await InventoryPeriod.findOne({
    locationId,
    status: 'locked',
    periodStart: { $lte: transactionDate },
    periodEnd: { $gte: transactionDate }
  });
  
  return {
    isLocked: !!lockedPeriod,
    period: lockedPeriod
  };
};

/**
 * Middleware to validate period lock for GRN creation
 * Checks if the GRN date falls within a locked period
 */
export const validatePeriodLockForGRN = async (req, res, next) => {
  try {
    const { receivedDate } = req.body;
    const locationId = req.body.locationId;
    
    if (!receivedDate || !locationId) {
      return next();
    }
    
    const transactionDate = new Date(receivedDate);
    const { isLocked, period } = await checkPeriodLock(locationId, transactionDate, req.companyDB);
    
    if (isLocked) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create GRN in locked period',
        error: {
          code: 'PERIOD_LOCKED',
          details: `The period from ${period.periodStart.toISOString().split('T')[0]} to ${period.periodEnd.toISOString().split('T')[0]} is locked`,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd
        }
      });
    }
    
    next();
  } catch (error) {
    console.error('Period lock validation error for GRN:', error);
    next(error);
  }
};

/**
 * Middleware to validate period lock for transfer approval
 * Checks if the approval date falls within a locked period for source location
 */
export const validatePeriodLockForTransferApproval = async (req, res, next) => {
  try {
    const { transfer } = req;
    
    if (!transfer) {
      return next();
    }
    
    const approvalDate = new Date();
    const { isLocked, period } = await checkPeriodLock(transfer.fromLocation, approvalDate, req.companyDB);
    
    if (isLocked) {
      return res.status(400).json({
        success: false,
        message: 'Cannot approve transfer in locked period',
        error: {
          code: 'PERIOD_LOCKED',
          details: `The period from ${period.periodStart.toISOString().split('T')[0]} to ${period.periodEnd.toISOString().split('T')[0]} is locked for source location`,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd
        }
      });
    }
    
    next();
  } catch (error) {
    console.error('Period lock validation error for transfer approval:', error);
    next(error);
  }
};

/**
 * Middleware to validate period lock for stock adjustment creation
 * Checks if the adjustment date falls within a locked period
 */
export const validatePeriodLockForAdjustment = async (req, res, next) => {
  try {
    const { locationId, createdDate } = req.body;
    
    if (!locationId) {
      return next();
    }
    
    const transactionDate = createdDate ? new Date(createdDate) : new Date();
    const { isLocked, period } = await checkPeriodLock(locationId, transactionDate, req.companyDB);
    
    if (isLocked) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create adjustment in locked period',
        error: {
          code: 'PERIOD_LOCKED',
          details: `The period from ${period.periodStart.toISOString().split('T')[0]} to ${period.periodEnd.toISOString().split('T')[0]} is locked`,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd
        }
      });
    }
    
    next();
  } catch (error) {
    console.error('Period lock validation error for adjustment:', error);
    next(error);
  }
};

/**
 * Generic middleware factory to validate period lock
 * @param {Function} getLocationId - Function to extract locationId from request
 * @param {Function} getTransactionDate - Function to extract transaction date from request
 * @param {String} operationType - Type of operation (for error message)
 */
export const createPeriodLockValidator = (getLocationId, getTransactionDate, operationType) => {
  return async (req, res, next) => {
    try {
      const locationId = getLocationId(req);
      const transactionDate = getTransactionDate(req);
      
      if (!locationId || !transactionDate) {
        return next();
      }
      
      const { isLocked, period } = await checkPeriodLock(locationId, transactionDate, req.companyDB);
      
      if (isLocked) {
        return res.status(400).json({
          success: false,
          message: `Cannot ${operationType} in locked period`,
          error: {
            code: 'PERIOD_LOCKED',
            details: `The period from ${period.periodStart.toISOString().split('T')[0]} to ${period.periodEnd.toISOString().split('T')[0]} is locked`,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd
          }
        });
      }
      
      next();
    } catch (error) {
      console.error(`Period lock validation error for ${operationType}:`, error);
      next(error);
    }
  };
};

export default {
  checkPeriodLock,
  validatePeriodLockForGRN,
  validatePeriodLockForTransferApproval,
  validatePeriodLockForAdjustment,
  createPeriodLockValidator
};
