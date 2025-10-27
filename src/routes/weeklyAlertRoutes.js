const express = require('express');
const whatsappService = require('../services/whatsappService');
const alertReportService = require('../services/alertReportService');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Send weekly alert report manually
 * POST /api/alerts/weekly-report
 */
router.post('/weekly-report', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    logger.info('Manual weekly alert report requested');
    
    const success = await whatsappService.sendWeeklyAlertReport();
    
    if (success) {
      res.json({
        success: true,
        message: 'Weekly alert report sent successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send weekly alert report'
      });
    }
  } catch (error) {
    logger.error('Error sending weekly alert report:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending weekly alert report',
      error: error.message
    });
  }
});

/**
 * Generate weekly alert report PDF (without sending)
 * GET /api/alerts/weekly-report/pdf
 */
router.get('/weekly-report/pdf', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    logger.info('Generating weekly alert report PDF');
    
    const reportResult = await alertReportService.generateWeeklyAlertReport();
    
    res.download(reportResult.filepath, reportResult.filename, (err) => {
      if (err) {
        logger.error('Error downloading weekly report PDF:', err);
        res.status(500).json({
          success: false,
          message: 'Error downloading PDF'
        });
      } else {
        // Clean up the file after download
        setTimeout(() => {
          try {
            require('fs').unlinkSync(reportResult.filepath);
            logger.info('Weekly report PDF cleaned up');
          } catch (cleanupError) {
            logger.warn('Failed to clean up PDF file:', cleanupError);
          }
        }, 5000);
      }
    });
  } catch (error) {
    logger.error('Error generating weekly alert report PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating PDF',
      error: error.message
    });
  }
});

/**
 * Get weekly alert report data (JSON)
 * GET /api/alerts/weekly-report/data
 */
router.get('/weekly-report/data', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const reportData = await alertReportService.getAlertReportData();
    
    res.json({
      success: true,
      data: reportData
    });
  } catch (error) {
    logger.error('Error getting weekly alert report data:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting report data',
      error: error.message
    });
  }
});

/**
 * Test WhatsApp configuration (individual messages)
 * POST /api/weekly-alerts/test-whatsapp
 */
router.post('/test-whatsapp', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const testMessage = `🧪 *TEST MESSAGE*\n\nThis is a test message from Gautam Medicals Inventory Management System.\n\nTime: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\nIf you receive this message, WhatsApp integration is working correctly! ✅`;
    
    const adminPhones = whatsappService.getAdminPhoneNumbers();
    if (adminPhones.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No admin phone numbers configured'
      });
    }
    
    let allSent = true;
    for (const phone of adminPhones) {
      const sent = await whatsappService.sendMessage(phone, testMessage);
      if (!sent) {
        allSent = false;
      }
    }
    
    if (allSent) {
      res.json({
        success: true,
        message: 'Test message sent successfully to all configured numbers'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Test message failed to send to some numbers'
      });
    }
  } catch (error) {
    logger.error('Error sending test WhatsApp message:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending test message',
      error: error.message
    });
  }
});


module.exports = router;
