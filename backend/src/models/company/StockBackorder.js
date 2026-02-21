import mongoose from 'mongoose';

/**
 * StockBackorder Schema
 * Tracks unfulfilled quantities from partial transfer approvals
 * Enables warehouse operations to send available stock immediately and backorder the rest
 */
const stockBackorderSchema = new mongoose.Schema({
  // Reference to original transfer that was partially fulfilled
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
stockBackorderSchema.index({ status: 1, createdAt: -1 });
stockBackorderSchema.index({ fromLocation: 1, inventoryItem: 1, status: 1 });
stockBackorderSchema.index({ toLocation: 1, inventoryItem: 1, status: 1 });

export const getStockBackorderModel = (companyDB) => {
  return companyDB.model('StockBackorder', stockBackorderSchema);
};

export default stockBackorderSchema;
