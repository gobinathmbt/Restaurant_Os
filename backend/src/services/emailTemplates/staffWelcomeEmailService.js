import emailService from '../emailService.js';
import CompanyUser from '../../models/platform/CompanyUser.js';
import Company from '../../models/platform/Company.js';
import { getCompanyDB } from '../../config/database.js';
import { getBranchModel } from '../../models/company/Branch.js';
import { logger } from '../../utils/logger.js';
import { ENV } from '../../config/env.js';

class StaffWelcomeEmailService {
  /**
   * Send welcome email to new staff member with branch information
   * @param {Object} data - User and company data
   */
  async sendStaffWelcomeEmail(data) {
    try {
      const {
        userName,
        userEmail,
        userRole,
        companyId,
        companyName,
        branchIds = [],
        createdBy,
        bccEmails = []
      } = data;

      // Get branch details if branchIds provided
      let branches = [];
      if (branchIds.length > 0) {
        const companyDB = getCompanyDB(companyId);
        const Branch = getBranchModel(companyDB);
        branches = await Branch.find({ _id: { $in: branchIds } }).select('name code address');
      }

      // Reinitialize if transporter doesn't exist
      if (!emailService.transporter) {
        emailService.initialize();
      }

      const html = this.generateStaffWelcomeEmailTemplate({
        userName,
        userRole,
        companyName,
        branches,
        createdBy,
        dashboardUrl: `${ENV.FRONTEND_URL}/dashboard`,
        supportEmail: ENV.SMTP_FROM_EMAIL || ENV.SMTP_USER
      });

      const mailOptions = {
        from: `"${ENV.SMTP_FROM_NAME}" <${ENV.SMTP_FROM_EMAIL || ENV.SMTP_USER}>`,
        to: userEmail,
        subject: `Welcome to ${companyName} - Your Account is Ready! 🎉`,
        html
      };

      // Add BCC if provided
      if (bccEmails.length > 0) {
        mailOptions.bcc = bccEmails.join(', ');
      }

      const info = await emailService.transporter.sendMail(mailOptions);
      logger.info(`Staff welcome email sent to ${userEmail}${bccEmails.length > 0 ? ` with BCC to ${bccEmails.length} users` : ''}`, {
        messageId: info.messageId,
        companyId,
        userRole
      });

      return info;
    } catch (error) {
      logger.error('Error sending staff welcome email:', error);
      throw error;
    }
  }

  /**
   * Generate modern HTML email template for staff welcome
   */
  generateStaffWelcomeEmailTemplate(data) {
    const {
      userName,
      userRole,
      companyName,
      branches = [],
      createdBy,
      dashboardUrl,
      supportEmail
    } = data;

    const roleLabels = {
      company_super_admin_secondary: 'Super Admin (Secondary)',
      company_admin: 'Branch Admin',
      employee: 'Employee'
    };

    const roleColors = {
      company_super_admin_secondary: '#8B5CF6',
      company_admin: '#10B981',
      employee: '#6B7280'
    };

    const roleLabel = roleLabels[userRole] || userRole;
    const roleColor = roleColors[userRole] || '#10B981';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${companyName}</title>
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
    .greeting {
      font-size: 20px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 20px;
    }
    .message {
      font-size: 15px;
      color: #4b5563;
      margin-bottom: 20px;
      line-height: 1.8;
    }
    .role-badge {
      background: ${roleColor};
      color: #ffffff;
      padding: 20px;
      border-radius: 12px;
      text-align: center;
      margin: 30px 0;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    .role-badge-title {
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
      opacity: 0.9;
    }
    .role-badge-role {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 5px;
    }
    .role-badge-text {
      font-size: 14px;
      opacity: 0.95;
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
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .info-box-title {
      font-size: 14px;
      font-weight: 600;
      color: #065f46;
      margin-bottom: 8px;
    }
    .info-box-content {
      font-size: 13px;
      color: #047857;
      line-height: 1.6;
    }
    .branches-section {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .branches-title {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .branch-item {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 10px;
    }
    .branch-item:last-child {
      margin-bottom: 0;
    }
    .branch-name {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 4px;
    }
    .branch-code {
      font-size: 12px;
      color: #6b7280;
      display: inline-block;
      background: #e5e7eb;
      padding: 2px 8px;
      border-radius: 4px;
      margin-right: 8px;
    }
    .branch-address {
      font-size: 12px;
      color: #6b7280;
      margin-top: 4px;
    }
    .account-details {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .account-details-title {
      font-size: 14px;
      font-weight: 600;
      color: #6b7280;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
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
    .support-section {
      background: #f9fafb;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin: 30px 0;
    }
    .support-title {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 10px;
    }
    .support-text {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 15px;
    }
    .support-email {
      color: #10b981;
      text-decoration: none;
      font-weight: 600;
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
      .role-badge-role {
        font-size: 24px;
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
      <h1 class="header-title">Welcome to the Team! 🎉</h1>
      <p class="header-subtitle">Your account has been created</p>
    </div>

    <!-- Content -->
    <div class="content">
      <h2 class="greeting">Hi ${userName},</h2>
      
      <p class="message">
        Welcome to <strong>${companyName}</strong>! Your account has been created by ${createdBy} and you're now part of the team.
      </p>

      <p class="message">
        You can now access the RestaurantOS platform to manage your daily tasks and collaborate with your team.
      </p>

      <!-- Role Badge -->
      <div class="role-badge">
        <div class="role-badge-title">Your Role</div>
        <div class="role-badge-role">${roleLabel}</div>
        <div class="role-badge-text">at ${companyName}</div>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center;">
        <a href="${dashboardUrl}" class="cta-button">Access Your Dashboard →</a>
      </div>

      ${branches.length > 0 ? `
      <!-- Branches Section -->
      <div class="branches-section">
        <div class="branches-title">
          📍 Your Assigned Branches
        </div>
        <p class="message" style="margin-top: 0; margin-bottom: 15px; font-size: 13px;">
          You have access to the following branch${branches.length > 1 ? 'es' : ''}:
        </p>
        ${branches.map(branch => `
        <div class="branch-item">
          <div class="branch-name">${branch.name}</div>
          <div>
            <span class="branch-code">${branch.code}</span>
            ${branch.address ? `<span class="branch-address">${branch.address.street ? branch.address.street + ', ' : ''}${branch.address.city || ''}</span>` : ''}
          </div>
        </div>
        `).join('')}
      </div>
      ` : ''}

      <!-- Info Box -->
      <div class="info-box">
        <div class="info-box-title">🚀 Getting Started</div>
        <div class="info-box-content">
          <strong>1.</strong> Log in to your dashboard using your email<br>
          <strong>2.</strong> Complete your profile setup<br>
          <strong>3.</strong> Familiarize yourself with the system<br>
          <strong>4.</strong> Reach out to your manager if you need help
        </div>
      </div>

      <!-- Account Details -->
      <div class="account-details">
        <div class="account-details-title">Your Account Details</div>
        <div class="detail-row">
          <div class="detail-label">Company:</div>
          <div class="detail-value">${companyName}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Role:</div>
          <div class="detail-value">${roleLabel}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Email:</div>
          <div class="detail-value">${data.userEmail || 'Your registered email'}</div>
        </div>
        ${branches.length > 0 ? `
        <div class="detail-row">
          <div class="detail-label">Branch Access:</div>
          <div class="detail-value">${branches.length} branch${branches.length > 1 ? 'es' : ''}</div>
        </div>
        ` : ''}
        <div class="detail-row">
          <div class="detail-label">Dashboard:</div>
          <div class="detail-value"><a href="${dashboardUrl}" style="color: #10b981; text-decoration: none;">${dashboardUrl}</a></div>
        </div>
      </div>

      <!-- Support Section -->
      <div class="support-section">
        <h3 class="support-title">Need Help?</h3>
        <p class="support-text">
          If you have any questions or need assistance, don't hesitate to reach out.
        </p>
        <a href="mailto:${supportEmail}" class="support-email">${supportEmail}</a>
      </div>

      <p class="message" style="margin-top: 30px;">
        We're excited to have you on board!
      </p>

      <p class="message" style="margin-top: 20px; font-weight: 600; color: #111827;">
        Best regards,<br>
        The ${companyName} Team
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
        This email was sent to you because an account was created for you at ${companyName}.<br>
        If you believe this was sent in error, please contact your administrator.
      </p>
    </div>
  </div>
</body>
</html>
    `;
  }
}

export default new StaffWelcomeEmailService();
