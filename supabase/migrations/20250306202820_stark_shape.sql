/*
  # Fix users table authentication and permissions

  1. Changes
    - Drop existing policies to start fresh
    - Add proper authentication policies
    - Enable public access for initial user creation
    - Ensure proper admin access

  2. Security
    - Enable RLS on users table
    - Add policies for:
      - Public insert during signup
      - Users to read/update their own data
      - Admins to manage all data
*/

-- First, drop existing policies
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Admins can manage all users" ON users;
DROP POLICY IF EXISTS "Users can read their own data" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow public insert for initial user creation during signup
CREATE POLICY "Enable insert for public during signup" ON users
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = id);

-- Allow users to read their own data
CREATE POLICY "Enable read access for users" ON users
  FOR SELECT
  TO public
  USING (auth.uid() = id);

-- Allow users to update their own data
CREATE POLICY "Enable update for users" ON users
  FOR UPDATE
  TO public
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow admins full access
CREATE POLICY "Enable full access for admins" ON users
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.email LIKE '%admin%'
        OR (auth.users.raw_user_meta_data->>'is_admin')::boolean = true
      )
    )
  );