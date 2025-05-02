/*
  # Fix Table Permissions

  1. Security Changes
    - Enable RLS on users and orders tables
    - Set up proper policies for users table:
      - Allow users to read/update their own profile
      - Allow admins to access all profiles
    - Set up proper policies for orders table:
      - Allow users to read/create their own orders
      - Allow admins to access all orders

  2. Changes
    - Drop existing policies to avoid conflicts
    - Create new policies with proper permissions
    - Fix recursive policy issues
*/

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DO $$ 
BEGIN
  -- Users table policies
  DROP POLICY IF EXISTS "Users can read own profile" ON users;
  DROP POLICY IF EXISTS "Users can update own profile" ON users;
  DROP POLICY IF EXISTS "Users can insert own profile" ON users;
  DROP POLICY IF EXISTS "Admins can read all profiles" ON users;
  DROP POLICY IF EXISTS "Enable read access for all users" ON users;
  DROP POLICY IF EXISTS "Enable update for users" ON users;
  DROP POLICY IF EXISTS "Enable insert for authenticated users" ON users;
  DROP POLICY IF EXISTS "Enable full access for admins" ON users;
  DROP POLICY IF EXISTS "Admins can access all profiles" ON users;
  
  -- Orders table policies
  DROP POLICY IF EXISTS "Users can read own orders" ON orders;
  DROP POLICY IF EXISTS "Users can create orders" ON orders;
  DROP POLICY IF EXISTS "Admins can access all orders" ON orders;
END $$;

-- Users table policies
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

-- Orders table policies
CREATE POLICY "Users can read own orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.email LIKE '%admin%'
        OR (auth.users.raw_user_meta_data->>'is_admin')::boolean = true
      )
    )
  );

CREATE POLICY "Users can create orders"
  ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can access all orders"
  ON orders
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