import Notification from '../models/platform/Notification.js';
import { 
  PlatformAdminNotificationSettings, 
  CompanyNotificationSettings 
} from '../models/platform/NotificationSettings.js';
import { getCompanyNotificationModel } from '../models/company/Notification.js';
import { getCompanyNotificationSettingsModel } from '../models/company/NotificationSettings.js';
import { getCompanyDB } from '../config/database.js';
import socketManager from '../config/socket.js';
import emailService from './emailService.js';
import whatsappService from './whatsappService.js';
import smsService from './smsService.js';
import { logger } from '../utils/logger.js';

class NotificationService {
  /**
   * Send notification to platform admin
   * Stored in PLATFORM DATABASE
   */
  async sendToPlatformAdmin(adminId, notificationData) {
    try {
      const {
        category,
        event,
        title,
        message,
        data = {},
        priority = 'medium',
        actionUrl,
        expiresAt,
        companyId
      } = notificationData;

      // Get admin notification settings from PLATFORM DB
      const settings = await PlatformAdminNotificationSettings.findOne({ adminId });

      // Check if this event type is enabled
      if (settings && settings.preferences[event]?.enabled === false) {
        logger.info(`Notification skipped for admin ${adminId}: ${event} is disabled`);
        return null;
      }

      // Check quiet hours
      if (this.isInQuietHours(settings?.quietHours)) {
        logger.info(`Notification delayed for admin ${adminId}: quiet hours active`);
      }

      // Create notification record in PLATFORM DB
      const notification = await Notification.create({
        type: 'platform_admin',
        recipientType: 'platform_admin',
        recipientId: adminId,
        companyId,
        category,
        event,
        title,
        message,
        data,
        priority,
        actionUrl,
        expiresAt
      });

      // Get enabled channels for this event
      const channels = settings?.preferences[event]?.channels || {
        inApp: { enabled: true },
        email: { enabled: true },
        whatsapp: { enabled: false },
        sms: { enabled: false }
      };

      // Send through enabled channels
      await this.sendThroughChannels(notification, channels, {
        recipientEmail: channels.email?.address,
        recipientPhone: channels.whatsapp?.phoneNumber || channels.sms?.phoneNumber
      });

      // Emit socket event for in-app notification
      if (channels.inApp?.enabled !== false) {
        socketManager.emitToPlatformAdmin(adminId, 'notification', {
          id: notification._id,
          category,
          event,
          title,
          message,
          data,
          priority,
          actionUrl,
          createdAt: notification.createdAt
        });
        
        notification.channels.inApp.sent = true;
        notification.channels.inApp.sentAt = new Date();
        await notification.save();
      }

      logger.info(`Notification sent to platform admin ${adminId}: ${event}`);
      return notification;
    } catch (error) {
      logger.error('Error sending notification to platform admin:', error);
      throw error;
    }
  }

  /**
   * Send notification to all platform admins
   */
  async sendToAllPlatformAdmins(notificationData) {
    try {
      const { default: PlatformAdmin } = await import('../models/platform/PlatformAdmin.js');
      const admins = await PlatformAdmin.find({ isActive: true });

      const notifications = await Promise.allSettled(
        admins.map(admin => this.sendToPlatformAdmin(admin._id, notificationData))
      );

      logger.info(`Notification sent to ${admins.length} platform admins`);
      return notifications;
    } catch (error) {
      logger.error('Error sending notification to all platform admins:', error);
      throw error;
    }
  }

  /**
   * Send notification to company user
   * Stored in COMPANY-SPECIFIC DATABASE
   */
  async sendToCompanyUser(companyId, userId, notificationData) {
    try {
      const {
        category,
        event,
        title,
        message,
        data = {},
        priority = 'medium',
        actionUrl,
        expiresAt
      } = notificationData;

      // Get company database connection
      const companyDB = getCompanyDB(companyId);
      const CompanyNotification = getCompanyNotificationModel(companyDB);
      const CompanyNotificationSettings = getCompanyNotificationSettingsModel(companyDB);

      // Get user notification settings from COMPANY DB
      const settings = await CompanyNotificationSettings.findOne({ userId });

      // Check if this event type is enabled
      if (settings && settings.preferences[event]?.enabled === false) {
        logger.info(`Notification skipped for user ${userId}: ${event} is disabled`);
        return null;
      }

      // Check quiet hours
      if (this.isInQuietHours(settings?.quietHours)) {
        logger.info(`Notification delayed for user ${userId}: quiet hours active`);
      }

      // Create notification record in COMPANY DB
      const notification = await CompanyNotification.create({
        recipientType: 'company_user',
        recipientId: userId,
        category,
        event,
        title,
        message,
        data,
        priority,
        actionUrl,
        expiresAt
      });

      // Get enabled channels
      const channels = settings?.preferences[event]?.channels || {
        inApp: { enabled: true },
        email: { enabled: false },
        whatsapp: { enabled: false },
        sms: { enabled: false }
      };

      // Send through enabled channels
      await this.sendThroughChannels(notification, channels, {
        recipientEmail: channels.email?.address,
        recipientPhone: channels.whatsapp?.phoneNumber || channels.sms?.phoneNumber
      });

      // Emit socket event for in-app notification
      if (channels.inApp?.enabled !== false) {
        socketManager.emitToCompanyUser(userId, 'notification', {
          id: notification._id,
          category,
          event,
          title,
          message,
          data,
          priority,
          actionUrl,
          createdAt: notification.createdAt
        });

        notification.channels.inApp.sent = true;
        notification.channels.inApp.sentAt = new Date();
        await notification.save();
      }

      logger.info(`Notification sent to company user ${userId}: ${event}`);
      return notification;
    } catch (error) {
      logger.error('Error sending notification to company user:', error);
      throw error;
    }
  }

  /**
   * Send notification to entire company
   */
  async sendToCompany(companyId, notificationData) {
    try {
      const { default: CompanyUser } = await import('../models/platform/CompanyUser.js');
      const users = await CompanyUser.find({ companyId, isActive: true });

      const notifications = await Promise.allSettled(
        users.map(user => this.sendToCompanyUser(companyId, user._id, notificationData))
      );

      logger.info(`Notification sent to ${users.length} users in company ${companyId}`);
      return notifications;
    } catch (error) {
      logger.error('Error sending notification to company:', error);
      throw error;
    }
  }

  /**
   * Send notification to company primary admin
   * Stored in COMPANY-SPECIFIC DATABASE
   */
  async sendToCompanyPrimaryAdmin(companyId, notificationData) {
    try {
      // Get company database connection
      const companyDB = getCompanyDB(companyId);
      const CompanyNotificationSettings = getCompanyNotificationSettingsModel(companyDB);

      const settings = await CompanyNotificationSettings.findOne({ 
        isPrimaryAdmin: true 
      });

      if (!settings) {
        logger.warn(`No primary admin found for company ${companyId}`);
        return null;
      }

      return await this.sendToCompanyUser(companyId, settings.userId, notificationData);
    } catch (error) {
      logger.error('Error sending notification to company primary admin:', error);
      throw error;
    }
  }

  /**
   * Send through multiple channels
   */
  async sendThroughChannels(notification, channels, contactInfo) {
    const promises = [];

    // Email
    if (channels.email?.enabled && channels.email?.verified && contactInfo.recipientEmail) {
      promises.push(
        this.sendEmail(notification, contactInfo.recipientEmail)
          .catch(error => {
            notification.channels.email.error = error.message;
            logger.error('Email notification failed:', error);
          })
      );
    }

    // WhatsApp
    if (channels.whatsapp?.enabled && channels.whatsapp?.verified && contactInfo.recipientPhone) {
      promises.push(
        this.sendWhatsApp(notification, contactInfo.recipientPhone)
          .catch(error => {
            notification.channels.whatsapp.error = error.message;
            logger.error('WhatsApp notification failed:', error);
          })
      );
    }

    // SMS
    if (channels.sms?.enabled && channels.sms?.verified && contactInfo.recipientPhone) {
      promises.push(
        this.sendSMS(notification, contactInfo.recipientPhone)
          .catch(error => {
            notification.channels.sms.error = error.message;
            logger.error('SMS notification failed:', error);
          })
      );
    }

    await Promise.allSettled(promises);
    await notification.save();
  }

  /**
   * Send email notification
   */
  async sendEmail(notification, recipientEmail) {
    await emailService.sendNotificationEmail(recipientEmail, {
      title: notification.title,
      message: notification.message,
      actionUrl: notification.actionUrl,
      priority: notification.priority
    });

    notification.channels.email.sent = true;
    notification.channels.email.sentAt = new Date();
  }

  /**
   * Send WhatsApp notification
   */
  async sendWhatsApp(notification, recipientPhone) {
    await whatsappService.sendNotification(recipientPhone, {
      title: notification.title,
      message: notification.message,
      actionUrl: notification.actionUrl
    });

    notification.channels.whatsapp.sent = true;
    notification.channels.whatsapp.sentAt = new Date();
  }

  /**
   * Send SMS notification
   */
  async sendSMS(notification, recipientPhone) {
    await smsService.sendNotification(recipientPhone, {
      message: `${notification.title}: ${notification.message}`
    });

    notification.channels.sms.sent = true;
    notification.channels.sms.sentAt = new Date();
  }

  /**
   * Check if current time is in quiet hours
   */
  isInQuietHours(quietHours) {
    if (!quietHours?.enabled) return false;

    const now = new Date();
    const timezone = quietHours.timezone || 'UTC';
    
    // This is a simplified check - in production, use a proper timezone library
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      timeZone: timezone 
    }).substring(0, 5);

    return currentTime >= quietHours.start && currentTime <= quietHours.end;
  }

  /**
   * Get notifications for user
   * Fetches from appropriate database based on user type
   */
  async getNotifications(recipientId, options = {}) {
    const {
      page = 1,
      limit = 20,
      unreadOnly = false,
      category,
      companyId,
      isPlatformAdmin = false
    } = options;

    const query = { recipientId };

    if (unreadOnly) {
      query['channels.inApp.read'] = false;
    }

    if (category) {
      query.category = category;
    }

    let notifications, total;

    if (isPlatformAdmin) {
      // Fetch from PLATFORM DB
      notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      total = await Notification.countDocuments(query);
    } else {
      // Fetch from COMPANY DB
      if (!companyId) {
        throw new Error('companyId is required for company user notifications');
      }

      const companyDB = getCompanyDB(companyId);
      const CompanyNotification = getCompanyNotificationModel(companyDB);

      notifications = await CompanyNotification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      total = await CompanyNotification.countDocuments(query);
    }

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Mark notification as read
   * Updates in appropriate database
   */
  async markAsRead(notificationId, recipientId, companyId = null, isPlatformAdmin = false) {
    let notification;

    if (isPlatformAdmin) {
      // Update in PLATFORM DB
      notification = await Notification.findOne({
        _id: notificationId,
        recipientId
      });
    } else {
      // Update in COMPANY DB
      if (!companyId) {
        throw new Error('companyId is required for company user notifications');
      }

      const companyDB = getCompanyDB(companyId);
      const CompanyNotification = getCompanyNotificationModel(companyDB);

      notification = await CompanyNotification.findOne({
        _id: notificationId,
        recipientId
      });
    }

    if (!notification) {
      throw new Error('Notification not found');
    }

    return await notification.markAsRead();
  }

  /**
   * Mark all notifications as read
   * Updates in appropriate database
   */
  async markAllAsRead(recipientId, companyId = null, isPlatformAdmin = false) {
    if (isPlatformAdmin) {
      // Update in PLATFORM DB
      return await Notification.updateMany(
        { 
          recipientId,
          'channels.inApp.read': false
        },
        {
          $set: {
            'channels.inApp.read': true,
            'channels.inApp.readAt': new Date()
          }
        }
      );
    } else {
      // Update in COMPANY DB
      if (!companyId) {
        throw new Error('companyId is required for company user notifications');
      }

      const companyDB = getCompanyDB(companyId);
      const CompanyNotification = getCompanyNotificationModel(companyDB);

      return await CompanyNotification.updateMany(
        { 
          recipientId,
          'channels.inApp.read': false
        },
        {
          $set: {
            'channels.inApp.read': true,
            'channels.inApp.readAt': new Date()
          }
        }
      );
    }
  }

  /**
   * Get unread count
   * Fetches from appropriate database
   */
  async getUnreadCount(recipientId, companyId = null, isPlatformAdmin = false) {
    if (isPlatformAdmin) {
      // Count from PLATFORM DB
      return await Notification.countDocuments({
        recipientId,
        'channels.inApp.read': false
      });
    } else {
      // Count from COMPANY DB
      if (!companyId) {
        throw new Error('companyId is required for company user notifications');
      }

      const companyDB = getCompanyDB(companyId);
      const CompanyNotification = getCompanyNotificationModel(companyDB);

      return await CompanyNotification.countDocuments({
        recipientId,
        'channels.inApp.read': false
      });
    }
  }

  /**
   * Delete notification
   * Deletes from appropriate database
   */
  async deleteNotification(notificationId, recipientId, companyId = null, isPlatformAdmin = false) {
    if (isPlatformAdmin) {
      // Delete from PLATFORM DB
      return await Notification.findOneAndDelete({
        _id: notificationId,
        recipientId
      });
    } else {
      // Delete from COMPANY DB
      if (!companyId) {
        throw new Error('companyId is required for company user notifications');
      }

      const companyDB = getCompanyDB(companyId);
      const CompanyNotification = getCompanyNotificationModel(companyDB);

      return await CompanyNotification.findOneAndDelete({
        _id: notificationId,
        recipientId
      });
    }
  }
}

export default new NotificationService();
