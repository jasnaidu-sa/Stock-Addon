-- Fix access to order_items table by explicitly allowing the admin user
-- to perform all operations without any RLS restrictions

-- Drop existing policies on order_items
DROP POLICY IF EXISTS "Users can insert order items for their orders" ON "order_items";
DROP POLICY IF EXISTS "Users can view their order items or admins can view all" ON "order_items";
DROP POLICY IF EXISTS "Users and Admins can insert order items" ON "order_items";
DROP POLICY IF EXISTS "Users and Admins can update order items" ON "order_items";
DROP POLICY IF EXISTS "Users and Admins can delete order items" ON "order_items";

-- Create simpler and more direct policies
-- 1. Admin policy with direct email check for maximum reliability
CREATE POLICY "Admin email has full access" ON "order_items"
FOR ALL
TO authenticated
USING (auth.email() = 'jnaidu@thebedshop.co.za');

-- 2. Users can access their own order items
CREATE POLICY "Users can access their own order items" ON "order_items"
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
  )
);

-- Make sure RLS is enabled
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;

-- Grant all permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON "order_items" TO authenticated;

-- Check the policy definitions
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM
  pg_policies
WHERE
  tablename = 'order_items'; 