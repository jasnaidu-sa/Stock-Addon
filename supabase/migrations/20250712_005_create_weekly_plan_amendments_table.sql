/*
  # Create Weekly Plan Amendments Table

  This table tracks all amendment requests made by regional managers
  and admin approval/rejection decisions.

  Table: weekly_plan_amendments
  - id: UUID primary key
  - weekly_plan_id: Reference to weekly_plan table (can be NULL for new items)
  - user_id: Regional manager who created the amendment
  - store_id: Store the amendment applies to
  - stock_code: Product stock code
  - category: Product category for filtering
  - week_reference: Week identifier (e.g., "Week 28")
  - week_start_date: Start date of the week
  - amendment_type: Type of amendment (add_on, quantity_change, new_item)
  - original_qty: Original planned quantity
  - amended_qty: Requested amendment quantity
  - approved_qty: Final approved quantity (may differ from requested)
  - justification: Regional manager's reason
  - status: Amendment status (pending, submitted, admin_review, approved, rejected)
  - admin_id: Admin who reviewed the amendment
  - admin_notes: Admin's review notes
  - created_by_role: Role of user who created (regional_manager, admin)
  - created_at/updated_at: Timestamps

  Security:
  - Enable RLS
  - Admin: Full access
  - Regional Manager: Can create amendments for allocated stores, read own amendments
  - Customer: No access
*/

-- Create weekly_plan_amendments table
CREATE TABLE weekly_plan_amendments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    weekly_plan_id UUID REFERENCES weekly_plan(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    stock_code VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    week_reference VARCHAR(50) NOT NULL,
    week_start_date DATE NOT NULL,
    amendment_type VARCHAR(50) NOT NULL CHECK (amendment_type IN ('add_on', 'quantity_change', 'new_item', 'admin_edit')),
    original_qty INTEGER DEFAULT 0,
    amended_qty INTEGER NOT NULL,
    approved_qty INTEGER, -- NULL until admin reviews
    justification TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'admin_review', 'approved', 'rejected')),
    admin_id UUID REFERENCES users(id),
    admin_notes TEXT,
    created_by_role VARCHAR(20) NOT NULL CHECK (created_by_role IN ('regional_manager', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trigger for updated_at
CREATE TRIGGER update_weekly_plan_amendments_updated_at
    BEFORE UPDATE ON weekly_plan_amendments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_amendments_weekly_plan_id ON weekly_plan_amendments(weekly_plan_id);
CREATE INDEX idx_amendments_user_id ON weekly_plan_amendments(user_id);
CREATE INDEX idx_amendments_store_id ON weekly_plan_amendments(store_id);
CREATE INDEX idx_amendments_week_reference ON weekly_plan_amendments(week_reference);
CREATE INDEX idx_amendments_status ON weekly_plan_amendments(status);
CREATE INDEX idx_amendments_category ON weekly_plan_amendments(category);
CREATE INDEX idx_amendments_stock_code ON weekly_plan_amendments(stock_code);

-- Composite indexes for common queries
CREATE INDEX idx_amendments_store_week ON weekly_plan_amendments(store_id, week_reference);
CREATE INDEX idx_amendments_user_status ON weekly_plan_amendments(user_id, status);
CREATE INDEX idx_amendments_admin_pending ON weekly_plan_amendments(admin_id, status) WHERE status IN ('pending', 'submitted', 'admin_review');

-- Enable RLS
ALTER TABLE weekly_plan_amendments ENABLE ROW LEVEL SECURITY;

-- Admin policy: Full access
CREATE POLICY "Admins can manage all amendments" ON weekly_plan_amendments
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

-- Regional Manager policy: Can create amendments for allocated stores and read their own
CREATE POLICY "Regional managers can manage their amendments" ON weekly_plan_amendments
    FOR ALL
    TO authenticated
    USING (
        user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'regional_manager'
        ) AND
        EXISTS (
            SELECT 1 FROM regional_manager_store_allocations rmsa
            WHERE rmsa.store_id = weekly_plan_amendments.store_id
            AND rmsa.user_id = auth.uid()
            AND rmsa.active = true
        )
    )
    WITH CHECK (
        user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'regional_manager'
        ) AND
        EXISTS (
            SELECT 1 FROM regional_manager_store_allocations rmsa
            WHERE rmsa.store_id = weekly_plan_amendments.store_id
            AND rmsa.user_id = auth.uid()
            AND rmsa.active = true
        )
    );

-- Add constraint to ensure approved_qty is set when status is approved
ALTER TABLE weekly_plan_amendments 
ADD CONSTRAINT check_approved_qty_when_approved 
CHECK (
    (status = 'approved' AND approved_qty IS NOT NULL) OR 
    (status != 'approved')
);

-- Add constraint to ensure admin_id is set when admin reviews
ALTER TABLE weekly_plan_amendments 
ADD CONSTRAINT check_admin_id_when_reviewed 
CHECK (
    (status IN ('approved', 'rejected') AND admin_id IS NOT NULL) OR 
    (status NOT IN ('approved', 'rejected'))
);

-- Add comment
COMMENT ON TABLE weekly_plan_amendments IS 'Tracks all weekly plan amendment requests and approvals';