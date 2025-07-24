-- Revert all RLS changes to restore the original state

-- Drop all RLS policies that were added
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

DROP POLICY IF EXISTS "Public read access for mattress" ON mattress;
DROP POLICY IF EXISTS "Public read access for furniture" ON furniture;
DROP POLICY IF EXISTS "Public read access for accessories" ON accessories;
DROP POLICY IF EXISTS "Public read access for foam" ON foam;

-- Drop the event trigger if it exists
DROP EVENT TRIGGER IF EXISTS disable_rls_trigger;

-- Drop the functions if they exist
DROP FUNCTION IF EXISTS disable_rls_on_new_table() CASCADE;
DROP FUNCTION IF EXISTS disable_rls_on_all_tables() CASCADE;
DROP FUNCTION IF EXISTS table_exists(TEXT) CASCADE;

-- Restore the original RLS settings
-- Enable RLS on the tables that should have it
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Create the original policies
-- These are placeholder policies - you'll need to adjust them based on your original setup
CREATE POLICY "Allow authenticated users to access orders" ON orders
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to access order items" ON order_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Ensure product tables have the correct RLS settings
-- If they originally had RLS enabled with specific policies, you'll need to recreate those
-- For now, we'll enable RLS but allow authenticated users full access
ALTER TABLE mattresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE furniture ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessories ENABLE ROW LEVEL SECURITY;
ALTER TABLE foam ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to access mattresses" ON mattresses
  FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to access furniture" ON furniture
  FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to access accessories" ON accessories
  FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to access foam" ON foam
  FOR ALL
  TO authenticated
  USING (true); 