# Create Admin User: cventer@thebedshop.co.za

This document provides multiple methods to create an admin user with the email `cventer@thebedshop.co.za` in your Supabase database.

## User Details
- **Email**: cventer@thebedshop.co.za
- **Name**: C. Venter
- **Role**: admin
- **Default Password**: admin123 (should be changed after first login)

## Method 1: Web-Based Tool (Recommended)

1. Open your browser and navigate to: `project/public/create-admin-user.html`
2. The form will be pre-filled with the user details
3. Click "Create Admin User" to create a new user
4. If the user already exists, click "Update Existing User to Admin"
5. Follow the on-screen instructions

## Method 2: JavaScript Script

Run the Node.js script:

```bash
cd project
node create-cventer-admin.js
```

This script will:
- Attempt to create the user via Supabase Auth
- Create the user profile in the database
- Handle cases where the user already exists

## Method 3: SQL Script (Supabase Dashboard)

If the JavaScript methods fail, use the SQL script:

1. Open your Supabase dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `create-cventer-admin.sql`
4. Run the script step by step
5. Note the user ID from the first query and use it in subsequent queries

## Method 4: Manual Creation (Supabase Dashboard)

### Step 1: Create User in Auth
1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User"
3. Enter:
   - Email: cventer@thebedshop.co.za
   - Password: admin123
   - Confirm Password: admin123
4. Click "Create User"

### Step 2: Add User to Database
1. Go to Supabase Dashboard → Table Editor → users table
2. Click "Insert" → "Insert row"
3. Enter:
   - id: (copy the UUID from the auth user you just created)
   - email: cventer@thebedshop.co.za
   - name: C. Venter
   - role: admin
4. Click "Save"

## Verification

After creating the user, verify the setup:

1. **Check Authentication**: Try logging in with the credentials
2. **Check Database**: Verify the user exists in the `users` table with role `admin`
3. **Check Admin Access**: Log in and verify admin features are accessible

## Troubleshooting

### "Database error saving new user"
- This usually indicates a schema issue or permission problem
- Try Method 3 (SQL Script) or Method 4 (Manual Creation)

### "User already registered"
- The user exists in auth but may not have a profile
- Use the "Update Existing User to Admin" button in the web tool
- Or run the update script

### "Invalid API key"
- Check that the Supabase URL and anon key are correct
- Verify the keys in `public/env-config.js`

### Permission Denied
- Ensure RLS policies allow user creation
- Check that the `users` table has proper policies
- May need to temporarily disable RLS for user creation

## Security Notes

1. **Change Default Password**: The default password `admin123` should be changed immediately after first login
2. **Strong Password Policy**: Implement a strong password policy for admin users
3. **Two-Factor Authentication**: Consider enabling 2FA for admin accounts
4. **Regular Audits**: Regularly audit admin user access and permissions

## Files Created

- `create-cventer-admin.js` - Node.js script for user creation
- `create-cventer-admin.sql` - SQL script for manual creation
- `public/create-admin-user.html` - Web-based creation tool
- `CREATE_ADMIN_USER.md` - This documentation

## Next Steps

After successfully creating the admin user:

1. Test login functionality
2. Verify admin dashboard access
3. Change the default password
4. Set up any additional admin-specific configurations
5. Document the admin user credentials securely

## Support

If you encounter issues with any of these methods:

1. Check the browser console for detailed error messages
2. Verify Supabase connection and credentials
3. Check database schema and RLS policies
4. Contact your database administrator if needed 