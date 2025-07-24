/*
  # Additional RLS Policies and Helper Functions

  This migration adds additional RLS policies for the weekly plan amendment system
  and helper functions for common operations.

  Changes:
  1. Update weekly_plan RLS policies to support regional managers
  2. Add helper functions for common queries
  3. Add validation functions
  4. Add audit trail functions
*/

-- Update weekly_plan RLS policy to include regional managers for their allocated stores
DROP POLICY IF EXISTS "Enable read access for all users" ON weekly_plan;

CREATE POLICY "Admins can read all weekly plans" ON weekly_plan
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

CREATE POLICY "Regional managers can read plans for allocated stores" ON weekly_plan
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM regional_manager_store_allocations rmsa
            JOIN users u ON u.id = rmsa.user_id
            WHERE rmsa.store_id IN (
                SELECT s.id FROM stores s WHERE s.store_name = weekly_plan.store_name
            )
            AND rmsa.user_id = auth.uid()
            AND rmsa.active = true
            AND u.role = 'regional_manager'
        )
    );

-- Helper function to get stores for a regional manager
CREATE OR REPLACE FUNCTION get_regional_manager_stores(user_uuid UUID)
RETURNS TABLE(
    store_id UUID,
    store_code VARCHAR(50),
    store_name VARCHAR(200),
    region VARCHAR(100)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.store_code,
        s.store_name,
        s.region
    FROM stores s
    JOIN regional_manager_store_allocations rmsa ON rmsa.store_id = s.id
    WHERE rmsa.user_id = user_uuid 
    AND rmsa.active = true
    AND s.active = true
    ORDER BY s.store_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user can access a store
CREATE OR REPLACE FUNCTION can_user_access_store(user_uuid UUID, target_store_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role_val TEXT;
    has_access BOOLEAN := false;
BEGIN
    -- Get user role
    SELECT role INTO user_role_val 
    FROM users 
    WHERE id = user_uuid;
    
    -- Admin can access all stores
    IF user_role_val = 'admin' THEN
        RETURN true;
    END IF;
    
    -- Regional manager can access allocated stores
    IF user_role_val = 'regional_manager' THEN
        SELECT EXISTS(
            SELECT 1 FROM regional_manager_store_allocations
            WHERE user_id = user_uuid 
            AND store_id = target_store_id
            AND active = true
        ) INTO has_access;
        
        RETURN has_access;
    END IF;
    
    -- Other roles have no access
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current active week
CREATE OR REPLACE FUNCTION get_current_week()
RETURNS TABLE(
    week_reference VARCHAR(50),
    week_start_date DATE,
    week_end_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ws.week_reference,
        ws.week_start_date,
        ws.week_end_date
    FROM week_selections ws
    WHERE ws.is_current = true
    AND ws.is_active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate amendment request
CREATE OR REPLACE FUNCTION validate_amendment_request(
    p_user_id UUID,
    p_store_id UUID,
    p_week_reference VARCHAR(50),
    p_amended_qty INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    is_valid BOOLEAN := true;
    user_role_val TEXT;
    week_active BOOLEAN;
BEGIN
    -- Check user role
    SELECT role INTO user_role_val 
    FROM users 
    WHERE id = p_user_id;
    
    IF user_role_val NOT IN ('admin', 'regional_manager') THEN
        RETURN false;
    END IF;
    
    -- Check if user can access store
    IF NOT can_user_access_store(p_user_id, p_store_id) THEN
        RETURN false;
    END IF;
    
    -- Check if week is active for amendments
    SELECT is_active INTO week_active
    FROM week_selections
    WHERE week_reference = p_week_reference;
    
    IF NOT COALESCE(week_active, false) THEN
        RETURN false;
    END IF;
    
    -- Check if quantity is valid (non-negative)
    IF p_amended_qty < 0 THEN
        RETURN false;
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to apply approved amendment to weekly plan
CREATE OR REPLACE FUNCTION apply_amendment_to_weekly_plan(
    p_amendment_id UUID,
    p_approved_qty INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    amendment_record RECORD;
    weekly_plan_exists BOOLEAN := false;
BEGIN
    -- Get amendment details
    SELECT * INTO amendment_record
    FROM weekly_plan_amendments
    WHERE id = p_amendment_id
    AND status = 'approved';
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Check if weekly plan record exists
    SELECT EXISTS(
        SELECT 1 FROM weekly_plan wp
        JOIN stores s ON s.store_name = wp.store_name
        WHERE s.id = amendment_record.store_id
        AND wp.stock_code = amendment_record.stock_code
        AND wp.reference = amendment_record.week_reference
    ) INTO weekly_plan_exists;
    
    IF weekly_plan_exists THEN
        -- Update existing weekly plan record
        UPDATE weekly_plan 
        SET 
            add_ons_qty = COALESCE(add_ons_qty, 0) + p_approved_qty,
            act_order_qty = COALESCE(order_qty, 0) + COALESCE(add_ons_qty, 0) + p_approved_qty,
            updated_at = NOW()
        FROM stores s
        WHERE s.store_name = weekly_plan.store_name
        AND s.id = amendment_record.store_id
        AND weekly_plan.stock_code = amendment_record.stock_code
        AND weekly_plan.reference = amendment_record.week_reference;
    ELSE
        -- Create new weekly plan record for amendment
        INSERT INTO weekly_plan (
            reference,
            start_date,
            store_name,
            stock_code,
            category,
            order_qty,
            add_ons_qty,
            act_order_qty,
            created_at,
            updated_at
        )
        SELECT 
            amendment_record.week_reference,
            amendment_record.week_start_date,
            s.store_name,
            amendment_record.stock_code,
            amendment_record.category,
            0,
            p_approved_qty,
            p_approved_qty,
            NOW(),
            NOW()
        FROM stores s
        WHERE s.id = amendment_record.store_id;
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_regional_manager_stores(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_user_access_store(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_week() TO authenticated;
GRANT EXECUTE ON FUNCTION validate_amendment_request(UUID, UUID, VARCHAR(50), INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_amendment_to_weekly_plan(UUID, INTEGER) TO authenticated;