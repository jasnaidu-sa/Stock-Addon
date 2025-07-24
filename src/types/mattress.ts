export interface Mattress {
  id: string;
  mattress_code: string;
  base_code: string;
  description: string;
  size: string;
  set_price: string;
  mattress_price: string;
  base_price: string;
  created_at: string;
}

export interface MattressOrderItem {
  id: string;
  mattress_code: string;
  description: string;
  size: string;
  quantity: number;
  price: number;
  includeBase: boolean;
  base_code?: string;
  base_price?: number;
  total_price: number;
}

export interface MattressCartItem extends MattressOrderItem {
  created_at: string;
  updated_at: string;
  user_id: string;
  order_id?: string;
} 