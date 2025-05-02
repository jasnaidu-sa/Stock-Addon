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

async function updateAdminRole() {
  console.log('Updating user role to admin...');
  
  try {
    // Sign in as the user
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'jasothan.naidu@gmail.com',
      password: 'priyen'
    });
    
    if (signInError) {
      throw signInError;
    }
    
    if (!signInData?.user) {
      throw new Error('Failed to sign in as user');
    }
    
    console.log('Successfully signed in as:', signInData.user.email);
    
    // Check if user exists in users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'jasothan.naidu@gmail.com');
    
    if (userError) {
      throw userError;
    }
    
    if (!userData || userData.length === 0) {
      console.log('User not found in database, creating new entry...');
      // Insert user with admin role
      const { error: insertError } = await supabase.from('users').insert([
        {
          id: signInData.user.id,
          email: 'jasothan.naidu@gmail.com',
          name: 'Admin User',
          role: 'admin'
        }
      ]);
      
      if (insertError) {
        throw insertError;
      }
      
      console.log('User created with admin role successfully!');
    } else {
      console.log('User found in database, updating role to admin...');
      // Update role to admin
      const { error: updateError } = await supabase
        .from('users')
        .update({ role: 'admin' })
        .eq('email', 'jasothan.naidu@gmail.com');
      
      if (updateError) {
        throw updateError;
      }
      
      console.log('User role updated to admin successfully!');
    }
    
    // Sign out
    await supabase.auth.signOut();
    console.log('Signed out successfully');
    
  } catch (error) {
    console.error('Error updating admin role:', error.message);
  }
}

updateAdminRole(); 