import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://cfjvskafvcljvxnawccs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmanZza2FmdmNsanZ4bmF3Y2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2MzczODQsImV4cCI6MjA1NjIxMzM4NH0.0kEvw4fWwp0Qw2fSXtmvcstZK3pYhS2yXiS0h68DEx0';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin user details
const adminUser = {
  email: 'cventer@thebedshop.co.za',
  password: 'TempPassword123!', // Change this after first login
  name: 'C. Venter',
  role: 'admin',
  group_type: 'Regional',
  company_name: 'The Bed Shop',
  status: 'active'
};

async function createAdminUser() {
  try {
    console.log('🚀 Starting admin user creation process...');
    console.log('📧 Email:', adminUser.email);
    
    // Check if user already exists in the database
    console.log('🔍 Checking if user already exists...');
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('email, role')
      .eq('email', adminUser.email)
      .limit(1);
      
    if (checkError) {
      console.error('❌ Error checking existing user:', checkError);
      throw checkError;
    }
    
    if (existingUsers && existingUsers.length > 0) {
      console.log('👤 User already exists in database');
      const existingUser = existingUsers[0];
      
      if (existingUser.role === 'admin') {
        console.log('✅ User is already an admin. No action needed.');
        return;
      } else {
        console.log('🔄 User exists but is not admin. Updating role...');
        const { error: updateError } = await supabase
          .from('users')
          .update({ role: 'admin' })
          .eq('email', adminUser.email);
          
        if (updateError) {
          console.error('❌ Error updating user role:', updateError);
          throw updateError;
        }
        
        console.log('✅ User role updated to admin successfully!');
        return;
      }
    }

    // Create user in Supabase Auth
    console.log('🔐 Creating user in authentication system...');
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: adminUser.email,
      password: adminUser.password,
      options: {
        data: {
          name: adminUser.name,
        },
        // Skip email confirmation - user can log in immediately
        emailRedirectTo: undefined
      }
    });

    if (authError) {
      console.error('❌ Error creating auth user:', authError);
      
      if (authError.message.includes('User already registered')) {
        console.log('👤 User already exists in auth system, trying to create database record...');
        
        // Try to get the user ID from auth
        const { data: { user }, error: getUserError } = await supabase.auth.getUser();
        if (getUserError || !user) {
          throw new Error('User exists in auth but cannot retrieve user data. Please create manually through the admin panel.');
        }
        
        // Create database record with existing auth user ID
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: adminUser.email,
            name: adminUser.name,
            role: adminUser.role,
            group_type: adminUser.group_type,
            company_name: adminUser.company_name,
            status: adminUser.status
          });
          
        if (insertError) {
          console.error('❌ Error creating database record:', insertError);
          throw insertError;
        }
        
        console.log('✅ Database record created for existing auth user!');
        return;
      }
      
      throw authError;
    }

    if (!authData.user) {
      throw new Error('Failed to create user in authentication system');
    }

    console.log('✅ Auth user created with ID:', authData.user.id);
    
    // Create user record in database
    console.log('💾 Creating user record in database...');
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
        group_type: adminUser.group_type,
        company_name: adminUser.company_name,
        status: adminUser.status,
        email_confirmed_at: new Date().toISOString() // Mark email as confirmed
      });
      
    if (insertError) {
      console.error('❌ Error creating database record:', insertError);
      console.log('🧹 Attempting to clean up auth user...');
      
      // Try to clean up the auth user (may not work without service role key)
      try {
        await supabase.auth.admin.deleteUser(authData.user.id);
        console.log('✅ Auth user cleaned up');
      } catch (cleanupError) {
        console.warn('⚠️ Could not clean up auth user (this may be expected)');
      }
      
      throw insertError;
    }
    
    console.log('✅ Admin user created successfully!');
    console.log('');
    console.log('📋 User Details:');
    console.log('   Email:', adminUser.email);
    console.log('   Name:', adminUser.name);
    console.log('   Role:', adminUser.role);
    console.log('   Password:', adminUser.password);
    console.log('');
    console.log('🔒 IMPORTANT: Please change the password after first login!');
    console.log('🌐 You can now log in at your application\'s login page.');
    
  } catch (error) {
    console.error('❌ Failed to create admin user:', error.message);
    console.log('');
    console.log('💡 Alternative options:');
    console.log('1. Use the web-based admin creation tool at /public/create-admin-user.html');
    console.log('2. Create the user manually through the admin panel if you have access');
    console.log('3. Check the database directly and update an existing user\'s role to "admin"');
    process.exit(1);
  }
}

// Run the script
createAdminUser(); 