const express = require('express');
const router = express.Router();
const { Invoice, InvoiceItem, Product } = require('../models');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');

// Apply authentication middleware to all routes
router.use(auth);

/**
 * Get sales reports data
 * GET /api/reports/sales
 * Query params: period (daily/monthly/yearly), year, month, date
 */
router.get('/sales', async (req, res) => {
    try {
        const { period = 'monthly', year, month, date } = req.query;
        
        logger.info(`Generating sales report for period: ${period}, year: ${year}, month: ${month}, date: ${date}`);
        
        // Build date filter
        const dateFilter = buildDateFilter(period, year, month, date);
        
        // Get invoices with items
        const invoices = await Invoice.findAll({
            where: {
                ...dateFilter,
                paymentStatus: {
                    [require('sequelize').Op.ne]: 'cancelled'
                },
                isActive: true
            },
            include: [{
                model: InvoiceItem,
                as: 'items',
                include: [{
                    model: Product,
                    as: 'product'
                }]
            }],
            order: [['invoiceDate', 'ASC']]
        });
        
        logger.info(`Found ${invoices.length} invoices for report`);
        
        // Process data based on period
        const reportData = processReportData(invoices, period);
        
        res.json({
            success: true,
            data: reportData
        });
        
    } catch (error) {
        logger.error('Error generating sales report:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating sales report',
            error: error.message
        });
    }
});

/**
 * Build date filter based on period and parameters
 */
function buildDateFilter(period, year, month, date) {
    const filter = {};
    
    switch (period) {
        case 'daily':
            if (date) {
                const startDate = new Date(date);
                const endDate = new Date(date);
                endDate.setDate(endDate.getDate() + 1);
                filter.invoiceDate = {
                    [require('sequelize').Op.gte]: startDate,
                    [require('sequelize').Op.lt]: endDate
                };
            } else {
                // Default to today
                const today = new Date();
                const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + 1);
                filter.invoiceDate = {
                    [require('sequelize').Op.gte]: startDate,
                    [require('sequelize').Op.lt]: endDate
                };
            }
            break;
            
        case 'monthly':
            if (year && month && month !== 'all') {
                const startDate = new Date(year, month - 1, 1);
                const endDate = new Date(year, month, 1);
                filter.invoiceDate = {
                    [require('sequelize').Op.gte]: startDate,
                    [require('sequelize').Op.lt]: endDate
                };
            } else if (year) {
                const startDate = new Date(year, 0, 1);
                const endDate = new Date(year + 1, 0, 1);
                filter.invoiceDate = {
                    [require('sequelize').Op.gte]: startDate,
                    [require('sequelize').Op.lt]: endDate
                };
            }
            break;
            
        case 'yearly':
            if (year) {
                const startDate = new Date(year, 0, 1);
                const endDate = new Date(year + 1, 0, 1);
                filter.invoiceDate = {
                    [require('sequelize').Op.gte]: startDate,
                    [require('sequelize').Op.lt]: endDate
                };
            }
            break;
            
        case 'custom':
            // For custom range, we'd need start and end dates
            // This is a placeholder for future implementation
            break;
    }
    
    return filter;
}

/**
 * Process invoice data into report format
 */
function processReportData(invoices, period) {
    const summary = calculateSummary(invoices);
    const chartData = generateChartData(invoices, period);
    const tableData = generateTableData(invoices, period);
    
    return {
        summary,
        chartData,
        tableData
    };
}

/**
 * Calculate summary statistics
 */
function calculateSummary(invoices) {
    const totalSales = invoices.reduce((sum, invoice) => sum + parseFloat(invoice.totalAmount || 0), 0);
    const totalInvoices = invoices.length;
    const averageInvoiceValue = totalInvoices > 0 ? totalSales / totalInvoices : 0;
    
    const totalItemsSold = invoices.reduce((sum, invoice) => {
        return sum + invoice.items.reduce((itemSum, item) => itemSum + parseInt(item.quantity || 0), 0);
    }, 0);
    
    return {
        totalSales: parseFloat(totalSales),
        totalInvoices: parseInt(totalInvoices),
        averageInvoiceValue: parseFloat(averageInvoiceValue),
        totalItemsSold: parseInt(totalItemsSold)
    };
}

/**
 * Generate chart data for sales trend
 */
function generateChartData(invoices, period) {
    const salesTrend = groupInvoicesByPeriod(invoices, period);
    const paymentMethods = calculatePaymentMethods(invoices);
    
    return {
        salesTrend: {
            labels: salesTrend.labels,
            values: salesTrend.values
        },
        paymentMethods: {
            labels: paymentMethods.labels,
            values: paymentMethods.values
        }
    };
}

/**
 * Group invoices by period for chart
 */
function groupInvoicesByPeriod(invoices, period) {
    const groups = {};
    
    invoices.forEach(invoice => {
        let key;
        const date = new Date(invoice.invoiceDate);
        
        switch (period) {
            case 'daily':
                key = date.toISOString().split('T')[0]; // YYYY-MM-DD
                break;
            case 'monthly':
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                break;
            case 'yearly':
                key = date.getFullYear().toString();
                break;
            default:
                key = date.toISOString().split('T')[0];
        }
        
        if (!groups[key]) {
            groups[key] = 0;
        }
        groups[key] += parseFloat(invoice.totalAmount || 0);
    });
    
    const labels = Object.keys(groups).sort();
    const values = labels.map(label => parseFloat(groups[label]));
    
    return { labels, values };
}

/**
 * Calculate payment methods distribution
 */
function calculatePaymentMethods(invoices) {
    const methods = {};
    
    invoices.forEach(invoice => {
        const method = invoice.paymentMethod || 'Unknown';
        if (!methods[method]) {
            methods[method] = 0;
        }
        methods[method] += parseFloat(invoice.totalAmount || 0);
    });
    
    const labels = Object.keys(methods);
    const values = labels.map(label => parseFloat(methods[label]));
    
    return { labels, values };
}

/**
 * Generate table data for detailed report
 */
function generateTableData(invoices, period) {
    const groups = groupInvoicesByPeriod(invoices, period);
    const tableData = [];
    
    let previousValue = 0;
    
    Object.keys(groups).sort().forEach((key, index) => {
        const groupInvoices = invoices.filter(invoice => {
            const date = new Date(invoice.invoiceDate);
            let invoiceKey;
            
            switch (period) {
                case 'daily':
                    invoiceKey = date.toISOString().split('T')[0];
                    break;
                case 'monthly':
                    invoiceKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    break;
                case 'yearly':
                    invoiceKey = date.getFullYear().toString();
                    break;
                default:
                    invoiceKey = date.toISOString().split('T')[0];
            }
            return invoiceKey === key;
        });
        
        const totalSales = groups[key];
        const invoiceCount = groupInvoices.length;
        const averageInvoice = invoiceCount > 0 ? totalSales / invoiceCount : 0;
        
        const itemsSold = groupInvoices.reduce((sum, invoice) => {
            return sum + invoice.items.reduce((itemSum, item) => itemSum + parseInt(item.quantity || 0), 0);
        }, 0);
        
        const growth = index > 0 && previousValue > 0 ? ((totalSales - previousValue) / previousValue) * 100 : 0;
        
        tableData.push({
            period: formatPeriodLabel(key, period),
            invoices: invoiceCount,
            itemsSold: itemsSold,
            totalSales: parseFloat(totalSales),
            averageInvoice: parseFloat(averageInvoice),
            growth: parseFloat(growth)
        });
        
        previousValue = totalSales;
    });
    
    return tableData;
}

/**
 * Format period label for display
 */
function formatPeriodLabel(key, period) {
    switch (period) {
        case 'daily':
            return new Date(key).toLocaleDateString();
        case 'monthly':
            const [year, month] = key.split('-');
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${monthNames[parseInt(month) - 1]} ${year}`;
        case 'yearly':
            return key;
        default:
            return key;
    }
}

module.exports = router;
