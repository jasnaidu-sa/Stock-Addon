const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cfjvskafvcljvxnawccs.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmanZza2FmdmNsanZ4bmF3Y2NzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDYzNzM4NCwiZXhwIjoyMDU2MjEzMzg0fQ.VQjNNb7nBpgJWKoLlKhZvNJKOGnOGnOGnOGnOGnOGnOGnO'; // You'll need the service role key

// Note: Replace with your actual service role key from Supabase dashboard
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function debugUsers() {
  try {
    console.log('🔍 Checking users in database...');
    
    // Get all users from database
    const { data: dbUsers, error: dbError } = await supabase
      .from('users')
      .select('id, email, name, role, status, created_at')
      .order('name');
    
    if (dbError) {
      console.error('❌ Error fetching database users:', dbError);
      return;
    }
    
    console.log('\n📊 Database Users:');
    dbUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email})`);
      console.log(`   - ID: ${user.id}`);
      console.log(`   - Role: ${user.role}`);
      console.log(`   - Status: ${user.status}`);
      console.log(`   - Created: ${new Date(user.created_at).toLocaleDateString()}`);
      console.log('');
    });
    
    // Check auth users
    console.log('🔐 Checking Supabase Auth users...');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return;
    }
    
    console.log('\n🔑 Auth Users:');
    authUsers.users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   - Auth ID: ${user.id}`);
      console.log(`   - Email Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
      console.log(`   - Last Sign In: ${user.last_sign_in_at || 'Never'}`);
      console.log('');
    });
    
    // Find Charlene specifically
    const charlene = dbUsers.find(user => user.name.toLowerCase().includes('charlene') || user.email.toLowerCase().includes('charlene'));
    
    if (charlene) {
      console.log('👤 Found Charlene in database:');
      console.log(`   - Name: ${charlene.name}`);
      console.log(`   - Email: ${charlene.email}`);
      console.log(`   - Status: ${charlene.status}`);
      console.log(`   - Role: ${charlene.role}`);
      
      const authCharlene = authUsers.users.find(user => user.email === charlene.email);
      if (authCharlene) {
        console.log('✅ Charlene exists in auth system');
        console.log(`   - Auth ID: ${authCharlene.id}`);
        console.log(`   - Email Confirmed: ${authCharlene.email_confirmed_at ? 'Yes' : 'No'}`);
      } else {
        console.log('❌ Charlene NOT found in auth system - this is the problem!');
        console.log('💡 Solution: Create auth user for Charlene or reset password');
      }
    } else {
      console.log('❌ Charlene not found in database');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function resetCharlenePassword() {
  try {
    const charleneEmail = 'charlene@example.com'; // Update with actual email
    const newPassword = 'charlene123'; // Temporary password
    
    console.log(`🔄 Resetting password for ${charleneEmail}...`);
    
    // First try to update existing auth user
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const existingUser = authUsers.users.find(user => user.email === charleneEmail);
    
    if (existingUser) {
      const { error } = await supabase.auth.admin.updateUserById(existingUser.id, {
        password: newPassword
      });
      
      if (error) {
        console.error('❌ Error updating password:', error);
      } else {
        console.log('✅ Password updated successfully!');
        console.log(`📧 Email: ${charleneEmail}`);
        console.log(`🔑 New Password: ${newPassword}`);
      }
    } else {
      console.log('❌ User not found in auth system');
      console.log('💡 Use the admin panel to create the user first');
    }
    
  } catch (error) {
    console.error('❌ Error resetting password:', error);
  }
}

// Run the debug
debugUsers();

// Uncomment to reset Charlene's password:
// resetCharlenePassword(); 