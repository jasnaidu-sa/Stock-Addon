/*
  # Fix users table RLS policies

  1. Changes
    - Remove recursive policies that were causing infinite loops
    - Simplify user access control
    - Add proper admin role checks
    - Ensure users can only access their own data
    - Allow admins to access all user data

  2. Security
    - Enable RLS on users table
    - Add policies for:
      - Users to read/update their own data
      - Admins to manage all user data
*/

-- First, drop existing policies to start fresh
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own data and admins to read all data
CREATE POLICY "Users can read own data" ON users
  FOR SELECT
  TO public
  USING (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.email LIKE '%admin%' OR
        (auth.users.raw_user_meta_data->>'is_admin')::boolean = true
      )
    )
  );

-- Allow users to update their own data
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE
  TO public
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow admins to manage all user data
CREATE POLICY "Admins can manage all users" ON users
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.email LIKE '%admin%' OR
        (auth.users.raw_user_meta_data->>'is_admin')::boolean = true
      )
    )
  );