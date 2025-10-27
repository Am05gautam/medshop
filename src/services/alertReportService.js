const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { Product } = require('../models');
const logger = require('../utils/logger');

class AlertReportService {
  async generateAlertReport() {
    try {
      logger.info('Generating alert report...');

      // Get alert data
      const alertData = await this.getAlertData();
      
      if (!alertData.hasAlerts) {
        logger.info('No alerts found, skipping report generation');
        return {
          success: false,
          message: 'No alerts found',
          hasAlerts: false
        };
      }

      // Generate PDF
      const reportResult = await this.createPDFReport(alertData);
      
      logger.info('Alert report generated successfully:', {
        filename: reportResult.filename,
        filepath: reportResult.filepath
      });

      return {
        success: true,
        filename: reportResult.filename,
        filepath: reportResult.filepath,
        data: alertData,
        hasAlerts: true
      };

    } catch (error) {
      logger.error('Error generating alert report:', error);
      return {
        success: false,
        message: error.message,
        hasAlerts: false
      };
    }
  }

  async getAlertData() {
    try {
      const now = new Date();
      const expiryThreshold = new Date();
      expiryThreshold.setDate(now.getDate() + 30); // 30 days from now

      // Get out-of-stock products
      const outOfStockProducts = await Product.findAll({
        where: {
          availableQuantity: 0
        },
        order: [['name', 'ASC']]
      });

      // Get expiring products
      const expiringProducts = await Product.findAll({
        where: {
          expiryDate: {
            [require('sequelize').Op.lte]: expiryThreshold,
            [require('sequelize').Op.gte]: now
          }
        },
        order: [['expiryDate', 'ASC']]
      });

      // Get low stock products (availableQuantity <= 10)
      const lowStockProducts = await Product.findAll({
        where: {
          availableQuantity: {
            [require('sequelize').Op.gt]: 0,
            [require('sequelize').Op.lte]: 10
          }
        },
        order: [['availableQuantity', 'ASC']]
      });

      const hasAlerts = outOfStockProducts.length > 0 || 
                       expiringProducts.length > 0 || 
                       lowStockProducts.length > 0;

      return {
        hasAlerts,
        outOfStock: outOfStockProducts,
        expiring: expiringProducts,
        lowStock: lowStockProducts,
        generatedAt: now,
        summary: {
          totalOutOfStock: outOfStockProducts.length,
          totalExpiring: expiringProducts.length,
          totalLowStock: lowStockProducts.length,
          totalAlerts: outOfStockProducts.length + expiringProducts.length + lowStockProducts.length
        }
      };

    } catch (error) {
      logger.error('Error getting alert data:', error);
      throw error;
    }
  }

  async createPDFReport(alertData) {
    return new Promise((resolve, reject) => {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `alert_report_${timestamp}.pdf`;
        const filepath = path.join(__dirname, '../../uploads/reports', filename);

        // Ensure directory exists
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filepath);
        doc.pipe(stream);

        // Header
        doc.fontSize(20).text('ALERT REPORT', { align: 'center' });
        doc.fontSize(16).text('Gautam Medicals', { align: 'center' });
        doc.moveDown();
        
        // Report info
        doc.fontSize(12)
           .text(`Generated: ${alertData.generatedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, { align: 'center' });
        doc.moveDown(2);

        // Summary
        doc.fontSize(14).text('SUMMARY', { underline: true });
        doc.fontSize(12)
           .text(`• Total Alerts: ${alertData.summary.totalAlerts}`)
           .text(`• Out of Stock: ${alertData.summary.totalOutOfStock}`)
           .text(`• Expiring Soon: ${alertData.summary.totalExpiring}`)
           .text(`• Low Stock: ${alertData.summary.totalLowStock}`);
        doc.moveDown(2);

        // Out of Stock Products
        if (alertData.outOfStock.length > 0) {
          doc.fontSize(14).text('OUT OF STOCK PRODUCTS', { underline: true });
          doc.moveDown();
          
          // Table header with background
          const headerY = doc.y;
          doc.rect(50, headerY, 500, 20).fill('#f0f0f0');
          doc.fontSize(10).fillColor('black')
             .text('Product Name', 55, headerY + 5, { width: 190 })
             .text('Barcode', 250, headerY + 5, { width: 110 })
             .text('Last Price', 370, headerY + 5, { width: 70 })
             .text('Expiry Date', 450, headerY + 5, { width: 90 });
          
          let yPos = headerY + 25;
          
          alertData.outOfStock.forEach((product, index) => {
            if (yPos > 700) { // New page if needed
              doc.addPage();
              yPos = 50;
            }
            
            // Alternate row background
            if (index % 2 === 0) {
              doc.rect(50, yPos - 5, 500, 20).fill('#f9f9f9');
            }
            
            doc.fillColor('black')
               .text(product.name || 'N/A', 55, yPos, { width: 190 })
               .text(product.barcode || 'N/A', 250, yPos, { width: 110 })
               .text(`Rs. ${parseFloat(product.unitPrice || 0).toFixed(2)}`, 370, yPos, { width: 70 })
               .text(product.expiryDate ? new Date(product.expiryDate).toLocaleDateString() : 'N/A', 450, yPos, { width: 90 });
            
            yPos += 20;
          });
          
          doc.moveDown(2);
        }

        // Expiring Products
        if (alertData.expiring.length > 0) {
          doc.fontSize(14).text('EXPIRING SOON', { underline: true });
          doc.moveDown();
          
          // Table header with background
          const headerY = doc.y;
          doc.rect(50, headerY, 500, 20).fill('#f0f0f0');
          doc.fontSize(10).fillColor('black')
             .text('Product Name', 55, headerY + 5, { width: 190 })
             .text('Barcode', 250, headerY + 5, { width: 110 })
             .text('Quantity', 370, headerY + 5, { width: 70 })
             .text('Expiry Date', 450, headerY + 5, { width: 90 });
          
          let yPos = headerY + 25;
          
          alertData.expiring.forEach((product, index) => {
            if (yPos > 700) { // New page if needed
              doc.addPage();
              yPos = 50;
            }
            
            // Alternate row background
            if (index % 2 === 0) {
              doc.rect(50, yPos - 5, 500, 20).fill('#f9f9f9');
            }
            
            doc.fillColor('black')
               .text(product.name || 'N/A', 55, yPos, { width: 190 })
               .text(product.barcode || 'N/A', 250, yPos, { width: 110 })
               .text(`${product.availableQuantity || 0}`, 370, yPos, { width: 70 })
               .text(product.expiryDate ? new Date(product.expiryDate).toLocaleDateString() : 'N/A', 450, yPos, { width: 90 });
            
            yPos += 20;
          });
          
          doc.moveDown(2);
        }

        // Low Stock Products
        if (alertData.lowStock.length > 0) {
          doc.x = doc.page.margins.left;               // reset cursor
          doc.fontSize(14).text('LOW STOCK', { underline: true });
          doc.moveDown();
          
          // Table header with background
          const headerY = doc.y;
          doc.rect(50, headerY, 500, 20).fill('#f0f0f0');
          doc.fontSize(10).fillColor('black')
             .text('Product Name', 55, headerY + 5, { width: 190 })
             .text('Barcode', 250, headerY + 5, { width: 110 })
             .text('Quantity', 370, headerY + 5, { width: 70 })
             .text('Price', 450, headerY + 5, { width: 90 });
          
          let yPos = headerY + 25;
          
          alertData.lowStock.forEach((product, index) => {
            if (yPos > 700) { // New page if needed
              doc.addPage();
              yPos = 50;
            }
            
            // Alternate row background
            if (index % 2 === 0) {
              doc.rect(50, yPos - 5, 500, 20).fill('#f9f9f9');
            }
            
            doc.fillColor('black')
               .text(product.name || 'N/A', 55, yPos, { width: 190 })
               .text(product.barcode || 'N/A', 250, yPos, { width: 110 })
               .text(`${product.availableQuantity || 0}`, 370, yPos, { width: 70 })
               .text(`Rs. ${parseFloat(product.unitPrice || 0).toFixed(2)}`, 450, yPos, { width: 90 });
            
            yPos += 20;
          });
          
          doc.moveDown(2);
        }

        // Footer - ensure it's at the bottom with proper spacing
        // Check if we need more space before adding footer
        if (doc.y > 750) {
          doc.addPage();
        }
        doc.moveDown(3);
        doc.fontSize(10)
           .text('Generated by Gautam Medicals Inventory Management System', { align: 'center' });

        doc.end();

        stream.on('finish', () => {
          resolve({
            filename,
            filepath
          });
        });

        stream.on('error', (error) => {
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = new AlertReportService();