import { createClient } from '@supabase/supabase-js';

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

async function verifyTables() {
  console.log('🔍 Checking assignment tables required by hierarchy-upload.tsx...\n');
  
  // Tables that the hierarchy upload code tries to insert into
  const requiredTables = [
    'store_manager_assignments',
    'area_manager_store_assignments', 
    'regional_manager_assignments',
    'regional_area_manager_assignments',
    'excel_sync_logs',
    'sync_conflicts'
  ];
  
  // Core tables that should exist
  const coreTables = [
    'users',
    'stores',
    'regional_manager_store_allocations'
  ];
  
  let missingTables = [];
  let existingTables = [];
  
  // Check required assignment tables
  console.log('📋 Required Assignment Tables:');
  for (const table of requiredTables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
        missingTables.push(table);
      } else {
        console.log(`✅ ${table}: exists and accessible`);
        existingTables.push(table);
      }
    } catch (err) {
      console.log(`❌ ${table}: ${err.message}`);
      missingTables.push(table);
    }
  }
  
  // Check core tables
  console.log('\n🏗️ Core Tables:');
  for (const table of coreTables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: exists and accessible`);
      }
    } catch (err) {
      console.log(`❌ ${table}: ${err.message}`);
    }
  }
  
  // Summary
  console.log('\n📊 Summary:');
  console.log(`✅ Existing tables: ${existingTables.length}/${requiredTables.length}`);
  console.log(`❌ Missing tables: ${missingTables.length}/${requiredTables.length}`);
  
  if (missingTables.length > 0) {
    console.log('\n⚠️  ISSUE FOUND:');
    console.log('The hierarchy-upload.tsx component will fail with 400 errors because these tables are missing:');
    missingTables.forEach(table => console.log(`   - ${table}`));
    console.log('\n🔧 TO FIX:');
    console.log('1. Apply the migration: node apply-migration.js');
    console.log('2. Or manually run the SQL in: supabase/migrations/20250716_003_create_assignment_tables.sql');
    console.log('3. Then re-run this script to verify');
  } else {
    console.log('\n🎉 ALL GOOD!');
    console.log('All required assignment tables exist. The hierarchy upload should work correctly.');
  }
  
  console.log('\n📝 Note: The hierarchy upload code in hierarchy-upload.tsx expects these tables to exist');
  console.log('   for storing management assignments between users and stores.');
}

verifyTables().catch(console.error);