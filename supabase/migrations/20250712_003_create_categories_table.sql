/*
  # Create Categories Master Table

  This table will store product categories for the weekly plans amendment system.
  Categories define the tabs that regional managers see in the amendment interface.

  Table: categories
  - id: UUID primary key  
  - category_code: Unique category identifier (e.g., "MATT", "FURN")
  - category_name: Display name (e.g., "Mattresses", "Furniture")
  - description: Optional description of the category
  - sort_order: Order for displaying tabs (1, 2, 3, etc.)
  - active: Whether category is active
  - created_at: Timestamp

  Security:
  - Enable RLS
  - Admin: Full access
  - Regional Manager: Read access only
  - Customer: No access
*/

-- Create categories table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_code VARCHAR(50) UNIQUE NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_categories_category_code ON categories(category_code);
CREATE INDEX idx_categories_sort_order ON categories(sort_order);
CREATE INDEX idx_categories_active ON categories(active);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Admin policy: Full access
CREATE POLICY "Admins can manage all categories" ON categories
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

-- Regional Manager policy: Read access only
CREATE POLICY "Regional managers can read categories" ON categories
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'regional_manager')
        )
    );

-- Insert default categories based on existing product structure
INSERT INTO categories (category_code, category_name, description, sort_order) VALUES
('MATT', 'Mattresses', 'All mattress products and related items', 1),
('FURN', 'Furniture', 'Bedroom furniture including headboards', 2),
('ACC', 'Accessories', 'Pillows, sheets, and bedroom accessories', 3),
('FOAM', 'Foam Products', 'Foam mattresses and mattress toppers', 4);

-- Add comment
COMMENT ON TABLE categories IS 'Product categories for weekly plans amendment system navigation';