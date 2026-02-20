import { logger } from '../utils/logger.js';
import * as reportingService from '../services/reportingService.js';

/**
 * ReportingController
 * Handles HTTP requests for reporting and analytics endpoints
 */

/**
 * GET /api/reports/inventory-valuation/:locationId
 * Get inventory valuation report for a location
 * Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6
 */
export const getInventoryValuation = async (req, res, next) => {
  try {
    const { locationId } = req.params;
    const { asOfDate } = req.query;
    const companyDB = req.companyDB;

    if (!companyDB) {
      return res.status(400).json({
        success: false,
        message: 'Company database not found'
      });
    }

    const report = await reportingService.getInventoryValuation(
      companyDB,
      locationId,
      asOfDate ? new Date(asOfDate) : null
    );

    res.status(200).json({
      success: true,
      data: report
    });

  } catch (error) {
    logger.error('Error in getInventoryValuation controller:', error);
    next(error);
  }
};

/**
 * GET /api/reports/inventory-aging/:locationId
 * Get inventory aging report for a location
 * Requirements: 21.6
 */
export const getInventoryAging = async (req, res, next) => {
  try {
    const { locationId } = req.params;
    const companyDB = req.companyDB;

    if (!companyDB) {
      return res.status(400).json({
        success: false,
        message: 'Company database not found'
      });
    }

    const report = await reportingService.getInventoryAging(companyDB, locationId);

    res.status(200).json({
      success: true,
      data: report
    });

  } catch (error) {
    logger.error('Error in getInventoryAging controller:', error);
    next(error);
  }
};

/**
 * GET /api/reports/transfer-summary
 * Get transfer summary report with optional filters
 * Requirements: 22.7
 */
export const getTransferSummary = async (req, res, next) => {
  try {
    const { startDate, endDate, locationId, status } = req.query;
    const companyDB = req.companyDB;

    if (!companyDB) {
      return res.status(400).json({
        success: false,
        message: 'Company database not found'
      });
    }

    const filters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (locationId) filters.locationId = locationId;
    if (status) filters.status = status;

    const report = await reportingService.getTransferSummary(companyDB, filters);

    res.status(200).json({
      success: true,
      data: report
    });

  } catch (error) {
    logger.error('Error in getTransferSummary controller:', error);
    next(error);
  }
};

/**
 * GET /api/reports/stock-movement/:locationId/:itemId
 * Get stock movement report for a specific item at a location
 * Requirements: 22.7
 */
export const getStockMovement = async (req, res, next) => {
  try {
    const { locationId, itemId } = req.params;
    const { startDate, endDate, movementType } = req.query;
    const companyDB = req.companyDB;

    if (!companyDB) {
      return res.status(400).json({
        success: false,
        message: 'Company database not found'
      });
    }

    const filters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (movementType) filters.movementType = movementType;

    const report = await reportingService.getStockMovement(
      companyDB,
      locationId,
      itemId,
      filters
    );

    res.status(200).json({
      success: true,
      data: report
    });

  } catch (error) {
    logger.error('Error in getStockMovement controller:', error);
    next(error);
  }
};

/**
 * GET /api/reports/expiry-forecast/:locationId
 * Get expiry forecast report for a location
 * Requirements: 21.6
 */
export const getExpiryForecast = async (req, res, next) => {
  try {
    const { locationId } = req.params;
    const { daysAhead } = req.query;
    const companyDB = req.companyDB;

    if (!companyDB) {
      return res.status(400).json({
        success: false,
        message: 'Company database not found'
      });
    }

    const days = daysAhead ? parseInt(daysAhead, 10) : 30;

    const report = await reportingService.getExpiryForecast(companyDB, locationId, days);

    res.status(200).json({
      success: true,
      data: report
    });

  } catch (error) {
    logger.error('Error in getExpiryForecast controller:', error);
    next(error);
  }
};

/**
 * DELETE /api/reports/cache
 * Clear report cache (admin only)
 */
export const clearReportCache = async (req, res, next) => {
  try {
    reportingService.clearReportCache();

    res.status(200).json({
      success: true,
      message: 'Report cache cleared successfully'
    });

  } catch (error) {
    logger.error('Error in clearReportCache controller:', error);
    next(error);
  }
};

export default {
  getInventoryValuation,
  getInventoryAging,
  getTransferSummary,
  getStockMovement,
  getExpiryForecast,
  clearReportCache
};
