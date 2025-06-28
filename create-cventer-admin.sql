-- SQL script to create admin user cventer@thebedshop.co.za
-- Run this in the Supabase SQL Editor

-- First, create the user in auth.users table
-- Note: This requires service role access, so run in Supabase dashboard SQL editor

-- Insert user into auth.users table
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'cventer@thebedshop.co.za',
  crypt('admin123', gen_salt('bf')), -- Password: admin123 (change after first login)
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "C. Venter"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
);

-- Get the user ID that was just created
-- You'll need to run this separately and note the ID
SELECT id, email FROM auth.users WHERE email = 'cventer@thebedshop.co.za';

-- Insert user into public.users table with admin role
-- Replace 'USER_ID_FROM_ABOVE' with the actual UUID from the previous query
INSERT INTO public.users (
  id,
  email,
  name,
  role,
  created_at
) VALUES (
  (SELECT id FROM auth.users WHERE email = 'cventer@thebedshop.co.za'),
  'cventer@thebedshop.co.za',
  'C. Venter',
  'admin',
  NOW()
);

-- Verify the user was created
SELECT 
  au.id,
  au.email,
  au.email_confirmed_at,
  pu.name,
  pu.role
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE au.email = 'cventer@thebedshop.co.za'; 