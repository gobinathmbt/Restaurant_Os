import mongoose from 'mongoose';

const inventoryItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['raw_material', 'finished_good']
  },
  branchIds: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch'
    }],
    required: true,
    validate: {
      validator: function(v) {
        return Array.isArray(v) && v.length > 0;
      },
      message: 'At least one branch must be assigned'
    }
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
  currentStock: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  minimumStock: {
    type: Number,
    required: true,
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
  lastPurchaseDate: {
    type: Date
  },
  lastPurchasePrice: {
    type: Number,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Virtual field: isLowStock
inventoryItemSchema.virtual('isLowStock').get(function() {
  return this.currentStock <= this.minimumStock;
});

// Virtual field: isExpiringSoon (within 7 days)
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
inventoryItemSchema.index({ branchIds: 1, name: 1 });
inventoryItemSchema.index({ branchIds: 1, type: 1 });
inventoryItemSchema.index({ branchIds: 1, currentStock: 1 });
inventoryItemSchema.index({ category: 1 });
inventoryItemSchema.index({ subcategory: 1 });
inventoryItemSchema.index({ expiryDate: 1 });
inventoryItemSchema.index({ sku: 1 }, { unique: true, sparse: true });
inventoryItemSchema.index({ barcode: 1 }, { unique: true, sparse: true });
inventoryItemSchema.index({ isActive: 1 });

export const getInventoryItemModel = (companyDB) => {
  return companyDB.model('InventoryItem', inventoryItemSchema);
};

export default inventoryItemSchema;
