-- Disable RLS on all product tables
-- This ensures that product data is publicly accessible

-- Disable RLS on mattress table
ALTER TABLE IF EXISTS mattress DISABLE ROW LEVEL SECURITY;

-- Disable RLS on furniture table
ALTER TABLE IF EXISTS furniture DISABLE ROW LEVEL SECURITY;

-- Disable RLS on accessories table
ALTER TABLE IF EXISTS accessories DISABLE ROW LEVEL SECURITY;

-- Disable RLS on foam table
ALTER TABLE IF EXISTS foam DISABLE ROW LEVEL SECURITY;

-- Disable RLS on any other product-related tables
ALTER TABLE IF EXISTS products DISABLE ROW LEVEL SECURITY; 