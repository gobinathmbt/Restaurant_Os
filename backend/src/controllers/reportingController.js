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

/**
 * GET /api/v2/dashboard/stock-requests
 * Get stock requests dashboard with cached aggregated statistics
 * Applies location-based filtering for non-Super Admins
 * Requirements: 6.9, 16.1-16.10
 */
export const getStockRequestsDashboard = async (req, res, next) => {
  try {
    const companyDB = req.companyDB;
    const user = req.user;

    if (!companyDB) {
      return res.status(400).json({
        success: false,
        message: 'Company database not found'
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const result = await reportingService.getStockRequestsDashboard(
      companyDB,
      user.companyId,
      user
    );

    res.status(200).json(result);

  } catch (error) {
    logger.error('Error in getStockRequestsDashboard controller:', error);
    next(error);
  }
};

/**
 * GET /api/v2/reports/stock-requests/export
 * Export stock requests to CSV or PDF format
 * Query params: format (csv|pdf), status, fromLocation, toLocation, startDate, endDate
 * Requirements: 16.9
 */
export const exportStockRequests = async (req, res, next) => {
  try {
    const companyDB = req.companyDB;
    const { format = 'csv', status, fromLocation, toLocation, startDate, endDate } = req.query;

    if (!companyDB) {
      return res.status(400).json({
        success: false,
        message: 'Company database not found'
      });
    }

    const filters = {};
    if (status) filters.status = status;
    if (fromLocation) filters.fromLocation = fromLocation;
    if (toLocation) filters.toLocation = toLocation;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    if (format === 'csv') {
      const csvContent = await reportingService.exportStockRequestsCSV(companyDB, filters);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="stock-requests-${Date.now()}.csv"`);
      res.status(200).send(csvContent);
    } else if (format === 'pdf') {
      const pdfBuffer = await reportingService.exportStockRequestsPDF(companyDB, filters);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="stock-requests-${Date.now()}.pdf"`);
      res.status(200).send(pdfBuffer);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid format. Use csv or pdf'
      });
    }

  } catch (error) {
    logger.error('Error in exportStockRequests controller:', error);
    next(error);
  }
};

/**
 * GET /api/v2/reports/stock-transfers/export
 * Export stock transfers to CSV format
 * Query params: status, fromLocation, toLocation, startDate, endDate
 * Requirements: 16.9
 */
export const exportStockTransfers = async (req, res, next) => {
  try {
    const companyDB = req.companyDB;
    const { status, fromLocation, toLocation, startDate, endDate } = req.query;

    if (!companyDB) {
      return res.status(400).json({
        success: false,
        message: 'Company database not found'
      });
    }

    const filters = {};
    if (status) filters.status = status;
    if (fromLocation) filters.fromLocation = fromLocation;
    if (toLocation) filters.toLocation = toLocation;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const csvContent = await reportingService.exportStockTransfersCSV(companyDB, filters);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="stock-transfers-${Date.now()}.csv"`);
    res.status(200).send(csvContent);

  } catch (error) {
    logger.error('Error in exportStockTransfers controller:', error);
    next(error);
  }
};

/**
 * GET /api/v2/reports/stock-backorders/export
 * Export stock backorders to CSV format
 * Query params: status, fromLocation, toLocation
 * Requirements: 16.9
 */
export const exportStockBackorders = async (req, res, next) => {
  try {
    const companyDB = req.companyDB;
    const { status, fromLocation, toLocation } = req.query;

    if (!companyDB) {
      return res.status(400).json({
        success: false,
        message: 'Company database not found'
      });
    }

    const filters = {};
    if (status) filters.status = status;
    if (fromLocation) filters.fromLocation = fromLocation;
    if (toLocation) filters.toLocation = toLocation;

    const csvContent = await reportingService.exportStockBackordersCSV(companyDB, filters);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="stock-backorders-${Date.now()}.csv"`);
    res.status(200).send(csvContent);

  } catch (error) {
    logger.error('Error in exportStockBackorders controller:', error);
    next(error);
  }
};

export default {
  getInventoryValuation,
  getInventoryAging,
  getTransferSummary,
  getStockMovement,
  getExpiryForecast,
  clearReportCache,
  getStockRequestsDashboard,
  exportStockRequests,
  exportStockTransfers,
  exportStockBackorders
};
