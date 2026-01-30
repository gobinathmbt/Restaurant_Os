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

// Database Indexes for performance optimization
refreshTokenSchema.index({ token: 1 }, { unique: true }); // Primary token lookup
refreshTokenSchema.index({ userId: 1 }); // User-based queries
refreshTokenSchema.index({ expiresAt: 1 }); // Expiration-based cleanup
refreshTokenSchema.index({ isRevoked: 1 }); // Revoked tokens filter
refreshTokenSchema.index({ createdAt: 1 }); // Creation date for cleanup

// Compound indexes
refreshTokenSchema.index({ userId: 1, isRevoked: 1 }); // Active tokens per user
refreshTokenSchema.index({ expiresAt: 1, isRevoked: 1 }); // Cleanup expired/revoked tokens

// TTL Index - Automatically delete expired tokens after 30 days
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days

export default mongoose.model('RefreshToken', refreshTokenSchema);
