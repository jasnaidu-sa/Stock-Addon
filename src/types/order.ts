import { ProductCategory } from './product';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  total: number; // Price * Quantity
  stock_item_id: string;  // Required field in the database
  notes?: string;
  status?: string;
  category?: ProductCategory; // TypeScript only - not stored in database
  mattress_code?: string;  // TypeScript only - not stored in database
  code?: string;          // Code for furniture products
}

export type OrderStatus = 'pending' | 'approved' | 'completed' | 'cancelled' | 'review';

export interface Order {
  id: string;
  user_id: string;
  order_number: string;
  store_name: string;
  category: ProductCategory;
  quantity: number;
  status: OrderStatus;
  created_at: string;
  value: number;  // The database uses 'value' not 'total'
  items?: OrderItem[];  // This is not stored in the orders table but fetched from order_items
  customer_name?: string; // Added to store the user's name for display in admin tables
  owner_name?: string;    // Added to store the order owner's name for display
  user?: any; // Reference to the user object from the users table
}

// Define JSONB type for TypeScript
type JSONB = any; 