import mongoose from 'mongoose';
import crypto from 'crypto';

const environmentConfigSchema = new mongoose.Schema({
  // Reference to Platform Admin Primary user
  platformAdminPrimaryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PlatformAdmin',
    required: true,
  },
  
  // Environment configurations
  configs: {
    // Server configs
    PORT: {
      type: Number,
      default: 5000,
    },
    NODE_ENV: {
      type: String,
      enum: ['development', 'production', 'staging'],
      default: 'development',
    },
    
    // Database configs
    PLATFORM_DB_URI: {
      type: String,
      required: true,
    },
    COMPANY_DB_BASE_URI: {
      type: String,
      required: true,
    },
    
    // JWT configs (encrypted)
    JWT_SECRET: {
      type: String,
      required: true,
      select: false, // Don't return by default
    },
    JWT_EXPIRE: {
      type: String,
      default: '7d',
    },
    
    // Google OAuth (encrypted)
    GOOGLE_CLIENT_ID: {
      type: String,
      select: false,
    },
    GOOGLE_CLIENT_SECRET: {
      type: String,
      select: false,
    },
    GOOGLE_CALLBACK_URL: {
      type: String,
    },
    
    // Frontend URL
    FRONTEND_URL: {
      type: String,
      default: 'http://localhost:5173',
    },
    
    // Additional custom configs
    customConfigs: {
      type: Map,
      of: String,
    },
  },
  
  // Audit trail
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PlatformAdmin',
  },
  lastModifiedAt: Date,
  
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Helper function to encrypt sensitive data
function encrypt(text) {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Helper function to decrypt sensitive data
function decrypt(text) {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encrypted = parts.join(':');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Encrypt sensitive fields before saving
environmentConfigSchema.pre('save', function(next) {
  if (this.isModified('configs.JWT_SECRET') && this.configs.JWT_SECRET) {
    // Only encrypt if not already encrypted (doesn't contain ':')
    if (!this.configs.JWT_SECRET.includes(':')) {
      this.configs.JWT_SECRET = encrypt(this.configs.JWT_SECRET);
    }
  }
  if (this.isModified('configs.GOOGLE_CLIENT_SECRET') && this.configs.GOOGLE_CLIENT_SECRET) {
    // Only encrypt if not already encrypted (doesn't contain ':')
    if (!this.configs.GOOGLE_CLIENT_SECRET.includes(':')) {
      this.configs.GOOGLE_CLIENT_SECRET = encrypt(this.configs.GOOGLE_CLIENT_SECRET);
    }
  }
  this.lastModifiedAt = new Date();
  next();
});

// Method to get decrypted config
environmentConfigSchema.methods.getDecryptedConfig = function(configKey) {
  const value = this.configs[configKey];
  if (!value) return value;
  
  if (['JWT_SECRET', 'GOOGLE_CLIENT_SECRET'].includes(configKey)) {
    return decrypt(value);
  }
  return value;
};

export default mongoose.model('EnvironmentConfig', environmentConfigSchema);
