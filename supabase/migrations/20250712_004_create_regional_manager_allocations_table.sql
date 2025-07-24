/*
  # Create Regional Manager Store Allocations Table

  This table links regional managers to the stores they manage.
  Regional managers can only see and amend weekly plans for their allocated stores.

  Table: regional_manager_store_allocations
  - id: UUID primary key
  - user_id: Reference to users table (regional manager)
  - store_id: Reference to stores table
  - allocated_by: Reference to admin user who made the allocation
  - allocated_at: When the allocation was made
  - active: Whether the allocation is active
  - Unique constraint on (user_id, store_id) to prevent duplicates

  Security:
  - Enable RLS
  - Admin: Full access
  - Regional Manager: Read access to their own allocations only
  - Customer: No access
*/

-- Create regional_manager_store_allocations table
CREATE TABLE regional_manager_store_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    allocated_by UUID REFERENCES users(id), -- Admin who made allocation
    allocated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    active BOOLEAN DEFAULT true,
    UNIQUE(user_id, store_id)
);

-- Create indexes for performance
CREATE INDEX idx_allocations_user_id ON regional_manager_store_allocations(user_id);
CREATE INDEX idx_allocations_store_id ON regional_manager_store_allocations(store_id);
CREATE INDEX idx_allocations_active ON regional_manager_store_allocations(active);

-- Enable RLS
ALTER TABLE regional_manager_store_allocations ENABLE ROW LEVEL SECURITY;

-- Admin policy: Full access
CREATE POLICY "Admins can manage all allocations" ON regional_manager_store_allocations
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Regional Manager policy: Read access to their own allocations only
CREATE POLICY "Regional managers can read their allocations" ON regional_manager_store_allocations
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'regional_manager'
        )
    );

-- Now add the regional manager RLS policy to stores table
CREATE POLICY "Regional managers can read allocated stores" ON stores
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM regional_manager_store_allocations rmsa
            JOIN users u ON u.id = rmsa.user_id
            WHERE rmsa.store_id = stores.id
            AND rmsa.user_id = auth.uid()
            AND rmsa.active = true
            AND u.role = 'regional_manager'
        )
    );

-- Add constraint to ensure only regional managers can be allocated
ALTER TABLE regional_manager_store_allocations 
ADD CONSTRAINT check_user_is_regional_manager 
CHECK (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = user_id 
        AND role = 'regional_manager'
    )
);

-- Add comment
COMMENT ON TABLE regional_manager_store_allocations IS 'Links regional managers to their allocated stores';