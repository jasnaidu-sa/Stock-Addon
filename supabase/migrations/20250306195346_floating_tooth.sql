/*
  # Initial Schema Setup for Order Management System

  1. New Tables
    - `users`
      - `id` (uuid, primary key)
      - `name` (text)
      - `email` (text, unique)
      - `role` (text, check constraint: 'customer' or 'admin')
      - `created_at` (timestamp)
    
    - `orders`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `order_number` (text, unique)
      - `product_name` (text)
      - `category` (text, check constraint: 'mattress', 'furniture', 'accessories', 'foam')
      - `quantity` (integer)
      - `status` (text, check constraint: 'pending', 'approved', 'cancelled', 'completed')
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for:
      - Users can read their own data
      - Admins can read all user data
      - Users can read their own orders
      - Admins can read and modify all orders
      - Users can create orders
      - Users can update their pending orders
*/

-- Drop existing objects with proper dependency order
DROP TRIGGER IF EXISTS set_order_number_trigger ON orders CASCADE;
DROP FUNCTION IF EXISTS set_order_number() CASCADE;
DROP FUNCTION IF EXISTS generate_order_number() CASCADE;
DROP SEQUENCE IF EXISTS order_number_seq CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('customer', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    order_number TEXT UNIQUE NOT NULL,
    product_name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('mattress', 'furniture', 'accessories', 'foam')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'cancelled', 'completed')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sequence for order numbers
CREATE SEQUENCE order_number_seq START 1000;

-- Create function to generate order numbers
CREATE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    next_number INTEGER;
BEGIN
    next_number := nextval('order_number_seq');
    RETURN 'DYN' || LPAD(next_number::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for order numbers
CREATE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL THEN
        NEW.order_number := generate_order_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER set_order_number_trigger
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION set_order_number();

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policies for users table
CREATE POLICY "Users can read own data" ON users
    FOR SELECT
    USING (auth.uid() = id OR EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE
    USING (auth.uid() = id);

-- Policies for orders table
CREATE POLICY "Users can read own orders" ON orders
    FOR SELECT
    USING (
        user_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Users can create orders" ON orders
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update pending orders" ON orders
    FOR UPDATE
    USING (
        (status = 'pending' AND user_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );