-- Fix infinite recursion in users table RLS policies
-- This script removes the problematic recursive policy and creates a non-recursive solution

-- First, drop all existing policies on the users table
DROP POLICY IF EXISTS "Allow users to view their own profile" ON users;
DROP POLICY IF EXISTS "Allow users to read their own data" ON users;
DROP POLICY IF EXISTS "Allow authenticated users to read their own data" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Allow user to read own profile" ON users;
DROP POLICY IF EXISTS "Allow user to update own profile" ON users;
DROP POLICY IF EXISTS "Enable read access for own profile" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

-- Create a helper function that extracts user role from JWT without querying users table
-- This avoids recursion by using the JWT payload directly
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS text AS $$
BEGIN
  -- Extract role from JWT custom claims or return null if not found
  RETURN COALESCE(
    auth.jwt() ->> 'user_role',
    auth.jwt() -> 'app_metadata' ->> 'role',
    'customer'  -- default role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if current user has management privileges
CREATE OR REPLACE FUNCTION auth.is_manager()
RETURNS boolean AS $$
BEGIN
  RETURN auth.user_role() IN ('admin', 'regional_manager', 'area_manager', 'store_manager');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if current user is admin or regional manager
CREATE OR REPLACE FUNCTION auth.is_admin_or_regional()
RETURNS boolean AS $$
BEGIN
  RETURN auth.user_role() IN ('admin', 'regional_manager');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create non-recursive RLS policies for users table
-- Policy 1: Users can read their own data OR managers can read all user data
CREATE POLICY "users_select_policy" ON users
  FOR SELECT
  USING (
    -- User can read their own record
    (auth.jwt() ->> 'sub') = clerk_id
    OR 
    -- Managers can read all user records
    auth.is_manager()
  );

-- Policy 2: Users can insert their own data OR admins/regional managers can insert any user data
CREATE POLICY "users_insert_policy" ON users
  FOR INSERT
  WITH CHECK (
    -- User can insert their own record
    (auth.jwt() ->> 'sub') = clerk_id
    OR 
    -- Admins and regional managers can insert any user record
    auth.is_admin_or_regional()
  );

-- Policy 3: Users can update their own data OR admins/regional managers can update any user data
CREATE POLICY "users_update_policy" ON users
  FOR UPDATE
  USING (
    -- User can update their own record
    (auth.jwt() ->> 'sub') = clerk_id
    OR 
    -- Admins and regional managers can update any user record
    auth.is_admin_or_regional()
  );

-- Policy 4: Only admins can delete users
CREATE POLICY "users_delete_policy" ON users
  FOR DELETE
  USING (auth.user_role() = 'admin');

-- Make sure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Verify the policies were created correctly
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'users';