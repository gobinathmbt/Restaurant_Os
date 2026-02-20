import mongoose from 'mongoose';

/**
 * InventoryLedger Schema
 * Immutable audit trail of all inventory quantity changes
 * Critical for compliance, financial audits, and traceability
 */
const inventoryLedgerSchema = new mongoose.Schema({
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
  }
}, {
  timestamps: true
});

// Prevent updates and deletes (immutable ledger)
inventoryLedgerSchema.pre('findOneAndUpdate', function(next) {
  next(new Error('Inventory ledger entries are immutable and cannot be updated'));
});

inventoryLedgerSchema.pre('findOneAndDelete', function(next) {
  next(new Error('Inventory ledger entries are immutable and cannot be deleted'));
});

inventoryLedgerSchema.pre('deleteOne', function(next) {
  next(new Error('Inventory ledger entries are immutable and cannot be deleted'));
});

inventoryLedgerSchema.pre('deleteMany', function(next) {
  next(new Error('Inventory ledger entries are immutable and cannot be deleted'));
});

// Indexes for ledger queries
inventoryLedgerSchema.index({ locationId: 1, inventoryItem: 1, createdAt: -1 });
inventoryLedgerSchema.index({ referenceType: 1, referenceId: 1 });
inventoryLedgerSchema.index({ movementType: 1, createdAt: -1 });
inventoryLedgerSchema.index({ createdAt: -1 });
inventoryLedgerSchema.index({ performedBy: 1, createdAt: -1 });
inventoryLedgerSchema.index({ locationId: 1, createdAt: -1 });
inventoryLedgerSchema.index({ inventoryItem: 1, createdAt: -1 });
inventoryLedgerSchema.index({ batchNumber: 1, createdAt: -1 });
inventoryLedgerSchema.index({ correlationId: 1 });

export const getInventoryLedgerModel = (companyDB) => {
  return companyDB.model('InventoryLedger', inventoryLedgerSchema);
};

export default inventoryLedgerSchema;
