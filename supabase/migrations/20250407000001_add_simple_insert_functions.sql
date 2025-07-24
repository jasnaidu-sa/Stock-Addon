-- Create a function to insert an order without relying on schema cache
CREATE OR REPLACE FUNCTION insert_order(
  p_order_number TEXT,
  p_user_id UUID DEFAULT NULL,
  p_store_name TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'pending',
  p_category TEXT DEFAULT NULL,
  p_total DECIMAL DEFAULT 0,
  p_quantity INTEGER DEFAULT 0,
  p_description TEXT DEFAULT NULL
) 
RETURNS json AS $$
DECLARE
  v_id UUID;
  v_created_at TIMESTAMP WITH TIME ZONE;
  v_result json;
BEGIN
  -- Insert the order
  INSERT INTO orders (
    order_number, 
    user_id, 
    store_name, 
    status, 
    category, 
    total, 
    quantity, 
    description
  ) 
  VALUES (
    p_order_number,
    p_user_id,
    p_store_name,
    p_status,
    p_category,
    p_total,
    p_quantity,
    p_description
  )
  RETURNING id, created_at INTO v_id, v_created_at;
  
  -- Build the result JSON
  SELECT json_build_object(
    'id', v_id,
    'order_number', p_order_number,
    'created_at', v_created_at,
    'user_id', p_user_id,
    'store_name', p_store_name,
    'status', p_status,
    'category', p_category,
    'total', p_total,
    'quantity', p_quantity,
    'description', p_description
  ) INTO v_result;
  
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error inserting order: %', SQLERRM;
  RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to insert an order item without relying on schema cache
CREATE OR REPLACE FUNCTION insert_order_item(
  p_order_id UUID,
  p_stock_item_id TEXT DEFAULT NULL,
  p_product_name TEXT DEFAULT 'Unnamed Product',
  p_quantity INTEGER DEFAULT 1,
  p_price DECIMAL DEFAULT 0,
  p_total DECIMAL DEFAULT 0,
  p_notes TEXT DEFAULT NULL
) 
RETURNS json AS $$
DECLARE
  v_id UUID;
  v_result json;
BEGIN
  -- Insert the order item
  INSERT INTO order_items (
    order_id, 
    stock_item_id, 
    product_name, 
    quantity, 
    price, 
    total, 
    notes
  ) 
  VALUES (
    p_order_id,
    p_stock_item_id,
    p_product_name,
    p_quantity,
    p_price,
    p_total,
    p_notes
  )
  RETURNING id INTO v_id;
  
  -- Build the result JSON
  SELECT json_build_object(
    'id', v_id,
    'order_id', p_order_id,
    'stock_item_id', p_stock_item_id,
    'product_name', p_product_name,
    'quantity', p_quantity,
    'price', p_price,
    'total', p_total,
    'notes', p_notes
  ) INTO v_result;
  
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error inserting order item: %', SQLERRM;
  RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION insert_order(TEXT, UUID, TEXT, TEXT, TEXT, DECIMAL, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_order(TEXT, UUID, TEXT, TEXT, TEXT, DECIMAL, INTEGER, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION insert_order(TEXT, UUID, TEXT, TEXT, TEXT, DECIMAL, INTEGER, TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION insert_order_item(UUID, TEXT, TEXT, INTEGER, DECIMAL, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_order_item(UUID, TEXT, TEXT, INTEGER, DECIMAL, DECIMAL, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION insert_order_item(UUID, TEXT, TEXT, INTEGER, DECIMAL, DECIMAL, TEXT) TO service_role; 