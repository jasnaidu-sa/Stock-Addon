import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('- VITE_SUPABASE_URL:', supabaseUrl ? 'exists' : 'missing');
  console.error('- VITE_SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'exists' : 'missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('Reading migration file...');
    const migrationPath = join(__dirname, 'supabase', 'migrations', '20250716_003_create_assignment_tables.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    console.log('Applying migration to database...');
    console.log('Migration size:', migrationSQL.length, 'characters');
    
    // Check if we have exec_sql function
    console.log('Testing exec_sql function...');
    const { data: testData, error: testError } = await supabase.rpc('exec_sql', {
      sql: 'SELECT 1 as test'
    });
    
    if (testError) {
      console.error('exec_sql function not available:', testError.message);
      console.log('Trying to create exec_sql function...');
      
      // Try to create exec_sql function
      const createFunctionSQL = `
        CREATE OR REPLACE FUNCTION exec_sql(sql text)
        RETURNS SETOF record
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $function$
        BEGIN
          RETURN QUERY EXECUTE sql;
        END;
        $function$;
      `;
      
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql: createFunctionSQL
      });
      
      if (createError) {
        console.error('Could not create exec_sql function:', createError.message);
        process.exit(1);
      }
    }
    
    // Apply the migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (error) {
      console.error('Migration failed:', error.message);
      console.error('Error details:', error);
      process.exit(1);
    }
    
    console.log('✅ Migration applied successfully!');
    console.log('Created tables:');
    console.log('  - store_manager_assignments');
    console.log('  - area_manager_store_assignments');
    console.log('  - regional_manager_assignments');
    console.log('  - regional_area_manager_assignments');
    console.log('  - excel_sync_logs');
    console.log('  - sync_conflicts');
    
    // Verify tables were created
    console.log('\nVerifying tables were created...');
    const tablesToCheck = [
      'store_manager_assignments',
      'area_manager_store_assignments', 
      'regional_manager_assignments',
      'regional_area_manager_assignments',
      'excel_sync_logs',
      'sync_conflicts'
    ];
    
    for (const table of tablesToCheck) {
      try {
        const { data: tableData, error: tableError } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (tableError) {
          console.log(`❌ ${table}: ${tableError.message}`);
        } else {
          console.log(`✅ ${table}: exists and accessible`);
        }
      } catch (err) {
        console.log(`❌ ${table}: ${err.message}`);
      }
    }
    
    console.log('\n🎉 Assignment tables are now ready for hierarchy upload!');
    
  } catch (error) {
    console.error('Script error:', error);
    process.exit(1);
  }
}

applyMigration();