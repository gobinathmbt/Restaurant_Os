import mongoose from 'mongoose';

/**
 * InventoryItem Schema
 * Stores global inventory item properties
 * Branch-specific data (stock, pricing, supplier) is stored in InventoryItemBranch
 */
const inventoryItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  type: {
    type: String,
    required: true,
    enum: ['raw_material', 'finished_good']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  subcategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  unit: {
    type: String,
    required: true,
    enum: ['kg', 'gram', 'liter', 'ml', 'piece', 'dozen', 'packet']
  },
  
  // Global identifiers (optional, can be overridden per branch)
  sku: {
    type: String,
    trim: true,
    sparse: true,
    unique: true
  },
  barcode: {
    type: String,
    trim: true,
    sparse: true,
    unique: true
  },
  
  // Description and notes
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  
  // Legacy fields for backward compatibility
  // These are kept for existing data but new items use InventoryItemBranch
  branchIds: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch'
    }],
    default: []
  },
  currentStock: {
    type: Number,
    default: 0,
    min: 0
  },
  minimumStock: {
    type: Number,
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
  costPrice: {
    type: Number,
    min: 0
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  expiryDate: {
    type: Date
  },
  batchNumber: {
    type: String,
    trim: true
  },
  lastPurchaseDate: {
    type: Date
  },
  lastPurchasePrice: {
    type: Number,
    min: 0
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Virtual field: isLowStock (for legacy data)
inventoryItemSchema.virtual('isLowStock').get(function() {
  return this.currentStock <= this.minimumStock;
});

// Virtual field: isExpiringSoon (within 7 days, for legacy data)
inventoryItemSchema.virtual('isExpiringSoon').get(function() {
  if (!this.expiryDate) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  
  const expiryDate = new Date(this.expiryDate);
  expiryDate.setHours(0, 0, 0, 0);
  
  return expiryDate >= today && expiryDate <= sevenDaysFromNow;
});

// Ensure virtuals are included in JSON output
inventoryItemSchema.set('toJSON', { virtuals: true });
inventoryItemSchema.set('toObject', { virtuals: true });

// Indexes
inventoryItemSchema.index({ name: 1 });
inventoryItemSchema.index({ type: 1 });
inventoryItemSchema.index({ category: 1 });
inventoryItemSchema.index({ subcategory: 1 });
inventoryItemSchema.index({ sku: 1 }, { unique: true, sparse: true });
inventoryItemSchema.index({ barcode: 1 }, { unique: true, sparse: true });
inventoryItemSchema.index({ isActive: 1 });
// Legacy indexes for backward compatibility
inventoryItemSchema.index({ branchIds: 1, name: 1 });
inventoryItemSchema.index({ branchIds: 1, type: 1 });
inventoryItemSchema.index({ category: 1, branchIds: 1 });
inventoryItemSchema.index({ subcategory: 1, branchIds: 1 });

export const getInventoryItemModel = (companyDB) => {
  return companyDB.model('InventoryItem', inventoryItemSchema);
};

export default inventoryItemSchema;
