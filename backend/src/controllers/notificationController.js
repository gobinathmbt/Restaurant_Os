import notificationService from '../services/notificationService.js';
import { 
  PlatformAdminNotificationSettings, 
  CompanyNotificationSettings 
} from '../models/platform/NotificationSettings.js';
import { logger } from '../utils/logger.js';

class NotificationController {
  // Get notifications
  async getNotifications(req, res) {
    try {
      const { page, limit, unreadOnly, category } = req.query;
      const { userId, role, companyId } = req.user;
      const isPlatformAdmin = role === 'platform_admin';

      const result = await notificationService.getNotifications(userId, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        unreadOnly: unreadOnly === 'true',
        category,
        companyId,
        isPlatformAdmin
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error getting notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notifications',
        error: error.message
      });
    }
  }

  // Get unread count
  async getUnreadCount(req, res) {
    try {
      const { userId, role, companyId } = req.user;
      const isPlatformAdmin = role === 'platform_admin';

      const count = await notificationService.getUnreadCount(
        userId,
        companyId,
        isPlatformAdmin
      );

      res.json({
        success: true,
        data: { count }
      });
    } catch (error) {
      logger.error('Error getting unread count:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get unread count',
        error: error.message
      });
    }
  }

  // Mark notification as read
  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const { userId, role, companyId } = req.user;
      const isPlatformAdmin = role === 'platform_admin';

      const notification = await notificationService.markAsRead(
        id,
        userId,
        companyId,
        isPlatformAdmin
      );

      res.json({
        success: true,
        data: notification
      });
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read',
        error: error.message
      });
    }
  }

  // Mark all as read
  async markAllAsRead(req, res) {
    try {
      const { userId, role, companyId } = req.user;
      const isPlatformAdmin = role === 'platform_admin';

      const result = await notificationService.markAllAsRead(
        userId,
        companyId,
        isPlatformAdmin
      );

      res.json({
        success: true,
        data: { modifiedCount: result.modifiedCount }
      });
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark all notifications as read',
        error: error.message
      });
    }
  }

  // Delete notification
  async deleteNotification(req, res) {
    try {
      const { id } = req.params;
      const { userId, role, companyId } = req.user;
      const isPlatformAdmin = role === 'platform_admin';

      await notificationService.deleteNotification(
        id,
        userId,
        companyId,
        isPlatformAdmin
      );

      res.json({
        success: true,
        message: 'Notification deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete notification',
        error: error.message
      });
    }
  }

  // Get notification settings
  async getSettings(req, res) {
    try {
      const { userId, role, companyId } = req.user;

      let settings;
      if (role === 'platform_admin') {
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
      const { userId, role, companyId } = req.user;
      const updates = req.body;

      let settings;
      if (role === 'platform_admin') {
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
      const { userId, role, companyId } = req.user;
      const { enabled, channels } = req.body;

      const updateData = {};
      if (enabled !== undefined) {
        updateData[`preferences.${event}.enabled`] = enabled;
      }
      if (channels) {
        updateData[`preferences.${event}.channels`] = channels;
      }

      let settings;
      if (role === 'platform_admin') {
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
      const { userId, role, companyId } = req.user;

      const notificationData = {
        category: 'system',
        event: 'systemAlert',
        title: 'Test Notification',
        message: 'This is a test notification to verify your notification settings.',
        priority: 'low'
      };

      let notification;
      if (role === 'platform_admin') {
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
