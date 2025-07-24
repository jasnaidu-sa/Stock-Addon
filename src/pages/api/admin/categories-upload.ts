import { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, File } from 'formidable';
import * as XLSX from 'xlsx';
import { supabaseAdmin } from '@/lib/supabase';
import { CategoryUploadRow, UploadResult } from '@/types/amendment-system';

// Disable body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

interface ParsedCategoryData {
  category_code: string;
  category_name: string;
  description?: string;
  sort_order?: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse the uploaded file
    const form = new IncomingForm();
    const { files } = await new Promise<{ files: any }>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ files });
      });
    });

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Read and parse Excel file
    const workbook = XLSX.readFile(file.filepath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });

    if (rawData.length < 2) {
      return res.status(400).json({ 
        error: 'Excel file must contain at least a header row and one data row' 
      });
    }

    // Parse headers and data
    const headers = rawData[0] as string[];
    const dataRows = rawData.slice(1);

    // Validate required columns
    const requiredColumns = ['Category Code', 'Category Name'];
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    
    if (missingColumns.length > 0) {
      return res.status(400).json({
        error: `Missing required columns: ${missingColumns.join(', ')}`
      });
    }

    // Process each row
    const result: UploadResult = {
      success: true,
      totalRows: dataRows.length,
      successfulRows: 0,
      errorRows: 0,
      errors: []
    };

    const validCategories: ParsedCategoryData[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNumber = i + 2; // Account for header row

      try {
        // Create category object from row data
        const categoryData: ParsedCategoryData = {
          category_code: '',
          category_name: '',
        };

        // Map columns to data
        headers.forEach((header, index) => {
          const value = row[index]?.toString()?.trim() || '';
          
          switch (header) {
            case 'Category Code':
              categoryData.category_code = value;
              break;
            case 'Category Name':
              categoryData.category_name = value;
              break;
            case 'Description':
              categoryData.description = value || null;
              break;
            case 'Sort Order':
              const sortOrder = parseInt(value);
              categoryData.sort_order = isNaN(sortOrder) ? null : sortOrder;
              break;
          }
        });

        // Validate required fields
        if (!categoryData.category_code) {
          throw new Error('Category Code is required');
        }
        if (!categoryData.category_name) {
          throw new Error('Category Name is required');
        }

        // Validate category code format (basic validation)
        if (!/^[A-Z0-9]{2,10}$/.test(categoryData.category_code)) {
          throw new Error('Category Code must be 2-10 characters, alphanumeric uppercase');
        }

        // Validate sort order if provided
        if (categoryData.sort_order !== null && categoryData.sort_order !== undefined) {
          if (categoryData.sort_order < 1 || categoryData.sort_order > 999) {
            throw new Error('Sort Order must be between 1 and 999');
          }
        }

        validCategories.push(categoryData);
        result.successfulRows++;

      } catch (error) {
        result.errorRows++;
        result.errors.push({
          row: rowNumber,
          error: error instanceof Error ? error.message : 'Unknown error',
          data: row
        });
      }
    }

    // Insert valid categories into database
    if (validCategories.length > 0) {
      try {
        // Check for existing category codes
        const existingCodes = await supabaseAdmin
          .from('categories')
          .select('category_code')
          .in('category_code', validCategories.map(c => c.category_code));

        if (existingCodes.error) {
          throw existingCodes.error;
        }

        const existingCodesSet = new Set(existingCodes.data?.map(c => c.category_code) || []);
        
        // Separate new categories from updates
        const newCategories = validCategories.filter(c => !existingCodesSet.has(c.category_code));
        const updateCategories = validCategories.filter(c => existingCodesSet.has(c.category_code));

        // Insert new categories
        if (newCategories.length > 0) {
          const { error: insertError } = await supabaseAdmin
            .from('categories')
            .insert(newCategories.map(cat => ({
              ...cat,
              active: true,
              created_at: new Date().toISOString()
            })));

          if (insertError) {
            throw insertError;
          }
        }

        // Update existing categories
        for (const category of updateCategories) {
          const updateData: any = {
            category_name: category.category_name,
            description: category.description,
          };

          // Only update sort_order if it was provided
          if (category.sort_order !== null && category.sort_order !== undefined) {
            updateData.sort_order = category.sort_order;
          }

          const { error: updateError } = await supabaseAdmin
            .from('categories')
            .update(updateData)
            .eq('category_code', category.category_code);

          if (updateError) {
            throw updateError;
          }
        }

        console.log(`Categories upload completed: ${newCategories.length} new, ${updateCategories.length} updated`);

      } catch (dbError) {
        console.error('Database error:', dbError);
        return res.status(500).json({
          error: 'Database error occurred while saving categories',
          details: dbError instanceof Error ? dbError.message : 'Unknown database error'
        });
      }
    }

    // Determine overall success
    result.success = result.errorRows === 0;

    return res.status(200).json(result);

  } catch (error) {
    console.error('Categories upload error:', error);
    return res.status(500).json({
      error: 'Failed to process categories upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}