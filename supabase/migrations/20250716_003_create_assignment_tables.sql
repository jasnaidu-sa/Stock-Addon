/*
  # Create Assignment Tables for Multi-Level Hierarchy
  
  This migration creates the assignment tables needed for the hierarchy upload system.
  These tables manage the relationships between different levels of management and stores.
  
  Tables created:
  1. store_manager_assignments - Links store managers to stores
  2. area_manager_store_assignments - Links area managers to stores  
  3. regional_manager_assignments - Links regional managers to stores
  4. regional_area_manager_assignments - Links regional managers to area managers
  
  Each table includes:
  - Assignment tracking (source, status, timestamps)
  - RLS policies for security
  - Proper foreign key constraints
  - Performance indexes
*/

-- 1. Store Manager Assignments Table
CREATE TABLE store_manager_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    store_manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assignment_source VARCHAR(50) DEFAULT 'manual' CHECK (assignment_source IN ('manual', 'excel_upload', 'api')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deactivated_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure only one active assignment per store
    UNIQUE(store_id, status) DEFERRABLE INITIALLY DEFERRED
);

-- 2. Area Manager Store Assignments Table
CREATE TABLE area_manager_store_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    area_manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assignment_source VARCHAR(50) DEFAULT 'manual' CHECK (assignment_source IN ('manual', 'excel_upload', 'api')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deactivated_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Allow multiple area managers per store (different from store manager)
    UNIQUE(store_id, area_manager_id, status) DEFERRABLE INITIALLY DEFERRED
);

-- 3. Regional Manager Assignments Table (for stores)
CREATE TABLE regional_manager_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    regional_manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assignment_source VARCHAR(50) DEFAULT 'manual' CHECK (assignment_source IN ('manual', 'excel_upload', 'api')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deactivated_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Allow multiple regional managers per store if needed
    UNIQUE(store_id, regional_manager_id, status) DEFERRABLE INITIALLY DEFERRED
);

-- 4. Regional Manager to Area Manager Assignments Table
CREATE TABLE regional_area_manager_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    regional_manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    area_manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assignment_source VARCHAR(50) DEFAULT 'manual' CHECK (assignment_source IN ('manual', 'excel_upload', 'api')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deactivated_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique active assignments
    UNIQUE(regional_manager_id, area_manager_id, status) DEFERRABLE INITIALLY DEFERRED
);

-- Create updated_at triggers for all tables
CREATE TRIGGER update_store_manager_assignments_updated_at
    BEFORE UPDATE ON store_manager_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_area_manager_store_assignments_updated_at
    BEFORE UPDATE ON area_manager_store_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_regional_manager_assignments_updated_at
    BEFORE UPDATE ON regional_manager_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_regional_area_manager_assignments_updated_at
    BEFORE UPDATE ON regional_area_manager_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create performance indexes
-- Store Manager Assignments
CREATE INDEX idx_store_manager_assignments_store_id ON store_manager_assignments(store_id);
CREATE INDEX idx_store_manager_assignments_manager_id ON store_manager_assignments(store_manager_id);
CREATE INDEX idx_store_manager_assignments_status ON store_manager_assignments(status);
CREATE INDEX idx_store_manager_assignments_source ON store_manager_assignments(assignment_source);

-- Area Manager Store Assignments
CREATE INDEX idx_area_manager_store_assignments_store_id ON area_manager_store_assignments(store_id);
CREATE INDEX idx_area_manager_store_assignments_manager_id ON area_manager_store_assignments(area_manager_id);
CREATE INDEX idx_area_manager_store_assignments_status ON area_manager_store_assignments(status);
CREATE INDEX idx_area_manager_store_assignments_source ON area_manager_store_assignments(assignment_source);

-- Regional Manager Assignments
CREATE INDEX idx_regional_manager_assignments_store_id ON regional_manager_assignments(store_id);
CREATE INDEX idx_regional_manager_assignments_manager_id ON regional_manager_assignments(regional_manager_id);
CREATE INDEX idx_regional_manager_assignments_status ON regional_manager_assignments(status);
CREATE INDEX idx_regional_manager_assignments_source ON regional_manager_assignments(assignment_source);

-- Regional Area Manager Assignments
CREATE INDEX idx_regional_area_assignments_regional_id ON regional_area_manager_assignments(regional_manager_id);
CREATE INDEX idx_regional_area_assignments_area_id ON regional_area_manager_assignments(area_manager_id);
CREATE INDEX idx_regional_area_assignments_status ON regional_area_manager_assignments(status);
CREATE INDEX idx_regional_area_assignments_source ON regional_area_manager_assignments(assignment_source);

-- Enable RLS on all tables
ALTER TABLE store_manager_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE area_manager_store_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE regional_manager_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE regional_area_manager_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Store Manager Assignments
CREATE POLICY "Admins can manage store manager assignments" ON store_manager_assignments
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Regional managers can read store manager assignments" ON store_manager_assignments
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role IN ('regional_manager', 'area_manager')
        )
    );

CREATE POLICY "Store managers can read own assignments" ON store_manager_assignments
    FOR SELECT TO authenticated
    USING (
        store_manager_id = auth.uid()
    );

-- RLS Policies for Area Manager Store Assignments
CREATE POLICY "Admins can manage area manager store assignments" ON area_manager_store_assignments
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Regional managers can read area manager store assignments" ON area_manager_store_assignments
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'regional_manager'
        )
    );

CREATE POLICY "Area managers can read own store assignments" ON area_manager_store_assignments
    FOR SELECT TO authenticated
    USING (
        area_manager_id = auth.uid()
    );

-- RLS Policies for Regional Manager Assignments
CREATE POLICY "Admins can manage regional manager assignments" ON regional_manager_assignments
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Regional managers can read own assignments" ON regional_manager_assignments
    FOR SELECT TO authenticated
    USING (
        regional_manager_id = auth.uid()
    );

-- RLS Policies for Regional Area Manager Assignments
CREATE POLICY "Admins can manage regional area manager assignments" ON regional_area_manager_assignments
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Regional managers can read own area manager assignments" ON regional_area_manager_assignments
    FOR SELECT TO authenticated
    USING (
        regional_manager_id = auth.uid()
    );

CREATE POLICY "Area managers can read own regional manager assignments" ON regional_area_manager_assignments
    FOR SELECT TO authenticated
    USING (
        area_manager_id = auth.uid()
    );

-- Add role validation constraints
ALTER TABLE store_manager_assignments 
ADD CONSTRAINT check_store_manager_role 
CHECK (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = store_manager_id AND role = 'store_manager'
    )
);

ALTER TABLE area_manager_store_assignments 
ADD CONSTRAINT check_area_manager_role 
CHECK (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = area_manager_id AND role = 'area_manager'
    )
);

ALTER TABLE regional_manager_assignments 
ADD CONSTRAINT check_regional_manager_role 
CHECK (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = regional_manager_id AND role = 'regional_manager'
    )
);

ALTER TABLE regional_area_manager_assignments 
ADD CONSTRAINT check_regional_manager_role_in_assignment 
CHECK (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = regional_manager_id AND role = 'regional_manager'
    )
);

ALTER TABLE regional_area_manager_assignments 
ADD CONSTRAINT check_area_manager_role_in_assignment 
CHECK (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = area_manager_id AND role = 'area_manager'
    )
);

-- Add table comments
COMMENT ON TABLE store_manager_assignments IS 'Links store managers to their assigned stores';
COMMENT ON TABLE area_manager_store_assignments IS 'Links area managers to stores they oversee';
COMMENT ON TABLE regional_manager_assignments IS 'Links regional managers to stores in their region';
COMMENT ON TABLE regional_area_manager_assignments IS 'Links regional managers to area managers they supervise';

-- Create support tables for logging
CREATE TABLE IF NOT EXISTS excel_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_id UUID NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    total_rows_processed INTEGER DEFAULT 0,
    users_created INTEGER DEFAULT 0,
    users_updated INTEGER DEFAULT 0,
    stores_created INTEGER DEFAULT 0,
    stores_updated INTEGER DEFAULT 0,
    assignments_created INTEGER DEFAULT 0,
    conflicts_found INTEGER DEFAULT 0,
    sync_status VARCHAR(20) DEFAULT 'started' CHECK (sync_status IN ('started', 'completed', 'failed')),
    error_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_id UUID NOT NULL,
    conflict_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    conflict_description TEXT NOT NULL,
    resolution_status VARCHAR(20) DEFAULT 'pending' CHECK (resolution_status IN ('pending', 'resolved', 'ignored')),
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on support tables
ALTER TABLE excel_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;

-- Admin-only access to support tables
CREATE POLICY "Admins can manage sync logs" ON excel_sync_logs
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can manage sync conflicts" ON sync_conflicts
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create indexes for support tables
CREATE INDEX idx_excel_sync_logs_sync_id ON excel_sync_logs(sync_id);
CREATE INDEX idx_excel_sync_logs_status ON excel_sync_logs(sync_status);
CREATE INDEX idx_sync_conflicts_sync_id ON sync_conflicts(sync_id);
CREATE INDEX idx_sync_conflicts_status ON sync_conflicts(resolution_status);

-- Add triggers for support tables
CREATE TRIGGER update_excel_sync_logs_updated_at
    BEFORE UPDATE ON excel_sync_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_conflicts_updated_at
    BEFORE UPDATE ON sync_conflicts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add status column to stores table if it doesn't exist
ALTER TABLE stores ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending'));

-- Add index for stores status
CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);