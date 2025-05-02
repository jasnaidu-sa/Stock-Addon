/*
  # Fix users table permissions

  1. Changes
    - Reset and simplify RLS policies
    - Add essential policies for auth flow
    - Fix permission issues for user profile access

  2. Security
    - Enable RLS
    - Add policies for:
      - Public access for initial auth
      - Authenticated user access to own data
      - Admin access to all data
*/

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Allow insert during signup" ON users;
DROP POLICY IF EXISTS "Admins have full access" ON users;
DROP POLICY IF EXISTS "Public can read during auth" ON users;
DROP POLICY IF EXISTS "Enable read access for users" ON users;
DROP POLICY IF EXISTS "Enable update for users" ON users;
DROP POLICY IF EXISTS "Enable insert for public during signup" ON users;
DROP POLICY IF EXISTS "Enable full access for admins" ON users;

-- Create new simplified policies

-- Allow public read access for authentication
CREATE POLICY "Enable read access for all users" ON users
FOR SELECT
USING (true);

-- Allow users to update their own data
CREATE POLICY "Enable update for users" ON users
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow insert during signup
CREATE POLICY "Enable insert for authenticated users" ON users
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Admin full access policy
CREATE POLICY "Enable full access for admins" ON users
FOR ALL
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