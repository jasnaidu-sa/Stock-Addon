-- Attempt to drop the existing constraint to avoid errors if it's already there with a different definition
ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add the new constraint including all original and new statuses
ALTER TABLE public.orders
ADD CONSTRAINT orders_status_check
CHECK (status IN ('pending', 'approved', 'completed', 'cancelled', 'review', 'shipped', 'rejected'));
