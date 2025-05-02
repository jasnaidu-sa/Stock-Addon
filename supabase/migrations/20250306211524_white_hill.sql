/*
  # Update users table policies

  1. Security Changes
    - Enable RLS on users table if not already enabled
    - Drop existing policies to avoid conflicts
    - Recreate policies with proper permissions:
      - Self-read access for authenticated users
      - Self-update access for authenticated users
      - Self-insert access for authenticated users
      - Admin read access for all profiles
*/

-- Enable RLS if not already enabled
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'users' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Drop existing policies to avoid conflicts
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can read own profile" ON users;
  DROP POLICY IF EXISTS "Users can update own profile" ON users;
  DROP POLICY IF EXISTS "Users can insert own profile" ON users;
  DROP POLICY IF EXISTS "Admins can read all profiles" ON users;
END $$;

-- Recreate policies with proper permissions
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

CREATE POLICY "Admins can read all profiles"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users admin 
      WHERE admin.id = auth.uid() 
      AND admin.role = 'admin'
    )
  );