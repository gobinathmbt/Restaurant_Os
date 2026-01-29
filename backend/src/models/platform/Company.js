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

export default mongoose.model('Company', companySchema);
