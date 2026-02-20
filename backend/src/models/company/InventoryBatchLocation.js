import mongoose from 'mongoose';

/**
 * InventoryBatchLocation Schema
 * Tracks inventory at the batch level for FIFO costing and expiry management
 * Critical for food industry compliance and accurate cost tracking
 */
const inventoryBatchLocationSchema = new mongoose.Schema({
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
  
  // Batch identification
  batchNumber: {
    type: String,
    required: true,
    trim: true
  },
  expiryDate: {
    type: Date
  },
  manufacturingDate: {
    type: Date
  },
  
  // Batch-specific quantities
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
  
  // Batch-specific costing
  unitCost: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Supplier and GRN reference
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  grnReference: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GRN'
  },
  
  // Batch status
  status: {
    type: String,
    required: true,
    enum: ['active', 'expired', 'damaged', 'recalled'],
    default: 'active'
  },
  
  // Soft delete
  isActive: {
    type: Boolean,
    default: true
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
inventoryBatchLocationSchema.virtual('totalQuantity').get(function() {
  return this.availableQuantity + this.reservedQuantity;
});

// Virtual field: isExpired
inventoryBatchLocationSchema.virtual('isExpired').get(function() {
  if (!this.expiryDate) return false;
  return new Date() > new Date(this.expiryDate);
});

// Virtual field: isExpiringSoon (within 7 days)
inventoryBatchLocationSchema.virtual('isExpiringSoon').get(function() {
  if (!this.expiryDate) return false;
  
  const today = new Date();
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  
  const expiryDate = new Date(this.expiryDate);
  return expiryDate >= today && expiryDate <= sevenDaysFromNow;
});

// Ensure virtuals are included in JSON output
inventoryBatchLocationSchema.set('toJSON', { virtuals: true });
inventoryBatchLocationSchema.set('toObject', { virtuals: true });

// Compound unique index: one batch per item per location per batch number
inventoryBatchLocationSchema.index({ locationId: 1, inventoryItem: 1, batchNumber: 1 }, { unique: true });

// Additional indexes for FIFO queries and expiry monitoring
inventoryBatchLocationSchema.index({ locationId: 1, inventoryItem: 1, expiryDate: 1 });
inventoryBatchLocationSchema.index({ locationId: 1, inventoryItem: 1, createdAt: 1 });
inventoryBatchLocationSchema.index({ expiryDate: 1, status: 1 });
inventoryBatchLocationSchema.index({ status: 1 });
inventoryBatchLocationSchema.index({ grnReference: 1 });
inventoryBatchLocationSchema.index({ supplier: 1 });

export const getInventoryBatchLocationModel = (companyDB) => {
  return companyDB.model('InventoryBatchLocation', inventoryBatchLocationSchema);
};

export default inventoryBatchLocationSchema;
