import * as XLSX from 'xlsx';

/**
 * Template Generation Utility for Weekly Plans Amendment System
 * Generates Excel templates for master data uploads
 */

export interface TemplateConfig {
  filename: string;
  sheetName: string;
  headers: string[];
  sampleData: string[][];
  description?: string;
}

/**
 * Store Master Upload Template
 */
export const storesTemplate: TemplateConfig = {
  filename: 'stores_template.xlsx',
  sheetName: 'Stores Template',
  headers: [
    'Store Code',
    'Store Name', 
    'Region',
    'Address',
    'Contact Person',
    'Phone',
    'Email'
  ],
  sampleData: [
    ['BED001', 'Cape Town Main', 'Western Cape', '123 Main Road, Cape Town', 'John Smith', '021-123-4567', 'ct@bedshop.co.za'],
    ['BED002', 'Durban Central', 'KwaZulu-Natal', '456 Smith Street, Durban', 'Jane Doe', '031-987-6543', 'durban@bedshop.co.za'],
    ['BED003', 'Johannesburg North', 'Gauteng', '789 North Street, Johannesburg', 'Mike Johnson', '011-555-1234', 'jhb@bedshop.co.za'],
    ['BED004', 'Pretoria East', 'Gauteng', '321 East Avenue, Pretoria', 'Sarah Wilson', '012-444-5678', 'pta@bedshop.co.za'],
    ['BED005', 'Port Elizabeth Central', 'Eastern Cape', '654 Central Road, Port Elizabeth', 'Dave Brown', '041-777-9999', 'pe@bedshop.co.za'],
  ],
  description: 'Store Master Data Template - Upload your store information including codes, names, regions, and contact details.'
};

/**
 * Category Master Upload Template
 */
export const categoriesTemplate: TemplateConfig = {
  filename: 'categories_template.xlsx',
  sheetName: 'Categories Template',
  headers: [
    'Category Code',
    'Category Name',
    'Description',
    'Sort Order'
  ],
  sampleData: [
    ['MATT', 'Mattresses', 'All mattress products and related items', '1'],
    ['FURN', 'Furniture', 'Bedroom furniture including headboards and bases', '2'],
    ['ACC', 'Accessories', 'Pillows, sheets, and bedroom accessories', '3'],
    ['FOAM', 'Foam Products', 'Foam mattresses and mattress toppers', '4'],
    ['ELECT', 'Electric Beds', 'Electric adjustable bed bases and frames', '5'],
  ],
  description: 'Product Categories Template - Define the categories used for organizing products in the amendment system.'
};

/**
 * Regional Manager Store Allocations Template
 */
export const allocationsTemplate: TemplateConfig = {
  filename: 'allocations_template.xlsx',
  sheetName: 'Allocations Template',
  headers: [
    'Regional Manager Email',
    'Store Code'
  ],
  sampleData: [
    ['jsmith@thebedshop.co.za', 'BED001'],
    ['jsmith@thebedshop.co.za', 'BED002'],
    ['mdoe@thebedshop.co.za', 'BED003'],
    ['mdoe@thebedshop.co.za', 'BED004'],
    ['pjones@thebedshop.co.za', 'BED005'],
    ['jsmith@thebedshop.co.za', 'BED006'],
    ['mdoe@thebedshop.co.za', 'BED007'],
  ],
  description: 'Store Allocations Template - Assign stores to regional managers for the amendment system.'
};

/**
 * Generate and download Excel template
 */
export const generateTemplate = (config: TemplateConfig): void => {
  try {
    // Create template data with headers and sample data
    const templateData = [
      config.headers,
      ...config.sampleData
    ];

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(templateData);

    // Set column widths for better readability
    const colWidths = config.headers.map(header => {
      const maxLength = Math.max(
        header.length,
        ...config.sampleData.map(row => {
          const cellIndex = config.headers.indexOf(header);
          return row[cellIndex]?.toString().length || 0;
        })
      );
      return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
    });
    worksheet['!cols'] = colWidths;

    // Create workbook and add worksheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, config.sheetName);

    // Add metadata
    workbook.Props = {
      Title: config.sheetName,
      Subject: config.description || 'Template for data upload',
      Author: 'The Bed Shop - Weekly Plans Amendment System',
      CreatedDate: new Date()
    };

    // Download file
    XLSX.writeFile(workbook, config.filename);

  } catch (error) {
    console.error('Error generating template:', error);
    throw new Error(`Failed to generate template: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Generate all templates at once
 */
export const generateAllTemplates = (): void => {
  const templates = [storesTemplate, categoriesTemplate, allocationsTemplate];
  
  templates.forEach(template => {
    try {
      generateTemplate(template);
    } catch (error) {
      console.error(`Failed to generate ${template.filename}:`, error);
    }
  });
};

/**
 * Template validation rules
 */
export const templateValidationRules = {
  stores: {
    required: ['Store Code', 'Store Name'],
    optional: ['Region', 'Address', 'Contact Person', 'Phone', 'Email'],
    validation: {
      'Store Code': {
        pattern: /^[A-Z0-9]{3,10}$/,
        message: 'Store Code must be 3-10 characters, alphanumeric uppercase'
      },
      'Email': {
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        message: 'Invalid email format'
      }
    }
  },
  categories: {
    required: ['Category Code', 'Category Name'],
    optional: ['Description', 'Sort Order'],
    validation: {
      'Category Code': {
        pattern: /^[A-Z0-9]{2,10}$/,
        message: 'Category Code must be 2-10 characters, alphanumeric uppercase'
      },
      'Sort Order': {
        pattern: /^\d+$/,
        message: 'Sort Order must be a number between 1 and 999'
      }
    }
  },
  allocations: {
    required: ['Regional Manager Email', 'Store Code'],
    optional: [],
    validation: {
      'Regional Manager Email': {
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        message: 'Invalid email format'
      },
      'Store Code': {
        pattern: /^[A-Z0-9]{3,10}$/,
        message: 'Store Code must match existing store codes'
      }
    }
  }
};

/**
 * Get template by type
 */
export const getTemplate = (type: 'stores' | 'categories' | 'allocations'): TemplateConfig => {
  switch (type) {
    case 'stores':
      return storesTemplate;
    case 'categories':
      return categoriesTemplate;
    case 'allocations':
      return allocationsTemplate;
    default:
      throw new Error(`Unknown template type: ${type}`);
  }
};

/**
 * Download template by type
 */
export const downloadTemplate = (type: 'stores' | 'categories' | 'allocations'): void => {
  const template = getTemplate(type);
  generateTemplate(template);
};