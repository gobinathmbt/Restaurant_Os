import emailService from '../emailService.js';
import { logger } from '../../utils/logger.js';
import { ENV } from '../../config/env.js';
import {
  generateRequestApprovalEmailTemplate,
  generateRequestRejectionEmailTemplate,
  generateRequestCancellationEmailTemplate
} from './stockRequestEmailTemplates.js';
import {
  generateTransferShippedEmailTemplate,
  generateTransferCompletedEmailTemplate,
  generateBackorderCreationEmailTemplate
} from './stockTransferEmailTemplates.js';

class StockRequestEmailService {
  /**
   * Send stock request creation notification email
   * @param {string} recipientEmail - Recipient email address
   * @param {Object} data - Stock request details
   */
  async sendStockRequestCreationNotification(recipientEmail, data) {
    try {
      const { request, recipientName } = data;

      const html = this.generateRequestCreationEmailTemplate(request, recipientName);

      // Reinitialize if transporter doesn't exist
      if (!emailService.transporter) {
        emailService.initialize();
      }

      const mailOptions = {
        from: `"${ENV.SMTP_FROM_NAME}" <${ENV.SMTP_FROM_EMAIL || ENV.SMTP_USER}>`,
        to: recipientEmail,
        subject: `New Stock Request: ${request.requestNumber}`,
        html
      };

      const info = await emailService.transporter.sendMail(mailOptions);
      logger.info(`Stock request creation email sent to ${recipientEmail}`, {
        messageId: info.messageId,
        requestNumber: request.requestNumber
      });

      return info;
    } catch (error) {
      logger.error('Error sending stock request creation email:', error);
      // Don't throw - gracefully handle email failures
    }
  }

  /**
   * Send stock request approval notification email
   * @param {string} recipientEmail - Recipient email address
   * @param {Object} data - Stock request approval details
   */
  async sendStockRequestApprovalNotification(recipientEmail, data) {
    try {
      const { request, recipientName, transfer, backorders } = data;

      const html = this.generateRequestApprovalEmailTemplate(request, recipientName, transfer, backorders);

      // Reinitialize if transporter doesn't exist
      if (!emailService.transporter) {
        emailService.initialize();
      }

      const mailOptions = {
        from: `"${ENV.SMTP_FROM_NAME}" <${ENV.SMTP_FROM_EMAIL || ENV.SMTP_USER}>`,
        to: recipientEmail,
        subject: `Stock Request Approved: ${request.requestNumber}`,
        html
      };

      const info = await emailService.transporter.sendMail(mailOptions);
      logger.info(`Stock request approval email sent to ${recipientEmail}`, {
        messageId: info.messageId,
        requestNumber: request.requestNumber
      });

      return info;
    } catch (error) {
      logger.error('Error sending stock request approval email:', error);
      // Don't throw - gracefully handle email failures
    }
  }

  /**
   * Send stock request rejection notification email
   * @param {string} recipientEmail - Recipient email address
   * @param {Object} data - Stock request rejection details
   */
  async sendStockRequestRejectionNotification(recipientEmail, data) {
    try {
      const { request, recipientName } = data;

      const html = this.generateRequestRejectionEmailTemplate(request, recipientName);

      // Reinitialize if transporter doesn't exist
      if (!emailService.transporter) {
        emailService.initialize();
      }

      const mailOptions = {
        from: `"${ENV.SMTP_FROM_NAME}" <${ENV.SMTP_FROM_EMAIL || ENV.SMTP_USER}>`,
        to: recipientEmail,
        subject: `Stock Request Rejected: ${request.requestNumber}`,
        html
      };

      const info = await emailService.transporter.sendMail(mailOptions);
      logger.info(`Stock request rejection email sent to ${recipientEmail}`, {
        messageId: info.messageId,
        requestNumber: request.requestNumber
      });

      return info;
    } catch (error) {
      logger.error('Error sending stock request rejection email:', error);
      // Don't throw - gracefully handle email failures
    }
  }

  /**
   * Send stock request cancellation notification email
   * @param {string} recipientEmail - Recipient email address
   * @param {Object} data - Stock request cancellation details
   */
  async sendStockRequestCancellationNotification(recipientEmail, data) {
    try {
      const { request, recipientName } = data;

      const html = this.generateRequestCancellationEmailTemplate(request, recipientName);

      // Reinitialize if transporter doesn't exist
      if (!emailService.transporter) {
        emailService.initialize();
      }

      const mailOptions = {
        from: `"${ENV.SMTP_FROM_NAME}" <${ENV.SMTP_FROM_EMAIL || ENV.SMTP_USER}>`,
        to: recipientEmail,
        subject: `Stock Request Cancelled: ${request.requestNumber}`,
        html
      };

      const info = await emailService.transporter.sendMail(mailOptions);
      logger.info(`Stock request cancellation email sent to ${recipientEmail}`, {
        messageId: info.messageId,
        requestNumber: request.requestNumber
      });

      return info;
    } catch (error) {
      logger.error('Error sending stock request cancellation email:', error);
      // Don't throw - gracefully handle email failures
    }
  }

  /**
   * Send transfer shipped notification email
   * @param {string} recipientEmail - Recipient email address
   * @param {Object} data - Transfer shipment details
   */
  async sendTransferShippedNotification(recipientEmail, data) {
    try {
      const { transfer, recipientName } = data;

      const html = this.generateTransferShippedEmailTemplate(transfer, recipientName);

      // Reinitialize if transporter doesn't exist
      if (!emailService.transporter) {
        emailService.initialize();
      }

      const mailOptions = {
        from: `"${ENV.SMTP_FROM_NAME}" <${ENV.SMTP_FROM_EMAIL || ENV.SMTP_USER}>`,
        to: recipientEmail,
        subject: `Transfer Shipped: ${transfer.transferNumber}`,
        html
      };

      const info = await emailService.transporter.sendMail(mailOptions);
      logger.info(`Transfer shipped email sent to ${recipientEmail}`, {
        messageId: info.messageId,
        transferNumber: transfer.transferNumber
      });

      return info;
    } catch (error) {
      logger.error('Error sending transfer shipped email:', error);
      // Don't throw - gracefully handle email failures
    }
  }

  /**
   * Send transfer completed notification email
   * @param {string} recipientEmail - Recipient email address
   * @param {Object} data - Transfer completion details
   */
  async sendTransferCompletedNotification(recipientEmail, data) {
    try {
      const { transfer, recipientName } = data;

      const html = this.generateTransferCompletedEmailTemplate(transfer, recipientName);

      // Reinitialize if transporter doesn't exist
      if (!emailService.transporter) {
        emailService.initialize();
      }

      const mailOptions = {
        from: `"${ENV.SMTP_FROM_NAME}" <${ENV.SMTP_FROM_EMAIL || ENV.SMTP_USER}>`,
        to: recipientEmail,
        subject: `Transfer Completed: ${transfer.transferNumber}`,
        html
      };

      const info = await emailService.transporter.sendMail(mailOptions);
      logger.info(`Transfer completed email sent to ${recipientEmail}`, {
        messageId: info.messageId,
        transferNumber: transfer.transferNumber
      });

      return info;
    } catch (error) {
      logger.error('Error sending transfer completed email:', error);
      // Don't throw - gracefully handle email failures
    }
  }

  /**
   * Send backorder creation notification email
   * @param {string} recipientEmail - Recipient email address
   * @param {Object} data - Backorder details
   */
  async sendBackorderCreationNotification(recipientEmail, data) {
    try {
      const { backorder, recipientName } = data;

      const html = this.generateBackorderCreationEmailTemplate(backorder, recipientName);

      // Reinitialize if transporter doesn't exist
      if (!emailService.transporter) {
        emailService.initialize();
      }

      const mailOptions = {
        from: `"${ENV.SMTP_FROM_NAME}" <${ENV.SMTP_FROM_EMAIL || ENV.SMTP_USER}>`,
        to: recipientEmail,
        subject: `Backorder Created for Request: ${backorder.originalRequestId?.requestNumber || 'N/A'}`,
        html
      };

      const info = await emailService.transporter.sendMail(mailOptions);
      logger.info(`Backorder creation email sent to ${recipientEmail}`, {
        messageId: info.messageId,
        backorderId: backorder._id
      });

      return info;
    } catch (error) {
      logger.error('Error sending backorder creation email:', error);
      // Don't throw - gracefully handle email failures
    }
  }

  /**
   * Generate HTML email template for stock request creation
   */
  generateRequestCreationEmailTemplate(request, recipientName) {
    const {
      requestNumber,
      fromLocation,
      toLocation,
      priority,
      expectedDeliveryDate,
      items,
      requestedBy,
      requestDate,
      notes
    } = request;

    const formattedDate = new Date(requestDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const formattedExpectedDate = new Date(expectedDeliveryDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const priorityBadge = {
      'urgent': '<span style="background: #ef4444; color: white; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">URGENT</span>',
      'high': '<span style="background: #f59e0b; color: white; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">HIGH</span>',
      'normal': '<span style="background: #3b82f6; color: white; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">NORMAL</span>',
      'low': '<span style="background: #6b7280; color: white; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">LOW</span>'
    }[priority] || priority;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Stock Request</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); padding: 40px 30px; text-align: center; position: relative; overflow: hidden;">
      <div style="display: inline-flex; align-items: center; gap: 12px; margin-bottom: 20px; position: relative; z-index: 1;">
        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 28px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">🍽️</div>
        <div style="font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">RestaurantOS</div>
      </div>
      <h1 style="font-size: 32px; font-weight: 700; color: #ffffff; margin-bottom: 10px; position: relative; z-index: 1;">New Stock Request 📦</h1>
      <p style="font-size: 16px; color: #10b981; font-weight: 500; position: relative; z-index: 1;">Inventory Management</p>
    </div>

    <div style="padding: 40px 30px;">
      <p style="font-size: 15px; color: #4b5563; margin-bottom: 20px; line-height: 1.8;">
        Hello ${recipientName || 'Admin'},
      </p>
      <p style="font-size: 15px; color: #4b5563; margin-bottom: 20px; line-height: 1.8;">
        A new stock request has been created and requires your attention.
      </p>

      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 25px; border-radius: 12px; margin: 30px 0; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);">
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.2);">
          <span style="font-size: 14px; opacity: 0.9;">Request Number:</span>
          <span style="font-size: 14px; font-weight: 600;">${requestNumber}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.2);">
          <span style="font-size: 14px; opacity: 0.9;">From Location:</span>
          <span style="font-size: 14px; font-weight: 600;">${fromLocation?.name || 'N/A'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.2);">
          <span style="font-size: 14px; opacity: 0.9;">To Location:</span>
          <span style="font-size: 14px; font-weight: 600;">${toLocation?.name || 'N/A'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.2);">
          <span style="font-size: 14px; opacity: 0.9;">Priority:</span>
          <span style="font-size: 14px; font-weight: 600;">${priorityBadge}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.2);">
          <span style="font-size: 14px; opacity: 0.9;">Expected Delivery:</span>
          <span style="font-size: 14px; font-weight: 600;">${formattedExpectedDate}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 0;">
          <span style="font-size: 14px; opacity: 0.9;">Requested By:</span>
          <span style="font-size: 14px; font-weight: 600;">${requestedBy?.name || 'N/A'}</span>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <thead style="background: #f9fafb;">
          <tr>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb;">Item</th>
            <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb;">Quantity</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb;">Unit</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, index) => `
          <tr${index === items.length - 1 ? '' : ' style="border-bottom: 1px solid #f3f4f6;"'}>
            <td style="padding: 12px; font-size: 13px; color: #111827;">${item?.inventoryItem?.name || 'Unknown Item'}</td>
            <td style="padding: 12px; font-size: 13px; color: #111827; text-align: right; font-weight: 600;">${item?.requestedQuantity || 0}</td>
            <td style="padding: 12px; font-size: 13px; color: #111827;">${item?.unit || 'N/A'}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>

      ${notes ? `
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <div style="font-size: 13px; color: #92400e; line-height: 1.6;">
          <strong>Notes:</strong> ${notes}
        </div>
      </div>
      ` : ''}

      <div style="text-align: center;">
        <a href="${ENV.FRONTEND_URL}/inventory/stock-requests/${request._id}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; text-align: center; margin: 20px 0; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">View Request Details →</a>
      </div>

      <p style="font-size: 15px; color: #111827; margin-top: 30px; font-weight: 600;">
        Best regards,<br>
        The RestaurantOS Team
      </p>
    </div>

    <div style="background: #111827; color: #9ca3af; padding: 30px; text-align: center; font-size: 13px;">
      <p style="margin-bottom: 10px;">© ${new Date().getFullYear()} RestaurantOS. All rights reserved.</p>
      <div style="margin: 15px 0;">
        <a href="${ENV.FRONTEND_URL}" style="color: #10b981; text-decoration: none; margin: 0 10px;">Website</a>
        <a href="${ENV.FRONTEND_URL}/docs" style="color: #10b981; text-decoration: none; margin: 0 10px;">Documentation</a>
        <a href="${ENV.FRONTEND_URL}/support" style="color: #10b981; text-decoration: none; margin: 0 10px;">Support</a>
      </div>
      <p style="margin-top: 15px; font-size: 12px;">
        This is an automated notification from RestaurantOS.
      </p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Generate HTML email template for stock request approval
   */
  generateRequestApprovalEmailTemplate(request, recipientName, transfer, backorders) {
    return generateRequestApprovalEmailTemplate(request, recipientName, transfer, backorders);
  }

  /**
   * Generate HTML email template for stock request rejection
   */
  generateRequestRejectionEmailTemplate(request, recipientName) {
    return generateRequestRejectionEmailTemplate(request, recipientName);
  }

  /**
   * Generate HTML email template for stock request cancellation
   */
  generateRequestCancellationEmailTemplate(request, recipientName) {
    return generateRequestCancellationEmailTemplate(request, recipientName);
  }

  /**
   * Generate HTML email template for transfer shipped
   */
  generateTransferShippedEmailTemplate(transfer, recipientName) {
    return generateTransferShippedEmailTemplate(transfer, recipientName);
  }

  /**
   * Generate HTML email template for transfer completed
   */
  generateTransferCompletedEmailTemplate(transfer, recipientName) {
    return generateTransferCompletedEmailTemplate(transfer, recipientName);
  }

  /**
   * Generate HTML email template for backorder creation
   */
  generateBackorderCreationEmailTemplate(backorder, recipientName) {
    return generateBackorderCreationEmailTemplate(backorder, recipientName);
  }
}

export default new StockRequestEmailService();
