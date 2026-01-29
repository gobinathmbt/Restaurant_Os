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

export default mongoose.model('CompanyUser', companyUserSchema);
