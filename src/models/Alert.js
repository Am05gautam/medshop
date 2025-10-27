const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Alert = sequelize.define('Alert', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  type: {
    type: DataTypes.ENUM('low_stock', 'expiry', 'out_of_stock', 'custom'),
    allowNull: false,
    validate: {
      isIn: [['low_stock', 'expiry', 'out_of_stock', 'custom']]
    }
  },
  productId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'product_id',
    references: {
      model: 'products',
      key: 'id'
    }
  },
  productName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'product_name'
  },
  productBarcode: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'product_barcode'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  severity: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    allowNull: false,
    defaultValue: 'medium',
    validate: {
      isIn: [['low', 'medium', 'high', 'critical']]
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'sent', 'failed', 'acknowledged'),
    allowNull: false,
    defaultValue: 'pending',
    validate: {
      isIn: [['pending', 'sent', 'failed', 'acknowledged']]
    }
  },
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'sent_at'
  },
  acknowledgedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'acknowledged_at'
  },
  acknowledgedBy: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'acknowledged_by'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'alerts',
  indexes: [
    {
      fields: ['type']
    },
    {
      fields: ['product_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['severity']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['is_active']
    }
  ]
});

module.exports = Alert;
