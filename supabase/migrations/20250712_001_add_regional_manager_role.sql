/*
  # Add Regional Manager Role to Users

  This migration adds the 'regional_manager' role to the existing user role constraint
  to support the weekly plans amendment system.

  Changes:
  1. Drop existing role constraint
  2. Add new constraint with regional_manager role
  3. Update RLS policies to include regional_manager access
*/

-- Drop the existing role constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add new constraint with regional_manager role
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('customer', 'admin', 'regional_manager'));

-- Update the users table RLS policy to include regional_manager access
DROP POLICY IF EXISTS "Users can read own data" ON users;

CREATE POLICY "Users can read own data" ON users
    FOR SELECT
    USING (
        auth.uid() = id OR 
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'regional_manager')
        )
    );

-- Update orders table RLS policy to include regional_manager access  
DROP POLICY IF EXISTS "Users can read own orders" ON orders;

CREATE POLICY "Users can read own orders" ON orders
    FOR SELECT
    USING (
        user_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'regional_manager')
        )
    );

DROP POLICY IF EXISTS "Users can update pending orders" ON orders;

CREATE POLICY "Users can update pending orders" ON orders
    FOR UPDATE
    USING (
        (status = 'pending' AND user_id = auth.uid()) OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'regional_manager')
        )
    );