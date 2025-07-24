-- SECURITY FIX: Remove dangerous exec_sql function
-- This function allowed arbitrary SQL execution and was a critical security vulnerability

-- Drop the exec_sql function
DROP FUNCTION IF EXISTS exec_sql(TEXT);

-- Log the security fix
-- This ensures the dangerous function is permanently removed
COMMENT ON SCHEMA public IS 'exec_sql function removed for security - ' || now()::text;