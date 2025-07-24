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

async function updateAreaManagerRole() {
  console.log('Updating area manager role...');
  
  try {
    const clerkId = 'user_2zxXdO3yTLseO3QM7Euy5wkEFdc';
    
    // Update the user role to regional_manager
    const { data: userData, error: userError } = await supabase
      .from('users')
      .update({ role: 'regional_manager' })
      .eq('clerk_id', clerkId)
      .select()
      .single();
    
    if (userError) {
      throw userError;
    }
    
    console.log('Area manager role updated successfully:', userData);
    
    // Check if user has store allocations
    const { data: allocations, error: allocationError } = await supabase
      .from('regional_manager_store_allocations')
      .select(`
        *,
        stores:store_id (
          store_code,
          store_name,
          region
        )
      `)
      .eq('user_id', userData.id)
      .eq('active', true);
    
    if (allocationError) {
      throw allocationError;
    }
    
    console.log('Current store allocations:', allocations?.length || 0);
    
    if (allocations && allocations.length > 0) {
      console.log('Allocated stores:');
      allocations.forEach(allocation => {
        console.log(`- ${allocation.stores.store_code}: ${allocation.stores.store_name} (${allocation.stores.region})`);
      });
    } else {
      console.log('No store allocations found. Creating some for testing...');
      
      // Get available stores
      const { data: stores, error: storesError } = await supabase
        .from('stores')
        .select('id, store_code, store_name, region')
        .order('store_code')
        .limit(3);
      
      if (storesError) {
        throw storesError;
      }
      
      if (stores && stores.length > 0) {
        const allocationsToCreate = stores.map(store => ({
          user_id: userData.id,
          store_id: store.id,
          active: true
        }));
        
        const { error: createAllocationError } = await supabase
          .from('regional_manager_store_allocations')
          .insert(allocationsToCreate);
        
        if (createAllocationError) {
          throw createAllocationError;
        }
        
        console.log('Store allocations created successfully:');
        stores.forEach(store => {
          console.log(`- ${store.store_code}: ${store.store_name} (${store.region})`);
        });
      }
    }
    
    console.log('Area manager setup completed successfully!');
    
  } catch (error) {
    console.error('Error updating area manager:', error.message);
    console.error('Full error:', error);
  }
}

updateAreaManagerRole();