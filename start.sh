#!/bin/bash

# Medical Inventory Management System - Startup Script

echo "🏥 Medical Inventory Management System"
echo "======================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi

echo "✅ npm version: $(npm -v)"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
    echo "✅ Dependencies installed successfully"
else
    echo "✅ Dependencies already installed"
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env file from template..."
    cp env.example .env
    echo "✅ .env file created. Please update it with your configuration."
    echo "📝 Edit .env file and then run this script again."
    exit 0
fi

echo "✅ Environment file found"

# Check database connection
echo "🔍 Checking database connection..."

# Start the application
echo "🚀 Starting Medical Inventory Management System..."
echo "📱 Application will be available at: http://localhost:3000"
echo "🔐 Default login: admin@medicalinventory.com / admin123"
echo ""
echo "Press Ctrl+C to stop the application"
echo ""

# Start the application
npm start
