/*
  TypeScript types for the Weekly Plans Amendment System
  These correspond to the database tables created in Phase 1 migrations
*/

// ===== Core Amendment System Types =====

export interface Store {
  id: string;
  store_code: string;
  store_name: string;
  region?: string;
  address?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  category_code: string;
  category_name: string;
  description?: string;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface RegionalManagerStoreAllocation {
  id: string;
  user_id: string;
  store_id: string;
  allocated_by?: string;
  allocated_at: string;
  active: boolean;
}

export interface WeeklyPlanAmendment {
  id: string;
  weekly_plan_id?: string;
  user_id: string;
  store_id: string;
  stock_code: string;
  category?: string;
  week_reference: string;
  week_start_date: string;
  amendment_type: 'add_on' | 'quantity_change' | 'new_item' | 'admin_edit';
  original_qty: number;
  amended_qty: number;
  approved_qty?: number;
  justification?: string;
  status: 'pending' | 'submitted' | 'admin_review' | 'approved' | 'rejected';
  admin_id?: string;
  admin_notes?: string;
  created_by_role: 'regional_manager' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface WeekSelection {
  id: string;
  week_reference: string;
  week_start_date: string;
  week_end_date: string;
  year: number;
  week_number: number;
  is_current: boolean;
  is_active: boolean;
  created_at: string;
}

// ===== Extended User Type =====

export interface ExtendedUser {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'admin' | 'regional_manager';
  created_at: string;
}

// ===== View and Dashboard Types =====

export interface AmendmentDashboardView {
  id: string;
  week_reference: string;
  stock_code: string;
  category?: string;
  amendment_type: string;
  original_qty: number;
  amended_qty: number;
  approved_qty?: number;
  status: string;
  justification?: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  store_code: string;
  store_name: string;
  region?: string;
  regional_manager_name: string;
  regional_manager_email: string;
  admin_name?: string;
  admin_email?: string;
  category_name?: string;
  week_start_date: string;
  week_end_date: string;
  effective_qty: number;
  recency_flag: 'new' | 'recent' | 'older';
}

export interface AmendmentStatistics {
  total_amendments: number;
  pending_amendments: number;
  approved_amendments: number;
  rejected_amendments: number;
  total_requested_qty: number;
  total_approved_qty: number;
  most_amended_category?: string;
  busiest_store?: string;
}

// ===== Excel Upload Types =====

export interface StoreUploadRow {
  'Store Code': string;
  'Store Name': string;
  'Region'?: string;
  'Address'?: string;
  'Contact Person'?: string;
  'Phone'?: string;
  'Email'?: string;
}

export interface CategoryUploadRow {
  'Category Code': string;
  'Category Name': string;
  'Description'?: string;
  'Sort Order'?: number;
}

export interface AllocationUploadRow {
  'Regional Manager Email': string;
  'Store Code': string;
}

export interface UploadResult {
  success: boolean;
  totalRows: number;
  successfulRows: number;
  errorRows: number;
  errors: Array<{
    row: number;
    error: string;
    data?: any;
  }>;
}

// ===== Amendment System UI Types =====

export interface AmendmentFormData {
  store_id: string;
  week_reference: string;
  amendments: Array<{
    stock_code: string;
    category: string;
    original_qty: number;
    amended_qty: number;
    justification?: string;
  }>;
}

export interface ProductAmendmentDisplay {
  stock_code: string;
  description?: string;
  category: string;
  size?: string;
  current_plan_qty: number;
  current_addons_qty: number;
  amendment_qty: number;
  new_total_qty: number;
  is_mattress?: boolean;
  base_code?: string;
  auto_base_qty?: number;
}

export interface AmendmentFilters {
  week_reference?: string;
  store_id?: string;
  category?: string;
  status?: string;
  regional_manager_id?: string;
}

// ===== API Response Types =====

export interface AmendmentApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ===== Helper Function Types =====

export interface StoreAccessCheck {
  user_id: string;
  store_id: string;
  has_access: boolean;
}

export interface CurrentWeek {
  week_reference: string;
  week_start_date: string;
  week_end_date: string;
}

export interface ValidationResult {
  is_valid: boolean;
  errors: string[];
}

// ===== Export All Types =====

export type AmendmentSystemTables = 
  | 'stores'
  | 'categories' 
  | 'regional_manager_store_allocations'
  | 'weekly_plan_amendments'
  | 'week_selections';

export type AmendmentStatus = WeeklyPlanAmendment['status'];
export type AmendmentType = WeeklyPlanAmendment['amendment_type'];
export type UserRole = ExtendedUser['role'];