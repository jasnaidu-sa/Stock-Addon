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

async function createAreaManager() {
  console.log('Creating area manager user...');
  
  try {
    const clerkId = 'user_2zxXdO3yTLseO3QM7Euy5wkEFdc';
    const email = 'areamanager@thebedshop.co.za';
    
    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', clerkId)
      .single();
    
    if (existingUser) {
      console.log('Area manager user already exists:', existingUser);
      return;
    }
    
    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }
    
    // Create the area manager user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert([
        {
          clerk_id: clerkId,
          email: email,
          name: 'Area Manager',
          role: 'regional_manager'
        }
      ])
      .select()
      .single();
    
    if (userError) {
      throw userError;
    }
    
    console.log('Area manager user created successfully:', userData);
    
    // Get available stores to assign to area manager
    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('id, store_code, store_name, region')
      .order('store_code');
    
    if (storesError) {
      throw storesError;
    }
    
    console.log('Available stores:', stores?.length || 0);
    
    if (stores && stores.length > 0) {
      // Assign first 3 stores to the area manager for testing
      const storesToAssign = stores.slice(0, 3);
      
      const allocations = storesToAssign.map(store => ({
        user_id: userData.id,
        store_id: store.id,
        active: true
      }));
      
      const { error: allocationError } = await supabase
        .from('regional_manager_store_allocations')
        .insert(allocations);
      
      if (allocationError) {
        throw allocationError;
      }
      
      console.log('Store allocations created successfully:');
      storesToAssign.forEach(store => {
        console.log(`- ${store.store_code}: ${store.store_name}`);
      });
    }
    
    console.log('Area manager setup completed successfully!');
    
  } catch (error) {
    console.error('Error creating area manager:', error.message);
    console.error('Full error:', error);
  }
}

createAreaManager();