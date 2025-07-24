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

async function simulateAreaManagerLogin() {
  console.log('Simulating area manager login flow...');
  
  // Simulate the exact flow that the Area Manager Interface uses
  const clerkId = 'user_2zxXdO3yTLseO3QM7Euy5wkEFdc'; // Thabo's Clerk ID
  
  try {
    // Step 1: Look up user by clerk_id (this is what the interface does)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, role, first_name, last_name')
      .eq('clerk_id', clerkId)
      .single();
    
    if (userError) {
      console.error('❌ User lookup failed:', userError);
      return;
    }
    
    console.log('✅ User found by clerk_id:', userData.email, userData.role);
    const supabaseUserId = userData.id;
    
    // Step 2: Load allocated stores (this is what loadAllocatedStores does)
    const { data: storeData, error: storeError } = await supabase
      .from('regional_manager_store_allocations')
      .select(`
        stores!inner(
          id,
          store_code,
          store_name,
          region
        )
      `)
      .eq('user_id', supabaseUserId)
      .eq('active', true);
    
    if (storeError) {
      console.error('❌ Store allocation lookup failed:', storeError);
      return;
    }
    
    console.log('✅ Store allocations loaded:', storeData?.length || 0);
    const stores = storeData?.map(allocation => ({
      id: allocation.stores.id,
      store_code: allocation.stores.store_code,
      store_name: allocation.stores.store_name,
      region: allocation.stores.region
    })) || [];
    
    stores.forEach(store => {
      console.log(`  - ${store.store_code}: ${store.store_name} (ID: ${store.id})`);
    });
    
    // Step 3: Load current week
    const { data: weekData, error: weekError } = await supabase
      .from('week_selections')
      .select('*')
      .eq('is_current', true)
      .single();
    
    if (weekError) {
      console.error('❌ Current week lookup failed:', weekError);
      return;
    }
    
    console.log('✅ Current week loaded:', weekData.week_reference);
    
    // Step 4: Load weekly plan data (this is what loadMultiStoreData does)
    const { data: planData, error: planError } = await supabase
      .from('weekly_plan')
      .select('*')
      .in('store_name', stores.map(s => s.store_name))
      .eq('reference', weekData.week_reference)
      .order('store_name, category, sub_category, stock_code');
    
    if (planError) {
      console.error('❌ Weekly plan data lookup failed:', planError);
      return;
    }
    
    console.log('✅ Weekly plan data loaded:', planData?.length || 0);
    
    // Group by store and category
    const storeBreakdown = {};
    const categoryBreakdown = {};
    
    planData?.forEach(item => {
      // Store breakdown
      if (!storeBreakdown[item.store_name]) {
        storeBreakdown[item.store_name] = 0;
      }
      storeBreakdown[item.store_name]++;
      
      // Category breakdown
      if (!categoryBreakdown[item.category]) {
        categoryBreakdown[item.category] = 0;
      }
      categoryBreakdown[item.category]++;
    });
    
    console.log('\n📊 Store breakdown:');
    Object.entries(storeBreakdown).forEach(([storeName, count]) => {
      console.log(`  - ${storeName}: ${count} items`);
    });
    
    console.log('\n📊 Category breakdown:');
    Object.entries(categoryBreakdown).forEach(([category, count]) => {
      console.log(`  - ${category}: ${count} items`);
    });
    
    // Step 5: Test the exact queries the interface uses for amendments
    // Note: The interface looks for amendments by weekly_plan_id, not store_name
    const weeklyPlanIds = planData?.map(item => item.id) || [];
    
    if (weeklyPlanIds.length > 0) {
      const { data: amendmentData, error: amendmentError } = await supabase
        .from('weekly_plan_amendments')
        .select('*')
        .in('weekly_plan_id', weeklyPlanIds.slice(0, 100)) // Limit to first 100 for testing
        .order('created_at', { ascending: false });
      
      if (amendmentError) {
        console.error('❌ Amendment lookup failed:', amendmentError);
      } else {
        console.log('✅ Amendments loaded:', amendmentData?.length || 0);
      }
    }
    
    console.log('\n🎉 Area manager login simulation completed successfully!');
    console.log('The Area Manager Interface should work with this data.');
    
  } catch (error) {
    console.error('❌ Error simulating area manager login:', error.message);
    console.error('Full error:', error);
  }
}

simulateAreaManagerLogin();