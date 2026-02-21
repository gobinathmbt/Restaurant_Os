/**
 * Domain Event Routes
 * API routes for querying domain events
 */

import express from 'express';
import { 
  queryEvents, 
  getEventsForEntity, 
  getEventsByCorrelationId,
  replayEventsEndpoint
} from '../controllers/domainEventController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * Query domain events with filters
 * GET /api/domain-events
 * Query params: eventType, entityType, entityId, userId, locationId, correlationId, startDate, endDate, page, limit
 */
router.get('/', queryEvents);

/**
 * Get events for a specific entity
 * GET /api/domain-events/entity/:entityType/:entityId
 */
router.get('/entity/:entityType/:entityId', getEventsForEntity);

/**
 * Get events by correlation ID
 * GET /api/domain-events/correlation/:correlationId
 */
router.get('/correlation/:correlationId', getEventsByCorrelationId);

/**
 * Replay events for analytics rebuild
 * POST /api/domain-events/replay
 * Body: { startDate, endDate, eventType, processorType }
 */
router.post('/replay', replayEventsEndpoint);

export default router;
