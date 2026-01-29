import mongoose from 'mongoose';

const companySchema = new mongoose.Schema({
  companyId: {
    type: String,
    required: true,
    unique: true,
  },
  companyName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone: String,
  address: String,
  gstNumber: String,
  fssaiLicense: String,
  
  // Database Information
  databaseName: {
    type: String,
    required: true,
  },
  databaseConnectionString: String,
  
  // Subscription Details
  subscription: {
    status: {
      type: String,
      enum: ['trial', 'active', 'grace_period', 'suspended', 'expired'],
      default: 'trial',
    },
    plan: {
      type: String,
      default: 'monthly', // ₹3,999/month
    },
    trialStartDate: Date,
    trialEndDate: Date,
    trialUsed: {
      type: Boolean,
      default: false,
    },
    subscriptionStartDate: Date,
    nextBillingDate: Date,
    autoRenewal: {
      type: Boolean,
      default: false,
    },
  },
  
  // Primary Admin (Company Super Admin)
  primaryAdmin: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    name: String,
    email: String,
  },
  
  // Modules Enabled
  modules: {
    billing: { type: Boolean, default: true },
    inventory: { type: Boolean, default: true },
    crm: { type: Boolean, default: false },
    integrations: { type: Boolean, default: false },
    loyalty: { type: Boolean, default: false },
    analytics: { type: Boolean, default: true },
    staffManagement: { type: Boolean, default: true },
    kds: { type: Boolean, default: false },
  },
  
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Indexes for performance
companySchema.index({ companyId: 1 });
companySchema.index({ email: 1 });
companySchema.index({ 'subscription.status': 1 });

// Validation for subscription status transitions
companySchema.pre('save', function(next) {
  if (this.isModified('subscription.status')) {
    const validTransitions = {
      trial: ['active', 'expired'],
      active: ['grace_period', 'suspended'],
      grace_period: ['active', 'suspended'],
      suspended: ['active', 'expired'],
      expired: ['active'],
    };
    
    const currentStatus = this.subscription.status;
    const previousStatus = this._original?.subscription?.status;
    
    // Allow initial status or valid transitions
    if (!previousStatus || validTransitions[previousStatus]?.includes(currentStatus)) {
      next();
    } else {
      next(new Error(`Invalid subscription status transition from ${previousStatus} to ${currentStatus}`));
    }
  } else {
    next();
  }
});

// Store original document for validation
companySchema.pre('save', function(next) {
  if (!this.isNew) {
    this._original = this.constructor.findOne({ _id: this._id }).lean();
  }
  next();
});

export default mongoose.model('Company', companySchema);
