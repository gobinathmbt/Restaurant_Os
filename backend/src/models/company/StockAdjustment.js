import mongoose from 'mongoose';

const stockAdjustmentSchema = new mongoose.Schema({
  adjustmentNumber: {
    type: String,
    required: true,
    trim: true
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  inventoryItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem',
    required: true
  },
  adjustmentType: {
    type: String,
    required: true,
    enum: ['increase', 'decrease', 'correction']
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  previousStock: {
    type: Number,
    required: true,
    min: 0
  },
  newStock: {
    type: Number,
    required: true,
    min: 0
  },
  reason: {
    type: String,
    required: true,
    enum: ['damaged', 'expired', 'theft', 'wastage', 'count_correction', 'other']
  },
  notes: {
    type: String,
    trim: true
  },
  adjustedBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  adjustmentDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId
  },
  approvedDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
stockAdjustmentSchema.index({ branch: 1, adjustmentDate: -1 });
stockAdjustmentSchema.index({ inventoryItem: 1 });
stockAdjustmentSchema.index({ adjustmentType: 1 });
stockAdjustmentSchema.index({ reason: 1 });
stockAdjustmentSchema.index({ branch: 1, adjustmentNumber: 1 });

export const getStockAdjustmentModel = (companyDB) => {
  return companyDB.model('StockAdjustment', stockAdjustmentSchema);
};

export default stockAdjustmentSchema;
