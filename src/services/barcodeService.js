const axios = require('axios');
const logger = require('../utils/logger');

class BarcodeService {
  constructor() {
    // Pharmaceutical and medical product APIs
    this.apis = {
      // Open Food Facts API (also covers some pharmaceutical products)
      openFoodFacts: 'https://world.openfoodfacts.org/api/v0/product',
      // UPC Database (requires API key)
      upcDatabase: 'https://api.upcitemdb.com/prod/trial/lookup',
      // Barcode Lookup (requires API key)
      barcodeLookup: 'https://api.barcodelookup.com/v2/products',
      // Pharmaceutical-specific APIs (if available)
      pharmaLookup: 'https://api.pharmaceuticals.com/lookup', // Placeholder
      // Medicine database APIs
      medicineDB: 'https://api.medicines.org.uk/lookup' // Placeholder
    };
    
    // Pharmaceutical barcode prefixes for different countries/regions
    this.pharmaPrefixes = {
      // India - Pharmaceutical products
      '890': 'India - Pharmaceutical',
      '8901': 'India - Medicine',
      '8902': 'India - Medical Device',
      // USA - Pharmaceutical
      '036': 'USA - Pharmaceutical',
      '037': 'USA - Medicine',
      // Europe - Pharmaceutical
      '300': 'France - Pharmaceutical',
      '400': 'Germany - Pharmaceutical',
      '500': 'UK - Pharmaceutical',
      // Generic pharmaceutical prefixes
      '690': 'China - Pharmaceutical',
      '691': 'China - Medicine'
    };
    
    // Common pharmaceutical product categories
    this.pharmaCategories = [
      'Tablets', 'Capsules', 'Syrup', 'Injection', 'Ointment', 'Cream',
      'Drops', 'Powder', 'Suspension', 'Gel', 'Lotion', 'Spray',
      'Patch', 'Suppository', 'Inhaler', 'Medical Device', 'Surgical',
      'Diagnostic', 'Therapeutic', 'Prescription', 'OTC', 'Generic'
    ];
  }

  async lookupProduct(barcode) {
    try {
      logger.info(`Looking up pharmaceutical product with barcode: ${barcode}`);

      // Check if this is a pharmaceutical barcode
      const pharmaInfo = this.identifyPharmaceuticalBarcode(barcode);
      if (pharmaInfo) {
        logger.info(`Pharmaceutical barcode detected: ${pharmaInfo.region} - ${pharmaInfo.type}`);
      }

      // Try pharmaceutical-specific lookups first
      const results = await Promise.allSettled([
        this.lookupFromPharmaceuticalDB(barcode),
        this.lookupFromMedicineDB(barcode),
        this.lookupFromOpenFoodFacts(barcode),
        this.lookupFromUPCDatabase(barcode),
        this.lookupFromBarcodeLookup(barcode)
      ]);

      // Find the first successful result
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          logger.info(`Product found for barcode: ${barcode}`);
          return this.enhancePharmaceuticalData(result.value, pharmaInfo);
        }
      }

      // If no external data found, create a pharmaceutical product template
      logger.warn(`No product information found for barcode: ${barcode}`);
      return this.createPharmaceuticalTemplate(barcode, pharmaInfo);
    } catch (error) {
      logger.error(`Error looking up barcode ${barcode}:`, error);
      return null;
    }
  }

  async lookupFromOpenFoodFacts(barcode) {
    try {
      const response = await axios.get(`${this.apis.openFoodFacts}/${barcode}.json`, {
        timeout: 5000
      });

      if (response.data.status === 1 && response.data.product) {
        const product = response.data.product;
        return {
          name: product.product_name || product.product_name_en || 'Unknown Product',
          description: product.generic_name || product.generic_name_en || '',
          manufacturer: product.brands || '',
          category: product.categories || '',
          image: product.image_url || '',
          ingredients: product.ingredients_text || '',
          nutrition: product.nutrition_grades || '',
          source: 'Open Food Facts'
        };
      }
      return null;
    } catch (error) {
      logger.debug(`Open Food Facts lookup failed for ${barcode}:`, error.message);
      return null;
    }
  }

  async lookupFromUPCDatabase(barcode) {
    try {
      // This requires an API key
      const apiKey = process.env.UPC_DATABASE_API_KEY;
      if (!apiKey) {
        return null;
      }

      const response = await axios.get(`${this.apis.upcDatabase}`, {
        params: {
          upc: barcode
        },
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 5000
      });

      if (response.data.items && response.data.items.length > 0) {
        const item = response.data.items[0];
        return {
          name: item.title || 'Unknown Product',
          description: item.description || '',
          manufacturer: item.brand || '',
          category: item.category || '',
          image: item.images && item.images.length > 0 ? item.images[0] : '',
          source: 'UPC Database'
        };
      }
      return null;
    } catch (error) {
      logger.debug(`UPC Database lookup failed for ${barcode}:`, error.message);
      return null;
    }
  }

  async lookupFromBarcodeLookup(barcode) {
    try {
      // This requires an API key
      const apiKey = process.env.BARCODE_LOOKUP_API_KEY;
      if (!apiKey) {
        return null;
      }

      const response = await axios.get(`${this.apis.barcodeLookup}`, {
        params: {
          barcode: barcode,
          key: apiKey
        },
        timeout: 5000
      });

      if (response.data.products && response.data.products.length > 0) {
        const product = response.data.products[0];
        return {
          name: product.title || 'Unknown Product',
          description: product.description || '',
          manufacturer: product.brand || '',
          category: product.category || '',
          image: product.images && product.images.length > 0 ? product.images[0] : '',
          source: 'Barcode Lookup'
        };
      }
      return null;
    } catch (error) {
      logger.debug(`Barcode Lookup failed for ${barcode}:`, error.message);
      return null;
    }
  }

  // ==================== PHARMACEUTICAL-SPECIFIC METHODS ====================

  async lookupFromPharmaceuticalDB(barcode) {
    try {
      // Placeholder for pharmaceutical database lookup
      // In a real implementation, you would integrate with:
      // - FDA database
      // - WHO Essential Medicines List
      // - National pharmaceutical databases
      // - Drug information services
      
      logger.debug(`Pharmaceutical DB lookup not implemented for ${barcode}`);
      return null;
    } catch (error) {
      logger.debug(`Pharmaceutical DB lookup failed for ${barcode}:`, error.message);
      return null;
    }
  }

  async lookupFromMedicineDB(barcode) {
    try {
      // Placeholder for medicine database lookup
      // In a real implementation, you would integrate with:
      // - Medicine databases
      // - Drug interaction databases
      // - Prescription databases
      
      logger.debug(`Medicine DB lookup not implemented for ${barcode}`);
      return null;
    } catch (error) {
      logger.debug(`Medicine DB lookup failed for ${barcode}:`, error.message);
      return null;
    }
  }

  identifyPharmaceuticalBarcode(barcode) {
    // Clean the barcode
    const cleanBarcode = barcode.replace(/\D/g, '');
    
    // Check for pharmaceutical prefixes
    for (const [prefix, info] of Object.entries(this.pharmaPrefixes)) {
      if (cleanBarcode.startsWith(prefix)) {
        return {
          region: info.split(' - ')[0],
          type: info.split(' - ')[1],
          prefix: prefix,
          isPharmaceutical: true
        };
      }
    }
    
    // Check for common pharmaceutical patterns
    if (cleanBarcode.length === 13) {
      // EAN-13 pharmaceutical patterns
      const countryCode = cleanBarcode.substring(0, 3);
      if (['890', '036', '037', '300', '400', '500'].includes(countryCode)) {
        return {
          region: this.getRegionFromCountryCode(countryCode),
          type: 'Pharmaceutical',
          prefix: countryCode,
          isPharmaceutical: true
        };
      }
    }
    
    return {
      region: 'Unknown',
      type: 'Unknown',
      prefix: null,
      isPharmaceutical: false
    };
  }

  getRegionFromCountryCode(countryCode) {
    const regions = {
      '890': 'India',
      '036': 'USA',
      '037': 'USA',
      '300': 'France',
      '400': 'Germany',
      '500': 'UK',
      '690': 'China',
      '691': 'China'
    };
    return regions[countryCode] || 'Unknown';
  }

  enhancePharmaceuticalData(product, pharmaInfo) {
    // Enhance product data with pharmaceutical-specific information
    return {
      ...product,
      barcode: product.barcode || '',
      // Pharmaceutical-specific fields
      pharmaceuticalInfo: pharmaInfo,
      isPharmaceutical: pharmaInfo.isPharmaceutical,
      region: pharmaInfo.region,
      productType: pharmaInfo.type,
      // Enhanced categorization
      category: this.categorizePharmaceuticalProduct(product.name, product.description),
      // Additional pharmaceutical fields
      requiresPrescription: this.requiresPrescription(product.name, product.description),
      storageConditions: this.getStorageConditions(product.category),
      expiryDateRequired: true,
      batchNumberRequired: true,
      // Enhanced description
      description: this.enhanceDescription(product.description, pharmaInfo)
    };
  }

  createPharmaceuticalTemplate(barcode, pharmaInfo) {
    // Create a template for pharmaceutical products when no external data is found
    return {
      barcode: barcode,
      name: `Medicine - ${barcode}`,
      description: `Pharmaceutical product with barcode ${barcode}`,
      manufacturer: 'Unknown Manufacturer',
      category: this.categorizePharmaceuticalProduct('Medicine', ''),
      pharmaceuticalInfo: pharmaInfo,
      isPharmaceutical: true,
      region: pharmaInfo.region,
      productType: pharmaInfo.type,
      requiresPrescription: false, // Default to OTC
      storageConditions: 'Store in cool, dry place',
      expiryDateRequired: true,
      batchNumberRequired: true,
      price: 0,
      minQuantity: 1,
      availableQuantity: 0,
      source: 'Pharmaceutical Template'
    };
  }

  categorizePharmaceuticalProduct(name, description) {
    const text = (name + ' ' + description).toLowerCase();
    
    // Check for specific pharmaceutical categories
    for (const category of this.pharmaCategories) {
      if (text.includes(category.toLowerCase())) {
        return category;
      }
    }
    
    // Default pharmaceutical categories based on common terms
    if (text.includes('tablet') || text.includes('tab')) return 'Tablets';
    if (text.includes('capsule') || text.includes('cap')) return 'Capsules';
    if (text.includes('syrup') || text.includes('liquid')) return 'Syrup';
    if (text.includes('injection') || text.includes('inject')) return 'Injection';
    if (text.includes('ointment') || text.includes('cream')) return 'Ointment';
    if (text.includes('drops') || text.includes('eye drops')) return 'Drops';
    if (text.includes('powder')) return 'Powder';
    if (text.includes('suspension')) return 'Suspension';
    if (text.includes('gel')) return 'Gel';
    if (text.includes('lotion')) return 'Lotion';
    if (text.includes('spray')) return 'Spray';
    if (text.includes('patch')) return 'Patch';
    if (text.includes('suppository')) return 'Suppository';
    if (text.includes('inhaler')) return 'Inhaler';
    
    return 'Pharmaceutical';
  }

  requiresPrescription(name, description) {
    const text = (name + ' ' + description).toLowerCase();
    
    // Common prescription-only indicators
    const prescriptionIndicators = [
      'prescription', 'rx', 'prescribed', 'controlled', 'schedule',
      'narcotic', 'opioid', 'antibiotic', 'steroid', 'hormone',
      'chemotherapy', 'immunosuppressant', 'anticoagulant'
    ];
    
    return prescriptionIndicators.some(indicator => text.includes(indicator));
  }

  getStorageConditions(category) {
    const storageConditions = {
      'Tablets': 'Store in cool, dry place below 25°C',
      'Capsules': 'Store in cool, dry place below 25°C',
      'Syrup': 'Store in refrigerator (2-8°C)',
      'Injection': 'Store in refrigerator (2-8°C)',
      'Ointment': 'Store in cool, dry place below 25°C',
      'Cream': 'Store in cool, dry place below 25°C',
      'Drops': 'Store in refrigerator (2-8°C)',
      'Powder': 'Store in cool, dry place below 25°C',
      'Suspension': 'Store in refrigerator (2-8°C)',
      'Gel': 'Store in cool, dry place below 25°C',
      'Lotion': 'Store in cool, dry place below 25°C',
      'Spray': 'Store in cool, dry place below 25°C',
      'Patch': 'Store in cool, dry place below 25°C',
      'Suppository': 'Store in refrigerator (2-8°C)',
      'Inhaler': 'Store in cool, dry place below 25°C'
    };
    
    return storageConditions[category] || 'Store in cool, dry place below 25°C';
  }

  enhanceDescription(description, pharmaInfo) {
    let enhanced = description || '';
    
    if (pharmaInfo.isPharmaceutical) {
      enhanced += ` (${pharmaInfo.region} Pharmaceutical Product)`;
    }
    
    return enhanced;
  }

  validateBarcode(barcode) {
    // Enhanced pharmaceutical barcode validation
    if (!barcode || typeof barcode !== 'string') {
      return false;
    }

    // Remove any non-digit characters
    const cleanBarcode = barcode.replace(/\D/g, '');
    
    // Check length (pharmaceutical barcode lengths)
    const validLengths = [8, 12, 13, 14, 15]; // Added 15 for some pharmaceutical codes
    if (!validLengths.includes(cleanBarcode.length)) {
      return false;
    }

    // Check if it's all zeros (invalid)
    if (cleanBarcode === '0'.repeat(cleanBarcode.length)) {
      return false;
    }

    // Additional pharmaceutical-specific validation
    if (cleanBarcode.length === 13) {
      // EAN-13 validation for pharmaceutical products
      return this.validateEAN13(cleanBarcode);
    } else if (cleanBarcode.length === 12) {
      // UPC-A validation for pharmaceutical products
      return this.validateUPCA(cleanBarcode);
    }

    return true;
  }

  validateEAN13(barcode) {
    // EAN-13 check digit validation
    if (barcode.length !== 13) return false;
    
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(barcode[i]);
      sum += (i % 2 === 0) ? digit : digit * 3;
    }
    
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(barcode[12]);
  }

  validateUPCA(barcode) {
    // UPC-A check digit validation
    if (barcode.length !== 12) return false;
    
    let sum = 0;
    for (let i = 0; i < 11; i++) {
      const digit = parseInt(barcode[i]);
      sum += (i % 2 === 0) ? digit * 3 : digit;
    }
    
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(barcode[11]);
  }

  generateBarcode() {
    // Generate a random barcode for testing purposes
    const length = 13; // EAN-13 format
    let barcode = '';
    
    // First digit (country code)
    barcode += Math.floor(Math.random() * 9) + 1;
    
    // Remaining digits
    for (let i = 1; i < length - 1; i++) {
      barcode += Math.floor(Math.random() * 10);
    }
    
    // Calculate check digit (simplified)
    const checkDigit = Math.floor(Math.random() * 10);
    barcode += checkDigit;
    
    return barcode;
  }

  async scanBarcodeFromImage(imageBuffer) {
    try {
      // This would integrate with a barcode scanning library
      // For now, we'll return a placeholder
      logger.info('Barcode scanning from image not implemented yet');
      
      // You could integrate with libraries like:
      // - quagga2 (JavaScript barcode scanner)
      // - zxing (Java library with JS wrapper)
      // - OpenCV with barcode detection
      
      return null;
    } catch (error) {
      logger.error('Error scanning barcode from image:', error);
      return null;
    }
  }

  getSupportedFormats() {
    return [
      { 
        format: 'EAN-13', 
        length: 13, 
        description: 'European Article Number',
        pharmaceutical: true,
        commonIn: ['India (890)', 'Europe (300-500)', 'USA (036-037)']
      },
      { 
        format: 'EAN-8', 
        length: 8, 
        description: 'European Article Number',
        pharmaceutical: true,
        commonIn: ['Europe', 'Small packages']
      },
      { 
        format: 'UPC-A', 
        length: 12, 
        description: 'Universal Product Code',
        pharmaceutical: true,
        commonIn: ['USA', 'Canada']
      },
      { 
        format: 'UPC-E', 
        length: 8, 
        description: 'Universal Product Code',
        pharmaceutical: true,
        commonIn: ['USA', 'Small packages']
      },
      { 
        format: 'Code-128', 
        length: 'variable', 
        description: 'Code 128',
        pharmaceutical: true,
        commonIn: ['Medical devices', 'Batch tracking']
      },
      { 
        format: 'Code-39', 
        length: 'variable', 
        description: 'Code 39',
        pharmaceutical: true,
        commonIn: ['Medical devices', 'Internal tracking']
      },
      { 
        format: 'Data Matrix', 
        length: 'variable', 
        description: '2D Barcode',
        pharmaceutical: true,
        commonIn: ['Medical devices', 'Small packages']
      },
      { 
        format: 'QR Code', 
        length: 'variable', 
        description: '2D Barcode',
        pharmaceutical: true,
        commonIn: ['Mobile apps', 'Patient information']
      }
    ];
  }

  getPharmaceuticalPrefixes() {
    return this.pharmaPrefixes;
  }

  getPharmaceuticalCategories() {
    return this.pharmaCategories;
  }
}

module.exports = new BarcodeService();
