import { ProductCategory } from './product';

export interface OrderItemHistoryRecord {
  previous_product_name?: string | null;
  previous_quantity?: number | null;
  previous_price_at_purchase?: number | null;
  previous_code?: string | null; 
  original_qty?: number | null; // Added to match order_history table and fix lint errors
  // Consider adding changed_at or other relevant fields from the order_item_history table if needed for display or logic
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id?: string; // Made optional as it's not directly in order_items table
  product_name: string;
  quantity: number;
  price: number; // Price per unit at the time of order
  price_at_purchase: number; // Price per unit at the time of purchase, used for editing
  total: number; // Price * Quantity
  users?: { first_name: string | null; last_name: string | null; } | null; // Fetched from users table via order_items.user_id
  stock_item_id: string;  // Required field in the database
  notes?: string;
  status?: string;
  category?: ProductCategory; // TypeScript only - not stored in database
  mattress_code?: string;  // TypeScript only - not stored in database
  code?: string;          // Code for furniture products
  history?: OrderItemHistoryRecord[];
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
  items?: OrderItem[];  // This was for the old separate fetch logic, can be removed or kept if there's another use case.
  order_items?: OrderItem[]; // For nested items fetched directly with the order
  customer_name?: string; // Derived name for display
  // Fields from the 'users' table, joined by 'orders_with_user_details' view:
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  user_role?: string | null; // Aliased in the view as 'user_role'
  admin_notes?: string | null; // Notes added by admin, can be null
}