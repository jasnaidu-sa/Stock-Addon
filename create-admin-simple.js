import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const ADMIN_EMAIL = 'jasothan.naidu@gmail.com';
const ADMIN_PASSWORD = 'priyen';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdminUser() {
  console.log('Creating admin user...');

  try {
    // Step 1: Create user in auth system
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    if (authError) {
      console.error('Auth error:', authError.message);
      
      // Try to login instead (if user already exists)
      console.log('Trying to login...');
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      });

      if (signInError) {
        console.error('Login error:', signInError.message);
        return;
      }

      console.log('Login successful!', signInData.user.id);
      
      // Check if user exists in users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', ADMIN_EMAIL);
      
      if (userError) {
        console.error('Database error:', userError.message);
        return;
      }
      
      if (!userData || userData.length === 0) {
        // Create user in database
        console.log('Creating user in database...');
        const { error: insertError } = await supabase
          .from('users')
          .insert([{
            id: signInData.user.id,
            email: ADMIN_EMAIL,
            name: 'Admin User',
            role: 'admin'
          }]);
        
        if (insertError) {
          console.error('Error creating user in database:', insertError.message);
          return;
        }
        
        console.log('User created in database with admin role!');
      } else {
        // Update user role to admin
        console.log('Updating user role to admin...');
        const { error: updateError } = await supabase
          .from('users')
          .update({ role: 'admin' })
          .eq('email', ADMIN_EMAIL);
        
        if (updateError) {
          console.error('Error updating role:', updateError.message);
          return;
        }
        
        console.log('User role updated to admin!');
      }
      
      return;
    }

    console.log('User created in auth system:', authData.user.id);

    // Step 2: Create user in database with admin role
    const { error: insertError } = await supabase
      .from('users')
      .insert([{
        id: authData.user.id,
        email: ADMIN_EMAIL,
        name: 'Admin User',
        role: 'admin'
      }]);
    
    if (insertError) {
      console.error('Error creating user in database:', insertError.message);
      return;
    }
    
    console.log('User created in database with admin role!');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

createAdminUser(); 