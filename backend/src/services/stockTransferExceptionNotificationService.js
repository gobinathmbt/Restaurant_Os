import locationNotificationRouter from './locationNotificationRouter.js';
import NotificationService from './notificationService.js';
import stockTransferExceptionEmailService from './emailTemplates/stockTransferExceptionEmailService.js';
import { logger } from '../utils/logger.js';

/**
 * Stock Transfer Exception Notification Service
 * 
 * Handles all notifications related to stock transfer exceptions:
 * - Exception reporting to super admins
 * - Exception resolution to destination admins
 * - Escalation notifications to senior management
 * - Force completion audit notifications
 */
class StockTransferExceptionNotificationService {
  /**
   * Send exception notifications to all super admins
   * 
   * @param {string} companyId - Company ID
   * @param {Object} transfer - Stock transfer with exceptions
   * @returns {Promise<Object>} Notification results
   */
  async sendExceptionNotifications(companyId, transfer) {
    try {
      // Get all super admins
      const superAdmins = await locationNotificationRouter.getSuperAdmins(companyId);

      if (!superAdmins || superAdmins.length === 0) {
        logger.warn(`No super admins found for company ${companyId}`);
        return { sent: 0, failed: 0 };
      }

      // Calculate exception summary
      const exceptionSummary = this._calculateExceptionSummary(transfer.exceptions);

      // Prepare notification data
      const notificationData = {
        category: 'inventory',
        event: 'stock_transfer_exception_reported',
        title: `Stock Transfer Exceptions Reported`,
        message: `Transfer ${transfer.transferNumber} has ${exceptionSummary.total} exception(s) requiring resolution`,
        data: {
          transferId: transfer._id,
          transferNumber: transfer.transferNumber,
          sourceLocation: transfer.sourceLocation?.name || 'Unknown',
          destinationLocation: transfer.destinationLocation?.name || 'Unknown',
          exceptionCount: exceptionSummary.total,
          exceptionTypes: exceptionSummary.byType,
          highestSeverity: exceptionSummary.highestSeverity
        },
        priority: exceptionSummary.highestSeverity === 'high' ? 'high' : 'medium',
        actionUrl: `/inventory/stock-transfers/${transfer._id}/exceptions`
      };

      // Send notifications to each super admin
      const results = await Promise.allSettled(
        superAdmins.map(async (admin) => {
          try {
            // Send in-app notification
            const notificationService = new NotificationService();
            await notificationService.sendToCompanyUser(
              companyId,
              admin._id,
              notificationData
            );

            // Send email notification
            await stockTransferExceptionEmailService.sendExceptionNotificationEmail(admin.email, {
              recipientName: admin.name,
              transfer,
              exceptionSummary
            });

            return { success: true, userId: admin._id };
          } catch (error) {
            logger.error(`Failed to send exception notification to admin ${admin._id}:`, error);
            return { success: false, userId: admin._id, error: error.message };
          }
        })
      );

      // Count successes and failures
      const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - sent;

      logger.info(
        `Exception notifications sent: ${sent} successful, ${failed} failed for transfer ${transfer.transferNumber}`
      );

      return { sent, failed, total: superAdmins.length };
    } catch (error) {
      logger.error('Error sending exception notifications:', error);
      // Don't throw - graceful degradation
      return { sent: 0, failed: 0, error: error.message };
    }
  }

  /**
   * Send exceptions resolved notification to destination admin
   * 
   * @param {string} companyId - Company ID
   * @param {Object} transfer - Stock transfer with resolved exceptions
   * @returns {Promise<Object>} Notification results
   */
  async sendExceptionsResolvedNotification(companyId, transfer) {
    try {
      // Get destination location admins
      const destinationAdmins = await locationNotificationRouter.getUsersByLocation(
        companyId,
        transfer.destinationLocation._id || transfer.destinationLocation
      );

      if (!destinationAdmins || destinationAdmins.length === 0) {
        logger.warn(
          `No destination admins found for location ${transfer.destinationLocation._id || transfer.destinationLocation}`
        );
        return { sent: 0, failed: 0 };
      }

      // Calculate resolution summary
      const resolutionSummary = this._calculateResolutionSummary(transfer.exceptions);

      // Prepare notification data
      const notificationData = {
        category: 'inventory',
        event: 'stock_transfer_exceptions_resolved',
        title: `Transfer Exceptions Resolved`,
        message: `All exceptions for transfer ${transfer.transferNumber} have been resolved. You can now complete the transfer.`,
        data: {
          transferId: transfer._id,
          transferNumber: transfer.transferNumber,
          sourceLocation: transfer.sourceLocation?.name || 'Unknown',
          destinationLocation: transfer.destinationLocation?.name || 'Unknown',
          totalExceptions: resolutionSummary.total,
          resolutionSummary: resolutionSummary.byAction
        },
        priority: 'normal',
        actionUrl: `/inventory/stock-transfers/${transfer._id}`
      };

      // Send notifications to each destination admin
      const results = await Promise.allSettled(
        destinationAdmins.map(async (admin) => {
          try {
            // Send in-app notification
            const notificationService = new NotificationService();
            await notificationService.sendToCompanyUser(
              companyId,
              admin._id,
              notificationData
            );

            // Send email notification
            await stockTransferExceptionEmailService.sendExceptionsResolvedEmail(admin.email, {
              recipientName: admin.name,
              transfer,
              resolutionSummary
            });

            return { success: true, userId: admin._id };
          } catch (error) {
            logger.error(`Failed to send resolved notification to admin ${admin._id}:`, error);
            return { success: false, userId: admin._id, error: error.message };
          }
        })
      );

      // Count successes and failures
      const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - sent;

      logger.info(
        `Exceptions resolved notifications sent: ${sent} successful, ${failed} failed for transfer ${transfer.transferNumber}`
      );

      return { sent, failed, total: destinationAdmins.length };
    } catch (error) {
      logger.error('Error sending exceptions resolved notifications:', error);
      // Don't throw - graceful degradation
      return { sent: 0, failed: 0, error: error.message };
    }
  }

  /**
   * Send escalation notification to senior management
   * 
   * @param {string} companyId - Company ID
   * @param {Object} transfer - Stock transfer with escalated exceptions
   * @param {string} escalationReason - Reason for escalation
   * @returns {Promise<Object>} Notification results
   */
  async sendEscalationNotification(companyId, transfer, escalationReason) {
    try {
      // Get senior management users (super admins for now)
      const seniorManagement = await locationNotificationRouter.getSuperAdmins(companyId);

      if (!seniorManagement || seniorManagement.length === 0) {
        logger.warn(`No senior management found for company ${companyId}`);
        return { sent: 0, failed: 0 };
      }

      // Calculate unresolved exception count
      const unresolvedCount = transfer.exceptions.filter(ex => !ex.resolved).length;

      // Prepare notification data
      const notificationData = {
        category: 'inventory',
        event: 'stock_transfer_exception_escalated',
        title: `🚨 ESCALATED: Transfer Exceptions`,
        message: `Transfer ${transfer.transferNumber} has ${unresolvedCount} unresolved exception(s) that require immediate attention`,
        data: {
          transferId: transfer._id,
          transferNumber: transfer.transferNumber,
          sourceLocation: transfer.sourceLocation?.name || 'Unknown',
          destinationLocation: transfer.destinationLocation?.name || 'Unknown',
          unresolvedExceptionCount: unresolvedCount,
          escalationReason,
          escalatedAt: transfer.escalatedAt || new Date()
        },
        priority: 'critical',
        actionUrl: `/inventory/stock-transfers/${transfer._id}/exceptions`
      };

      // Send notifications to each senior management user
      const results = await Promise.allSettled(
        seniorManagement.map(async (user) => {
          try {
            // Send in-app notification
            const notificationService = new NotificationService();
            await notificationService.sendToCompanyUser(
              companyId,
              user._id,
              notificationData
            );

            // Send email notification
            await stockTransferExceptionEmailService.sendEscalationEmail(user.email, {
              recipientName: user.name,
              transfer,
              escalationReason,
              unresolvedCount
            });

            return { success: true, userId: user._id };
          } catch (error) {
            logger.error(`Failed to send escalation notification to user ${user._id}:`, error);
            return { success: false, userId: user._id, error: error.message };
          }
        })
      );

      // Count successes and failures
      const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - sent;

      logger.info(
        `Escalation notifications sent: ${sent} successful, ${failed} failed for transfer ${transfer.transferNumber}`
      );

      return { sent, failed, total: seniorManagement.length };
    } catch (error) {
      logger.error('Error sending escalation notifications:', error);
      // Don't throw - graceful degradation
      return { sent: 0, failed: 0, error: error.message };
    }
  }

  /**
   * Send force completion notification to senior management for audit trail
   * 
   * @param {string} companyId - Company ID
   * @param {Object} transfer - Force completed stock transfer
   * @param {Object} completedByUser - User who forced completion
   * @returns {Promise<Object>} Notification results
   */
  async sendForceCompletionNotification(companyId, transfer, completedByUser) {
    try {
      // Get senior management users (super admins for now)
      const seniorManagement = await locationNotificationRouter.getSuperAdmins(companyId);

      if (!seniorManagement || seniorManagement.length === 0) {
        logger.warn(`No senior management found for company ${companyId}`);
        return { sent: 0, failed: 0 };
      }

      // Prepare notification data
      const notificationData = {
        category: 'inventory',
        event: 'stock_transfer_force_completed',
        title: `Transfer Force Completed`,
        message: `Transfer ${transfer.transferNumber} was force completed by ${completedByUser.name}`,
        data: {
          transferId: transfer._id,
          transferNumber: transfer.transferNumber,
          sourceLocation: transfer.sourceLocation?.name || 'Unknown',
          destinationLocation: transfer.destinationLocation?.name || 'Unknown',
          forceCompletedBy: completedByUser.name,
          forceCompletedAt: transfer.forceCompletedAt || new Date(),
          forceCompletionReason: transfer.forceCompletionReason || 'No reason provided'
        },
        priority: 'high',
        actionUrl: `/inventory/stock-transfers/${transfer._id}`
      };

      // Send notifications to each senior management user
      const results = await Promise.allSettled(
        seniorManagement.map(async (user) => {
          try {
            // Send in-app notification
            const notificationService = new NotificationService();
            await notificationService.sendToCompanyUser(
              companyId,
              user._id,
              notificationData
            );

            // Send email notification
            await stockTransferExceptionEmailService.sendForceCompletionEmail(user.email, {
              recipientName: user.name,
              transfer,
              completedByUser
            });

            return { success: true, userId: user._id };
          } catch (error) {
            logger.error(`Failed to send force completion notification to user ${user._id}:`, error);
            return { success: false, userId: user._id, error: error.message };
          }
        })
      );

      // Count successes and failures
      const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - sent;

      logger.info(
        `Force completion notifications sent: ${sent} successful, ${failed} failed for transfer ${transfer.transferNumber}`
      );

      return { sent, failed, total: seniorManagement.length };
    } catch (error) {
      logger.error('Error sending force completion notifications:', error);
      // Don't throw - graceful degradation
      return { sent: 0, failed: 0, error: error.message };
    }
  }

  /**
   * Calculate exception summary statistics
   * @private
   */
  _calculateExceptionSummary(exceptions) {
    const summary = {
      total: exceptions.length,
      byType: {
        damage: 0,
        missing: 0,
        excess: 0
      },
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0
      },
      highestSeverity: 'low'
    };

    exceptions.forEach(exception => {
      // Count by type
      if (exception.type) {
        summary.byType[exception.type] = (summary.byType[exception.type] || 0) + 1;
      }

      // Count by severity
      const severity = exception.severity || 'medium';
      summary.bySeverity[severity] = (summary.bySeverity[severity] || 0) + 1;

      // Track highest severity
      if (severity === 'high') {
        summary.highestSeverity = 'high';
      } else if (severity === 'medium' && summary.highestSeverity === 'low') {
        summary.highestSeverity = 'medium';
      }
    });

    return summary;
  }

  /**
   * Calculate resolution summary statistics
   * @private
   */
  _calculateResolutionSummary(exceptions) {
    const summary = {
      total: exceptions.length,
      byAction: {
        confirm_damage: 0,
        return_to_source: 0,
        accept_excess: 0,
        reject_excess: 0
      }
    };

    exceptions.forEach(exception => {
      if (exception.resolutionAction) {
        summary.byAction[exception.resolutionAction] = 
          (summary.byAction[exception.resolutionAction] || 0) + 1;
      }
    });

    return summary;
  }
}

export default new StockTransferExceptionNotificationService();
