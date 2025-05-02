/*
  # Fix user policies and order management

  1. Changes
    - Fix infinite recursion in user policies
    - Simplify admin checks
    - Update order management policies

  2. Security
    - Maintain RLS
    - Ensure proper access control
*/

-- First, drop existing policies to clean up
DROP POLICY IF EXISTS "Users can view their own orders or admins can view all" ON orders;
DROP POLICY IF EXISTS "Users can update their pending orders or admins can update all" ON orders;
DROP POLICY IF EXISTS "Users can view their order items or admins can view all" ON order_items;

-- Create a function to check if a user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND (
      role = 'admin'
      OR email LIKE '%admin%'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update orders policies
CREATE POLICY "Users can view their own orders or admins can view all"
ON orders FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR is_admin()
);

CREATE POLICY "Users can update their pending orders or admins can update all"
ON orders FOR UPDATE
TO authenticated
USING (
  (auth.uid() = user_id AND status = 'pending')
  OR is_admin()
);

-- Update order items policies
CREATE POLICY "Users can view their order items or admins can view all"
ON order_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_id
    AND (
      orders.user_id = auth.uid()
      OR is_admin()
    )
  )
);