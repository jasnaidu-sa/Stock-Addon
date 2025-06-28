-- Migration to create the admin_users table

CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'superadmin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for the admin_users table
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service_role full access (typical for backend operations and migrations)
CREATE POLICY "Allow service_role full access on admin_users" 
ON admin_users FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Policy: Allow existing admin users (from the 'users' table) to manage admin_users if needed
-- This assumes you have a 'users' table with a 'role' column that can identify admins.
-- Adjust or remove if your setup is different.
CREATE POLICY "Admins can manage admin_users" 
ON admin_users FOR ALL
USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

COMMENT ON TABLE admin_users IS 'Stores administrative user accounts.';
COMMENT ON COLUMN admin_users.email IS 'Unique email address for the admin user.';
COMMENT ON COLUMN admin_users.full_name IS 'Full name of the admin user.';
COMMENT ON COLUMN admin_users.role IS 'Role of the admin user (e.g., admin, superadmin).';
