-- Update the order status constraint to include 'review'

-- First, drop the existing constraint
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_status_check";

-- Create a new constraint that includes 'review'
ALTER TABLE "orders" ADD CONSTRAINT "orders_status_check" 
CHECK (status IN ('pending', 'approved', 'cancelled', 'completed', 'review'));

-- Verify the constraint
SELECT
    pg_get_constraintdef(c.oid) as constraint_definition
FROM
    pg_constraint c
JOIN
    pg_class t ON c.conrelid = t.oid
JOIN
    pg_namespace n ON t.relnamespace = n.oid
WHERE
    t.relname = 'orders'
    AND n.nspname = 'public'
    AND pg_get_constraintdef(c.oid) LIKE '%status%'; 