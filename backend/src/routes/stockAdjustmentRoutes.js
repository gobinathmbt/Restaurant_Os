/**
 * Stock Adjustment Routes
 * API endpoints for stock adjustment operations
 */

import express from 'express';
import {
  createAdjustment,
  getAdjustmentById,
  approveAdjustment,
  rejectAdjustment,
  getAdjustmentsByLocation,
  getAdjustmentsByStatus
} from '../controllers/stockAdjustmentController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create a new stock adjustment
router.post('/', createAdjustment);

// Get a single adjustment by ID
router.get('/:id', getAdjustmentById);

// Approve a stock adjustment
router.put('/:id/approve', approveAdjustment);

// Reject a stock adjustment
router.put('/:id/reject', rejectAdjustment);

// Get adjustments by location
router.get('/location/:locationId', getAdjustmentsByLocation);

// Get adjustments by status
router.get('/status/:status', getAdjustmentsByStatus);

export default router;
