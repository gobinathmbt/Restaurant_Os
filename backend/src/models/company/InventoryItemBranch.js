import mongoose from 'mongoose';

/**
 * InventoryItemBranch Schema
 * Stores branch-specific configuration for inventory items
 * Similar to MenuItemBranch but for inventory management
 */
const inventoryItemBranchSchema = new mongoose.Schema({
  inventoryItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem',
    required: true
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  
  // Stock Management
  currentStock: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
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
  
  // Pricing
  costPrice: {
    type: Number,
    min: 0
  },
  lastPurchasePrice: {
    type: Number,
    min: 0
  },
  lastPurchaseDate: {
    type: Date
  },
  
  // Supplier (can vary by branch)
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  
  // Storage Location (branch-specific)
  storageLocation: {
    type: String,
    trim: true
  },
  
  // Batch Information
  batchNumber: {
    type: String,
    trim: true
  },
  expiryDate: {
    type: Date
  },
  
  // Branch-specific identifiers
  branchSKU: {
    type: String,
    trim: true
  },
  branchBarcode: {
    type: String,
    trim: true
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  
  // Notes
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Virtual field: isLowStock
inventoryItemBranchSchema.virtual('isLowStock').get(function() {
  return this.currentStock <= this.minimumStock;
});

// Virtual field: isExpiringSoon (within 7 days)
inventoryItemBranchSchema.virtual('isExpiringSoon').get(function() {
  if (!this.expiryDate) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  
  const expiryDate = new Date(this.expiryDate);
  expiryDate.setHours(0, 0, 0, 0);
  
  return expiryDate >= today && expiryDate <= sevenDaysFromNow;
});

// Virtual field: stockPercentage
inventoryItemBranchSchema.virtual('stockPercentage').get(function() {
  if (!this.maximumStock || this.maximumStock === 0) return null;
  return (this.currentStock / this.maximumStock) * 100;
});

// Ensure virtuals are included in JSON output
inventoryItemBranchSchema.set('toJSON', { virtuals: true });
inventoryItemBranchSchema.set('toObject', { virtuals: true });

// Compound unique index: one config per inventory item per branch
inventoryItemBranchSchema.index({ inventoryItem: 1, branch: 1 }, { unique: true });

// Additional indexes for queries
inventoryItemBranchSchema.index({ branch: 1, isActive: 1 });
inventoryItemBranchSchema.index({ branch: 1, currentStock: 1 });
inventoryItemBranchSchema.index({ branch: 1, isAvailable: 1 });
inventoryItemBranchSchema.index({ supplier: 1 });
inventoryItemBranchSchema.index({ expiryDate: 1 });
inventoryItemBranchSchema.index({ branchSKU: 1 }, { sparse: true });
inventoryItemBranchSchema.index({ branchBarcode: 1 }, { sparse: true });

export const getInventoryItemBranchModel = (companyDB) => {
  return companyDB.model('InventoryItemBranch', inventoryItemBranchSchema);
};

export default inventoryItemBranchSchema;
