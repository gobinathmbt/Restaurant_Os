import mongoose from 'mongoose';

/**
 * Company Notification Model
 * Stored in company-specific database
 */
const companyNotificationSchema = new mongoose.Schema({
  recipientType: {
    type: String,
    enum: ['company_user'],
    required: true,
    default: 'company_user'
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User' // References User in company DB
  },
  category: {
    type: String,
    enum: [
      'order',
      'inventory',
      'staff',
      'financial',
      'system',
      'security'
    ],
    required: true
  },
  event: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  channels: {
    inApp: {
      sent: { type: Boolean, default: false },
      sentAt: { type: Date },
      read: { type: Boolean, default: false },
      readAt: { type: Date }
    },
    email: {
      sent: { type: Boolean, default: false },
      sentAt: { type: Date },
      error: { type: String }
    },
    whatsapp: {
      sent: { type: Boolean, default: false },
      sentAt: { type: Date },
      error: { type: String }
    },
    sms: {
      sent: { type: Boolean, default: false },
      sentAt: { type: Date },
      error: { type: String }
    }
  },
  actionUrl: {
    type: String
  },
  expiresAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
companyNotificationSchema.index({ recipientId: 1, createdAt: -1 });
companyNotificationSchema.index({ recipientId: 1, 'channels.inApp.read': 1 });
companyNotificationSchema.index({ category: 1, createdAt: -1 });
companyNotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Mark notification as read
companyNotificationSchema.methods.markAsRead = async function() {
  this.channels.inApp.read = true;
  this.channels.inApp.readAt = new Date();
  return this.save();
};

// Check if notification is expired
companyNotificationSchema.methods.isExpired = function() {
  return this.expiresAt && this.expiresAt < new Date();
};

/**
 * Get model for specific company database
 * @param {mongoose.Connection} companyConnection - Company database connection
 * @returns {mongoose.Model} Notification model for company
 */
export const getCompanyNotificationModel = (companyConnection) => {
  if (companyConnection.models.Notification) {
    return companyConnection.models.Notification;
  }
  return companyConnection.model('Notification', companyNotificationSchema);
};

export default companyNotificationSchema;
