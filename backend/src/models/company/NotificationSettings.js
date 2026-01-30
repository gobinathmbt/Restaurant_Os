import mongoose from 'mongoose';

/**
 * Company User Notification Settings Model
 * Stored in company-specific database
 */

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
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
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
companyNotificationSettingsSchema.index({ userId: 1 });
companyNotificationSettingsSchema.index({ isPrimaryAdmin: 1 });

// Update timestamp on save
companyNotificationSettingsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

/**
 * Get model for specific company database
 * @param {mongoose.Connection} companyConnection - Company database connection
 * @returns {mongoose.Model} NotificationSettings model for company
 */
export const getCompanyNotificationSettingsModel = (companyConnection) => {
  if (companyConnection.models.NotificationSettings) {
    return companyConnection.models.NotificationSettings;
  }
  return companyConnection.model('NotificationSettings', companyNotificationSettingsSchema);
};

export default companyNotificationSettingsSchema;
