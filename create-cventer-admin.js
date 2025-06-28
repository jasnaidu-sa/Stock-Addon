import { createClient } from '@supabase/supabase-js';

// Use the hardcoded credentials from env-config.js
const supabaseUrl = "https://cfjvskafvcljvxnawccs.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmanZza2FmdmNsanZ4bmF3Y2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2MzczODQsImV4cCI6MjA1NjIxMzM4NH0.0kEvw4fWwp0Qw2fSXtmvcstZK3pYhS2yXiS0h68DEx0";

const ADMIN_EMAIL = 'cventer@thebedshop.co.za';
const ADMIN_PASSWORD = 'admin123'; // You should change this to a secure password
const ADMIN_NAME = 'C. Venter';

console.log('Initializing Supabase client...');
const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdminUser() {
  console.log(`Creating admin user: ${ADMIN_EMAIL}...`);

  try {
    // Step 1: Try to sign up the user
    console.log('Attempting to sign up user...');
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      options: {
        data: {
          name: ADMIN_NAME,
          role: 'admin'
        }
      }
    });

    if (authError) {
      console.error('Auth error:', authError.message);
      
      // If user already exists, try to sign in and update their role
      if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
        console.log('User already exists. Attempting to sign in and update role...');
        
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD
        });

        if (signInError) {
          console.error('Sign in error:', signInError.message);
          console.log('The user exists but the password might be different.');
          console.log('Please either:');
          console.log('1. Use the correct password for this user');
          console.log('2. Reset the password in the Supabase dashboard');
          console.log('3. Use the SQL script (create-cventer-admin.sql) in the Supabase SQL editor');
          return;
        }

        console.log('Sign in successful!', signInData.user.id);
        
        // Now handle the user profile
        await handleUserProfile(signInData.user.id);
        
        // Sign out after setup
        await supabase.auth.signOut();
        console.log('Setup complete. User can now login with admin privileges.');
        return;
      } else {
        throw authError;
      }
    }

    if (!authData.user) {
      throw new Error('No user data returned from signup');
    }

    console.log('User created in auth system:', authData.user.id);
    
    // Handle the user profile
    await handleUserProfile(authData.user.id);
    
    console.log(`✅ Admin user ${ADMIN_EMAIL} has been successfully created!`);
    console.log(`📧 Email: ${ADMIN_EMAIL}`);
    console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
    console.log('⚠️  Please change the password after first login for security.');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.log('\n📝 Alternative approach:');
    console.log('If this script fails, you can use the SQL script instead:');
    console.log('1. Open your Supabase dashboard');
    console.log('2. Go to SQL Editor');
    console.log('3. Run the SQL commands from create-cventer-admin.sql');
  }
}

async function handleUserProfile(userId) {
  try {
    // Check if user exists in users table
    console.log('Checking if user profile exists...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', ADMIN_EMAIL);
    
    if (userError) {
      console.error('Database error:', userError.message);
      throw userError;
    }
    
    if (!userData || userData.length === 0) {
      // Create user in database
      console.log('Creating user profile in database...');
      const { error: insertError } = await supabase
        .from('users')
        .insert([{
          id: userId,
          email: ADMIN_EMAIL,
          name: ADMIN_NAME,
          role: 'admin'
        }]);
      
      if (insertError) {
        console.error('Error creating user profile:', insertError.message);
        throw insertError;
      }
      
      console.log('✅ User profile created with admin role!');
    } else {
      // Update user role to admin
      console.log('Updating existing user role to admin...');
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          role: 'admin',
          name: ADMIN_NAME 
        })
        .eq('email', ADMIN_EMAIL);
      
      if (updateError) {
        console.error('Error updating role:', updateError.message);
        throw updateError;
      }
      
      console.log('✅ User role updated to admin!');
    }
  } catch (error) {
    console.error('Error handling user profile:', error.message);
    throw error;
  }
}

// Run the function
console.log('🚀 Starting admin user creation process...');
createAdminUser().then(() => {
  console.log('✅ Script completed successfully.');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error.message);
  process.exit(1);
}); 