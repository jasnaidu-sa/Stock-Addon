/*
  # Fix Infinite Recursion in Users Table RLS Policies
  
  This migration fixes the infinite recursion issue in the users table RLS policies
  by creating helper functions that extract user role from JWT without querying
  the users table itself.
  
  The problem was that RLS policies were trying to query the users table to check
  roles, which creates a circular reference when applied to the users table.
  
  Solution:
  1. Create helper functions that extract role from JWT token
  2. Use these functions in RLS policies to avoid recursion
  3. Apply similar fixes to other tables that had recursive policies
*/

-- Drop all existing problematic policies on users table
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

-- Create helper functions that extract user role from JWT without querying users table
-- This avoids recursion by using the JWT payload directly
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS text AS $$
DECLARE
  jwt_role text;
BEGIN
  -- First try to extract role from JWT custom claims
  jwt_role := COALESCE(
    auth.jwt() ->> 'user_role',
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );
  
  -- If we found a role in JWT, return it
  IF jwt_role IS NOT NULL THEN
    RETURN jwt_role;
  END IF;
  
  -- If no role in JWT, return customer as default
  -- This handles cases where the JWT hasn't been updated with role information
  RETURN 'customer';
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

-- Create a function to get current user's clerk_id from JWT
CREATE OR REPLACE FUNCTION auth.current_user_clerk_id()
RETURNS text AS $$
DECLARE
  user_id text;
BEGIN
  -- Extract user ID from JWT
  user_id := auth.jwt() ->> 'sub';
  
  -- Return the user ID or null if not found
  RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to safely check if current user is a specific admin
CREATE OR REPLACE FUNCTION auth.is_bootstrap_admin()
RETURNS boolean AS $$
DECLARE
  user_email text;
BEGIN
  -- Get email from JWT
  user_email := auth.jwt() ->> 'email';
  
  -- Check if it's the bootstrap admin email
  RETURN COALESCE(user_email = 'jnaidu@thebedshop.co.za', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create non-recursive RLS policies for users table
-- Policy 1: Users can read their own data OR managers can read all user data
CREATE POLICY "users_select_policy" ON users
  FOR SELECT
  USING (
    -- User can read their own record
    auth.current_user_clerk_id() = clerk_id
    OR 
    -- Managers can read all user records (using JWT role check)
    auth.is_manager()
    OR
    -- Fallback: specific admin email for bootstrapping
    auth.is_bootstrap_admin()
  );

-- Policy 2: Users can insert their own data OR admins/regional managers can insert any user data
CREATE POLICY "users_insert_policy" ON users
  FOR INSERT
  WITH CHECK (
    -- User can insert their own record
    auth.current_user_clerk_id() = clerk_id
    OR 
    -- Admins and regional managers can insert any user record
    auth.is_admin_or_regional()
    OR
    -- Fallback: specific admin email for bootstrapping
    auth.is_bootstrap_admin()
  );

-- Policy 3: Users can update their own data OR admins/regional managers can update any user data
CREATE POLICY "users_update_policy" ON users
  FOR UPDATE
  USING (
    -- User can update their own record
    auth.current_user_clerk_id() = clerk_id
    OR 
    -- Admins and regional managers can update any user record
    auth.is_admin_or_regional()
    OR
    -- Fallback: specific admin email for bootstrapping
    auth.is_bootstrap_admin()
  );

-- Policy 4: Only admins can delete users
CREATE POLICY "users_delete_policy" ON users
  FOR DELETE
  USING (
    auth.user_role() = 'admin'
    OR
    -- Fallback: specific admin email for bootstrapping
    auth.is_bootstrap_admin()
  );

-- Fix other tables that had recursive policies
-- Update orders table policies to use the new helper functions
DROP POLICY IF EXISTS "Users can read own orders" ON orders;
CREATE POLICY "orders_select_policy" ON orders
  FOR SELECT
  USING (
    -- Users can read their own orders
    user_id = auth.uid()
    OR 
    -- Managers can read all orders
    auth.is_manager()
  );

DROP POLICY IF EXISTS "Users can update pending orders" ON orders;
CREATE POLICY "orders_update_policy" ON orders
  FOR UPDATE
  USING (
    -- Users can update their own pending orders
    (status = 'pending' AND user_id = auth.uid())
    OR
    -- Managers can update any order
    auth.is_manager()
  );

-- Update stores table policies
DROP POLICY IF EXISTS "Users can read stores" ON stores;
CREATE POLICY "stores_select_policy" ON stores
  FOR SELECT
  USING (auth.is_manager());

DROP POLICY IF EXISTS "Users can insert stores" ON stores;
CREATE POLICY "stores_insert_policy" ON stores
  FOR INSERT
  WITH CHECK (auth.is_admin_or_regional());

DROP POLICY IF EXISTS "Users can update stores" ON stores;
CREATE POLICY "stores_update_policy" ON stores
  FOR UPDATE
  USING (auth.is_admin_or_regional());

-- Ensure RLS is enabled on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- Verify the policies were created correctly
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename IN ('users', 'orders', 'stores')
ORDER BY tablename, policyname;