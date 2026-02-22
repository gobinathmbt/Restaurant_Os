/**
 * GRN Controller
 * Handles HTTP requests for Goods Receipt Note (GRN) operations
 * Implements Requirements: 8.1-8.5, 17.2
 */

import * as grnService from '../services/grnService.js';
import { logger } from '../utils/logger.js';

/**
 * Create a new GRN with batch information
 * POST /api/grn
 */
export const createGRN = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const grnData = req.body;

    // Validate required fields
    if (!grnData.locationId) {
      return res.status(400).json({
        success: false,
        message: 'locationId is required'
      });
    }

    if (!grnData.supplierId) {
      return res.status(400).json({
        success: false,
        message: 'supplierId is required. GRN is only for supplier procurement. Use StockTransfer for internal movements.'
      });
    }

    if (!grnData.items || !Array.isArray(grnData.items) || grnData.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required'
      });
    }

    // Validate each item
    for (const item of grnData.items) {
      if (!item.inventoryItem) {
        return res.status(400).json({
          success: false,
          message: 'inventoryItem is required for all items'
        });
      }
      if (!item.quantity || item.quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: 'quantity must be positive for all items'
        });
      }
      if (item.unitPrice === undefined || item.unitPrice === null || item.unitPrice < 0) {
        return res.status(400).json({
          success: false,
          message: 'unitPrice must be non-negative for all items'
        });
      }
      if (!item.unit) {
        return res.status(400).json({
          success: false,
          message: 'unit is required for all items'
        });
      }
    }

    // Create GRN with batches
    const grn = await grnService.createGRNWithBatches(grnData, companyId, userId);

    logger.info('GRN created via API', {
      grnId: grn._id,
      grnNumber: grn.grnNumber,
      locationId: grnData.locationId,
      companyId,
      userId
    });

    res.status(201).json({
      success: true,
      message: 'GRN created successfully',
      data: { grn }
    });
  } catch (error) {
    logger.error('Create GRN error', error);

    if (error.statusCode === 403) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('required') ||
        error.message.includes('must be positive') ||
        error.message.includes('must be non-negative') ||
        error.message.includes('must have at least one')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Get a single GRN by ID
 * GET /api/grn/:id
 */
export const getGRNById = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;

    const grn = await grnService.getGRNById(id, companyId);

    res.json({
      success: true,
      data: { grn }
    });
  } catch (error) {
    logger.error('Get GRN by ID error', error);

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
 * Verify a GRN
 * PUT /api/grn/:id/verify
 */
export const verifyGRN = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;

    const grn = await grnService.verifyGRN(id, companyId);

    logger.info('GRN verified via API', {
      grnId: grn._id,
      grnNumber: grn.grnNumber,
      companyId,
      userId
    });

    res.json({
      success: true,
      message: 'GRN verified successfully',
      data: { grn }
    });
  } catch (error) {
    logger.error('Verify GRN error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('Only received GRNs')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Cancel a GRN
 * PUT /api/grn/:id/cancel
 */
export const cancelGRN = async (req, res, next) => {
  try {
    const { companyId, userId } = req.user;
    const { id } = req.params;

    const grn = await grnService.cancelGRN(id, companyId);

    logger.info('GRN cancelled via API', {
      grnId: grn._id,
      grnNumber: grn.grnNumber,
      companyId,
      userId
    });

    res.json({
      success: true,
      message: 'GRN cancelled successfully',
      data: { grn }
    });
  } catch (error) {
    logger.error('Cancel GRN error', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('already cancelled')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

/**
 * Get GRNs by location
 * GET /api/grn/location/:locationId
 * GET /api/inventory/grn/location/:locationId (alias)
 */
export const getGRNsByLocation = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { locationId } = req.params;
    
    // Extract query parameters for filtering and pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;
    
    const options = {
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit,
      skip
    };

    const grns = await grnService.getGRNsByLocation(locationId, companyId, options);
    
    // Get total count for pagination
    const totalCount = await grnService.getGRNsCountByLocation(locationId, companyId, {
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    });

    res.json({
      success: true,
      data: { 
        grns,
        pagination: {
          page,
          limit,
          skip,
          count: grns.length,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get GRNs by location error', error);
    next(error);
  }
};

/**
 * Get all GRNs across all locations (for super admin)
 * GET /api/grn/all
 * GET /api/inventory/grn/all (alias)
 */
export const getAllGRNs = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    
    // Extract query parameters for filtering and pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;
    
    const options = {
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      search: req.query.search,
      limit,
      skip
    };

    const result = await grnService.getAllGRNs(companyId, options);

    res.json({
      success: true,
      data: { 
        grns: result.grns,
        pagination: {
          page,
          limit,
          skip,
          count: result.grns.length,
          total: result.total,
          pages: Math.ceil(result.total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get all GRNs error', error);
    next(error);
  }
};

/**
 * Get GRNs by supplier
 * GET /api/grn/supplier/:supplierId
 */
export const getGRNsBySupplier = async (req, res, next) => {
  try {
    const { companyId } = req.user;
    const { supplierId } = req.params;
    
    // Extract query parameters for filtering and pagination
    const options = {
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: parseInt(req.query.limit) || 100,
      skip: parseInt(req.query.skip) || 0
    };

    const grns = await grnService.getGRNsBySupplier(supplierId, companyId, options);

    res.json({
      success: true,
      data: { 
        grns,
        pagination: {
          limit: options.limit,
          skip: options.skip,
          count: grns.length
        }
      }
    });
  } catch (error) {
    logger.error('Get GRNs by supplier error', error);
    next(error);
  }
};
