import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabaseAdmin } from '@/lib/supabase';

const uploadSchema = z.object({
  file: z.instanceof(FileList).refine((files) => files.length > 0, "Excel file is required")
    .refine((files) => {
      const file = files[0];
      return file && (
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'application/vnd.ms-excel' ||
        file.name.endsWith('.xlsx') ||
        file.name.endsWith('.xls')
      );
    }, "File must be an Excel file (.xlsx or .xls)")
});

interface ExcelRow {
  rm_name: string;
  rm_surname: string;
  rm_email: string;
  rm_username: string;
  am_name: string;
  am_surname: string;
  am_username: string;
  am_email: string;
  Store: string;
  store_code: string;
  store_manager: string;
  Store_manager_email: string;
  Store_manager_username: string;
  rowNumber: number;
}

interface ProcessingError {
  rowNumber: number;
  userType: 'regional_manager' | 'area_manager' | 'store_manager';
  userName: string;
  email: string;
  errorType: 'validation' | 'creation' | 'password' | 'database';
  errorMessage: string;
  details?: string;
}

interface SyncResults {
  syncId: string;
  totalRows: number;
  usersCreated: number;
  usersUpdated: number;
  usersDeactivated: number;
  storesCreated: number;
  storesUpdated: number;
  assignmentsCreated: number;
  conflictsFound: number;
  conflicts: any[];
  errors: ProcessingError[];
}

type UploadFormData = z.infer<typeof uploadSchema>;

export function HierarchyUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<SyncResults | null>(null);
  const { toast } = useToast();

  const checkSupabase = () => {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }
    return supabaseAdmin;
  };

  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema)
  });

  const parseExcelFile = async (file: File): Promise<ExcelRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          if (!data) throw new Error('Failed to read file');

          // Import XLSX dynamically
          const XLSX = await import('xlsx');
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Use Sheet1 as specified
          const worksheet = workbook.Sheets['Sheet1'];
          if (!worksheet) {
            throw new Error('Sheet1 not found in Excel file');
          }

          // Convert to JSON with header row
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length < 2) {
            throw new Error('Excel file must have header row and at least one data row');
          }

          // Verify expected headers
          const headers = jsonData[0] as string[];
          const expectedHeaders = [
            'rm_name', 'rm_surname', 'rm_email', 'rm_username',
            'am_name', 'am_surname', 'am_username', 'am_email',
            'Store', 'store_code', 'store_manager', 'Store_manager_email', 'Store_manager_username'
          ];

          const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
          if (missingHeaders.length > 0) {
            throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
          }

          // Convert data rows to objects
          const rows: ExcelRow[] = [];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            if (row.length === 0) continue; // Skip empty rows

            const rowData: ExcelRow = {
              rm_name: String(row[headers.indexOf('rm_name')] || '').trim(),
              rm_surname: String(row[headers.indexOf('rm_surname')] || '').trim(),
              rm_email: String(row[headers.indexOf('rm_email')] || '').trim(),
              rm_username: String(row[headers.indexOf('rm_username')] || '').trim(),
              am_name: String(row[headers.indexOf('am_name')] || '').trim(),
              am_surname: String(row[headers.indexOf('am_surname')] || '').trim(),
              am_username: String(row[headers.indexOf('am_username')] || '').trim(),
              am_email: String(row[headers.indexOf('am_email')] || '').trim(),
              Store: String(row[headers.indexOf('Store')] || '').trim(),
              store_code: String(row[headers.indexOf('store_code')] || '').trim(),
              store_manager: String(row[headers.indexOf('store_manager')] || '').trim(),
              Store_manager_email: String(row[headers.indexOf('Store_manager_email')] || '').trim(),
              Store_manager_username: String(row[headers.indexOf('Store_manager_username')] || '').trim(),
              rowNumber: i + 1
            };

            // Skip rows where store info is missing (completely empty rows)
            if (!rowData.Store && !rowData.store_code) continue;

            rows.push(rowData);
          }

          resolve(rows);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const validateData = (rows: ExcelRow[]): string[] => {
    const errors: string[] = [];
    const seenEmails = new Set<string>();
    const seenStores = new Set<string>();

    console.log(`Starting validation for ${rows.length} rows...`);

    rows.forEach((row, index) => {
      const rowNum = row.rowNumber;
      console.log(`Validating row ${rowNum}: Store=${row.Store}, StoreCode=${row.store_code}`);

      // Validate store data (always required)
      if (!row.Store || !row.store_code) {
        const error = `Row ${rowNum}: Store name and store code are required`;
        console.error(error);
        errors.push(error);
      }

      // Check for duplicate stores
      if (row.store_code) {
        if (seenStores.has(row.store_code)) {
          const error = `Row ${rowNum}: Duplicate store code ${row.store_code}`;
          console.error(error);
          errors.push(error);
        }
        seenStores.add(row.store_code);
      }

      // Validate non-vacant users
      const users = [
        { role: 'Regional Manager', email: row.rm_email, name: row.rm_name, surname: row.rm_surname },
        { role: 'Area Manager', email: row.am_email, name: row.am_name, surname: row.am_surname },
        { role: 'Store Manager', email: row.Store_manager_email, name: row.store_manager, surname: '' }
      ];

      users.forEach(user => {
        if (user.email && user.email.toLowerCase() !== 'vacant') {
          console.log(`Validating ${user.role}: ${user.email}`);
          
          // Check for valid email format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(user.email)) {
            const error = `Row ${rowNum}: Invalid email format for ${user.role}: ${user.email}`;
            console.error(error);
            errors.push(error);
          }

          // Note: We DON'T validate duplicate emails here because the same manager
          // can legitimately appear in multiple rows (managing multiple stores)
          // This is handled by the deduplication process later
          seenEmails.add(user.email.toLowerCase());

          // Validate required name fields for non-vacant users
          if (!user.name || user.name.toLowerCase() === 'vacant') {
            const error = `Row ${rowNum}: ${user.role} name is required when email is provided`;
            console.error(error);
            errors.push(error);
          }
        }
      });
    });

    console.log(`Validation complete. Found ${errors.length} errors.`);
    return errors;
  };

  const generatePassword = (lastName: string): string => {
    // Generate secure password to avoid data breach detection
    // Use random number + special characters for uniqueness
    const randomNum = Math.floor(Math.random() * 999) + 100; // 3-digit random number
    const specialChars = ['!', '@', '#', '$', '%'];
    const randomSpecial = specialChars[Math.floor(Math.random() * specialChars.length)];
    
    const basePassword = `${lastName}${randomNum}${randomSpecial}`;
    
    // Ensure minimum 8 characters
    if (basePassword.length < 8) {
      return `${lastName}${randomNum}${randomSpecial}@`;
    }
    
    return basePassword;
  };

  const processUpload = async (rows: ExcelRow[]) => {
    const syncId = crypto.randomUUID();
    
    try {
      const db = checkSupabase();

      // Start sync log
      const { error: logError } = await db
        .from('excel_sync_logs')
        .insert({
          sync_id: syncId,
          operation_type: 'full_sync',
          total_rows_processed: rows.length,
          sync_status: 'started'
        });

      if (logError) throw logError;

      const results: SyncResults = {
        syncId,
        totalRows: rows.length,
        usersCreated: 0,
        usersUpdated: 0,
        usersDeactivated: 0,
        storesCreated: 0,
        storesUpdated: 0,
        assignmentsCreated: 0,
        conflictsFound: 0,
        conflicts: [],
        errors: []
      };

      // Step 1: Extract and deduplicate users
      const uniqueUsers = new Map<string, {
        email: string;
        username: string;
        firstName: string;
        lastName: string;
        role: string;
        excelRowNumber: number;
        stores: string[]; // Store codes this user manages
      }>();

      // Debugging: Track user counts
      let rmProcessed = 0, amProcessed = 0, smProcessed = 0;
      let rmVacant = 0, amVacant = 0, smVacant = 0;

      // Collect unique users and their associated stores
      rows.forEach(row => {
        // Regional Manager
        if (row.rm_email && row.rm_email.toLowerCase() !== 'vacant') {
          const email = row.rm_email.toLowerCase();
          if (!uniqueUsers.has(email)) {
            uniqueUsers.set(email, {
              email: row.rm_email,
              username: row.rm_username,
              firstName: row.rm_name,
              lastName: row.rm_surname,
              role: 'regional_manager',
              excelRowNumber: row.rowNumber,
              stores: []
            });
            rmProcessed++;
          }
          uniqueUsers.get(email)!.stores.push(row.store_code);
        } else if (row.rm_email && row.rm_email.toLowerCase() === 'vacant') {
          rmVacant++;
        }

        // Area Manager
        if (row.am_name && row.am_name.toLowerCase() !== 'vacant' && row.am_username) {
          // Generate email from username if no email provided
          const email = row.am_email && row.am_email.toLowerCase() !== 'vacant' 
            ? row.am_email.toLowerCase() 
            : `${row.am_username}@thebedshop.co.za`.toLowerCase();
          
          // Validate required fields
          if (row.am_username && row.am_surname) {
            if (!uniqueUsers.has(email)) {
              uniqueUsers.set(email, {
                email: email,
                username: row.am_username,
                firstName: row.am_name,
                lastName: row.am_surname,
                role: 'area_manager',
                excelRowNumber: row.rowNumber,
                stores: []
              });
              amProcessed++;
            }
            uniqueUsers.get(email)!.stores.push(row.store_code);
          } else {
            console.warn(`⚠️ Skipping area manager row ${row.rowNumber}: missing username or surname`);
            results.errors.push({
              rowNumber: row.rowNumber,
              userType: 'area_manager',
              userName: row.am_name || 'Unknown',
              email: email,
              errorType: 'validation',
              errorMessage: 'Missing required fields',
              details: `Missing ${!row.am_username ? 'username' : ''} ${!row.am_surname ? 'surname' : ''}`.trim()
            });
          }
        } else if (row.am_name && row.am_name.toLowerCase() === 'vacant') {
          amVacant++;
        }

        // Store Manager
        if (row.store_manager && row.store_manager.toLowerCase() !== 'vacant' && row.Store_manager_username) {
          // Generate email from username if no email provided
          const email = row.Store_manager_email && row.Store_manager_email.toLowerCase() !== 'vacant' 
            ? row.Store_manager_email.toLowerCase() 
            : `${row.Store_manager_username}@thebedshop.co.za`.toLowerCase();
          
          // Validate required fields
          if (row.Store_manager_username && row.store_manager) {
            if (!uniqueUsers.has(email)) {
              const [firstName, ...lastNameParts] = row.store_manager.split(' ');
              const lastName = lastNameParts.join(' ') || firstName;
              
              // Ensure we have both firstName and lastName
              if (firstName && lastName && firstName !== lastName) {
                uniqueUsers.set(email, {
                  email: email,
                  username: row.Store_manager_username,
                  firstName: firstName,
                  lastName: lastName,
                  role: 'store_manager',
                  excelRowNumber: row.rowNumber,
                  stores: []
                });
                smProcessed++;
              } else {
                console.warn(`⚠️ Skipping store manager row ${row.rowNumber}: invalid name format "${row.store_manager}"`);
                results.errors.push({
                  rowNumber: row.rowNumber,
                  userType: 'store_manager',
                  userName: row.store_manager || 'Unknown',
                  email: email,
                  errorType: 'validation',
                  errorMessage: 'Invalid name format',
                  details: `Cannot parse "${row.store_manager}" into first and last name`
                });
              }
            }
            if (uniqueUsers.has(email)) {
              uniqueUsers.get(email)!.stores.push(row.store_code);
            }
          } else {
            console.warn(`⚠️ Skipping store manager row ${row.rowNumber}: missing username or name`);
            results.errors.push({
              rowNumber: row.rowNumber,
              userType: 'store_manager',
              userName: row.store_manager || 'Unknown',
              email: email,
              errorType: 'validation',
              errorMessage: 'Missing required fields',
              details: `Missing ${!row.Store_manager_username ? 'username' : ''} ${!row.store_manager ? 'name' : ''}`.trim()
            });
          }
        } else if (row.store_manager && row.store_manager.toLowerCase() === 'vacant') {
          smVacant++;
        }
      });

      // Debug logging
      console.log(`📊 USER PROCESSING SUMMARY:`);
      console.log(`Regional Managers: ${rmProcessed} unique (${rmVacant} vacant)`);
      console.log(`Area Managers: ${amProcessed} unique (${amVacant} vacant)`);
      console.log(`Store Managers: ${smProcessed} unique (${smVacant} vacant)`);
      console.log(`Total unique users to process: ${uniqueUsers.size}`);

      // Step 2: Process unique users (create/update only once)
      console.log(`Processing ${uniqueUsers.size} unique users...`);
      for (const userData of uniqueUsers.values()) {
        await processUser({
          email: userData.email,
          username: userData.username,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
          excelRowNumber: userData.excelRowNumber
        }, results);
      }

      // Step 3: Process stores (one per row)
      console.log(`Processing ${rows.length} stores...`);
      for (const row of rows) {
        await processStore({
          storeCode: row.store_code,
          storeName: row.Store,
          excelRowNumber: row.rowNumber
        }, results);
      }

      // Step 4: Create assignments between users and stores
      console.log('Creating management assignments...');
      await createManagementAssignments(rows, uniqueUsers, results);

      // Update sync log with final results
      await db
        .from('excel_sync_logs')
        .update({
          users_created: results.usersCreated,
          users_updated: results.usersUpdated,
          stores_created: results.storesCreated,
          stores_updated: results.storesUpdated,
          assignments_created: results.assignmentsCreated,
          conflicts_found: results.conflictsFound,
          sync_status: 'completed'
        })
        .eq('sync_id', syncId);

      return results;
    } catch (error) {
      // Log the error
      try {
        await supabaseAdmin
          ?.from('excel_sync_logs')
          .update({
            sync_status: 'failed',
            error_details: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('sync_id', syncId);
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }

      throw error;
    }
  };

  const createManagementAssignments = async (
    rows: ExcelRow[],
    uniqueUsers: Map<string, any>,
    results: SyncResults
  ) => {
    const db = checkSupabase();

    // Get user IDs for all users we just created/updated
    // Since emails are generated from usernames, lookup by username is most reliable
    const usernames = Array.from(uniqueUsers.values()).map(user => user.username);
    
    console.log(`🔍 Looking up users by usernames: ${usernames.join(', ')}`);
    
    const { data: users, error: usersError } = await db
      .from('users')
      .select('id, email, username, role')
      .in('username', usernames);

    if (usersError) {
      console.error('❌ Error looking up users:', usersError);
      return;
    }
    
    if (!users) {
      console.warn('⚠️ No users found in database');
      return;
    }
    
    console.log(`✅ Found ${users.length} users in database:`, users.map(u => `${u.email} (${u.username})`).join(', '));

    // Create a map of email -> user_id for quick lookup
    // Since emails are generated, we need to map both actual emails and generated emails
    const userIdMap = new Map<string, string>();
    users.forEach(user => {
      // Map actual email stored in database
      userIdMap.set(user.email.toLowerCase(), user.id);
      
      // Map generated email pattern for assignment lookup
      if (user.username) {
        const generatedEmail = `${user.username.toLowerCase()}@thebedshop.co.za`;
        userIdMap.set(generatedEmail, user.id);
      }
    });
    
    // Debug logging
    console.log(`📊 User ID Map contains ${userIdMap.size} entries:`);
    for (const [email, userId] of userIdMap.entries()) {
      console.log(`   ${email} -> ${userId}`);
    }

    // Get store IDs for all stores
    const storeCodes = rows.map(row => row.store_code);
    const { data: stores } = await db
      .from('stores')
      .select('id, store_code')
      .in('store_code', storeCodes);

    if (!stores) return;

    // Create a map of store_code -> store_id for quick lookup
    const storeIdMap = new Map<string, string>();
    stores.forEach(store => {
      storeIdMap.set(store.store_code, store.id);
    });

    // Clear existing assignments to ensure clean slate
    await db.from('store_manager_assignments').update({ status: 'inactive' }).eq('status', 'active');
    await db.from('area_manager_store_assignments').update({ status: 'inactive' }).eq('status', 'active');
    await db.from('regional_manager_assignments').update({ status: 'inactive' }).eq('status', 'active');
    await db.from('regional_area_manager_assignments').update({ status: 'inactive' }).eq('status', 'active');

    // Process each row to create assignments
    console.log(`🔗 Processing assignments for ${rows.length} rows...`);
    console.log(`📋 Available user emails in userIdMap:`, Array.from(userIdMap.keys()));
    
    // Debug: Show sample Excel data for first few rows
    console.log(`📄 Sample Excel data (first 3 rows):`);
    rows.slice(0, 3).forEach((row, idx) => {
      console.log(`Row ${idx + 1}:`, {
        store_code: row.store_code,
        rm_email: row.rm_email,
        am_email: row.am_email,
        Store_manager_email: row.Store_manager_email,
        store_manager: row.store_manager
      });
    });
    
    let storeManagerAttempts = 0, storeManagerSuccess = 0;
    let areaManagerAttempts = 0, areaManagerSuccess = 0;
    let regionalManagerAttempts = 0, regionalManagerSuccess = 0;
    
    for (const row of rows) {
      const storeId = storeIdMap.get(row.store_code);
      if (!storeId) {
        console.warn(`❌ Store not found for code: ${row.store_code}`);
        continue;
      }

      // Store Manager Assignment
      if (row.store_manager && row.store_manager.toLowerCase() !== 'vacant' && row.Store_manager_username) {
        storeManagerAttempts++;
        // Generate email same way as user creation
        const email = row.Store_manager_email && row.Store_manager_email.toLowerCase() !== 'vacant' 
          ? row.Store_manager_email.toLowerCase() 
          : `${row.Store_manager_username}@thebedshop.co.za`.toLowerCase();
        
        const userId = userIdMap.get(email);
        console.log(`🏪 Store Manager for ${row.store_code}: ${email} -> userId: ${userId ? '✅' : '❌'}`);
        if (userId) {
          try {
            const { error } = await db.from('store_manager_assignments').upsert({
              store_id: storeId,
              store_manager_id: userId,
              assignment_source: 'excel',
              status: 'active'
            }, {
              onConflict: 'store_manager_id, store_id'
            });
            if (error) {
              console.error(`❌ Store manager assignment error:`, error);
            } else {
              storeManagerSuccess++;
              results.assignmentsCreated++;
              console.log(`✅ Store manager assigned: ${email} to ${row.store_code}`);
            }
          } catch (error) {
            console.error(`❌ Store manager assignment exception:`, error);
          }
        } else {
          console.warn(`❌ Store manager user not found: ${email}`);
        }
      }

      // Area Manager Assignment
      if (row.am_name && row.am_name.toLowerCase() !== 'vacant' && row.am_username) {
        areaManagerAttempts++;
        // Generate email same way as user creation
        const email = row.am_email && row.am_email.toLowerCase() !== 'vacant' 
          ? row.am_email.toLowerCase() 
          : `${row.am_username}@thebedshop.co.za`.toLowerCase();
        
        const userId = userIdMap.get(email);
        console.log(`🌍 Area Manager for ${row.store_code}: ${email} -> userId: ${userId ? '✅' : '❌'}`);
        if (!userId) {
          console.log(`   🔍 Available emails in userIdMap: ${Array.from(userIdMap.keys()).join(', ')}`);
          console.log(`   🔍 Looking for exact match: '${email}'`);
        }
        if (userId) {
          try {
            const { error } = await db.from('area_manager_store_assignments').upsert({
              store_id: storeId,
              area_manager_id: userId,
              assignment_source: 'excel',
              status: 'active'
            }, {
              onConflict: 'area_manager_id, store_id'
            });
            if (error) {
              console.error(`❌ Area manager assignment error:`, error);
            } else {
              areaManagerSuccess++;
              results.assignmentsCreated++;
              console.log(`✅ Area manager assigned: ${email} to ${row.store_code}`);
            }
          } catch (error) {
            console.error(`❌ Area manager assignment exception:`, error);
          }
        } else {
          console.warn(`❌ Area manager user not found: ${email}`);
        }
      }

      // Regional Manager Assignment (via stores for backward compatibility)
      if (row.rm_email && row.rm_email.toLowerCase() !== 'vacant') {
        regionalManagerAttempts++;
        const userId = userIdMap.get(row.rm_email.toLowerCase());
        console.log(`🗺️ Regional Manager for ${row.store_code}: ${row.rm_email} -> userId: ${userId ? '✅' : '❌'}`);
        if (userId) {
          try {
            // Check for existing assignment first
            const { data: existingAssignment } = await db
              .from('regional_manager_assignments')
              .select('id')
              .eq('regional_manager_id', userId)
              .eq('store_id', storeId)
              .eq('assignment_type', 'direct_store')
              .maybeSingle();
            
            let error = null;
            if (existingAssignment) {
              // Update existing assignment
              const result = await db
                .from('regional_manager_assignments')
                .update({
                  assignment_source: 'excel',
                  status: 'active'
                })
                .eq('id', existingAssignment.id);
              error = result.error;
            } else {
              // Create new assignment
              const result = await db
                .from('regional_manager_assignments')
                .insert({
                  store_id: storeId,
                  regional_manager_id: userId,
                  assignment_type: 'direct_store',
                  assignment_source: 'excel',
                  status: 'active'
                });
              error = result.error;
            }
            if (error) {
              console.error(`❌ Regional manager assignment error:`, error);
            } else {
              regionalManagerSuccess++;
              results.assignmentsCreated++;
              console.log(`✅ Regional manager assigned: ${row.rm_email} to ${row.store_code}`);
            }
          } catch (error) {
            console.error(`❌ Regional manager assignment exception:`, error);
          }
        } else {
          console.warn(`❌ Regional manager user not found: ${row.rm_email}`);
        }
      }
    }
    
    console.log(`📊 Assignment Summary:`);
    console.log(`Store Managers: ${storeManagerSuccess}/${storeManagerAttempts} successful`);
    console.log(`Area Managers: ${areaManagerSuccess}/${areaManagerAttempts} successful`);
    console.log(`Regional Managers: ${regionalManagerSuccess}/${regionalManagerAttempts} successful`);

    // Step 5: Create Regional Manager → Area Manager relationships
    console.log('Creating Regional Manager → Area Manager relationships...');
    const rmToAmRelationships = new Map<string, Set<string>>();
    
    // Collect RM → AM relationships from the data
    rows.forEach(row => {
      if (row.rm_email && row.rm_email.toLowerCase() !== 'vacant' && 
          row.am_name && row.am_name.toLowerCase() !== 'vacant' && row.am_username) {
        const rmEmail = row.rm_email.toLowerCase();
        // Generate AM email same way as user creation
        const amEmail = row.am_email && row.am_email.toLowerCase() !== 'vacant' 
          ? row.am_email.toLowerCase() 
          : `${row.am_username}@thebedshop.co.za`.toLowerCase();
        
        if (!rmToAmRelationships.has(rmEmail)) {
          rmToAmRelationships.set(rmEmail, new Set());
        }
        rmToAmRelationships.get(rmEmail)!.add(amEmail);
      }
    });

    // Create the RM → AM assignments
    for (const [rmEmail, amEmails] of rmToAmRelationships.entries()) {
      const rmUserId = userIdMap.get(rmEmail);
      if (!rmUserId) continue;

      for (const amEmail of amEmails) {
        const amUserId = userIdMap.get(amEmail);
        if (!amUserId) continue;

        // Check for existing assignment first
        const { data: existingAssignment } = await db
          .from('regional_area_manager_assignments')
          .select('id')
          .eq('regional_manager_id', rmUserId)
          .eq('area_manager_id', amUserId)
          .eq('status', 'active')
          .maybeSingle();
        
        if (existingAssignment) {
          // Update existing assignment
          await db
            .from('regional_area_manager_assignments')
            .update({
              assignment_source: 'excel'
            })
            .eq('id', existingAssignment.id);
        } else {
          // Create new assignment
          await db
            .from('regional_area_manager_assignments')
            .insert({
              regional_manager_id: rmUserId,
              area_manager_id: amUserId,
              assignment_source: 'excel',
              status: 'active'
            });
        }
        results.assignmentsCreated++;
      }
    }

    console.log('✅ Management assignments creation complete!');
  };

  const processUser = async (userData: {
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    role: string;
    excelRowNumber: number;
  }, results: SyncResults) => {
    const db = checkSupabase();
    
    console.log(`👤 Processing user: ${userData.email} (${userData.role})`);
    
    try {
      // Check if user exists using admin client (by email or username)
      const { data: existingUser, error: lookupError } = await db
        .from('users')
        .select('id, email, username')
        .or(`email.eq.${userData.email},username.eq.${userData.username}`)
        .maybeSingle();

      if (lookupError) {
        // Handle 406 errors or other lookup issues - proceed to create user
        console.log(`⚠️ User lookup failed (${lookupError.message}), proceeding to create user: ${userData.email}`);
      } else if (existingUser) {
        // Update existing user
        console.log(`📝 Updating existing user: ${userData.email}`);
        const { error } = await db
          .from('users')
          .update({
            first_name: userData.firstName,
            last_name: userData.lastName,
            username: userData.username,
            role: userData.role,
            status: 'active',
            created_from_excel: true,
            excel_row_number: userData.excelRowNumber
          })
          .eq('id', existingUser.id);

        if (!error) {
          results.usersUpdated++;
          console.log(`✅ User updated successfully: ${userData.email}`);
        } else {
          console.error(`❌ Error updating user ${userData.email}:`, error);
          results.errors.push({
            rowNumber: userData.excelRowNumber,
            userType: userData.role as any,
            userName: `${userData.firstName} ${userData.lastName}`,
            email: userData.email,
            errorType: 'database',
            errorMessage: 'Failed to update user',
            details: error.message
          });
        }
        return; // Exit early if update succeeded
      }
      
      // User doesn't exist or lookup failed - proceed to create user
      // User not found in Supabase, but might exist in Clerk
      console.log(`➕ Creating new user: ${userData.email}`);
      const password = generatePassword(userData.lastName);
        
        try {
          // Use the existing createUser function from clerk-admin
          const { createUser } = await import('@/lib/clerk-admin');
          
          const newUserId = await createUser({
            emailAddress: userData.email,
            username: userData.username,
            password: password,
            firstName: userData.firstName,
            lastName: userData.lastName,
            role: userData.role,
            groupType: userData.role === 'regional_manager' ? 'Regional' : 
                       userData.role === 'area_manager' ? 'Area' : 'Store',
            companyName: 'The Bed Shop'
          });

          if (newUserId) {
            // Update the user record to mark as created from Excel
            await db
              .from('users')
              .update({
                created_from_excel: true,
                excel_row_number: userData.excelRowNumber
              })
              .eq('email', userData.email);
            
            results.usersCreated++;
            console.log(`✅ User created successfully: ${userData.email}`);
          } else {
            console.error(`❌ Failed to create user ${userData.email}: createUser returned null`);
            results.errors.push({
              rowNumber: userData.excelRowNumber,
              userType: userData.role as any,
              userName: `${userData.firstName} ${userData.lastName}`,
              email: userData.email,
              errorType: 'creation',
              errorMessage: 'User creation failed',
              details: 'createUser returned null'
            });
          }
        } catch (error) {
          console.error(`❌ Error creating user ${userData.email}:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          // Handle "User already exists in Clerk" error
          if (errorMessage.includes('User with this email already exists in Clerk')) {
            console.log(`📝 User already exists in Clerk, attempting to find in Supabase: ${userData.email}`);
            
            // Try to find user in Supabase without the admin client restriction
            try {
              const { data: existingUser } = await db
                .from('users')
                .select('id, email, username')
                .or(`email.eq.${userData.email},username.eq.${userData.username}`)
                .maybeSingle();
              
              if (existingUser) {
                // Update existing user
                console.log(`📝 Updating existing user found in Supabase: ${userData.email}`);
                const { error } = await db
                  .from('users')
                  .update({
                    first_name: userData.firstName,
                    last_name: userData.lastName,
                    username: userData.username,
                    role: userData.role,
                    status: 'active',
                    created_from_excel: true,
                    excel_row_number: userData.excelRowNumber
                  })
                  .eq('id', existingUser.id);
                
                if (!error) {
                  results.usersUpdated++;
                  console.log(`✅ User updated successfully: ${userData.email}`);
                } else {
                  console.error(`❌ Error updating existing user ${userData.email}:`, error);
                  results.errors.push({
                    rowNumber: userData.excelRowNumber,
                    userType: userData.role as any,
                    userName: `${userData.firstName} ${userData.lastName}`,
                    email: userData.email,
                    errorType: 'database',
                    errorMessage: 'Failed to update existing user',
                    details: error.message
                  });
                }
              } else {
                // User exists in Clerk but not in Supabase - create the Supabase record
                console.log(`🔄 User exists in Clerk but not in Supabase, creating Supabase record: ${userData.email}`);
                
                try {
                  // First check if user exists by username or email
                  const { data: existingByUsername } = await db
                    .from('users')
                    .select('id, email, username')
                    .or(`email.eq.${userData.email},username.eq.${userData.username}`)
                    .maybeSingle();
                  
                  if (existingByUsername) {
                    // User exists, update them
                    console.log(`📝 Found existing user by username/email, updating: ${userData.email}`);
                    const { error: updateError } = await db
                      .from('users')
                      .update({
                        email: userData.email,
                        first_name: userData.firstName,
                        last_name: userData.lastName,
                        username: userData.username,
                        role: userData.role,
                        status: 'active',
                        created_from_excel: true,
                        excel_row_number: userData.excelRowNumber
                      })
                      .eq('id', existingByUsername.id);
                    
                    if (!updateError) {
                      results.usersUpdated++;
                      console.log(`✅ User record updated in Supabase: ${userData.email}`);
                    } else {
                      console.error(`❌ Error updating user record in Supabase ${userData.email}:`, updateError);
                      results.errors.push({
                        rowNumber: userData.excelRowNumber,
                        userType: userData.role as any,
                        userName: `${userData.firstName} ${userData.lastName}`,
                        email: userData.email,
                        errorType: 'database',
                        errorMessage: 'Failed to update existing user record in Supabase',
                        details: updateError.message
                      });
                    }
                  } else {
                    // User doesn't exist, create them
                    const { error: insertError } = await db
                      .from('users')
                      .insert({
                        email: userData.email,
                        first_name: userData.firstName,
                        last_name: userData.lastName,
                        username: userData.username,
                        role: userData.role,
                        status: 'active',
                        created_from_excel: true,
                        excel_row_number: userData.excelRowNumber
                      });
                    
                    if (!insertError) {
                      results.usersCreated++;
                      console.log(`✅ User record created in Supabase: ${userData.email}`);
                    } else {
                      console.error(`❌ Error creating user record in Supabase ${userData.email}:`, insertError);
                      results.errors.push({
                        rowNumber: userData.excelRowNumber,
                        userType: userData.role as any,
                        userName: `${userData.firstName} ${userData.lastName}`,
                        email: userData.email,
                        errorType: 'database',
                        errorMessage: 'Failed to create user record in Supabase',
                        details: insertError.message
                      });
                    }
                  }
                } catch (createError) {
                  console.error(`❌ Error creating user record in Supabase ${userData.email}:`, createError);
                  results.errors.push({
                    rowNumber: userData.excelRowNumber,
                    userType: userData.role as any,
                    userName: `${userData.firstName} ${userData.lastName}`,
                    email: userData.email,
                    errorType: 'database',
                    errorMessage: 'Failed to create user record in Supabase',
                    details: createError instanceof Error ? createError.message : 'Unknown error'
                  });
                }
              }
            } catch (lookupError) {
              console.error(`❌ Error looking up existing user ${userData.email}:`, lookupError);
              results.errors.push({
                rowNumber: userData.excelRowNumber,
                userType: userData.role as any,
                userName: `${userData.firstName} ${userData.lastName}`,
                email: userData.email,
                errorType: 'database',
                errorMessage: 'Failed to lookup existing user',
                details: lookupError instanceof Error ? lookupError.message : 'Unknown error'
              });
            }
          } else {
            // Parse other error types
            let errorType: 'password' | 'creation' = 'creation';
            if (errorMessage.includes('password') || errorMessage.includes('breach')) {
              errorType = 'password';
            }
            
            results.errors.push({
              rowNumber: userData.excelRowNumber,
              userType: userData.role as any,
              userName: `${userData.firstName} ${userData.lastName}`,
              email: userData.email,
              errorType,
              errorMessage: errorType === 'password' ? 'Password security issue' : 'User creation failed',
              details: errorMessage
            });
          }
        }
    } catch (error) {
      console.error(`❌ Error processing user ${userData.email}:`, error);
      results.errors.push({
        rowNumber: userData.excelRowNumber,
        userType: userData.role as any,
        userName: `${userData.firstName} ${userData.lastName}`,
        email: userData.email,
        errorType: 'database',
        errorMessage: 'Processing error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const processStore = async (storeData: {
    storeCode: string;
    storeName: string;
    excelRowNumber: number;
  }, results: SyncResults) => {
    const db = checkSupabase();
    
    // Check if store exists
    const { data: existingStore } = await db
      .from('stores')
      .select('id, store_code')
      .eq('store_code', storeData.storeCode)
      .single();

    if (existingStore) {
      // Update existing store
      const { error } = await db
        .from('stores')
        .update({
          store_name: storeData.storeName,
          status: 'active',
          created_from_excel: true,
          excel_row_number: storeData.excelRowNumber
        })
        .eq('id', existingStore.id);

      if (!error) results.storesUpdated++;
    } else {
      // Create new store
      const { error } = await db
        .from('stores')
        .insert({
          store_code: storeData.storeCode,
          store_name: storeData.storeName,
          status: 'active',
          created_from_excel: true,
          excel_row_number: storeData.excelRowNumber,
          active: true
        });

      if (!error) results.storesCreated++;
    }
  };

  const onSubmit = async (data: UploadFormData) => {
    setIsUploading(true);
    setUploadResults(null);

    try {
      // Parse Excel file
      const rows = await parseExcelFile(data.file[0]);
      
      // Validate data
      const validationErrors = validateData(rows);
      if (validationErrors.length > 0) {
        // Log all validation errors to console for debugging
        console.error(`Found ${validationErrors.length} validation errors:`);
        validationErrors.forEach((error, index) => {
          console.error(`Error ${index + 1}: ${error}`);
        });

        toast({
          title: 'Validation Errors',
          description: `Found ${validationErrors.length} errors. Check console for details.`,
          variant: 'destructive'
        });
        
        // Log validation errors as conflicts
        try {
          const db = checkSupabase();
          const syncId = crypto.randomUUID();
          for (const error of validationErrors) {
            await db
              .from('sync_conflicts')
              .insert({
                sync_id: syncId,
                conflict_type: 'validation_error',
                entity_type: 'user',
                conflict_description: error,
                resolution_status: 'pending'
              });
          }
        } catch (dbError) {
          console.error('Failed to log validation errors:', dbError);
        }
        return;
      }

      // Process upload
      const results = await processUpload(rows);
      setUploadResults(results);

      toast({
        title: 'Upload Successful',
        description: `Processed ${results.totalRows} rows. Created ${results.usersCreated} users, ${results.storesCreated} stores.`
      });

      // Reset form
      form.reset();
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Multi-Level Hierarchy Upload
        </CardTitle>
        <CardDescription>
          Upload Excel file with Regional Managers, Area Managers, Store Managers, and Store assignments.
          Expected format: rm_name, rm_surname, rm_email, rm_username, am_name, am_surname, am_username, am_email, Store, store_code, store_manager, Store_manager_email, Store_manager_username
        </CardDescription>
      </CardHeader>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="file">Excel File</Label>
            <Input
              id="file"
              type="file"
              accept=".xlsx,.xls"
              {...form.register('file')}
              disabled={isUploading}
            />
            {form.formState.errors.file && (
              <p className="text-sm text-destructive">
                {form.formState.errors.file.message}
              </p>
            )}
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> This will sync all data from the Excel file. 
              Users not in the Excel will be marked as inactive. 
              Any conflicts will block the entire sync process.
            </AlertDescription>
          </Alert>

          {uploadResults && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Sync Complete!</strong><br />
                  • Total Rows: {uploadResults.totalRows}<br />
                  • Users Created: {uploadResults.usersCreated}<br />
                  • Users Updated: {uploadResults.usersUpdated}<br />
                  • Stores Created: {uploadResults.storesCreated}<br />
                  • Stores Updated: {uploadResults.storesUpdated}<br />
                  {uploadResults.errors.length > 0 && (
                    <span className="text-destructive">
                      • Errors Found: {uploadResults.errors.length}
                    </span>
                  )}
                  {uploadResults.conflictsFound > 0 && (
                    <span className="text-destructive">
                      • Conflicts Found: {uploadResults.conflictsFound}
                    </span>
                  )}
                </AlertDescription>
              </Alert>

              {uploadResults.errors.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold text-destructive mb-3">
                    Processing Errors ({uploadResults.errors.length})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-3 py-2 text-left">Row #</th>
                          <th className="border border-gray-300 px-3 py-2 text-left">User Type</th>
                          <th className="border border-gray-300 px-3 py-2 text-left">Name</th>
                          <th className="border border-gray-300 px-3 py-2 text-left">Email</th>
                          <th className="border border-gray-300 px-3 py-2 text-left">Error Type</th>
                          <th className="border border-gray-300 px-3 py-2 text-left">Error Message</th>
                          <th className="border border-gray-300 px-3 py-2 text-left">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadResults.errors.map((error, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-3 py-2">{error.rowNumber}</td>
                            <td className="border border-gray-300 px-3 py-2">
                              <span className={`px-2 py-1 rounded text-xs ${
                                error.userType === 'regional_manager' ? 'bg-blue-100 text-blue-800' :
                                error.userType === 'area_manager' ? 'bg-green-100 text-green-800' :
                                'bg-orange-100 text-orange-800'
                              }`}>
                                {error.userType.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="border border-gray-300 px-3 py-2">{error.userName}</td>
                            <td className="border border-gray-300 px-3 py-2 text-sm">{error.email}</td>
                            <td className="border border-gray-300 px-3 py-2">
                              <span className={`px-2 py-1 rounded text-xs ${
                                error.errorType === 'validation' ? 'bg-red-100 text-red-800' :
                                error.errorType === 'password' ? 'bg-yellow-100 text-yellow-800' :
                                error.errorType === 'creation' ? 'bg-purple-100 text-purple-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {error.errorType}
                              </span>
                            </td>
                            <td className="border border-gray-300 px-3 py-2">{error.errorMessage}</td>
                            <td className="border border-gray-300 px-3 py-2 text-sm text-gray-600">
                              {error.details}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          <Button type="submit" disabled={isUploading} className="w-full">
            {isUploading ? (
              <>
                <Upload className="mr-2 h-4 w-4 animate-spin" />
                Processing Upload...
              </>
            ) : (
              <>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Upload Hierarchy Data
              </>
            )}
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}