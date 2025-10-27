const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 255]
    }
  },
  barcode: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  manufacturer: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  batchNumber: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'batch_number'
  },
  expiryDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'expiry_date',
    validate: {
      isDate: true,
      isAfter: new Date().toISOString().split('T')[0]
    }
  },
  availableQuantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'available_quantity',
    validate: {
      min: 0
    }
  },
  minimumQuantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'minimum_quantity',
    validate: {
      min: 0
    }
  },
  maximumQuantity: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'maximum_quantity',
    validate: {
      min: 0
    }
  },
  unitPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'unit_price',
    validate: {
      min: 0
    }
  },
  sellingPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'selling_price',
    validate: {
      min: 0
    }
  },
  unit: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pcs',
    validate: {
      isIn: [['pcs', 'box', 'bottle', 'strip', 'tablet', 'capsule', 'ml', 'mg', 'g', 'kg']]
    }
  },
  location: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  },
  lastRestocked: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_restocked'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'products',
  indexes: [
    {
      unique: true,
      fields: ['barcode']
    },
    {
      fields: ['name']
    },
    {
      fields: ['category']
    },
    {
      fields: ['expiry_date']
    },
    {
      fields: ['available_quantity']
    },
    {
      fields: ['is_active']
    }
  ]
});

// Instance methods
Product.prototype.isLowStock = function() {
  return this.availableQuantity <= this.minimumQuantity;
};

Product.prototype.isExpired = function() {
  if (!this.expiryDate) return false;
  return new Date(this.expiryDate) < new Date();
};

Product.prototype.isExpiringSoon = function(days = 30) {
  if (!this.expiryDate) return false;
  const expiryDate = new Date(this.expiryDate);
  const alertDate = new Date();
  alertDate.setDate(alertDate.getDate() + days);
  return expiryDate <= alertDate && expiryDate > new Date();
};

Product.prototype.updateQuantity = async function(newQuantity, operation = 'set') {
  if (operation === 'add') {
    this.availableQuantity += newQuantity;
  } else if (operation === 'subtract') {
    this.availableQuantity = Math.max(0, this.availableQuantity - newQuantity);
  } else {
    this.availableQuantity = newQuantity;
  }
  
  if (operation === 'add') {
    this.lastRestocked = new Date();
  }
  
  return this.save();
};

module.exports = Product;
