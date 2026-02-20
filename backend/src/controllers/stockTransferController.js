/**
 * Stock Transfer Controller
 * Handles HTTP requests for stock transfer operations
 */

import * as stockTransferService from '../services/stockTransferService.js';
import { logger } from '../utils/logger.js';

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
        error.message.includes('cannot receive stock')) {
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

    const transfer = await stockTransferService.approveTransfer(id, userId, companyId);

    logger.info('Stock transfer approved via API', {
      transferId: id,
      transferNumber: transfer.transferNumber,
      companyId,
      userId
    });

    res.json({
      success: true,
      message: 'Stock transfer approved successfully',
      data: { transfer }
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
        error.message.includes('Insufficient available quantity')) {
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

    const transfer = await stockTransferService.completeTransfer(
      id,
      userId,
      receivedQuantities,
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
