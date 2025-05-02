/*
  # Update order management system

  1. Changes
    - Add order number generation
    - Update RLS policies
    - Add indexes for performance
    - Update constraints safely
  
  2. Security
    - Enable RLS
    - Add policies for proper access control
*/

-- Create sequence for order numbers if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

-- Drop and recreate order number generation function
DO $$ 
BEGIN
  DROP TRIGGER IF EXISTS set_order_number_trigger ON orders;
  DROP FUNCTION IF EXISTS public.set_order_number() CASCADE;
EXCEPTION 
  WHEN others THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE sql
AS $$
  SELECT 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(CAST(nextval('order_number_seq') AS text), 4, '0');
$$;

-- Ensure RLS is enabled
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DO $$ 
BEGIN
  -- Drop orders policies
  DROP POLICY IF EXISTS "allow_select_own_orders" ON orders;
  DROP POLICY IF EXISTS "allow_insert_own_orders" ON orders;
  DROP POLICY IF EXISTS "allow_update_own_pending_orders" ON orders;
  
  -- Drop order_items policies
  DROP POLICY IF EXISTS "allow_select_own_order_items" ON order_items;
  DROP POLICY IF EXISTS "allow_insert_own_order_items" ON order_items;
EXCEPTION 
  WHEN others THEN NULL;
END $$;

-- Create simplified policies for orders
CREATE POLICY "allow_select_own_orders"
ON orders FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND (
      users.role = 'admin' OR 
      users.email LIKE '%admin%'
    )
  )
);

CREATE POLICY "allow_insert_own_orders"
ON orders FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "allow_update_own_pending_orders"
ON orders FOR UPDATE
TO authenticated
USING (
  (auth.uid() = user_id AND status = 'pending') OR
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND (
      users.role = 'admin' OR 
      users.email LIKE '%admin%'
    )
  )
);

-- Create simplified policies for order items
CREATE POLICY "allow_select_own_order_items"
ON order_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND (
      orders.user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND (
          users.role = 'admin' OR
          users.email LIKE '%admin%'
        )
      )
    )
  )
);

CREATE POLICY "allow_insert_own_order_items"
ON order_items FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
  )
);

-- Add proper indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Handle constraints safely
DO $$ 
BEGIN
  -- First remove any existing foreign key constraints
  ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;

  -- Add constraints back with proper CASCADE behavior
  ALTER TABLE orders
    ADD CONSTRAINT orders_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

  ALTER TABLE order_items
    ADD CONSTRAINT order_items_order_id_fkey
    FOREIGN KEY (order_id)
    REFERENCES orders(id)
    ON DELETE CASCADE;
EXCEPTION 
  WHEN others THEN 
    RAISE NOTICE 'Error handling constraints: %', SQLERRM;
END $$;