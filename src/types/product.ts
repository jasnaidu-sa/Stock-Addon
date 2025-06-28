export interface Base {
  id: string;
  code: string;
  description: string;
  price: number;
  created_at?: string;
}

export interface Product {
  id: string;
  description: string;
  price?: number;
  code?: string;
  // Mattress specific fields
  mattress_code?: string;
  mattress_price?: number;
  base_code?: string;
  base_price?: number;
  base_qty?: number;
  set_price?: number;
  size?: string;
  image_url?: string;      // Added for cart item consistency
  stock_item_id?: string;  // Added for cart item consistency
  // Base relationship
  base?: Base;
  // For other product types
  category_id?: string;
}

export type ProductCategory = 'mattress' | 'base' | 'furniture' | 'accessories' | 'foam'; 