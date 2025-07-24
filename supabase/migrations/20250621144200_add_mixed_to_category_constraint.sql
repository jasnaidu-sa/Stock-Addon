ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_category_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_category_check
CHECK (category IN ('mattress', 'furniture', 'accessories', 'foam', 'mixed'));
