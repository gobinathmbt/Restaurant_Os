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


export default mongoose.model('PlatformConfig', platformConfigSchema);
