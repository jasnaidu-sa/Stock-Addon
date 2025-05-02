-- Disable RLS on product tables or add appropriate policies
-- This ensures that product data is publicly accessible

-- List of product tables
-- Check if RLS is enabled on each table and disable it if it is

-- For mattress table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'mattress'
    ) THEN
        ALTER TABLE mattress DISABLE ROW LEVEL SECURITY;
        
        -- Drop any existing policies
        DROP POLICY IF EXISTS "Public read access for mattress" ON mattress;
        
        -- Create a public read policy
        CREATE POLICY "Public read access for mattress"
        ON mattress FOR SELECT
        TO anon, authenticated
        USING (true);
    END IF;
END
$$;

-- For furniture table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'furniture'
    ) THEN
        ALTER TABLE furniture DISABLE ROW LEVEL SECURITY;
        
        -- Drop any existing policies
        DROP POLICY IF EXISTS "Public read access for furniture" ON furniture;
        
        -- Create a public read policy
        CREATE POLICY "Public read access for furniture"
        ON furniture FOR SELECT
        TO anon, authenticated
        USING (true);
    END IF;
END
$$;

-- For accessories table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'accessories'
    ) THEN
        ALTER TABLE accessories DISABLE ROW LEVEL SECURITY;
        
        -- Drop any existing policies
        DROP POLICY IF EXISTS "Public read access for accessories" ON accessories;
        
        -- Create a public read policy
        CREATE POLICY "Public read access for accessories"
        ON accessories FOR SELECT
        TO anon, authenticated
        USING (true);
    END IF;
END
$$;

-- For foam table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'foam'
    ) THEN
        ALTER TABLE foam DISABLE ROW LEVEL SECURITY;
        
        -- Drop any existing policies
        DROP POLICY IF EXISTS "Public read access for foam" ON foam;
        
        -- Create a public read policy
        CREATE POLICY "Public read access for foam"
        ON foam FOR SELECT
        TO anon, authenticated
        USING (true);
    END IF;
END
$$; 