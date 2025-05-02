/*
  # Fix users table policies

  1. Security Changes
    - Drop existing policies to avoid conflicts
    - Recreate policies with proper permissions:
      - Self-read access for authenticated users
      - Self-update access for authenticated users
      - Self-insert access for authenticated users
      - Admin access using email pattern and metadata check
*/

-- Drop existing policies to avoid conflicts
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can read own profile" ON users;
  DROP POLICY IF EXISTS "Users can update own profile" ON users;
  DROP POLICY IF EXISTS "Users can insert own profile" ON users;
  DROP POLICY IF EXISTS "Admins can read all profiles" ON users;
  DROP POLICY IF EXISTS "Enable read access for all users" ON users;
  DROP POLICY IF EXISTS "Enable update for users" ON users;
  DROP POLICY IF EXISTS "Enable insert for authenticated users" ON users;
  DROP POLICY IF EXISTS "Enable full access for admins" ON users;
  DROP POLICY IF EXISTS "Admins can access all profiles" ON users;
END $$;

-- Recreate policies without recursion
CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Admin policy using email pattern and metadata check
CREATE POLICY "Admins can access all profiles"
  ON users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.email LIKE '%admin%'
        OR (auth.users.raw_user_meta_data->>'is_admin')::boolean = true
      )
    )
  );