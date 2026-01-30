import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const platformAdminSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    select: false,
  },
  role: {
    type: String,
    default: 'platform_super_admin',
    immutable: true,
  },
  platformAdminPrimary: {
    type: Boolean,
    default: false,
  },
  permissions: [{
    type: String,
    enum: ['manage_companies', 'manage_subscriptions', 'manage_platform_config', 'view_analytics', 'manage_admins'],
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
  lastLogin: Date,
}, {
  timestamps: true,
});

// Hash password before saving
platformAdminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
platformAdminSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Exclude password from JSON responses
platformAdminSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

// Database Indexes for performance optimization
platformAdminSchema.index({ email: 1 }, { unique: true }); // Primary login lookup
platformAdminSchema.index({ platformAdminPrimary: 1 }); // Filter primary admins
platformAdminSchema.index({ isActive: 1 }); // Active admins filter
platformAdminSchema.index({ permissions: 1 }); // Permission-based queries
platformAdminSchema.index({ lastLogin: -1 }); // Sort by last login
platformAdminSchema.index({ createdAt: -1 }); // Sort by creation date

// Compound indexes
platformAdminSchema.index({ isActive: 1, platformAdminPrimary: 1 }); // Active primary admins
platformAdminSchema.index({ email: 1, isActive: 1 }); // Login with active check

export default mongoose.model('PlatformAdmin', platformAdminSchema);
