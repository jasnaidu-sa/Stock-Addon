-- Ensure all tables have public access by default
-- This is a more general approach to fix access issues

-- Function to disable RLS on all tables
CREATE OR REPLACE FUNCTION disable_rls_on_all_tables() RETURNS void AS $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', table_record.tablename);
        RAISE NOTICE 'Disabled RLS on table: %', table_record.tablename;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to disable RLS on all tables
SELECT disable_rls_on_all_tables();

-- Drop the function after use
DROP FUNCTION disable_rls_on_all_tables();

-- Create a trigger to automatically disable RLS on new tables
CREATE OR REPLACE FUNCTION disable_rls_on_new_table() RETURNS event_trigger AS $$
DECLARE
    obj RECORD;
BEGIN
    FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE command_tag = 'CREATE TABLE'
    LOOP
        -- Extract the table name from the object identity
        DECLARE
            table_name text;
        BEGIN
            table_name := substring(obj.object_identity from '"([^"]+)"$');
            IF table_name IS NULL THEN
                table_name := substring(obj.object_identity from '([^.]+)$');
            END IF;
            
            IF table_name IS NOT NULL THEN
                EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', table_name);
                RAISE NOTICE 'Automatically disabled RLS on new table: %', table_name;
            END IF;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create the event trigger
DROP EVENT TRIGGER IF EXISTS disable_rls_trigger;
CREATE EVENT TRIGGER disable_rls_trigger ON ddl_command_end
WHEN TAG IN ('CREATE TABLE')
EXECUTE FUNCTION disable_rls_on_new_table(); 