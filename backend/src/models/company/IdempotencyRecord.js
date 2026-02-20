import mongoose from 'mongoose';

/**
 * IdempotencyRecord Schema
 * Prevents duplicate transactions from network retries
 * Critical for API reliability and data integrity
 */
const idempotencyRecordSchema = new mongoose.Schema({
  idempotencyKey: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  
  // Operation details
  operationType: {
    type: String,
    required: true,
    enum: ['TRANSFER_APPROVAL', 'GRN_CREATION', 'ADJUSTMENT_APPROVAL', 'OTHER']
  },
  
  // Response data (cached for duplicate requests)
  responseData: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Status
  status: {
    type: String,
    required: true,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing'
  },
  
  // Error information (if failed)
  errorMessage: {
    type: String,
    trim: true
  },
  
  // Audit trail
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  requestDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  completedDate: {
    type: Date
  },
  
  // TTL for automatic cleanup (default: 24 hours)
  expiresAt: {
    type: Date,
    required: true,
    default: function() {
      return new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    }
  }
}, {
  timestamps: true
});

// Unique index on idempotencyKey
idempotencyRecordSchema.index({ idempotencyKey: 1 }, { unique: true });

// TTL index for automatic cleanup
idempotencyRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Additional indexes
idempotencyRecordSchema.index({ operationType: 1, status: 1 });
idempotencyRecordSchema.index({ requestedBy: 1, requestDate: -1 });

export const getIdempotencyRecordModel = (companyDB) => {
  return companyDB.model('IdempotencyRecord', idempotencyRecordSchema);
};

export default idempotencyRecordSchema;
