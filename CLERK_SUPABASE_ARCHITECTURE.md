# Clerk + Supabase Architecture - Correct Implementation

## Intended Architecture

### **Authentication System**
- **Clerk**: Primary authentication system that handles user login, registration, password management
- **Supabase Users Table**: Role and profile management - determines user permissions within the application

### **Correct Flow**
1. **User Authentication**: Handled entirely by Clerk
   - Login/logout via Clerk
   - Password resets via Clerk
   - Session management via Clerk

2. **Role Determination**: Via Supabase `users` table
   - `users.clerk_id` → links to Clerk user
   - `users.role` → determines admin/customer permissions
   - `users.group_type`, `users.company_name` → additional business logic

3. **Data Access**: Supabase with Clerk JWT tokens
   - Clerk provides JWT tokens
   - Supabase RLS policies should use Clerk user ID from JWT
   - Role-based permissions enforced via `users` table lookup

## Current Implementation Issues

### **RLS Policy Problem**
The current RLS policies are trying to use `auth.uid()` which doesn't work with Clerk tokens:

```sql
-- THIS DOESN'T WORK with Clerk
CREATE POLICY "Users can view own orders" ON orders
FOR SELECT TO authenticated
USING (auth.uid() = user_id);
```

### **What Should Work**
RLS policies should extract the Clerk user ID from the JWT token and look up the user:

```sql
-- CORRECT approach for Clerk + Supabase
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
DECLARE
  clerk_user_id text;
  user_uuid uuid;
BEGIN
  -- Extract Clerk user ID from JWT
  clerk_user_id := NULLIF(current_setting('request.jwt.claims', true)::json ->> 'sub', '');
  
  IF clerk_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Look up Supabase user ID from Clerk ID
  SELECT id INTO user_uuid FROM users WHERE clerk_id = clerk_user_id;
  
  RETURN user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Now policies can work correctly
CREATE POLICY "Users can view own orders" ON orders
FOR SELECT TO authenticated
USING (user_id = get_current_user_id());
```

### **Admin Role Check**
Admin permissions should be determined by querying the `users` table:

```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
DECLARE
  user_role text;
  clerk_user_id text;
BEGIN
  clerk_user_id := NULLIF(current_setting('request.jwt.claims', true)::json ->> 'sub', '');
  
  IF clerk_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  SELECT role INTO user_role FROM users WHERE clerk_id = clerk_user_id;
  
  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin policies
CREATE POLICY "Admins can access all orders" ON orders
FOR ALL TO authenticated
USING (is_admin());
```

## User Management Process

### **Admin Creates Users**
1. Admin uses the user creation form
2. Edge Function `admin-create-user` is called
3. Function creates user in Clerk first
4. If successful, creates record in Supabase `users` table with `clerk_id` reference
5. Role and permissions stored in Supabase, authentication handled by Clerk

### **User Login**
1. User logs in via Clerk
2. Clerk provides JWT token with `sub` claim (Clerk user ID)
3. Application queries Supabase `users` table to get role and permissions
4. Role-based UI rendering and access control

## Benefits of This Architecture

1. **Single Source of Authentication**: Clerk handles all auth complexity
2. **Flexible Role Management**: Business logic and roles in your database
3. **Secure Token Handling**: Clerk's JWT tokens are cryptographically secure
4. **Scalable**: Can add complex role hierarchies in Supabase without touching auth

## Current Fixes Needed

1. **Fix RLS Policies**: Implement functions to work with Clerk user IDs
2. **Update Edge Functions**: Ensure proper JWT verification (currently missing)
3. **Synchronization**: Ensure Clerk and Supabase user data stays in sync
4. **Error Handling**: Handle cases where Clerk user exists but Supabase record doesn't

This architecture is actually quite sophisticated and well-designed - it just needs the RLS policies and JWT handling to be implemented correctly!