/*
  # Fix policy recursion issues

  1. Changes
    - Remove circular references in policies
    - Simplify policy conditions
    - Add direct user role checks
    - Fix admin access policies

  2. Security
    - Maintain RLS protection
    - Ensure proper access control
*/

-- Drop existing policies to start fresh
DO $$ 
BEGIN
    -- Drop orders policies
    DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
    DROP POLICY IF EXISTS "Users can create their own orders" ON orders;
    DROP POLICY IF EXISTS "Users can update their own pending orders" ON orders;
    DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
    DROP POLICY IF EXISTS "Enable read access for users own orders" ON orders;
    DROP POLICY IF EXISTS "Enable insert access for users own orders" ON orders;

    -- Drop order_items policies
    DROP POLICY IF EXISTS "Users can view their order items" ON order_items;
    DROP POLICY IF EXISTS "Users can create order items" ON order_items;
    DROP POLICY IF EXISTS "Admins can view all order items" ON order_items;
    DROP POLICY IF EXISTS "Enable read access for users own order items" ON order_items;
    DROP POLICY IF EXISTS "Enable insert access for users own order items" ON order_items;

    -- Drop users policies
    DROP POLICY IF EXISTS "Users can view their own profile" ON users;
    DROP POLICY IF EXISTS "Users can update their own profile" ON users;
    DROP POLICY IF EXISTS "Admins can view all users" ON users;
END $$;

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Orders policies
CREATE POLICY "orders_select_policy" ON orders
FOR SELECT TO authenticated
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

CREATE POLICY "orders_insert_policy" ON orders
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "orders_update_policy" ON orders
FOR UPDATE TO authenticated
USING (
  (user_id = auth.uid() AND status = 'pending') OR
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Order items policies
CREATE POLICY "order_items_select_policy" ON order_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND (orders.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    ))
  )
);

CREATE POLICY "order_items_insert_policy" ON order_items
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
  )
);

-- Users policies
CREATE POLICY "users_select_policy" ON users
FOR SELECT TO authenticated
USING (
  id = auth.uid() OR
  role = 'admin'
);

CREATE POLICY "users_update_policy" ON users
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Create default admin user function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;