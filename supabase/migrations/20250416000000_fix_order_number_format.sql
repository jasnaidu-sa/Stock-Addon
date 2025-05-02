-- Fix order number format issue
-- This migration removes the database trigger that's overriding the application-generated order numbers
-- and adds logging for order number generation failures

-- First, drop the existing trigger and function
DROP TRIGGER IF EXISTS set_order_number_trigger ON orders;
DROP FUNCTION IF EXISTS set_order_number() CASCADE;

-- Create a table to log order number generation errors
CREATE TABLE IF NOT EXISTS order_number_errors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  error_message TEXT,
  order_id UUID,
  attempted_order_number TEXT,
  user_id UUID,
  additional_info JSONB
);

-- Create a function to log order number errors
CREATE OR REPLACE FUNCTION log_order_number_error(
  p_error_message TEXT,
  p_order_id UUID DEFAULT NULL,
  p_attempted_order_number TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_additional_info JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_error_id UUID;
BEGIN
  INSERT INTO order_number_errors (
    error_message,
    order_id,
    attempted_order_number,
    user_id,
    additional_info
  ) VALUES (
    p_error_message,
    p_order_id,
    p_attempted_order_number,
    p_user_id,
    p_additional_info
  ) RETURNING id INTO v_error_id;
  
  RETURN v_error_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a new function to validate order numbers
CREATE OR REPLACE FUNCTION validate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  -- If order_number is NULL, log an error but don't modify it
  -- This allows the application to handle the error
  IF NEW.order_number IS NULL THEN
    PERFORM log_order_number_error(
      'Order created without an order number',
      NEW.id,
      NULL,
      NEW.user_id,
      jsonb_build_object('order_data', row_to_json(NEW))
    );
  END IF;
  
  -- Always return NEW without modification to preserve the application-provided order number
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a new trigger that only validates but doesn't modify the order number
CREATE TRIGGER validate_order_number_trigger
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION validate_order_number();

-- Grant permissions for the error logging function
GRANT EXECUTE ON FUNCTION log_order_number_error TO authenticated;
GRANT EXECUTE ON FUNCTION log_order_number_error TO anon;
GRANT EXECUTE ON FUNCTION log_order_number_error TO service_role;

-- Grant permissions for the order_number_errors table
GRANT SELECT, INSERT ON order_number_errors TO authenticated;
GRANT SELECT, INSERT ON order_number_errors TO anon;
GRANT SELECT, INSERT ON order_number_errors TO service_role;

-- Verify the old trigger is gone
SELECT * FROM pg_trigger WHERE tgname = 'set_order_number_trigger';

-- Verify the new trigger is in place
SELECT * FROM pg_trigger WHERE tgname = 'validate_order_number_trigger';

-- Verify the new table was created
SELECT * FROM information_schema.tables WHERE table_name = 'order_number_errors'; 