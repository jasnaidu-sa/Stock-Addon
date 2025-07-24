# Users Table RLS Recursion Fix

## Problem Description

The users table had infinite recursion issues in its Row Level Security (RLS) policies. The policies were trying to check user roles by querying the users table itself, creating a circular reference:

```sql
-- PROBLEMATIC CODE (caused infinite recursion)
CREATE POLICY "Users can read own data" ON users
    FOR SELECT
    USING (
        auth.uid() = id OR 
        EXISTS (
            SELECT 1 FROM users  -- <-- This queries users table from within users table policy!
            WHERE id = auth.uid() 
            AND role IN ('admin', 'regional_manager', 'area_manager', 'store_manager')
        )
    );
```

## Root Cause

When a user tries to access the users table, PostgreSQL:
1. Checks the RLS policy for the users table
2. The policy tries to verify user roles by querying the users table
3. This triggers another RLS policy check on the users table
4. Step 2 repeats infinitely, causing a stack overflow

## Solution

The fix involves creating helper functions that extract user information directly from the JWT token without querying the users table:

### 1. Helper Functions

```sql
-- Extract user role from JWT token
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS text AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := COALESCE(
    auth.jwt() ->> 'user_role',
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );
  
  IF jwt_role IS NOT NULL THEN
    RETURN jwt_role;
  END IF;
  
  RETURN 'customer';  -- default role
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user has management privileges
CREATE OR REPLACE FUNCTION auth.is_manager()
RETURNS boolean AS $$
BEGIN
  RETURN auth.user_role() IN ('admin', 'regional_manager', 'area_manager', 'store_manager');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is admin or regional manager
CREATE OR REPLACE FUNCTION auth.is_admin_or_regional()
RETURNS boolean AS $$
BEGIN
  RETURN auth.user_role() IN ('admin', 'regional_manager');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get current user's Clerk ID from JWT
CREATE OR REPLACE FUNCTION auth.current_user_clerk_id()
RETURNS text AS $$
DECLARE
  user_id text;
BEGIN
  user_id := auth.jwt() ->> 'sub';
  RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bootstrap admin check for initial setup
CREATE OR REPLACE FUNCTION auth.is_bootstrap_admin()
RETURNS boolean AS $$
DECLARE
  user_email text;
BEGIN
  user_email := auth.jwt() ->> 'email';
  RETURN COALESCE(user_email = 'jnaidu@thebedshop.co.za', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Non-Recursive RLS Policies

```sql
-- Users can read their own data OR managers can read all data
CREATE POLICY "users_select_policy" ON users
  FOR SELECT
  USING (
    auth.current_user_clerk_id() = clerk_id
    OR 
    auth.is_manager()
    OR
    auth.is_bootstrap_admin()
  );

-- Users can insert their own data OR admins/regional managers can insert any data
CREATE POLICY "users_insert_policy" ON users
  FOR INSERT
  WITH CHECK (
    auth.current_user_clerk_id() = clerk_id
    OR 
    auth.is_admin_or_regional()
    OR
    auth.is_bootstrap_admin()
  );

-- Users can update their own data OR admins/regional managers can update any data
CREATE POLICY "users_update_policy" ON users
  FOR UPDATE
  USING (
    auth.current_user_clerk_id() = clerk_id
    OR 
    auth.is_admin_or_regional()
    OR
    auth.is_bootstrap_admin()
  );

-- Only admins can delete users
CREATE POLICY "users_delete_policy" ON users
  FOR DELETE
  USING (
    auth.user_role() = 'admin'
    OR
    auth.is_bootstrap_admin()
  );
```

## Key Benefits

1. **No Recursion**: Helper functions use JWT data directly, avoiding database queries
2. **Performance**: JWT-based checks are faster than database queries
3. **Security**: Functions are marked as `SECURITY DEFINER` and use safe JWT extraction
4. **Flexibility**: Supports role-based access control for different user types
5. **Bootstrap Support**: Includes fallback for initial admin setup

## Migration Applied

The fix is implemented in migration: `20250716_002_fix_users_rls_recursion.sql`

## Testing

Run the test script to verify the fix:
```bash
psql -f test_users_rls_fix.sql
```

## Important Notes

1. **JWT Token Structure**: The solution assumes that user role information is stored in the JWT token under one of these paths:
   - `auth.jwt() ->> 'user_role'`
   - `auth.jwt() -> 'app_metadata' ->> 'role'`
   - `auth.jwt() -> 'user_metadata' ->> 'role'`

2. **Bootstrap Admin**: The `jnaidu@thebedshop.co.za` email is hardcoded as a bootstrap admin for initial setup. This should be updated in production.

3. **Default Role**: Users without role information in JWT default to 'customer' role.

4. **Other Tables**: The fix also updates policies on `orders` and `stores` tables that had similar recursive issues.

## Files Modified

- `fix_users_rls_recursion.sql` - Updated with comprehensive solution
- `supabase/migrations/20250716_002_fix_users_rls_recursion.sql` - New migration
- `test_users_rls_fix.sql` - Test script to verify the fix

## Next Steps

1. Run the migration in your Supabase instance
2. Test the RLS policies with different user roles
3. Update your application to ensure JWT tokens contain role information
4. Monitor for any performance improvements