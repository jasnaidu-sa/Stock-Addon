import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase credentials. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkAmendmentSchema() {
  console.log('Checking weekly_plan_amendments table schema...');
  
  try {
    // Check the table structure by querying the information schema
    const { data: columns, error: schemaError } = await supabase
      .rpc('exec_sql', {
        query: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = 'weekly_plan_amendments' 
          AND table_schema = 'public'
          ORDER BY ordinal_position;
        `
      });
    
    if (schemaError) {
      console.error('Schema query failed:', schemaError);
      return;
    }
    
    console.log('✅ Column structure for weekly_plan_amendments:');
    columns?.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'nullable' : 'not null'} ${col.column_default ? `default: ${col.column_default}` : ''}`);
    });
    
    // Also check existing data structure
    const { data: sampleData, error: sampleError } = await supabase
      .from('weekly_plan_amendments')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.error('Sample data query failed:', sampleError);
      return;
    }
    
    if (sampleData && sampleData.length > 0) {
      console.log('\n✅ Sample data structure:');
      console.log(JSON.stringify(sampleData[0], null, 2));
    } else {
      console.log('\n⚠️  No sample data found in weekly_plan_amendments table');
    }
    
  } catch (error) {
    console.error('Error checking schema:', error.message);
  }
}

checkAmendmentSchema();