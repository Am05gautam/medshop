const express = require('express');
const { Product } = require('../models');
const barcodeService = require('../services/barcodeService');
const { validate, productSchemas } = require('../middleware/validation');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Get all products with pagination and filtering
router.get('/', auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      lowStock,
      expiringSoon,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const where = { isActive: true };

    // Search filter
    if (search) {
      where[require('sequelize').Op.or] = [
        { name: { [require('sequelize').Op.iLike]: `%${search}%` } },
        { barcode: { [require('sequelize').Op.iLike]: `%${search}%` } },
        { manufacturer: { [require('sequelize').Op.iLike]: `%${search}%` } }
      ];
    }

    // Category filter
    if (category) {
      where.category = category;
    }

    // Low stock filter
    if (lowStock === 'true') {
      where.availableQuantity = {
        [require('sequelize').Op.lte]: require('sequelize').col('minimumQuantity')
      };
    }

    // Expiring soon filter
    if (expiringSoon === 'true') {
      const alertDate = new Date();
      alertDate.setDate(alertDate.getDate() + 30); // 30 days from now
      
      where.expiryDate = {
        [require('sequelize').Op.between]: [new Date(), alertDate]
      };
    }

    const { count, rows } = await Product.findAndCountAll({
      where,
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        products: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error.message
    });
  }
});

// Get product by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    logger.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product',
      error: error.message
    });
  }
});

// Create new product
router.post('/', auth, authorize('admin', 'manager'), validate(productSchemas.create), async (req, res) => {
  try {
    const productData = req.body;
    
    logger.info(`Attempting to create product with barcode: '${productData.barcode}'`);

    // Check if barcode already exists
    const existingProduct = await Product.findOne({
      where: { barcode: productData.barcode }
    });

    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: `Product with barcode '${productData.barcode}' already exists. Existing product: ${existingProduct.name}`
      });
    }

    const product = await Product.create(productData);

    logger.info(`Product created: ${product.name} (${product.barcode})`);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error) {
    logger.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating product',
      error: error.message
    });
  }
});

// Update product
router.put('/:id', auth, authorize('admin', 'manager'), validate(productSchemas.update), async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if barcode is being changed and if it already exists
    if (req.body.barcode && req.body.barcode !== product.barcode) {
      const existingProduct = await Product.findOne({
        where: { 
          barcode: req.body.barcode,
          id: { [require('sequelize').Op.ne]: product.id }
        }
      });

      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: 'Product with this barcode already exists'
        });
      }
    }

    await product.update(req.body);

    logger.info(`Product updated: ${product.name} (${product.barcode})`);

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    logger.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating product',
      error: error.message
    });
  }
});

// Delete product (soft delete)
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    await product.update({ isActive: false });

    logger.info(`Product deleted: ${product.name} (${product.barcode})`);

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting product',
      error: error.message
    });
  }
});

// Scan barcode and get product info
router.post('/scan', auth, async (req, res) => {
  try {
    const { barcode } = req.body;

    if (!barcode) {
      return res.status(400).json({
        success: false,
        message: 'Barcode is required'
      });
    }

    // Validate barcode format
    if (!barcodeService.validateBarcode(barcode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid barcode format'
      });
    }

    // Check if product exists in database
    const existingProduct = await Product.findOne({
      where: { barcode, isActive: true }
    });

    if (existingProduct) {
      return res.json({
        success: true,
        data: {
          found: true,
          product: existingProduct,
          source: 'database'
        }
      });
    }

    // Look up product from external APIs
    const productInfo = await barcodeService.lookupProduct(barcode);

    if (productInfo) {
      return res.json({
        success: true,
        data: {
          found: true,
          product: productInfo,
          source: 'external_api'
        }
      });
    }

    res.json({
      success: true,
      data: {
        found: false,
        message: 'Product not found in database or external APIs'
      }
    });
  } catch (error) {
    logger.error('Error scanning barcode:', error);
    res.status(500).json({
      success: false,
      message: 'Error scanning barcode',
      error: error.message
    });
  }
});

// Update product quantity
router.patch('/:id/quantity', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { quantity, operation = 'set' } = req.body;

    if (typeof quantity !== 'number' || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }

    const product = await Product.findByPk(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    await product.updateQuantity(quantity, operation);

    logger.info(`Product quantity updated: ${product.name} - ${operation} ${quantity}`);

    res.json({
      success: true,
      message: 'Product quantity updated successfully',
      data: product
    });
  } catch (error) {
    logger.error('Error updating product quantity:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating product quantity',
      error: error.message
    });
  }
});

// Get product categories
router.get('/meta/categories', auth, async (req, res) => {
  try {
    const categories = await Product.findAll({
      attributes: ['category'],
      where: {
        category: { [require('sequelize').Op.ne]: null },
        isActive: true
      },
      group: ['category'],
      order: [['category', 'ASC']]
    });

    res.json({
      success: true,
      data: categories.map(cat => cat.category).filter(Boolean)
    });
  } catch (error) {
    logger.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message
    });
  }
});

// Get low stock products
router.get('/alerts/low-stock', auth, async (req, res) => {
  try {
    const products = await Product.findAll({
      where: {
        isActive: true,
        availableQuantity: {
          [require('sequelize').Op.lte]: require('sequelize').col('minimumQuantity')
        }
      },
      order: [['availableQuantity', 'ASC']]
    });

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    logger.error('Error fetching low stock products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching low stock products',
      error: error.message
    });
  }
});

// Get expiring products
router.get('/alerts/expiring', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const alertDate = new Date();
    alertDate.setDate(alertDate.getDate() + days);

    const products = await Product.findAll({
      where: {
        isActive: true,
        expiryDate: {
          [require('sequelize').Op.between]: [new Date(), alertDate]
        }
      },
      order: [['expiryDate', 'ASC']]
    });

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    logger.error('Error fetching expiring products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching expiring products',
      error: error.message
    });
  }
});

module.exports = router;
