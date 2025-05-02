/*
  # Fix order creation permissions

  1. Changes
    - Drop and recreate order policies
    - Add proper RLS policies for order creation
    - Fix order items permissions

  2. Security
    - Enable RLS on all tables
    - Add proper policies for authenticated users
*/

-- Drop existing policies to avoid conflicts
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can create their own orders" ON orders;
    DROP POLICY IF EXISTS "Users can create order items" ON order_items;
    DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON orders;
    DROP POLICY IF EXISTS "Enable insert for order items" ON order_items;
    DROP POLICY IF EXISTS "Users can read own orders" ON orders;
    DROP POLICY IF EXISTS "Users can read their order items" ON order_items;
END $$;

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Create base policies for orders
CREATE POLICY "Enable read access for users own orders"
ON orders FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Enable insert access for users own orders"
ON orders FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Create base policies for order items
CREATE POLICY "Enable read access for users own order items"
ON order_items FOR SELECT
TO authenticated
USING (EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
));

CREATE POLICY "Enable insert access for users own order items"
ON order_items FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
));