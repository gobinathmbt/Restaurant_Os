import mongoose from 'mongoose';

/**
 * StockTransferItem Sub-Schema
 * Represents individual items in a stock transfer
 */
const stockTransferItemSchema = new mongoose.Schema({
  inventoryItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem',
    required: true
  },
  // Partial fulfillment support
  requestedQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  sentQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  backorderedQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  receivedQuantity: {
    type: Number,
    min: 0
  },
  unit: {
    type: String,
    required: true
  },
  notes: {
    type: String,
    trim: true
  },
  // Batch cost tracking for transfer cost migration
  batchCosts: [{
    sourceBatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryBatchLocation'
    },
    quantity: Number,
    unitCost: Number,
    totalCost: Number
  }],
  totalCost: {
    type: Number,
    min: 0
  }
}, { _id: false });

/**
 * StockTransfer Schema
 * Manages stock movements between locations with push/request model
 * Updated to support location-based architecture
 */
const stockTransferSchema = new mongoose.Schema({
  transferNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  
  // Location references (replaces branch references)
  fromLocation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  toLocation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  
  // Legacy branch references (for backward compatibility during migration)
  fromBranch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  },
  toBranch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  },
  
  // Transfer type: push (source-initiated) or request (destination-initiated)
  transferType: {
    type: String,
    required: true,
    enum: ['push', 'request'],
    default: 'push'
  },
  
  // Items being transferred
  items: {
    type: [stockTransferItemSchema],
    required: true,
    validate: {
      validator: function(items) {
        return items && items.length > 0;
      },
      message: 'At least one item is required'
    }
  },
  
  // State machine: pending → approved → completed/returned
  status: {
    type: String,
    required: true,
    enum: ['pending', 'approved', 'rejected', 'completed', 'cancelled', 'returned'],
    default: 'pending'
  },
  
  // Audit trail - Request/Creation
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  requestDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true
  },
  
  // Audit trail - Approval
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId
  },
  approvedDate: {
    type: Date
  },
  
  // Audit trail - Completion
  completedBy: {
    type: mongoose.Schema.Types.ObjectId
  },
  completedDate: {
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
  
  // Audit trail - Cancellation
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId
  },
  cancelledDate: {
    type: Date
  },
  cancellationReason: {
    type: String,
    trim: true
  },
  
  // Audit trail - Return
  returnedBy: {
    type: mongoose.Schema.Types.ObjectId
  },
  returnedDate: {
    type: Date
  },
  returnReason: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for performance
stockTransferSchema.index({ transferNumber: 1 }, { unique: true });
stockTransferSchema.index({ fromLocation: 1, status: 1 });
stockTransferSchema.index({ toLocation: 1, status: 1 });
stockTransferSchema.index({ status: 1, requestDate: -1 });
stockTransferSchema.index({ fromLocation: 1, toLocation: 1, status: 1 });
stockTransferSchema.index({ transferType: 1 });

// Legacy indexes for backward compatibility
stockTransferSchema.index({ fromBranch: 1, status: 1 });
stockTransferSchema.index({ toBranch: 1, status: 1 });
stockTransferSchema.index({ requestDate: -1 });

export const getStockTransferModel = (companyDB) => {
  return companyDB.model('StockTransfer', stockTransferSchema);
};

export default stockTransferSchema;
