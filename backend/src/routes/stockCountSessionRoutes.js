/**
 * Stock Count Session Routes
 * API endpoints for physical stock count operations
 */

import express from 'express';
import {
  createCountSession,
  getCountSessionById,
  startCountSession,
  recordCountedQuantity,
  completeCountSession,
  approveCountSession,
  rejectCountSession,
  getCountSessionsByLocation,
  getCountSessionsByStatus
} from '../controllers/stockCountSessionController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create a new stock count session
router.post('/', createCountSession);

// Get a single count session by ID
router.get('/:id', getCountSessionById);

// Start a stock count session
router.put('/:id/start', startCountSession);

// Record counted quantity for an item
router.put('/:id/count', recordCountedQuantity);

// Complete a stock count session
router.put('/:id/complete', completeCountSession);

// Approve a stock count session
router.put('/:id/approve', approveCountSession);

// Reject a stock count session
router.put('/:id/reject', rejectCountSession);

// Get count sessions by location
router.get('/location/:locationId', getCountSessionsByLocation);

// Get count sessions by status
router.get('/status/:status', getCountSessionsByStatus);

export default router;

