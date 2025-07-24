/*
  # Add Area Manager and Store Manager Roles to Users
  
  This migration adds the 'area_manager' and 'store_manager' roles to the existing user role constraint
  to support the multi-level hierarchy system.
  
  Changes:
  1. Drop existing role constraint
  2. Add new constraint with all required roles
  3. Update RLS policies to include new roles
  4. Add missing columns to users table for Excel upload functionality
*/

-- Drop the existing role constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add new constraint with all required roles
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('customer', 'admin', 'regional_manager', 'area_manager', 'store_manager'));

-- Add missing columns to users table for Excel upload functionality
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_from_excel BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS excel_row_number INTEGER;

-- Add missing columns to stores table for Excel upload functionality
ALTER TABLE stores ADD COLUMN IF NOT EXISTS created_from_excel BOOLEAN DEFAULT false;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS excel_row_number INTEGER;

-- Update the users table RLS policy to include all management roles
DROP POLICY IF EXISTS "Users can read own data" ON users;

CREATE POLICY "Users can read own data" ON users
    FOR SELECT
    USING (
        auth.uid() = id OR 
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'regional_manager', 'area_manager', 'store_manager')
        )
    );

-- Update orders table RLS policy to include all management roles
DROP POLICY IF EXISTS "Users can read own orders" ON orders;

CREATE POLICY "Users can read own orders" ON orders
    FOR SELECT
    USING (
        user_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'regional_manager', 'area_manager', 'store_manager')
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
            AND role IN ('admin', 'regional_manager', 'area_manager', 'store_manager')
        )
    );

-- Add policies for users table INSERT and UPDATE operations
DROP POLICY IF EXISTS "Users can insert own data" ON users;
CREATE POLICY "Users can insert own data" ON users
    FOR INSERT
    WITH CHECK (
        auth.uid() = id OR 
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'regional_manager')
        )
    );

DROP POLICY IF EXISTS "Users can update own data" ON users;
CREATE POLICY "Users can update own data" ON users
    FOR UPDATE
    USING (
        auth.uid() = id OR 
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'regional_manager')
        )
    );

-- Add policies for stores table operations
DROP POLICY IF EXISTS "Users can read stores" ON stores;
CREATE POLICY "Users can read stores" ON stores
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'regional_manager', 'area_manager', 'store_manager')
        )
    );

DROP POLICY IF EXISTS "Users can insert stores" ON stores;
CREATE POLICY "Users can insert stores" ON stores
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'regional_manager')
        )
    );

DROP POLICY IF EXISTS "Users can update stores" ON stores;
CREATE POLICY "Users can update stores" ON stores
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'regional_manager')
        )
    );