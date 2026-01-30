import notificationService from './notificationService.js';
import { logger } from '../utils/logger.js';

/**
 * Service to handle notifications related to company registration
 */
class CompanyRegistrationNotificationService {
  /**
   * Notify all platform admins when a new company registers
   */
  async notifyCompanyRegistration(companyData) {
    try {
      const { companyId, companyName, ownerName, ownerEmail, plan } = companyData;

      const notificationData = {
        category: 'company_registration',
        event: 'companyRegistration',
        title: 'New Company Registered',
        message: `${companyName} has registered with ${plan} plan. Owner: ${ownerName} (${ownerEmail})`,
        data: {
          companyId,
          companyName,
          ownerName,
          ownerEmail,
          plan,
          registeredAt: new Date()
        },
        priority: 'high',
        actionUrl: `/platform/companies/${companyId}`
      };

      // Send to all platform admins
      await notificationService.sendToAllPlatformAdmins(notificationData);

      logger.info(`Company registration notification sent for: ${companyName}`);
    } catch (error) {
      logger.error('Error sending company registration notification:', error);
      // Don't throw - notification failure shouldn't break registration
    }
  }

  /**
   * Notify company primary admin about successful registration
   */
  async notifyCompanyOwner(companyId, userId, companyData) {
    try {
      const { companyName, plan } = companyData;

      const notificationData = {
        category: 'system',
        event: 'systemAlert',
        title: 'Welcome to RestaurantOS!',
        message: `Your company "${companyName}" has been successfully registered with ${plan} plan. You can now start setting up your restaurant.`,
        data: {
          companyId,
          companyName,
          plan
        },
        priority: 'medium',
        actionUrl: '/company/dashboard'
      };

      // Send to company owner
      await notificationService.sendToCompanyUser(companyId, userId, notificationData);

      logger.info(`Welcome notification sent to company owner: ${userId}`);
    } catch (error) {
      logger.error('Error sending welcome notification to company owner:', error);
    }
  }

  /**
   * Notify about subscription expiring soon
   */
  async notifySubscriptionExpiring(companyId, daysRemaining) {
    try {
      const notificationData = {
        category: 'subscription',
        event: 'subscriptionExpiring',
        title: 'Subscription Expiring Soon',
        message: `Your subscription will expire in ${daysRemaining} days. Please renew to continue using all features.`,
        data: {
          daysRemaining,
          expiringAt: new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000)
        },
        priority: daysRemaining <= 3 ? 'urgent' : 'high',
        actionUrl: '/company/subscription'
      };

      // Send to company primary admin
      await notificationService.sendToCompanyPrimaryAdmin(companyId, notificationData);

      logger.info(`Subscription expiring notification sent to company: ${companyId}`);
    } catch (error) {
      logger.error('Error sending subscription expiring notification:', error);
    }
  }

  /**
   * Notify about subscription expired
   */
  async notifySubscriptionExpired(companyId) {
    try {
      const notificationData = {
        category: 'subscription',
        event: 'subscriptionExpired',
        title: 'Subscription Expired',
        message: 'Your subscription has expired. Please renew immediately to restore access to all features.',
        data: {
          expiredAt: new Date()
        },
        priority: 'urgent',
        actionUrl: '/company/subscription'
      };

      // Send to company primary admin
      await notificationService.sendToCompanyPrimaryAdmin(companyId, notificationData);

      logger.info(`Subscription expired notification sent to company: ${companyId}`);
    } catch (error) {
      logger.error('Error sending subscription expired notification:', error);
    }
  }

  /**
   * Notify about payment received
   */
  async notifyPaymentReceived(companyId, paymentData) {
    try {
      const { amount, currency, paymentMethod, transactionId } = paymentData;

      const notificationData = {
        category: 'payment',
        event: 'paymentReceived',
        title: 'Payment Received',
        message: `Payment of ${currency} ${amount} received via ${paymentMethod}. Transaction ID: ${transactionId}`,
        data: paymentData,
        priority: 'medium',
        actionUrl: '/company/billing'
      };

      // Send to company primary admin
      await notificationService.sendToCompanyPrimaryAdmin(companyId, notificationData);

      logger.info(`Payment received notification sent to company: ${companyId}`);
    } catch (error) {
      logger.error('Error sending payment received notification:', error);
    }
  }

  /**
   * Notify about payment failed
   */
  async notifyPaymentFailed(companyId, paymentData) {
    try {
      const { amount, currency, paymentMethod, reason } = paymentData;

      const notificationData = {
        category: 'payment',
        event: 'paymentFailed',
        title: 'Payment Failed',
        message: `Payment of ${currency} ${amount} via ${paymentMethod} failed. Reason: ${reason}`,
        data: paymentData,
        priority: 'urgent',
        actionUrl: '/company/billing'
      };

      // Send to company primary admin
      await notificationService.sendToCompanyPrimaryAdmin(companyId, notificationData);

      logger.info(`Payment failed notification sent to company: ${companyId}`);
    } catch (error) {
      logger.error('Error sending payment failed notification:', error);
    }
  }
}

export default new CompanyRegistrationNotificationService();
