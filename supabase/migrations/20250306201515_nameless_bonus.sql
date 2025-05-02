/*
  # Update admin user and reset password

  1. Changes
    - Update user role to 'admin' for jnaidu@thebedshop.co.za
    - Add user to admin_users table for additional admin privileges
*/

-- Update user role to admin
UPDATE users 
SET role = 'admin'
WHERE email = 'jnaidu@thebedshop.co.za';

-- Add to admin_users table if not exists
INSERT INTO admin_users (id, email)
SELECT id, email
FROM users
WHERE email = 'jnaidu@thebedshop.co.za'
AND NOT EXISTS (
  SELECT 1 FROM admin_users WHERE email = 'jnaidu@thebedshop.co.za'
);