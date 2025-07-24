/*
  # Performance Indexes and Final Optimizations

  This migration adds additional performance indexes and optimizations
  for the weekly plan amendment system.

  Changes:
  1. Additional composite indexes for common query patterns
  2. Partial indexes for filtered queries
  3. Text search indexes for product searches
  4. Foreign key constraint optimizations
  5. Table statistics updates
*/

-- Additional composite indexes for common query patterns

-- Weekly plan amendments - common admin queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_amendments_admin_dashboard 
ON weekly_plan_amendments(status, week_reference, created_at DESC) 
WHERE status IN ('pending', 'submitted', 'admin_review');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_amendments_store_week_status 
ON weekly_plan_amendments(store_id, week_reference, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_amendments_user_week_category 
ON weekly_plan_amendments(user_id, week_reference, category);

-- Weekly plan - common queries for amendment system
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_weekly_plan_store_week_stock 
ON weekly_plan(store_name, reference, stock_code);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_weekly_plan_category_reference 
ON weekly_plan(category, reference) 
WHERE category IS NOT NULL;

-- Stores - regional manager allocation queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stores_region_active 
ON stores(region, active) 
WHERE active = true;

-- Categories - UI navigation queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_active_sorted 
ON categories(sort_order, category_name) 
WHERE active = true;

-- Regional manager allocations - access control queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_allocations_user_active_stores 
ON regional_manager_store_allocations(user_id, active) 
WHERE active = true;

-- Week selections - amendment availability queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_week_selections_active_weeks 
ON week_selections(is_active, week_start_date) 
WHERE is_active = true;

-- Text search indexes for product searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_weekly_plan_description_search 
ON weekly_plan USING gin(to_tsvector('english', description))
WHERE description IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stores_name_search 
ON stores USING gin(to_tsvector('english', store_name));

-- Partial indexes for performance on large tables
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_amendments_pending_only 
ON weekly_plan_amendments(created_at DESC) 
WHERE status = 'pending';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_amendments_current_week 
ON weekly_plan_amendments(store_id, category, stock_code) 
WHERE week_reference = (SELECT week_reference FROM week_selections WHERE is_current = true);

-- Foreign key constraint optimizations (ensure indexes exist on FK columns)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_amendments_fk_weekly_plan 
ON weekly_plan_amendments(weekly_plan_id) 
WHERE weekly_plan_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_amendments_fk_admin 
ON weekly_plan_amendments(admin_id) 
WHERE admin_id IS NOT NULL;

-- Function to refresh table statistics
CREATE OR REPLACE FUNCTION refresh_amendment_system_stats()
RETURNS void AS $$
BEGIN
    ANALYZE stores;
    ANALYZE categories;
    ANALYZE regional_manager_store_allocations;
    ANALYZE weekly_plan_amendments;
    ANALYZE week_selections;
    ANALYZE weekly_plan;
END;
$$ LANGUAGE plpgsql;

-- Create a view for common amendment dashboard queries
CREATE OR REPLACE VIEW amendment_dashboard_view AS
SELECT 
    wpa.id,
    wpa.week_reference,
    wpa.stock_code,
    wpa.category,
    wpa.amendment_type,
    wpa.original_qty,
    wpa.amended_qty,
    wpa.approved_qty,
    wpa.status,
    wpa.justification,
    wpa.admin_notes,
    wpa.created_at,
    wpa.updated_at,
    s.store_code,
    s.store_name,
    s.region,
    u.name as regional_manager_name,
    u.email as regional_manager_email,
    admin_u.name as admin_name,
    admin_u.email as admin_email,
    c.category_name,
    ws.week_start_date,
    ws.week_end_date,
    -- Calculated fields
    CASE 
        WHEN wpa.status = 'approved' THEN wpa.approved_qty
        WHEN wpa.status = 'pending' THEN wpa.amended_qty  
        ELSE 0
    END as effective_qty,
    CASE
        WHEN wpa.created_at > NOW() - INTERVAL '1 day' THEN 'new'
        WHEN wpa.created_at > NOW() - INTERVAL '3 days' THEN 'recent'
        ELSE 'older'
    END as recency_flag
FROM weekly_plan_amendments wpa
JOIN stores s ON s.id = wpa.store_id
JOIN users u ON u.id = wpa.user_id
LEFT JOIN users admin_u ON admin_u.id = wpa.admin_id
LEFT JOIN categories c ON c.category_code = wpa.category
LEFT JOIN week_selections ws ON ws.week_reference = wpa.week_reference;

-- Grant access to the view
GRANT SELECT ON amendment_dashboard_view TO authenticated;

-- Create RLS policy for the view
ALTER VIEW amendment_dashboard_view SET (security_barrier = true);

-- Index on the view's common filter columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dashboard_view_filters 
ON weekly_plan_amendments(status, week_reference, store_id, category);

-- Function to get amendment statistics
CREATE OR REPLACE FUNCTION get_amendment_statistics(
    p_week_reference VARCHAR(50) DEFAULT NULL,
    p_store_id UUID DEFAULT NULL
)
RETURNS TABLE(
    total_amendments INTEGER,
    pending_amendments INTEGER,
    approved_amendments INTEGER,
    rejected_amendments INTEGER,
    total_requested_qty INTEGER,
    total_approved_qty INTEGER,
    most_amended_category VARCHAR(50),
    busiest_store VARCHAR(200)
) AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT 
            COUNT(*)::INTEGER as total,
            COUNT(*) FILTER (WHERE status = 'pending')::INTEGER as pending,
            COUNT(*) FILTER (WHERE status = 'approved')::INTEGER as approved,
            COUNT(*) FILTER (WHERE status = 'rejected')::INTEGER as rejected,
            SUM(amended_qty)::INTEGER as total_requested,
            SUM(CASE WHEN status = 'approved' THEN COALESCE(approved_qty, amended_qty) ELSE 0 END)::INTEGER as total_approved
        FROM weekly_plan_amendments wpa
        WHERE (p_week_reference IS NULL OR wpa.week_reference = p_week_reference)
        AND (p_store_id IS NULL OR wpa.store_id = p_store_id)
    ),
    category_stats AS (
        SELECT category
        FROM weekly_plan_amendments wpa
        WHERE (p_week_reference IS NULL OR wpa.week_reference = p_week_reference)
        AND (p_store_id IS NULL OR wpa.store_id = p_store_id)
        GROUP BY category
        ORDER BY COUNT(*) DESC
        LIMIT 1
    ),
    store_stats AS (
        SELECT s.store_name
        FROM weekly_plan_amendments wpa
        JOIN stores s ON s.id = wpa.store_id
        WHERE (p_week_reference IS NULL OR wpa.week_reference = p_week_reference)
        AND (p_store_id IS NULL OR wpa.store_id = p_store_id)
        GROUP BY s.store_name
        ORDER BY COUNT(*) DESC
        LIMIT 1
    )
    SELECT 
        st.total,
        st.pending,
        st.approved,
        st.rejected,
        st.total_requested,
        st.total_approved,
        cs.category,
        ss.store_name
    FROM stats st
    CROSS JOIN category_stats cs
    CROSS JOIN store_stats ss;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_amendment_statistics(VARCHAR(50), UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_amendment_system_stats() TO authenticated;

-- Refresh statistics for the new tables
SELECT refresh_amendment_system_stats();

-- Add comments for documentation
COMMENT ON VIEW amendment_dashboard_view IS 'Comprehensive view for amendment dashboard with all related data';
COMMENT ON FUNCTION get_amendment_statistics(VARCHAR(50), UUID) IS 'Get amendment statistics for dashboards and reports';
COMMENT ON FUNCTION refresh_amendment_system_stats() IS 'Refresh table statistics for optimal query planning';