-- Add code, mattress_code, and category columns to order_items table
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS mattress_code TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS category TEXT; 