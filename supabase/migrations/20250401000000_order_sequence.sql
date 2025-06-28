-- Create a table to store the current order sequence number
CREATE TABLE IF NOT EXISTS order_sequence (
  id SERIAL PRIMARY KEY,
  current_value INTEGER NOT NULL DEFAULT 1000,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial value if table is empty
INSERT INTO order_sequence (current_value)
SELECT 1000
WHERE NOT EXISTS (SELECT 1 FROM order_sequence);

-- Add a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_order_sequence_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_order_sequence_timestamp ON order_sequence;
CREATE TRIGGER update_order_sequence_timestamp
BEFORE UPDATE ON order_sequence
FOR EACH ROW
EXECUTE FUNCTION update_order_sequence_timestamp();

-- Modify the orders table to use the order number as the primary key

-- Temporarily drop all dependencies on orders.id
DROP VIEW IF EXISTS public.orders_with_user_details;
DROP POLICY IF EXISTS "customer_update_own_order_history" ON public.order_history;
DROP POLICY IF EXISTS "Users can access their own order history" ON public.order_history;
DROP POLICY IF EXISTS "clerk_users_read_own_order_items" ON public.order_items;
DROP POLICY IF EXISTS "clerk_users_read_own_order_history" ON public.order_history;
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;
ALTER TABLE public.order_history DROP CONSTRAINT IF EXISTS order_history_order_id_fkey;

-- Perform the column type changes on ALL relevant tables
ALTER TABLE IF EXISTS orders 
ALTER COLUMN id TYPE VARCHAR(12);
ALTER TABLE IF EXISTS order_items
ALTER COLUMN order_id TYPE VARCHAR(12);
ALTER TABLE IF EXISTS order_history
ALTER COLUMN order_id TYPE VARCHAR(12);

-- Re-add the foreign key constraints
ALTER TABLE public.order_items 
ADD CONSTRAINT order_items_order_id_fkey 
FOREIGN KEY (order_id) 
REFERENCES orders(id) 
ON DELETE CASCADE;

ALTER TABLE public.order_history
ADD CONSTRAINT order_history_order_id_fkey
FOREIGN KEY (order_id)
REFERENCES orders(id)
ON DELETE CASCADE;

-- Recreate the RLS policies
CREATE POLICY "customer_update_own_order_history"
ON public.order_history
FOR UPDATE
TO public
WITH CHECK (
  (EXISTS ( SELECT 1
   FROM orders
  WHERE ((orders.id = order_history.order_id) AND (orders.user_id = get_user_id_from_clerk()))))
);

CREATE POLICY "Users can access their own order history"
ON public.order_history
FOR SELECT
TO authenticated
USING (
  (EXISTS ( SELECT 1
   FROM orders
  WHERE ((orders.id = order_history.order_id) AND (orders.user_id = auth.uid()))))
);

CREATE POLICY "clerk_users_read_own_order_items"
ON public.order_items
FOR SELECT
TO public
USING (
  (EXISTS ( SELECT 1
   FROM orders
  WHERE ((orders.id = order_items.order_id) AND ((orders.user_id = get_user_id_from_clerk()) OR clerk_is_admin() OR (auth.role() = 'service_role'::text) OR (get_clerk_user_id() IS NULL)))))
);

CREATE POLICY "clerk_users_read_own_order_history"
ON public.order_history
FOR SELECT
TO public
USING (
  (EXISTS ( SELECT 1
   FROM orders
  WHERE ((orders.id = order_history.order_id) AND ((orders.user_id = get_user_id_from_clerk()) OR clerk_is_admin() OR (auth.role() = 'service_role'::text) OR (get_clerk_user_id() IS NULL)))))
);

-- Recreate the view
CREATE OR REPLACE VIEW public.orders_with_user_details AS
 SELECT o.id,
    o.user_id,
    o.order_number,
    o.store_name,
    o.category,
    o.quantity,
    o.status,
    o.created_at,
    o.value,
    o."Order Owner",
    o.order_owner_id,
    u.first_name,
    u.last_name,
    u.email,
    u.role AS user_role
   FROM orders o
     LEFT JOIN users u ON o.user_id = u.id;

-- Add a constraint to ensure order IDs follow the pattern
ALTER TABLE IF EXISTS orders 
ADD CONSTRAINT IF NOT EXISTS order_id_format CHECK (id ~ '^DYN\d{6}$');

-- Update the order_items table to match the new order ID format
ALTER TABLE IF EXISTS order_items
ALTER COLUMN order_id TYPE VARCHAR(12);

-- Add a comment explaining the purpose of the order_sequence table
COMMENT ON TABLE order_sequence IS 'Stores the current order sequence number to ensure unique, sequential order numbers'; 