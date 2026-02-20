import mongoose from 'mongoose';

/**
 * InventoryLedgerArchive Schema
 * Archive collection for old ledger entries (older than retention period)
 * Maintains performance as data grows (36M+ entries/year)
 * Same schema as InventoryLedger for consistency
 */
const inventoryLedgerArchiveSchema = new mongoose.Schema({
  inventoryItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem',
    required: true
  },
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  batchNumber: {
    type: String,
    trim: true
  },
  
  // Movement details
  movementType: {
    type: String,
    required: true,
    enum: [
      'grn',
      'transfer_out',
      'transfer_in',
      'return_in',
      'return_out',
      'adjustment',
      'reservation',
      'release',
      'consumption',
      'damage',
      'expiry',
      'theft'
    ]
  },
  
  // Quantity change
  quantityDelta: {
    type: Number,
    required: true
  },
  
  // State before and after
  beforeAvailable: {
    type: Number,
    required: true
  },
  afterAvailable: {
    type: Number,
    required: true
  },
  beforeReserved: {
    type: Number,
    required: true
  },
  afterReserved: {
    type: Number,
    required: true
  },
  beforeInTransit: {
    type: Number,
    required: true
  },
  afterInTransit: {
    type: Number,
    required: true
  },
  
  // Reference to source document
  referenceType: {
    type: String,
    required: true,
    enum: ['GRN', 'TRANSFER', 'ADJUSTMENT', 'RESERVATION', 'ORDER', 'STOCK_COUNT']
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  referenceNumber: {
    type: String,
    trim: true
  },
  
  // Costing information
  unitCost: {
    type: Number,
    min: 0
  },
  totalValue: {
    type: Number
  },
  
  // Audit trail
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  reason: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  
  // Correlation ID
  correlationId: {
    type: String,
    trim: true
  },
  
  // Archive metadata
  archivedDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  originalCreatedAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: false // Use originalCreatedAt instead
});

// Prevent updates and deletes (immutable archive)
inventoryLedgerArchiveSchema.pre('findOneAndUpdate', function(next) {
  next(new Error('Archived ledger entries are immutable and cannot be updated'));
});

inventoryLedgerArchiveSchema.pre('findOneAndDelete', function(next) {
  next(new Error('Archived ledger entries cannot be deleted'));
});

// Same indexes as InventoryLedger for consistent query performance
inventoryLedgerArchiveSchema.index({ locationId: 1, inventoryItem: 1, originalCreatedAt: -1 });
inventoryLedgerArchiveSchema.index({ referenceType: 1, referenceId: 1 });
inventoryLedgerArchiveSchema.index({ movementType: 1, originalCreatedAt: -1 });
inventoryLedgerArchiveSchema.index({ originalCreatedAt: -1 });
inventoryLedgerArchiveSchema.index({ performedBy: 1, originalCreatedAt: -1 });
inventoryLedgerArchiveSchema.index({ archivedDate: 1 });

export const getInventoryLedgerArchiveModel = (companyDB) => {
  return companyDB.model('InventoryLedgerArchive', inventoryLedgerArchiveSchema);
};

export default inventoryLedgerArchiveSchema;
