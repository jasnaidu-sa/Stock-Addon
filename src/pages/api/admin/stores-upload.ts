import { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, File } from 'formidable';
import * as XLSX from 'xlsx';
import { supabaseAdmin } from '@/lib/supabase';
import { StoreUploadRow, UploadResult } from '@/types/amendment-system';

// Disable body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

interface ParsedStoreData {
  store_code: string;
  store_name: string;
  region?: string;
  address?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
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
    const requiredColumns = ['Store Code', 'Store Name'];
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

    const validStores: ParsedStoreData[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNumber = i + 2; // Account for header row

      try {
        // Create store object from row data
        const storeData: ParsedStoreData = {
          store_code: '',
          store_name: '',
        };

        // Map columns to data
        headers.forEach((header, index) => {
          const value = row[index]?.toString()?.trim() || '';
          
          switch (header) {
            case 'Store Code':
              storeData.store_code = value;
              break;
            case 'Store Name':
              storeData.store_name = value;
              break;
            case 'Region':
              storeData.region = value || null;
              break;
            case 'Address':
              storeData.address = value || null;
              break;
            case 'Contact Person':
              storeData.contact_person = value || null;
              break;
            case 'Phone':
              storeData.phone = value || null;
              break;
            case 'Email':
              storeData.email = value || null;
              break;
          }
        });

        // Validate required fields
        if (!storeData.store_code) {
          throw new Error('Store Code is required');
        }
        if (!storeData.store_name) {
          throw new Error('Store Name is required');
        }

        // Validate store code format (basic validation)
        if (!/^[A-Z0-9]{3,10}$/.test(storeData.store_code)) {
          throw new Error('Store Code must be 3-10 characters, alphanumeric');
        }

        // Validate email format if provided
        if (storeData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(storeData.email)) {
          throw new Error('Invalid email format');
        }

        validStores.push(storeData);
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

    // Insert valid stores into database
    if (validStores.length > 0) {
      try {
        // Check for existing store codes
        const existingCodes = await supabaseAdmin
          .from('stores')
          .select('store_code')
          .in('store_code', validStores.map(s => s.store_code));

        if (existingCodes.error) {
          throw existingCodes.error;
        }

        const existingCodesSet = new Set(existingCodes.data?.map(s => s.store_code) || []);
        
        // Separate new stores from updates
        const newStores = validStores.filter(s => !existingCodesSet.has(s.store_code));
        const updateStores = validStores.filter(s => existingCodesSet.has(s.store_code));

        // Insert new stores
        if (newStores.length > 0) {
          const { error: insertError } = await supabaseAdmin
            .from('stores')
            .insert(newStores);

          if (insertError) {
            throw insertError;
          }
        }

        // Update existing stores
        for (const store of updateStores) {
          const { error: updateError } = await supabaseAdmin
            .from('stores')
            .update({
              store_name: store.store_name,
              region: store.region,
              address: store.address,
              contact_person: store.contact_person,
              phone: store.phone,
              email: store.email,
              updated_at: new Date().toISOString()
            })
            .eq('store_code', store.store_code);

          if (updateError) {
            throw updateError;
          }
        }

        console.log(`Stores upload completed: ${newStores.length} new, ${updateStores.length} updated`);

      } catch (dbError) {
        console.error('Database error:', dbError);
        return res.status(500).json({
          error: 'Database error occurred while saving stores',
          details: dbError instanceof Error ? dbError.message : 'Unknown database error'
        });
      }
    }

    // Determine overall success
    result.success = result.errorRows === 0;

    return res.status(200).json(result);

  } catch (error) {
    console.error('Stores upload error:', error);
    return res.status(500).json({
      error: 'Failed to process stores upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}