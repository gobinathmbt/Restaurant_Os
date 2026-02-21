/**
 * Stock Count Session Controller
 * Handles HTTP requests for physical stock count operations
 */

import * as stockCountSessionService from '../services/stockCountSessionService.js';
import { logger } from '../utils/logger.js';

/**
 * Create a new stock count session
 * POST /api/stock-count-sessions
 */
export const createCountSession = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const sessionData = {
      ...req.body,
      createdBy: userId
    };

    // Validate required fields
    if (!sessionData.locationId) {
      return res.status(400).json({
        success: false,
        message: 'locationId is required'
      });
    }

    if (!sessionData.countType) {
      return res.status(400).json({
        success: false,
        message: 'countType is required'
      });
    }

    if (!sessionData.items || !Array.isArray(sessionData.items) || sessionData.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required'
      });
    }

    // Create session
    const session = await stockCountSessionService.createCountSession(sessionData, companyId);

    logger.info('Stock count session created via API', {
      sessionId: session._id,
      sessionNumber: session.sessionNumber,
      companyId,
      userId
    });

    res.status(201).json({
      success: true,
      message: 'Stock count session created successfully',
      data: { session }
    });
  } catch (error) {
    logger.error('Create stock count session error', error);

    if (error.message.includes('Missing required fields') ||
        error.message.includes('Invalid count type') ||
        error.message.includes('At least one item is required') ||
        error.message.includes('must have') ||
        error.message.includes('not found or inactive')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Get a single count session by ID
 * GET /api/stock-count-sessions/:id
 */
export const getCountSessionById = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;
    const { isCounter } = req.query;

    const session = await stockCountSessionService.getCountSession(
      id,
      companyId,
      isCounter === 'true'
    );

    res.json({
      success: true,
      data: { session }
    });
  } catch (error) {
    logger.error('Get count session by ID error', error);

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
 * Start a stock count session
 * PUT /api/stock-count-sessions/:id/start
 */
export const startCountSession = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;

    const session = await stockCountSessionService.startCountSession(id, userId, companyId);

    logger.info('Stock count session started via API', {
      sessionId: id,
      sessionNumber: session.sessionNumber,
      companyId,
      userId
    });

    res.json({
      success: true,
      message: 'Stock count session started successfully',
      data: { session }
    });
  } catch (error) {
    logger.error('Start stock count session error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Cannot start')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Record counted quantity for an item
 * PUT /api/stock-count-sessions/:id/count
 */
export const recordCountedQuantity = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;
    const { itemId, batchNumber, countedQuantity } = req.body;

    // Validate required fields
    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: 'itemId is required'
      });
    }

    if (countedQuantity === undefined || countedQuantity === null) {
      return res.status(400).json({
        success: false,
        message: 'countedQuantity is required'
      });
    }

    const session = await stockCountSessionService.recordCountedQuantity(
      id,
      itemId,
      batchNumber,
      countedQuantity,
      userId,
      companyId
    );

    logger.info('Counted quantity recorded via API', {
      sessionId: id,
      itemId,
      countedQuantity,
      companyId,
      userId
    });

    res.json({
      success: true,
      message: 'Counted quantity recorded successfully',
      data: { session }
    });
  } catch (error) {
    logger.error('Record counted quantity error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Cannot record') ||
        error.message.includes('must be a non-negative')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Complete a stock count session
 * PUT /api/stock-count-sessions/:id/complete
 */
export const completeCountSession = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;

    const result = await stockCountSessionService.completeCountSession(id, userId, companyId);

    logger.info('Stock count session completed via API', {
      sessionId: id,
      sessionNumber: result.session.sessionNumber,
      companyId,
      userId
    });

    res.json({
      success: true,
      message: 'Stock count session completed successfully',
      data: {
        session: result.session,
        varianceReport: result.varianceReport
      }
    });
  } catch (error) {
    logger.error('Complete stock count session error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Cannot complete') ||
        error.message.includes('have not been counted')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Approve a stock count session
 * PUT /api/stock-count-sessions/:id/approve
 */
export const approveCountSession = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;

    const result = await stockCountSessionService.approveCountSession(id, userId, companyId);

    logger.info('Stock count session approved via API', {
      sessionId: id,
      sessionNumber: result.session.sessionNumber,
      adjustmentsCreated: result.adjustments.length,
      companyId,
      userId
    });

    res.json({
      success: true,
      message: 'Stock count session approved successfully',
      data: {
        session: result.session,
        adjustments: result.adjustments
      }
    });
  } catch (error) {
    logger.error('Approve stock count session error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Cannot approve')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Reject a stock count session
 * PUT /api/stock-count-sessions/:id/reject
 */
export const rejectCountSession = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'rejectionReason is required'
      });
    }

    const session = await stockCountSessionService.rejectCountSession(
      id,
      userId,
      rejectionReason,
      companyId
    );

    logger.info('Stock count session rejected via API', {
      sessionId: id,
      sessionNumber: session.sessionNumber,
      companyId,
      userId
    });

    res.json({
      success: true,
      message: 'Stock count session rejected successfully',
      data: { session }
    });
  } catch (error) {
    logger.error('Reject stock count session error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Cannot reject')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Get count sessions by location
 * GET /api/stock-count-sessions/location/:locationId
 */
export const getCountSessionsByLocation = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { locationId } = req.params;
    
    // Extract pagination and filter parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const status = req.query.status;
    const countType = req.query.countType;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const filters = {
      page,
      limit,
      ...(status && { status }),
      ...(countType && { countType }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate })
    };

    const result = await stockCountSessionService.getCountSessionsByLocation(
      locationId,
      companyId,
      filters
    );

    res.json({
      success: true,
      data: {
        sessions: result.sessions,
        pagination: result.pagination
      }
    });
  } catch (error) {
    logger.error('Get count sessions by location error', error);

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
 * Get count sessions by status
 * GET /api/stock-count-sessions/status/:status
 */
export const getCountSessionsByStatus = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { status } = req.params;
    
    // Extract pagination and filter parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const locationId = req.query.locationId;
    const countType = req.query.countType;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const filters = {
      page,
      limit,
      ...(locationId && { locationId }),
      ...(countType && { countType }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate })
    };

    const result = await stockCountSessionService.getCountSessionsByStatus(
      status,
      companyId,
      filters
    );

    res.json({
      success: true,
      data: {
        sessions: result.sessions,
        pagination: result.pagination
      }
    });
  } catch (error) {
    logger.error('Get count sessions by status error', error);

    if (error.message.includes('Invalid status')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

