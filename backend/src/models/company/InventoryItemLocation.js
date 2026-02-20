import mongoose from 'mongoose';

/**
 * InventoryItemLocation Schema
 * Tracks inventory for each item at each location with three-state quantity tracking
 * Replaces InventoryItemBranch with location-based approach
 */
const inventoryItemLocationSchema = new mongoose.Schema({
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
  
  // Three-state quantity tracking (aggregated from batches)
  availableQuantity: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  reservedQuantity: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  inTransitQuantity: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  
  // Inventory management thresholds
  minimumStock: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  maximumStock: {
    type: Number,
    min: 0
  },
  reorderPoint: {
    type: Number,
    min: 0
  },
  
  // Costing strategy
  costingMethod: {
    type: String,
    required: true,
    enum: ['FIFO', 'WEIGHTED_AVERAGE', 'STANDARD_COST'],
    default: 'FIFO'
  },
  standardCost: {
    type: Number,
    min: 0
  },
  
  // Pricing and supplier
  lastPurchasePrice: {
    type: Number,
    min: 0
  },
  lastPurchaseDate: {
    type: Date
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  
  // Storage details
  storageLocation: {
    type: String,
    trim: true
  },
  
  // Negative inventory tracking
  negativeInventoryFlags: {
    isNegative: {
      type: Boolean,
      default: false
    },
    negativeSince: {
      type: Date
    },
    negativeQuantity: {
      type: Number,
      default: 0
    }
  },
  
  // Soft delete
  isActive: {
    type: Boolean,
    default: true
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  
  // Optimistic locking for concurrency control
  version: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Virtual field: totalQuantity
inventoryItemLocationSchema.virtual('totalQuantity').get(function() {
  return this.availableQuantity + this.reservedQuantity + this.inTransitQuantity;
});

// Virtual field: isLowStock
inventoryItemLocationSchema.virtual('isLowStock').get(function() {
  return this.availableQuantity <= this.minimumStock;
});

// Ensure virtuals are included in JSON output
inventoryItemLocationSchema.set('toJSON', { virtuals: true });
inventoryItemLocationSchema.set('toObject', { virtuals: true });

// Compound unique index: one record per inventory item per location
inventoryItemLocationSchema.index({ locationId: 1, inventoryItem: 1 }, { unique: true });

// Additional indexes for performance
inventoryItemLocationSchema.index({ inventoryItem: 1, locationId: 1 });
inventoryItemLocationSchema.index({ locationId: 1, isActive: 1 });
inventoryItemLocationSchema.index({ inventoryItem: 1, isActive: 1 });
inventoryItemLocationSchema.index({ supplier: 1 });
inventoryItemLocationSchema.index({ costingMethod: 1 });

export const getInventoryItemLocationModel = (companyDB) => {
  return companyDB.model('InventoryItemLocation', inventoryItemLocationSchema);
};

export default inventoryItemLocationSchema;
