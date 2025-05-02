-- Keep store_name as NOT NULL since it's mandatory and comes from user input
-- Do NOT set a default value as it should always be provided by the user

-- Make category column nullable for flexibility
ALTER TABLE orders ALTER COLUMN category DROP NOT NULL;

-- Make quantity column nullable for flexibility
ALTER TABLE orders ALTER COLUMN quantity DROP NOT NULL; 