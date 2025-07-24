/*
  # Create Week Selections Table

  This table manages available weeks for amendment selection.
  Admins can set which weeks are active for amendments and designate the current week.

  Table: week_selections
  - id: UUID primary key
  - week_reference: Week identifier (e.g., "Week 28") - matches weekly_plan.reference
  - week_start_date: Start date of the week
  - week_end_date: End date of the week  
  - year: Year of the week
  - week_number: Week number within the year (1-52)
  - is_current: Whether this is the current week (only one can be current)
  - is_active: Whether this week is available for amendments
  - created_at: Timestamp

  Security:
  - Enable RLS
  - Admin: Full access
  - Regional Manager: Read access to active weeks only
  - Customer: No access
*/

-- Create week_selections table
CREATE TABLE week_selections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_reference VARCHAR(50) UNIQUE NOT NULL,
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,
    year INTEGER NOT NULL,
    week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 53),
    is_current BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_week_selections_week_reference ON week_selections(week_reference);
CREATE INDEX idx_week_selections_year ON week_selections(year);
CREATE INDEX idx_week_selections_week_number ON week_selections(week_number);
CREATE INDEX idx_week_selections_is_current ON week_selections(is_current);
CREATE INDEX idx_week_selections_is_active ON week_selections(is_active);
CREATE INDEX idx_week_selections_dates ON week_selections(week_start_date, week_end_date);

-- Create unique constraint to ensure only one current week
CREATE UNIQUE INDEX idx_week_selections_unique_current 
ON week_selections(is_current) WHERE is_current = true;

-- Enable RLS
ALTER TABLE week_selections ENABLE ROW LEVEL SECURITY;

-- Admin policy: Full access
CREATE POLICY "Admins can manage all week selections" ON week_selections
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

-- Regional Manager policy: Read access to active weeks only
CREATE POLICY "Regional managers can read active weeks" ON week_selections
    FOR SELECT
    TO authenticated
    USING (
        is_active = true AND
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'regional_manager')
        )
    );

-- Function to ensure only one current week
CREATE OR REPLACE FUNCTION ensure_single_current_week()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting a week as current, unset all others
    IF NEW.is_current = true THEN
        UPDATE week_selections 
        SET is_current = false 
        WHERE id != NEW.id AND is_current = true;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to ensure only one current week
CREATE TRIGGER ensure_single_current_week_trigger
    BEFORE INSERT OR UPDATE ON week_selections
    FOR EACH ROW
    WHEN (NEW.is_current = true)
    EXECUTE FUNCTION ensure_single_current_week();

-- Insert some sample weeks for testing
INSERT INTO week_selections (week_reference, week_start_date, week_end_date, year, week_number, is_current, is_active) VALUES
('Week 28', '2025-07-07', '2025-07-13', 2025, 28, true, true),
('Week 29', '2025-07-14', '2025-07-20', 2025, 29, false, true),
('Week 30', '2025-07-21', '2025-07-27', 2025, 30, false, true),
('Week 31', '2025-07-28', '2025-08-03', 2025, 31, false, false),
('Week 27', '2025-06-30', '2025-07-06', 2025, 27, false, false);

-- Add comment
COMMENT ON TABLE week_selections IS 'Manages available weeks for weekly plan amendments';