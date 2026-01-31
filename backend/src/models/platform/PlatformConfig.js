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
    enum: ['auth', 'payment', 'email', 'storage', 'api', 'system', 'sms', 'notification'],
    required: true,
  },
  isSecret: {
    type: Boolean,
    default: false, // If true, value should be masked in responses
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isEditable: {
    type: Boolean,
    default: true, // Some system configs should not be editable
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
// Authentication (category: 'auth')
// - JWT_SECRET (isSecret: true)
// - JWT_EXPIRE
// - GOOGLE_CLIENT_ID
// - GOOGLE_CLIENT_SECRET (isSecret: true)
// - GOOGLE_CALLBACK_URL

// Payment (category: 'payment')
// - RAZORPAY_KEY_ID
// - RAZORPAY_KEY_SECRET (isSecret: true)
// - CASHFREE_APP_ID
// - CASHFREE_SECRET_KEY (isSecret: true)

// Email (category: 'email')
// - SMTP_HOST
// - SMTP_PORT
// - SMTP_USER
// - SMTP_PASS (isSecret: true)
// - SMTP_FROM_EMAIL
// - SMTP_FROM_NAME

// Storage - AWS S3 (category: 'storage')
// - AWS_S3_BUCKET
// - AWS_S3_REGION
// - AWS_ACCESS_KEY_ID (isSecret: true)
// - AWS_SECRET_ACCESS_KEY (isSecret: true)
// - AWS_S3_URL

// SMS (category: 'sms')
// - SMS_PROVIDER (e.g., 'twilio', 'msg91')
// - SMS_API_KEY (isSecret: true)
// - SMS_SENDER_ID

// Notification (category: 'notification')
// - WHATSAPP_API_KEY (isSecret: true)
// - WHATSAPP_PHONE_NUMBER_ID
// - PUSH_NOTIFICATION_KEY (isSecret: true)

export default mongoose.model('PlatformConfig', platformConfigSchema);
