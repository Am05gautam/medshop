const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const logger = require('../utils/logger');

class WhatsAppService {
  constructor() {
    const apiVersion = process.env.WHATSAPP_API_VERSION || 'v22.0';
    const baseUrl = process.env.WHATSAPP_API_URL || `https://graph.facebook.com/${apiVersion}`;
    this.apiUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.token = this.sanitizeToken(process.env.WHATSAPP_TOKEN || '');
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.webhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  }

  sanitizeToken(raw) {
    // Remove surrounding quotes, spaces, and any newlines that often sneak in when pasting
    return String(raw)
      .replace(/^"|"$/g, '')
      .replace(/^'|'$/g, '')
      .replace(/\s+/g, '')
      .trim();
  }

  hasValidCredentials() {
    if (!this.token || !this.phoneNumberId) {
      logger.warn('WhatsApp credentials not configured');
      return false;
    }
    // Basic sanity check for FB tokens (typically start with EA... and are long)
    if (this.token.length < 50) {
      logger.error('WhatsApp token appears malformed or too short. Check environment configuration.');
      return false;
    }
    return true;
  }

  async sendMessage(to, message) {
    try {
      if (!this.hasValidCredentials()) {
        return false;
      }

      const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: {
          body: message
        }
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      logger.info('WhatsApp message sent successfully:', response.data);
      return true;
    } catch (error) {
      const err = error.response?.data?.error;
      if (err?.code === 190) {
        logger.error('WhatsApp OAuth error (190): Malformed or invalid access token. Please verify WHATSAPP_TOKEN.');
      }
      logger.error('Failed to send WhatsApp message:', error.response?.data || error.message);
      return false;
    }
  }


  async sendDocument(to, filePath, fileName, caption = '') {
    try {
      if (!this.hasValidCredentials()) {
        return false;
      }

      // First, upload the media to WhatsApp
      const mediaId = await this.uploadMedia(filePath);
      if (!mediaId) {
        return false;
      }

      const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'document',
        document: {
          id: mediaId,
          filename: fileName,
          caption: caption
        }
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      logger.info('WhatsApp document sent successfully:', response.data);
      return true;
    } catch (error) {
      const err = error.response?.data?.error;
      if (err?.code === 190) {
        logger.error('WhatsApp OAuth error (190): Malformed or invalid access token. Please verify WHATSAPP_TOKEN.');
      }
      logger.error('Failed to send WhatsApp document:', error.response?.data || error.message);
      return false;
    }
  }

  async uploadMedia(filePath) {
    try {
      if (!this.hasValidCredentials()) {
        return null;
      }
      const form = new FormData();
      form.append('file', fs.createReadStream(filePath));
      form.append('messaging_product', 'whatsapp');

      const response = await axios.post(`${this.apiUrl}/${this.phoneNumberId}/media`, form, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          ...form.getHeaders()
        }
      });

      logger.info('Media uploaded successfully:', response.data);
      return response.data.id;
    } catch (error) {
      const err = error.response?.data?.error;
      if (err?.code === 190) {
        logger.error('WhatsApp OAuth error (190): Malformed or invalid access token. Please verify WHATSAPP_TOKEN.');
      }
      logger.error('Failed to upload media:', error.response?.data || error.message);
      return null;
    }
  }

  async sendWeeklyAlertReport() {
    try {
      const alertReportService = require('./alertReportService');
      const reportResult = await alertReportService.generateWeeklyAlertReport();
      
      const adminPhones = this.getAdminPhoneNumbers();
      if (adminPhones.length === 0) {
        logger.warn('No admin phone numbers configured for weekly alerts');
        return false;
      }

      const message = this.formatWeeklyAlertMessage(reportResult.reportData);
      let allSent = true;

      for (const phone of adminPhones) {
        // Send text message first
        const textSent = await this.sendMessage(phone, message);
        if (!textSent) {
          allSent = false;
          continue;
        }

        // Send PDF report
        const pdfSent = await this.sendDocument(
          phone, 
          reportResult.filepath, 
          reportResult.filename,
          '📊 Weekly Alert Report - Gautam Medicals'
        );
        
        if (!pdfSent) {
          allSent = false;
        }
      }

      // Clean up the PDF file after sending
      try {
        fs.unlinkSync(reportResult.filepath);
        logger.info('Weekly alert report PDF cleaned up');
      } catch (cleanupError) {
        logger.warn('Failed to clean up PDF file:', cleanupError);
      }

      return allSent;
    } catch (error) {
      logger.error('Error sending weekly alert report:', error);
      return false;
    }
  }


  formatWeeklyAlertMessage(reportData) {
    const timestamp = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'full',
      timeStyle: 'short'
    });

    let message = `📊 *WEEKLY ALERT REPORT*\n`;
    message += `🏥 *Gautam Medicals*\n\n`;
    message += `📅 *Report Date:* ${timestamp}\n\n`;
    
    message += `📈 *SUMMARY:*\n`;
    message += `• Total Products: ${reportData.summary.totalProducts}\n`;
    message += `• Out of Stock: ${reportData.summary.outOfStockCount}\n`;
    message += `• Expiring Soon: ${reportData.summary.expiringCount}\n`;
    message += `• Low Stock: ${reportData.summary.lowStockCount}\n\n`;

    if (reportData.summary.outOfStockCount > 0) {
      message += `🚨 *URGENT - Out of Stock Products:*\n`;
      reportData.outOfStock.slice(0, 5).forEach(product => {
        message += `• ${product.productName} (${product.barcode})\n`;
      });
      if (reportData.outOfStock.length > 5) {
        message += `• ... and ${reportData.outOfStock.length - 5} more\n`;
      }
      message += '\n';
    }

    if (reportData.summary.expiringCount > 0) {
      message += `⚠️ *Expiring Soon:*\n`;
      reportData.expiring.slice(0, 3).forEach(product => {
        const daysLeft = Math.ceil((new Date(product.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
        message += `• ${product.productName} - ${daysLeft} days left\n`;
      });
      if (reportData.expiring.length > 3) {
        message += `• ... and ${reportData.expiring.length - 3} more\n`;
      }
      message += '\n';
    }

    message += `📄 *Detailed report attached as PDF*\n\n`;
    message += `_Please review and take necessary actions._`;

    return message;
  }

  async sendAlert(alert) {
    try {
      // Get admin phone numbers from environment or database
      const adminPhones = this.getAdminPhoneNumbers();
      
      if (adminPhones.length === 0) {
        logger.warn('No admin phone numbers configured for alerts');
        return false;
      }

      const message = this.formatAlertMessage(alert);
      let allSent = true;

      for (const phone of adminPhones) {
        const sent = await this.sendMessage(phone, message);
        if (!sent) {
          allSent = false;
        }
      }

      return allSent;
    } catch (error) {
      logger.error('Error sending alert via WhatsApp:', error);
      return false;
    }
  }

  formatAlertMessage(alert) {
    const emoji = this.getSeverityEmoji(alert.severity);
    const timestamp = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'short',
      timeStyle: 'short'
    });

    let message = `${emoji} *MEDICAL INVENTORY ALERT*\n\n`;
    message += `*Type:* ${alert.type.replace('_', ' ').toUpperCase()}\n`;
    message += `*Product:* ${alert.productName}\n`;
    message += `*Barcode:* ${alert.productBarcode}\n`;
    message += `*Severity:* ${alert.severity.toUpperCase()}\n`;
    message += `*Message:* ${alert.message}\n`;
    message += `*Time:* ${timestamp}\n\n`;
    
    if (alert.metadata) {
      message += `*Additional Info:*\n`;
      Object.entries(alert.metadata).forEach(([key, value]) => {
        message += `• ${key}: ${value}\n`;
      });
    }

    message += `\n_Please check your inventory management system for more details._`;

    return message;
  }

  getSeverityEmoji(severity) {
    const emojis = {
      low: '🟢',
      medium: '🟡',
      high: '🟠',
      critical: '🔴'
    };
    return emojis[severity] || '📢';
  }

  getAdminPhoneNumbers() {
    // Get phone numbers from environment variable
    const phones = process.env.ADMIN_PHONE_NUMBERS;
    if (!phones) {
      return [];
    }

    return phones.split(',').map(phone => phone.trim()).filter(phone => phone);
  }

  async sendBulkAlert(alerts) {
    try {
      if (alerts.length === 0) {
        return true;
      }

      const adminPhones = this.getAdminPhoneNumbers();
      if (adminPhones.length === 0) {
        logger.warn('No admin phone numbers configured for bulk alerts');
        return false;
      }

      const message = this.formatBulkAlertMessage(alerts);
      let allSent = true;

      for (const phone of adminPhones) {
        const sent = await this.sendMessage(phone, message);
        if (!sent) {
          allSent = false;
        }
      }

      return allSent;
    } catch (error) {
      logger.error('Error sending bulk alert via WhatsApp:', error);
      return false;
    }
  }

  formatBulkAlertMessage(alerts) {
    const timestamp = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'short',
      timeStyle: 'short'
    });

    let message = `📢 *MEDICAL INVENTORY ALERTS SUMMARY*\n\n`;
    message += `*Total Alerts:* ${alerts.length}\n`;
    message += `*Time:* ${timestamp}\n\n`;

    // Group alerts by type
    const groupedAlerts = alerts.reduce((acc, alert) => {
      if (!acc[alert.type]) {
        acc[alert.type] = [];
      }
      acc[alert.type].push(alert);
      return acc;
    }, {});

    Object.entries(groupedAlerts).forEach(([type, typeAlerts]) => {
      const emoji = this.getSeverityEmoji(typeAlerts[0].severity);
      message += `${emoji} *${type.replace('_', ' ').toUpperCase()} (${typeAlerts.length})*\n`;
      
      typeAlerts.forEach(alert => {
        message += `• ${alert.productName} (${alert.productBarcode})\n`;
      });
      message += '\n';
    });

    message += `_Please check your inventory management system for detailed information._`;

    return message;
  }

  async verifyWebhook(mode, token, challenge) {
    if (mode === 'subscribe' && token === this.webhookVerifyToken) {
      logger.info('WhatsApp webhook verified successfully');
      return challenge;
    }
    throw new Error('Webhook verification failed');
  }

  async handleWebhook(body) {
    try {
      // Handle incoming WhatsApp messages
      logger.info('Received WhatsApp webhook:', JSON.stringify(body, null, 2));
      
      // Process webhook data here
      // This would typically handle incoming messages, delivery status, etc.
      
      return { success: true };
    } catch (error) {
      logger.error('Error handling WhatsApp webhook:', error);
      throw error;
    }
  }
}

module.exports = new WhatsAppService();
