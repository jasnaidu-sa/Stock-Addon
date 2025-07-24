-- Ensure the order_sequence table exists
CREATE TABLE IF NOT EXISTS order_sequence (
  id SERIAL PRIMARY KEY,
  current_value INTEGER NOT NULL DEFAULT 1000
);

-- Create a function to create the order_sequence table if it doesn't exist
CREATE OR REPLACE FUNCTION create_order_sequence_if_not_exists()
RETURNS VOID AS $$
BEGIN
  -- Check if the table exists
  IF NOT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'order_sequence'
  ) THEN
    -- Create the table
    CREATE TABLE order_sequence (
      id SERIAL PRIMARY KEY,
      current_value INTEGER NOT NULL DEFAULT 1000
    );
    
    -- Insert the initial value
    INSERT INTO order_sequence (current_value) VALUES (1000);
  END IF;
END;
$$ LANGUAGE plpgsql; 