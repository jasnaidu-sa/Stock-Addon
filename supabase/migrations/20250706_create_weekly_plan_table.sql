-- Create weekly_plan table based on the Excel file structure
CREATE TABLE weekly_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id INTEGER,
  source_warehouse VARCHAR(50),
  start_date DATE,
  reference VARCHAR(50) NOT NULL, -- This will be our week reference like "Week 28"
  operator VARCHAR(100),
  warehouse VARCHAR(50),
  target_name VARCHAR(100),
  item_type VARCHAR(50),
  category VARCHAR(100),
  sub_category VARCHAR(100),
  size VARCHAR(50),
  stock_code VARCHAR(100),
  description VARCHAR(500),
  volume DECIMAL(10,4),
  qty_on_hand INTEGER DEFAULT 0,
  qty_in_transit INTEGER DEFAULT 0,
  qty_pending_orders INTEGER DEFAULT 0,
  model_stock_qty INTEGER DEFAULT 0,
  order_qty INTEGER DEFAULT 0,
  regional_add_qty INTEGER DEFAULT 0,
  supply_chain_add_qty INTEGER DEFAULT 0,
  add_ons_qty INTEGER DEFAULT 0,
  act_order_qty INTEGER DEFAULT 0,
  comment TEXT,
  store_name VARCHAR(100),
  sku_type VARCHAR(100),
  draw VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uploaded_by UUID REFERENCES auth.users(id)
);

-- Create indexes for better performance
CREATE INDEX idx_weekly_plan_reference ON weekly_plan(reference);
CREATE INDEX idx_weekly_plan_store_name ON weekly_plan(store_name);
CREATE INDEX idx_weekly_plan_stock_code ON weekly_plan(stock_code);
CREATE INDEX idx_weekly_plan_start_date ON weekly_plan(start_date);
CREATE INDEX idx_weekly_plan_uploaded_by ON weekly_plan(uploaded_by);

-- Create unique constraint on reference to prevent duplicate week uploads
CREATE UNIQUE INDEX idx_weekly_plan_reference_unique ON weekly_plan(reference, plan_id);

-- Add RLS policies
ALTER TABLE weekly_plan ENABLE ROW LEVEL SECURITY;

-- Policy for admin users to read all weekly plan data
CREATE POLICY "Admin users can read weekly plan data" ON weekly_plan
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.clerk_id = auth.jwt() ->> 'sub' 
      AND users.role = 'admin'
    )
  );

-- Policy for admin users to insert weekly plan data
CREATE POLICY "Admin users can insert weekly plan data" ON weekly_plan
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.clerk_id = auth.jwt() ->> 'sub' 
      AND users.role = 'admin'
    )
  );

-- Policy for admin users to update weekly plan data
CREATE POLICY "Admin users can update weekly plan data" ON weekly_plan
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.clerk_id = auth.jwt() ->> 'sub' 
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.clerk_id = auth.jwt() ->> 'sub' 
      AND users.role = 'admin'
    )
  );

-- Policy for admin users to delete weekly plan data
CREATE POLICY "Admin users can delete weekly plan data" ON weekly_plan
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.clerk_id = auth.jwt() ->> 'sub' 
      AND users.role = 'admin'
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_weekly_plan_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_weekly_plan_updated_at
  BEFORE UPDATE ON weekly_plan
  FOR EACH ROW
  EXECUTE FUNCTION update_weekly_plan_updated_at();