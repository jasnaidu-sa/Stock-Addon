/*
  # Delete orders not created by specific admin

  1. Changes
    - Delete orders not associated with jnaidu@thebedshop.co.za
    - Clean up related order_items
    - Use transaction to ensure data consistency
  
  2. Safety Measures
    - Verify user exists before deletion
    - Use transaction to maintain referential integrity
    - Preserve admin user's orders
*/

DO $$ 
DECLARE
  admin_user_id uuid;
BEGIN
  -- Get the admin user's ID
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'jnaidu@thebedshop.co.za';

  -- Verify admin user exists
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Admin user not found';
  END IF;

  -- Delete order_items for orders that will be deleted
  DELETE FROM order_items
  WHERE order_id IN (
    SELECT id 
    FROM orders 
    WHERE user_id != admin_user_id
  );

  -- Delete orders not belonging to admin
  DELETE FROM orders
  WHERE user_id != admin_user_id;

END $$;