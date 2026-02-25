/**
 * Stock Transfer Controller
 * Handles HTTP requests for stock transfer operations
 */

import * as stockTransferService from '../services/stockTransferService.js';
import { logger } from '../utils/logger.js';
import { getAccessibleLocations } from '../middlewares/locationAccess.js';

/**
 * List stock transfers with offset-based pagination and location-based filtering
 * GET /api/v2/stock-transfers
 */
export const listTransfers = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { 
      status, 
      page = 1, 
      limit = 10, 
      transferType,
      fromLocation,
      toLocation,
      startDate,
      endDate
    } = req.query;

    // Validate pagination parameters
    const parsedPage = Math.max(parseInt(page) || 1, 1);
    const parsedLimit = Math.min(parseInt(limit) || 10, 100);

    // Get accessible locations for the user
    const { isUnrestricted, locationIds } = getAccessibleLocations(req.user);

    // Build filters
    const filters = {
      status,
      transferType,
      fromLocation,
      toLocation,
      startDate,
      endDate
    };

    // Apply location-based filtering
    if (!isUnrestricted) {
      // For non-Super Admins, filter by accessible locations
      // Show transfers where user has access to fromLocation OR toLocation
      filters.accessibleLocations = locationIds;
    }

    const result = await stockTransferService.listTransfers(
      companyId,
      filters,
      {
        page: parsedPage,
        limit: parsedLimit
      }
    );

    res.json({
      success: true,
      data: {
        transfers: result.transfers,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          pages: result.pages
        }
      }
    });
  } catch (error) {
    logger.error('List stock transfers error', error);
    next(error);
  }
};

/**
 * Create a new stock transfer
 * POST /api/transfers
 */
export const createTransfer = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const transferData = {
      ...req.body,
      requestedBy: userId
    };

    // Validate required fields
    if (!transferData.fromLocation || !transferData.toLocation) {
      return res.status(400).json({
        success: false,
        message: 'fromLocation and toLocation are required'
      });
    }

    if (!transferData.transferType) {
      return res.status(400).json({
        success: false,
        message: 'transferType is required (push or request)'
      });
    }

    if (!transferData.items || !Array.isArray(transferData.items) || transferData.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required'
      });
    }

    // Create transfer
    const transfer = await stockTransferService.createTransfer(transferData, companyId);

    logger.info('Stock transfer created via API', {
      transferId: transfer._id,
      transferNumber: transfer.transferNumber,
      companyId,
      userId
    });

    res.status(201).json({
      success: true,
      message: 'Stock transfer created successfully',
      data: { transfer }
    });
  } catch (error) {
    logger.error('Create stock transfer error', error);

    if (error.message.includes('Missing required fields') ||
        error.message.includes('Invalid transfer type') ||
        error.message.includes('must be different') ||
        error.message.includes('not found or inactive') ||
        error.message.includes('cannot dispatch stock') ||
        error.message.includes('cannot receive stock') ||
        error.message.includes('Inter-company transfers are not supported')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};


/**
 * Get a single transfer by ID
 * GET /api/transfers/:id
 */
export const getTransferById = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;

    const transfer = await stockTransferService.getTransfer(id, companyId);

    res.json({
      success: true,
      data: { transfer }
    });
  } catch (error) {
    logger.error('Get transfer by ID error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};


/**
 * Approve a stock transfer
 * PUT /api/transfers/:id/approve
 */
export const approveTransfer = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;

    // Capture IP address and device info for audit trail
    const options = {
      allowPartialFulfillment: req.body.allowPartialFulfillment !== false,
      ipAddress: req.ip || req.connection.remoteAddress,
      deviceInfo: req.headers['user-agent']
    };

    const result = await stockTransferService.approveTransfer(id, userId, companyId, options);

    logger.info('Stock transfer approved via API', {
      transferId: id,
      transferNumber: result.transfer.transferNumber,
      companyId,
      userId,
      backordersCreated: result.backorders?.length || 0
    });

    res.json({
      success: true,
      message: 'Stock transfer approved successfully',
      data: result
    });
  } catch (error) {
    logger.error('Approve stock transfer error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Cannot transition') ||
        error.message.includes('Insufficient available quantity') ||
        error.message.includes('Inventory underflow') ||
        error.message.includes('Concurrent batch modification')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};


/**
 * Reject a stock transfer
 * PUT /api/transfers/:id/reject
 */
export const rejectTransfer = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const transfer = await stockTransferService.rejectTransfer(id, userId, reason, companyId);

    logger.info('Stock transfer rejected via API', {
      transferId: id,
      transferNumber: transfer.transferNumber,
      companyId,
      userId,
      reason
    });

    res.json({
      success: true,
      message: 'Stock transfer rejected successfully',
      data: { transfer }
    });
  } catch (error) {
    logger.error('Reject stock transfer error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Cannot transition') ||
        error.message.includes('reason is required')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};


/**
 * Cancel a stock transfer
 * PUT /api/transfers/:id/cancel
 */
export const cancelTransfer = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cancellation reason is required'
      });
    }

    const transfer = await stockTransferService.cancelTransfer(id, userId, reason, companyId);

    logger.info('Stock transfer cancelled via API', {
      transferId: id,
      transferNumber: transfer.transferNumber,
      companyId,
      userId,
      reason
    });

    res.json({
      success: true,
      message: 'Stock transfer cancelled successfully',
      data: { transfer }
    });
  } catch (error) {
    logger.error('Cancel stock transfer error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Cannot transition') ||
        error.message.includes('reason is required')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};


/**
 * Complete a stock transfer
 * PUT /api/transfers/:id/complete
 */
export const completeTransfer = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;
    const { receivedQuantities } = req.body;

    // Add IP and device info to receivedQuantities for audit trail
    const receivedQuantitiesWithMetadata = {
      ...receivedQuantities,
      ipAddress: req.ip || req.connection.remoteAddress,
      deviceInfo: req.headers['user-agent']
    };

    const transfer = await stockTransferService.completeTransfer(
      id,
      userId,
      receivedQuantitiesWithMetadata,
      companyId
    );

    logger.info('Stock transfer completed via API', {
      transferId: id,
      transferNumber: transfer.transferNumber,
      companyId,
      userId
    });

    res.json({
      success: true,
      message: 'Stock transfer completed successfully',
      data: { transfer }
    });
  } catch (error) {
    logger.error('Complete stock transfer error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Cannot transition') ||
        error.message.includes('Insufficient in-transit quantity') ||
        error.message.includes('cannot exceed sent quantity') ||
        error.message.includes('cannot be negative')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};


/**
 * Return a stock transfer
 * PUT /api/transfers/:id/return
 */
export const returnTransfer = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Return reason is required'
      });
    }

    const transfer = await stockTransferService.returnTransfer(id, userId, reason, companyId);

    logger.info('Stock transfer returned via API', {
      transferId: id,
      transferNumber: transfer.transferNumber,
      companyId,
      userId,
      reason
    });

    res.json({
      success: true,
      message: 'Stock transfer returned successfully',
      data: { transfer }
    });
  } catch (error) {
    logger.error('Return stock transfer error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Cannot transition') ||
        error.message.includes('reason is required') ||
        error.message.includes('Insufficient in-transit quantity')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};


/**
 * Get transfers by location
 * GET /api/transfers/location/:locationId
 */
export const getTransfersByLocation = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { locationId } = req.params;
    const { direction = 'both', page, limit, status, transferType, startDate, endDate } = req.query;

    const result = await stockTransferService.getTransfersByLocation(
      locationId,
      direction,
      companyId,
      { page, limit, status, transferType, startDate, endDate }
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get transfers by location error', error);

    if (error.message.includes('Invalid direction')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};


/**
 * Get transfers by status
 * GET /api/transfers/status/:status
 */
export const getTransfersByStatus = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { status } = req.params;
    const { page, limit, transferType, startDate, endDate } = req.query;

    const result = await stockTransferService.getTransfersByStatus(
      status,
      companyId,
      { page, limit, transferType, startDate, endDate }
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get transfers by status error', error);

    if (error.message.includes('Invalid status')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};


/**
 * Ship a stock transfer (Warehouse Admin marks as shipped)
 * POST /api/v2/stock-transfers/:transferId/ship
 */
export const shipTransfer = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { transferId } = req.params;
    const { notes } = req.body;

    // Get transfer to validate location access
    const transfer = await stockTransferService.getTransfer(transferId, companyId);
    
    // Validate user has access to fromLocation (Warehouse Admin)
    const { hasLocationAccess } = await import('../middlewares/locationAccess.js');
    if (!hasLocationAccess(req.user, transfer.fromLocation._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to ship transfers from this location.'
      });
    }

    // Capture IP address and device info for audit trail
    const options = {
      ipAddress: req.ip || req.connection.remoteAddress,
      deviceInfo: req.headers['user-agent'],
      notes
    };

    const shippedTransfer = await stockTransferService.shipTransfer(transferId, userId, companyId, options);

    logger.info('Stock transfer shipped via API', {
      transferId,
      transferNumber: shippedTransfer.transferNumber,
      companyId,
      userId
    });

    res.json({
      success: true,
      message: 'Stock transfer shipped successfully',
      data: { transfer: shippedTransfer }
    });
  } catch (error) {
    logger.error('Ship stock transfer error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Cannot ship') ||
        error.message.includes('Insufficient available quantity') ||
        error.message.includes('Inventory underflow') ||
        error.message.includes('Concurrent batch modification')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};


/**
 * Receive a stock transfer (Branch Admin marks as received)
 * POST /api/v2/stock-transfers/:transferId/receive
 */
export const receiveTransfer = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { transferId } = req.params;
    const { items, notes } = req.body;

    // Get transfer to validate location access
    const transfer = await stockTransferService.getTransfer(transferId, companyId);
    
    // Validate user has access to toLocation (Branch Admin)
    const { hasLocationAccess } = await import('../middlewares/locationAccess.js');
    if (!hasLocationAccess(req.user, transfer.toLocation._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to receive transfers at this location.'
      });
    }

    // Build receivedQuantities map from items array
    const receivedQuantities = {};
    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (item.inventoryItem && item.receivedQuantity !== undefined) {
          receivedQuantities[item.inventoryItem] = item.receivedQuantity;
        }
      }
    }

    // Add IP and device info to receivedQuantities for audit trail
    receivedQuantities.ipAddress = req.ip || req.connection.remoteAddress;
    receivedQuantities.deviceInfo = req.headers['user-agent'];
    if (notes) {
      receivedQuantities.notes = notes;
    }

    const receivedTransfer = await stockTransferService.receiveTransfer(
      transferId,
      userId,
      receivedQuantities,
      companyId
    );

    logger.info('Stock transfer received via API', {
      transferId,
      transferNumber: receivedTransfer.transferNumber,
      companyId,
      userId
    });

    res.json({
      success: true,
      message: 'Stock transfer received successfully',
      data: { transfer: receivedTransfer }
    });
  } catch (error) {
    logger.error('Receive stock transfer error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Cannot receive') ||
        error.message.includes('cannot exceed sent quantity') ||
        error.message.includes('cannot be negative')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};
