/**
 * Stock Transfer Routes
 * API endpoints for stock transfer operations
 */

import express from 'express';
import {
  listTransfers,
  createTransfer,
  getTransferById,
  approveTransfer,
  rejectTransfer,
  cancelTransfer,
  completeTransfer,
  returnTransfer,
  getTransfersByLocation,
  getTransfersByStatus,
  shipTransfer,
  receiveTransfer,
  updateExecutionStage,
  acceptStock,
  getInTransitTransfers,
  getExceptions,
  getCompletedTransfers,
  recordExceptions,
  getTransfersWithExceptions,
  resolveExceptionEndpoint,
  getTransferExceptions,
  escalateExceptionEndpoint,
  forceCompleteTransferEndpoint,
  getImpactPreview
} from '../controllers/stockTransferController.js';
import { authenticate } from '../middlewares/auth.js';
import { idempotencyMiddleware } from '../middlewares/idempotency.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// V2 API endpoints with location-based access control

// List stock transfers with cursor pagination (location-based filtering applied in controller)
router.get('/v2', listTransfers);

// Get a single transfer by ID
router.get('/v2/:transferId', getTransferById);

// Ship a stock transfer (Warehouse Admin marks as shipped)
// Location-based access control is validated in the service layer (destinationLocation)
router.post(
  '/v2/:transferId/ship',
  idempotencyMiddleware('TRANSFER_SHIP'),
  shipTransfer
);

// Receive a stock transfer (Branch Admin marks as received)
// Location-based access control is validated in the service layer (sourceLocation)
router.post(
  '/v2/:transferId/receive',
  idempotencyMiddleware('TRANSFER_RECEIVE'),
  receiveTransfer
);

// Update execution stage of a stock transfer
router.patch('/v2/:transferId/stage', updateExecutionStage);

// Accept stock with exception recording
router.post(
  '/v2/:transferId/accept',
  idempotencyMiddleware('TRANSFER_ACCEPT'),
  acceptStock
);

// Get in-transit transfers (location-based filtering applied in controller)
router.get('/v2/in-transit', getInTransitTransfers);

// Get transfers with exceptions (location-based filtering applied in controller)
router.get('/v2/exceptions', getExceptions);

// Get completed transfers (location-based filtering applied in controller)
router.get('/v2/completed', getCompletedTransfers);

// Exception handling endpoints

// Record exceptions for a transfer (Destination Admin only)
router.post(
  '/v2/:transferId/exceptions',
  idempotencyMiddleware('RECORD_EXCEPTIONS'),
  recordExceptions
);

// Get all transfers with exceptions (Super Admin only)
router.get('/v2/exceptions/all', getTransfersWithExceptions);

// Get exceptions for a specific transfer (Destination Admin or Super Admin)
router.get('/v2/:transferId/exceptions', getTransferExceptions);

// Resolve an individual exception (Super Admin only)
router.put('/v2/:transferId/exceptions/:exceptionId', resolveExceptionEndpoint);

// Escalate unresolved exceptions (Super Admin only)
router.post('/v2/:transferId/escalate', escalateExceptionEndpoint);

// Force complete transfer with unresolved exceptions (Super Admin only)
router.post('/v2/:transferId/force-complete', forceCompleteTransferEndpoint);

// Get impact preview for a transfer (Destination Admin or Super Admin)
router.get('/v2/:transferId/impact-preview', getImpactPreview);

// Legacy V1 API endpoints (maintained for backward compatibility)

// Create a new stock transfer
router.post('/', createTransfer);

// Get a single transfer by ID
router.get('/:id', getTransferById);

// Approve a stock transfer (with idempotency support)
router.put('/:id/approve', idempotencyMiddleware('TRANSFER_APPROVAL'), approveTransfer);

// Reject a stock transfer
router.put('/:id/reject', rejectTransfer);

// Cancel a stock transfer
router.put('/:id/cancel', cancelTransfer);

// Complete a stock transfer
router.put('/:id/complete', completeTransfer);

// Return a stock transfer
router.put('/:id/return', returnTransfer);

// Get transfers by location
router.get('/location/:locationId', getTransfersByLocation);

// Get transfers by status
router.get('/status/:status', getTransfersByStatus);

export default router;
