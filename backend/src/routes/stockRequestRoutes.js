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
  cancelRequest,
  getMyRequests,
  getRequestsToMe,
  getPendingApprovals
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
 *   destinationLocation: ObjectId,
 *   sourceLocation: ObjectId,
 *   items: [{ inventoryItem, requestedQuantity, unit, notes }],
 *   priority: 'low' | 'normal' | 'high' | 'urgent',
 *   notes: string
 * }
 * 
 * Middleware:
 * - authenticate: Verify user is logged in
 * - No location validation middleware (validation done in service layer)
 */
router.post(
  '/',
  createRequest
);

/**
 * Get requests created by the current user
 * GET /api/v2/stock-requests/my-requests
 * 
 * Query params: page, limit, status, priority, requestDateStart, requestDateEnd, search, sortBy, sortOrder
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     requests: [...],
 *     pagination: { total, page, limit, pages }
 *   }
 * }
 */
router.get('/my-requests', getMyRequests);

/**
 * Get requests to the current user's locations
 * GET /api/v2/stock-requests/requests-to-me
 * 
 * Query params: page, limit, status, priority, requestDateStart, requestDateEnd, search, sortBy, sortOrder
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     requests: [...],
 *     pagination: { total, page, limit, pages }
 *   }
 * }
 */
router.get('/requests-to-me', getRequestsToMe);

/**
 * Get pending approval requests (super admin only)
 * GET /api/v2/stock-requests/pending-approvals
 * 
 * Query params: page, limit, priority, requestDateStart, requestDateEnd, search, sortBy, sortOrder
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     requests: [...],
 *     pagination: { total, page, limit, pages }
 *   }
 * }
 * 
 * Authorization: Super admin only
 */
router.get('/pending-approvals', getPendingApprovals);

/**
 * List stock requests with offset-based pagination and filtering
 * GET /api/v2/stock-requests
 * 
 * Query params:
 * - page: number (default 1)
 * - limit: number (max 100, default 10)
 * - status: 'pending' | 'approved' | 'rejected' | 'cancelled'
 * - priority: 'low' | 'normal' | 'high' | 'urgent'
 * - destinationLocation: ObjectId
 * - sourceLocation: ObjectId
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
