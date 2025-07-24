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

async function checkAmendmentStructure() {
  console.log('Checking weekly_plan_amendments table structure...');
  
  try {
    // Check existing data structure
    const { data: sampleData, error: sampleError } = await supabase
      .from('weekly_plan_amendments')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.error('Sample data query failed:', sampleError);
      
      // Try to get the actual table structure by attempting to insert invalid data
      const { data: insertData, error: insertError } = await supabase
        .from('weekly_plan_amendments')
        .insert({
          test_column: 'test'
        });
      
      if (insertError) {
        console.log('Table structure hints from insert error:', insertError.message);
      }
      
      return;
    }
    
    if (sampleData && sampleData.length > 0) {
      console.log('✅ Sample data structure:');
      console.log(JSON.stringify(sampleData[0], null, 2));
      
      console.log('\n✅ Available columns:');
      Object.keys(sampleData[0]).forEach(key => {
        console.log(`  - ${key}: ${typeof sampleData[0][key]} (${sampleData[0][key]})`);
      });
    } else {
      console.log('⚠️  No sample data found in weekly_plan_amendments table');
      
      // Try to describe the table structure
      const { data: describeData, error: describeError } = await supabase
        .from('weekly_plan_amendments')
        .select('*')
        .limit(0);
      
      if (describeError) {
        console.error('Describe query failed:', describeError);
        console.log('Error details:', describeError.details);
        console.log('Error hint:', describeError.hint);
      }
    }
    
  } catch (error) {
    console.error('Error checking structure:', error.message);
  }
}

checkAmendmentStructure();