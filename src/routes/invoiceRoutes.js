const express = require('express');
const { Invoice, InvoiceItem, Customer, Product } = require('../models');
const invoiceService = require('../services/invoiceService');
const { validate, invoiceSchemas } = require('../middleware/validation');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Get all invoices with pagination and filtering
router.get('/', auth, async (req, res) => {
  try {
    const filters = req.query;
    const result = await invoiceService.getInvoices(filters);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching invoices',
      error: error.message
    });
  }
});

// Get invoice by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const invoice = await invoiceService.getInvoiceWithItems(req.params.id);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    logger.error('Error fetching invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching invoice',
      error: error.message
    });
  }
});

// Create new invoice
router.post('/', auth, authorize('admin', 'manager', 'cashier'), validate(invoiceSchemas.create), async (req, res) => {
  try {
    const result = await invoiceService.createInvoice(req.body, req.user.id);

    logger.info(`Invoice created: ${result.invoice.invoiceNumber}`);

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error creating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating invoice',
      error: error.message
    });
  }
});

// Generate PDF for invoice
router.get('/:id/pdf', auth, async (req, res) => {
  try {
    const result = await invoiceService.generatePDF(req.params.id);
    
    res.download(result.filepath, result.filename, (err) => {
      if (err) {
        logger.error('Error downloading PDF:', err);
        res.status(500).json({
          success: false,
          message: 'Error downloading PDF'
        });
      }
    });
  } catch (error) {
    logger.error('Error generating PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating PDF',
      error: error.message
    });
  }
});

// Cancel invoice
router.post('/:id/cancel', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await invoiceService.cancelInvoice(id, req.user.id);
    res.json({ success: true, message: 'Invoice cancelled successfully', data: result });
  } catch (error) {
    logger.error('Error cancelling invoice:', error);
    res.status(500).json({ success: false, message: 'Error cancelling invoice', error: error.message });
  }
});

// Update invoice payment status
router.patch('/:id/status', auth, authorize('admin', 'manager', 'cashier'), async (req, res) => {
  try {
    const { status, paidAmount } = req.body;

    if (!['pending', 'partial', 'paid', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment status'
      });
    }

    const invoice = await invoiceService.updateInvoiceStatus(req.params.id, status, paidAmount);

    logger.info(`Invoice ${invoice.invoiceNumber} status updated to ${status}`);

    res.json({
      success: true,
      message: 'Invoice status updated successfully',
      data: invoice
    });
  } catch (error) {
    logger.error('Error updating invoice status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating invoice status',
      error: error.message
    });
  }
});

// Get invoice statistics
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const where = {};
    if (startDate && endDate) {
      where.invoiceDate = {
        [require('sequelize').Op.between]: [startDate, endDate]
      };
    }

    const [
      totalInvoices,
      totalRevenue,
      paidInvoices,
      pendingInvoices,
      cancelledInvoices
    ] = await Promise.all([
      Invoice.count({ where }),
      Invoice.sum('totalAmount', { where }),
      Invoice.count({ where: { ...where, paymentStatus: 'paid' } }),
      Invoice.count({ where: { ...where, paymentStatus: 'pending' } }),
      Invoice.count({ where: { ...where, paymentStatus: 'cancelled' } })
    ]);

    const averageInvoiceValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;

    res.json({
      success: true,
      data: {
        totalInvoices,
        totalRevenue: totalRevenue || 0,
        averageInvoiceValue,
        paidInvoices,
        pendingInvoices,
        cancelledInvoices,
        paymentRate: totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0
      }
    });
  } catch (error) {
    logger.error('Error fetching invoice statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching invoice statistics',
      error: error.message
    });
  }
});

// Get recent invoices
router.get('/stats/recent', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const invoices = await Invoice.findAll({
      include: [
        {
          model: Customer,
          as: 'customer',
          required: false
        }
      ],
      order: [['createdAt', 'DESC']],
      limit
    });

    res.json({
      success: true,
      data: invoices
    });
  } catch (error) {
    logger.error('Error fetching recent invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recent invoices',
      error: error.message
    });
  }
});

// Get top selling products
router.get('/stats/top-products', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const { startDate, endDate } = req.query;

    const where = {};
    if (startDate && endDate) {
      where.invoiceDate = {
        [require('sequelize').Op.between]: [startDate, endDate]
      };
    }

    const topProducts = await InvoiceItem.findAll({
      attributes: [
        'productId',
        'productName',
        'productBarcode',
        [require('sequelize').fn('SUM', require('sequelize').col('quantity')), 'totalQuantity'],
        [require('sequelize').fn('SUM', require('sequelize').col('totalAmount')), 'totalRevenue']
      ],
      include: [
        {
          model: Invoice,
          as: 'invoice',
          where,
          attributes: []
        }
      ],
      group: ['productId', 'productName', 'productBarcode'],
      order: [[require('sequelize').fn('SUM', require('sequelize').col('quantity')), 'DESC']],
      limit
    });

    res.json({
      success: true,
      data: topProducts
    });
  } catch (error) {
    logger.error('Error fetching top products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching top products',
      error: error.message
    });
  }
});

// Cancel invoice
router.patch('/:id/cancel', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id, {
      include: [
        {
          model: InvoiceItem,
          as: 'items'
        }
      ]
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    if (invoice.paymentStatus === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Invoice is already cancelled'
      });
    }

    // Restore product quantities
    for (const item of invoice.items) {
      const product = await Product.findByPk(item.productId);
      if (product) {
        await product.updateQuantity(item.quantity, 'add');
      }
    }

    // Update invoice status
    await invoice.update({ paymentStatus: 'cancelled' });

    logger.info(`Invoice ${invoice.invoiceNumber} cancelled`);

    res.json({
      success: true,
      message: 'Invoice cancelled successfully',
      data: invoice
    });
  } catch (error) {
    logger.error('Error cancelling invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling invoice',
      error: error.message
    });
  }
});

// Update invoice
router.put('/:id', auth, authorize('admin', 'manager', 'cashier'), validate(invoiceSchemas.create), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await invoiceService.updateInvoice(id, req.body, req.user.id);

    logger.info(`Invoice updated: ${result.invoice.invoiceNumber}`);

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error updating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating invoice',
      error: error.message
    });
  }
});

// Delete invoice
router.delete('/:id', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id, {
      include: [
        {
          model: InvoiceItem,
          as: 'items'
        }
      ]
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Check if invoice can be deleted (only pending invoices should be deletable)
    if (invoice.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete paid invoices. Please cancel the invoice instead.'
      });
    }

    // Restore product quantities if invoice is not cancelled
    if (invoice.paymentStatus !== 'cancelled') {
      for (const item of invoice.items) {
        const product = await Product.findByPk(item.productId);
        if (product) {
          await product.updateQuantity(item.quantity, 'add');
        }
      }
    }

    // Delete invoice items first (due to foreign key constraints)
    await InvoiceItem.destroy({
      where: { invoiceId: invoice.id }
    });

    // Delete the invoice
    await invoice.destroy();

    logger.info(`Invoice ${invoice.invoiceNumber} deleted by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Invoice deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting invoice',
      error: error.message
    });
  }
});

module.exports = router;
