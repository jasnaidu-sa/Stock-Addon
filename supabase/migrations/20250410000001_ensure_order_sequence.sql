-- Ensure the order_sequence table exists
CREATE TABLE IF NOT EXISTS order_sequence (
  id SERIAL PRIMARY KEY,
  current_value INTEGER NOT NULL
);

-- Insert initial value if table is empty
INSERT INTO order_sequence (id, current_value)
SELECT 1, 1000
WHERE NOT EXISTS (SELECT 1 FROM order_sequence);

-- Create a function to check and create the order_sequence table if it doesn't exist
CREATE OR REPLACE FUNCTION ensure_order_sequence() RETURNS void AS $$
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
      current_value INTEGER NOT NULL
    );
    
    -- Insert initial value
    INSERT INTO order_sequence (id, current_value)
    VALUES (1, 1000);
  END IF;
END;
$$ LANGUAGE plpgsql; 