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
const ADMIN_EMAIL = 'jasothan.naidu@gmail.com';

async function verifyAdmin() {
  try {
    console.log(`Checking admin status for user: ${ADMIN_EMAIL}`);
    
    // Check if user exists in auth
    const { data: authUser, error: authError } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: 'priyen'
    });
    
    if (authError) {
      console.error('Auth error:', authError.message);
      console.log('User may not exist in auth system or password incorrect.');
      return;
    }
    
    if (!authUser?.user) {
      console.error('No user found in auth system.');
      return;
    }
    
    console.log('User found in auth system:', authUser.user.id);
    
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
      console.log('User not found in users table. Creating entry...');
      
      // Insert user with admin role
      const { error: insertError } = await supabase
        .from('users')
        .insert([{
          id: authUser.user.id,
          email: ADMIN_EMAIL,
          name: 'Admin User',
          role: 'admin'
        }]);
      
      if (insertError) {
        console.error('Error creating user in database:', insertError.message);
        return;
      }
      
      console.log('User created with admin role!');
    } else {
      const user = userData[0];
      console.log('User found in database:', user);
      
      if (user.role !== 'admin') {
        console.log('User is not an admin. Updating role...');
        
        // Update role to admin
        const { error: updateError } = await supabase
          .from('users')
          .update({ role: 'admin' })
          .eq('id', user.id);
        
        if (updateError) {
          console.error('Error updating role:', updateError.message);
          return;
        }
        
        console.log('User role updated to admin!');
      } else {
        console.log('User already has admin role.');
      }
    }
    
    // Sign out
    await supabase.auth.signOut();
    console.log('Verification complete.');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

verifyAdmin(); 