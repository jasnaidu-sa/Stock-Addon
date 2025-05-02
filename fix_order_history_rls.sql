-- Fix access to order_history table by explicitly allowing the admin user
-- to perform all operations without any RLS restrictions

-- Drop existing policies on order_history
DROP POLICY IF EXISTS "Admins can manage all order history" ON "order_history";
DROP POLICY IF EXISTS "Users can view their order history" ON "order_history";

-- Create simpler and more direct policies
-- 1. Admin policy with direct email check for maximum reliability
CREATE POLICY "Admin email has full access to history" ON "order_history"
FOR ALL
TO authenticated
USING (auth.email() = 'jnaidu@thebedshop.co.za');

-- 2. Users can access their own order history
CREATE POLICY "Users can access their own order history" ON "order_history"
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM orders
    WHERE orders.id = order_history.order_id
    AND orders.user_id = auth.uid()
  )
);

-- Make sure RLS is enabled
ALTER TABLE "order_history" ENABLE ROW LEVEL SECURITY;

-- Grant all permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON "order_history" TO authenticated;

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
  tablename = 'order_history'; 