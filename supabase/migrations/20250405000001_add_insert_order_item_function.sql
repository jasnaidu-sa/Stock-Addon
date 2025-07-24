-- Create a function to insert order items directly using SQL
-- This bypasses the schema cache issues with the REST API
CREATE OR REPLACE FUNCTION insert_order_item(
  p_order_id UUID,
  p_stock_item_id TEXT,
  p_quantity INTEGER,
  p_price DECIMAL,
  p_total DECIMAL,
  p_notes TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO order_items (
    order_id,
    stock_item_id,
    quantity,
    price,
    total,
    notes
  ) VALUES (
    p_order_id,
    p_stock_item_id,
    p_quantity,
    p_price,
    p_total,
    p_notes
  );
END;
$$ LANGUAGE plpgsql; 