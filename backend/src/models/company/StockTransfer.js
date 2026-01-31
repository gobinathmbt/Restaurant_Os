import mongoose from 'mongoose';

const stockTransferSchema = new mongoose.Schema({
  transferNumber: {
    type: String,
    required: true,
    trim: true
  },
  fromBranch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  toBranch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  items: [{
    inventoryItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    unit: {
      type: String,
      required: true
    }
  }],
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  requestDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId
  },
  approvedDate: {
    type: Date
  },
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
  completedDate: {
    type: Date
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'approved', 'rejected', 'completed', 'cancelled'],
    default: 'pending'
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes
stockTransferSchema.index({ fromBranch: 1, status: 1 });
stockTransferSchema.index({ toBranch: 1, status: 1 });
stockTransferSchema.index({ requestDate: -1 });
stockTransferSchema.index({ status: 1 });
stockTransferSchema.index({ transferNumber: 1 });

export const getStockTransferModel = (companyDB) => {
  return companyDB.model('StockTransfer', stockTransferSchema);
};

export default stockTransferSchema;
