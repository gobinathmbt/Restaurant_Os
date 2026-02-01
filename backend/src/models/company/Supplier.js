import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  branchIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  }],
  contactPerson: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  address: {
    street: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    zipCode: {
      type: String,
      trim: true
    },
    country: {
      type: String,
      trim: true
    }
  },
  gstNumber: {
    type: String,
    trim: true
  },
  panNumber: {
    type: String,
    trim: true
  },
  paymentTerms: {
    type: String,
    enum: ['immediate', 'net_7', 'net_15', 'net_30', 'net_60', 'custom'],
    default: 'immediate'
  },
  customPaymentTerms: {
    type: String,
    trim: true
  },
  creditLimit: {
    type: Number,
    default: 0,
    min: 0
  },
  currentBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  categories: [{
    type: String,
    trim: true
  }],
  bankDetails: {
    accountName: {
      type: String,
      trim: true
    },
    accountNumber: {
      type: String,
      trim: true
    },
    bankName: {
      type: String,
      trim: true
    },
    ifscCode: {
      type: String,
      trim: true
    },
    branch: {
      type: String,
      trim: true
    }
  },
  notes: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  performanceMetrics: {
    totalOrders: {
      type: Number,
      default: 0,
      min: 0
    },
    totalPurchaseValue: {
      type: Number,
      default: 0,
      min: 0
    },
    onTimeDeliveries: {
      type: Number,
      default: 0,
      min: 0
    },
    lateDeliveries: {
      type: Number,
      default: 0,
      min: 0
    },
    qualityIssues: {
      type: Number,
      default: 0,
      min: 0
    }
  }
}, {
  timestamps: true
});

// Virtual field: onTimeDeliveryRate (with division by zero protection)
supplierSchema.virtual('onTimeDeliveryRate').get(function() {
  const totalDeliveries = this.performanceMetrics.onTimeDeliveries + this.performanceMetrics.lateDeliveries;
  if (totalDeliveries === 0) {
    return 0;
  }
  return (this.performanceMetrics.onTimeDeliveries / totalDeliveries) * 100;
});

// Virtual field: averageOrderValue (with division by zero protection)
supplierSchema.virtual('averageOrderValue').get(function() {
  if (this.performanceMetrics.totalOrders === 0) {
    return 0;
  }
  return this.performanceMetrics.totalPurchaseValue / this.performanceMetrics.totalOrders;
});

// Ensure virtuals are included in JSON output
supplierSchema.set('toJSON', { virtuals: true });
supplierSchema.set('toObject', { virtuals: true });

// Indexes
supplierSchema.index({ name: 1 });
supplierSchema.index({ phone: 1 });
supplierSchema.index({ email: 1 });
supplierSchema.index({ isActive: 1 });
supplierSchema.index({ categories: 1 });
supplierSchema.index({ branchIds: 1 });
supplierSchema.index({ name: 'text', contactPerson: 'text' });

export const getSupplierModel = (companyDB) => {
  return companyDB.model('Supplier', supplierSchema);
};

export default supplierSchema;
