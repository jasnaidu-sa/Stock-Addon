import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase credentials. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function applyAreaManagerMigration() {
  console.log('Applying area manager migration...');
  
  try {
    // Read the migration file
    const migrationSQL = readFileSync('./supabase/migrations/20250717_001_update_store_allocations_for_area_managers.sql', 'utf8');
    
    // Split into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));
    
    for (const statement of statements) {
      console.log('Executing:', statement.substring(0, 100) + '...');
      
      const { error } = await supabase.rpc('exec_sql', {
        query: statement
      });
      
      if (error) {
        console.error('Error executing statement:', error);
        console.error('Statement was:', statement);
        throw error;
      }
    }
    
    console.log('Migration applied successfully!');
    
    // Verify the changes by checking if area manager can access store allocations
    const { data: testData, error: testError } = await supabase
      .from('regional_manager_store_allocations')
      .select(`
        *,
        users!inner(role),
        stores!inner(store_name)
      `)
      .eq('user_id', '773b84a9-e344-49dc-98e2-dc0e75ba667e');
    
    if (testError) {
      console.error('Test query failed:', testError);
    } else {
      console.log('Test query successful! Area manager allocations:', testData?.length || 0);
      testData?.forEach(allocation => {
        console.log(`- ${allocation.stores.store_name} (User role: ${allocation.users.role})`);
      });
    }
    
  } catch (error) {
    console.error('Error applying migration:', error.message);
    console.error('Full error:', error);
  }
}

applyAreaManagerMigration();