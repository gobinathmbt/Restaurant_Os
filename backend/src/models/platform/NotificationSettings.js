import mongoose from 'mongoose';

const notificationChannelSchema = new mongoose.Schema({
  email: {
    enabled: { type: Boolean, default: true },
    address: { type: String },
    verified: { type: Boolean, default: false }
  },
  whatsapp: {
    enabled: { type: Boolean, default: false },
    phoneNumber: { type: String },
    verified: { type: Boolean, default: false }
  },
  inApp: {
    enabled: { type: Boolean, default: true }
  },
  sms: {
    enabled: { type: Boolean, default: false },
    phoneNumber: { type: String },
    verified: { type: Boolean, default: false }
  }
}, { _id: false });

const notificationPreferencesSchema = new mongoose.Schema({
  // Company Registration Events
  companyRegistration: {
    enabled: { type: Boolean, default: true },
    channels: notificationChannelSchema
  },
  // Subscription Events
  subscriptionExpiring: {
    enabled: { type: Boolean, default: true },
    channels: notificationChannelSchema
  },
  subscriptionExpired: {
    enabled: { type: Boolean, default: true },
    channels: notificationChannelSchema
  },
  subscriptionRenewed: {
    enabled: { type: Boolean, default: true },
    channels: notificationChannelSchema
  },
  // Payment Events
  paymentReceived: {
    enabled: { type: Boolean, default: true },
    channels: notificationChannelSchema
  },
  paymentFailed: {
    enabled: { type: Boolean, default: true },
    channels: notificationChannelSchema
  },
  // System Events
  systemAlert: {
    enabled: { type: Boolean, default: true },
    channels: notificationChannelSchema
  },
  securityAlert: {
    enabled: { type: Boolean, default: true },
    channels: notificationChannelSchema
  }
}, { _id: false });

const platformAdminNotificationSettingsSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PlatformAdmin',
    required: true,
    unique: true
  },
  preferences: {
    type: notificationPreferencesSchema,
    default: () => ({})
  },
  quietHours: {
    enabled: { type: Boolean, default: false },
    start: { type: String }, // HH:mm format
    end: { type: String }, // HH:mm format
    timezone: { type: String, default: 'UTC' }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const companyNotificationPreferencesSchema = new mongoose.Schema({
  // Order Events
  newOrder: {
    enabled: { type: Boolean, default: true },
    channels: notificationChannelSchema
  },
  orderCompleted: {
    enabled: { type: Boolean, default: true },
    channels: notificationChannelSchema
  },
  orderCancelled: {
    enabled: { type: Boolean, default: true },
    channels: notificationChannelSchema
  },
  // Inventory Events
  lowStock: {
    enabled: { type: Boolean, default: true },
    channels: notificationChannelSchema
  },
  stockOut: {
    enabled: { type: Boolean, default: true },
    channels: notificationChannelSchema
  },
  // Staff Events
  staffCheckIn: {
    enabled: { type: Boolean, default: false },
    channels: notificationChannelSchema
  },
  staffCheckOut: {
    enabled: { type: Boolean, default: false },
    channels: notificationChannelSchema
  },
  leaveRequest: {
    enabled: { type: Boolean, default: true },
    channels: notificationChannelSchema
  },
  // Financial Events
  dailySalesReport: {
    enabled: { type: Boolean, default: true },
    channels: notificationChannelSchema
  },
  paymentReceived: {
    enabled: { type: Boolean, default: true },
    channels: notificationChannelSchema
  },
  // System Events
  systemAlert: {
    enabled: { type: Boolean, default: true },
    channels: notificationChannelSchema
  }
}, { _id: false });

const companyNotificationSettingsSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CompanyUser',
    required: true
  },
  isPrimaryAdmin: {
    type: Boolean,
    default: false
  },
  preferences: {
    type: companyNotificationPreferencesSchema,
    default: () => ({})
  },
  quietHours: {
    enabled: { type: Boolean, default: false },
    start: { type: String },
    end: { type: String },
    timezone: { type: String, default: 'UTC' }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes
platformAdminNotificationSettingsSchema.index({ adminId: 1 });
companyNotificationSettingsSchema.index({ companyId: 1, userId: 1 }, { unique: true });
companyNotificationSettingsSchema.index({ companyId: 1, isPrimaryAdmin: 1 });

// Update timestamp on save
platformAdminNotificationSettingsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

companyNotificationSettingsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const PlatformAdminNotificationSettings = mongoose.model(
  'PlatformAdminNotificationSettings',
  platformAdminNotificationSettingsSchema
);

const CompanyNotificationSettings = mongoose.model(
  'CompanyNotificationSettings',
  companyNotificationSettingsSchema
);

export {
  PlatformAdminNotificationSettings,
  CompanyNotificationSettings
};
