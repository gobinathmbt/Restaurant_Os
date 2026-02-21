import { getDomainEventModel } from '../models/company/DomainEvent.js';
import socketManager from '../config/socket.js';

/**
 * Domain Event Service
 * Publishes immutable domain events for analytics and asynchronous workflows
 * Separate from inventory ledger (events = activity feed, ledger = quantity changes)
 */

/**
 * Publish a domain event
 * @param {Object} companyDB - Company database connection
 * @param {Object} eventData - Event data
 * @param {string} eventData.eventType - Type of event (e.g., 'TRANSFER_CREATED')
 * @param {string} eventData.entityType - Type of entity (e.g., 'TRANSFER')
 * @param {ObjectId} eventData.entityId - ID of the entity
 * @param {Object} eventData.payload - Event payload (flexible structure)
 * @param {ObjectId} eventData.userId - User who triggered the event
 * @param {ObjectId} [eventData.locationId] - Optional location context
 * @param {string} [eventData.correlationId] - Optional correlation ID for tracking related events
 * @param {Object} [eventData.metadata] - Optional metadata
 * @param {string} [companyId] - Optional company ID for Socket.IO emission
 * @returns {Promise<Object>} Created domain event
 */
export const publishDomainEvent = async (companyDB, eventData, companyId = null) => {
  try {
    const DomainEvent = getDomainEventModel(companyDB);
    
    const event = new DomainEvent({
      eventType: eventData.eventType,
      entityType: eventData.entityType,
      entityId: eventData.entityId,
      payload: eventData.payload,
      userId: eventData.userId,
      locationId: eventData.locationId,
      correlationId: eventData.correlationId,
      metadata: eventData.metadata,
      timestamp: new Date()
    });
    
    await event.save();
    
    // Emit event to subscribers via Socket.IO if companyId is provided
    if (companyId && socketManager.getCompanyNamespace()) {
      socketManager.emitDomainEvent(companyId, event.toObject());
    }
    
    return event;
  } catch (error) {
    console.error('Error publishing domain event:', error);
    // Don't throw - event publishing should not break main operations
    // Log the error and continue
    return null;
  }
};

/**
 * Publish multiple domain events in batch
 * @param {Object} companyDB - Company database connection
 * @param {Array<Object>} eventsData - Array of event data objects
 * @returns {Promise<Array<Object>>} Created domain events
 */
export const publishDomainEvents = async (companyDB, eventsData) => {
  try {
    const DomainEvent = getDomainEventModel(companyDB);
    
    const events = eventsData.map(eventData => ({
      eventType: eventData.eventType,
      entityType: eventData.entityType,
      entityId: eventData.entityId,
      payload: eventData.payload,
      userId: eventData.userId,
      locationId: eventData.locationId,
      correlationId: eventData.correlationId,
      metadata: eventData.metadata,
      timestamp: new Date()
    }));
    
    const createdEvents = await DomainEvent.insertMany(events);
    
    return createdEvents;
  } catch (error) {
    console.error('Error publishing domain events:', error);
    // Don't throw - event publishing should not break main operations
    return [];
  }
};

/**
 * Query domain events
 * @param {Object} companyDB - Company database connection
 * @param {Object} filters - Query filters
 * @param {string} [filters.eventType] - Filter by event type
 * @param {string} [filters.entityType] - Filter by entity type
 * @param {ObjectId} [filters.entityId] - Filter by entity ID
 * @param {ObjectId} [filters.userId] - Filter by user ID
 * @param {ObjectId} [filters.locationId] - Filter by location ID
 * @param {string} [filters.correlationId] - Filter by correlation ID
 * @param {Date} [filters.startDate] - Filter by start date
 * @param {Date} [filters.endDate] - Filter by end date
 * @param {number} [filters.page=1] - Page number
 * @param {number} [filters.limit=100] - Items per page
 * @returns {Promise<Object>} Query results with pagination
 */
export const queryDomainEvents = async (companyDB, filters = {}) => {
  try {
    const DomainEvent = getDomainEventModel(companyDB);
    
    const query = {};
    
    if (filters.eventType) {
      query.eventType = filters.eventType;
    }
    
    if (filters.entityType) {
      query.entityType = filters.entityType;
    }
    
    if (filters.entityId) {
      query.entityId = filters.entityId;
    }
    
    if (filters.userId) {
      query.userId = filters.userId;
    }
    
    if (filters.locationId) {
      query.locationId = filters.locationId;
    }
    
    if (filters.correlationId) {
      query.correlationId = filters.correlationId;
    }
    
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) {
        query.timestamp.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.timestamp.$lte = new Date(filters.endDate);
      }
    }
    
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 100;
    const skip = (page - 1) * limit;
    
    const [events, total] = await Promise.all([
      DomainEvent.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DomainEvent.countDocuments(query)
    ]);
    
    return {
      events,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error querying domain events:', error);
    throw error;
  }
};

/**
 * Get events for a specific entity
 * @param {Object} companyDB - Company database connection
 * @param {string} entityType - Entity type
 * @param {ObjectId} entityId - Entity ID
 * @param {Object} [options] - Query options
 * @returns {Promise<Array<Object>>} Domain events
 */
export const getEntityEvents = async (companyDB, entityType, entityId, options = {}) => {
  try {
    const DomainEvent = getDomainEventModel(companyDB);
    
    const query = {
      entityType,
      entityId
    };
    
    const limit = options.limit || 100;
    
    const events = await DomainEvent.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    
    return events;
  } catch (error) {
    console.error('Error getting entity events:', error);
    throw error;
  }
};

/**
 * Get events by correlation ID (for tracking related events)
 * @param {Object} companyDB - Company database connection
 * @param {string} correlationId - Correlation ID
 * @returns {Promise<Array<Object>>} Domain events
 */
export const getEventsByCorrelation = async (companyDB, correlationId) => {
  try {
    const DomainEvent = getDomainEventModel(companyDB);
    
    const events = await DomainEvent.find({ correlationId })
      .sort({ timestamp: 1 })
      .lean();
    
    return events;
  } catch (error) {
    console.error('Error getting events by correlation:', error);
    throw error;
  }
};

/**
 * Replay events for analytics rebuild
 * @param {Object} companyDB - Company database connection
 * @param {Object} filters - Replay filters
 * @param {Date} [filters.startDate] - Start date for replay
 * @param {Date} [filters.endDate] - End date for replay
 * @param {string} [filters.eventType] - Filter by event type
 * @param {Function} processor - Function to process each event
 * @returns {Promise<Object>} Replay statistics
 */
export const replayEvents = async (companyDB, filters, processor) => {
  try {
    const DomainEvent = getDomainEventModel(companyDB);
    
    const query = {};
    
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) {
        query.timestamp.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.timestamp.$lte = new Date(filters.endDate);
      }
    }
    
    if (filters.eventType) {
      query.eventType = filters.eventType;
    }
    
    const batchSize = 1000;
    let processed = 0;
    let errors = 0;
    
    const cursor = DomainEvent.find(query)
      .sort({ timestamp: 1 })
      .cursor();
    
    for await (const event of cursor) {
      try {
        await processor(event);
        processed++;
      } catch (error) {
        console.error(`Error processing event ${event._id}:`, error);
        errors++;
      }
    }
    
    return {
      processed,
      errors,
      success: errors === 0
    };
  } catch (error) {
    console.error('Error replaying events:', error);
    throw error;
  }
};

export default {
  publishDomainEvent,
  publishDomainEvents,
  queryDomainEvents,
  getEntityEvents,
  getEventsByCorrelation,
  replayEvents
};
