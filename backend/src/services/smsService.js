import axios from 'axios';
import { logger } from '../utils/logger.js';
import { ENV } from '../config/env.js';

class SMSService {
  constructor() {
    this.provider = null;
    this.twilioAccountSid = null;
    this.twilioAuthToken = null;
    this.twilioPhoneNumber = null;
  }

  initialize() {
    this.provider = ENV.SMS_PROVIDER;
    
    switch (this.provider) {
      case 'twilio':
        this.twilioAccountSid = ENV.TWILIO_ACCOUNT_SID;
        this.twilioAuthToken = ENV.TWILIO_AUTH_TOKEN;
        this.twilioPhoneNumber = ENV.TWILIO_PHONE_NUMBER;
        break;
      case 'aws-sns':
        // AWS SNS configuration
        break;
      default:
        logger.warn('SMS provider not configured');
    }
  }

  // Reinitialize with latest config
  reinitialize() {
    this.initialize();
    logger.info('SMS service reinitialized with updated configuration');
  }

  async sendNotification(to, data) {
    try {
      // Initialize if not already done
      if (!this.provider) {
        this.initialize();
      }

      const { message } = data;

      switch (this.provider) {
        case 'twilio':
          return await this.sendViaTwilio(to, message);
        case 'aws-sns':
          return await this.sendViaAWS(to, message);
        default:
          logger.warn('SMS service not configured');
          return null;
      }
    } catch (error) {
      logger.error('Error sending SMS:', error);
      throw error;
    }
  }

  async sendViaTwilio(to, message) {
    if (!this.twilioAccountSid || !this.twilioAuthToken) {
      logger.warn('Twilio not configured');
      return null;
    }

    const formattedPhone = to.startsWith('+') ? to : `+${to}`;

    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${this.twilioAccountSid}/Messages.json`,
      new URLSearchParams({
        To: formattedPhone,
        From: this.twilioPhoneNumber,
        Body: message
      }),
      {
        auth: {
          username: this.twilioAccountSid,
          password: this.twilioAuthToken
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    logger.info(`SMS sent via Twilio to ${formattedPhone}`);
    return response.data;
  }

  async sendViaAWS(to, message) {
    // Implement AWS SNS SMS sending
    logger.warn('AWS SNS SMS not implemented yet');
    return null;
  }

  async sendVerificationCode(to, code) {
    return await this.sendNotification(to, {
      message: `Your ${ENV.SMTP_FROM_NAME || 'RestaurantOS'} verification code is: ${code}. Valid for 10 minutes.`
    });
  }
}

export default new SMSService();
