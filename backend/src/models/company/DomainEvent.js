import mongoose from 'mongoose';

/**
 * DomainEvent Schema
 * Immutable stream of domain events for analytics and asynchronous workflows
 * Separate from inventory ledger (events = activity feed, ledger = quantity changes)
 */
const domainEventSchema = new mongoose.Schema({
  // Event identification
  eventType: {
    type: String,
    required: true,
    enum: [
      'TRANSFER_CREATED',
      'TRANSFER_APPROVED',
      'TRANSFER_COMPLETED',
      'TRANSFER_REJECTED',
      'TRANSFER_CANCELLED',
      'TRANSFER_RETURNED',
      'GRN_CREATED',
      'GRN_VERIFIED',
      'GRN_CANCELLED',
      'ADJUSTMENT_CREATED',
      'ADJUSTMENT_APPROVED',
      'ADJUSTMENT_REJECTED',
      'BATCH_EXPIRED',
      'RESERVATION_CREATED',
      'RESERVATION_EXPIRED',
      'RESERVATION_CONSUMED',
      'RESERVATION_RELEASED',
      'BACKORDER_CREATED',
      'BACKORDER_FULFILLED',
      'BACKORDER_CANCELLED',
      'STOCK_COUNT_STARTED',
      'STOCK_COUNT_COMPLETED',
      'PERIOD_LOCKED',
      'PERIOD_UNLOCKED'
    ]
  },
  
  // Entity details
  entityType: {
    type: String,
    required: true,
    enum: ['TRANSFER', 'GRN', 'ADJUSTMENT', 'BATCH', 'RESERVATION', 'BACKORDER', 'STOCK_COUNT', 'PERIOD']
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  
  // Event payload (flexible structure)
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // Location context
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  },
  
  // Timestamp
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  // User who triggered the event
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  
  // Correlation ID for tracking related events
  correlationId: {
    type: String,
    trim: true
  },
  
  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Prevent updates and deletes (immutable event stream)
domainEventSchema.pre('findOneAndUpdate', function(next) {
  next(new Error('Domain events are immutable and cannot be updated'));
});

domainEventSchema.pre('findOneAndDelete', function(next) {
  next(new Error('Domain events are immutable and cannot be deleted'));
});

domainEventSchema.pre('deleteOne', function(next) {
  next(new Error('Domain events are immutable and cannot be deleted'));
});

domainEventSchema.pre('deleteMany', function(next) {
  next(new Error('Domain events are immutable and cannot be deleted'));
});

// Indexes for performance
domainEventSchema.index({ eventType: 1, timestamp: -1 });
domainEventSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
domainEventSchema.index({ timestamp: -1 });
domainEventSchema.index({ userId: 1, timestamp: -1 });
domainEventSchema.index({ locationId: 1, timestamp: -1 });
domainEventSchema.index({ correlationId: 1 });

export const getDomainEventModel = (companyDB) => {
  return companyDB.model('DomainEvent', domainEventSchema);
};

export default domainEventSchema;
