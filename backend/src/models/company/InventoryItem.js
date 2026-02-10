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
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
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

export const getInventoryItemModel = (companyDB) => {
  return companyDB.model('InventoryItem', inventoryItemSchema);
};

export default inventoryItemSchema;
