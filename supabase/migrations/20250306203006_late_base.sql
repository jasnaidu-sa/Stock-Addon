/*
  # Fix users table permissions

  1. Changes
    - Reset and simplify RLS policies
    - Add essential policies for auth flow
    - Fix permission issues for user profile access

  2. Security
    - Enable RLS
    - Add policies for:
      - Public access for initial signup
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

-- Allow authenticated users to read their own data
CREATE POLICY "Users can read own data" ON users
FOR SELECT TO authenticated
USING (auth.uid() = id);

-- Allow users to update their own data
CREATE POLICY "Users can update own data" ON users
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow insert during signup
CREATE POLICY "Allow insert during signup" ON users
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- Admin full access policy
CREATE POLICY "Admins have full access" ON users
FOR ALL TO authenticated
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

-- Public read policy for initial auth
CREATE POLICY "Public can read during auth" ON users
FOR SELECT TO public
USING (auth.uid() = id);