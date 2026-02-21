/**
 * Domain Event Controller
 * API endpoints for querying domain events
 */

import { 
  queryDomainEvents, 
  getEntityEvents, 
  getEventsByCorrelation 
} from '../services/domainEventService.js';

/**
 * Query domain events with filters
 * GET /api/domain-events
 * Query params: eventType, entityType, entityId, userId, locationId, correlationId, startDate, endDate, page, limit
 */
export const queryEvents = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    
    const filters = {
      eventType: req.query.eventType,
      entityType: req.query.entityType,
      entityId: req.query.entityId,
      userId: req.query.userId,
      locationId: req.query.locationId,
      correlationId: req.query.correlationId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      page: req.query.page,
      limit: req.query.limit
    };
    
    const result = await queryDomainEvents(req.companyDB, filters);
    
    res.status(200).json({
      success: true,
      data: result.events,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error querying domain events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to query domain events',
      error: error.message
    });
  }
};

/**
 * Get events for a specific entity
 * GET /api/domain-events/entity/:entityType/:entityId
 */
export const getEventsForEntity = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    
    const events = await getEntityEvents(
      req.companyDB, 
      entityType, 
      entityId, 
      { limit }
    );
    
    res.status(200).json({
      success: true,
      data: events
    });
  } catch (error) {
    console.error('Error getting entity events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get entity events',
      error: error.message
    });
  }
};

/**
 * Get events by correlation ID
 * GET /api/domain-events/correlation/:correlationId
 */
export const getEventsByCorrelationId = async (req, res) => {
  try {
    const { correlationId } = req.params;
    
    const events = await getEventsByCorrelation(req.companyDB, correlationId);
    
    res.status(200).json({
      success: true,
      data: events
    });
  } catch (error) {
    console.error('Error getting events by correlation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get events by correlation',
      error: error.message
    });
  }
};

/**
 * Replay events for analytics rebuild
 * POST /api/domain-events/replay
 * Body: { startDate, endDate, eventType, processorType }
 */
export const replayEventsEndpoint = async (req, res) => {
  try {
    const { startDate, endDate, eventType, processorType = 'log' } = req.body;
    
    // Define processor function based on type
    let processor;
    switch (processorType) {
      case 'log':
        processor = (event) => {
          console.log(`Replaying event: ${event.eventType} - ${event.entityType} - ${event.entityId}`);
          return Promise.resolve();
        };
        break;
      case 'count':
        let count = 0;
        processor = (event) => {
          count++;
          return Promise.resolve();
        };
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid processor type. Supported types: log, count'
        });
    }
    
    const filters = {
      startDate,
      endDate,
      eventType
    };
    
    const { replayEvents } = await import('../services/domainEventService.js');
    const result = await replayEvents(req.companyDB, filters, processor);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error replaying events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to replay events',
      error: error.message
    });
  }
};

export default {
  queryEvents,
  getEventsForEntity,
  getEventsByCorrelationId,
  replayEventsEndpoint
};
