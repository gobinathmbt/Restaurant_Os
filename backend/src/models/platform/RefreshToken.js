import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CompanyUser',
    required: true,
  },
  token: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  isRevoked: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Add index on token for fast lookups
refreshTokenSchema.index({ token: 1 });

export default mongoose.model('RefreshToken', refreshTokenSchema);
