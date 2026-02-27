import mongoose from 'mongoose';

/**
 * StockRequestItem Sub-Schema
 * Represents individual items in a stock request
 */
const stockRequestItemSchema = new mongoose.Schema({
  inventoryItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem',
    required: true
  },
  requestedQuantity: {
    type: Number,
    required: true,
    min: 0.000001 // Must be greater than zero
  },
  approvedQuantity: {
    type: Number,
    min: 0,
    default: 0
  },
  backorderedQuantity: {
    type: Number,
    min: 0,
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
  // Cost snapshot at approval time for historical accuracy
  averageUnitCostAtApproval: {
    type: Number,
    min: 0
  }
}, { _id: false });

/**
 * StockRequest Schema
 * Manages stock request and approval workflow for 5000+ branches
 * Separates request creation (Branch Admin) from approval (Super Admin/Warehouse Admin)
 */
const stockRequestSchema = new mongoose.Schema({
  // Company identifier for multi-tenant support
  companyId: {
    type: String,
    required: true,
    index: true
  },
  
  requestNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  
  // Location references
  destinationLocation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  sourceLocation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  
  // Request priority for operational management
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
    index: true
  },
  
  // Expected delivery date (calculated based on priority)
  expectedDeliveryDate: {
    type: Date
  },
  
  // Items being requested
  items: {
    type: [stockRequestItemSchema],
    required: true,
    validate: {
      validator: function(items) {
        return items && items.length > 0;
      },
      message: 'At least one item is required'
    }
  },
  
  // State machine: pending → approved/rejected/cancelled
  status: {
    type: String,
    required: true,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending',
    index: true
  },
  
  // Optimistic locking for concurrency control
  version: {
    type: Number,
    default: 0
  },
  
  // Audit trail - Request creation
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  requestDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  requestIpAddress: {
    type: String
  },
  requestDeviceInfo: {
    type: String
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
  approvedIpAddress: {
    type: String
  },
  approvedDeviceInfo: {
    type: String
  },
  approvalNotes: {
    type: String,
    trim: true
  },
  
  // Audit trail - Rejection
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId
  },
  rejectedDate: {
    type: Date
  },
  rejectedIpAddress: {
    type: String
  },
  rejectedDeviceInfo: {
    type: String
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
  cancelledIpAddress: {
    type: String
  },
  cancelledDeviceInfo: {
    type: String
  },
  cancellationReason: {
    type: String,
    trim: true
  },
  
  // Link to created transfer (after approval)
  createdTransferId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StockTransfer'
  },
  
  // Soft delete for compliance
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

// Performance indexes for 5000+ branches
// Unique index for request number lookup
stockRequestSchema.index({ requestNumber: 1 }, { unique: true });

// Compound indexes for common query patterns
stockRequestSchema.index({ status: 1, requestDate: -1 });
stockRequestSchema.index({ destinationLocation: 1, status: 1 });
stockRequestSchema.index({ sourceLocation: 1, status: 1 });
stockRequestSchema.index({ status: 1, priority: 1, requestDate: -1 });
stockRequestSchema.index({ requestedBy: 1, status: 1 });

// Partial indexes excluding archived records for operational queries
stockRequestSchema.index(
  { status: 1, requestDate: -1 },
  { partialFilterExpression: { isArchived: false } }
);
stockRequestSchema.index(
  { sourceLocation: 1, status: 1 },
  { partialFilterExpression: { isArchived: false, status: 'pending' } }
);
stockRequestSchema.index(
  { destinationLocation: 1, status: 1 },
  { partialFilterExpression: { isArchived: false } }
);

// Dashboard and operational queries
stockRequestSchema.index({ status: 1, priority: 1, requestDate: -1 });
stockRequestSchema.index({ status: 1, expectedDeliveryDate: 1 });
stockRequestSchema.index({ status: 1, requestDate: -1 });

// Archive queries
stockRequestSchema.index({ isArchived: 1, archivedAt: -1 });

// Export model factory function following existing pattern
export const getStockRequestModel = (companyDB) => {
  return companyDB.model('StockRequest', stockRequestSchema);
};

export default stockRequestSchema;
