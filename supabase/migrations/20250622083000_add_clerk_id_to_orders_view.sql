DROP VIEW IF EXISTS public.orders_with_user_details;

CREATE VIEW public.orders_with_user_details AS
 SELECT o.id,
    o.created_at,
    o.user_id,
    o.order_number,
    o.status,
    o.store_name,
    o.description,
    o.category,
    o.quantity,
    o.value,
    o.admin_notes,
    u.clerk_id,
    u.first_name,
    u.last_name,
    u.email,
    u.role AS user_role
   FROM orders o
     LEFT JOIN users u ON o.user_id = u.id;
