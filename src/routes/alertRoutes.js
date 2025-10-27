const express = require('express');
const fs = require('fs');
const { Alert } = require('../models');
const alertService = require('../services/alertService');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Get all alerts with pagination and filtering
router.get('/', auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      type,
      status,
      severity,
      productId,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const where = { isActive: true };

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (severity) {
      where.severity = severity;
    }

    if (productId) {
      where.productId = productId;
    }

    const { count, rows } = await Alert.findAndCountAll({
      where,
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        alerts: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching alerts',
      error: error.message
    });
  }
});

// Get alert by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const alert = await Alert.findByPk(req.params.id);
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    res.json({
      success: true,
      data: alert
    });
  } catch (error) {
    logger.error('Error fetching alert:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching alert',
      error: error.message
    });
  }
});

// Acknowledge alert
router.patch('/:id/acknowledge', auth, async (req, res) => {
  try {
    const alert = await Alert.findByPk(req.params.id);
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    await alert.update({
      status: 'acknowledged',
      acknowledgedAt: new Date(),
      acknowledgedBy: req.user.firstName + ' ' + req.user.lastName
    });

    logger.info(`Alert ${alert.id} acknowledged by ${req.user.username}`);

    res.json({
      success: true,
      message: 'Alert acknowledged successfully',
      data: alert
    });
  } catch (error) {
    logger.error('Error acknowledging alert:', error);
    res.status(500).json({
      success: false,
      message: 'Error acknowledging alert',
      error: error.message
    });
  }
});

// Test alert system
router.post('/test', auth, authorize('admin'), async (req, res) => {
  try {
    const { productId, type = 'custom' } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required for test alert'
      });
    }

    const alert = await alertService.testAlert(productId, type);

    res.json({
      success: true,
      message: 'Test alert sent successfully',
      data: alert
    });
  } catch (error) {
    logger.error('Error sending test alert:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending test alert',
      error: error.message
    });
  }
});

// Get alert settings
router.get('/settings/config', auth, authorize('admin'), async (req, res) => {
  try {
    const settings = await alertService.getAlertSettings();

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    logger.error('Error fetching alert settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching alert settings',
      error: error.message
    });
  }
});

// Update alert settings
router.put('/settings/config', auth, authorize('admin'), async (req, res) => {
  try {
    const settings = await alertService.updateAlertSettings(req.body);

    res.json({
      success: true,
      message: 'Alert settings updated successfully',
      data: settings
    });
  } catch (error) {
    logger.error('Error updating alert settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating alert settings',
      error: error.message
    });
  }
});

// Manually trigger alert check with PDF report
router.post('/check', auth, authorize('admin'), async (req, res) => {
  try {
    logger.info('Manual alert check triggered');
    
    // Check for alerts and generate PDF report
    const alertReportService = require('../services/alertReportService');
    const reportResult = await alertReportService.generateAlertReport();
    
    if (!reportResult.success) {
      return res.status(400).json({
        success: false,
        message: reportResult.message || 'No alerts found'
      });
    }

    // Send PDF report via WhatsApp
    const whatsappService = require('../services/whatsappService');
    const adminPhones = whatsappService.getAdminPhoneNumbers();
    
    if (adminPhones.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No admin phone numbers configured for alerts'
      });
    }

    // Send text message first
    const message = formatAlertMessage(reportResult.data);
    let allSent = true;

    for (const phone of adminPhones) {
      // Send text message
      const textSent = await whatsappService.sendMessage(phone, message);
      if (!textSent) {
        allSent = false;
        continue;
      }

      // Send PDF report
      const pdfSent = await whatsappService.sendDocument(
        phone, 
        reportResult.filepath, 
        reportResult.filename,
        '🚨 Alert Report - Gautam Medicals'
      );
      
      if (!pdfSent) {
        allSent = false;
      }
    }

    // Clean up the PDF file after sending
    try {
      fs.unlinkSync(reportResult.filepath);
      logger.info('Alert report PDF cleaned up');
    } catch (cleanupError) {
      logger.warn('Failed to clean up PDF file:', cleanupError);
    }

    // Also run the regular alert check
    await alertService.checkAlerts();
    
    res.json({
      success: true,
      message: allSent ? 'Alert check completed and report sent successfully' : 'Alert check completed but some messages failed to send',
      reportSent: allSent,
      alertCount: reportResult.data.summary.totalAlerts
    });
  } catch (error) {
    logger.error('Error triggering alert check:', error);
    res.status(500).json({
      success: false,
      message: 'Error triggering alert check',
      error: error.message
    });
  }
});

function formatAlertMessage(alertData) {
  const timestamp = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'full',
    timeStyle: 'short'
  });

  let message = `🚨 *ALERT REPORT*\n`;
  message += `🏥 *Gautam Medicals*\n\n`;
  message += `📅 *Generated:* ${timestamp}\n\n`;
  
  message += `📊 *SUMMARY:*\n`;
  message += `• Total Alerts: ${alertData.summary.totalAlerts}\n`;
  message += `• Out of Stock: ${alertData.summary.totalOutOfStock}\n`;
  message += `• Expiring Soon: ${alertData.summary.totalExpiring}\n`;
  message += `• Low Stock: ${alertData.summary.totalLowStock}\n\n`;
  
  if (alertData.summary.totalAlerts > 0) {
    message += `📋 *DETAILED REPORT:*\n`;
    message += `Please check the attached PDF for complete product details.\n\n`;
    message += `⚠️ *Action Required:*\n`;
    message += `• Restock out-of-stock products\n`;
    message += `• Use expiring products soon\n`;
    message += `• Reorder low stock items\n`;
  } else {
    message += `✅ *No alerts found - All products are in good condition!*`;
  }
  
  return message;
}

// Get alert statistics
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const where = {};
    if (startDate && endDate) {
      where.createdAt = {
        [require('sequelize').Op.between]: [startDate, endDate]
      };
    }

    const [
      totalAlerts,
      pendingAlerts,
      sentAlerts,
      acknowledgedAlerts,
      failedAlerts
    ] = await Promise.all([
      Alert.count({ where }),
      Alert.count({ where: { ...where, status: 'pending' } }),
      Alert.count({ where: { ...where, status: 'sent' } }),
      Alert.count({ where: { ...where, status: 'acknowledged' } }),
      Alert.count({ where: { ...where, status: 'failed' } })
    ]);

    // Get alerts by type
    const alertsByType = await Alert.findAll({
      attributes: [
        'type',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      where,
      group: ['type'],
      raw: true
    });

    // Get alerts by severity
    const alertsBySeverity = await Alert.findAll({
      attributes: [
        'severity',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      where,
      group: ['severity'],
      raw: true
    });

    res.json({
      success: true,
      data: {
        totalAlerts,
        pendingAlerts,
        sentAlerts,
        acknowledgedAlerts,
        failedAlerts,
        alertsByType: alertsByType.reduce((acc, item) => {
          acc[item.type] = parseInt(item.count);
          return acc;
        }, {}),
        alertsBySeverity: alertsBySeverity.reduce((acc, item) => {
          acc[item.severity] = parseInt(item.count);
          return acc;
        }, {})
      }
    });
  } catch (error) {
    logger.error('Error fetching alert statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching alert statistics',
      error: error.message
    });
  }
});

// Get recent alerts
router.get('/stats/recent', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const alerts = await Alert.findAll({
      order: [['createdAt', 'DESC']],
      limit
    });

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    logger.error('Error fetching recent alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recent alerts',
      error: error.message
    });
  }
});

// Delete alert
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const alert = await Alert.findByPk(req.params.id);
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    await alert.update({ isActive: false });

    logger.info(`Alert ${alert.id} deleted by ${req.user.username}`);

    res.json({
      success: true,
      message: 'Alert deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting alert:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting alert',
      error: error.message
    });
  }
});

module.exports = router;
