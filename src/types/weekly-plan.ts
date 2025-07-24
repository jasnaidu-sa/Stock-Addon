export interface WeeklyPlan {
  id: string;
  plan_id?: number;
  source_warehouse?: string;
  start_date?: string;
  reference: string; // Week reference like "Week 28"
  operator?: string;
  warehouse?: string;
  target_name?: string;
  item_type?: string;
  category?: string;
  sub_category?: string;
  size?: string;
  stock_code?: string;
  description?: string;
  volume?: number;
  qty_on_hand?: number;
  qty_in_transit?: number;
  qty_pending_orders?: number;
  model_stock_qty?: number;
  order_qty?: number;
  regional_add_qty?: number;
  supply_chain_add_qty?: number;
  add_ons_qty?: number;
  act_order_qty?: number;
  comment?: string;
  store_name?: string;
  sku_type?: string;
  draw?: string;
  created_at?: string;
  updated_at?: string;
  uploaded_by?: string;
}

export interface WeeklyPlanUploadStats {
  totalRows: number;
  successfulRows: number;
  errorRows: number;
  weekReference: string;
  startDate: string;
}

export interface WeeklyPlanExcelRow {
  PlanID?: number;
  SourceWarehouse?: string;
  StartDate?: string;
  Reference?: string;
  Operator?: string;
  Warehouse?: string;
  TargetName?: string;
  ItemType?: string;
  Category?: string;
  SubCategory?: string;
  Size?: string;
  StockCode?: string;
  Description?: string;
  Volume?: number;
  QtyOnHand?: number;
  QtyInTransit?: number;
  QtyPendingOrders?: number;
  ModelStockQty?: number;
  OrderQty?: number;
  RegionalAddQty?: number;
  SupplyChainAddQty?: number;
  AddOnsQty?: number;
  ActOrderQty?: number;
  Comment?: string;
  'Store Name'?: string;
  'SKU Type'?: string;
  Draw?: string;
}