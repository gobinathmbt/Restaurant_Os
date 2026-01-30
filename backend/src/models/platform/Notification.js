import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['platform_admin', 'company'],
    required: true
  },
  recipientType: {
    type: String,
    enum: ['platform_admin', 'company_user'],
    required: true
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'recipientModel'
  },
  recipientModel: {
    type: String,
    enum: ['PlatformAdmin', 'CompanyUser'],
    required: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  },
  category: {
    type: String,
    enum: [
      'company_registration',
      'subscription',
      'payment',
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
notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, 'channels.inApp.read': 1 });
notificationSchema.index({ companyId: 1, createdAt: -1 });
notificationSchema.index({ type: 1, category: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Mark notification as read
notificationSchema.methods.markAsRead = async function() {
  this.channels.inApp.read = true;
  this.channels.inApp.readAt = new Date();
  return this.save();
};

// Check if notification is expired
notificationSchema.methods.isExpired = function() {
  return this.expiresAt && this.expiresAt < new Date();
};

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
