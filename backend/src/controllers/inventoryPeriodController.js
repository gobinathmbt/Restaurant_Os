/**
 * Inventory Period Controller
 * Handles HTTP requests for inventory period locking operations
 * Ensures financial compliance by preventing backdated transactions
 */

import {
  createPeriod,
  lockPeriod,
  unlockPeriod,
  getPeriodById,
  getPeriodsByLocation,
  getLockedPeriods,
  deletePeriod
} from '../services/inventoryPeriodService.js';
import { logger } from '../utils/logger.js';

/**
 * Create a new inventory period
 * POST /api/inventory-periods
 * Only super admins and financial controllers can create periods
 */
export const createPeriodHandler = async (req, res, next) => {
  try {
    const { userId, role } = req.user;
    const companyDB = req.companyDB;

    // Check permissions - only super admins and financial controllers
    if (!['company_super_admin_primary', 'company_super_admin_secondary', 'financial_controller'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins and financial controllers can create inventory periods'
      });
    }

    const period = await createPeriod(req.body, companyDB);

    logger.info(`Inventory period created: ${period._id} by user: ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Inventory period created successfully',
      data: { period }
    });
  } catch (error) {
    logger.error('Create inventory period error:', error);
    
    if (error.message.includes('overlaps')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('before')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    next(error);
  }
};

/**
 * Lock an inventory period
 * PUT /api/inventory-periods/:id/lock
 * Only super admins and financial controllers can lock periods
 */
export const lockPeriodHandler = async (req, res, next) => {
  try {
    const { userId, role } = req.user;
    const { id } = req.params;
    const companyDB = req.companyDB;

    // Check permissions
    if (!['company_super_admin_primary', 'company_super_admin_secondary', 'financial_controller'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins and financial controllers can lock inventory periods'
      });
    }

    const period = await lockPeriod(id, userId, companyDB);

    logger.info(`Inventory period locked: ${id} by user: ${userId}`);

    res.json({
      success: true,
      message: 'Inventory period locked successfully',
      data: { period }
    });
  } catch (error) {
    logger.error('Lock inventory period error:', error);
    
    if (error.message === 'Inventory period not found') {
      return res.status(404).json({
        success: false,
        message: 'Inventory period not found'
      });
    }
    
    if (error.message.includes('already locked')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    next(error);
  }
};

/**
 * Unlock an inventory period
 * PUT /api/inventory-periods/:id/unlock
 * Only super admins and financial controllers can unlock periods
 */
export const unlockPeriodHandler = async (req, res, next) => {
  try {
    const { userId, role } = req.user;
    const { id } = req.params;
    const companyDB = req.companyDB;

    // Check permissions
    if (!['company_super_admin_primary', 'company_super_admin_secondary', 'financial_controller'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins and financial controllers can unlock inventory periods'
      });
    }

    const period = await unlockPeriod(id, userId, companyDB);

    logger.info(`Inventory period unlocked: ${id} by user: ${userId}`);

    res.json({
      success: true,
      message: 'Inventory period unlocked successfully',
      data: { period }
    });
  } catch (error) {
    logger.error('Unlock inventory period error:', error);
    
    if (error.message === 'Inventory period not found') {
      return res.status(404).json({
        success: false,
        message: 'Inventory period not found'
      });
    }
    
    if (error.message.includes('already unlocked')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    next(error);
  }
};

/**
 * Get period by ID
 * GET /api/inventory-periods/:id
 */
export const getPeriodHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyDB = req.companyDB;

    const period = await getPeriodById(id, companyDB);

    res.json({
      success: true,
      data: { period }
    });
  } catch (error) {
    logger.error('Get inventory period error:', error);
    
    if (error.message === 'Inventory period not found') {
      return res.status(404).json({
        success: false,
        message: 'Inventory period not found'
      });
    }
    
    next(error);
  }
};

/**
 * Get periods by location
 * GET /api/inventory-periods/location/:locationId
 */
export const getPeriodsByLocationHandler = async (req, res, next) => {
  try {
    const { locationId } = req.params;
    const { status, startDate, endDate } = req.query;
    const companyDB = req.companyDB;

    const filters = {};
    if (status) filters.status = status;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const periods = await getPeriodsByLocation(locationId, filters, companyDB);

    res.json({
      success: true,
      data: { 
        periods,
        count: periods.length
      }
    });
  } catch (error) {
    logger.error('Get periods by location error:', error);
    next(error);
  }
};

/**
 * Get locked periods by location and date range
 * GET /api/inventory-periods/locked/:locationId
 */
export const getLockedPeriodsHandler = async (req, res, next) => {
  try {
    const { locationId } = req.params;
    const { startDate, endDate } = req.query;
    const companyDB = req.companyDB;

    const periods = await getLockedPeriods(locationId, startDate, endDate, companyDB);

    res.json({
      success: true,
      data: { 
        periods,
        count: periods.length
      }
    });
  } catch (error) {
    logger.error('Get locked periods error:', error);
    next(error);
  }
};

/**
 * Delete a period
 * DELETE /api/inventory-periods/:id
 * Only super admins can delete periods
 */
export const deletePeriodHandler = async (req, res, next) => {
  try {
    const { userId, role } = req.user;
    const { id } = req.params;
    const companyDB = req.companyDB;

    // Check permissions - only super admins
    if (!['company_super_admin_primary', 'company_super_admin_secondary'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can delete inventory periods'
      });
    }

    await deletePeriod(id, companyDB);

    logger.info(`Inventory period deleted: ${id} by user: ${userId}`);

    res.json({
      success: true,
      message: 'Inventory period deleted successfully'
    });
  } catch (error) {
    logger.error('Delete inventory period error:', error);
    
    if (error.message === 'Inventory period not found') {
      return res.status(404).json({
        success: false,
        message: 'Inventory period not found'
      });
    }
    
    if (error.message.includes('locked period')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    next(error);
  }
};

export default {
  createPeriodHandler,
  lockPeriodHandler,
  unlockPeriodHandler,
  getPeriodHandler,
  getPeriodsByLocationHandler,
  getLockedPeriodsHandler,
  deletePeriodHandler
};
