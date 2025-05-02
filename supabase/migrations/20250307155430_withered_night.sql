/*
  # Update admin functions and policies

  1. Changes
    - Add admin check function
    - Update policies for orders and order items
  
  2. Security
    - Add admin-specific policies
    - Ensure proper access control
*/

-- Create admin check function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    current_setting('request.jwt.claims', true)::json->>'email' LIKE '%admin%'
    OR
    (
      current_setting('request.jwt.claims', true)::json->'user_metadata'->>'is_admin')::boolean = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reset policies for orders
DROP POLICY IF EXISTS "Users can create their own orders" ON orders;
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
DROP POLICY IF EXISTS "Users can update pending orders" ON orders;

CREATE POLICY "Users can create their own orders"
ON orders FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own orders"
ON orders FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR is_admin());

-- Reset policies for order_items
DROP POLICY IF EXISTS "Users can create order items" ON order_items;
DROP POLICY IF EXISTS "Users can view their order items" ON order_items;

CREATE POLICY "Users can create order items"
ON order_items FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view their order items"
ON order_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND (orders.user_id = auth.uid() OR is_admin())
  )
);