-- Add the missing description column to the orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS description TEXT;

-- Add customer information columns if they don't exist
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT; 