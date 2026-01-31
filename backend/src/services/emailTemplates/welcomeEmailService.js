import emailService from '../emailService.js';
import PlatformAdmin from '../../models/platform/PlatformAdmin.js';
import { logger } from '../../utils/logger.js';
import { ENV } from '../../config/env.js';

class WelcomeEmailService {
  /**
   * Send welcome email to new company with BCC to all platform admins
   * @param {Object} data - Company and user data
   */
  async sendWelcomeEmail(data) {
    try {
      const {
        adminName,
        email,
        companyName,
        companyId,
        trialEndDate,
        phone,
        address
      } = data;

      // Get all active platform admin emails for BCC
      const platformAdmins = await PlatformAdmin.find({ isActive: true }).select('email');
      const bccEmails = platformAdmins.map(admin => admin.email).filter(Boolean);

      const trialDays = Math.ceil((new Date(trialEndDate) - new Date()) / (1000 * 60 * 60 * 24));
      const formattedTrialEndDate = new Date(trialEndDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const html = this.generateWelcomeEmailTemplate({
        adminName,
        companyName,
        companyId,
        trialDays,
        formattedTrialEndDate,
        dashboardUrl: `${ENV.FRONTEND_URL}/dashboard`,
        supportEmail: ENV.SMTP_FROM_EMAIL || ENV.SMTP_USER
      });

      // Reinitialize if transporter doesn't exist
      if (!emailService.transporter) {
        emailService.initialize();
      }

      const mailOptions = {
        from: `"${ENV.SMTP_FROM_NAME}" <${ENV.SMTP_FROM_EMAIL || ENV.SMTP_USER}>`,
        to: email,
        bcc: bccEmails.join(', '),
        subject: `Welcome to RestaurantOS - Your ${trialDays}-Day Trial Starts Now! 🎉`,
        html
      };

      const info = await emailService.transporter.sendMail(mailOptions);
      logger.info(`Welcome email sent to ${email} with BCC to ${bccEmails.length} platform admins`, {
        messageId: info.messageId,
        companyId,
        companyName
      });

      return info;
    } catch (error) {
      logger.error('Error sending welcome email:', error);
      throw error;
    }
  }

  /**
   * Generate modern HTML email template with green, black, and white theme
   */
  generateWelcomeEmailTemplate(data) {
    const {
      adminName,
      companyName,
      companyId,
      trialDays,
      formattedTrialEndDate,
      dashboardUrl,
      supportEmail
    } = data;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to RestaurantOS</title>
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
      margin-bottom: 30px;
      line-height: 1.8;
    }
    .trial-badge {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      padding: 20px;
      border-radius: 12px;
      text-align: center;
      margin: 30px 0;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
    }
    .trial-badge-title {
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
      opacity: 0.9;
    }
    .trial-badge-days {
      font-size: 42px;
      font-weight: 700;
      margin-bottom: 5px;
    }
    .trial-badge-text {
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
    .features {
      background: #f9fafb;
      border-radius: 12px;
      padding: 30px;
      margin: 30px 0;
    }
    .features-title {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 20px;
      text-align: center;
    }
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
    }
    .feature-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .feature-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 20px;
    }
    .feature-content {
      flex: 1;
    }
    .feature-title {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 4px;
    }
    .feature-desc {
      font-size: 13px;
      color: #6b7280;
      line-height: 1.5;
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
    .company-details {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .company-details-title {
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
    .social-icons {
      margin: 20px 0;
    }
    .social-icon {
      display: inline-block;
      width: 36px;
      height: 36px;
      background: #1f2937;
      border-radius: 50%;
      margin: 0 5px;
      line-height: 36px;
      color: #10b981;
      text-decoration: none;
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
      .feature-grid {
        grid-template-columns: 1fr;
      }
      .trial-badge-days {
        font-size: 36px;
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
      <h1 class="header-title">Welcome Aboard! 🎉</h1>
      <p class="header-subtitle">Your Restaurant Management Journey Starts Here</p>
    </div>

    <!-- Content -->
    <div class="content">
      <h2 class="greeting">Hi ${adminName},</h2>
      
      <p class="message">
        Welcome to <strong>RestaurantOS</strong>! We're thrilled to have <strong>${companyName}</strong> join our growing family of successful restaurants.
      </p>

      <p class="message">
        Your account is now active and ready to transform how you manage your restaurant operations. From lightning-fast billing to real-time inventory tracking, we've got everything you need to run your business smoothly.
      </p>

      <!-- Trial Badge -->
      <div class="trial-badge">
        <div class="trial-badge-title">Your Free Trial</div>
        <div class="trial-badge-days">${trialDays} Days</div>
        <div class="trial-badge-text">Full access to all premium features until ${formattedTrialEndDate}</div>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center;">
        <a href="${dashboardUrl}" class="cta-button">Access Your Dashboard →</a>
      </div>

      <!-- Features -->
      <div class="features">
        <h3 class="features-title">What You Can Do Right Now</h3>
        <div class="feature-grid">
          <div class="feature-item">
            <div class="feature-icon">💳</div>
            <div class="feature-content">
              <div class="feature-title">Smart Billing</div>
              <div class="feature-desc">Lightning-fast POS with KOT integration</div>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon">📦</div>
            <div class="feature-content">
              <div class="feature-title">Inventory Control</div>
              <div class="feature-desc">Real-time stock tracking & alerts</div>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon">👥</div>
            <div class="feature-content">
              <div class="feature-title">Customer CRM</div>
              <div class="feature-desc">Build loyalty with smart campaigns</div>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon">📊</div>
            <div class="feature-content">
              <div class="feature-title">Analytics</div>
              <div class="feature-desc">Real-time insights & reports</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Info Box -->
      <div class="info-box">
        <div class="info-box-title">🚀 Quick Start Tips</div>
        <div class="info-box-content">
          <strong>1.</strong> Set up your first branch and menu items<br>
          <strong>2.</strong> Add your team members and assign roles<br>
          <strong>3.</strong> Configure your inventory and suppliers<br>
          <strong>4.</strong> Start processing orders and track everything in real-time
        </div>
      </div>

      <!-- Company Details -->
      <div class="company-details">
        <div class="company-details-title">Your Account Details</div>
        <div class="detail-row">
          <div class="detail-label">Company Name:</div>
          <div class="detail-value">${companyName}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Company ID:</div>
          <div class="detail-value">${companyId}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Trial Ends:</div>
          <div class="detail-value">${formattedTrialEndDate}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Dashboard:</div>
          <div class="detail-value"><a href="${dashboardUrl}" style="color: #10b981; text-decoration: none;">${dashboardUrl}</a></div>
        </div>
      </div>

      <!-- Support Section -->
      <div class="support-section">
        <h3 class="support-title">Need Help Getting Started?</h3>
        <p class="support-text">
          Our support team is here to help you every step of the way.
        </p>
        <a href="mailto:${supportEmail}" class="support-email">${supportEmail}</a>
      </div>

      <p class="message" style="margin-top: 30px;">
        Thank you for choosing RestaurantOS. We're excited to be part of your success story!
      </p>

      <p class="message" style="margin-top: 20px; font-weight: 600; color: #111827;">
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
        This email was sent to you because you registered for RestaurantOS.<br>
        If you didn't create this account, please contact us immediately.
      </p>
    </div>
  </div>
</body>
</html>
    `;
  }
}

export default new WelcomeEmailService();
