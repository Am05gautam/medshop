const cron = require('node-cron');
const { Product, Alert } = require('../models');
const whatsappService = require('./whatsappService');
const logger = require('../utils/logger');

class AlertService {
  constructor() {
    this.scheduler = null;
    this.weeklyScheduler = null;
    this.isRunning = false;
  }

  startScheduler() {
    if (this.isRunning) {
      logger.warn('Alert scheduler is already running');
      return;
    }

    // Get cron expression from environment or use default (daily at 9 AM)
    const cronExpression = process.env.ALERT_CHECK_INTERVAL || '0 9 * * *';
    
    try {
      this.scheduler = cron.schedule(cronExpression, async () => {
        logger.info('Starting scheduled alert check...');
        await this.checkAlerts();
      }, {
        scheduled: false,
        timezone: 'Asia/Kolkata' // Adjust timezone as needed
      });

      this.scheduler.start();
      
      // Start weekly alert scheduler (every Monday at 10 AM)
      this.weeklyScheduler = cron.schedule('0 10 * * 1', async () => {
        logger.info('Running weekly alert report...');
        await this.sendWeeklyReport();
      }, {
        scheduled: false,
        timezone: 'Asia/Kolkata'
      });
      
      this.weeklyScheduler.start();
      this.isRunning = true;
      logger.info(`Alert scheduler started with expression: ${cronExpression}`);
      logger.info('Weekly alert scheduler started (Mondays at 10 AM)');
    } catch (error) {
      logger.error('Failed to start alert scheduler:', error);
    }
  }

  stopScheduler() {
    if (this.scheduler) {
      this.scheduler.stop();
      this.scheduler = null;
    }
    
    if (this.weeklyScheduler) {
      this.weeklyScheduler.stop();
      this.weeklyScheduler = null;
    }
    
    this.isRunning = false;
    logger.info('Alert schedulers stopped');
  }

  async sendWeeklyReport() {
    try {
      logger.info('Sending weekly alert report...');
      const success = await whatsappService.sendWeeklyAlertReport();
      
      if (success) {
        logger.info('Weekly alert report sent successfully');
      } else {
        logger.error('Failed to send weekly alert report');
      }
    } catch (error) {
      logger.error('Error sending weekly alert report:', error);
    }
  }

  async checkAlerts() {
    try {
      logger.info('Checking for alerts...');
      
      const alerts = [];
      
      // Check for low stock products
      const lowStockAlerts = await this.checkLowStock();
      alerts.push(...lowStockAlerts);
      
      // Check for expiring products
      const expiryAlerts = await this.checkExpiry();
      alerts.push(...expiryAlerts);
      
      // Check for out of stock products
      const outOfStockAlerts = await this.checkOutOfStock();
      alerts.push(...outOfStockAlerts);
      
      logger.info(`Found ${alerts.length} alerts to process`);
      
      // Process alerts
      for (const alert of alerts) {
        await this.processAlert(alert);
      }
      
      logger.info('Alert check completed successfully');
    } catch (error) {
      logger.error('Error during alert check:', error);
    }
  }

  async checkLowStock() {
    try {
      const products = await Product.findAll({
        where: {
          isActive: true,
          availableQuantity: {
            [require('sequelize').Op.lte]: require('sequelize').col('minimumQuantity')
          }
        }
      });

      const alerts = [];
      
      for (const product of products) {
        // Check if we already have a pending alert for this product and type
        const existingAlert = await Alert.findOne({
          where: {
            productId: product.id,
            type: 'low_stock',
            status: 'pending'
          }
        });

        if (!existingAlert) {
          const alert = await Alert.create({
            type: 'low_stock',
            productId: product.id,
            productName: product.name,
            productBarcode: product.barcode,
            message: `Low stock alert: ${product.name} (${product.barcode}) has only ${product.availableQuantity} units left. Minimum required: ${product.minimumQuantity}`,
            severity: product.availableQuantity === 0 ? 'critical' : 'high',
            metadata: {
              availableQuantity: product.availableQuantity,
              minimumQuantity: product.minimumQuantity,
              unit: product.unit
            }
          });
          
          alerts.push(alert);
        }
      }
      
      return alerts;
    } catch (error) {
      logger.error('Error checking low stock:', error);
      return [];
    }
  }

  async checkExpiry() {
    try {
      const expiryDays = parseInt(process.env.EXPIRY_ALERT_DAYS) || 30;
      const alertDate = new Date();
      alertDate.setDate(alertDate.getDate() + expiryDays);
      
      const products = await Product.findAll({
        where: {
          isActive: true,
          expiryDate: {
            [require('sequelize').Op.between]: [new Date(), alertDate]
          }
        }
      });

      const alerts = [];
      
      for (const product of products) {
        // Check if we already have a pending alert for this product and type
        const existingAlert = await Alert.findOne({
          where: {
            productId: product.id,
            type: 'expiry',
            status: 'pending'
          }
        });

        if (!existingAlert) {
          const daysUntilExpiry = Math.ceil((new Date(product.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
          
          const alert = await Alert.create({
            type: 'expiry',
            productId: product.id,
            productName: product.name,
            productBarcode: product.barcode,
            message: `Expiry alert: ${product.name} (${product.barcode}) expires in ${daysUntilExpiry} days on ${product.expiryDate}`,
            severity: daysUntilExpiry <= 7 ? 'critical' : daysUntilExpiry <= 15 ? 'high' : 'medium',
            metadata: {
              expiryDate: product.expiryDate,
              daysUntilExpiry: daysUntilExpiry,
              availableQuantity: product.availableQuantity,
              batchNumber: product.batchNumber
            }
          });
          
          alerts.push(alert);
        }
      }
      
      return alerts;
    } catch (error) {
      logger.error('Error checking expiry:', error);
      return [];
    }
  }

  async checkOutOfStock() {
    try {
      const products = await Product.findAll({
        where: {
          isActive: true,
          availableQuantity: 0
        }
      });

      const alerts = [];
      
      for (const product of products) {
        // Check if we already have a pending alert for this product and type
        const existingAlert = await Alert.findOne({
          where: {
            productId: product.id,
            type: 'out_of_stock',
            status: 'pending'
          }
        });

        if (!existingAlert) {
          const alert = await Alert.create({
            type: 'out_of_stock',
            productId: product.id,
            productName: product.name,
            productBarcode: product.barcode,
            message: `Out of stock alert: ${product.name} (${product.barcode}) is completely out of stock`,
            severity: 'critical',
            metadata: {
              availableQuantity: product.availableQuantity,
              minimumQuantity: product.minimumQuantity,
              unit: product.unit
            }
          });
          
          alerts.push(alert);
        }
      }
      
      return alerts;
    } catch (error) {
      logger.error('Error checking out of stock:', error);
      return [];
    }
  }

  async processAlert(alert) {
    try {
      logger.info(`Processing alert: ${alert.type} for ${alert.productName}`);
      
      // Send WhatsApp notification
      const sent = await whatsappService.sendAlert(alert);
      
      if (sent) {
        alert.status = 'sent';
        alert.sentAt = new Date();
        await alert.save();
        logger.info(`Alert sent successfully: ${alert.id}`);
      } else {
        alert.status = 'failed';
        await alert.save();
        logger.error(`Failed to send alert: ${alert.id}`);
      }
    } catch (error) {
      logger.error(`Error processing alert ${alert.id}:`, error);
      alert.status = 'failed';
      await alert.save();
    }
  }

  async testAlert(productId, type = 'custom') {
    try {
      const product = await Product.findByPk(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      const alert = await Alert.create({
        type: type,
        productId: product.id,
        productName: product.name,
        productBarcode: product.barcode,
        message: `Test alert: ${product.name} (${product.barcode}) - This is a test notification`,
        severity: 'low',
        metadata: {
          test: true,
          timestamp: new Date()
        }
      });

      await this.processAlert(alert);
      return alert;
    } catch (error) {
      logger.error('Error creating test alert:', error);
      throw error;
    }
  }

  async getAlertSettings() {
    return {
      cronExpression: process.env.ALERT_CHECK_INTERVAL || '0 9 * * *',
      expiryAlertDays: parseInt(process.env.EXPIRY_ALERT_DAYS) || 30,
      lowStockAlertEnabled: process.env.LOW_STOCK_ALERT_ENABLED === 'true',
      schedulerRunning: this.isRunning
    };
  }

  async updateAlertSettings(settings) {
    // This would typically update environment variables or database settings
    // For now, we'll just log the settings
    logger.info('Alert settings updated:', settings);
    return settings;
  }
}

module.exports = new AlertService();
