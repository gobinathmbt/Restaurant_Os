/**
 * GRN Routes
 * API endpoints for Goods Receipt Note (GRN) operations
 * Implements Requirements: 8.1-8.5, 17.2
 */

import express from 'express';
import {
  createGRN,
  getGRNById,
  verifyGRN,
  cancelGRN,
  getGRNsByLocation,
  getGRNsBySupplier
} from '../controllers/grnController.js';
import { authenticate } from '../middlewares/auth.js';
import { idempotencyMiddleware } from '../middlewares/idempotency.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create a new GRN with batch information (with idempotency support)
router.post('/', idempotencyMiddleware('GRN_CREATION'), createGRN);

// Get a single GRN by ID
router.get('/:id', getGRNById);

// Verify a GRN
router.put('/:id/verify', verifyGRN);

// Cancel a GRN
router.put('/:id/cancel', cancelGRN);

// Get GRNs by location (with pagination support)
router.get('/location/:locationId', getGRNsByLocation);

// Get GRNs by supplier (with pagination support)
router.get('/supplier/:supplierId', getGRNsBySupplier);

export default router;
