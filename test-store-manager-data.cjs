const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cfjvskafvcljvxnawccs.supabase.co';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testStoreManagerData() {
  const sarahId = '981bb319-99e6-48ff-bec7-8b0290e4f98b';
  
  console.log('=== Testing Store Manager Interface Data ===');
  
  // Step 1: Get current week (is_current = true)
  console.log('\n1. Getting current week...');
  const { data: weekData, error: weekError } = await supabase
    .from('week_selections')
    .select('*')
    .eq('is_current', true)
    .single();
  
  if (weekError) {
    console.error('Week error:', weekError);
    return;
  }
  
  console.log('✓ Current week:', weekData.week_reference);
  
  // Step 2: Get store assignment for Sarah
  console.log('\n2. Getting store assignment...');
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
    console.error('Store error:', storeError);
    return;
  }
  
  console.log('✓ Store assignment:', storeData.stores.store_name);
  
  // Step 3: Get weekly plan data
  console.log('\n3. Getting weekly plan data...');
  const { data: planData, error: planError } = await supabase
    .from('weekly_plan')
    .select('*')
    .eq('store_name', storeData.stores.store_name)
    .eq('reference', weekData.week_reference)
    .order('category, stock_code');
  
  if (planError) {
    console.error('Plan error:', planError);
    return;
  }
  
  console.log('✓ Weekly plan items:', planData.length);
  
  // Group by category
  const categoryMap = new Map();
  planData.forEach((item) => {
    const category = item.category || 'other';
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category).push(item);
  });
  
  console.log('\n4. Categories:');
  for (const [category, items] of categoryMap.entries()) {
    console.log(`   ${category}: ${items.length} items`);
  }
  
  console.log('\n✅ Store Manager Interface should work with this data!');
}

testStoreManagerData().catch(console.error);