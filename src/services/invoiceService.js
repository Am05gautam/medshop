const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { Invoice, InvoiceItem, Customer, Product } = require('../models');
const logger = require('../utils/logger');

class InvoiceService {
  constructor() {
    this.invoiceNumberPrefix = 'INV';
    this.invoiceNumberLength = 6;
  }

  async generateInvoiceNumber() {
    try {
      // Find the highest existing invoice number
      const lastInvoice = await Invoice.findOne({
        order: [['createdAt', 'DESC']],
        attributes: ['invoiceNumber']
      });
      
      let nextNumber = 1;
      if (lastInvoice && lastInvoice.invoiceNumber) {
        // Extract number from invoice number (e.g., "INV000005" -> 5)
        const match = lastInvoice.invoiceNumber.match(/\d+$/);
        if (match) {
          nextNumber = parseInt(match[0]) + 1;
        }
      }
      
      return `${this.invoiceNumberPrefix}${nextNumber.toString().padStart(this.invoiceNumberLength, '0')}`;
    } catch (error) {
      logger.error('Error generating invoice number:', error);
      throw error;
    }
  }

  async createInvoice(invoiceData, userId) {
    try {
      const invoiceNumber = await this.generateInvoiceNumber();
      
      // Create invoice
      const invoice = await Invoice.create({
        invoiceNumber,
        customerId: invoiceData.customerId,
        customerName: invoiceData.customerName,
        customerPhone: invoiceData.customerPhone,
        customerEmail: invoiceData.customerEmail,
        customerAddress: invoiceData.customerAddress,
        invoiceDate: invoiceData.invoiceDate || new Date(), // Use provided date or current date
        dueDate: invoiceData.dueDate, // Can be null (optional)
        discountAmount: invoiceData.discountAmount || 0,
        discountPercentage: invoiceData.discountPercentage || 0,
        taxAmount: invoiceData.taxAmount || 0,
        taxPercentage: invoiceData.taxPercentage || 0,
        paymentMethod: invoiceData.paymentMethod,
        notes: invoiceData.notes
      });

      // Create invoice items and update product quantities
      const items = [];
      let subtotal = 0;

      for (const itemData of invoiceData.items) {
        const product = await Product.findByPk(itemData.productId);
        if (!product) {
          throw new Error(`Product not found: ${itemData.productId}`);
        }

        if (product.availableQuantity < itemData.quantity) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.availableQuantity}, Required: ${itemData.quantity}`);
        }

        const itemTotal = itemData.quantity * itemData.unitPrice;
        const itemDiscount = itemData.discountAmount || 0;
        const itemTotalAfterDiscount = itemTotal - itemDiscount;

        const item = await InvoiceItem.create({
          invoiceId: invoice.id,
          productId: product.id,
          productName: product.name,
          productBarcode: product.barcode,
          quantity: itemData.quantity,
          unitPrice: itemData.unitPrice,
          discountAmount: itemDiscount,
          discountPercentage: itemData.discountPercentage || 0,
          totalAmount: itemTotalAfterDiscount,
          batchNumber: product.batchNumber,
          expiryDate: product.expiryDate
        });

        items.push(item);
        subtotal += itemTotalAfterDiscount;

        // Update product quantity
        await product.updateQuantity(itemData.quantity, 'subtract');
      }

      // Calculate totals
      const discountAmount = invoiceData.discountAmount || 0;
      const taxAmount = invoiceData.taxAmount || 0;
      const totalAmount = subtotal - discountAmount + taxAmount;

      // Determine payment status
      const immediateMethods = ['cash', 'card', 'upi', 'netbanking'];
      const providedPaidAmount = parseFloat(invoiceData.paidAmount || 0);
      const computedPaidAmount = immediateMethods.includes(invoiceData.paymentMethod) ? totalAmount : 0;
      const finalPaidAmount = providedPaidAmount > 0 ? providedPaidAmount : computedPaidAmount;
      const paymentStatus = finalPaidAmount >= totalAmount ? 'paid' : 'pending';

      // Update invoice with calculated totals
      await invoice.update({
        subtotal,
        totalAmount,
        paidAmount: finalPaidAmount,
        paymentStatus
      });

      logger.info(`Invoice created successfully: ${invoiceNumber}`);

      return {
        invoice: await this.getInvoiceWithItems(invoice.id),
        items
      };
    } catch (error) {
      logger.error('Error creating invoice:', error);
      throw error;
    }
  }

  async getInvoiceWithItems(invoiceId) {
    try {
      const invoice = await Invoice.findByPk(invoiceId, {
        include: [
          {
            model: InvoiceItem,
            as: 'items',
            include: [
              {
                model: Product,
                as: 'product',
                attributes: ['id', 'name', 'barcode', 'unit']
              }
            ]
          },
          {
            model: Customer,
            as: 'customer',
            required: false
          }
        ]
      });

      return invoice;
    } catch (error) {
      logger.error('Error fetching invoice with items:', error);
      throw error;
    }
  }

  async updateInvoice(invoiceId, invoiceData, userId) {
    try {
      const invoice = await Invoice.findByPk(invoiceId, {
        include: [
          {
            model: InvoiceItem,
            as: 'items',
            include: [
              { model: Product, as: 'product' }
            ]
          }
        ]
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // If invoice is paid, don't allow editing
      if (invoice.paymentStatus === 'paid') {
        throw new Error('Cannot edit paid invoices. Please cancel the invoice first.');
      }

      // If previously cancelled, reactivate before editing
      if (invoice.paymentStatus === 'cancelled') {
        await invoice.update({ isActive: true });
      }

      // Restore original product quantities
      for (const item of invoice.items) {
        if (item.product) {
          await item.product.updateQuantity(parseInt(item.quantity || 0), 'add');
        }
      }

      // Delete existing invoice items
      await InvoiceItem.destroy({ where: { invoiceId: invoice.id } });

      // Update invoice basic info
      await invoice.update({
        customerName: invoiceData.customerName,
        customerPhone: invoiceData.customerPhone,
        customerEmail: invoiceData.customerEmail,
        customerAddress: invoiceData.customerAddress,
        paymentMethod: invoiceData.paymentMethod,
        dueDate: invoiceData.dueDate,
        discountAmount: invoiceData.discountAmount || 0,
        discountPercentage: invoiceData.discountPercentage || 0,
        taxAmount: invoiceData.taxAmount || 0,
        taxPercentage: invoiceData.taxPercentage || 0,
        notes: invoiceData.notes
      });

      // Create new invoice items and update product quantities
      const items = [];
      let subtotal = 0;

      for (const itemData of invoiceData.items) {
        const product = await Product.findByPk(itemData.productId);
        if (!product) {
          throw new Error(`Product not found: ${itemData.productId}`);
        }

        if (product.availableQuantity < itemData.quantity) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.availableQuantity}, Required: ${itemData.quantity}`);
        }

        const itemTotal = itemData.quantity * itemData.unitPrice;
        const itemDiscount = itemData.discountAmount || 0;
        const itemTotalAfterDiscount = itemTotal - itemDiscount;

        const item = await InvoiceItem.create({
          invoiceId: invoice.id,
          productId: product.id,
          productName: product.name,
          productBarcode: product.barcode,
          quantity: itemData.quantity,
          unitPrice: itemData.unitPrice,
          discountAmount: itemDiscount,
          discountPercentage: itemData.discountPercentage || 0,
          totalAmount: itemTotalAfterDiscount,
          batchNumber: product.batchNumber,
          expiryDate: product.expiryDate
        });

        items.push(item);
        subtotal += itemTotalAfterDiscount;

        // Update product quantity
        await product.updateQuantity(itemData.quantity, 'subtract');
      }

      // Calculate totals
      const discountAmount = invoiceData.discountAmount || 0;
      const taxAmount = invoiceData.taxAmount || 0;
      const totalAmount = subtotal - discountAmount + taxAmount;

      // Determine payment status
      const immediateMethods = ['cash', 'card', 'upi', 'netbanking'];
      const providedPaidAmount = parseFloat(invoiceData.paidAmount || 0);
      const computedPaidAmount = immediateMethods.includes(invoiceData.paymentMethod) ? totalAmount : 0;
      const finalPaidAmount = providedPaidAmount > 0 ? providedPaidAmount : computedPaidAmount;
      const paymentStatus = finalPaidAmount >= totalAmount ? 'paid' : 'pending';

      // Update invoice with calculated totals
      await invoice.update({
        subtotal,
        totalAmount,
        paidAmount: finalPaidAmount,
        paymentStatus
      });

      logger.info(`Invoice updated successfully: ${invoice.invoiceNumber}`);

      return {
        invoice: await this.getInvoiceWithItems(invoice.id),
        items
      };
    } catch (error) {
      logger.error('Error updating invoice:', error);
      throw error;
    }
  }

  async cancelInvoice(invoiceId, userId) {
    try {
      const invoice = await Invoice.findByPk(invoiceId, {
        include: [
          {
            model: InvoiceItem,
            as: 'items',
            include: [
              { model: Product, as: 'product' }
            ]
          }
        ]
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.paymentStatus === 'cancelled') {
        return { invoice };
      }

      // Restore product quantities
      for (const item of invoice.items) {
        if (item.product) {
          await item.product.updateQuantity(parseInt(item.quantity || 0), 'add');
        }
      }

      await invoice.update({
        paymentStatus: 'cancelled',
        isActive: false
      });

      return { invoice: await this.getInvoiceWithItems(invoice.id) };
    } catch (error) {
      logger.error('Error cancelling invoice:', error);
      throw error;
    }
  }

  async generatePDF(invoiceId) {
    try {
      const invoice = await this.getInvoiceWithItems(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      logger.info(`Generating PDF for invoice: ${invoice.invoiceNumber}`);
      logger.info(`Invoice has ${invoice.items ? invoice.items.length : 0} items`);

      const doc = new PDFDocument({ margin: 50 });
      const filename = `invoice_${invoice.invoiceNumber}_${Date.now()}.pdf`;
      const filepath = path.join('uploads', 'invoices', filename);

      // Ensure directory exists
      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const writeStream = fs.createWriteStream(filepath);
      doc.pipe(writeStream);

      // Header
      this.addHeader(doc, invoice);
      logger.info('Added header to PDF');

      // Customer details
      this.addCustomerDetails(doc, invoice);
      logger.info('Added customer details to PDF');

      // Invoice details
      this.addInvoiceDetails(doc, invoice);
      logger.info('Added invoice details to PDF');

      // Items table
      const itemsTableEndY = this.addItemsTable(doc, invoice);
      logger.info('Added items table to PDF');

      // Totals
      this.addTotals(doc, invoice, itemsTableEndY);
      logger.info('Added totals to PDF');

      // Footer
      this.addFooter(doc, invoice);
      logger.info('Added footer to PDF');

      doc.end();

      return new Promise((resolve, reject) => {
        writeStream.on('finish', () => {
          logger.info(`PDF generated successfully: ${filepath}`);
          resolve({
            filepath,
            filename,
            invoice
          });
        });

        writeStream.on('error', (error) => {
          logger.error('Error writing PDF file:', error);
          reject(error);
        });

        doc.on('error', (error) => {
          logger.error('Error generating PDF:', error);
          reject(error);
        });
      });
    } catch (error) {
      logger.error('Error generating invoice PDF:', error);
      throw error;
    }
  }

  addHeader(doc, invoice) {
    // Company logo and details
    doc.fontSize(20).text('MEDICAL INVENTORY SYSTEM', 50, 50);
    doc.fontSize(12).text('Invoice', 50, 80);
    
    // Invoice number
    doc.fontSize(16).text(`Invoice #: ${invoice.invoiceNumber}`, 400, 50);
    doc.fontSize(12).text(`Date: ${moment(invoice.invoiceDate).format('DD/MM/YYYY')}`, 400, 70);
    
    if (invoice.dueDate) {
      doc.text(`Due Date: ${moment(invoice.dueDate).format('DD/MM/YYYY')}`, 400, 90);
    }
  }

  addCustomerDetails(doc, invoice) {
    doc.fontSize(14).text('Bill To:', 50, 130);
    doc.fontSize(12).text(invoice.customerName, 50, 150);
    
    if (invoice.customerPhone) {
      doc.text(`Phone: ${invoice.customerPhone}`, 50, 170);
    }
    
    if (invoice.customerEmail) {
      doc.text(`Email: ${invoice.customerEmail}`, 50, 190);
    }
    
    if (invoice.customerAddress) {
      doc.text(`Address: ${invoice.customerAddress}`, 50, 210);
    }
  }

  addInvoiceDetails(doc, invoice) {
    doc.fontSize(12).text(`Payment Method: ${invoice.paymentMethod || 'Not specified'}`, 400, 130);
    doc.text(`Status: ${invoice.paymentStatus}`, 400, 150);
  }

  addItemsTable(doc, invoice) {
    let yPosition = 250;
    
    logger.info(`Adding items table. Invoice has ${invoice.items ? invoice.items.length : 0} items`);
    
    // Table header with adjusted column positions
    doc.fontSize(10).text('Item', 50, yPosition);
    doc.text('Barcode', 200, yPosition);
    doc.text('Qty', 320, yPosition);
    doc.text('Unit Price', 370, yPosition);
    doc.text('Discount', 450, yPosition);
    doc.text('Total', 520, yPosition);
    
    // Draw line under header
    doc.moveTo(50, yPosition + 15).lineTo(580, yPosition + 15).stroke();
    
    yPosition += 25;

    // Table rows
    if (invoice.items && invoice.items.length > 0) {
      invoice.items.forEach((item, index) => {
        logger.info(`Adding item ${index + 1}: ${item.productName}, Price: ${item.unitPrice}, Qty: ${item.quantity}`);
        
        // Handle long product names by wrapping text
        const productName = item.productName || 'N/A';
        const maxProductWidth = 140; // Maximum width for product name column
        
        // Split long product names into multiple lines
        const productLines = doc.text(productName, 50, yPosition, {
          width: maxProductWidth,
          align: 'left'
        });
        
        // Calculate how many lines the product name took
        const productLineHeight = 12;
        const productLinesCount = Math.ceil(productName.length / 25); // Approximate lines needed
        
        // Add barcode on the same line as first product line
        doc.text(item.productBarcode || 'N/A', 200, yPosition, { width: 110 });
        
        // Add other columns with proper width constraints
        doc.text(item.quantity.toString(), 320, yPosition, { width: 40 });
        doc.text(`Rs. ${parseFloat(item.unitPrice || 0).toFixed(2)}`, 370, yPosition, { width: 70 });
        doc.text(`Rs. ${parseFloat(item.discountAmount || 0).toFixed(2)}`, 450, yPosition, { width: 60 });
        doc.text(`Rs. ${parseFloat(item.totalAmount || 0).toFixed(2)}`, 520, yPosition, { width: 60 });
        
        // Move to next row, accounting for multiple lines if product name wrapped
        yPosition += Math.max(20, productLinesCount * productLineHeight);
      });
    } else {
      logger.warn('No items found for invoice');
      doc.text('No items found', 50, yPosition);
      yPosition += 20;
    }

    // Draw line under items
    doc.moveTo(50, yPosition - 5).lineTo(580, yPosition - 5).stroke();
    
    // Return the final Y position for the totals section
    return yPosition + 20;
  }

  addTotals(doc, invoice, startYPosition) {
    // Use the Y position passed from addItemsTable
    const baseYPosition = startYPosition || 400;
    
    // Position totals section with enough space to prevent wrapping
    const totalsXPosition = 400; // Move left to give more space
    
    doc.fontSize(12).text(`Subtotal: Rs. ${parseFloat(invoice.subtotal).toFixed(2)}`, totalsXPosition, baseYPosition);
    
    if (parseFloat(invoice.discountAmount) > 0) {
      doc.text(`Discount: -Rs. ${parseFloat(invoice.discountAmount).toFixed(2)}`, totalsXPosition, baseYPosition + 20);
    }
    
    if (parseFloat(invoice.taxAmount) > 0) {
      doc.text(`Tax: Rs. ${parseFloat(invoice.taxAmount).toFixed(2)}`, totalsXPosition, baseYPosition + 40);
    }
    
    doc.fontSize(14).text(`Total: Rs. ${parseFloat(invoice.totalAmount).toFixed(2)}`, totalsXPosition, baseYPosition + 60);
    
    if (parseFloat(invoice.paidAmount) > 0) {
      doc.text(`Paid: Rs. ${parseFloat(invoice.paidAmount).toFixed(2)}`, totalsXPosition, baseYPosition + 80);
      
      if (parseFloat(invoice.paidAmount) < parseFloat(invoice.totalAmount)) {
        doc.text(`Balance: Rs. ${(parseFloat(invoice.totalAmount) - parseFloat(invoice.paidAmount)).toFixed(2)}`, totalsXPosition, baseYPosition + 100);
      }
    }
  }

  addFooter(doc, invoice) {
    const yPosition = 500;
    
    if (invoice.notes) {
      doc.fontSize(10).text('Notes:', 50, yPosition);
      doc.text(invoice.notes, 50, yPosition + 15);
    }
    
    doc.fontSize(8).text('Thank you for your business!', 50, yPosition + 50);
    doc.text(`Generated on: ${moment().format('DD/MM/YYYY HH:mm:ss')}`, 50, yPosition + 65);
  }

  async getInvoices(filters = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        customerId,
        paymentStatus,
        startDate,
        endDate,
        search
      } = filters;

      const offset = (page - 1) * limit;
      const where = {};

      if (customerId) {
        where.customerId = customerId;
      }

      if (paymentStatus) {
        where.paymentStatus = paymentStatus;
      }

      if (startDate && endDate) {
        where.invoiceDate = {
          [require('sequelize').Op.between]: [startDate, endDate]
        };
      }

      if (search) {
        where[require('sequelize').Op.or] = [
          { invoiceNumber: { [require('sequelize').Op.iLike]: `%${search}%` } },
          { customerName: { [require('sequelize').Op.iLike]: `%${search}%` } }
        ];
      }

      const { count, rows } = await Invoice.findAndCountAll({
        where,
        include: [
          {
            model: Customer,
            as: 'customer',
            required: false
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return {
        invoices: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      };
    } catch (error) {
      logger.error('Error fetching invoices:', error);
      throw error;
    }
  }

  async updateInvoiceStatus(invoiceId, status, paidAmount = null) {
    try {
      const invoice = await Invoice.findByPk(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const updateData = { paymentStatus: status };
      
      if (paidAmount !== null) {
        updateData.paidAmount = paidAmount;
      }

      await invoice.update(updateData);
      
      logger.info(`Invoice ${invoice.invoiceNumber} status updated to ${status}`);
      return invoice;
    } catch (error) {
      logger.error('Error updating invoice status:', error);
      throw error;
    }
  }
}

module.exports = new InvoiceService();
