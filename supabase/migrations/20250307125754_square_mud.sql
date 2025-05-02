/*
  # Fix database policies and permissions

  1. Changes
    - Reset and recreate all policies
    - Simplify policy conditions
    - Add proper admin checks
    - Fix order processing permissions

  2. Security
    - Maintain RLS protection
    - Ensure proper access control
    - Add proper user role checks
*/

-- First, clean up any existing policies
DO $$ 
BEGIN
    -- Drop orders policies
    DROP POLICY IF EXISTS "orders_select_policy" ON orders;
    DROP POLICY IF EXISTS "orders_insert_policy" ON orders;
    DROP POLICY IF EXISTS "orders_update_policy" ON orders;
    DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
    DROP POLICY IF EXISTS "Users can create their own orders" ON orders;
    DROP POLICY IF EXISTS "Users can update their own pending orders" ON orders;
    DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
    DROP POLICY IF EXISTS "Enable read access for users own orders" ON orders;
    DROP POLICY IF EXISTS "Enable insert access for users own orders" ON orders;

    -- Drop order_items policies
    DROP POLICY IF EXISTS "order_items_select_policy" ON order_items;
    DROP POLICY IF EXISTS "order_items_insert_policy" ON order_items;
    DROP POLICY IF EXISTS "Users can view their order items" ON order_items;
    DROP POLICY IF EXISTS "Users can create order items" ON order_items;
    DROP POLICY IF EXISTS "Admins can view all order items" ON order_items;
    DROP POLICY IF EXISTS "Enable read access for users own order items" ON order_items;
    DROP POLICY IF EXISTS "Enable insert access for users own order items" ON order_items;

    -- Drop users policies
    DROP POLICY IF EXISTS "users_select_policy" ON users;
    DROP POLICY IF EXISTS "users_update_policy" ON users;
    DROP POLICY IF EXISTS "Users can view their own profile" ON users;
    DROP POLICY IF EXISTS "Users can update their own profile" ON users;
    DROP POLICY IF EXISTS "Admins can view all users" ON users;
END $$;

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create admin check function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (
      (raw_user_meta_data->>'is_admin')::boolean = true
      OR email LIKE '%admin%'
    )
  );
$$;

-- Orders table policies
CREATE POLICY "enable_read_for_users"
ON orders FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR is_admin()
);

CREATE POLICY "enable_insert_for_users"
ON orders FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "enable_update_for_users"
ON orders FOR UPDATE
TO authenticated
USING (
  (user_id = auth.uid() AND status = 'pending')
  OR is_admin()
);

-- Order items table policies
CREATE POLICY "enable_read_for_users"
ON order_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND (orders.user_id = auth.uid() OR is_admin())
  )
);

CREATE POLICY "enable_insert_for_users"
ON order_items FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
  )
);

-- Users table policies
CREATE POLICY "enable_read_for_users"
ON users FOR SELECT
TO authenticated
USING (
  id = auth.uid() OR is_admin()
);

CREATE POLICY "enable_update_for_users"
ON users FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());