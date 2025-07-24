const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  console.log('Available env vars:', Object.keys(process.env).filter(key => key.includes('SUPABASE')));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAssignmentTables() {
  console.log('Checking assignment tables in database...\n');
  
  // Define the tables we're looking for based on the hierarchy-upload.tsx code
  const assignmentTableNames = [
    'store_manager_assignments',
    'area_manager_store_assignments', 
    'regional_manager_assignments',
    'regional_area_manager_assignments',
    'regional_manager_store_allocations' // This one we know exists
  ];
  
  for (const tableName of assignmentTableNames) {
    try {
      console.log(`Checking table: ${tableName}`);
      
      // Try to get table structure
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`❌ Table ${tableName} does not exist or is inaccessible`);
        console.log(`   Error: ${error.message}\n`);
      } else {
        console.log(`✅ Table ${tableName} exists`);
        
        // Get column information
        const { data: columns, error: columnError } = await supabase
          .rpc('exec_sql', {
            sql: `
              SELECT column_name, data_type, is_nullable, column_default
              FROM information_schema.columns 
              WHERE table_name = '${tableName}' 
              AND table_schema = 'public'
              ORDER BY ordinal_position;
            `
          });
        
        if (!columnError && columns) {
          console.log(`   Columns:`, columns.map(c => `${c.column_name} (${c.data_type})`).join(', '));
        }
        console.log('');
      }
    } catch (err) {
      console.log(`❌ Error checking ${tableName}:`, err.message);
    }
  }

  // Let's also check what tables actually exist in the database
  console.log('\nChecking all existing tables in public schema...');
  try {
    const { data: tables, error } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT table_name
          FROM information_schema.tables 
          WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          ORDER BY table_name;
        `
      });
    
    if (!error && tables) {
      console.log('All tables in database:');
      tables.forEach(table => {
        console.log(`  - ${table.table_name}`);
      });
    } else {
      console.log('Error getting table list:', error?.message);
    }
  } catch (err) {
    console.log('Error listing tables:', err.message);
  }

  // Check if exec_sql function exists
  console.log('\nChecking if exec_sql function exists...');
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: 'SELECT 1 as test'
    });
    
    if (error) {
      console.log('❌ exec_sql function does not exist or is not accessible');
      console.log('   Error:', error.message);
    } else {
      console.log('✅ exec_sql function is available');
    }
  } catch (err) {
    console.log('❌ Error testing exec_sql function:', err.message);
  }
}

// Also check some tables that should exist
async function checkExistingTables() {
  console.log('\nChecking core tables...');
  
  const coreTables = ['users', 'stores', 'orders', 'order_items'];
  
  for (const table of coreTables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`❌ Core table ${table} error:`, error.message);
      } else {
        console.log(`✅ Core table ${table} exists`);
      }
    } catch (err) {
      console.log(`❌ Error checking core table ${table}:`, err.message);
    }
  }
}

// Run the checks
checkAssignmentTables()
  .then(() => checkExistingTables())
  .then(() => {
    console.log('\n=== SUMMARY ===');
    console.log('The hierarchy-upload.tsx code is trying to insert into these tables:');
    console.log('- store_manager_assignments');
    console.log('- area_manager_store_assignments');
    console.log('- regional_manager_assignments');
    console.log('- regional_area_manager_assignments');
    console.log('');
    console.log('These tables need to be created for the hierarchy upload to work properly.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script error:', err);
    process.exit(1);
  });