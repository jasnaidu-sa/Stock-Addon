-- Add status column to users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'status') THEN
        ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;
END $$;

-- Drop existing policies on the users table
DROP POLICY IF EXISTS "Users can view their own user data." ON users;
DROP POLICY IF EXISTS "Users can update their own user data." ON users;
DROP POLICY IF EXISTS "Admins can view all user data." ON users;
DROP POLICY IF EXISTS "Admins can update all user data." ON users;
DROP POLICY IF EXISTS "Admins can insert user data." ON users;
DROP POLICY IF EXISTS "Admins can delete user data." ON users;
DROP POLICY IF EXISTS "Users can insert their own record." ON users;
DROP POLICY IF EXISTS "Service role can do everything." ON users;

-- Enable RLS on the users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies for the users table
-- 1. Allow active users to view their own data
CREATE POLICY "Active users can view their own user data."
ON users FOR SELECT
USING (auth.uid() = id AND status = 'active');

-- 2. Allow active users to update their own data
CREATE POLICY "Active users can update their own user data."
ON users FOR UPDATE
USING (auth.uid() = id AND status = 'active');

-- 3. Allow admins to view all user data
CREATE POLICY "Admins can view all user data."
ON users FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin' AND users.status = 'active'
  )
  OR
  auth.email() = 'jnaidu@thebedshop.co.za'
);

-- 4. Allow admins to update all user data
CREATE POLICY "Admins can update all user data."
ON users FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin' AND users.status = 'active'
  )
  OR
  auth.email() = 'jnaidu@thebedshop.co.za'
);

-- 5. Allow admins to insert user data
CREATE POLICY "Admins can insert user data."
ON users FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin' AND users.status = 'active'
  )
  OR
  auth.email() = 'jnaidu@thebedshop.co.za'
);

-- 6. Allow admins to delete user data
CREATE POLICY "Admins can delete user data."
ON users FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin' AND users.status = 'active'
  )
  OR
  auth.email() = 'jnaidu@thebedshop.co.za'
);

-- 7. Allow anyone to create a pending user record
CREATE POLICY "Anyone can create a pending user record."
ON users FOR INSERT
WITH CHECK (status = 'pending');

-- 8. Allow service role to do everything
CREATE POLICY "Service role can do everything."
ON users
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role'); 