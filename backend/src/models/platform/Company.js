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
  
  // Primary Admin (Company Super Admin) - References CompanyUser
  primaryAdmin: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompanyUser',
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

// Database Indexes for performance optimization
companySchema.index({ companyId: 1 }, { unique: true }); // Primary lookup
companySchema.index({ email: 1 }, { unique: true }); // Email lookup
companySchema.index({ 'subscription.status': 1 }); // Filter by subscription status
companySchema.index({ isActive: 1 }); // Filter active companies
companySchema.index({ 'subscription.nextBillingDate': 1 }); // Billing queries
companySchema.index({ createdAt: -1 }); // Sort by creation date
companySchema.index({ companyName: 'text' }); // Text search on company name

// Compound indexes
companySchema.index({ isActive: 1, 'subscription.status': 1 }); // Active companies by subscription
companySchema.index({ 'subscription.status': 1, 'subscription.nextBillingDate': 1 }); // Billing management

export default mongoose.model('Company', companySchema);
