import axios from 'axios';
import { logger } from '../utils/logger.js';

class WhatsAppService {
  constructor() {
    this.apiUrl = process.env.WHATSAPP_API_URL;
    this.apiKey = process.env.WHATSAPP_API_KEY;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  }

  async sendNotification(to, data) {
    try {
      if (!this.apiUrl || !this.apiKey) {
        logger.warn('WhatsApp service not configured');
        return null;
      }

      const { title, message, actionUrl } = data;

      // Format phone number (remove + and spaces)
      const formattedPhone = to.replace(/[^0-9]/g, '');

      // Construct message
      let fullMessage = `*${title}*\n\n${message}`;
      if (actionUrl) {
        fullMessage += `\n\n${actionUrl}`;
      }

      // Send via WhatsApp Business API
      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: 'text',
          text: {
            body: fullMessage
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`WhatsApp message sent to ${formattedPhone}`);
      return response.data;
    } catch (error) {
      logger.error('Error sending WhatsApp message:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendVerificationCode(to, code) {
    return await this.sendNotification(to, {
      title: 'Verification Code',
      message: `Your verification code is: ${code}\n\nThis code will expire in 10 minutes.`
    });
  }

  async verifyWebhook(mode, token, challenge) {
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('WhatsApp webhook verified');
      return challenge;
    }

    throw new Error('Webhook verification failed');
  }

  async handleWebhook(body) {
    try {
      // Handle incoming WhatsApp messages/status updates
      logger.info('WhatsApp webhook received:', JSON.stringify(body));

      if (body.entry?.[0]?.changes?.[0]?.value?.statuses) {
        // Handle message status updates
        const statuses = body.entry[0].changes[0].value.statuses;
        for (const status of statuses) {
          logger.info(`Message ${status.id} status: ${status.status}`);
        }
      }

      return { success: true };
    } catch (error) {
      logger.error('Error handling WhatsApp webhook:', error);
      throw error;
    }
  }
}

export default new WhatsAppService();
