import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdminUser() {
  console.log('Creating admin user...');
  
  try {
    // Create the user with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email: 'jasothan.naidu@gmail.com',
      password: 'priyen',
      options: {
        data: {
          role: 'admin'
        }
      }
    });
    
    if (error) {
      throw error;
    }
    
    if (!data.user) {
      throw new Error('No user data returned');
    }
    
    console.log('User created successfully:', data.user.id);
    
    // Set role in the 'users' table
    const { error: roleError } = await supabase.from('users').insert([
      {
        id: data.user.id,
        email: 'jasothan.naidu@gmail.com',
        name: 'Admin User',
        role: 'admin'
      }
    ]);
    
    if (roleError) {
      throw roleError;
    }
    
    console.log('Admin role set successfully!');
  } catch (error) {
    console.error('Error creating admin user:', error.message);
  }
}

createAdminUser(); 