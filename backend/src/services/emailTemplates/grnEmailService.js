import emailService from '../emailService.js';
import { logger } from '../../utils/logger.js';
import { ENV } from '../../config/env.js';

class GRNEmailService {
  /**
   * Send GRN notification email with PDF attachment
   * @param {string} recipientEmail - Recipient email address
   * @param {Object} data - GRN details and PDF attachment
   */
  async sendGRNNotification(recipientEmail, data) {
    try {
      const { grnDetails, pdfAttachment } = data;

      const html = this.generateGRNEmailTemplate(grnDetails);

      // Reinitialize if transporter doesn't exist
      if (!emailService.transporter) {
        emailService.initialize();
      }

      const mailOptions = {
        from: `"${ENV.SMTP_FROM_NAME}" <${ENV.SMTP_FROM_EMAIL || ENV.SMTP_USER}>`,
        to: recipientEmail,
        subject: `New GRN Created: ${grnDetails.grnNumber}`,
        html,
        attachments: [{
          filename: `GRN-${grnDetails.grnNumber}.pdf`,
          content: pdfAttachment
        }]
      };

      const info = await emailService.transporter.sendMail(mailOptions);
      logger.info(`GRN notification email sent to ${recipientEmail}`, {
        messageId: info.messageId,
        grnNumber: grnDetails.grnNumber
      });

      return info;
    } catch (error) {
      logger.error('Error sending GRN notification email:', error);
      throw error;
    }
  }

  /**
   * Generate HTML email template for GRN notification
   * Follows existing email template theme (green, black, white)
   */
  generateGRNEmailTemplate(grnDetails) {
    const {
      grnNumber,
      branch,
      supplier,
      receivedDate,
      receivedBy,
      items,
      totalAmount,
      invoiceNumber,
      invoiceDate,
      notes
    } = grnDetails;

    const formattedDate = new Date(receivedDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(totalAmount);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New GRN Created</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background-color: #f9fafb;
    }
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
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
    .content {
      padding: 40px 30px;
    }
    .message {
      font-size: 15px;
      color: #4b5563;
      margin-bottom: 20px;
      line-height: 1.8;
    }
    .grn-summary {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      padding: 25px;
      border-radius: 12px;
      margin: 30px 0;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
    }
    .grn-summary-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    }
    .grn-summary-row:last-child {
      border-bottom: none;
      margin-top: 10px;
      padding-top: 15px;
      border-top: 2px solid rgba(255, 255, 255, 0.3);
    }
    .grn-summary-label {
      font-size: 14px;
      opacity: 0.9;
    }
    .grn-summary-value {
      font-size: 14px;
      font-weight: 600;
    }
    .grn-summary-total {
      font-size: 24px;
      font-weight: 700;
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
    .detail-row:last-child {
      border-bottom: none;
    }
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
    .items-table thead {
      background: #f9fafb;
    }
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
    .items-table tbody tr:last-child td {
      border-bottom: none;
    }
    .items-table tbody tr:hover {
      background: #f9fafb;
    }
    .text-right {
      text-align: right;
    }
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
      background: #f0fdf4;
      border-left: 4px solid #10b981;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .info-box-content {
      font-size: 13px;
      color: #047857;
      line-height: 1.6;
    }
    .footer {
      background: #111827;
      color: #9ca3af;
      padding: 30px;
      text-align: center;
      font-size: 13px;
    }
    .footer-links {
      margin: 15px 0;
    }
    .footer-link {
      color: #10b981;
      text-decoration: none;
      margin: 0 10px;
    }
    @media only screen and (max-width: 600px) {
      .header {
        padding: 30px 20px;
      }
      .content {
        padding: 30px 20px;
      }
      .header-title {
        font-size: 24px;
      }
      .items-table {
        font-size: 11px;
      }
      .items-table th,
      .items-table td {
        padding: 8px;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <!-- Header -->
    <div class="header">
      <div class="logo">
        <div class="logo-icon">🍽️</div>
        <div class="logo-text">RestaurantOS</div>
      </div>
      <h1 class="header-title">New GRN Created 📦</h1>
      <p class="header-subtitle">Goods Receipt Note</p>
    </div>

    <!-- Content -->
    <div class="content">
      <p class="message">
        A new Goods Receipt Note has been created and inventory has been updated.
      </p>

      <!-- GRN Summary -->
      <div class="grn-summary">
        <div class="grn-summary-row">
          <span class="grn-summary-label">GRN Number:</span>
          <span class="grn-summary-value">${grnNumber}</span>
        </div>
        <div class="grn-summary-row">
          <span class="grn-summary-label">Date:</span>
          <span class="grn-summary-value">${formattedDate}</span>
        </div>
        <div class="grn-summary-row">
          <span class="grn-summary-label">Supplier:</span>
          <span class="grn-summary-value">${supplier.name}</span>
        </div>
        <div class="grn-summary-row">
          <span class="grn-summary-label">Branch:</span>
          <span class="grn-summary-value">${branch.name}</span>
        </div>
        <div class="grn-summary-row">
          <span class="grn-summary-label">Total Amount:</span>
          <span class="grn-summary-total">${formattedAmount}</span>
        </div>
      </div>

      <!-- Supplier Details -->
      <div class="details-section">
        <div class="details-title">📋 Supplier Information</div>
        <div class="detail-row">
          <div class="detail-label">Supplier Name:</div>
          <div class="detail-value">${supplier.name}</div>
        </div>
        ${supplier.contactPerson ? `
        <div class="detail-row">
          <div class="detail-label">Contact Person:</div>
          <div class="detail-value">${supplier.contactPerson}</div>
        </div>
        ` : ''}
        ${supplier.phone ? `
        <div class="detail-row">
          <div class="detail-label">Phone:</div>
          <div class="detail-value">${supplier.phone}</div>
        </div>
        ` : ''}
        ${supplier.email ? `
        <div class="detail-row">
          <div class="detail-label">Email:</div>
          <div class="detail-value">${supplier.email}</div>
        </div>
        ` : ''}
      </div>

      <!-- GRN Details -->
      <div class="details-section">
        <div class="details-title">📦 GRN Details</div>
        <div class="detail-row">
          <div class="detail-label">GRN Number:</div>
          <div class="detail-value">${grnNumber}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Received Date:</div>
          <div class="detail-value">${formattedDate}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Received By:</div>
          <div class="detail-value">${receivedBy.name}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Branch:</div>
          <div class="detail-value">${branch.name} (${branch.code})</div>
        </div>
        ${invoiceNumber ? `
        <div class="detail-row">
          <div class="detail-label">Invoice Number:</div>
          <div class="detail-value">${invoiceNumber}</div>
        </div>
        ` : ''}
        ${invoiceDate ? `
        <div class="detail-row">
          <div class="detail-label">Invoice Date:</div>
          <div class="detail-value">${new Date(invoiceDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
        ` : ''}
      </div>

      <!-- Line Items Table -->
      <table class="items-table">
        <thead>
          <tr>
            <th>Item</th>
            <th class="text-right">Qty</th>
            <th>Unit</th>
            <th class="text-right">Unit Price</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
          <tr>
            <td>${item.inventoryItem.name}</td>
            <td class="text-right">${item.quantity}</td>
            <td>${item.unit}</td>
            <td class="text-right">$${item.unitPrice.toFixed(2)}</td>
            <td class="text-right">$${item.totalPrice.toFixed(2)}</td>
          </tr>
          `).join('')}
          <tr style="background: #f9fafb; font-weight: 600;">
            <td colspan="4" style="text-align: right; padding-right: 12px;">Total Amount:</td>
            <td class="text-right">${formattedAmount}</td>
          </tr>
        </tbody>
      </table>

      ${notes ? `
      <!-- Notes -->
      <div class="info-box">
        <div class="info-box-content">
          <strong>Notes:</strong> ${notes}
        </div>
      </div>
      ` : ''}

      <!-- Info Box -->
      <div class="info-box">
        <div class="info-box-content">
          📎 A detailed PDF receipt is attached to this email for your records.
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center;">
        <a href="${ENV.FRONTEND_URL}/inventory/grn/${grnDetails._id}" class="cta-button">View GRN Details →</a>
      </div>

      <p class="message" style="margin-top: 30px; font-weight: 600; color: #111827;">
        Best regards,<br>
        The RestaurantOS Team
      </p>
    </div>

    <!-- Footer -->
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
}

export default new GRNEmailService();
