import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialize();
  }

  initialize() {
    // Configure email transporter
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendNotificationEmail(to, data) {
    try {
      const { title, message, actionUrl, priority } = data;

      const priorityColors = {
        low: '#6B7280',
        medium: '#3B82F6',
        high: '#F59E0B',
        urgent: '#EF4444'
      };

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${priorityColors[priority] || '#3B82F6'}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 20px; color: #6B7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>${title}</h2>
            </div>
            <div class="content">
              <p>${message}</p>
              ${actionUrl ? `<a href="${actionUrl}" class="button">View Details</a>` : ''}
            </div>
            <div class="footer">
              <p>RestaurantOS - Restaurant Management Platform</p>
              <p>This is an automated notification. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        from: `"RestaurantOS" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to,
        subject: title,
        html
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error('Error sending email:', error);
      throw error;
    }
  }

  async sendVerificationEmail(to, verificationToken) {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    
    return await this.sendNotificationEmail(to, {
      title: 'Verify Your Email Address',
      message: 'Please click the button below to verify your email address and enable email notifications.',
      actionUrl: verificationUrl,
      priority: 'medium'
    });
  }

  async testConnection() {
    try {
      await this.transporter.verify();
      logger.info('Email service connection verified');
      return true;
    } catch (error) {
      logger.error('Email service connection failed:', error);
      return false;
    }
  }
}

export default new EmailService();
