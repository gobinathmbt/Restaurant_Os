import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const companyUserSchema = new mongoose.Schema({
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
    select: false,
  },
  googleId: String,
  profilePicture: String,
  
  // Role (Company users only - NO platform_super_admin)
  role: {
    type: String,
    enum: ['company_super_admin_primary', 'company_super_admin_secondary', 'company_admin', 'employee'],
    required: true,
  },
  
  // Company Reference (REQUIRED for all company users)
  companyId: {
    type: String,
    ref: 'Company',
    required: true,
  },
  
  // Branch Access (for company_admin and employee)
  branchIds: [{
    type: String,
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
companyUserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
companyUserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Exclude password from JSON responses
companyUserSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

// Database Indexes for performance optimization
companyUserSchema.index({ email: 1 }, { unique: true }); // Primary login lookup
companyUserSchema.index({ googleId: 1 }, { sparse: true }); // Google OAuth lookup
companyUserSchema.index({ companyId: 1 }); // Company-based queries
companyUserSchema.index({ role: 1 }); // Role-based filtering
companyUserSchema.index({ isActive: 1 }); // Active users filter
companyUserSchema.index({ lastLogin: -1 }); // Sort by last login
companyUserSchema.index({ createdAt: -1 }); // Sort by creation date

// Compound indexes
companyUserSchema.index({ companyId: 1, role: 1 }); // Users by company and role
companyUserSchema.index({ companyId: 1, isActive: 1 }); // Active users per company
companyUserSchema.index({ companyId: 1, branchIds: 1 }); // Branch-based access
companyUserSchema.index({ email: 1, isActive: 1 }); // Login with active check

export default mongoose.model('CompanyUser', companyUserSchema);
