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
    min: 0.000001 // Must be greater than zero
  },
  sentQuantity: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function() {
        return this.sentQuantity <= this.requestedQuantity;
      },
      message: 'Sent quantity cannot exceed requested quantity'
    }
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
  // Discrepancy tracking for shrinkage/damage analysis
  discrepancyQuantity: {
    type: Number,
    default: 0
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
  },
  // Cost snapshot at approval for historical accuracy
  averageUnitCostAtApproval: {
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
  
  // Company isolation for future-proofing and cross-company reporting
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
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
    ref: 'Location'
  },
  toBranch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  },
  
  // Transfer type: push (source-initiated) or request (destination-initiated)
  transferType: {
    type: String,
    required: true,
    enum: ['push', 'request'],
    default: 'push'
  },
  
  // Link to original stock request (for request-approval workflow)
  originalRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StockRequest',
    index: true
  },
  
  // System-generated flag for auto-created transfers (e.g., backorder fulfillment)
  systemGenerated: {
    type: Boolean,
    default: false
  },
  
  // Transfer priority for operational management
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
    index: true
  },
  
  // Expected delivery date for SLA tracking
  expectedDeliveryDate: {
    type: Date
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
  
  // State machine: approved → in_transit → completed/cancelled/returned
  // Note: 'pending' status removed - transfers now start at 'approved' (created from approved requests)
  // Legacy 'pending' status kept for backward compatibility with existing data
  status: {
    type: String,
    required: true,
    enum: ['pending', 'approved', 'in_transit', 'rejected', 'completed', 'cancelled', 'returned'],
    default: 'approved'
  },
  
  // Optimistic locking for concurrency control
  version: {
    type: Number,
    default: 0
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
  
  // Audit trail - Shipment (Warehouse Admin marks as shipped)
  shippedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CompanyUser'
  },
  shippedDate: {
    type: Date
  },
  shippedIpAddress: {
    type: String
  },
  shippedDeviceInfo: {
    type: String
  },
  
  // Audit trail - Receipt (Branch Admin marks as received)
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CompanyUser'
  },
  receivedDate: {
    type: Date
  },
  receivedIpAddress: {
    type: String
  },
  receivedDeviceInfo: {
    type: String
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
  },
  
  // Compliance tracking for enterprise audit requirements
  approvedIpAddress: {
    type: String
  },
  approvedDeviceInfo: {
    type: String
  },
  completedIpAddress: {
    type: String
  },
  completedDeviceInfo: {
    type: String
  },
  
  // Soft delete support for compliance
  isArchived: {
    type: Boolean,
    default: false,
    index: true
  },
  archivedAt: {
    type: Date
  },
  archivedBy: {
    type: mongoose.Schema.Types.ObjectId
  }
}, {
  timestamps: true
});

// Indexes for performance
stockTransferSchema.index({ transferNumber: 1 }, { unique: true });
stockTransferSchema.index({ companyId: 1, status: 1 });
stockTransferSchema.index({ fromLocation: 1, status: 1 });
stockTransferSchema.index({ toLocation: 1, status: 1 });
stockTransferSchema.index({ status: 1, requestDate: -1 });
stockTransferSchema.index({ fromLocation: 1, toLocation: 1, status: 1 });
stockTransferSchema.index({ transferType: 1 });
stockTransferSchema.index({ originalRequestId: 1 }); // Link to stock request

// Compound indexes including companyId for future-proofing (DB merge scenarios)
// Partial indexes to exclude archived records from operational queries
stockTransferSchema.index(
  { companyId: 1, status: 1, requestDate: -1 },
  { partialFilterExpression: { isArchived: false } }
);
stockTransferSchema.index(
  { companyId: 1, fromLocation: 1, status: 1 },
  { partialFilterExpression: { isArchived: false } }
);
stockTransferSchema.index(
  { companyId: 1, toLocation: 1, status: 1 },
  { partialFilterExpression: { isArchived: false } }
);
stockTransferSchema.index(
  { companyId: 1, status: 1, priority: 1, requestDate: -1 },
  { partialFilterExpression: { isArchived: false } }
);

// Dashboard and operational queries
stockTransferSchema.index({ status: 1, fromLocation: 1, requestDate: -1 });
stockTransferSchema.index({ status: 1, toLocation: 1, requestDate: -1 });
stockTransferSchema.index({ status: 1, priority: 1, requestDate: -1 });
stockTransferSchema.index({ status: 1, approvedBy: 1 });

// Archive queries
stockTransferSchema.index({ isArchived: 1, archivedAt: -1 });

// Legacy indexes for backward compatibility
stockTransferSchema.index({ fromBranch: 1, status: 1 });
stockTransferSchema.index({ toBranch: 1, status: 1 });
stockTransferSchema.index({ requestDate: -1 });

export const getStockTransferModel = (companyDB) => {
  return companyDB.model('StockTransfer', stockTransferSchema);
};

export default stockTransferSchema;
