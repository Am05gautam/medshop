# Gautam Medicals - Inventory Management System

A comprehensive medical inventory management system built with Node.js, featuring barcode scanning, invoice generation, and automated alerts.

## Features

- 📦 **Product Management**: Add products with barcode scanning and auto-fill
- 🧾 **Invoice Generation**: Create and print invoices with customer details
- 📊 **Inventory Tracking**: Real-time quantity management and deduction
- ⚠️ **Smart Alerts**: Automated OOS and expiry notifications via WhatsApp
- 🔍 **Barcode Integration**: Support for multiple barcode formats
- 📱 **Responsive UI**: Modern web interface for all operations
- 🐳 **Docker Ready**: Containerized deployment for easy setup

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL (with SQLite for development)
- **ORM**: Sequelize
- **Authentication**: JWT
- **Scheduling**: node-cron
- **PDF Generation**: PDFKit
- **Barcode**: Web-based camera scanning
- **Notifications**: WhatsApp API integration

## Quick Start

### Prerequisites
- Node.js 16+
- PostgreSQL (or SQLite for development)
- Docker (optional)

### Installation

1. Clone the repository
```bash
git clone <your-repo-url>
cd medical-inventory-management
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database
```bash
npm run db:migrate
npm run db:seed
```

5. Start the application
```bash
# Development
npm run dev

# Production
npm start

# Docker
npm run docker:build
npm run docker:run
```

## Environment Variables

```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=medical_inventory
DB_USER=your_username
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
WHATSAPP_API_URL=your_whatsapp_api_url
WHATSAPP_TOKEN=your_whatsapp_token
```

## API Endpoints

### Products
- `GET /api/products` - List all products
- `POST /api/products` - Add new product
- `GET /api/products/:id` - Get product by ID
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `POST /api/products/scan` - Scan barcode and fetch product info

### Invoices
- `GET /api/invoices` - List all invoices
- `POST /api/invoices` - Create new invoice
- `GET /api/invoices/:id` - Get invoice by ID
- `GET /api/invoices/:id/pdf` - Download invoice PDF

### Alerts
- `GET /api/alerts` - Get alert settings
- `POST /api/alerts/test` - Test alert system
- `PUT /api/alerts/settings` - Update alert settings

## Project Structure

```
medical-inventory-management/
├── src/
│   ├── controllers/     # Route controllers
│   ├── models/         # Database models
│   ├── routes/         # API routes
│   ├── middleware/     # Custom middleware
│   ├── services/       # Business logic
│   ├── utils/          # Utility functions
│   └── config/         # Configuration files
├── public/             # Static files
├── uploads/            # File uploads
├── tests/              # Test files
├── docker/             # Docker configuration
└── docs/               # Documentation
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details
