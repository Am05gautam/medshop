# Gautam Medicals - Setup Guide

## Quick Start

### Prerequisites
- Node.js 16+ 
- PostgreSQL (or Docker)
- Git

### 1. Clone and Install
```bash
git clone <your-repo-url>
cd medical-inventory-management
npm install
```

### 2. Environment Setup
```bash
cp env.example .env
# Edit .env with your configuration
```

### 3. Database Setup
```bash
# For PostgreSQL
createdb medical_inventory

# For SQLite (development)
# Just update .env to use SQLite
```

### 4. Start the Application
```bash
# Development
npm run dev

# Production
npm start
```

### 5. Access the Application
- Open http://localhost:3000
- Default login: admin@example.com / password123

## Docker Setup

### Development with Docker
```bash
docker-compose -f docker-compose.dev.yml up --build
```

### Production with Docker
```bash
docker-compose up --build
```

## Features Overview

### ✅ Completed Features
1. **Product Management**
   - Add products with barcode scanning
   - Auto-fill product details from external APIs
   - Inventory tracking and quantity management
   - Low stock and expiry alerts

2. **Invoice System**
   - Create invoices with multiple products
   - PDF generation and printing
   - Customer management
   - Payment tracking

3. **Alert System**
   - Automated low stock alerts
   - Expiry date notifications
   - WhatsApp integration
   - Cron job scheduling

4. **User Management**
   - Role-based access control
   - JWT authentication
   - User profiles and settings

5. **Modern UI**
   - Responsive Bootstrap interface
   - Real-time updates
   - Interactive dashboards
   - Mobile-friendly design

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/profile` - Get user profile

### Products
- `GET /api/products` - List products
- `POST /api/products` - Add product
- `POST /api/products/scan` - Scan barcode
- `GET /api/products/alerts/low-stock` - Low stock products
- `GET /api/products/alerts/expiring` - Expiring products

### Invoices
- `GET /api/invoices` - List invoices
- `POST /api/invoices` - Create invoice
- `GET /api/invoices/:id/pdf` - Download PDF
- `PATCH /api/invoices/:id/status` - Update status

### Alerts
- `GET /api/alerts` - List alerts
- `POST /api/alerts/check` - Manual alert check
- `PATCH /api/alerts/:id/acknowledge` - Acknowledge alert

## Configuration

### Environment Variables
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=medical_inventory
DB_USER=postgres
DB_PASSWORD=password

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=24h

# WhatsApp
WHATSAPP_API_URL=https://graph.facebook.com/v17.0
WHATSAPP_TOKEN=your_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_id

# Alerts
ALERT_CHECK_INTERVAL=0 9 * * *
EXPIRY_ALERT_DAYS=30
```

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Check PostgreSQL is running
   - Verify connection credentials in .env
   - Ensure database exists

2. **WhatsApp Integration Not Working**
   - Verify WhatsApp Business API credentials
   - Check phone number format
   - Ensure webhook is configured

3. **Barcode Scanning Issues**
   - Check internet connection for API lookups
   - Verify barcode format validity
   - Test with known valid barcodes

### Logs
- Application logs: `logs/combined.log`
- Error logs: `logs/error.log`
- Check logs for detailed error information

## Development

### Project Structure
```
src/
├── config/          # Database and app configuration
├── controllers/     # Route controllers
├── middleware/     # Custom middleware
├── models/         # Database models
├── routes/         # API routes
├── services/       # Business logic
└── utils/          # Utility functions
```

### Adding New Features
1. Create model in `src/models/`
2. Add routes in `src/routes/`
3. Implement business logic in `src/services/`
4. Update frontend in `public/`

## Security Considerations

1. **Change Default Credentials**
   - Update JWT secret
   - Change default admin password
   - Use strong database passwords

2. **Environment Variables**
   - Never commit .env files
   - Use different secrets for production
   - Rotate secrets regularly

3. **API Security**
   - Rate limiting enabled
   - Input validation
   - SQL injection protection
   - XSS protection

## Production Deployment

### Checklist
- [ ] Update all environment variables
- [ ] Configure SSL certificates
- [ ] Set up database backups
- [ ] Configure monitoring
- [ ] Test WhatsApp integration
- [ ] Verify all features work
- [ ] Set up log rotation
- [ ] Configure firewall rules

### Scaling
- Use Redis for session storage
- Implement database connection pooling
- Add load balancing
- Use CDN for static assets
- Implement caching strategies

## Support

For issues and questions:
1. Check the logs first
2. Review this documentation
3. Check GitHub issues
4. Contact support team

## License

MIT License - see LICENSE file for details
