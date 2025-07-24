-- Create a function to execute arbitrary SQL
-- This provides a way to bypass schema cache issues
CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT) 
RETURNS SETOF json AS $$
DECLARE
  result json;
BEGIN
  -- Execute the query and return results
  FOR result IN EXECUTE sql_query
  LOOP
    RETURN NEXT result;
  END LOOP;
  
  -- If no results were returned but the query executed successfully
  -- Return an empty JSON object to indicate success
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  RETURN;
EXCEPTION WHEN OTHERS THEN
  -- Return the error as JSON
  RETURN NEXT json_build_object('error', SQLERRM, 'query', sql_query);
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role; 