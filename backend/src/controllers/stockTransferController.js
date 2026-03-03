/**
 * Stock Transfer Controller
 * Handles HTTP requests for stock transfer operations
 */

import * as stockTransferService from '../services/stockTransferService.js';
import { logger } from '../utils/logger.js';
import { getAccessibleLocations } from '../middlewares/locationAccess.js';

/**
 * List stock transfers with offset-based pagination and location-based filtering
 * GET /api/stock-transfers
 */
export const listTransfers = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { 
      status, 
      page = 1, 
      limit = 10, 
      transferType,
      destinationLocation,
      sourceLocation,
      branchId, // Add branchId parameter
      startDate,
      endDate
    } = req.query;

    // Validate pagination parameters
    const parsedPage = Math.max(parseInt(page) || 1, 1);
    const parsedLimit = Math.min(parseInt(limit) || 10, 100);

    // Get accessible locations for the user
    const { isUnrestricted, locationIds } = getAccessibleLocations(req.user);
    
    // Check if user is super admin
    const isSuperAdmin = req.user.role === 'company_super_admin_primary' || 
                         req.user.role === 'company_super_admin_secondary';


    // Build filters
    const filters = {
      status,
      transferType,
      destinationLocation,
      sourceLocation,
      startDate,
      endDate
    };

    // Apply location-based filtering
    // Super admins with branchId='all' can see ALL transfers (no location filter)
    if (!isSuperAdmin || (branchId && branchId !== 'all')) {
      if (!isUnrestricted) {
         filters.accessibleLocations = locationIds;
      }
    } else {
      console.log('✅ [LIST TRANSFERS DEBUG] Super admin with branchId=all - showing ALL transfers');
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
    if (!transferData.destinationLocation || !transferData.sourceLocation) {
      return res.status(400).json({
        success: false,
        message: 'destinationLocation and sourceLocation are required'
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
 * GET /api/transfers/:id or /api/transfers/:transferId
 */
export const getTransferById = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    // Support both :id (legacy) and :transferId (v2) route parameters
    const transferId = req.params.transferId || req.params.id;

    const transfer = await stockTransferService.getTransfer(transferId, companyId);

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
 * POST /api/stock-transfers/:transferId/ship
 */
export const shipTransfer = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { transferId } = req.params;
    const { notes } = req.body;

    // Get transfer to validate location access
    const transfer = await stockTransferService.getTransfer(transferId, companyId);
    
    // Validate user has access to destinationLocation (Warehouse Admin)
    const { hasLocationAccess } = await import('../middlewares/locationAccess.js');
    if (!hasLocationAccess(req.user, transfer.destinationLocation._id.toString())) {
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
 * POST /api/stock-transfers/:transferId/receive
 */
export const receiveTransfer = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { transferId } = req.params;
    const { items, notes } = req.body;

    // Get transfer to validate location access
    const transfer = await stockTransferService.getTransfer(transferId, companyId);
    
    // Validate user has access to sourceLocation (Branch Admin)
    const { hasLocationAccess } = await import('../middlewares/locationAccess.js');
    if (!hasLocationAccess(req.user, transfer.sourceLocation._id.toString())) {
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


/**
 * Update execution stage of a stock transfer
 * PATCH /api/stock-transfers/:transferId/stage
 */
export const updateExecutionStage = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { transferId } = req.params;
    const { stage, notes } = req.body;

    // Validate required fields
    if (!stage) {
      return res.status(400).json({
        success: false,
        message: 'Stage is required'
      });
    }

    // Capture IP address and device info for audit trail
    const options = {
      ipAddress: req.ip || req.connection.remoteAddress,
      deviceInfo: req.headers['user-agent'],
      notes
    };

    const updatedTransfer = await stockTransferService.updateExecutionStage(
      transferId,
      stage,
      userId,
      companyId,
      options
    );

    logger.info('Stock transfer execution stage updated via API', {
      transferId,
      transferNumber: updatedTransfer.transferNumber,
      stage,
      companyId,
      userId
    });

    res.json({
      success: true,
      message: 'Execution stage updated successfully',
      data: { transfer: updatedTransfer }
    });
  } catch (error) {
    logger.error('Update execution stage error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Invalid stage transition') ||
        error.message.includes('does not have permission') ||
        error.message.includes('Stage is required')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};


/**
 * Accept stock with exception recording
 * POST /api/stock-transfers/:transferId/accept
 */
export const acceptStock = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { transferId } = req.params;
    const { items } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items array is required'
      });
    }

    // Get transfer to validate location access
    const transfer = await stockTransferService.getTransfer(transferId, companyId);
    
    // Validate user has access to sourceLocation (destination admin)
    const { hasLocationAccess } = await import('../middlewares/locationAccess.js');
    if (!hasLocationAccess(req.user, transfer.sourceLocation._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to accept stock at this location.'
      });
    }

    // Capture IP address and device info for audit trail
    const options = {
      ipAddress: req.ip || req.connection.remoteAddress,
      deviceInfo: req.headers['user-agent']
    };

    const updatedTransfer = await stockTransferService.acceptStock(
      transferId,
      userId,
      items,
      companyId,
      options
    );

    logger.info('Stock accepted with exceptions via API', {
      transferId,
      transferNumber: updatedTransfer.transferNumber,
      exceptionsCount: updatedTransfer.exceptions?.length || 0,
      companyId,
      userId
    });

    res.json({
      success: true,
      message: 'Stock accepted successfully',
      data: { transfer: updatedTransfer }
    });
  } catch (error) {
    logger.error('Accept stock error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Invalid stage') ||
        error.message.includes('Items array is required') ||
        error.message.includes('does not have permission')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};


/**
 * Get in-transit transfers
 * GET /api/stock-transfers/in-transit
 */
export const getInTransitTransfers = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { page = 1, limit = 10 } = req.query;

    // Validate pagination parameters
    const parsedPage = Math.max(parseInt(page) || 1, 1);
    const parsedLimit = Math.min(parseInt(limit) || 10, 100);

    // Get accessible locations for the user
    const { isUnrestricted, locationIds } = getAccessibleLocations(req.user);

    const result = await stockTransferService.getInTransitTransfers(
      companyId,
      {
        isUnrestricted,
        locationIds
      },
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
    logger.error('Get in-transit transfers error', error);
    next(error);
  }
};


/**
 * Get transfers with exceptions
 * GET /api/stock-transfers/exceptions
 */
export const getExceptions = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { resolved, page = 1, limit = 10 } = req.query;

    // Validate pagination parameters
    const parsedPage = Math.max(parseInt(page) || 1, 1);
    const parsedLimit = Math.min(parseInt(limit) || 10, 100);

    // Get accessible locations for the user
    const { isUnrestricted, locationIds } = getAccessibleLocations(req.user);

    // Parse resolved filter
    const resolvedFilter = resolved === 'true' ? true : resolved === 'false' ? false : undefined;

    const result = await stockTransferService.getExceptions(
      companyId,
      {
        isUnrestricted,
        locationIds,
        resolved: resolvedFilter
      },
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
    logger.error('Get transfers with exceptions error', error);
    next(error);
  }
};


/**
 * Get completed stock transfers
 * GET /api/stock-transfers/completed
 */
export const getCompletedTransfers = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { page = 1, limit = 10, hasExceptions } = req.query;
    
    // Validate pagination parameters
    const parsedPage = Math.max(parseInt(page) || 1, 1);
    const parsedLimit = Math.min(parseInt(limit) || 10, 100);
    
    // Get accessible locations for the user
    const { isUnrestricted, locationIds } = getAccessibleLocations(req.user);
    
    // Build filters
    const filters = {
      destinationLocation: req.query.destinationLocation,
      sourceLocation: req.query.sourceLocation,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      search: req.query.search,
      hasExceptions
    };
    
    const result = await stockTransferService.getCompletedTransfers(
      companyId,
      filters,
      {
        page: parsedPage,
        limit: parsedLimit
      },
      {
        isUnrestricted,
        locationIds
      }
    );
    
    res.json({
      success: true,
      data: {
        transfers: result.transfers,
        pagination: result.pagination
      }
    });
  } catch (error) {
    logger.error('Get completed stock transfers error', error);
    next(error);
  }
};

/**
 * Record exceptions for a stock transfer
 * POST /api/stock-transfers/:transferId/exceptions
 */
export const recordExceptions = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { transferId } = req.params;
    const { exceptions } = req.body;
    const idempotencyKey = req.headers['idempotency-key'];

    // Validate request body
    if (!exceptions || !Array.isArray(exceptions) || exceptions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Exceptions array is required and must not be empty'
      });
    }

    // Validate each exception has required fields
    for (const exception of exceptions) {
      if (!exception.type || !exception.inventoryItem || !exception.quantity || !exception.unit) {
        return res.status(400).json({
          success: false,
          message: 'Each exception must have type, inventoryItem, quantity, and unit'
        });
      }

      if (!['damage', 'missing', 'excess'].includes(exception.type)) {
        return res.status(400).json({
          success: false,
          message: 'Exception type must be one of: damage, missing, excess'
        });
      }

      if (exception.quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Exception quantity must be positive'
        });
      }
    }

    const result = await stockTransferService.recordException(
      companyId,
      transferId,
      userId,
      exceptions,
      idempotencyKey
    );

    logger.info('Exceptions recorded via API', {
      transferId,
      exceptionsCount: exceptions.length,
      companyId,
      userId,
      idempotencyKey
    });

    res.status(200).json({
      success: true,
      data: {
        transfer: result.transfer,
        exceptionsAdded: result.exceptionsAdded,
        impactPreview: result.impactPreview
      }
    });
  } catch (error) {
    logger.error('Record exceptions error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('not destination admin') ||
        error.message.includes('Only destination location administrators')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('not at GOODS_RECEIVED_CONFIRMED') ||
        error.message.includes('exceed sent quantity') ||
        error.message.includes('Invalid exception') ||
        error.message.includes('already processed')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Idempotency conflict')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};


/**
 * Get transfers with exceptions (optimized for super admin dashboard)
 * GET /api/stock-transfers/exceptions
 */
export const getTransfersWithExceptions = async (req, res, next) => {
  try {
    const { companyId, role } = req.user;
    const { status, severity, resolved, page = 1, limit = 20 } = req.query;

    // Validate user is super admin
    const isSuperAdmin = role === 'company_super_admin_primary' || 
                         role === 'company_super_admin_secondary';
    
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only super administrators can access this endpoint'
      });
    }

    // Validate pagination parameters
    const parsedPage = Math.max(parseInt(page) || 1, 1);
    const parsedLimit = Math.min(parseInt(limit) || 20, 100);

    // Parse resolved filter
    const resolvedFilter = resolved === 'true' ? true : resolved === 'false' ? false : undefined;

    const result = await stockTransferService.getTransfersWithExceptions(
      companyId,
      {
        status: status || 'exception_fix_in_progress',
        severity,
        resolved: resolvedFilter
      },
      {
        page: parsedPage,
        limit: parsedLimit
      }
    );

    res.status(200).json({
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
    logger.error('Get transfers with exceptions error', error);
    next(error);
  }
};


/**
 * Resolve an individual exception
 * PUT /api/stock-transfers/:transferId/exceptions/:exceptionId
 */
export const resolveExceptionEndpoint = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { transferId, exceptionId } = req.params;
    const { resolutionAction, resolutionNotes } = req.body;

    // Validate user is super admin
    const isSuperAdmin = role === 'company_super_admin_primary' || 
                         role === 'company_super_admin_secondary';
    
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only super administrators can resolve exceptions'
      });
    }

    // Validate request body
    if (!resolutionAction) {
      return res.status(400).json({
        success: false,
        message: 'resolutionAction is required'
      });
    }

    const validActions = ['confirm_damage', 'return_to_source', 'accept_excess', 'reject_excess'];
    if (!validActions.includes(resolutionAction)) {
      return res.status(400).json({
        success: false,
        message: `resolutionAction must be one of: ${validActions.join(', ')}`
      });
    }

    const result = await stockTransferService.resolveException(
      companyId,
      transferId,
      exceptionId,
      userId,
      resolutionAction,
      resolutionNotes
    );

    logger.info('Exception resolved via API', {
      transferId,
      exceptionId,
      resolutionAction,
      allResolved: result.allResolved,
      companyId,
      userId
    });

    res.status(200).json({
      success: true,
      data: {
        transfer: result.transfer,
        exception: result.exception,
        allResolved: result.allResolved,
        statusChanged: result.statusChanged,
        impactPreview: result.impactPreview
      }
    });
  } catch (error) {
    logger.error('Resolve exception error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Only super administrators')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Invalid resolution action') ||
        error.message.includes('already resolved')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('already resolved by another user')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};


/**
 * Get exceptions for a specific transfer
 * GET /api/stock-transfers/:transferId/exceptions
 */
export const getTransferExceptions = async (req, res, next) => {
  try {
    const { companyId, role } = req.user;
    const { transferId } = req.params;

    // Check if user is super admin or destination admin
    const isSuperAdmin = role === 'company_super_admin_primary' || 
                         role === 'company_super_admin_secondary';

    const result = await stockTransferService.getTransferExceptions(
      companyId,
      transferId,
      req.user,
      isSuperAdmin
    );

    res.status(200).json({
      success: true,
      data: {
        transferId: result.transferId,
        transferNumber: result.transferNumber,
        exceptions: result.exceptions,
        summary: result.summary
      }
    });
  } catch (error) {
    logger.error('Get transfer exceptions error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('not authorized') ||
        error.message.includes('does not have access')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};


/**
 * Escalate unresolved exceptions
 * POST /api/stock-transfers/:transferId/escalate
 */
export const escalateExceptionEndpoint = async (req, res, next) => {
  try {
    const { companyId, role } = req.user;
    const { transferId } = req.params;
    const { escalationReason } = req.body;

    // Validate user is super admin or automated system
    const isSuperAdmin = role === 'company_super_admin_primary' || 
                         role === 'company_super_admin_secondary';
    
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only super administrators can escalate exceptions'
      });
    }

    // Validate request body
    if (!escalationReason) {
      return res.status(400).json({
        success: false,
        message: 'escalationReason is required'
      });
    }

    const result = await stockTransferService.escalateException(
      companyId,
      transferId,
      escalationReason
    );

    logger.info('Exception escalated via API', {
      transferId,
      escalationReason,
      companyId
    });

    res.status(200).json({
      success: true,
      data: {
        transfer: result.transfer,
        escalatedAt: result.escalatedAt,
        notificationsSent: result.notificationsSent
      }
    });
  } catch (error) {
    logger.error('Escalate exception error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Only super administrators')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('not in exception_fix_in_progress') ||
        error.message.includes('No unresolved exceptions')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};


/**
 * Force complete a transfer with unresolved exceptions
 * POST /api/stock-transfers/:transferId/force-complete
 */
export const forceCompleteTransferEndpoint = async (req, res, next) => {
  try {
    const { companyId, userId, role } = req.user;
    const { transferId } = req.params;
    const { overrideReason, applyInventoryAdjustments = true } = req.body;

    // Validate user is super admin
    const isSuperAdmin = role === 'company_super_admin_primary' || 
                         role === 'company_super_admin_secondary';
    
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only super administrators can force complete transfers'
      });
    }

    // Validate request body
    if (!overrideReason) {
      return res.status(400).json({
        success: false,
        message: 'overrideReason is required'
      });
    }

    const result = await stockTransferService.forceCompleteTransfer(
      companyId,
      transferId,
      userId,
      overrideReason,
      applyInventoryAdjustments
    );

    logger.warn('Transfer force completed via API', {
      transferId,
      overrideReason,
      applyInventoryAdjustments,
      companyId,
      userId
    });

    res.status(200).json({
      success: true,
      data: {
        transfer: result.transfer,
        forceCompletedBy: result.forceCompletedBy,
        forceCompletedAt: result.forceCompletedAt,
        inventoryAdjustmentsApplied: result.inventoryAdjustmentsApplied
      }
    });
  } catch (error) {
    logger.error('Force complete transfer error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Only super administrators')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('already completed')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};


/**
 * Get impact preview for a transfer
 * GET /api/stock-transfers/:transferId/impact-preview
 */
export const getImpactPreview = async (req, res, next) => {
  try {
    const { companyId, role } = req.user;
    const { transferId } = req.params;

    // Check if user is super admin or destination admin
    const isSuperAdmin = role === 'company_super_admin_primary' || 
                         role === 'company_super_admin_secondary';

    const result = await stockTransferService.computeImpactPreview(
      transferId,
      companyId,
      req.user,
      isSuperAdmin
    );

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get impact preview error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('not authorized') ||
        error.message.includes('does not have access')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};
