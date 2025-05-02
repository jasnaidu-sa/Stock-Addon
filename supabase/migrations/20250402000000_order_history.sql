-- Create order_history table to track changes to orders
CREATE TABLE IF NOT EXISTS order_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id VARCHAR(12) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  change_type VARCHAR(50) NOT NULL, -- 'status_change', 'item_added', 'item_modified', 'item_removed', etc.
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  notes TEXT,
  metadata JSONB -- For storing additional information about the change
);

-- Create index for faster queries by order_id
CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON order_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_history_changed_at ON order_history(changed_at);

-- Create order_item_history table to track changes to order items
CREATE TABLE IF NOT EXISTS order_item_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_history_id UUID NOT NULL REFERENCES order_history(id) ON DELETE CASCADE,
  order_item_id UUID,
  stock_item_id UUID,
  product_name VARCHAR(255),
  previous_quantity INTEGER,
  new_quantity INTEGER,
  previous_price DECIMAL(10, 2),
  new_price DECIMAL(10, 2),
  previous_notes TEXT,
  new_notes TEXT,
  action VARCHAR(50) NOT NULL -- 'added', 'modified', 'removed'
);

-- Create function to record order status changes
CREATE OR REPLACE FUNCTION record_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  history_id UUID;
BEGIN
  -- Only proceed if status has changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Insert into order_history
    INSERT INTO order_history (
      order_id,
      changed_by,
      change_type,
      previous_status,
      new_status,
      notes
    ) VALUES (
      NEW.id,
      auth.uid(),
      'status_change',
      OLD.status,
      NEW.status,
      'Status changed via application'
    )
    RETURNING id INTO history_id;
    
    -- Add metadata about the change if needed
    -- This could be expanded in the future
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for order status changes
DROP TRIGGER IF EXISTS order_status_change_trigger ON orders;
CREATE TRIGGER order_status_change_trigger
AFTER UPDATE OF status ON orders
FOR EACH ROW
EXECUTE FUNCTION record_order_status_change();

-- Create function to record order creation
CREATE OR REPLACE FUNCTION record_order_creation()
RETURNS TRIGGER AS $$
DECLARE
  history_id UUID;
BEGIN
  -- Insert into order_history
  INSERT INTO order_history (
    order_id,
    changed_by,
    change_type,
    new_status,
    notes
  ) VALUES (
    NEW.id,
    auth.uid(),
    'order_created',
    NEW.status,
    'Order created'
  )
  RETURNING id INTO history_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for order creation
DROP TRIGGER IF EXISTS order_creation_trigger ON orders;
CREATE TRIGGER order_creation_trigger
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION record_order_creation();

-- Add RLS policies for order_history
ALTER TABLE order_history ENABLE ROW LEVEL SECURITY;

-- Policy for admins to see all history
CREATE POLICY admin_read_all_order_history
  ON order_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Policy for users to see only their own orders' history
CREATE POLICY user_read_own_order_history
  ON order_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_history.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- Add RLS policies for order_item_history
ALTER TABLE order_item_history ENABLE ROW LEVEL SECURITY;

-- Policy for admins to see all item history
CREATE POLICY admin_read_all_order_item_history
  ON order_item_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Policy for users to see only their own orders' item history
CREATE POLICY user_read_own_order_item_history
  ON order_item_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM order_history
      JOIN orders ON orders.id = order_history.order_id
      WHERE order_history.id = order_item_history.order_history_id
      AND orders.user_id = auth.uid()
    )
  );

-- Add comments for documentation
COMMENT ON TABLE order_history IS 'Tracks all changes to orders including status changes and modifications';
COMMENT ON TABLE order_item_history IS 'Tracks changes to individual order items';
COMMENT ON COLUMN order_history.change_type IS 'Type of change: status_change, order_created, items_modified, etc.';
COMMENT ON COLUMN order_item_history.action IS 'Action performed on the item: added, modified, removed'; 