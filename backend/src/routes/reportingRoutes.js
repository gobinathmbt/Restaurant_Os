import express from 'express';
import * as reportingController from '../controllers/reportingController.js';
import { authenticateToken, requireCompanyDB } from '../middlewares/auth.js';

const router = express.Router();

/**
 * Reporting Routes
 * All routes require authentication and company database context
 */

// Apply authentication and company DB middleware to all routes
router.use(authenticateToken);
router.use(requireCompanyDB);

/**
 * GET /api/reports/inventory-valuation/:locationId
 * Get inventory valuation report for a location
 * Query params: asOfDate (optional)
 */
router.get('/inventory-valuation/:locationId', reportingController.getInventoryValuation);

/**
 * GET /api/reports/inventory-aging/:locationId
 * Get inventory aging report for a location
 */
router.get('/inventory-aging/:locationId', reportingController.getInventoryAging);

/**
 * GET /api/reports/transfer-summary
 * Get transfer summary report
 * Query params: startDate, endDate, locationId, status (all optional)
 */
router.get('/transfer-summary', reportingController.getTransferSummary);

/**
 * GET /api/reports/stock-movement/:locationId/:itemId
 * Get stock movement report for a specific item at a location
 * Query params: startDate, endDate, movementType (all optional)
 */
router.get('/stock-movement/:locationId/:itemId', reportingController.getStockMovement);

/**
 * GET /api/reports/expiry-forecast/:locationId
 * Get expiry forecast report for a location
 * Query params: daysAhead (optional, default: 30)
 */
router.get('/expiry-forecast/:locationId', reportingController.getExpiryForecast);

/**
 * DELETE /api/reports/cache
 * Clear report cache (admin only)
 */
router.delete('/cache', reportingController.clearReportCache);

export default router;
