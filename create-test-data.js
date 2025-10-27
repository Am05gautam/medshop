// Set environment to use SQLite
process.env.NODE_ENV = 'development';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = './database.sqlite';

const { Product, Invoice, InvoiceItem, User } = require('./src/models');
const bcrypt = require('bcryptjs');

async function createTestData() {
    try {
        console.log('Creating test data...');
        
        // Check if user exists, create if not
        let user = await User.findOne({ where: { username: 'admin' } });
        if (!user) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            user = await User.create({
                username: 'admin',
                email: 'admin@example.com',
                password: hashedPassword,
                role: 'admin',
                firstName: 'Admin',
                lastName: 'User'
            });
            console.log('Created user:', user.username);
        } else {
            console.log('User already exists:', user.username);
        }
        
        // Create test products
        const products = await Product.bulkCreate([
            {
                name: 'Paracetamol 500mg',
                barcode: '8901234567890',
                category: 'Pain Relief',
                manufacturer: 'ABC Pharma',
                availableQuantity: 100,
                minimumQuantity: 10,
                unitPrice: 2.50,
                sellingPrice: 3.00,
                unit: 'tablet',
                expiryDate: '2025-12-31'
            },
            {
                name: 'Amoxicillin 250mg',
                barcode: '8901234567891',
                category: 'Antibiotic',
                manufacturer: 'XYZ Pharma',
                availableQuantity: 50,
                minimumQuantity: 5,
                unitPrice: 5.00,
                sellingPrice: 6.00,
                unit: 'capsule',
                expiryDate: '2025-11-30'
            },
            {
                name: 'Vitamin D3',
                barcode: '8901234567892',
                category: 'Vitamin',
                manufacturer: 'Health Plus',
                availableQuantity: 200,
                minimumQuantity: 20,
                unitPrice: 1.50,
                sellingPrice: 2.00,
                unit: 'tablet',
                expiryDate: '2026-01-31'
            }
        ]);
        console.log('Created products:', products.length);
        
        // Create a test invoice
        const invoice = await Invoice.create({
            invoiceNumber: 'INV000001',
            customerName: 'John Doe',
            customerPhone: '+1234567890',
            customerEmail: 'john@example.com',
            customerAddress: '123 Main St, City, State',
            invoiceDate: new Date(),
            subtotal: 15.00,
            discountAmount: 1.50,
            taxAmount: 0.00,
            totalAmount: 13.50,
            paymentStatus: 'paid',
            paymentMethod: 'cash',
            paidAmount: 13.50
        });
        console.log('Created invoice:', invoice.invoiceNumber);
        
        // Create invoice items
        const invoiceItems = await InvoiceItem.bulkCreate([
            {
                invoiceId: invoice.id,
                productId: products[0].id,
                productName: products[0].name,
                productBarcode: products[0].barcode,
                quantity: 5,
                unitPrice: 3.00,
                discountAmount: 0.00,
                totalAmount: 15.00
            },
            {
                invoiceId: invoice.id,
                productId: products[1].id,
                productName: products[1].name,
                productBarcode: products[1].barcode,
                quantity: 2,
                unitPrice: 6.00,
                discountAmount: 1.50,
                totalAmount: 10.50
            }
        ]);
        console.log('Created invoice items:', invoiceItems.length);
        
        console.log('Test data created successfully!');
        console.log('Invoice ID:', invoice.id);
        console.log('You can now test PDF generation with this invoice.');
        
    } catch (error) {
        console.error('Error creating test data:', error);
    }
}

createTestData();
