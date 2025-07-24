// Test the Store Manager Interface fix
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cfjvskafvcljvxnawccs.supabase.co';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testStoreManagerFix() {
  const sarahId = '981bb319-99e6-48ff-bec7-8b0290e4f98b';
  
  console.log('=== Testing Store Manager Interface Fix ===');
  
  // Test the exact sequence that the Store Manager Interface uses
  console.log('\n1. Testing user lookup with Sarah\'s ID...');
  
  // First, verify Sarah exists (UUID format)
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('id', sarahId)
    .single();
  
  if (userError) {
    console.error('User lookup error:', userError);
    return;
  }
  
  console.log('✓ User found:', userData.id);
  
  // Test store assignment lookup
  console.log('\n2. Testing store assignment lookup...');
  const { data: storeData, error: storeError } = await supabase
    .from('store_manager_assignments')
    .select(`
      stores!inner(
        id,
        store_code,
        store_name,
        region
      )
    `)
    .eq('store_manager_id', sarahId)
    .eq('status', 'active')
    .single();
  
  if (storeError) {
    console.error('Store assignment error:', storeError);
    return;
  }
  
  console.log('✓ Store assignment found:', storeData.stores.store_name);
  
  // Test current week lookup
  console.log('\n3. Testing current week lookup...');
  const { data: weekData, error: weekError } = await supabase
    .from('week_selections')
    .select('*')
    .eq('is_current', true)
    .single();
  
  if (weekError) {
    console.error('Week lookup error:', weekError);
    return;
  }
  
  console.log('✓ Current week found:', weekData.week_reference);
  
  // Test weekly plan data lookup
  console.log('\n4. Testing weekly plan data lookup...');
  const { data: planData, error: planError } = await supabase
    .from('weekly_plan')
    .select('*')
    .eq('store_name', storeData.stores.store_name)
    .eq('reference', weekData.week_reference)
    .order('category, stock_code');
  
  if (planError) {
    console.error('Weekly plan error:', planError);
    return;
  }
  
  console.log('✓ Weekly plan data found:', planData.length, 'items');
  
  // Test amendments lookup
  console.log('\n5. Testing amendments lookup...');
  const { data: amendmentData, error: amendmentError } = await supabase
    .from('weekly_plan_amendments')
    .select('*')
    .eq('store_id', storeData.stores.id)
    .eq('week_reference', weekData.week_reference)
    .order('created_at', { ascending: false });
  
  if (amendmentError) {
    console.error('Amendment error:', amendmentError);
    return;
  }
  
  console.log('✓ Amendments found:', amendmentData.length, 'items');
  
  console.log('\n✅ All Store Manager Interface queries working correctly!');
  console.log('The fix should now properly show data for Sarah Johnson in test mode.');
}

testStoreManagerFix().catch(console.error);