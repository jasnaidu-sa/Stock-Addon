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
ALTER TABLE IF EXISTS orders 
ALTER COLUMN id TYPE VARCHAR(12);

-- Add a constraint to ensure order IDs follow the pattern
ALTER TABLE IF EXISTS orders 
ADD CONSTRAINT IF NOT EXISTS order_id_format CHECK (id ~ '^DYN\d{6}$');

-- Update the order_items table to match the new order ID format
ALTER TABLE IF EXISTS order_items
ALTER COLUMN order_id TYPE VARCHAR(12);

-- Add a comment explaining the purpose of the order_sequence table
COMMENT ON TABLE order_sequence IS 'Stores the current order sequence number to ensure unique, sequential order numbers'; 