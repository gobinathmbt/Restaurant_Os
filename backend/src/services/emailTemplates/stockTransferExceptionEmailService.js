import emailService from '../emailService.js';
import { logger } from '../../utils/logger.js';
import { ENV } from '../../config/env.js';
import {
  generateExceptionNotificationEmailTemplate,
  generateExceptionsResolvedEmailTemplate,
  generateEscalationEmailTemplate,
  generateForceCompletionEmailTemplate
} from './stockTransferExceptionEmailTemplates.js';

/**
 * Stock Transfer Exception Email Service
 * 
 * Handles sending exception-related emails for stock transfers
 */
class StockTransferExceptionEmailService {
  /**
   * Send exception notification email to super admin
   * @param {string} recipientEmail - Recipient email address
   * @param {Object} data - Exception notification data
   */
  async sendExceptionNotificationEmail(recipientEmail, data) {
    try {
      const { recipientName, transfer, exceptionSummary } = data;

      const html = generateExceptionNotificationEmailTemplate(
        transfer,
        exceptionSummary,
        recipientName
      );

      // Reinitialize if transporter doesn't exist
      if (!emailService.transporter) {
        emailService.initialize();
      }

      const mailOptions = {
        from: `"${ENV.SMTP_FROM_NAME}" <${ENV.SMTP_FROM_EMAIL || ENV.SMTP_USER}>`,
        to: recipientEmail,
        subject: `⚠️ Stock Transfer Exceptions: ${transfer.transferNumber}`,
        html
      };

      const info = await emailService.transporter.sendMail(mailOptions);
      logger.info(`Exception notification email sent to ${recipientEmail}`, {
        messageId: info.messageId,
        transferNumber: transfer.transferNumber
      });

      return info;
    } catch (error) {
      logger.error('Error sending exception notification email:', error);
      // Don't throw - graceful degradation
    }
  }

  /**
   * Send exceptions resolved notification email to destination admin
   * @param {string} recipientEmail - Recipient email address
   * @param {Object} data - Exceptions resolved data
   */
  async sendExceptionsResolvedEmail(recipientEmail, data) {
    try {
      const { recipientName, transfer, resolutionSummary } = data;

      const html = generateExceptionsResolvedEmailTemplate(
        transfer,
        resolutionSummary,
        recipientName
      );

      // Reinitialize if transporter doesn't exist
      if (!emailService.transporter) {
        emailService.initialize();
      }

      const mailOptions = {
        from: `"${ENV.SMTP_FROM_NAME}" <${ENV.SMTP_FROM_EMAIL || ENV.SMTP_USER}>`,
        to: recipientEmail,
        subject: `✅ Transfer Exceptions Resolved: ${transfer.transferNumber}`,
        html
      };

      const info = await emailService.transporter.sendMail(mailOptions);
      logger.info(`Exceptions resolved email sent to ${recipientEmail}`, {
        messageId: info.messageId,
        transferNumber: transfer.transferNumber
      });

      return info;
    } catch (error) {
      logger.error('Error sending exceptions resolved email:', error);
      // Don't throw - graceful degradation
    }
  }

  /**
   * Send escalation notification email to senior management
   * @param {string} recipientEmail - Recipient email address
   * @param {Object} data - Escalation data
   */
  async sendEscalationEmail(recipientEmail, data) {
    try {
      const { recipientName, transfer, escalationReason, unresolvedCount } = data;

      const html = generateEscalationEmailTemplate(
        transfer,
        escalationReason,
        unresolvedCount,
        recipientName
      );

      // Reinitialize if transporter doesn't exist
      if (!emailService.transporter) {
        emailService.initialize();
      }

      const mailOptions = {
        from: `"${ENV.SMTP_FROM_NAME}" <${ENV.SMTP_FROM_EMAIL || ENV.SMTP_USER}>`,
        to: recipientEmail,
        subject: `🚨 ESCALATED: Transfer Exceptions - ${transfer.transferNumber}`,
        html
      };

      const info = await emailService.transporter.sendMail(mailOptions);
      logger.info(`Escalation email sent to ${recipientEmail}`, {
        messageId: info.messageId,
        transferNumber: transfer.transferNumber
      });

      return info;
    } catch (error) {
      logger.error('Error sending escalation email:', error);
      // Don't throw - graceful degradation
    }
  }

  /**
   * Send force completion notification email to senior management
   * @param {string} recipientEmail - Recipient email address
   * @param {Object} data - Force completion data
   */
  async sendForceCompletionEmail(recipientEmail, data) {
    try {
      const { recipientName, transfer, completedByUser } = data;

      const html = generateForceCompletionEmailTemplate(
        transfer,
        completedByUser,
        recipientName
      );

      // Reinitialize if transporter doesn't exist
      if (!emailService.transporter) {
        emailService.initialize();
      }

      const mailOptions = {
        from: `"${ENV.SMTP_FROM_NAME}" <${ENV.SMTP_FROM_EMAIL || ENV.SMTP_USER}>`,
        to: recipientEmail,
        subject: `⚠️ Transfer Force Completed: ${transfer.transferNumber}`,
        html
      };

      const info = await emailService.transporter.sendMail(mailOptions);
      logger.info(`Force completion email sent to ${recipientEmail}`, {
        messageId: info.messageId,
        transferNumber: transfer.transferNumber
      });

      return info;
    } catch (error) {
      logger.error('Error sending force completion email:', error);
      // Don't throw - graceful degradation
    }
  }
}

export default new StockTransferExceptionEmailService();
