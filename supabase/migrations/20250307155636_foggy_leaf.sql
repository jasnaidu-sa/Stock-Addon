/*
  # Fix permissions for dashboard access

  1. Changes
    - Add policies for users table access
    - Update orders policies for dashboard access
    - Add admin access policies
  
  2. Security
    - Maintain RLS
    - Add proper access control
*/

-- Enable RLS on users table if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view their own profile" ON users;
  DROP POLICY IF EXISTS "Admins can view all profiles" ON users;
  DROP POLICY IF EXISTS "enable_read_for_users" ON users;
EXCEPTION 
  WHEN others THEN NULL;
END $$;

-- Create policies for users table
CREATE POLICY "enable_read_for_users"
ON users FOR SELECT
TO authenticated
USING (
  id = auth.uid() OR 
  EXISTS (
    SELECT 1 
    FROM users u 
    WHERE u.id = auth.uid() 
    AND (
      u.role = 'admin' OR 
      u.email LIKE '%admin%'
    )
  )
);

-- Update orders policies for dashboard access
DO $$ 
BEGIN
  -- First drop existing policies
  DROP POLICY IF EXISTS "enable_read_for_users" ON orders;
  DROP POLICY IF EXISTS "enable_insert_for_users" ON orders;
  DROP POLICY IF EXISTS "enable_update_for_users" ON orders;
EXCEPTION 
  WHEN others THEN NULL;
END $$;

-- Create new policies for orders
CREATE POLICY "enable_read_for_users"
ON orders FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 
    FROM users u 
    WHERE u.id = auth.uid() 
    AND (
      u.role = 'admin' OR 
      u.email LIKE '%admin%'
    )
  )
);

CREATE POLICY "enable_insert_for_users"
ON orders FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "enable_update_for_users"
ON orders FOR UPDATE
TO authenticated
USING (
  (user_id = auth.uid() AND status = 'pending') OR
  EXISTS (
    SELECT 1 
    FROM users u 
    WHERE u.id = auth.uid() 
    AND (
      u.role = 'admin' OR 
      u.email LIKE '%admin%'
    )
  )
);

-- Create admin function for easier policy checks
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM users 
    WHERE id = auth.uid() 
    AND (
      role = 'admin' OR 
      email LIKE '%admin%'
    )
  );
$$;