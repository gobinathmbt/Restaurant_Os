import mongoose from 'mongoose';

/**
 * StockAdjustmentItem Sub-Schema
 * Represents individual items in a stock adjustment
 */
const stockAdjustmentItemSchema = new mongoose.Schema({
  inventoryItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem',
    required: true
  },
  batchNumber: {
    type: String,
    trim: true
  },
  currentQuantity: {
    type: Number,
    required: true
  },
  adjustedQuantity: {
    type: Number,
    required: true
  },
  quantityDelta: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: true,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  }
}, { _id: false });

/**
 * StockAdjustment Schema
 * Manages manual stock corrections for physical count discrepancies, damage, theft, expiry
 * Updated to support location-based architecture and multi-item adjustments
 */
const stockAdjustmentSchema = new mongoose.Schema({
  adjustmentNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  
  // Location reference (replaces branch)
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  
  // Legacy branch reference (for backward compatibility during migration)
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  },
  
  // Adjustment type
  adjustmentType: {
    type: String,
    required: true,
    enum: [
      'physical_count',    // Physical inventory count adjustment
      'damage',            // Damaged goods write-off
      'expiry',            // Expired goods write-off
      'theft',             // Theft/loss
      'found',             // Found stock (positive adjustment)
      'system_correction', // System error correction
      'other'
    ]
  },
  
  // Multiple items can be adjusted in a single adjustment
  items: {
    type: [stockAdjustmentItemSchema],
    required: true,
    validate: {
      validator: function(items) {
        return items && items.length > 0;
      },
      message: 'At least one item is required'
    }
  },
  
  // Approval workflow
  status: {
    type: String,
    required: true,
    enum: ['draft', 'pending_approval', 'approved', 'rejected'],
    default: 'draft'
  },
  
  // Audit trail - Creation
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  createdDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  // Audit trail - Approval
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId
  },
  approvedDate: {
    type: Date
  },
  
  // Audit trail - Rejection
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId
  },
  rejectedDate: {
    type: Date
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  
  // Documentation
  attachments: [{
    type: String,
    trim: true
  }],
  notes: {
    type: String,
    trim: true
  },
  
  // Stock count session reference (if created from count)
  stockCountSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StockCountSession'
  },
  
  // Soft delete
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for performance
stockAdjustmentSchema.index({ adjustmentNumber: 1 }, { unique: true });
stockAdjustmentSchema.index({ locationId: 1, status: 1 });
stockAdjustmentSchema.index({ status: 1, createdDate: -1 });
stockAdjustmentSchema.index({ createdDate: -1 });
stockAdjustmentSchema.index({ adjustmentType: 1 });
stockAdjustmentSchema.index({ stockCountSessionId: 1 });

// Legacy indexes for backward compatibility
stockAdjustmentSchema.index({ branch: 1, adjustmentDate: -1 });
stockAdjustmentSchema.index({ branch: 1, adjustmentNumber: 1 });

export const getStockAdjustmentModel = (companyDB) => {
  return companyDB.model('StockAdjustment', stockAdjustmentSchema);
};

export default stockAdjustmentSchema;
