/**
 * Backorder Routes
 * API endpoints for backorder management operations
 * Implements Requirements: 17.1-17.10
 */

import express from 'express';
import {
  listBackorders,
  getBackorderById,
  fulfillBackorderHandler,
  cancelBackorderHandler
} from '../controllers/stockBackorderController.js';
import { authenticate, requireCompanyDB } from '../middlewares/auth.js';
import { idempotencyMiddleware } from '../middlewares/idempotency.js';

const router = express.Router();

// All routes require authentication and company DB
router.use(authenticate);
router.use(requireCompanyDB);

/**
 * List backorders with offset-based pagination and filtering
 * GET /api/v2/backorders
 * 
 * Query params:
 * - page: number (default 1)
 * - limit: number (max 100, default 10)
 * - status: 'pending' | 'fulfilled' | 'cancelled'
 * - fromLocation: ObjectId
 * - toLocation: ObjectId
 * - inventoryItem: ObjectId
 * - sortBy: 'createdAt' | 'ageInDays'
 * - sortOrder: 'asc' | 'desc'
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     backorders: [...],
 *     pagination: {
 *       total: number,
 *       page: number,
 *       limit: number,
 *       pages: number
 *     }
 *   }
 * }
 * 
 * Note: Location-based filtering is applied automatically based on user role
 */
router.get('/', listBackorders);

/**
 * Get a single backorder by ID
 * GET /api/v2/backorders/:backorderId
 * 
 * Response: {
 *   success: true,
 *   data: { backorder: {...} }
 * }
 */
router.get('/:backorderId', getBackorderById);

/**
 * Fulfill a backorder by creating a new stock transfer
 * POST /api/v2/backorders/:backorderId/fulfill
 * 
 * Body: {
 *   notes: string (optional)
 * }
 * 
 * Response: {
 *   success: true,
 *   message: 'Backorder fulfilled successfully',
 *   data: {
 *     backorder: {...},
 *     transfer: {...}
 *   }
 * }
 * 
 * Middleware:
 * - idempotencyMiddleware: Prevent duplicate fulfillments
 * 
 * Note: Automatically creates a new StockTransfer with status 'approved'
 */
router.post(
  '/:backorderId/fulfill',
  idempotencyMiddleware('BACKORDER_FULFILLMENT'),
  fulfillBackorderHandler
);

/**
 * Cancel a backorder
 * POST /api/v2/backorders/:backorderId/cancel
 * 
 * Body: {
 *   cancellationReason: string (required)
 * }
 * 
 * Response: {
 *   success: true,
 *   message: 'Backorder cancelled successfully',
 *   data: { backorder: {...} }
 * }
 * 
 * Middleware:
 * - idempotencyMiddleware: Prevent duplicate cancellations
 */
router.post(
  '/:backorderId/cancel',
  idempotencyMiddleware('BACKORDER_CANCELLATION'),
  cancelBackorderHandler
);

export default router;
