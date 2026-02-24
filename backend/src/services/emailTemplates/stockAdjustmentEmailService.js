import emailService from '../emailService.js';
import { logger } from '../../utils/logger.js';
import { ENV } from '../../config/env.js';

class StockAdjustmentEmailService {
  /**
   * Send stock adjustment notification email
   * @param {string} recipientEmail - Recipient email address
   * @param {Object} data - Stock adjustment details
   */
  async sendStockAdjustmentNotification(recipientEmail, data) {
    try {
      const { adjustment, isAutoApproved, recipientName } = data;

      const html = this.generateStockAdjustmentEmailTemplate(adjustment, isAutoApproved, recipientName);

      // Reinitialize if transporter doesn't exist
      if (!emailService.transporter) {
        emailService.initialize();
      }

      const subject = isAutoApproved 
        ? `Stock Adjustment Created: ${adjustment.adjustmentNumber}`
        : `Stock Adjustment Requires Approval: ${adjustment.adjustmentNumber}`;

      const mailOptions = {
        from: `"${ENV.SMTP_FROM_NAME}" <${ENV.SMTP_FROM_EMAIL || ENV.SMTP_USER}>`,
        to: recipientEmail,
        subject,
        html
      };

      const info = await emailService.transporter.sendMail(mailOptions);
      logger.info(`Stock adjustment notification email sent to ${recipientEmail}`, {
        messageId: info.messageId,
        adjustmentNumber: adjustment.adjustmentNumber
      });

      return info;
    } catch (error) {
      logger.error('Error sending stock adjustment notification email:', error);
      throw error;
    }
  }

  /**
   * Send stock adjustment approval notification email
   * @param {string} recipientEmail - Recipient email address
   * @param {Object} data - Stock adjustment details
   */
  async sendStockAdjustmentApprovalNotification(recipientEmail, data) {
    try {
      const { adjustment, recipientName } = data;

      const html = this.generateApprovalEmailTemplate(adjustment, recipientName);

      // Reinitialize if transporter doesn't exist
      if (!emailService.transporter) {
        emailService.initialize();
      }

      const mailOptions = {
        from: `"${ENV.SMTP_FROM_NAME}" <${ENV.SMTP_FROM_EMAIL || ENV.SMTP_USER}>`,
        to: recipientEmail,
        subject: `Stock Adjustment Approved: ${adjustment.adjustmentNumber}`,
        html
      };

      const info = await emailService.transporter.sendMail(mailOptions);
      logger.info(`Stock adjustment approval email sent to ${recipientEmail}`, {
        messageId: info.messageId,
        adjustmentNumber: adjustment.adjustmentNumber
      });

      return info;
    } catch (error) {
      logger.error('Error sending stock adjustment approval email:', error);
      throw error;
    }
  }

  /**
   * Generate HTML email template for stock adjustment notification
   */
  generateStockAdjustmentEmailTemplate(adjustment, isAutoApproved, recipientName) {
    const {
      adjustmentNumber,
      locationId,
      adjustmentType,
      items,
      status,
      createdBy,
      createdDate,
      approvedBy,
      approvedDate,
      notes
    } = adjustment;

    const formattedDate = new Date(createdDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const adjustmentTypeLabel = {
      'increase': 'Stock Increase',
      'decrease': 'Stock Decrease',
      'correction': 'Stock Correction'
    }[adjustmentType] || adjustmentType;

    const statusBadge = isAutoApproved 
      ? '<span style="background: #10b981; color: white; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">APPROVED</span>'
      : '<span style="background: #f59e0b; color: white; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">PENDING APPROVAL</span>';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stock Adjustment ${isAutoApproved ? 'Created' : 'Pending Approval'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background-color: #f9fafb;
    }
    .email-wrapper { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header {
      background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
      padding: 40px 30px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%);
      animation: pulse 15s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 0.5; }
      50% { transform: scale(1.1); opacity: 0.8; }
    }
    .logo {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      position: relative;
      z-index: 1;
    }
    .logo-icon {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }
    .logo-text {
      font-size: 28px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.5px;
    }
    .header-title {
      font-size: 32px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 10px;
      position: relative;
      z-index: 1;
    }
    .header-subtitle {
      font-size: 16px;
      color: #10b981;
      font-weight: 500;
      position: relative;
      z-index: 1;
    }
    .content { padding: 40px 30px; }
    .message {
      font-size: 15px;
      color: #4b5563;
      margin-bottom: 20px;
      line-height: 1.8;
    }
    .adjustment-summary {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      padding: 25px;
      border-radius: 12px;
      margin: 30px 0;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
    }
    .adjustment-summary-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    }
    .adjustment-summary-row:last-child { border-bottom: none; }
    .adjustment-summary-label {
      font-size: 14px;
      opacity: 0.9;
    }
    .adjustment-summary-value {
      font-size: 14px;
      font-weight: 600;
    }
    .details-section {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .details-title {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .detail-row {
      display: flex;
      padding: 8px 0;
      border-bottom: 1px solid #f3f4f6;
    }
    .detail-row:last-child { border-bottom: none; }
    .detail-label {
      font-size: 13px;
      color: #6b7280;
      width: 140px;
      flex-shrink: 0;
    }
    .detail-value {
      font-size: 13px;
      color: #111827;
      font-weight: 500;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }
    .items-table thead { background: #f9fafb; }
    .items-table th {
      padding: 12px;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 2px solid #e5e7eb;
    }
    .items-table td {
      padding: 12px;
      font-size: 13px;
      color: #111827;
      border-bottom: 1px solid #f3f4f6;
    }
    .items-table tbody tr:last-child td { border-bottom: none; }
    .items-table tbody tr:hover { background: #f9fafb; }
    .text-right { text-align: right; }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      text-align: center;
      margin: 20px 0;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
      transition: transform 0.2s;
    }
    .cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
    }
    .info-box {
      background: ${isAutoApproved ? '#f0fdf4' : '#fef3c7'};
      border-left: 4px solid ${isAutoApproved ? '#10b981' : '#f59e0b'};
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .info-box-content {
      font-size: 13px;
      color: ${isAutoApproved ? '#047857' : '#92400e'};
      line-height: 1.6;
    }
    .footer {
      background: #111827;
      color: #9ca3af;
      padding: 30px;
      text-align: center;
      font-size: 13px;
    }
    .footer-links { margin: 15px 0; }
    .footer-link {
      color: #10b981;
      text-decoration: none;
      margin: 0 10px;
    }
    @media only screen and (max-width: 600px) {
      .header { padding: 30px 20px; }
      .content { padding: 30px 20px; }
      .header-title { font-size: 24px; }
      .items-table { font-size: 11px; }
      .items-table th, .items-table td { padding: 8px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="header">
      <div class="logo">
        <div class="logo-icon">🍽️</div>
        <div class="logo-text">RestaurantOS</div>
      </div>
      <h1 class="header-title">Stock Adjustment ${isAutoApproved ? 'Created' : 'Pending'} 📊</h1>
      <p class="header-subtitle">Inventory Management</p>
    </div>

    <div class="content">
      <p class="message">
        Hello ${recipientName || 'Admin'},
      </p>
      <p class="message">
        ${isAutoApproved 
          ? 'A stock adjustment has been created and automatically approved. The inventory has been updated accordingly.'
          : 'A new stock adjustment has been created and requires your approval before the inventory can be updated.'
        }
      </p>

      <div class="adjustment-summary">
        <div class="adjustment-summary-row">
          <span class="adjustment-summary-label">Adjustment Number:</span>
          <span class="adjustment-summary-value">${adjustmentNumber}</span>
        </div>
        <div class="adjustment-summary-row">
          <span class="adjustment-summary-label">Type:</span>
          <span class="adjustment-summary-value">${adjustmentTypeLabel}</span>
        </div>
        <div class="adjustment-summary-row">
          <span class="adjustment-summary-label">Location:</span>
          <span class="adjustment-summary-value">${locationId?.name || 'N/A'}</span>
        </div>
        <div class="adjustment-summary-row">
          <span class="adjustment-summary-label">Created By:</span>
          <span class="adjustment-summary-value">${createdBy?.name || 'N/A'}</span>
        </div>
        <div class="adjustment-summary-row">
          <span class="adjustment-summary-label">Date:</span>
          <span class="adjustment-summary-value">${formattedDate}</span>
        </div>
        <div class="adjustment-summary-row">
          <span class="adjustment-summary-label">Status:</span>
          <span class="adjustment-summary-value">${statusBadge}</span>
        </div>
      </div>

      <div class="details-section">
        <div class="details-title">📦 Adjustment Details</div>
        <div class="detail-row">
          <div class="detail-label">Adjustment Number:</div>
          <div class="detail-value">${adjustmentNumber}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Type:</div>
          <div class="detail-value">${adjustmentTypeLabel}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Location:</div>
          <div class="detail-value">${locationId?.name || 'N/A'} (${locationId?.code || 'N/A'})</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Created By:</div>
          <div class="detail-value">${createdBy?.name || 'N/A'}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Created Date:</div>
          <div class="detail-value">${formattedDate}</div>
        </div>
        ${isAutoApproved && approvedBy ? `
        <div class="detail-row">
          <div class="detail-label">Approved By:</div>
          <div class="detail-value">${approvedBy?.name || 'N/A'}</div>
        </div>
        ` : ''}
        ${isAutoApproved && approvedDate ? `
        <div class="detail-row">
          <div class="detail-label">Approved Date:</div>
          <div class="detail-value">${new Date(approvedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        ` : ''}
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th>Item</th>
            <th class="text-right">Previous Qty</th>
            <th class="text-right">Change</th>
            <th class="text-right">New Qty</th>
            <th>Unit</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => {
            const newQty = (item?.currentQuantity || 0) + (item?.quantityDelta || 0);
            const deltaDisplay = item?.quantityDelta >= 0 
              ? `+${item?.quantityDelta}` 
              : `${item?.quantityDelta}`;
            const deltaColor = item?.quantityDelta >= 0 ? '#10b981' : '#ef4444';
            
            return `
          <tr>
            <td>${item?.inventoryItem?.name || 'Unknown Item'}</td>
            <td class="text-right">${item?.currentQuantity || 0}</td>
            <td class="text-right" style="color: ${deltaColor}; font-weight: 600;">${deltaDisplay}</td>
            <td class="text-right" style="font-weight: 600;">${newQty}</td>
            <td>${item?.inventoryItem?.unit || 'N/A'}</td>
          </tr>
          `;
          }).join('')}
        </tbody>
      </table>

      ${notes ? `
      <div class="info-box">
        <div class="info-box-content">
          <strong>Notes:</strong> ${notes}
        </div>
      </div>
      ` : ''}

      ${!isAutoApproved ? `
      <div class="info-box">
        <div class="info-box-content">
          ⚠️ <strong>Action Required:</strong> This adjustment requires approval from a super admin before the inventory will be updated.
        </div>
      </div>
      ` : ''}

      <div style="text-align: center;">
        <a href="${ENV.FRONTEND_URL}/inventory/adjustments" class="cta-button">View Adjustment Details →</a>
      </div>

      <p class="message" style="margin-top: 30px; font-weight: 600; color: #111827;">
        Best regards,<br>
        The RestaurantOS Team
      </p>
    </div>

    <div class="footer">
      <p style="margin-bottom: 10px;">© ${new Date().getFullYear()} RestaurantOS. All rights reserved.</p>
      <div class="footer-links">
        <a href="${ENV.FRONTEND_URL}" class="footer-link">Website</a>
        <a href="${ENV.FRONTEND_URL}/docs" class="footer-link">Documentation</a>
        <a href="${ENV.FRONTEND_URL}/support" class="footer-link">Support</a>
      </div>
      <p style="margin-top: 15px; font-size: 12px;">
        This is an automated notification from RestaurantOS.<br>
        You received this email because you are a super admin.
      </p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Generate HTML email template for stock adjustment approval notification
   */
  generateApprovalEmailTemplate(adjustment, recipientName) {
    const {
      adjustmentNumber,
      locationId,
      adjustmentType,
      items,
      createdBy,
      approvedBy,
      approvedDate,
      notes
    } = adjustment;

    const formattedApprovalDate = new Date(approvedDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const adjustmentTypeLabel = {
      'increase': 'Stock Increase',
      'decrease': 'Stock Decrease',
      'correction': 'Stock Correction'
    }[adjustmentType] || adjustmentType;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stock Adjustment Approved</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background-color: #f9fafb;
    }
    .email-wrapper { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header {
      background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
      padding: 40px 30px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%);
    }
    .logo {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      position: relative;
      z-index: 1;
    }
    .logo-icon {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }
    .logo-text { font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px; }
    .header-title { font-size: 32px; font-weight: 700; color: #ffffff; margin-bottom: 10px; position: relative; z-index: 1; }
    .header-subtitle { font-size: 16px; color: #10b981; font-weight: 500; position: relative; z-index: 1; }
    .content { padding: 40px 30px; }
    .message { font-size: 15px; color: #4b5563; margin-bottom: 20px; line-height: 1.8; }
    .success-box {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      padding: 25px;
      border-radius: 12px;
      margin: 30px 0;
      text-align: center;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
    }
    .success-icon { font-size: 48px; margin-bottom: 10px; }
    .success-title { font-size: 24px; font-weight: 700; margin-bottom: 10px; }
    .success-message { font-size: 14px; opacity: 0.9; }
    .details-section {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .details-title { font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 15px; }
    .detail-row { display: flex; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { font-size: 13px; color: #6b7280; width: 140px; flex-shrink: 0; }
    .detail-value { font-size: 13px; color: #111827; font-weight: 500; }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }
    .items-table thead { background: #f9fafb; }
    .items-table th {
      padding: 12px;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      border-bottom: 2px solid #e5e7eb;
    }
    .items-table td { padding: 12px; font-size: 13px; color: #111827; border-bottom: 1px solid #f3f4f6; }
    .items-table tbody tr:last-child td { border-bottom: none; }
    .text-right { text-align: right; }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }
    .footer { background: #111827; color: #9ca3af; padding: 30px; text-align: center; font-size: 13px; }
    .footer-link { color: #10b981; text-decoration: none; margin: 0 10px; }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="header">
      <div class="logo">
        <div class="logo-icon">🍽️</div>
        <div class="logo-text">RestaurantOS</div>
      </div>
      <h1 class="header-title">Adjustment Approved ✅</h1>
      <p class="header-subtitle">Inventory Updated</p>
    </div>

    <div class="content">
      <p class="message">Hello ${recipientName || createdBy?.name || 'Admin'},</p>
      
      <div class="success-box">
        <div class="success-icon">✅</div>
        <div class="success-title">Adjustment Approved!</div>
        <div class="success-message">
          Your stock adjustment has been approved and the inventory has been updated.
        </div>
      </div>

      <div class="details-section">
        <div class="details-title">📦 Adjustment Details</div>
        <div class="detail-row">
          <div class="detail-label">Adjustment Number:</div>
          <div class="detail-value">${adjustmentNumber}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Type:</div>
          <div class="detail-value">${adjustmentTypeLabel}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Location:</div>
          <div class="detail-value">${locationId?.name || 'N/A'}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Approved By:</div>
          <div class="detail-value">${approvedBy?.name || 'N/A'}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Approved Date:</div>
          <div class="detail-value">${formattedApprovalDate}</div>
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th>Item</th>
            <th class="text-right">Previous Qty</th>
            <th class="text-right">Change</th>
            <th class="text-right">New Qty</th>
            <th>Unit</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => {
            const newQty = (item?.currentQuantity || 0) + (item?.quantityDelta || 0);
            const deltaDisplay = item?.quantityDelta >= 0 ? `+${item?.quantityDelta}` : `${item?.quantityDelta}`;
            const deltaColor = item?.quantityDelta >= 0 ? '#10b981' : '#ef4444';
            
            return `
          <tr>
            <td>${item?.inventoryItem?.name || 'Unknown Item'}</td>
            <td class="text-right">${item?.currentQuantity || 0}</td>
            <td class="text-right" style="color: ${deltaColor}; font-weight: 600;">${deltaDisplay}</td>
            <td class="text-right" style="font-weight: 600;">${newQty}</td>
            <td>${item?.inventoryItem?.unit || 'N/A'}</td>
          </tr>
          `;
          }).join('')}
        </tbody>
      </table>

      <div style="text-align: center;">
        <a href="${ENV.FRONTEND_URL}/inventory/adjustments" class="cta-button">View Adjustment Details →</a>
      </div>

      <p class="message" style="margin-top: 30px; font-weight: 600; color: #111827;">
        Best regards,<br>
        The RestaurantOS Team
      </p>
    </div>

    <div class="footer">
      <p>© ${new Date().getFullYear()} RestaurantOS. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;
  }
}

export default new StockAdjustmentEmailService();
