/**
 * Inventory Period Service
 * Business logic for inventory period locking operations
 * Ensures financial compliance by preventing backdated transactions
 */

import { getInventoryPeriodModel } from '../models/company/InventoryPeriod.js';
import { logger } from '../utils/logger.js';

/**
 * Create a new inventory period
 * @param {Object} periodData - Period data
 * @param {ObjectId} periodData.locationId - Location ID
 * @param {Date} periodData.periodStart - Period start date
 * @param {Date} periodData.periodEnd - Period end date
 * @param {String} periodData.notes - Optional notes
 * @param {Object} companyDB - Company database connection
 * @returns {Promise<Object>} Created period
 */
export const createPeriod = async (periodData, companyDB) => {
  try {
    const InventoryPeriod = getInventoryPeriodModel(companyDB);
    
    const { locationId, periodStart, periodEnd, notes } = periodData;
    
    // Validate dates
    if (new Date(periodStart) >= new Date(periodEnd)) {
      throw new Error('Period start date must be before period end date');
    }
    
    // Check for overlapping periods
    const overlappingPeriod = await InventoryPeriod.findOne({
      locationId,
      $or: [
        {
          periodStart: { $lte: periodEnd },
          periodEnd: { $gte: periodStart }
        }
      ]
    });
    
    if (overlappingPeriod) {
      throw new Error('Period overlaps with existing period');
    }
    
    const period = new InventoryPeriod({
      locationId,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      status: 'open',
      notes
    });
    
    await period.save();
    
    logger.info(`Inventory period created: ${period._id} for location ${locationId}`);
    
    return period;
  } catch (error) {
    logger.error('Error creating inventory period:', error);
    throw error;
  }
};

/**
 * Lock an inventory period
 * @param {ObjectId} periodId - Period ID
 * @param {ObjectId} userId - User ID performing the lock
 * @param {Object} companyDB - Company database connection
 * @returns {Promise<Object>} Updated period
 */
export const lockPeriod = async (periodId, userId, companyDB) => {
  try {
    const InventoryPeriod = getInventoryPeriodModel(companyDB);
    
    const period = await InventoryPeriod.findById(periodId);
    
    if (!period) {
      throw new Error('Inventory period not found');
    }
    
    if (period.status === 'locked') {
      throw new Error('Period is already locked');
    }
    
    period.status = 'locked';
    period.lockedBy = userId;
    period.lockedDate = new Date();
    
    await period.save();
    
    logger.info(`Inventory period locked: ${periodId} by user ${userId}`);
    
    return period;
  } catch (error) {
    logger.error('Error locking inventory period:', error);
    throw error;
  }
};

/**
 * Unlock an inventory period
 * @param {ObjectId} periodId - Period ID
 * @param {ObjectId} userId - User ID performing the unlock
 * @param {Object} companyDB - Company database connection
 * @returns {Promise<Object>} Updated period
 */
export const unlockPeriod = async (periodId, userId, companyDB) => {
  try {
    const InventoryPeriod = getInventoryPeriodModel(companyDB);
    
    const period = await InventoryPeriod.findById(periodId);
    
    if (!period) {
      throw new Error('Inventory period not found');
    }
    
    if (period.status === 'open') {
      throw new Error('Period is already unlocked');
    }
    
    period.status = 'open';
    period.unlockedBy = userId;
    period.unlockedDate = new Date();
    
    await period.save();
    
    logger.info(`Inventory period unlocked: ${periodId} by user ${userId}`);
    
    return period;
  } catch (error) {
    logger.error('Error unlocking inventory period:', error);
    throw error;
  }
};

/**
 * Get period by ID
 * @param {ObjectId} periodId - Period ID
 * @param {Object} companyDB - Company database connection
 * @returns {Promise<Object>} Period
 */
export const getPeriodById = async (periodId, companyDB) => {
  try {
    const InventoryPeriod = getInventoryPeriodModel(companyDB);
    
    const period = await InventoryPeriod.findById(periodId)
      .populate('locationId', 'name code type')
      .populate('lockedBy', 'name email')
      .populate('unlockedBy', 'name email');
    
    if (!period) {
      throw new Error('Inventory period not found');
    }
    
    return period;
  } catch (error) {
    logger.error('Error getting inventory period:', error);
    throw error;
  }
};

/**
 * Get periods by location
 * @param {ObjectId} locationId - Location ID
 * @param {Object} filters - Optional filters
 * @param {String} filters.status - Filter by status (open/locked)
 * @param {Date} filters.startDate - Filter by start date
 * @param {Date} filters.endDate - Filter by end date
 * @param {Object} companyDB - Company database connection
 * @returns {Promise<Array>} List of periods
 */
export const getPeriodsByLocation = async (locationId, filters = {}, companyDB) => {
  try {
    const InventoryPeriod = getInventoryPeriodModel(companyDB);
    
    const query = { locationId };
    
    if (filters.status) {
      query.status = filters.status;
    }
    
    if (filters.startDate || filters.endDate) {
      query.$or = [];
      
      if (filters.startDate) {
        query.$or.push({
          periodEnd: { $gte: new Date(filters.startDate) }
        });
      }
      
      if (filters.endDate) {
        query.$or.push({
          periodStart: { $lte: new Date(filters.endDate) }
        });
      }
    }
    
    const periods = await InventoryPeriod.find(query)
      .populate('locationId', 'name code type')
      .populate('lockedBy', 'name email')
      .populate('unlockedBy', 'name email')
      .sort({ periodStart: -1 });
    
    return periods;
  } catch (error) {
    logger.error('Error getting periods by location:', error);
    throw error;
  }
};

/**
 * Get locked periods by location and date range
 * @param {ObjectId} locationId - Location ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {Object} companyDB - Company database connection
 * @returns {Promise<Array>} List of locked periods
 */
export const getLockedPeriods = async (locationId, startDate, endDate, companyDB) => {
  try {
    const InventoryPeriod = getInventoryPeriodModel(companyDB);
    
    const query = {
      locationId,
      status: 'locked'
    };
    
    if (startDate || endDate) {
      query.$or = [];
      
      if (startDate) {
        query.$or.push({
          periodEnd: { $gte: new Date(startDate) }
        });
      }
      
      if (endDate) {
        query.$or.push({
          periodStart: { $lte: new Date(endDate) }
        });
      }
    }
    
    const periods = await InventoryPeriod.find(query)
      .populate('locationId', 'name code type')
      .populate('lockedBy', 'name email')
      .sort({ periodStart: -1 });
    
    return periods;
  } catch (error) {
    logger.error('Error getting locked periods:', error);
    throw error;
  }
};

/**
 * Check if a date falls within a locked period
 * @param {ObjectId} locationId - Location ID
 * @param {Date} transactionDate - Transaction date to check
 * @param {Object} companyDB - Company database connection
 * @returns {Promise<Object>} { isLocked: boolean, period: Object|null }
 */
export const checkIfDateIsLocked = async (locationId, transactionDate, companyDB) => {
  try {
    const InventoryPeriod = getInventoryPeriodModel(companyDB);
    
    const lockedPeriod = await InventoryPeriod.findOne({
      locationId,
      status: 'locked',
      periodStart: { $lte: new Date(transactionDate) },
      periodEnd: { $gte: new Date(transactionDate) }
    });
    
    return {
      isLocked: !!lockedPeriod,
      period: lockedPeriod
    };
  } catch (error) {
    logger.error('Error checking if date is locked:', error);
    throw error;
  }
};

/**
 * Delete a period (only if not locked)
 * @param {ObjectId} periodId - Period ID
 * @param {Object} companyDB - Company database connection
 * @returns {Promise<void>}
 */
export const deletePeriod = async (periodId, companyDB) => {
  try {
    const InventoryPeriod = getInventoryPeriodModel(companyDB);
    
    const period = await InventoryPeriod.findById(periodId);
    
    if (!period) {
      throw new Error('Inventory period not found');
    }
    
    if (period.status === 'locked') {
      throw new Error('Cannot delete a locked period. Unlock it first.');
    }
    
    await InventoryPeriod.findByIdAndDelete(periodId);
    
    logger.info(`Inventory period deleted: ${periodId}`);
  } catch (error) {
    logger.error('Error deleting inventory period:', error);
    throw error;
  }
};

export default {
  createPeriod,
  lockPeriod,
  unlockPeriod,
  getPeriodById,
  getPeriodsByLocation,
  getLockedPeriods,
  checkIfDateIsLocked,
  deletePeriod
};
