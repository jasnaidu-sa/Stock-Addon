-- Temporarily disable RLS on the tables to help with debugging
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;

-- Note: This is a temporary measure for debugging purposes.
-- In a production environment, you would want to enable RLS and set up proper policies.
-- See the 20250408000000_add_rls_policies.sql migration for the proper RLS policies. 