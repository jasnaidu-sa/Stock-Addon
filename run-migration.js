#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Environment variables
const supabaseUrl = 'https://cfjvskafvcljvxnawccs.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmanZza2FmdmNsanZ4bmF3Y2NzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDYzNzM4NCwiZXhwIjoyMDU2MjEzMzg0fQ.OmQM_6v1dmcImgab-KiWswvBzuRnbyLLOcr9EHXhb_8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAndApplyMigration() {
  try {
    console.log('🔍 Checking current database state...\n');
    
    // First, check if tables already exist
    const tablesToCheck = [
      'store_manager_assignments',
      'area_manager_store_assignments', 
      'regional_manager_assignments',
      'regional_area_manager_assignments',
      'excel_sync_logs',
      'sync_conflicts'
    ];
    
    let existingTables = [];
    let missingTables = [];
    
    for (const table of tablesToCheck) {
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
    
    console.log(`\n📊 Status: ${existingTables.length}/${tablesToCheck.length} tables exist`);
    
    if (missingTables.length === 0) {
      console.log('🎉 All assignment tables already exist! No migration needed.');
      return;
    }
    
    console.log(`\n🔧 Need to create ${missingTables.length} missing tables...`);
    console.log('Missing tables:', missingTables.join(', '));
    
    // Read and apply migration
    console.log('\n📖 Reading migration file...');
    const migrationPath = join(__dirname, 'supabase', 'migrations', '20250716_003_create_assignment_tables.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Migration size:', migrationSQL.length, 'characters');
    
    // Apply migration using direct SQL execution
    console.log('\n⚡ Applying migration...');
    
    // Split migration into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📋 Executing ${statements.length} SQL statements...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim() === '') continue;
      
      try {
        const { error } = await supabase.from('dummy').select('*').limit(0);
        // Use a different approach - create a temporary function
        const { data, error: execError } = await supabase.rpc('exec_sql', {
          sql: statement
        });
        
        if (execError) {
          // If exec_sql doesn't exist, use a more direct approach
          console.log(`⚠️  Statement ${i+1}: ${execError.message}`);
          errorCount++;
        } else {
          successCount++;
          if (i % 10 === 0) {
            console.log(`✅ Executed ${i+1}/${statements.length} statements`);
          }
        }
      } catch (err) {
        console.log(`❌ Statement ${i+1} error: ${err.message}`);
        errorCount++;
      }
    }
    
    console.log(`\n📊 Migration Results:`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    
    // Re-verify tables after migration
    console.log('\n🔍 Re-checking tables after migration...');
    
    let finalExistingTables = [];
    let finalMissingTables = [];
    
    for (const table of tablesToCheck) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ ${table}: ${error.message}`);
          finalMissingTables.push(table);
        } else {
          console.log(`✅ ${table}: exists and accessible`);
          finalExistingTables.push(table);
        }
      } catch (err) {
        console.log(`❌ ${table}: ${err.message}`);
        finalMissingTables.push(table);
      }
    }
    
    console.log(`\n🎯 Final Status: ${finalExistingTables.length}/${tablesToCheck.length} tables exist`);
    
    if (finalMissingTables.length === 0) {
      console.log('🎉 SUCCESS! All assignment tables are now ready for hierarchy upload!');
      console.log('\n📋 Created tables:');
      console.log('  - store_manager_assignments');
      console.log('  - area_manager_store_assignments');
      console.log('  - regional_manager_assignments');
      console.log('  - regional_area_manager_assignments');
      console.log('  - excel_sync_logs');
      console.log('  - sync_conflicts');
      console.log('\n✅ The hierarchy-upload.tsx component should now work without 400 errors!');
    } else {
      console.log('⚠️  Some tables are still missing. Manual intervention may be required.');
      console.log('Still missing:', finalMissingTables.join(', '));
    }
    
  } catch (error) {
    console.error('💥 Script error:', error);
    process.exit(1);
  }
}

checkAndApplyMigration();