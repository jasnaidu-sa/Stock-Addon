-- Update RLS policy for order_items table to allow admin users to insert records

-- First, let's drop the existing policy for INSERT
DROP POLICY IF EXISTS "Users can insert order items for their orders" ON "order_items";

-- Create a new policy that allows admin users to insert order items for any order
-- and regular users for their own orders
CREATE POLICY "Users and Admins can insert order items" ON "order_items"
FOR INSERT
TO authenticated
WITH CHECK (
  is_admin() 
  OR
  EXISTS (
    SELECT 1
    FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
  )
);

-- Add policy for UPDATE
DROP POLICY IF EXISTS "Users can update their order items" ON "order_items";
CREATE POLICY "Users and Admins can update order items" ON "order_items"
FOR UPDATE
TO authenticated
USING (
  is_admin() 
  OR
  EXISTS (
    SELECT 1
    FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
  )
);

-- Add policy for DELETE
DROP POLICY IF EXISTS "Users can delete their order items" ON "order_items";
CREATE POLICY "Users and Admins can delete order items" ON "order_items"
FOR DELETE
TO authenticated
USING (
  is_admin() 
  OR
  EXISTS (
    SELECT 1
    FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
  )
);

-- Ensure RLS is enabled
ALTER TABLE "order_items" FORCE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON "order_items" TO authenticated;
