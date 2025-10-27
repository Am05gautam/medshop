-- Database initialization script for Medical Inventory Management System
-- This script creates the initial admin user

-- Insert default admin user
-- Password: admin123 (hashed with bcrypt, rounds=12)
INSERT INTO users (
    id,
    username,
    email,
    password,
    first_name,
    last_name,
    role,
    is_active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'admin',
    'admin@medicalinventory.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8Kz8Kz2', -- admin123
    'System',
    'Administrator',
    'admin',
    true,
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- Insert sample categories
INSERT INTO products (id, name, barcode, category, manufacturer, available_quantity, minimum_quantity, unit_price, selling_price, unit, is_active, created_at, updated_at)
VALUES 
    (gen_random_uuid(), 'Paracetamol 500mg', '1234567890123', 'Pain Relief', 'Generic Pharma', 100, 20, 0.50, 1.00, 'tablet', true, NOW(), NOW()),
    (gen_random_uuid(), 'Amoxicillin 250mg', '1234567890124', 'Antibiotic', 'MediCorp', 50, 10, 2.00, 3.50, 'capsule', true, NOW(), NOW()),
    (gen_random_uuid(), 'Vitamin D3', '1234567890125', 'Vitamins', 'HealthPlus', 75, 15, 1.50, 2.50, 'tablet', true, NOW(), NOW())
ON CONFLICT (barcode) DO NOTHING;

-- Insert sample customer
INSERT INTO customers (id, name, email, phone, customer_type, is_active, created_at, updated_at)
VALUES 
    (gen_random_uuid(), 'John Doe', 'john@example.com', '+1234567890', 'individual', true, NOW(), NOW()),
    (gen_random_uuid(), 'ABC Pharmacy', 'orders@abcpharmacy.com', '+1234567891', 'wholesale', true, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;
