/**
 * Seed Platform Configurations
 * Populates the PlatformConfig collection with initial configuration values
 * 
 * Usage: node scripts/seed-platform-configs.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PlatformConfig from '../src/models/platform/PlatformConfig.js';
import { logger } from '../src/utils/logger.js';

dotenv.config();

const configs = [
  // Authentication Configurations
  {
    configKey: 'JWT_SECRET',
    configValue: process.env.JWT_SECRET || 'default_jwt_secret_change_me_in_production',
    description: 'Secret key for JWT token generation and verification',
    category: 'auth',
    isSecret: true,
    isActive: true,
    isEditable: true,
  },
  {
    configKey: 'JWT_EXPIRE',
    configValue: '7d',
    description: 'JWT token expiration time (e.g., 7d, 24h, 60m)',
    category: 'auth',
    isSecret: false,
    isActive: true,
    isEditable: true,
  },
  {
    configKey: 'GOOGLE_CLIENT_ID',
    configValue: process.env.GOOGLE_CLIENT_ID || '',
    description: 'Google OAuth 2.0 Client ID',
    category: 'auth',
    isSecret: false,
    isActive: true,
    isEditable: true,
  },
  {
    configKey: 'GOOGLE_CLIENT_SECRET',
    configValue: process.env.GOOGLE_CLIENT_SECRET || '',
    description: 'Google OAuth 2.0 Client Secret',
    category: 'auth',
    isSecret: true,
    isActive: true,
    isEditable: true,
  },
  {
    configKey: 'GOOGLE_CALLBACK_URL',
    configValue: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
    description: 'Google OAuth callback URL',
    category: 'auth',
    isSecret: false,
    isActive: true,
    isEditable: true,
  },

  // Payment Configurations
  {
    configKey: 'RAZORPAY_KEY_ID',
    configValue: process.env.RAZORPAY_KEY_ID || '',
    description: 'Razorpay API Key ID for payment processing',
    category: 'payment',
    isSecret: false,
    isActive: true,
    isEditable: true,
  },
  {
    configKey: 'RAZORPAY_KEY_SECRET',
    configValue: process.env.RAZORPAY_KEY_SECRET || '',
    description: 'Razorpay API Key Secret',
    category: 'payment',
    isSecret: true,
    isActive: true,
    isEditable: true,
  },
  {
    configKey: 'CASHFREE_APP_ID',
    configValue: process.env.CASHFREE_APP_ID || '',
    description: 'Cashfree Application ID for payment processing',
    category: 'payment',
    isSecret: false,
    isActive: false,
    isEditable: true,
  },
  {
    configKey: 'CASHFREE_SECRET_KEY',
    configValue: process.env.CASHFREE_SECRET_KEY || '',
    description: 'Cashfree Secret Key',
    category: 'payment',
    isSecret: true,
    isActive: false,
    isEditable: true,
  },

  // Email Configurations
  {
    configKey: 'SMTP_HOST',
    configValue: process.env.SMTP_HOST || '',
    description: 'SMTP server hostname for sending emails',
    category: 'email',
    isSecret: false,
    isActive: true,
    isEditable: true,
  },
  {
    configKey: 'SMTP_PORT',
    configValue: parseInt(process.env.SMTP_PORT || '587'),
    description: 'SMTP server port (usually 587 for TLS or 465 for SSL)',
    category: 'email',
    isSecret: false,
    isActive: true,
    isEditable: true,
  },
  {
    configKey: 'SMTP_USER',
    configValue: process.env.SMTP_USER || '',
    description: 'SMTP authentication username',
    category: 'email',
    isSecret: false,
    isActive: true,
    isEditable: true,
  },
  {
    configKey: 'SMTP_PASS',
    configValue: process.env.SMTP_PASS || '',
    description: 'SMTP authentication password',
    category: 'email',
    isSecret: true,
    isActive: true,
    isEditable: true,
  },
  {
    configKey: 'SMTP_FROM_EMAIL',
    configValue: process.env.SMTP_FROM_EMAIL || 'noreply@restaurantos.com',
    description: 'Default sender email address',
    category: 'email',
    isSecret: false,
    isActive: true,
    isEditable: true,
  },
  {
    configKey: 'SMTP_FROM_NAME',
    configValue: process.env.SMTP_FROM_NAME || 'RestaurantOS',
    description: 'Default sender name',
    category: 'email',
    isSecret: false,
    isActive: true,
    isEditable: true,
  },

  // AWS S3 Storage Configurations
  {
    configKey: 'AWS_S3_BUCKET',
    configValue: process.env.AWS_S3_BUCKET || '',
    description: 'AWS S3 bucket name for file storage',
    category: 'storage',
    isSecret: false,
    isActive: true,
    isEditable: true,
  },
  {
    configKey: 'AWS_S3_REGION',
    configValue: process.env.AWS_S3_REGION || 'us-east-1',
    description: 'AWS S3 bucket region',
    category: 'storage',
    isSecret: false,
    isActive: true,
    isEditable: true,
  },
  {
    configKey: 'AWS_ACCESS_KEY_ID',
    configValue: process.env.AWS_ACCESS_KEY_ID || '',
    description: 'AWS IAM Access Key ID',
    category: 'storage',
    isSecret: true,
    isActive: true,
    isEditable: true,
  },
  {
    configKey: 'AWS_SECRET_ACCESS_KEY',
    configValue: process.env.AWS_SECRET_ACCESS_KEY || '',
    description: 'AWS IAM Secret Access Key',
    category: 'storage',
    isSecret: true,
    isActive: true,
    isEditable: true,
  },
  {
    configKey: 'AWS_S3_URL',
    configValue: process.env.AWS_S3_URL || '',
    description: 'AWS S3 bucket public URL (e.g., https://bucket-name.s3.region.amazonaws.com)',
    category: 'storage',
    isSecret: false,
    isActive: true,
    isEditable: true,
  },

  // SMS Configurations
  {
    configKey: 'SMS_PROVIDER',
    configValue: process.env.SMS_PROVIDER || 'twilio',
    description: 'SMS service provider (twilio, msg91, etc.)',
    category: 'sms',
    isSecret: false,
    isActive: false,
    isEditable: true,
  },
  {
    configKey: 'SMS_API_KEY',
    configValue: process.env.SMS_API_KEY || '',
    description: 'SMS provider API key',
    category: 'sms',
    isSecret: true,
    isActive: false,
    isEditable: true,
  },
  {
    configKey: 'SMS_SENDER_ID',
    configValue: process.env.SMS_SENDER_ID || '',
    description: 'SMS sender ID or phone number',
    category: 'sms',
    isSecret: false,
    isActive: false,
    isEditable: true,
  },

  // Notification Configurations
  {
    configKey: 'WHATSAPP_API_KEY',
    configValue: process.env.WHATSAPP_API_KEY || '',
    description: 'WhatsApp Business API key',
    category: 'notification',
    isSecret: true,
    isActive: false,
    isEditable: true,
  },
  {
    configKey: 'WHATSAPP_PHONE_NUMBER_ID',
    configValue: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    description: 'WhatsApp Business phone number ID',
    category: 'notification',
    isSecret: false,
    isActive: false,
    isEditable: true,
  },
  {
    configKey: 'PUSH_NOTIFICATION_KEY',
    configValue: process.env.PUSH_NOTIFICATION_KEY || '',
    description: 'Push notification service API key (FCM, OneSignal, etc.)',
    category: 'notification',
    isSecret: true,
    isActive: false,
    isEditable: true,
  },
];

async function seedPlatformConfigs() {
  try {
    logger.info('Connecting to Platform Database...');
    await mongoose.connect(process.env.PLATFORM_DB_URI);
    logger.info('Connected to Platform Database');

    logger.info('Seeding platform configurations...');

    for (const config of configs) {
      const existing = await PlatformConfig.findOne({ configKey: config.configKey });
      
      if (existing) {
        logger.info(`Configuration already exists: ${config.configKey} - Skipping`);
      } else {
        await PlatformConfig.create(config);
        logger.info(`Created configuration: ${config.configKey}`);
      }
    }

    logger.info('Platform configurations seeded successfully!');
    logger.info(`Total configurations: ${configs.length}`);

    // Display summary
    const summary = await PlatformConfig.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          active: {
            $sum: { $cond: ['$isActive', 1, 0] },
          },
        },
      },
    ]);

    logger.info('Configuration Summary:');
    summary.forEach((item) => {
      logger.info(`  ${item._id}: ${item.count} total, ${item.active} active`);
    });

    process.exit(0);
  } catch (error) {
    logger.error('Error seeding platform configurations:', error);
    process.exit(1);
  }
}

seedPlatformConfigs();
