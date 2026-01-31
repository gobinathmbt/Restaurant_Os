import mongoose from 'mongoose';

const grnSchema = new mongoose.Schema({
  grnNumber: {
    type: String,
    required: true,
    trim: true
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  purchaseOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder'
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
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0
    },
    batchNumber: {
      type: String,
      trim: true
    },
    expiryDate: {
      type: Date
    }
  }],
  totalAmount: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  receivedDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  status: {
    type: String,
    required: true,
    enum: ['received', 'verified', 'cancelled'],
    default: 'received'
  },
  notes: {
    type: String,
    trim: true
  },
  invoiceNumber: {
    type: String,
    trim: true
  },
  invoiceDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Pre-save hook to calculate totalAmount from items
grnSchema.pre('save', function(next) {
  if (this.items && this.items.length > 0) {
    this.totalAmount = this.items.reduce((sum, item) => {
      // Calculate totalPrice for each item if not already set
      if (!item.totalPrice || item.totalPrice === 0) {
        item.totalPrice = item.quantity * item.unitPrice;
      }
      return sum + item.totalPrice;
    }, 0);
  }
  next();
});

// Indexes
grnSchema.index({ branch: 1, grnNumber: 1 }, { unique: true });
grnSchema.index({ supplier: 1 });
grnSchema.index({ receivedDate: 1 });
grnSchema.index({ status: 1 });
grnSchema.index({ branch: 1, receivedDate: -1 });

export const getGRNModel = (companyDB) => {
  return companyDB.model('GRN', grnSchema);
};

export default grnSchema;
