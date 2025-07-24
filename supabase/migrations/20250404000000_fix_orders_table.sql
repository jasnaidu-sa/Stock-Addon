-- Ensure the orders table exists with the correct structure
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number VARCHAR(20) UNIQUE, -- Store the DYN-prefixed order number here
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) NULL,
  store_name TEXT,
  description TEXT,
  status TEXT DEFAULT 'pending',
  total DECIMAL(10, 2) DEFAULT 0,
  items JSONB,
  metadata JSONB
);

-- Ensure the order_items table exists with the correct structure
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  stock_item_id TEXT,
  product_name TEXT,
  quantity INTEGER DEFAULT 1,
  price DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) DEFAULT 0,
  notes TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Add RLS policies for orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy for users to see only their own orders
CREATE POLICY IF NOT EXISTS users_select_own_orders
  ON orders
  FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Policy for users to insert their own orders
CREATE POLICY IF NOT EXISTS users_insert_own_orders
  ON orders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Policy for admins to see all orders
CREATE POLICY IF NOT EXISTS admin_select_all_orders
  ON orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Add RLS policies for order_items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Policy for users to see items from their own orders
CREATE POLICY IF NOT EXISTS users_select_own_order_items
  ON order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (orders.user_id = auth.uid() OR orders.user_id IS NULL)
    )
  );

-- Policy for users to insert items for their own orders
CREATE POLICY IF NOT EXISTS users_insert_own_order_items
  ON order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (orders.user_id = auth.uid() OR orders.user_id IS NULL)
    )
  );

-- Policy for admins to see all order items
CREATE POLICY IF NOT EXISTS admin_select_all_order_items
  ON order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Policy for admins to insert order items
CREATE POLICY IF NOT EXISTS admin_insert_order_items
  ON order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  ); 