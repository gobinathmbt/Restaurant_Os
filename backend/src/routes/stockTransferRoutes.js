/**
 * Stock Transfer Routes
 * API endpoints for stock transfer operations
 */

import express from 'express';
import {
  createTransfer,
  getTransferById,
  approveTransfer,
  rejectTransfer,
  cancelTransfer,
  completeTransfer,
  returnTransfer,
  getTransfersByLocation,
  getTransfersByStatus
} from '../controllers/stockTransferController.js';
import { authenticate } from '../middlewares/auth.js';
import { idempotencyMiddleware } from '../middlewares/idempotency.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

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
