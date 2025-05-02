/*
  # Add store name to orders table

  1. Changes
    - Add store_name column to orders table
    - Make store_name required for all orders
    - Update existing orders to have a default store name

  2. Security
    - Maintain existing RLS policies
*/

ALTER TABLE orders ADD COLUMN store_name text NOT NULL DEFAULT 'Main Store';
ALTER TABLE orders ALTER COLUMN store_name DROP DEFAULT;