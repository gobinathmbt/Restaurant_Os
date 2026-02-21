import mongoose from 'mongoose';

/**
 * InventoryLedgerArchive Schema
 * Archive collection for old inventory ledger entries
 * Same schema as InventoryLedger for seamless archival and retrieval
 * Entries older than retention period (default: 2 years) are moved here
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
      'grn',              // Goods receipt from supplier
      'transfer_out',     // Stock sent to another location
      'transfer_in',      // Stock received from another location
      'return_in',        // Returned stock received back
      'return_out',       // Stock returned to source
      'adjustment',       // Manual stock adjustment
      'reservation',      // Stock reserved for order
      'release',          // Reservation released
      'consumption',      // Reserved stock consumed
      'damage',           // Stock damaged/written off
      'expiry',           // Stock expired
      'theft'             // Stock theft/loss
    ]
  },
  
  // Quantity change (can be positive or negative)
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
  
  // Correlation ID for tracking related operations
  correlationId: {
    type: String,
    trim: true
  },
  
  // Archive metadata
  archivedAt: {
    type: Date,
    default: Date.now
  },
  originalCreatedAt: {
    type: Date,
    required: true
  },
  originalUpdatedAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: false  // We preserve original timestamps
});

// Prevent updates and deletes (immutable archive)
inventoryLedgerArchiveSchema.pre('findOneAndUpdate', function(next) {
  next(new Error('Archived inventory ledger entries are immutable and cannot be updated'));
});

inventoryLedgerArchiveSchema.pre('findOneAndDelete', function(next) {
  next(new Error('Archived inventory ledger entries cannot be deleted'));
});

inventoryLedgerArchiveSchema.pre('deleteOne', function(next) {
  next(new Error('Archived inventory ledger entries cannot be deleted'));
});

inventoryLedgerArchiveSchema.pre('deleteMany', function(next) {
  next(new Error('Archived inventory ledger entries cannot be deleted'));
});

// Same indexes as InventoryLedger for consistent query performance
inventoryLedgerArchiveSchema.index({ locationId: 1, inventoryItem: 1, originalCreatedAt: -1 });
inventoryLedgerArchiveSchema.index({ referenceType: 1, referenceId: 1 });
inventoryLedgerArchiveSchema.index({ movementType: 1, originalCreatedAt: -1 });
inventoryLedgerArchiveSchema.index({ originalCreatedAt: -1 });
inventoryLedgerArchiveSchema.index({ performedBy: 1, originalCreatedAt: -1 });
inventoryLedgerArchiveSchema.index({ locationId: 1, originalCreatedAt: -1 });
inventoryLedgerArchiveSchema.index({ inventoryItem: 1, originalCreatedAt: -1 });
inventoryLedgerArchiveSchema.index({ batchNumber: 1, originalCreatedAt: -1 });
inventoryLedgerArchiveSchema.index({ correlationId: 1 });
inventoryLedgerArchiveSchema.index({ archivedAt: 1 });

export const getInventoryLedgerArchiveModel = (companyDB) => {
  return companyDB.model('InventoryLedgerArchive', inventoryLedgerArchiveSchema);
};

export default inventoryLedgerArchiveSchema;
