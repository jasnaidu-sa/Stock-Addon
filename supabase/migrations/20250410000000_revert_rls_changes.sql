-- Revert RLS changes to restore the previous working state
-- Disable RLS on the orders and order_items tables

-- Disable RLS on orders table
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;

-- Disable RLS on order_items table
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;

-- Drop any RLS policies that were added
DROP POLICY IF EXISTS "Users can insert their own orders" ON orders;
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
DROP POLICY IF EXISTS "Users can update their own orders" ON orders;
DROP POLICY IF EXISTS "Users can delete their own orders" ON orders;

DROP POLICY IF EXISTS "Users can insert order items for their orders" ON order_items;
DROP POLICY IF EXISTS "Users can view order items for their orders" ON order_items;
DROP POLICY IF EXISTS "Users can update order items for their orders" ON order_items;
DROP POLICY IF EXISTS "Users can delete order items for their orders" ON order_items;

DROP POLICY IF EXISTS "Anonymous users can insert orders without user_id" ON orders;
DROP POLICY IF EXISTS "Anonymous users can view orders they created" ON orders;
DROP POLICY IF EXISTS "Anonymous users can insert order items" ON order_items;
DROP POLICY IF EXISTS "Anonymous users can view order items" ON order_items;

DROP POLICY IF EXISTS "Service role can do everything with orders" ON orders;
DROP POLICY IF EXISTS "Service role can do everything with order_items" ON order_items;

-- Drop the event trigger if it exists
DROP EVENT TRIGGER IF EXISTS disable_rls_trigger;

-- Drop the function if it exists
DROP FUNCTION IF EXISTS disable_rls_on_new_table(); 