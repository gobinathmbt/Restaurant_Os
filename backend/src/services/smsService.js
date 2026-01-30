import axios from 'axios';
import { logger } from '../utils/logger.js';

class SMSService {
  constructor() {
    this.provider = process.env.SMS_PROVIDER || 'twilio'; // twilio, aws-sns, etc.
    this.initializeProvider();
  }

  initializeProvider() {
    switch (this.provider) {
      case 'twilio':
        this.twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
        this.twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
        this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
        break;
      case 'aws-sns':
        // AWS SNS configuration
        break;
      default:
        logger.warn('SMS provider not configured');
    }
  }

  async sendNotification(to, data) {
    try {
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
      message: `Your RestaurantOS verification code is: ${code}. Valid for 10 minutes.`
    });
  }
}

export default new SMSService();
