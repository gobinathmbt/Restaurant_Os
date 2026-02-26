/**
 * Stock Request Controller
 * Handles HTTP requests for stock request operations
 * Implements Requirements: 17.1-17.9
 */

import * as stockRequestService from '../services/stockRequestService.js';
import { logger } from '../utils/logger.js';
import { getAccessibleLocations } from '../middlewares/locationAccess.js';

/**
 * Extract IP address from request
 * @param {Object} req - Express request object
 * @returns {string} IP address
 */
const getIpAddress = (req) => {
  return req.ip || 
         req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         'unknown';
};

/**
 * Extract device info from request
 * @param {Object} req - Express request object
 * @returns {string} Device info (user agent)
 */
const getDeviceInfo = (req) => {
  return req.headers['user-agent'] || 'unknown';
};

/**
 * Create a new stock request
 * POST /api/v2/stock-requests
 */
export const createRequest = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const user = req.user;
    const requestData = req.body;

    // Validate required fields
    if (!requestData.fromLocation || !requestData.toLocation) {
      return res.status(400).json({
        success: false,
        message: 'fromLocation and toLocation are required'
      });
    }

    if (!requestData.items || !Array.isArray(requestData.items) || requestData.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required'
      });
    }

    // Validate each item
    for (const item of requestData.items) {
      if (!item.inventoryItem) {
        return res.status(400).json({
          success: false,
          message: 'inventoryItem is required for all items'
        });
      }
      if (!item.requestedQuantity || item.requestedQuantity <= 0) {
        return res.status(400).json({
          success: false,
          message: 'requestedQuantity must be positive for all items'
        });
      }
      if (!item.unit) {
        return res.status(400).json({
          success: false,
          message: 'unit is required for all items'
        });
      }
    }

    // Extract IP address and device info
    const ipAddress = getIpAddress(req);
    const deviceInfo = getDeviceInfo(req);

    // Create request
    const request = await stockRequestService.createRequest(
      companyId,
      user,
      requestData,
      ipAddress,
      deviceInfo
    );

    logger.info('Stock request created via API', {
      requestId: request._id,
      requestNumber: request.requestNumber,
      companyId,
      userId
    });

    res.status(201).json({
      success: true,
      message: 'Stock request created successfully',
      data: { request }
    });
  } catch (error) {
    logger.error('Create stock request error', error);

    if (error.message.includes('Missing required fields') ||
        error.message.includes('must be different') ||
        error.message.includes('must be greater than zero') ||
        error.message.includes('not found or inactive') ||
        error.message.includes('not authorized') ||
        error.message.includes('does not have access')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Forbidden') || error.message.includes('not have permission')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * List stock requests with cursor-based pagination and filtering
 * GET /api/v2/stock-requests
 */
export const listRequests = async (req, res, next) => {
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
      priority: req.query.priority,
      fromLocation: req.query.fromLocation,
      toLocation: req.query.toLocation,
      inventoryItem: req.query.inventoryItem,
      requestDateStart: req.query.requestDateStart,
      requestDateEnd: req.query.requestDateEnd,
      expectedDeliveryDateStart: req.query.expectedDeliveryDateStart,
      expectedDeliveryDateEnd: req.query.expectedDeliveryDateEnd,
      search: req.query.search, // For requestNumber search
      sortBy: req.query.sortBy || 'requestDate',
      sortOrder: req.query.sortOrder || 'desc'
    };

    // Apply location-based filtering
    const { isUnrestricted, locationIds } = getAccessibleLocations(user);
    
    // Build query (no companyId needed - database-level isolation)
    const query = { isArchived: false };

    // Location-based access control
    if (!isUnrestricted) {
      // Non-Super Admins can only see requests for their locations
      query.$or = [
        { fromLocation: { $in: locationIds } },
        { toLocation: { $in: locationIds } }
      ];
    }

    // Apply filters
    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.priority) {
      query.priority = filters.priority;
    }

    if (filters.fromLocation) {
      query.fromLocation = filters.fromLocation;
    }

    if (filters.toLocation) {
      query.toLocation = filters.toLocation;
    }

    if (filters.inventoryItem) {
      query['items.inventoryItem'] = filters.inventoryItem;
    }

    if (filters.requestDateStart || filters.requestDateEnd) {
      query.requestDate = {};
      if (filters.requestDateStart) {
        query.requestDate.$gte = new Date(filters.requestDateStart);
      }
      if (filters.requestDateEnd) {
        query.requestDate.$lte = new Date(filters.requestDateEnd);
      }
    }

    if (filters.expectedDeliveryDateStart || filters.expectedDeliveryDateEnd) {
      query.expectedDeliveryDate = {};
      if (filters.expectedDeliveryDateStart) {
        query.expectedDeliveryDate.$gte = new Date(filters.expectedDeliveryDateStart);
      }
      if (filters.expectedDeliveryDateEnd) {
        query.expectedDeliveryDate.$lte = new Date(filters.expectedDeliveryDateEnd);
      }
    }

    // Search by requestNumber
    if (filters.search) {
      query.requestNumber = { $regex: filters.search, $options: 'i' };
    }

    // Get StockRequest model
    const StockRequest = req.companyDB.model('StockRequest');

    // Determine sort order
    const sortField = filters.sortBy === 'priority' ? 'priority' : 
                      filters.sortBy === 'expectedDeliveryDate' ? 'expectedDeliveryDate' :
                      filters.sortBy === 'status' ? 'status' : 'requestDate';
    const sortDirection = filters.sortOrder === 'asc' ? 1 : -1;

    // Get total count
    const total = await StockRequest.countDocuments(query);
    const pages = Math.ceil(total / limit);

    // Execute query with pagination
    const requests = await StockRequest.find(query)
      .sort({ [sortField]: sortDirection, requestNumber: -1 })
      .skip(skip)
      .limit(limit)
      .populate('fromLocation', 'name type')
      .populate('toLocation', 'name type')
      .populate('requestedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('items.inventoryItem', 'name code')
      .lean();

    logger.info('Stock requests listed via API', {
      companyId,
      userId: user.userId,
      count: requests.length,
      page,
      total
    });

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages
        }
      }
    });
  } catch (error) {
    logger.error('List stock requests error', error);
    next(error);
  }
};

/**
 * Get a single stock request by ID
 * GET /api/v2/stock-requests/:requestId
 */
export const getRequestById = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { requestId } = req.params;

    const StockRequest = req.companyDB.model('StockRequest');

    const request = await StockRequest.findOne({ _id: requestId })
      .populate('fromLocation', 'name type address')
      .populate('toLocation', 'name type address')
      .populate('requestedBy', 'name email role')
      .populate('approvedBy', 'name email role')
      .populate('rejectedBy', 'name email role')
      .populate('cancelledBy', 'name email role')
      .populate('items.inventoryItem', 'name code unit')
      .populate('createdTransferId', 'transferNumber status')
      .lean();

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Stock request not found'
      });
    }

    logger.info('Stock request retrieved via API', {
      requestId,
      requestNumber: request.requestNumber,
      companyId
    });

    res.json({
      success: true,
      data: { request }
    });
  } catch (error) {
    logger.error('Get stock request by ID error', error);

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
 * Approve a stock request (full or partial)
 * POST /api/v2/stock-requests/:requestId/approve
 */
export const approveRequest = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const user = req.user;
    const { requestId } = req.params;
    const approvalData = req.body;

    // Validate approval data
    if (!approvalData.items || !Array.isArray(approvalData.items) || approvalData.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item with approvedQuantity is required'
      });
    }

    // Validate each item
    for (const item of approvalData.items) {
      if (!item.inventoryItem) {
        return res.status(400).json({
          success: false,
          message: 'inventoryItem is required for all items'
        });
      }
      if (item.approvedQuantity === undefined || item.approvedQuantity === null || item.approvedQuantity < 0) {
        return res.status(400).json({
          success: false,
          message: 'approvedQuantity must be non-negative for all items'
        });
      }
    }

    // Extract IP address and device info
    const ipAddress = getIpAddress(req);
    const deviceInfo = getDeviceInfo(req);

    // Approve request
    const result = await stockRequestService.approveRequest(
      companyId,
      requestId,
      user,
      approvalData,
      ipAddress,
      deviceInfo
    );

    logger.info('Stock request approved via API', {
      requestId,
      requestNumber: result.request.requestNumber,
      companyId,
      userId,
      transferCreated: !!result.transfer,
      backordersCreated: result.backorders?.length || 0
    });

    res.json({
      success: true,
      message: 'Stock request approved successfully',
      data: result
    });
  } catch (error) {
    logger.error('Approve stock request error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Cannot transition') ||
        error.message.includes('Insufficient available quantity') ||
        error.message.includes('Inventory underflow') ||
        error.message.includes('Concurrent batch modification') ||
        error.message.includes('must be less than or equal to') ||
        error.message.includes('not authorized') ||
        error.message.includes('does not have access')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Forbidden') || error.message.includes('not have permission')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('version mismatch') || error.message.includes('Optimistic locking')) {
      return res.status(409).json({
        success: false,
        message: 'Request was modified by another user. Please refresh and try again.',
        error: error.message
      });
    }

    next(error);
  }
};

/**
 * Reject a stock request
 * POST /api/v2/stock-requests/:requestId/reject
 */
export const rejectRequest = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const user = req.user;
    const { requestId } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    // Extract IP address and device info
    const ipAddress = getIpAddress(req);
    const deviceInfo = getDeviceInfo(req);

    const request = await stockRequestService.rejectRequest(
      companyId,
      requestId,
      user,
      rejectionReason,
      ipAddress,
      deviceInfo
    );

    logger.info('Stock request rejected via API', {
      requestId,
      requestNumber: request.requestNumber,
      companyId,
      userId,
      rejectionReason
    });

    res.json({
      success: true,
      message: 'Stock request rejected successfully',
      data: { request }
    });
  } catch (error) {
    logger.error('Reject stock request error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Cannot transition') ||
        error.message.includes('reason is required') ||
        error.message.includes('not authorized') ||
        error.message.includes('does not have access')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Forbidden') || error.message.includes('not have permission')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('version mismatch') || error.message.includes('Optimistic locking')) {
      return res.status(409).json({
        success: false,
        message: 'Request was modified by another user. Please refresh and try again.',
        error: error.message
      });
    }

    next(error);
  }
};

/**
 * Cancel a stock request
 * POST /api/v2/stock-requests/:requestId/cancel
 */
export const cancelRequest = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const user = req.user;
    const { requestId } = req.params;
    const { cancellationReason } = req.body;

    if (!cancellationReason || cancellationReason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cancellation reason is required'
      });
    }

    // Extract IP address and device info
    const ipAddress = getIpAddress(req);
    const deviceInfo = getDeviceInfo(req);

    const request = await stockRequestService.cancelRequest(
      companyId,
      requestId,
      user,
      cancellationReason,
      ipAddress,
      deviceInfo
    );

    logger.info('Stock request cancelled via API', {
      requestId,
      requestNumber: request.requestNumber,
      companyId,
      userId,
      cancellationReason
    });

    res.json({
      success: true,
      message: 'Stock request cancelled successfully',
      data: { request }
    });
  } catch (error) {
    logger.error('Cancel stock request error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Cannot transition') ||
        error.message.includes('reason is required') ||
        error.message.includes('not authorized') ||
        error.message.includes('does not have access')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Forbidden') || error.message.includes('not have permission')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('version mismatch') || error.message.includes('Optimistic locking')) {
      return res.status(409).json({
        success: false,
        message: 'Request was modified by another user. Please refresh and try again.',
        error: error.message
      });
    }

    next(error);
  }
};


/**
 * Get requests created by the current user
 * GET /api/v2/stock-requests/my-requests
 */
export const getMyRequests = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    // Extract filter parameters
    const filters = {
      status: req.query.status,
      priority: req.query.priority,
      requestDateStart: req.query.requestDateStart,
      requestDateEnd: req.query.requestDateEnd,
      search: req.query.search,
      sortBy: req.query.sortBy || 'requestDate',
      sortOrder: req.query.sortOrder || 'desc'
    };

    const StockRequest = req.companyDB.model('StockRequest');

    // Build query - filter by requestedBy
    const query = { 
      isArchived: false,
      requestedBy: userId
    };

    // Apply filters
    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.priority) {
      query.priority = filters.priority;
    }

    if (filters.requestDateStart || filters.requestDateEnd) {
      query.requestDate = {};
      if (filters.requestDateStart) {
        query.requestDate.$gte = new Date(filters.requestDateStart);
      }
      if (filters.requestDateEnd) {
        query.requestDate.$lte = new Date(filters.requestDateEnd);
      }
    }

    if (filters.search) {
      query.requestNumber = { $regex: filters.search, $options: 'i' };
    }

    // Determine sort order
    const sortField = filters.sortBy === 'priority' ? 'priority' : 
                      filters.sortBy === 'expectedDeliveryDate' ? 'expectedDeliveryDate' :
                      filters.sortBy === 'status' ? 'status' : 'requestDate';
    const sortDirection = filters.sortOrder === 'asc' ? 1 : -1;

    // Get total count
    const total = await StockRequest.countDocuments(query);
    const pages = Math.ceil(total / limit);

    // Execute query with pagination
    const requests = await StockRequest.find(query)
      .sort({ [sortField]: sortDirection, requestNumber: -1 })
      .skip(skip)
      .limit(limit)
      .populate('fromLocation', 'name type')
      .populate('toLocation', 'name type')
      .populate('items.inventoryItem', 'name code')
      .lean();

    logger.info('My requests listed via API', {
      companyId,
      userId,
      count: requests.length,
      page,
      total
    });

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages
        }
      }
    });
  } catch (error) {
    logger.error('Get my requests error', error);
    next(error);
  }
};


/**
 * Get requests to the current user's locations
 * GET /api/v2/stock-requests/requests-to-me
 */
export const getRequestsToMe = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const user = req.user;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    // Extract filter parameters
    const filters = {
      status: req.query.status,
      priority: req.query.priority,
      requestDateStart: req.query.requestDateStart,
      requestDateEnd: req.query.requestDateEnd,
      search: req.query.search,
      sortBy: req.query.sortBy || 'requestDate',
      sortOrder: req.query.sortOrder || 'desc'
    };

    // Get accessible locations for the user
    const { locationIds } = getAccessibleLocations(user);

    const StockRequest = req.companyDB.model('StockRequest');

    // Build query - filter by toLocation in user's accessible locations
    const query = { 
      isArchived: false,
      toLocation: { $in: locationIds }
    };

    // Apply filters
    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.priority) {
      query.priority = filters.priority;
    }

    if (filters.requestDateStart || filters.requestDateEnd) {
      query.requestDate = {};
      if (filters.requestDateStart) {
        query.requestDate.$gte = new Date(filters.requestDateStart);
      }
      if (filters.requestDateEnd) {
        query.requestDate.$lte = new Date(filters.requestDateEnd);
      }
    }

    if (filters.search) {
      query.requestNumber = { $regex: filters.search, $options: 'i' };
    }

    // Determine sort order
    const sortField = filters.sortBy === 'priority' ? 'priority' : 
                      filters.sortBy === 'expectedDeliveryDate' ? 'expectedDeliveryDate' :
                      filters.sortBy === 'status' ? 'status' : 'requestDate';
    const sortDirection = filters.sortOrder === 'asc' ? 1 : -1;

    // Get total count
    const total = await StockRequest.countDocuments(query);
    const pages = Math.ceil(total / limit);

    // Execute query with pagination
    const requests = await StockRequest.find(query)
      .sort({ [sortField]: sortDirection, requestNumber: -1 })
      .skip(skip)
      .limit(limit)
      .populate('fromLocation', 'name type')
      .populate('toLocation', 'name type')
      .populate('requestedBy', 'name email')
      .populate('items.inventoryItem', 'name code')
      .lean();

    logger.info('Requests to me listed via API', {
      companyId,
      userId: user.userId,
      count: requests.length,
      page,
      total
    });

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages
        }
      }
    });
  } catch (error) {
    logger.error('Get requests to me error', error);
    next(error);
  }
};


/**
 * Get pending approval requests (super admin only)
 * GET /api/v2/stock-requests/pending-approvals
 */
export const getPendingApprovals = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const user = req.user;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    // Validate user is super admin
    const isSuperAdmin = user.role === 'company_super_admin_primary' || 
                         user.role === 'company_super_admin_secondary';
    
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only super admins can view pending approvals.'
      });
    }

    // Extract filter parameters
    const filters = {
      priority: req.query.priority,
      requestDateStart: req.query.requestDateStart,
      requestDateEnd: req.query.requestDateEnd,
      search: req.query.search,
      sortBy: req.query.sortBy || 'requestDate',
      sortOrder: req.query.sortOrder || 'desc'
    };

    const StockRequest = req.companyDB.model('StockRequest');

    // Build query - filter by pending status
    const query = { 
      isArchived: false,
      status: 'pending'
    };

    // Apply filters
    if (filters.priority) {
      query.priority = filters.priority;
    }

    if (filters.requestDateStart || filters.requestDateEnd) {
      query.requestDate = {};
      if (filters.requestDateStart) {
        query.requestDate.$gte = new Date(filters.requestDateStart);
      }
      if (filters.requestDateEnd) {
        query.requestDate.$lte = new Date(filters.requestDateEnd);
      }
    }

    if (filters.search) {
      query.requestNumber = { $regex: filters.search, $options: 'i' };
    }

    // Determine sort order
    const sortField = filters.sortBy === 'priority' ? 'priority' : 
                      filters.sortBy === 'expectedDeliveryDate' ? 'expectedDeliveryDate' :
                      'requestDate';
    const sortDirection = filters.sortOrder === 'asc' ? 1 : -1;

    // Get total count
    const total = await StockRequest.countDocuments(query);
    const pages = Math.ceil(total / limit);

    // Execute query with pagination
    const requests = await StockRequest.find(query)
      .sort({ [sortField]: sortDirection, requestNumber: -1 })
      .skip(skip)
      .limit(limit)
      .populate('fromLocation', 'name type')
      .populate('toLocation', 'name type')
      .populate('requestedBy', 'name email')
      .populate('items.inventoryItem', 'name code')
      .lean();

    logger.info('Pending approvals listed via API', {
      companyId,
      userId: user.userId,
      count: requests.length,
      page,
      total
    });

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages
        }
      }
    });
  } catch (error) {
    logger.error('Get pending approvals error', error);
    next(error);
  }
};
