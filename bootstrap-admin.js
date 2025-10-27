const express = require('express');
const bcrypt = require('bcryptjs');
const { User } = require('./src/models');
const logger = require('./src/utils/logger');

const app = express();
app.use(express.json());

// Bootstrap endpoint to create first admin user
app.post('/bootstrap', async (req, res) => {
  try {
    // Check if any users exist
    const userCount = await User.count();
    
    if (userCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'System already has users. Bootstrap not allowed.'
      });
    }
    
    // Create admin user
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash('admin123', saltRounds);
    
    const adminUser = await User.create({
      username: 'admin',
      email: 'admin@medicalinventory.com',
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'admin',
      isActive: true
    });
    
    logger.info('Bootstrap: Admin user created successfully');
    
    res.json({
      success: true,
      message: 'Admin user created successfully',
      data: {
        email: 'admin@medicalinventory.com',
        password: 'admin123',
        role: 'admin'
      }
    });
    
  } catch (error) {
    logger.error('Bootstrap error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating admin user',
      error: error.message
    });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Bootstrap server running on port ${PORT}`);
  console.log('Run: curl -X POST http://localhost:3001/bootstrap');
});
