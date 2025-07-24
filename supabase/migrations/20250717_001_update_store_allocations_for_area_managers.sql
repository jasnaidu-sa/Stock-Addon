/*
  # Update Store Allocations for Area Managers
  
  This migration updates the regional_manager_store_allocations table to also support area managers.
  
  Changes:
  - Drop the constraint that only allows regional_manager role
  - Add new constraint to allow both regional_manager and area_manager roles
  - Update RLS policies to include area_manager role
  - Update stores table RLS policy to include area_manager role
*/

-- Drop the existing constraint that only allows regional_manager
ALTER TABLE regional_manager_store_allocations 
DROP CONSTRAINT IF EXISTS check_user_is_regional_manager;

-- Add new constraint to allow both regional_manager and area_manager roles
ALTER TABLE regional_manager_store_allocations 
ADD CONSTRAINT check_user_is_manager 
CHECK (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = user_id 
        AND role IN ('regional_manager', 'area_manager')
    )
);

-- Update the RLS policy to include area_manager role
DROP POLICY IF EXISTS "Regional managers can read their allocations" ON regional_manager_store_allocations;

CREATE POLICY "Managers can read their allocations" ON regional_manager_store_allocations
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('regional_manager', 'area_manager')
        )
    );

-- Update the stores table RLS policy to include area_manager role
DROP POLICY IF EXISTS "Regional managers can read allocated stores" ON stores;

CREATE POLICY "Managers can read allocated stores" ON stores
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM regional_manager_store_allocations rmsa
            JOIN users u ON u.id = rmsa.user_id
            WHERE rmsa.store_id = stores.id
            AND rmsa.user_id = auth.uid()
            AND rmsa.active = true
            AND u.role IN ('regional_manager', 'area_manager')
        )
    );

-- Update table comment
COMMENT ON TABLE regional_manager_store_allocations IS 'Links regional managers and area managers to their allocated stores';

-- Add area manager policy for weekly plan access
CREATE POLICY "Area managers can read weekly plan for allocated stores" ON weekly_plan
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM regional_manager_store_allocations rmsa
            JOIN users u ON u.id = rmsa.user_id
            WHERE rmsa.user_id = auth.uid()
            AND rmsa.active = true
            AND u.role = 'area_manager'
            AND EXISTS (
                SELECT 1 FROM stores s
                WHERE s.store_name = weekly_plan.store_name
                AND s.id = rmsa.store_id
            )
        )
    );

-- Add area manager policy for amendments
CREATE POLICY "Area managers can read amendments for allocated stores" ON weekly_plan_amendments
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM regional_manager_store_allocations rmsa
            JOIN users u ON u.id = rmsa.user_id
            WHERE rmsa.user_id = auth.uid()
            AND rmsa.active = true
            AND u.role = 'area_manager'
            AND rmsa.store_id = weekly_plan_amendments.store_id
        )
    );

-- Add area manager policy for amendment updates (approvals/rejections)
CREATE POLICY "Area managers can update amendments for allocated stores" ON weekly_plan_amendments
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM regional_manager_store_allocations rmsa
            JOIN users u ON u.id = rmsa.user_id
            WHERE rmsa.user_id = auth.uid()
            AND rmsa.active = true
            AND u.role = 'area_manager'
            AND rmsa.store_id = weekly_plan_amendments.store_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM regional_manager_store_allocations rmsa
            JOIN users u ON u.id = rmsa.user_id
            WHERE rmsa.user_id = auth.uid()
            AND rmsa.active = true
            AND u.role = 'area_manager'
            AND rmsa.store_id = weekly_plan_amendments.store_id
        )
    );