const { sequelize } = require('../config/database');

// Import all models
const User = require('./User');
const Product = require('./Product');
const Customer = require('./Customer');
const Invoice = require('./Invoice');
const InvoiceItem = require('./InvoiceItem');
const Alert = require('./Alert');

// Define associations

// Customer - Invoice relationship (One-to-Many)
Customer.hasMany(Invoice, {
  foreignKey: 'customerId',
  as: 'invoices'
});
Invoice.belongsTo(Customer, {
  foreignKey: 'customerId',
  as: 'customer'
});

// Invoice - InvoiceItem relationship (One-to-Many)
Invoice.hasMany(InvoiceItem, {
  foreignKey: 'invoiceId',
  as: 'items',
  onDelete: 'CASCADE'
});
InvoiceItem.belongsTo(Invoice, {
  foreignKey: 'invoiceId',
  as: 'invoice'
});

// Product - InvoiceItem relationship (One-to-Many)
Product.hasMany(InvoiceItem, {
  foreignKey: 'productId',
  as: 'invoiceItems'
});
InvoiceItem.belongsTo(Product, {
  foreignKey: 'productId',
  as: 'product'
});

// Product - Alert relationship (One-to-Many)
Product.hasMany(Alert, {
  foreignKey: 'productId',
  as: 'alerts'
});
Alert.belongsTo(Product, {
  foreignKey: 'productId',
  as: 'product'
});

// Export all models and sequelize instance
module.exports = {
  sequelize,
  User,
  Product,
  Customer,
  Invoice,
  InvoiceItem,
  Alert
};
