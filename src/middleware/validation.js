const Joi = require('joi');
const logger = require('../utils/logger');

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      logger.warn('Validation error:', errorMessage);
      
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: errorMessage,
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    
    next();
  };
};

// Product validation schemas
const productSchemas = {
  create: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    barcode: Joi.string().min(1).max(50).required(),
    description: Joi.string().allow('').optional(),
    category: Joi.string().max(100).optional(),
    manufacturer: Joi.string().max(255).optional(),
    batchNumber: Joi.string().max(50).optional(),
    expiryDate: Joi.date().iso().min('now').optional(),
    availableQuantity: Joi.number().integer().min(0).default(0),
    minimumQuantity: Joi.number().integer().min(0).default(0),
    maximumQuantity: Joi.number().integer().min(0).optional(),
    unitPrice: Joi.number().precision(2).min(0).default(0),
    sellingPrice: Joi.number().precision(2).min(0).default(0),
    unit: Joi.string().valid('pcs', 'box', 'bottle', 'strip', 'tablet', 'capsule', 'ml', 'mg', 'g', 'kg').default('pcs'),
    location: Joi.string().max(100).optional(),
    notes: Joi.string().allow('').optional()
  }),
  
  update: Joi.object({
    name: Joi.string().min(1).max(255).optional(),
    barcode: Joi.string().min(1).max(50).optional(),
    description: Joi.string().allow('').optional(),
    category: Joi.string().max(100).optional(),
    manufacturer: Joi.string().max(255).optional(),
    batchNumber: Joi.string().max(50).optional(),
    expiryDate: Joi.date().iso().min('now').optional(),
    availableQuantity: Joi.number().integer().min(0).optional(),
    minimumQuantity: Joi.number().integer().min(0).optional(),
    maximumQuantity: Joi.number().integer().min(0).optional(),
    unitPrice: Joi.number().precision(2).min(0).optional(),
    sellingPrice: Joi.number().precision(2).min(0).optional(),
    unit: Joi.string().valid('pcs', 'box', 'bottle', 'strip', 'tablet', 'capsule', 'ml', 'mg', 'g', 'kg').optional(),
    location: Joi.string().max(100).optional(),
    notes: Joi.string().allow('').optional(),
    isActive: Joi.boolean().optional()
  })
};

// Customer validation schemas
const customerSchemas = {
  create: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    email: Joi.string().email().optional(),
    phone: Joi.string().min(10).max(20).optional(),
    address: Joi.string().allow('').optional(),
    city: Joi.string().max(100).optional(),
    state: Joi.string().max(100).optional(),
    pincode: Joi.string().max(10).optional(),
    customerType: Joi.string().valid('individual', 'wholesale', 'retail').default('individual'),
    discountPercentage: Joi.number().precision(2).min(0).max(100).default(0),
    creditLimit: Joi.number().precision(2).min(0).optional(),
    notes: Joi.string().allow('').optional()
  }),
  
  update: Joi.object({
    name: Joi.string().min(1).max(255).optional(),
    email: Joi.string().email().optional(),
    phone: Joi.string().min(10).max(20).optional(),
    address: Joi.string().allow('').optional(),
    city: Joi.string().max(100).optional(),
    state: Joi.string().max(100).optional(),
    pincode: Joi.string().max(10).optional(),
    customerType: Joi.string().valid('individual', 'wholesale', 'retail').optional(),
    discountPercentage: Joi.number().precision(2).min(0).max(100).optional(),
    creditLimit: Joi.number().precision(2).min(0).optional(),
    notes: Joi.string().allow('').optional(),
    isActive: Joi.boolean().optional()
  })
};

// Invoice validation schemas
const invoiceSchemas = {
  create: Joi.object({
    customerId: Joi.string().uuid().optional(),
    customerName: Joi.string().min(1).max(255).required(),
    customerPhone: Joi.string().max(20).optional(),
    customerEmail: Joi.string().email().optional(),
    customerAddress: Joi.string().allow('').optional(),
    invoiceDate: Joi.date().iso().optional(), // Add invoice date
    dueDate: Joi.date().iso().allow(null, '').optional(), // Make due date optional and allow null/empty
    discountAmount: Joi.number().precision(2).min(0).default(0),
    discountPercentage: Joi.number().precision(2).min(0).max(100).default(0),
    taxAmount: Joi.number().precision(2).min(0).default(0),
    taxPercentage: Joi.number().precision(2).min(0).max(100).default(0),
    paymentMethod: Joi.string().valid('cash', 'card', 'upi', 'netbanking', 'cheque', 'credit').optional(),
    notes: Joi.string().allow('').optional(),
    items: Joi.array().items(
      Joi.object({
        productId: Joi.string().uuid().required(),
        quantity: Joi.number().integer().min(1).required(),
        unitPrice: Joi.number().precision(2).min(0).required(),
        discountAmount: Joi.number().precision(2).min(0).default(0),
        discountPercentage: Joi.number().precision(2).min(0).max(100).default(0)
      })
    ).min(1).required()
  })
};

// User validation schemas
const userSchemas = {
  register: Joi.object({
    username: Joi.string().alphanum().min(3).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    firstName: Joi.string().min(1).max(100).required(),
    lastName: Joi.string().min(1).max(100).required(),
    role: Joi.string().valid('admin', 'manager', 'cashier', 'staff').default('staff'),
    phone: Joi.string().min(10).max(20).optional()
  }),
  
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),
  
  update: Joi.object({
    firstName: Joi.string().min(1).max(100).optional(),
    lastName: Joi.string().min(1).max(100).optional(),
    phone: Joi.string().min(10).max(20).optional(),
    role: Joi.string().valid('admin', 'manager', 'cashier', 'staff').optional(),
    isActive: Joi.boolean().optional()
  })
};

module.exports = {
  validate,
  productSchemas,
  customerSchemas,
  invoiceSchemas,
  userSchemas
};
