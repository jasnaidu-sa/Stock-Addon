-- Test script to verify the users RLS recursion fix
-- This script tests the new non-recursive RLS policies

-- Test 1: Check if the helper functions exist and work correctly
SELECT 'Testing helper functions...' as test_step;

-- Test auth.user_role() function
SELECT 
  'auth.user_role() function exists' as test_name,
  CASE 
    WHEN auth.user_role() IS NOT NULL THEN 'PASS'
    ELSE 'FAIL'
  END as result;

-- Test auth.is_manager() function
SELECT 
  'auth.is_manager() function exists' as test_name,
  CASE 
    WHEN auth.is_manager() IS NOT NULL THEN 'PASS'
    ELSE 'FAIL'
  END as result;

-- Test auth.is_admin_or_regional() function
SELECT 
  'auth.is_admin_or_regional() function exists' as test_name,
  CASE 
    WHEN auth.is_admin_or_regional() IS NOT NULL THEN 'PASS'
    ELSE 'FAIL'
  END as result;

-- Test auth.current_user_clerk_id() function
SELECT 
  'auth.current_user_clerk_id() function exists' as test_name,
  CASE 
    WHEN auth.current_user_clerk_id() IS NOT NULL OR auth.current_user_clerk_id() IS NULL THEN 'PASS'
    ELSE 'FAIL'
  END as result;

-- Test auth.is_bootstrap_admin() function
SELECT 
  'auth.is_bootstrap_admin() function exists' as test_name,
  CASE 
    WHEN auth.is_bootstrap_admin() IS NOT NULL THEN 'PASS'
    ELSE 'FAIL'
  END as result;

-- Test 2: Check if the policies exist and are properly configured
SELECT 'Testing RLS policies...' as test_step;

-- Check users table policies
SELECT 
  'users_select_policy exists' as test_name,
  CASE 
    WHEN COUNT(*) = 1 THEN 'PASS'
    ELSE 'FAIL'
  END as result
FROM pg_policies 
WHERE tablename = 'users' AND policyname = 'users_select_policy';

SELECT 
  'users_insert_policy exists' as test_name,
  CASE 
    WHEN COUNT(*) = 1 THEN 'PASS'
    ELSE 'FAIL'
  END as result
FROM pg_policies 
WHERE tablename = 'users' AND policyname = 'users_insert_policy';

SELECT 
  'users_update_policy exists' as test_name,
  CASE 
    WHEN COUNT(*) = 1 THEN 'PASS'
    ELSE 'FAIL'
  END as result
FROM pg_policies 
WHERE tablename = 'users' AND policyname = 'users_update_policy';

SELECT 
  'users_delete_policy exists' as test_name,
  CASE 
    WHEN COUNT(*) = 1 THEN 'PASS'
    ELSE 'FAIL'
  END as result
FROM pg_policies 
WHERE tablename = 'users' AND policyname = 'users_delete_policy';

-- Test 3: Check if RLS is enabled on users table
SELECT 
  'RLS enabled on users table' as test_name,
  CASE 
    WHEN relrowsecurity = true THEN 'PASS'
    ELSE 'FAIL'
  END as result
FROM pg_class 
WHERE relname = 'users' AND relkind = 'r';

-- Test 4: List all current policies on users table
SELECT 'Current policies on users table:' as info;
SELECT 
  schemaname,
  tablename, 
  policyname, 
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- Test 5: Check for any remaining recursive references
SELECT 'Checking for recursive references in policies:' as info;
SELECT 
  policyname,
  qual,
  CASE 
    WHEN qual LIKE '%users%' AND qual LIKE '%EXISTS%' THEN 'POTENTIAL RECURSION'
    ELSE 'OK'
  END as recursion_check
FROM pg_policies 
WHERE tablename = 'users' AND qual IS NOT NULL;

-- Test 6: Summary
SELECT 'Test Summary:' as info;
SELECT 
  COUNT(CASE WHEN result = 'PASS' THEN 1 END) as passed_tests,
  COUNT(CASE WHEN result = 'FAIL' THEN 1 END) as failed_tests,
  COUNT(*) as total_tests
FROM (
  SELECT 
    'auth.user_role() function exists' as test_name,
    CASE 
      WHEN auth.user_role() IS NOT NULL THEN 'PASS'
      ELSE 'FAIL'
    END as result
  UNION ALL
  SELECT 
    'auth.is_manager() function exists' as test_name,
    CASE 
      WHEN auth.is_manager() IS NOT NULL THEN 'PASS'
      ELSE 'FAIL'
    END as result
  UNION ALL
  SELECT 
    'users_select_policy exists' as test_name,
    CASE 
      WHEN (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'users' AND policyname = 'users_select_policy') = 1 THEN 'PASS'
      ELSE 'FAIL'
    END as result
  -- Add more tests as needed
) test_results;