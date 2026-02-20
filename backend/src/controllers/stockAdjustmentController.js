/**
 * Stock Adjustment Controller
 * Handles HTTP requests for stock adjustment operations
 */

import * as stockAdjustmentService from '../services/stockAdjustmentService.js';
import { logger } from '../utils/logger.js';

/**
 * Create a new stock adjustment
 * POST /api/adjustments
 */
export const createAdjustment = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const adjustmentData = {
      ...req.body,
      createdBy: userId
    };

    // Validate required fields
    if (!adjustmentData.locationId) {
      return res.status(400).json({
        success: false,
        message: 'locationId is required'
      });
    }

    if (!adjustmentData.adjustmentType) {
      return res.status(400).json({
        success: false,
        message: 'adjustmentType is required'
      });
    }

    if (!adjustmentData.items || !Array.isArray(adjustmentData.items) || adjustmentData.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required'
      });
    }

    // Create adjustment
    const adjustment = await stockAdjustmentService.createAdjustment(adjustmentData, companyId);

    logger.info('Stock adjustment created via API', {
      adjustmentId: adjustment._id,
      adjustmentNumber: adjustment.adjustmentNumber,
      companyId,
      userId
    });

    res.status(201).json({
      success: true,
      message: 'Stock adjustment created successfully',
      data: { adjustment }
    });
  } catch (error) {
    logger.error('Create stock adjustment error', error);

    if (error.message.includes('Missing required fields') ||
        error.message.includes('Invalid adjustment type') ||
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
 * Get a single adjustment by ID
 * GET /api/adjustments/:id
 */
export const getAdjustmentById = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;

    const adjustment = await stockAdjustmentService.getAdjustment(id, companyId);

    res.json({
      success: true,
      data: { adjustment }
    });
  } catch (error) {
    logger.error('Get adjustment by ID error', error);

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
 * Approve a stock adjustment
 * PUT /api/adjustments/:id/approve
 */
export const approveAdjustment = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;

    const adjustment = await stockAdjustmentService.approveAdjustment(id, userId, companyId);

    logger.info('Stock adjustment approved via API', {
      adjustmentId: id,
      adjustmentNumber: adjustment.adjustmentNumber,
      companyId,
      userId
    });

    res.json({
      success: true,
      message: 'Stock adjustment approved successfully',
      data: { adjustment }
    });
  } catch (error) {
    logger.error('Approve stock adjustment error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Cannot approve') ||
        error.message.includes('Insufficient') ||
        error.message.includes('would result in negative')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Reject a stock adjustment
 * PUT /api/adjustments/:id/reject
 */
export const rejectAdjustment = async (req, res, next) => {
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

    const adjustment = await stockAdjustmentService.rejectAdjustment(
      id,
      userId,
      rejectionReason,
      companyId
    );

    logger.info('Stock adjustment rejected via API', {
      adjustmentId: id,
      adjustmentNumber: adjustment.adjustmentNumber,
      companyId,
      userId
    });

    res.json({
      success: true,
      message: 'Stock adjustment rejected successfully',
      data: { adjustment }
    });
  } catch (error) {
    logger.error('Reject stock adjustment error', error);

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
 * Get adjustments by location
 * GET /api/adjustments/location/:locationId
 */
export const getAdjustmentsByLocation = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { locationId } = req.params;
    
    // Extract pagination and filter parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const status = req.query.status;
    const adjustmentType = req.query.adjustmentType;

    const filters = {
      page,
      limit,
      ...(status && { status }),
      ...(adjustmentType && { adjustmentType })
    };

    const result = await stockAdjustmentService.getAdjustmentsByLocation(
      locationId,
      companyId,
      filters
    );

    res.json({
      success: true,
      data: {
        adjustments: result.adjustments,
        pagination: result.pagination
      }
    });
  } catch (error) {
    logger.error('Get adjustments by location error', error);

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
 * Get adjustments by status
 * GET /api/adjustments/status/:status
 */
export const getAdjustmentsByStatus = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { status } = req.params;
    
    // Extract pagination and filter parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const locationId = req.query.locationId;
    const adjustmentType = req.query.adjustmentType;

    const filters = {
      page,
      limit,
      ...(locationId && { locationId }),
      ...(adjustmentType && { adjustmentType })
    };

    const result = await stockAdjustmentService.getAdjustmentsByStatus(
      status,
      companyId,
      filters
    );

    res.json({
      success: true,
      data: {
        adjustments: result.adjustments,
        pagination: result.pagination
      }
    });
  } catch (error) {
    logger.error('Get adjustments by status error', error);

    if (error.message.includes('Invalid status')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};
