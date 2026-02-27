import mongoose from 'mongoose';

/**
 * StockBackorder Schema
 * Tracks unfulfilled quantities from partial transfer approvals
 * Enables warehouse operations to send available stock immediately and backorder the rest
 */
const stockBackorderSchema = new mongoose.Schema({
  // Company isolation for future-proofing
  companyId: {
    type: String,
    required: true,
    index: true
  },
  
  // Reference to original transfer that was partially fulfilled
  originalTransferId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StockTransfer',
    required: true
  },
  
  // Reference to original stock request (new workflow)
  originalRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StockRequest',
    index: true
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
  
  // Item being backordered
  inventoryItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem',
    required: true
  },
  
  // Backorder quantity
  backorderedQuantity: {
    type: Number,
    required: true,
    min: 0.000001
  },
  
  // Partial fulfillment tracking (future enhancement)
  fulfilledQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  
  unit: {
    type: String,
    required: true
  },
  
  // Backorder status
  status: {
    type: String,
    required: true,
    enum: ['pending', 'fulfilled', 'cancelled'],
    default: 'pending'
  },
  
  // Fulfillment tracking
  fulfilledTransferId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StockTransfer'
  },
  fulfilledDate: {
    type: Date
  },
  fulfilledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CompanyUser'
  },
  fulfilledIpAddress: {
    type: String
  },
  fulfilledDeviceInfo: {
    type: String
  },
  
  // Cancellation tracking
  cancelledDate: {
    type: Date
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CompanyUser'
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
  
  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CompanyUser',
    required: true
  },
  createdIpAddress: {
    type: String
  },
  createdDeviceInfo: {
    type: String
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual field for aging calculation (computed on-the-fly)
stockBackorderSchema.virtual('ageInDays').get(function() {
  if (!this.createdAt) return 0;
  return Math.floor((Date.now() - this.createdAt.getTime()) / 86400000);
});

// Indexes for performance
stockBackorderSchema.index({ companyId: 1, status: 1 });
stockBackorderSchema.index({ destinationLocation: 1, status: 1 });
stockBackorderSchema.index({ sourceLocation: 1, status: 1 });
stockBackorderSchema.index({ inventoryItem: 1, status: 1 });
stockBackorderSchema.index({ originalTransferId: 1 });
stockBackorderSchema.index({ originalRequestId: 1 });
stockBackorderSchema.index({ status: 1, createdAt: -1 });
stockBackorderSchema.index({ destinationLocation: 1, inventoryItem: 1, status: 1 });
stockBackorderSchema.index({ sourceLocation: 1, inventoryItem: 1, status: 1 });

// Compound indexes including companyId for future-proofing (DB merge scenarios)
stockBackorderSchema.index({ companyId: 1, status: 1, createdAt: -1 });
stockBackorderSchema.index({ companyId: 1, destinationLocation: 1, status: 1 });
stockBackorderSchema.index({ companyId: 1, sourceLocation: 1, status: 1 });
stockBackorderSchema.index({ companyId: 1, inventoryItem: 1, status: 1 });

// Unique constraint to prevent duplicate backorders for same item in same transfer
stockBackorderSchema.index({ 
  originalTransferId: 1, 
  inventoryItem: 1, 
  status: 1 
}, { 
  unique: true,
  partialFilterExpression: { status: 'pending' }
});

// Pending backorder queries optimization
stockBackorderSchema.index({ status: 1, destinationLocation: 1, createdAt: -1 });
stockBackorderSchema.index({ status: 1, sourceLocation: 1, createdAt: -1 });

export const getStockBackorderModel = (companyDB) => {
  return companyDB.model('StockBackorder', stockBackorderSchema);
};

export default stockBackorderSchema;
