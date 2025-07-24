// Create Sarah Johnson properly using the admin interface
// This script simulates what happens when an admin creates a user through the UI

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cfjvskafvcljvxnawccs.supabase.co';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createSarahProperlyWithAdminAuth() {
  try {
    console.log('Step 1: Getting Sarah Johnson\'s current info from Supabase...');
    
    // Get Sarah's current info
    const { data: sarahData, error: sarahError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'manager.somersetwest@company.com')
      .single();

    if (sarahError) {
      console.error('Error finding Sarah Johnson:', sarahError);
      return;
    }

    console.log('Found Sarah Johnson:', sarahData);

    // Check if she already has a clerk_id
    if (sarahData.clerk_id) {
      console.log('Sarah Johnson already has a Clerk ID:', sarahData.clerk_id);
      
      // Just update her status to active
      const { error: updateError } = await supabase
        .from('users')
        .update({ status: 'active' })
        .eq('id', sarahData.id);

      if (updateError) {
        console.error('Error updating Sarah Johnson status:', updateError);
      } else {
        console.log('Successfully updated Sarah Johnson status to active');
      }
      return;
    }

    console.log('Step 2: Sarah Johnson needs to be created in Clerk...');
    
    // Since she doesn't have a clerk_id, we need to:
    // 1. Create her in Clerk
    // 2. Update her record in Supabase with the clerk_id
    // 3. Set her status to active
    
    // We'll need to do this manually since we need admin auth
    console.log('Sarah Johnson needs to be created in Clerk through the admin interface.');
    console.log('Her current details are:');
    console.log('- Email:', sarahData.email);
    console.log('- Name:', sarahData.first_name, sarahData.last_name);
    console.log('- Role:', sarahData.role);
    console.log('- Group Type:', sarahData.group_type);
    console.log('- Status:', sarahData.status);
    
    // For now, let's just update her to active status in Supabase
    // An admin will need to create her Clerk account through the UI
    const { error: updateError } = await supabase
      .from('users')
      .update({ status: 'active' })
      .eq('id', sarahData.id);

    if (updateError) {
      console.error('Error updating Sarah Johnson status:', updateError);
    } else {
      console.log('Successfully updated Sarah Johnson status to active');
      console.log('NOTE: An admin still needs to create her Clerk account through the admin interface');
    }

    // Let's also check if she has store assignments
    const { data: assignments, error: assignError } = await supabase
      .from('store_manager_assignments')
      .select(`
        *,
        stores!inner(store_code, store_name, region)
      `)
      .eq('store_manager_id', sarahData.id);

    if (assignError) {
      console.error('Error checking store assignments:', assignError);
    } else {
      console.log('Sarah Johnson\'s store assignments:', assignments);
    }

  } catch (error) {
    console.error('Error in createSarahProperlyWithAdminAuth:', error);
  }
}

createSarahProperlyWithAdminAuth();