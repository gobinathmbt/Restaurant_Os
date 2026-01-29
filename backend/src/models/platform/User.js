import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// This model is used ONLY during company registration to create the primary admin
// After registration, all company users are stored in their respective company databases
const userSchema = new mongoose.Schema({
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
  
  // Google OAuth
  googleId: String,
  profilePicture: String,
  
  // Role
  role: {
    type: String,
    enum: ['company_super_admin_primary'],
    required: true,
  },
  
  // Company Reference
  companyId: {
    type: String,
    ref: 'Company',
    required: true,
  },
  
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Index on email for fast lookups
userSchema.index({ email: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
