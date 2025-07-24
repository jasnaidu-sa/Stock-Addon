-- Create a function to create the order_sequence table if it doesn't exist
CREATE OR REPLACE FUNCTION create_order_sequence_if_not_exists()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the table exists
  IF NOT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'order_sequence'
  ) THEN
    -- Create the table
    CREATE TABLE public.order_sequence (
      id SERIAL PRIMARY KEY,
      current_value INTEGER NOT NULL DEFAULT 1000,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Insert the initial value
    INSERT INTO public.order_sequence (current_value) VALUES (1000);
    
    -- Create a trigger to update the timestamp
    EXECUTE '
      CREATE OR REPLACE FUNCTION update_order_sequence_timestamp()
      RETURNS TRIGGER AS $func$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $func$ LANGUAGE plpgsql;
      
      DROP TRIGGER IF EXISTS update_order_sequence_timestamp ON order_sequence;
      CREATE TRIGGER update_order_sequence_timestamp
      BEFORE UPDATE ON order_sequence
      FOR EACH ROW
      EXECUTE FUNCTION update_order_sequence_timestamp();
    ';
    
    RETURN TRUE;
  ELSE
    -- Table already exists
    RETURN FALSE;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_order_sequence_if_not_exists() TO authenticated;
GRANT EXECUTE ON FUNCTION create_order_sequence_if_not_exists() TO anon;

-- Add comment for documentation
COMMENT ON FUNCTION create_order_sequence_if_not_exists() IS 'Creates the order_sequence table if it does not exist yet'; 