import notificationService from '../services/notificationService.js';
import { 
  PlatformAdminNotificationSettings, 
  CompanyNotificationSettings 
} from '../models/platform/NotificationSettings.js';
import { logger } from '../utils/logger.js';

class NotificationController {
  // Get notification settings
  async getSettings(req, res) {
    try {
      const { userId, userType, companyId } = req.user;

      let settings;
      if (userType === 'platform') {
        // Get from PLATFORM DB
        settings = await PlatformAdminNotificationSettings.findOne({ adminId: userId });
        
        if (!settings) {
          settings = await PlatformAdminNotificationSettings.create({ adminId: userId });
        }
      } else {
        // Get from COMPANY DB
        const { getCompanyDB } = await import('../config/database.js');
        const { getCompanyNotificationSettingsModel } = await import('../models/company/NotificationSettings.js');
        
        const companyDB = getCompanyDB(companyId);
        const CompanyNotificationSettings = getCompanyNotificationSettingsModel(companyDB);
        
        settings = await CompanyNotificationSettings.findOne({ userId });

        if (!settings) {
          settings = await CompanyNotificationSettings.create({ userId });
        }
      }

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      logger.error('Error getting notification settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notification settings',
        error: error.message
      });
    }
  }

  // Update notification settings
  async updateSettings(req, res) {
    try {
      const { userId, userType, companyId } = req.user;
      const updates = req.body;

      let settings;
      if (userType === 'platform') {
        // Update in PLATFORM DB
        settings = await PlatformAdminNotificationSettings.findOneAndUpdate(
          { adminId: userId },
          { $set: updates },
          { new: true, upsert: true }
        );
      } else {
        // Update in COMPANY DB
        const { getCompanyDB } = await import('../config/database.js');
        const { getCompanyNotificationSettingsModel } = await import('../models/company/NotificationSettings.js');
        
        const companyDB = getCompanyDB(companyId);
        const CompanyNotificationSettings = getCompanyNotificationSettingsModel(companyDB);
        
        settings = await CompanyNotificationSettings.findOneAndUpdate(
          { userId },
          { $set: updates },
          { new: true, upsert: true }
        );
      }

      res.json({
        success: true,
        data: settings,
        message: 'Notification settings updated successfully'
      });
    } catch (error) {
      logger.error('Error updating notification settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update notification settings',
        error: error.message
      });
    }
  }

  // Update specific event preference
  async updateEventPreference(req, res) {
    try {
      const { event } = req.params;
      const { userId, userType, companyId } = req.user;
      const { enabled, channels } = req.body;

      const updateData = {};
      if (enabled !== undefined) {
        updateData[`preferences.${event}.enabled`] = enabled;
      }
      if (channels) {
        updateData[`preferences.${event}.channels`] = channels;
      }

      let settings;
      if (userType === 'platform') {
        // Update in PLATFORM DB
        settings = await PlatformAdminNotificationSettings.findOneAndUpdate(
          { adminId: userId },
          { $set: updateData },
          { new: true, upsert: true }
        );
      } else {
        // Update in COMPANY DB
        const { getCompanyDB } = await import('../config/database.js');
        const { getCompanyNotificationSettingsModel } = await import('../models/company/NotificationSettings.js');
        
        const companyDB = getCompanyDB(companyId);
        const CompanyNotificationSettings = getCompanyNotificationSettingsModel(companyDB);
        
        settings = await CompanyNotificationSettings.findOneAndUpdate(
          { userId },
          { $set: updateData },
          { new: true, upsert: true }
        );
      }

      res.json({
        success: true,
        data: settings,
        message: 'Event preference updated successfully'
      });
    } catch (error) {
      logger.error('Error updating event preference:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update event preference',
        error: error.message
      });
    }
  }

  // Test notification
  async testNotification(req, res) {
    try {
      const { userId, userType, companyId } = req.user;

      const notificationData = {
        category: 'system',
        event: 'systemAlert',
        title: 'Test Notification',
        message: 'This is a test notification to verify your notification settings.',
        priority: 'low'
      };

      let notification;
      if (userType === 'platform') {
        notification = await notificationService.sendToPlatformAdmin(userId, notificationData);
      } else {
        notification = await notificationService.sendToCompanyUser(companyId, userId, notificationData);
      }

      res.json({
        success: true,
        data: notification,
        message: 'Test notification sent successfully'
      });
    } catch (error) {
      logger.error('Error sending test notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send test notification',
        error: error.message
      });
    }
  }
}

export default new NotificationController();
