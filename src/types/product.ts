export interface Base {
  id: string;
  base_code: string;
  description: string;
  size: string;
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
  // Base relationship
  base?: Base;
  // For other product types
  category_id?: string;
}

export type ProductCategory = 'mattress' | 'base' | 'furniture' | 'accessories' | 'foam'; 