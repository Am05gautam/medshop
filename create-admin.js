require('dotenv').config();
const bcrypt = require('bcryptjs');
const { User } = require('./src/models');

async function createAdminUser() {
  try {
    console.log('Creating admin user...');
    
    // Check if admin user already exists
    const existingAdmin = await User.findOne({
      where: { email: 'admin@medicalinventory.com' }
    });
    
    if (existingAdmin) {
      console.log('Admin user already exists!');
      console.log('Email: admin@medicalinventory.com');
      console.log('Password: admin123');
      return;
    }
    
    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash('admin123', saltRounds);
    
    // Create admin user
    const adminUser = await User.create({
      username: 'admin',
      email: 'admin@medicalinventory.com',
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'admin',
      isActive: true
    });
    
    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: admin@medicalinventory.com');
    console.log('🔑 Password: admin123');
    console.log('👤 Role: Admin');
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  }
}

// Run the function
createAdminUser().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});
