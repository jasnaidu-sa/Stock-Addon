-- Fix duplicate key error in update_hierarchical_submission_status function
-- 
-- Problem: The function was checking for existing records using (store_id, week_reference)
-- but the unique constraint that was failing is on (user_id, week_reference, submission_type)
--
-- This caused duplicate key violations when the same user tried to submit for multiple stores
-- in the same week with the same submission type.
--
-- Solution: Check for existing records using the actual unique constraint columns.

DROP FUNCTION IF EXISTS update_hierarchical_submission_status(uuid,text,text,text,uuid);

CREATE OR REPLACE FUNCTION update_hierarchical_submission_status(
    p_store_id UUID,
    p_week_reference TEXT,
    p_level TEXT,
    p_status TEXT,
    p_manager_id UUID
) RETURNS void AS $$
DECLARE
    v_week_start_date DATE;
    v_existing_record RECORD;
    v_submission_type TEXT;
BEGIN
    -- Generate submission type
    v_submission_type := p_level || '_submission';
    
    -- Get week start date
    SELECT week_start_date INTO v_week_start_date
    FROM week_selections
    WHERE week_reference = p_week_reference;

    -- Check if record exists using the actual unique constraint
    -- (user_id, week_reference, submission_type) instead of (store_id, week_reference)
    SELECT * INTO v_existing_record
    FROM weekly_plan_submissions
    WHERE user_id = p_manager_id 
    AND week_reference = p_week_reference 
    AND submission_type = v_submission_type;

    IF v_existing_record IS NULL THEN
        -- Insert new record
        INSERT INTO weekly_plan_submissions (
            store_id, 
            week_reference,
            week_start_date,
            user_id,
            submission_type,
            store_submission_status,
            area_submission_status,
            regional_submission_status,
            admin_submission_status,
            store_manager_id,
            area_manager_id,
            regional_manager_id,
            store_submitted_at,
            area_submitted_at,
            regional_submitted_at,
            admin_submitted_at
        ) VALUES (
            p_store_id,
            p_week_reference,
            v_week_start_date,
            p_manager_id,
            v_submission_type,
            CASE WHEN p_level = 'store' THEN p_status ELSE 'not_submitted' END,
            CASE WHEN p_level = 'area' THEN p_status ELSE 'not_submitted' END,
            CASE WHEN p_level = 'regional' THEN p_status ELSE 'not_submitted' END,
            CASE WHEN p_level = 'admin' THEN p_status ELSE 'not_submitted' END,
            CASE WHEN p_level = 'store' THEN p_manager_id END,
            CASE WHEN p_level = 'area' THEN p_manager_id END,
            CASE WHEN p_level = 'regional' THEN p_manager_id END,
            CASE WHEN p_level = 'store' AND p_status = 'submitted' THEN NOW() END,
            CASE WHEN p_level = 'area' AND p_status = 'submitted' THEN NOW() END,
            CASE WHEN p_level = 'regional' AND p_status = 'submitted' THEN NOW() END,
            CASE WHEN p_level = 'admin' AND p_status = 'submitted' THEN NOW() END
        );
    ELSE
        -- Update existing record
        UPDATE weekly_plan_submissions SET
            store_id = p_store_id, -- Update to current store being submitted
            week_start_date = COALESCE(v_week_start_date, week_start_date),
            store_submission_status = CASE WHEN p_level = 'store' THEN p_status ELSE store_submission_status END,
            area_submission_status = CASE WHEN p_level = 'area' THEN p_status ELSE area_submission_status END,
            regional_submission_status = CASE WHEN p_level = 'regional' THEN p_status ELSE regional_submission_status END,
            admin_submission_status = CASE WHEN p_level = 'admin' THEN p_status ELSE admin_submission_status END,
            
            store_manager_id = CASE WHEN p_level = 'store' THEN p_manager_id ELSE store_manager_id END,
            area_manager_id = CASE WHEN p_level = 'area' THEN p_manager_id ELSE area_manager_id END,
            regional_manager_id = CASE WHEN p_level = 'regional' THEN p_manager_id ELSE regional_manager_id END,
            
            store_submitted_at = CASE WHEN p_level = 'store' AND p_status = 'submitted' THEN NOW() ELSE store_submitted_at END,
            area_submitted_at = CASE WHEN p_level = 'area' AND p_status = 'submitted' THEN NOW() ELSE area_submitted_at END,
            regional_submitted_at = CASE WHEN p_level = 'regional' AND p_status = 'submitted' THEN NOW() ELSE regional_submitted_at END,
            admin_submitted_at = CASE WHEN p_level = 'admin' AND p_status = 'submitted' THEN NOW() ELSE admin_submitted_at END,
            
            updated_at = NOW()
        WHERE user_id = p_manager_id 
        AND week_reference = p_week_reference 
        AND submission_type = v_submission_type;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_hierarchical_submission_status(uuid,text,text,text,uuid) TO authenticated;

COMMENT ON FUNCTION update_hierarchical_submission_status IS 'Updates hierarchical submission status for weekly plans. Fixed to properly handle unique constraint on (user_id, week_reference, submission_type).';