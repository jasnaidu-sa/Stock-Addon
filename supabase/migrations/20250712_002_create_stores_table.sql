/*
  # Create Stores Master Table

  This table will store all store locations for The Bed Shop.
  Regional managers will be allocated to specific stores.

  Table: stores
  - id: UUID primary key
  - store_code: Unique store identifier (e.g., "BED001")
  - store_name: Store display name (e.g., "Cape Town Main")
  - region: Geographical region (e.g., "Western", "Eastern", "Gauteng")
  - address: Physical store address
  - contact_person: Store manager/contact name
  - phone: Store contact phone
  - email: Store contact email
  - active: Whether store is active for operations
  - created_at/updated_at: Timestamps

  Security:
  - Enable RLS
  - Admin: Full access
  - Regional Manager: Read access to allocated stores only
  - Customer: No access (not needed for customer operations)
*/

-- Create stores table
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_code VARCHAR(50) UNIQUE NOT NULL,
    store_name VARCHAR(200) NOT NULL,
    region VARCHAR(100),
    address TEXT,
    contact_person VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(100),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_stores_updated_at
    BEFORE UPDATE ON stores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_stores_store_code ON stores(store_code);
CREATE INDEX idx_stores_region ON stores(region);
CREATE INDEX idx_stores_active ON stores(active);

-- Enable RLS
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- Admin policy: Full access
CREATE POLICY "Admins can manage all stores" ON stores
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

-- Regional Manager policy: Read access to allocated stores only
-- (Will be created after allocations table is ready)

-- Insert some default data for testing
INSERT INTO stores (store_code, store_name, region, address, contact_person, phone, email) VALUES
('BED001', 'Cape Town Main', 'Western Cape', '123 Main Road, Cape Town, 8001', 'John Smith', '021-123-4567', 'capetown@thebedshop.co.za'),
('BED002', 'Durban Central', 'KwaZulu-Natal', '456 Smith Street, Durban, 4001', 'Jane Doe', '031-987-6543', 'durban@thebedshop.co.za'),
('BED003', 'Johannesburg North', 'Gauteng', '789 Rivonia Road, Sandton, 2146', 'Bob Wilson', '011-555-1234', 'johannesburg@thebedshop.co.za'),
('BED004', 'Pretoria East', 'Gauteng', '321 Lynnwood Road, Pretoria, 0081', 'Alice Brown', '012-333-2222', 'pretoria@thebedshop.co.za'),
('BED005', 'Port Elizabeth Central', 'Eastern Cape', '654 Main Street, Port Elizabeth, 6001', 'Charlie Green', '041-777-8888', 'pe@thebedshop.co.za');

-- Add comment
COMMENT ON TABLE stores IS 'Master table for all Bed Shop store locations';