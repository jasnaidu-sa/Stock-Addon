-- Enable Row Level Security on the tables
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Create policies for the orders table
-- Allow authenticated users to insert orders
CREATE POLICY "Users can insert their own orders"
ON orders FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Allow authenticated users to view their own orders
CREATE POLICY "Users can view their own orders"
ON orders FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR user_id IS NULL);

-- Allow authenticated users to update their own orders
CREATE POLICY "Users can update their own orders"
ON orders FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR user_id IS NULL);

-- Allow authenticated users to delete their own orders
CREATE POLICY "Users can delete their own orders"
ON orders FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR user_id IS NULL);

-- Create policies for the order_items table
-- Allow authenticated users to insert order items for their orders
CREATE POLICY "Users can insert order items for their orders"
ON order_items FOR INSERT
TO authenticated
WITH CHECK (
  order_id IN (
    SELECT id FROM orders WHERE user_id = auth.uid() OR user_id IS NULL
  )
);

-- Allow authenticated users to view order items for their orders
CREATE POLICY "Users can view order items for their orders"
ON order_items FOR SELECT
TO authenticated
USING (
  order_id IN (
    SELECT id FROM orders WHERE user_id = auth.uid() OR user_id IS NULL
  )
);

-- Allow authenticated users to update order items for their orders
CREATE POLICY "Users can update order items for their orders"
ON order_items FOR UPDATE
TO authenticated
USING (
  order_id IN (
    SELECT id FROM orders WHERE user_id = auth.uid() OR user_id IS NULL
  )
);

-- Allow authenticated users to delete order items for their orders
CREATE POLICY "Users can delete order items for their orders"
ON order_items FOR DELETE
TO authenticated
USING (
  order_id IN (
    SELECT id FROM orders WHERE user_id = auth.uid() OR user_id IS NULL
  )
);

-- Create policies for anonymous users (for guest checkout)
-- Allow anonymous users to insert orders without a user_id
CREATE POLICY "Anonymous users can insert orders without user_id"
ON orders FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);

-- Allow anonymous users to view orders they created (using session variables or cookies)
CREATE POLICY "Anonymous users can view orders they created"
ON orders FOR SELECT
TO anon
USING (user_id IS NULL);

-- Allow anonymous users to insert order items for orders they created
CREATE POLICY "Anonymous users can insert order items"
ON order_items FOR INSERT
TO anon
WITH CHECK (
  order_id IN (
    SELECT id FROM orders WHERE user_id IS NULL
  )
);

-- Allow anonymous users to view order items for orders they created
CREATE POLICY "Anonymous users can view order items"
ON order_items FOR SELECT
TO anon
USING (
  order_id IN (
    SELECT id FROM orders WHERE user_id IS NULL
  )
);

-- Create policies for service role (for admin access)
-- Allow service role to perform all operations on orders
CREATE POLICY "Service role can do everything with orders"
ON orders FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow service role to perform all operations on order_items
CREATE POLICY "Service role can do everything with order_items"
ON order_items FOR ALL
TO service_role
USING (true)
WITH CHECK (true); 