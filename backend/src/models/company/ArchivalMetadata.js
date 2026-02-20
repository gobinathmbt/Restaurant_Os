import mongoose from 'mongoose';

/**
 * ArchivalMetadata Schema
 * Tracks archival operations for ledger entries
 * Provides audit trail for archival process
 */
const archivalMetadataSchema = new mongoose.Schema({
  // Archival operation details
  archivalType: {
    type: String,
    required: true,
    enum: ['LEDGER_ENTRIES'],
    default: 'LEDGER_ENTRIES'
  },
  
  // Date range archived
  periodStart: {
    type: Date,
    required: true
  },
  periodEnd: {
    type: Date,
    required: true
  },
  
  // Statistics
  entriesArchived: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Status
  status: {
    type: String,
    required: true,
    enum: ['in_progress', 'completed', 'failed'],
    default: 'in_progress'
  },
  
  // Error information (if failed)
  errorMessage: {
    type: String,
    trim: true
  },
  
  // Audit trail
  startedBy: {
    type: mongoose.Schema.Types.ObjectId
  },
  startedDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  completedDate: {
    type: Date
  },
  
  // Duration
  durationMs: {
    type: Number
  },
  
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for performance
archivalMetadataSchema.index({ archivalType: 1, status: 1 });
archivalMetadataSchema.index({ periodStart: 1, periodEnd: 1 });
archivalMetadataSchema.index({ startedDate: -1 });
archivalMetadataSchema.index({ status: 1, startedDate: -1 });

export const getArchivalMetadataModel = (companyDB) => {
  return companyDB.model('ArchivalMetadata', archivalMetadataSchema);
};

export default archivalMetadataSchema;
