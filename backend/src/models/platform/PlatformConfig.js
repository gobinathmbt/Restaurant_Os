import mongoose from 'mongoose';

const platformConfigSchema = new mongoose.Schema({
  configKey: {
    type: String,
    required: true,
    unique: true,
  },
  configValue: mongoose.Schema.Types.Mixed,
  description: String,
  category: {
    type: String,
    enum: ['auth', 'payment', 'email', 'storage', 'api', 'system'],
    required: true,
  },
  isSecret: {
    type: Boolean,
    default: false, // If true, value should be encrypted
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PlatformAdmin',
  },
}, {
  timestamps: true,
});

// Database Indexes for performance optimization
platformConfigSchema.index({ configKey: 1 }, { unique: true }); // Primary lookup
platformConfigSchema.index({ category: 1 }); // Category-based queries
platformConfigSchema.index({ isActive: 1 }); // Active configs filter
platformConfigSchema.index({ isSecret: 1 }); // Secret configs filter
platformConfigSchema.index({ updatedAt: -1 }); // Recently modified configs

// Compound indexes
platformConfigSchema.index({ category: 1, isActive: 1 }); // Active configs by category
platformConfigSchema.index({ isActive: 1, isSecret: 1 }); // Active secret configs

// Example configuration keys stored in this collection:
// - JWT_SECRET (category: 'auth', isSecret: true)
// - JWT_EXPIRE (category: 'auth')
// - GOOGLE_CLIENT_ID (category: 'auth')
// - GOOGLE_CLIENT_SECRET (category: 'auth', isSecret: true)
// - GOOGLE_CALLBACK_URL (category: 'auth')
// - RAZORPAY_KEY_ID (category: 'payment')
// - RAZORPAY_KEY_SECRET (category: 'payment', isSecret: true)
// - SMTP_HOST (category: 'email')
// - SMTP_PORT (category: 'email')
// - SMTP_USER (category: 'email')
// - SMTP_PASSWORD (category: 'email', isSecret: true)
// - AWS_S3_BUCKET (category: 'storage')
// - AWS_ACCESS_KEY_ID (category: 'storage', isSecret: true)
// - AWS_SECRET_ACCESS_KEY (category: 'storage', isSecret: true)

export default mongoose.model('PlatformConfig', platformConfigSchema);
