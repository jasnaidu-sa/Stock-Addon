-- Ensure product tables are accessible by disabling RLS

-- Disable RLS on mattresses table
ALTER TABLE IF EXISTS mattresses DISABLE ROW LEVEL SECURITY;

-- Disable RLS on furniture table
ALTER TABLE IF EXISTS furniture DISABLE ROW LEVEL SECURITY;

-- Disable RLS on accessories table
ALTER TABLE IF EXISTS accessories DISABLE ROW LEVEL SECURITY;

-- Disable RLS on foam table
ALTER TABLE IF EXISTS foam DISABLE ROW LEVEL SECURITY;

-- Create a function to check if a table exists
CREATE OR REPLACE FUNCTION table_exists(table_name TEXT) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = table_name
  );
END;
$$ LANGUAGE plpgsql; 