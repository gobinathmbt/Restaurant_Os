import mongoose from 'mongoose';

/**
 * StockBackorder Schema
 * Tracks unfulfilled quantities from partial transfer approvals
 * Enables realistic warehouse operations at scale
 */
const stockBackorderSchema = new mongoose.Schema({
  // Reference to original transfer
  originalTransferId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StockTransfer',
    required: true
  },
  
  // Location references
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
  
  // Backorder details
  inventoryItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem',
    required: true
  },
  backorderedQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true
  },
  
  // Status
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
    type: mongoose.Schema.Types.ObjectId
  },
  
  // Cancellation tracking
  cancelledDate: {
    type: Date
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId
  },
  cancellationReason: {
    type: String,
    trim: true
  },
  
  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  createdDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for performance
stockBackorderSchema.index({ fromLocation: 1, status: 1 });
stockBackorderSchema.index({ toLocation: 1, status: 1 });
stockBackorderSchema.index({ inventoryItem: 1, status: 1 });
stockBackorderSchema.index({ originalTransferId: 1 });
stockBackorderSchema.index({ fulfilledTransferId: 1 });
stockBackorderSchema.index({ status: 1, createdDate: -1 });

export const getStockBackorderModel = (companyDB) => {
  return companyDB.model('StockBackorder', stockBackorderSchema);
};

export default stockBackorderSchema;
