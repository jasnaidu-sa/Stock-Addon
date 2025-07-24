import { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, File } from 'formidable';
import * as XLSX from 'xlsx';
import { supabaseAdmin } from '@/lib/supabase';
import { AllocationUploadRow, UploadResult } from '@/types/amendment-system';

// Disable body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

interface ParsedAllocationData {
  user_id: string;
  store_id: string;
  allocated_by?: string;
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
    const requiredColumns = ['Regional Manager Email', 'Store Code'];
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    
    if (missingColumns.length > 0) {
      return res.status(400).json({
        error: `Missing required columns: ${missingColumns.join(', ')}`
      });
    }

    // Get all users and stores for validation
    const [usersResult, storesResult] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select('id, email')
        .eq('role', 'regional_manager'),
      supabaseAdmin
        .from('stores')
        .select('id, store_code')
        .eq('active', true)
    ]);

    if (usersResult.error) {
      throw new Error(`Failed to fetch users: ${usersResult.error.message}`);
    }
    if (storesResult.error) {
      throw new Error(`Failed to fetch stores: ${storesResult.error.message}`);
    }

    const usersByEmail = new Map(usersResult.data?.map(u => [u.email.toLowerCase(), u.id]) || []);
    const storesByCode = new Map(storesResult.data?.map(s => [s.store_code, s.id]) || []);

    // Process each row
    const result: UploadResult = {
      success: true,
      totalRows: dataRows.length,
      successfulRows: 0,
      errorRows: 0,
      errors: []
    };

    const validAllocations: ParsedAllocationData[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNumber = i + 2; // Account for header row

      try {
        let regionalManagerEmail = '';
        let storeCode = '';

        // Map columns to data
        headers.forEach((header, index) => {
          const value = row[index]?.toString()?.trim() || '';
          
          switch (header) {
            case 'Regional Manager Email':
              regionalManagerEmail = value.toLowerCase();
              break;
            case 'Store Code':
              storeCode = value.toUpperCase();
              break;
          }
        });

        // Validate required fields
        if (!regionalManagerEmail) {
          throw new Error('Regional Manager Email is required');
        }
        if (!storeCode) {
          throw new Error('Store Code is required');
        }

        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regionalManagerEmail)) {
          throw new Error('Invalid email format');
        }

        // Check if user exists and is a regional manager
        const userId = usersByEmail.get(regionalManagerEmail);
        if (!userId) {
          throw new Error(`Regional manager not found with email: ${regionalManagerEmail}`);
        }

        // Check if store exists
        const storeId = storesByCode.get(storeCode);
        if (!storeId) {
          throw new Error(`Store not found with code: ${storeCode}`);
        }

        validAllocations.push({
          user_id: userId,
          store_id: storeId,
          allocated_by: null // Will be set to current admin user if available
        });
        
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

    // Insert valid allocations into database
    if (validAllocations.length > 0) {
      try {
        // First, get existing allocations to avoid duplicates
        const existingAllocations = await supabaseAdmin
          .from('regional_manager_store_allocations')
          .select('user_id, store_id')
          .eq('active', true);

        if (existingAllocations.error) {
          throw existingAllocations.error;
        }

        const existingSet = new Set(
          existingAllocations.data?.map(a => `${a.user_id}:${a.store_id}`) || []
        );

        // Filter out allocations that already exist
        const newAllocations = validAllocations.filter(allocation => 
          !existingSet.has(`${allocation.user_id}:${allocation.store_id}`)
        );

        const duplicateCount = validAllocations.length - newAllocations.length;

        // Insert new allocations
        if (newAllocations.length > 0) {
          const { error: insertError } = await supabaseAdmin
            .from('regional_manager_store_allocations')
            .insert(newAllocations.map(allocation => ({
              ...allocation,
              active: true,
              allocated_at: new Date().toISOString()
            })));

          if (insertError) {
            throw insertError;
          }
        }

        console.log(`Allocations upload completed: ${newAllocations.length} new, ${duplicateCount} duplicates skipped`);

        // Update result to reflect duplicates
        if (duplicateCount > 0) {
          result.errors.push({
            row: 0,
            error: `${duplicateCount} duplicate allocations were skipped (already exist)`,
            data: null
          });
        }

      } catch (dbError) {
        console.error('Database error:', dbError);
        return res.status(500).json({
          error: 'Database error occurred while saving allocations',
          details: dbError instanceof Error ? dbError.message : 'Unknown database error'
        });
      }
    }

    // Determine overall success
    result.success = result.errorRows === 0;

    return res.status(200).json(result);

  } catch (error) {
    console.error('Allocations upload error:', error);
    return res.status(500).json({
      error: 'Failed to process allocations upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}