/**
 * Stock Backorder Controller
 * API endpoints for backorder management operations
 * Implements Requirements: 5.6, 17.1-17.9
 */

import { logger } from '../utils/logger.js';
import {
  fulfillBackorder,
  cancelBackorder,
  getBackorder
} from '../services/stockBackorderService.js';
import { getAccessibleLocations } from '../middlewares/locationAccess.js';

/**
 * Extract IP address from request
 * @param {Object} req - Express request object
 * @returns {string} IP address
 */
const getIpAddress = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown';
};

/**
 * Extract device info from request headers
 * @param {Object} req - Express request object
 * @returns {string} Device info
 */
const getDeviceInfo = (req) => {
  return req.headers['user-agent'] || 'unknown';
};

/**
 * List backorders with offset-based pagination and location-based filtering
 * GET /api/v2/backorders
 * 
 * Query params:
 * - page: number (default 1)
 * - limit: number (max 100, default 10)
 * - status: 'pending' | 'fulfilled' | 'cancelled'
 * - fromLocation: ObjectId
 * - toLocation: ObjectId
 * - inventoryItem: ObjectId
 * - sortBy: 'createdAt' | 'ageInDays'
 * - sortOrder: 'asc' | 'desc'
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     backorders: [...],
 *     pagination: {
 *       total: number,
 *       page: number,
 *       limit: number,
 *       pages: number
 *     }
 *   }
 * }
 */
export const listBackorders = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const user = req.user;

    // Extract pagination parameters (offset-based)
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100); // Max 100 per page
    const skip = (page - 1) * limit;

    // Extract filter parameters
    const filters = {
      status: req.query.status,
      fromLocation: req.query.fromLocation,
      toLocation: req.query.toLocation,
      inventoryItem: req.query.inventoryItem,
      sortBy: req.query.sortBy || 'createdAt',
      sortOrder: req.query.sortOrder || 'desc'
    };

    // Apply location-based filtering
    const { isUnrestricted, locationIds } = getAccessibleLocations(user);
    
    // Build query (no companyId needed - database-level isolation)
    const query = {};

    // Location-based access control
    if (!isUnrestricted) {
      // Non-Super Admins can only see backorders for their locations
      query.$or = [
        { fromLocation: { $in: locationIds } },
        { toLocation: { $in: locationIds } }
      ];
    }

    // Apply filters
    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.fromLocation) {
      query.fromLocation = filters.fromLocation;
    }

    if (filters.toLocation) {
      query.toLocation = filters.toLocation;
    }

    if (filters.inventoryItem) {
      query.inventoryItem = filters.inventoryItem;
    }

    // Get StockBackorder model
    const StockBackorder = req.companyDB.model('StockBackorder');

    // Determine sort order
    const sortField = filters.sortBy === 'ageInDays' ? 'createdAt' : 'createdAt';
    const sortDirection = filters.sortOrder === 'asc' ? 1 : -1;

    // Get total count
    const total = await StockBackorder.countDocuments(query);
    const pages = Math.ceil(total / limit);

    // Execute query with pagination
    const backorders = await StockBackorder.find(query)
      .sort({ [sortField]: sortDirection, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate('fromLocation', 'name type')
      .populate('toLocation', 'name type')
      .populate('inventoryItem', 'name code')
      .populate('createdBy', 'name email')
      .populate('fulfilledBy', 'name email')
      .populate('cancelledBy', 'name email')
      .populate('originalRequestId', 'requestNumber')
      .populate('originalTransferId', 'transferNumber')
      .populate('fulfilledTransferId', 'transferNumber')
      .lean();

    // Calculate ageInDays for each backorder (virtual field)
    backorders.forEach(backorder => {
      if (backorder.createdAt) {
        backorder.ageInDays = Math.floor((Date.now() - new Date(backorder.createdAt).getTime()) / 86400000);
      }
    });

    logger.info('Backorders listed via API', {
      companyId,
      userId: user.userId,
      count: backorders.length,
      page,
      total
    });

    res.json({
      success: true,
      data: {
        backorders,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages
        }
      }
    });
  } catch (error) {
    logger.error('List backorders error', error);
    next(error);
  }
};

/**
 * Get a single backorder by ID
 * GET /api/v2/backorders/:backorderId
 * 
 * Response: {
 *   success: true,
 *   data: { backorder: {...} }
 * }
 */
export const getBackorderById = async (req, res, next) => {
  try {
    const { backorderId } = req.params;
    const { companyId, userId } = req.user;
    const user = req.user;

    // Get backorder
    const backorder = await getBackorder(backorderId, companyId);

    // Apply location-based access control
    const { isUnrestricted, locationIds } = getAccessibleLocations(user);
    
    if (!isUnrestricted) {
      // Check if user has access to either fromLocation or toLocation
      const hasAccess = locationIds.includes(backorder.fromLocation._id?.toString() || backorder.fromLocation) ||
                        locationIds.includes(backorder.toLocation._id?.toString() || backorder.toLocation);
      
      if (!hasAccess) {
        logger.warn('Backorder access denied', {
          userId,
          backorderId,
          fromLocation: backorder.fromLocation,
          toLocation: backorder.toLocation
        });

        return res.status(403).json({
          success: false,
          message: 'Access denied. You do not have permission to view this backorder.'
        });
      }
    }

    // Calculate ageInDays
    if (backorder.createdAt) {
      backorder.ageInDays = Math.floor((Date.now() - new Date(backorder.createdAt).getTime()) / 86400000);
    }

    logger.info('Backorder retrieved via API', {
      companyId,
      userId,
      backorderId
    });

    res.json({
      success: true,
      data: { backorder }
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    logger.error('Get backorder error', error);
    next(error);
  }
};

/**
 * Fulfill a backorder by creating a new stock transfer
 * POST /api/v2/backorders/:backorderId/fulfill
 * 
 * Body: {
 *   notes: string (optional)
 * }
 * 
 * Response: {
 *   success: true,
 *   message: 'Backorder fulfilled successfully',
 *   data: {
 *     backorder: {...},
 *     transfer: {...}
 *   }
 * }
 */
export const fulfillBackorderHandler = async (req, res, next) => {
  try {
    const { backorderId } = req.params;
    const { companyId, userId } = req.user;
    const { notes } = req.body;

    // Extract audit info
    const ipAddress = getIpAddress(req);
    const deviceInfo = getDeviceInfo(req);

    // Fulfill backorder
    const result = await fulfillBackorder(
      backorderId,
      userId,
      companyId,
      { ipAddress, deviceInfo, notes }
    );

    logger.info('Backorder fulfilled via API', {
      companyId,
      userId,
      backorderId,
      transferId: result.transfer._id
    });

    res.json({
      success: true,
      message: 'Backorder fulfilled successfully',
      data: {
        backorder: result.backorder,
        transfer: result.transfer
      }
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('status')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('already been fulfilled')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    logger.error('Fulfill backorder error', error);
    next(error);
  }
};

/**
 * Cancel a backorder
 * POST /api/v2/backorders/:backorderId/cancel
 * 
 * Body: {
 *   cancellationReason: string (required)
 * }
 * 
 * Response: {
 *   success: true,
 *   message: 'Backorder cancelled successfully',
 *   data: { backorder: {...} }
 * }
 */
export const cancelBackorderHandler = async (req, res, next) => {
  try {
    const { backorderId } = req.params;
    const { companyId, userId } = req.user;
    const { cancellationReason } = req.body;

    // Validate cancellation reason
    if (!cancellationReason || cancellationReason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cancellation reason is required'
      });
    }

    // Extract audit info
    const ipAddress = getIpAddress(req);
    const deviceInfo = getDeviceInfo(req);

    // Cancel backorder
    const backorder = await cancelBackorder(
      backorderId,
      userId,
      cancellationReason,
      companyId,
      { ipAddress, deviceInfo }
    );

    logger.info('Backorder cancelled via API', {
      companyId,
      userId,
      backorderId,
      reason: cancellationReason
    });

    res.json({
      success: true,
      message: 'Backorder cancelled successfully',
      data: { backorder }
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('status') || error.message.includes('required')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    logger.error('Cancel backorder error', error);
    next(error);
  }
};
