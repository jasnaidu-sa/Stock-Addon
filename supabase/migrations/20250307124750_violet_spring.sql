/*
  # Fix order processing permissions

  1. Changes
    - Add missing RLS policies for order processing
    - Update existing policies to ensure proper access
    - Add policies for order items management

  2. Security
    - Enable RLS on all tables
    - Add specific policies for order creation
    - Ensure proper user access control
*/

-- Enable RLS on tables if not already enabled
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON orders;
    DROP POLICY IF EXISTS "Enable insert for order items" ON order_items;
END $$;

-- Add policies for orders
CREATE POLICY "Enable insert for authenticated users only"
ON orders FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable read for users own orders"
ON orders FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Add policies for order items
CREATE POLICY "Enable insert for order items"
ON order_items FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM orders
        WHERE orders.id = order_items.order_id
        AND orders.user_id = auth.uid()
    )
);

CREATE POLICY "Enable read for users own order items"
ON order_items FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM orders
        WHERE orders.id = order_items.order_id
        AND orders.user_id = auth.uid()
    )
);