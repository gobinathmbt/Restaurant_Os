/**
 * Stock Request Routes
 * API endpoints for stock request operations
 * Implements Requirements: 17.1-17.10
 */

import express from 'express';
import {
  createRequest,
  listRequests,
  getRequestById,
  approveRequest,
  rejectRequest,
  cancelRequest
} from '../controllers/stockRequestController.js';
import { authenticate, requireCompanyDB } from '../middlewares/auth.js';
import { validateLocationAccess, validateMultipleLocationsAccess } from '../middlewares/locationAccess.js';
import { idempotencyMiddleware } from '../middlewares/idempotency.js';

const router = express.Router();

// All routes require authentication and company DB
router.use(authenticate);
router.use(requireCompanyDB);

/**
 * Create a new stock request
 * POST /api/v2/stock-requests
 * 
 * Body: {
 *   fromLocation: ObjectId,
 *   toLocation: ObjectId,
 *   items: [{ inventoryItem, requestedQuantity, unit, notes }],
 *   priority: 'low' | 'normal' | 'high' | 'urgent',
 *   notes: string
 * }
 * 
 * Middleware:
 * - authenticate: Verify user is logged in
 * - validateMultipleLocationsAccess: Verify user has access to toLocation
 */
router.post(
  '/',
  validateMultipleLocationsAccess({ locationFields: ['toLocation'], source: 'body' }),
  createRequest
);

/**
 * List stock requests with offset-based pagination and filtering
 * GET /api/v2/stock-requests
 * 
 * Query params:
 * - page: number (default 1)
 * - limit: number (max 100, default 10)
 * - status: 'pending' | 'approved' | 'rejected' | 'cancelled'
 * - priority: 'low' | 'normal' | 'high' | 'urgent'
 * - fromLocation: ObjectId
 * - toLocation: ObjectId
 * - inventoryItem: ObjectId
 * - requestDateStart: ISO date string
 * - requestDateEnd: ISO date string
 * - expectedDeliveryDateStart: ISO date string
 * - expectedDeliveryDateEnd: ISO date string
 * - search: string (search by requestNumber)
 * - sortBy: 'requestDate' | 'priority' | 'expectedDeliveryDate' | 'status'
 * - sortOrder: 'asc' | 'desc'
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     requests: [...],
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
router.get('/', listRequests);

/**
 * Get a single stock request by ID
 * GET /api/v2/stock-requests/:requestId
 * 
 * Response: {
 *   success: true,
 *   data: { request: {...} }
 * }
 */
router.get('/:requestId', getRequestById);

/**
 * Approve a stock request (full or partial)
 * POST /api/v2/stock-requests/:requestId/approve
 * 
 * Body: {
 *   items: [{ inventoryItem, approvedQuantity }],
 *   notes: string (optional)
 * }
 * 
 * Response: {
 *   success: true,
 *   message: 'Stock request approved successfully',
 *   data: {
 *     request: {...},
 *     transfer: {...},
 *     backorders: [...]
 *   }
 * }
 * 
 * Middleware:
 * - idempotencyMiddleware: Prevent duplicate approvals
 * 
 * Note: Automatically creates transfer and backorders if partial approval
 */
router.post(
  '/:requestId/approve',
  idempotencyMiddleware('REQUEST_APPROVAL'),
  approveRequest
);

/**
 * Reject a stock request
 * POST /api/v2/stock-requests/:requestId/reject
 * 
 * Body: {
 *   rejectionReason: string (required)
 * }
 * 
 * Response: {
 *   success: true,
 *   message: 'Stock request rejected successfully',
 *   data: { request: {...} }
 * }
 */
router.post('/:requestId/reject', rejectRequest);

/**
 * Cancel a stock request
 * POST /api/v2/stock-requests/:requestId/cancel
 * 
 * Body: {
 *   cancellationReason: string (required)
 * }
 * 
 * Response: {
 *   success: true,
 *   message: 'Stock request cancelled successfully',
 *   data: { request: {...} }
 * }
 * 
 * Middleware:
 * - idempotencyMiddleware: Prevent duplicate cancellations
 */
router.post(
  '/:requestId/cancel',
  idempotencyMiddleware('REQUEST_CANCELLATION'),
  cancelRequest
);

export default router;
