import mongoose from 'mongoose';

/**
 * ArchivalMetadata Schema
 * Tracks archival operations for inventory ledger entries
 * Maintains index of what has been archived and when
 */
const archivalMetadataSchema = new mongoose.Schema({
  // Archival operation details
  archivalType: {
    type: String,
    required: true,
    enum: ['inventory_ledger', 'stock_transfer', 'grn', 'other'],
    default: 'inventory_ledger'
  },
  
  // Date range of archived entries
  dateRangeStart: {
    type: Date,
    required: true
  },
  dateRangeEnd: {
    type: Date,
    required: true
  },
  
  // Statistics
  entriesArchived: {
    type: Number,
    required: true,
    min: 0
  },
  entriesFailed: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Status tracking
  status: {
    type: String,
    required: true,
    enum: ['in_progress', 'completed', 'failed', 'partial'],
    default: 'in_progress'
  },
  
  // Execution details
  startedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  durationMs: {
    type: Number
  },
  
  // Configuration used
  retentionPeriodDays: {
    type: Number,
    required: true
  },
  batchSize: {
    type: Number,
    default: 1000
  },
  
  // Error tracking
  errorMessage: {
    type: String,
    trim: true
  },
  errorDetails: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Audit trail
  initiatedBy: {
    type: String,
    enum: ['system', 'manual'],
    default: 'system'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId
  },
  
  // Additional metadata
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for querying archival history
archivalMetadataSchema.index({ status: 1, createdAt: -1 });
archivalMetadataSchema.index({ archivalType: 1, createdAt: -1 });
archivalMetadataSchema.index({ dateRangeStart: 1, dateRangeEnd: 1 });
archivalMetadataSchema.index({ createdAt: -1 });

// Virtual for success rate
archivalMetadataSchema.virtual('successRate').get(function() {
  if (this.entriesArchived === 0) return 0;
  const successful = this.entriesArchived - this.entriesFailed;
  return (successful / this.entriesArchived) * 100;
});

// Method to mark archival as completed
archivalMetadataSchema.methods.markCompleted = function() {
  this.status = this.entriesFailed > 0 ? 'partial' : 'completed';
  this.completedAt = new Date();
  this.durationMs = this.completedAt - this.startedAt;
  return this.save();
};

// Method to mark archival as failed
archivalMetadataSchema.methods.markFailed = function(errorMessage, errorDetails) {
  this.status = 'failed';
  this.completedAt = new Date();
  this.durationMs = this.completedAt - this.startedAt;
  this.errorMessage = errorMessage;
  this.errorDetails = errorDetails;
  return this.save();
};

// Method to increment archived count
archivalMetadataSchema.methods.incrementArchived = function(count = 1) {
  this.entriesArchived += count;
  return this.save();
};

// Method to increment failed count
archivalMetadataSchema.methods.incrementFailed = function(count = 1) {
  this.entriesFailed += count;
  return this.save();
};

export const getArchivalMetadataModel = (companyDB) => {
  return companyDB.model('ArchivalMetadata', archivalMetadataSchema);
};

export default archivalMetadataSchema;
