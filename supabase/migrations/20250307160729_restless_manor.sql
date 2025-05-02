/*
  # Fix database schema and policies

  1. Changes
    - Drop and recreate tables with proper structure
    - Add sequence for order number generation
    - Add proper foreign key relationships
    - Add notes field to order_items
    - Set up automatic order number generation via trigger
    - Add proper constraints and checks

  2. Security
    - Enable RLS
    - Set up proper access policies for orders and order items
*/

-- Drop existing tables and functions
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP SEQUENCE IF EXISTS order_number_seq CASCADE;

-- Create sequence for order numbers
CREATE SEQUENCE order_number_seq START 1;

-- Create function to generate order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(nextval('order_number_seq')::text, 4, '0');
END;
$$;

-- Create orders table
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  order_number text,
  store_name text NOT NULL,
  product_name text NOT NULL,
  category text NOT NULL CHECK (category IN ('mattress', 'furniture', 'accessories', 'foam')),
  quantity integer NOT NULL CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'cancelled', 'completed')),
  created_at timestamptz DEFAULT now()
);

-- Create order_items table
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  stock_item_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  price numeric NOT NULL CHECK (price >= 0),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create trigger function to set order number
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.order_number := generate_order_number();
  RETURN NEW;
END;
$$;

-- Create trigger to automatically set order number
CREATE TRIGGER set_order_number_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- Create indexes
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Create policies for orders
CREATE POLICY "Users can insert their own orders"
ON orders FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own orders or admins can view all"
ON orders FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND (users.role = 'admin' OR users.email LIKE '%admin%')
  )
);

CREATE POLICY "Users can update their pending orders or admins can update all"
ON orders FOR UPDATE
TO authenticated
USING (
  (auth.uid() = user_id AND status = 'pending') OR
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND (users.role = 'admin' OR users.email LIKE '%admin%')
  )
);

-- Create policies for order items
CREATE POLICY "Users can insert order items for their orders"
ON order_items FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_id
    AND orders.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view their order items or admins can view all"
ON order_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_id
    AND (
      orders.user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND (users.role = 'admin' OR users.email LIKE '%admin%')
      )
    )
  )
);