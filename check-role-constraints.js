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

async function checkRoleConstraints() {
  console.log('Checking role constraints in weekly_plan_amendments...');
  
  try {
    // Check existing created_by_role values
    const { data: existingRoles, error: rolesError } = await supabase
      .from('weekly_plan_amendments')
      .select('created_by_role')
      .not('created_by_role', 'is', null);
    
    if (rolesError) {
      console.error('Error checking existing roles:', rolesError);
      return;
    }
    
    const uniqueRoles = [...new Set(existingRoles?.map(r => r.created_by_role))];
    console.log('✅ Existing created_by_role values:', uniqueRoles);
    
    // Test different role values to see which ones are allowed
    const testRoles = ['area_manager', 'regional_manager', 'store_manager', 'admin'];
    
    for (const role of testRoles) {
      console.log(`\n🧪 Testing role: ${role}`);
      
      // Try to insert with this role
      const { error: testError } = await supabase
        .from('weekly_plan_amendments')
        .insert({
          weekly_plan_id: '9f0bdd95-c976-403f-a268-7fce24543330', // Use existing ID
          user_id: '773b84a9-e344-49dc-98e2-dc0e75ba667e', // Area manager ID
          store_id: 'e510937f-b6e0-4256-adca-46d876430e4a', // Acornhoek store ID
          stock_code: 'TEST-001',
          category: 'Test',
          week_reference: 'Week 28',
          week_start_date: '2025-07-07',
          amendment_type: 'add_on',
          original_qty: 0,
          amended_qty: 1,
          justification: 'Test amendment',
          status: 'pending',
          created_by_role: role,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (testError) {
        if (testError.code === '23514') {
          console.log(`  ❌ ${role} - Not allowed by constraint`);
        } else {
          console.log(`  ❌ ${role} - Other error: ${testError.message}`);
        }
      } else {
        console.log(`  ✅ ${role} - Allowed!`);
        
        // Clean up the test record
        await supabase
          .from('weekly_plan_amendments')
          .delete()
          .eq('stock_code', 'TEST-001')
          .eq('created_by_role', role);
      }
    }
    
  } catch (error) {
    console.error('Error checking role constraints:', error.message);
  }
}

checkRoleConstraints();