import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import minimist from 'minimist';

// Parse command line arguments
const argv = minimist(process.argv.slice(2), {
  string: ['email', 'password', 'name'],
  alias: { e: 'email', p: 'password', n: 'name' }
});

// Check if required arguments are provided
if (!argv.email || !argv.password) {
  console.error('Usage: node create-admin.js --email=admin@example.com --password=secure_password [--name="Admin Name"]');
  process.exit(1);
}

// Set defaults
const adminEmail = argv.email;
const adminPassword = argv.password;
const adminName = argv.name || 'Admin User';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Use the SERVICE_ROLE_KEY for admin operations
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials (URL or Service Key). Please check your .env file.');
  process.exit(1);
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(adminEmail)) {
  console.error('Invalid email format. Please provide a valid email address.');
  process.exit(1);
}

// Validate password length
if (adminPassword.length < 6) {
  console.error('Password must be at least 6 characters long.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAdminUser() {
  console.log(`Creating admin user with email: ${adminEmail}...`);
  
  try {
    // Create the user with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email: adminEmail,
      password: adminPassword,
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
        email: adminEmail,
        name: adminName,
        role: 'admin',
        status: 'active',
        created_at: new Date().toISOString()
      }
    ]);
    
    if (roleError) {
      throw roleError;
    }
    
    console.log('Admin role set successfully!');
    console.log(`Admin user ${adminName} (${adminEmail}) created successfully.`);
  } catch (error) {
    console.error('Error creating admin user:', error.message);
    process.exit(1);
  }
}

createAdminUser();