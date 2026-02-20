import mongoose from 'mongoose';

/**
 * StockCountItem Sub-Schema
 * Represents individual items in a stock count session
 */
const stockCountItemSchema = new mongoose.Schema({
  inventoryItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem',
    required: true
  },
  batchNumber: {
    type: String,
    trim: true
  },
  systemQuantity: {
    type: Number,
    required: true
  },
  countedQuantity: {
    type: Number
  },
  variance: {
    type: Number
  },
  countedBy: {
    type: mongoose.Schema.Types.ObjectId
  },
  countedDate: {
    type: Date
  },
  notes: {
    type: String,
    trim: true
  }
}, { _id: false });

/**
 * StockCountSession Schema
 * Manages structured physical stock counts with blind counting and variance analysis
 * Critical for inventory reconciliation and accuracy
 */
const stockCountSessionSchema = new mongoose.Schema({
  sessionNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  
  // Count type
  countType: {
    type: String,
    required: true,
    enum: ['cycle_count', 'full_count'],
    default: 'cycle_count'
  },
  
  // Items to count
  items: {
    type: [stockCountItemSchema],
    required: true,
    validate: {
      validator: function(items) {
        return items && items.length > 0;
      },
      message: 'At least one item is required'
    }
  },
  
  // Status
  status: {
    type: String,
    required: true,
    enum: ['draft', 'in_progress', 'completed', 'approved', 'rejected'],
    default: 'draft'
  },
  
  // Blind counting mode (hide system quantity from counters)
  blindCount: {
    type: Boolean,
    default: false
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
  
  // Audit trail - Start
  startedBy: {
    type: mongoose.Schema.Types.ObjectId
  },
  startedDate: {
    type: Date
  },
  
  // Audit trail - Completion
  completedBy: {
    type: mongoose.Schema.Types.ObjectId
  },
  completedDate: {
    type: Date
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
  
  // Variance summary
  totalVarianceValue: {
    type: Number,
    default: 0
  },
  
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for performance
stockCountSessionSchema.index({ sessionNumber: 1 }, { unique: true });
stockCountSessionSchema.index({ locationId: 1, status: 1 });
stockCountSessionSchema.index({ status: 1, createdDate: -1 });
stockCountSessionSchema.index({ countType: 1 });

export const getStockCountSessionModel = (companyDB) => {
  return companyDB.model('StockCountSession', stockCountSessionSchema);
};

export default stockCountSessionSchema;
