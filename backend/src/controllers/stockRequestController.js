/**
 * Stock Request Controller
 * Handles HTTP requests for stock request operations
 * Implements Requirements: 17.1-17.9
 */

import * as stockRequestService from '../services/stockRequestService.js';
import { logger } from '../utils/logger.js';
import { getAccessibleLocations } from '../middlewares/locationAccess.js';
import CompanyUser from '../models/platform/CompanyUser.js';

/**
 * Manually populate CompanyUser fields for stock requests
 * CompanyUser is a platform model, not in company DB, so we need to populate manually
 * @param {Array|Object} requests - Single request or array of requests
 * @param {string} companyId - Company ID for filtering users
 * @param {Array<string>} fields - User fields to populate (default: ['requestedBy', 'approvedBy', 'rejectedBy', 'cancelledBy'])
 * @returns {Promise<Array|Object>} Requests with populated user fields
 */
const populateCompanyUsers = async (requests, companyId, fields = ['requestedBy', 'approvedBy', 'rejectedBy', 'cancelledBy']) => {
  const isArray = Array.isArray(requests);
  const requestArray = isArray ? requests : [requests];
  
  if (requestArray.length === 0) {
    return requests;
  }

  // Collect all unique user IDs from all specified fields
  const userIds = new Set();
  requestArray.forEach(request => {
    fields.forEach(field => {
      if (request[field]) {
        userIds.add(request[field].toString());
      }
    });
  });

  if (userIds.size === 0) {
    return requests;
  }

  // Fetch all users in one query
  const users = await CompanyUser.find({
    _id: { $in: Array.from(userIds) },
    companyId: companyId,
    isActive: true
  })
  .select('_id name email role')
  .lean();

  // Create a map for quick lookup
  const userMap = new Map();
  users.forEach(user => {
    userMap.set(user._id.toString(), user);
  });

  // Populate user fields in requests
  requestArray.forEach(request => {
    fields.forEach(field => {
      if (request[field]) {
        const userId = request[field].toString();
        request[field] = userMap.get(userId) || request[field];
      }
    });
  });

  return isArray ? requestArray : requestArray[0];
};

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
    if (!requestData.destinationLocation || !requestData.sourceLocation) {
      return res.status(400).json({
        success: false,
        message: 'destinationLocation and sourceLocation are required'
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
      userId,
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
      destinationLocation: req.query.destinationLocation,
      sourceLocation: req.query.sourceLocation,
      branchId: req.query.branchId, // Support branchId parameter
      inventoryItem: req.query.inventoryItem,
      requestDateStart: req.query.requestDateStart,
      requestDateEnd: req.query.requestDateEnd,
      expectedDeliveryDateStart: req.query.expectedDeliveryDateStart,
      expectedDeliveryDateEnd: req.query.expectedDeliveryDateEnd,
      search: req.query.search, // For requestNumber search
      sortBy: req.query.sortBy || 'requestDate',
      sortOrder: req.query.sortOrder || 'desc',
      executionStatus: req.query.executionStatus // 'not_started', 'in_progress', 'all'
    };

    // Apply location-based filtering
    const { isUnrestricted, locationIds } = getAccessibleLocations(user);
    
    // Check if user is super admin
    const isSuperAdmin = user.role === 'company_super_admin_primary' || 
                         user.role === 'company_super_admin_secondary';
    
    
    // Build query (no companyId needed - database-level isolation)
    const query = { isArchived: false };
    
    // IMPORTANT: Exclude completed requests from main listing UNLESS branchId=all (All Transactions tab)
    // Completed requests should only appear in the dedicated "Completed" tab or All Transactions tab
    // This prevents clutter in active request views
    if ((!filters.status || filters.status !== 'completed') && filters.branchId !== 'all') {
      query.status = { $ne: 'completed' };
      console.log('🔍 [LIST REQUESTS DEBUG] Excluding completed requests (not All Transactions tab)');
    } else if (filters.branchId === 'all') {
      console.log('✅ [LIST REQUESTS DEBUG] Including completed requests (All Transactions tab)');
    }

    // Location-based access control
    // Super admins with branchId='all' can see ALL requests (no location filter)
    if (!isSuperAdmin || (filters.branchId && filters.branchId !== 'all')) {
      if (!isUnrestricted) {
        // Non-Super Admins can only see requests for their locations
        query.$or = [
          { destinationLocation: { $in: locationIds } },
          { sourceLocation: { $in: locationIds } }
        ];
        
        console.log('🔍 [LIST REQUESTS DEBUG] Applying location filter', {
          locationIds,
          reason: isSuperAdmin ? 'Super admin with specific branch' : 'Non-super admin'
        });
      }
    } else {
      console.log('✅ [LIST REQUESTS DEBUG] Super admin with branchId=all - showing ALL requests');
    }

    // Handle branchId parameter (used by frontend tabs)
    if (filters.branchId && filters.branchId !== 'all') {
      // Determine context based on status filter
      if (filters.status === 'approved') {
        // Incoming Requests tab: show requests where this branch is the SOURCE
        query.sourceLocation = filters.branchId;
        // Auto-apply execution status filter: only show not started
        if (!filters.executionStatus) {
          filters.executionStatus = 'not_started';
        }
      } else {
        // My Requests tab: show requests where this branch is the DESTINATION
        query.destinationLocation = filters.branchId;
        // Auto-apply execution status filter: only show not started
        if (!filters.executionStatus) {
          filters.executionStatus = 'not_started';
        }
      }
    }

    // Apply filters
    if (filters.status) {
      // Only apply status filter if explicitly set
      // The completed status exclusion is already handled above
      if (filters.status === 'completed') {
        // If explicitly requesting completed, override the exclusion
        query.status = 'completed';
      } else {
        // For other statuses, apply normally
        query.status = filters.status;
      }
    }

    if (filters.priority) {
      query.priority = filters.priority;
    }

    if (filters.destinationLocation && !filters.branchId) {
      query.destinationLocation = filters.destinationLocation;
    }

    if (filters.sourceLocation && !filters.branchId) {
      query.sourceLocation = filters.sourceLocation;
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
      .populate('destinationLocation', 'name type')
      .populate('sourceLocation', 'name type')
      .populate('items.inventoryItem', 'name code')
      .lean();
    
    // Manually populate createdTransferId with executionStages for approved requests
    const StockTransfer = req.companyDB.model('StockTransfer');
    for (const request of requests) {
      if (request.createdTransferId) {
        try {
          const transfer = await StockTransfer.findById(request.createdTransferId)
            .select('executionStages status')
            .lean();
          if (transfer) {
            request.createdTransferId = transfer;
          }
        } catch (err) {
          logger.warn('Failed to populate transfer for request', { requestId: request._id, error: err.message });
        }
      }
    }

    // Manually populate CompanyUser fields (platform model)
    let populatedRequests = await populateCompanyUsers(requests, companyId, ['requestedBy', 'approvedBy']);

    // Filter by execution status if specified
    if (filters.executionStatus && filters.executionStatus !== 'all') {
      // Filter based on execution status using the populated transfer data
      populatedRequests = populatedRequests.filter(request => {
        if (request.status !== 'approved' || !request.createdTransferId) {
          // Non-approved requests: include based on filter
          return filters.executionStatus === 'not_started';
        }
        
        // createdTransferId is now populated with transfer object
        const transfer = request.createdTransferId;
        const transferStatus = transfer.status;
        
        if (filters.executionStatus === 'not_started') {
          // Show only if transfer status is 'not_started'
          return transferStatus === 'not_started';
        } else if (filters.executionStatus === 'in_progress') {
          // Show only if transfer status is 'in_progress'
          return transferStatus === 'in_progress';
        }
        
        return true;
      });
    }

    logger.info('Stock requests listed via API', {
      companyId,
      userId: user.userId,
      count: populatedRequests.length,
      branchId: filters.branchId,
      executionStatus: filters.executionStatus
    });

    res.json({
      success: true,
      data: {
        requests: populatedRequests,
        pagination: {
          total: populatedRequests.length,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(populatedRequests.length / limit)
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
      .populate('destinationLocation', 'name type address')
      .populate('sourceLocation', 'name type address')
      .populate('items.inventoryItem', 'name code unit')
      .populate('createdTransferId', 'transferNumber status')
      .lean();

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Stock request not found'
      });
    }

    // Manually populate CompanyUser fields (platform model)
    const populatedRequest = await populateCompanyUsers(request, companyId, ['requestedBy', 'approvedBy', 'rejectedBy', 'cancelledBy']);

    logger.info('Stock request retrieved via API', {
      requestId,
      requestNumber: populatedRequest.requestNumber,
      companyId
    });

    res.json({
      success: true,
      data: { request: populatedRequest }
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

    // Log the received requestId
    logger.info('Approve request controller - received params', {
      requestId,
      requestIdFromUrl: req.url,
      params: req.params
    });

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
      userId,
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
      userId,
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
      userId,
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

    // Exclude completed requests from My Requests tab UNLESS explicitly requested
    // Completed requests should only appear in the dedicated "Completed" tab
    if (!filters.status || filters.status !== 'completed') {
      query.status = { $ne: 'completed' };
    }

    // Apply status filter (if provided and not 'all')
    if (filters.status && filters.status !== 'all' && filters.status !== 'completed') {
      // Override with specific status, but maintain completed exclusion
      query.status = filters.status;
    } else if (filters.status === 'completed') {
      // If explicitly requesting completed, override the exclusion
      query.status = 'completed';
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
      .populate('destinationLocation', 'name type')
      .populate('sourceLocation', 'name type')
      .populate('items.inventoryItem', 'name code')
      .lean();

    // Manually populate CompanyUser fields (platform model)
    const populatedRequests = await populateCompanyUsers(requests, companyId, ['requestedBy', 'approvedBy']);

    logger.info('My requests listed via API', {
      companyId,
      userId,
      count: populatedRequests.length,
      page,
      total
    });

    res.json({
      success: true,
      data: {
        requests: populatedRequests,
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
      sortOrder: req.query.sortOrder || 'desc',
      executionStatus: req.query.executionStatus || 'not_started' // Default to not_started
    };

    console.log('🔍 [REQUESTS TO ME DEBUG] Filter parameters', {
      executionStatus: filters.executionStatus,
      status: filters.status,
      userId: user.userId,
      userRole: user.role
    });

    // Get accessible locations for the user
    const { locationIds } = getAccessibleLocations(user);

    const StockRequest = req.companyDB.model('StockRequest');

    // Build query - filter by sourceLocation in user's accessible locations
    const query = { 
      isArchived: false,
      sourceLocation: { $in: locationIds }
    };

    // Exclude completed requests from Requests To Me tab UNLESS explicitly requested
    // Completed requests should only appear in the dedicated "Completed" tab
    if (!filters.status || filters.status !== 'completed') {
      query.status = { $ne: 'completed' };
    }

    // Apply status filter (if provided and not 'all')
    if (filters.status && filters.status !== 'all' && filters.status !== 'completed') {
      // Override with specific status, but maintain completed exclusion
      query.status = filters.status;
    } else if (filters.status === 'completed') {
      // If explicitly requesting completed, override the exclusion
      query.status = 'completed';
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

    // For execution status filtering, we need to fetch transfers first
    let requestsToFilter = [];
    
    if (filters.executionStatus && filters.executionStatus !== 'all') {
      console.log('🔍 [REQUESTS TO ME DEBUG] Applying execution status filter', {
        executionStatus: filters.executionStatus
      });
      
      // Fetch all matching requests (without pagination first)
      requestsToFilter = await StockRequest.find(query)
        .sort({ [sortField]: sortDirection, requestNumber: -1 })
        .populate('destinationLocation', 'name type')
        .populate('sourceLocation', 'name type')
        .populate('items.inventoryItem', 'name code')
        .lean();
      
      // Populate transfer execution stages for approved requests
      const StockTransfer = req.companyDB.model('StockTransfer');
      for (const request of requestsToFilter) {
        if (request.createdTransferId) {
          try {
            const transfer = await StockTransfer.findById(request.createdTransferId)
              .select('executionStages status')
              .lean();
            if (transfer) {
              request.createdTransferId = transfer;
            }
          } catch (err) {
            logger.warn('Failed to populate transfer for request', { requestId: request._id, error: err.message });
          }
        }
      }
      
      // Filter by execution status
      requestsToFilter = requestsToFilter.filter(request => {
        if (request.status !== 'approved' || !request.createdTransferId) {
          // Non-approved requests: include only if looking for 'not_started'
          return filters.executionStatus === 'not_started';
        }
        
        const transfer = request.createdTransferId;
        const transferStatus = transfer.status;
        
        console.log('🔍 [REQUESTS TO ME DEBUG] Checking transfer status', {
          requestNumber: request.requestNumber,
          transferStatus,
          executionStatusFilter: filters.executionStatus,
          willInclude: transferStatus === filters.executionStatus
        });
        
        if (filters.executionStatus === 'not_started') {
          return transferStatus === 'not_started';
        } else if (filters.executionStatus === 'in_progress') {
          return transferStatus === 'in_progress';
        }
        
        return true;
      });
      
      // Now apply pagination to filtered results
      const total = requestsToFilter.length;
      const pages = Math.ceil(total / limit);
      const requests = requestsToFilter.slice(skip, skip + limit);
      
      // Manually populate CompanyUser fields (platform model)
      const populatedRequests = await populateCompanyUsers(requests, companyId, ['requestedBy']);
      
      console.log('✅ [REQUESTS TO ME DEBUG] Filtered and paginated results', {
        totalBeforeFilter: requestsToFilter.length,
        totalAfterFilter: total,
        page,
        limit,
        returnedCount: populatedRequests.length
      });

      logger.info('Requests to me listed via API', {
        companyId,
        userId: user.userId,
        count: populatedRequests.length,
        page,
        total,
        executionStatus: filters.executionStatus
      });

      return res.json({
        success: true,
        data: {
          requests: populatedRequests,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages
          }
        }
      });
    }

    // No execution status filter - use standard pagination
    const total = await StockRequest.countDocuments(query);
    const pages = Math.ceil(total / limit);

    // Execute query with pagination
    const requests = await StockRequest.find(query)
      .sort({ [sortField]: sortDirection, requestNumber: -1 })
      .skip(skip)
      .limit(limit)
      .populate('destinationLocation', 'name type')
      .populate('sourceLocation', 'name type')
      .populate('items.inventoryItem', 'name code')
      .lean();

    // Manually populate CompanyUser fields (platform model)
    const populatedRequests = await populateCompanyUsers(requests, companyId, ['requestedBy']);

    console.log('✅ [REQUESTS TO ME DEBUG] Standard query results', {
      total,
      page,
      limit,
      returnedCount: populatedRequests.length
    });

    logger.info('Requests to me listed via API', {
      companyId,
      userId: user.userId,
      count: populatedRequests.length,
      page,
      total
    });

    res.json({
      success: true,
      data: {
        requests: populatedRequests,
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
      .populate('destinationLocation', 'name type')
      .populate('sourceLocation', 'name type')
      .populate('items.inventoryItem', 'name code')
      .lean();

    // Manually populate CompanyUser fields (platform model)
    const populatedRequests = await populateCompanyUsers(requests, companyId, ['requestedBy']);

    logger.info('Pending approvals listed via API', {
      companyId,
      userId: user.userId,
      count: populatedRequests.length,
      page,
      total
    });

    res.json({
      success: true,
      data: {
        requests: populatedRequests,
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


/**
 * Get completed stock requests
 * GET /api/v2/stock-requests/completed
 */
export const getCompletedRequests = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const user = req.user;
    
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    
    // Extract filter parameters
    const filters = {
      destinationLocation: req.query.destinationLocation,
      sourceLocation: req.query.sourceLocation,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      search: req.query.search
    };
    
    const result = await stockRequestService.getCompletedRequests(
      companyId,
      filters,
      { page, limit },
      user
    );
    
    logger.info('Completed stock requests listed via API', {
      companyId,
      userId: user.userId,
      count: result.requests.length,
      page,
      total: result.pagination.total
    });
    
    res.json({
      success: true,
      data: {
        requests: result.requests,
        pagination: result.pagination
      }
    });
  } catch (error) {
    logger.error('Get completed stock requests error', error);
    next(error);
  }
};
