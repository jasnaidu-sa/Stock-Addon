import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  RefreshCw, 
  AlertCircle, 
  Calendar, 
  Building2, 
  Package,
  CheckCircle, 
  XCircle, 
  Clock, 
  Edit,
  Save,
  X,
  Filter,
  FilterX
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UserRole, UserHierarchy, StoreHierarchy, getUserHierarchy, getStoreHierarchyForUser } from '@/lib/user-role';
import { useUser } from '@clerk/clerk-react';
import { supabaseAdmin } from '@/lib/supabase';
import { StoreContextSheet } from './store-context-sheet';

interface WeekSelection {
  week_reference: string;
  week_start_date: string;
  week_end_date: string;
  is_current: boolean;
  is_active: boolean;
  week_status: string;
}

interface WeeklyPlanItem {
  id: string;
  stock_code: string;
  description: string;
  category: string;
  sub_category?: string;
  store_name: string;
  store_id: string;
  reference: string;
  order_qty: number;
  act_order_qty: number;
  add_ons_qty: number;
  qty_on_hand: number;
  qty_in_transit: number;
  qty_pending_orders: number;
  model_stock_qty: number;
  start_date: string;
}

interface Amendment {
  id: string;
  weekly_plan_id: string;
  store_id: string;
  stock_code: string;
  category: string;
  week_reference: string;
  week_start_date: string;
  amendment_type: string;
  original_qty: number;
  amended_qty: number;
  approved_qty?: number;
  justification: string;
  status: 'pending' | 'submitted' | 'approved' | 'rejected' | 'admin_approved' | 'admin_rejected';
  created_at: string;
  updated_at: string;
  created_by: string;
  admin_notes?: string;
  admin_approved_at?: string;
  admin_rejected_at?: string;
  admin_approved_by?: string;
  store_name: string;
  description: string;
}

interface SubCategoryData {
  id: string;
  name: string;
  items: WeeklyPlanItem[];
  totalOrderQty: number;
  totalAddOnsQty: number;
  totalQtyToOrder: number;
}

interface CategoryData {
  id: string;
  name: string;
  items: WeeklyPlanItem[];
  subCategories: SubCategoryData[];
  storeBreakdown: { [storeId: string]: { storeName: string; qty: number } };
  pendingAmendments: number;
  submittedAmendments: number;
  totalOrderQty: number;
  totalAddOnsQty: number;
  totalQtyToOrder: number;
}

interface WeeklyPlanInterfaceProps {
  userRole: UserRole;
  title: string;
  description: string;
  showSummaryTab?: boolean;
  allowedAmendmentTypes: string[];
  hierarchyLevel: string;
  preloadedData?: {
    currentWeek: any;
    areaManagerInfo?: any;
    regionalManagerInfo?: any;
    storeHierarchy: any[];
    storesWithSubmissions?: any[];
  };
  // Admin-specific props
  enableRegionalFilter?: boolean;
  focusOnChangedItems?: boolean; 
  adminWorkflow?: boolean;
}

export function WeeklyPlanInterface({ 
  userRole, 
  title, 
  description, 
  showSummaryTab = true,
  allowedAmendmentTypes,
  hierarchyLevel,
  preloadedData,
  enableRegionalFilter = false,
  focusOnChangedItems = false,
  adminWorkflow = false
}: WeeklyPlanInterfaceProps) {
  const { user } = useUser();
  const { toast } = useToast();
  
  // Core state
  const [currentWeek, setCurrentWeek] = useState<WeekSelection | null>(null);
  const [userHierarchy, setUserHierarchy] = useState<UserHierarchy | null>(null);
  const [storeHierarchy, setStoreHierarchy] = useState<StoreHierarchy[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [pendingAmendments, setPendingAmendments] = useState<Amendment[]>([]);
  
  // UI state
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(!preloadedData); // Start with false if we have preloaded data
  const [activeTab, setActiveTab] = useState('');
  const [reviewingAmendment, setReviewingAmendment] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [suppressZeros, setSuppressZeros] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);
  const [hasProcessedPreloadedData, setHasProcessedPreloadedData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDataProcessing, setIsDataProcessing] = useState(false);
  const [dataLoadingStage, setDataLoadingStage] = useState<string>('');
  
  // Store context state
  const [storeContextOpen, setStoreContextOpen] = useState(false);
  const [selectedStoreContext, setSelectedStoreContext] = useState<{
    storeId: string;
    storeName: string;
    region?: string;
    allItems: any[];
    amendments: any[];
  } | null>(null);

  // Admin-specific state
  const [selectedRegionalFilter, setSelectedRegionalFilter] = useState<string>('all');
  const [showOnlyChangedItems, setShowOnlyChangedItems] = useState(focusOnChangedItems);
  const [showAmendmentsOnly, setShowAmendmentsOnly] = useState(false);
  const [regionalManagers, setRegionalManagers] = useState<any[]>([]);
  
  // Line item editing state
  const [editingItems, setEditingItems] = useState<Set<string>>(new Set());
  const [editingData, setEditingData] = useState<{[key: string]: {
    order_qty: number;
    add_ons_qty: number;
    comment: string;
  }}>({});

  const checkSupabase = () => {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }
    return supabaseAdmin;
  };

  // Helper functions for filtering data based on selectedStoreFilter and amendment filter
  const getFilteredCategoryTotals = (category: any) => {
    let totalOrderQty = 0;
    let totalAddOnsQty = 0;
    
    category.subCategories.forEach((subCategory: any) => {
      subCategory.items
        .filter((item: any) => {
          // Handle special "all_with_amendments" filter
          if (selectedStoreFilter === 'all_with_amendments') {
            return item.has_amendment === true || 
                   (item.amended_qty !== null && item.amended_qty !== undefined) ||
                   pendingAmendments.some(amendment => 
                     (amendment.stock_code === item.stock_code && amendment.store_id === item.store_id) ||
                     amendment.weekly_plan_id === item.id
                   );
          }
          return selectedStoreFilter === 'all' || item.store_id === selectedStoreFilter;
        })
        .filter((item: any) => {
          // Amendment filter - show only items with amendments if enabled
          if (showAmendmentsOnly) {
            return item.has_amendment === true || 
                   (item.amended_qty !== null && item.amended_qty !== undefined) ||
                   pendingAmendments.some(amendment => 
                     amendment.weekly_plan_id === item.id || 
                     (amendment.stock_code === item.stock_code && amendment.store_id === item.store_id)
                   );
          }
          return true;
        })
        .forEach((item: any) => {
          totalOrderQty += item.order_qty || 0;
          totalAddOnsQty += item.add_ons_qty || 0;
        });
    });

    return {
      totalOrderQty,
      totalAddOnsQty,
      totalQtyToOrder: totalOrderQty + totalAddOnsQty
    };
  };

  const getFilteredSubCategoryTotals = (subCategory: any) => {
    const filteredItems = subCategory.items
      .filter((item: any) => {
        // Handle special "all_with_amendments" filter
        if (selectedStoreFilter === 'all_with_amendments') {
          return item.has_amendment === true || 
                 (item.amended_qty !== null && item.amended_qty !== undefined) ||
                 pendingAmendments.some(amendment => 
                   (amendment.stock_code === item.stock_code && amendment.store_id === item.store_id) ||
                   amendment.weekly_plan_id === item.id
                 );
        }
        return selectedStoreFilter === 'all' || item.store_id === selectedStoreFilter;
      })
      .filter((item: any) => {
        // Amendment filter - show only items with amendments if enabled
        if (showAmendmentsOnly) {
          return item.has_amendment === true || 
                 (item.amended_qty !== null && item.amended_qty !== undefined) ||
                 pendingAmendments.some(amendment => 
                   amendment.weekly_plan_id === item.id || 
                   (amendment.stock_code === item.stock_code && amendment.store_id === item.store_id)
                 );
        }
        return true;
      });
    
    let totalOrderQty = 0;
    let totalAddOnsQty = 0;
    
    filteredItems.forEach((item: any) => {
      totalOrderQty += item.order_qty || 0;
      totalAddOnsQty += item.add_ons_qty || 0;
    });

    return {
      totalOrderQty,
      totalAddOnsQty,
      totalQtyToOrder: totalOrderQty + totalAddOnsQty
    };
  };

  const getFilteredCategoryTabCount = (category: any) => {
    return getFilteredCategoryTotals(category).totalQtyToOrder;
  };


  // Load all data for the user
  // Process preloaded amendments data directly without database queries
  const processPreloadedData = useCallback(async () => {
    console.log('🚀 [processPreloadedData] Processing preloaded amendments data directly');
    console.log('📋 [processPreloadedData] Preloaded data structure:', {
      storesWithSubmissions: preloadedData.storesWithSubmissions?.length || 0,
      stores: preloadedData.stores?.length || 0,
      amendments: preloadedData.amendments?.length || 0,
      hasStoresWithSubmissions: !!preloadedData.storesWithSubmissions,
      hasStores: !!preloadedData.stores,
      hasAmendments: !!preloadedData.amendments
    });
    
    // Check if amendments are passed separately in preloadedData
    if (preloadedData.amendments && preloadedData.amendments.length > 0) {
      console.log('📋 [processPreloadedData] Found separate amendments array:', preloadedData.amendments.length);
      console.log('📋 [processPreloadedData] Sample separate amendments:', preloadedData.amendments.slice(0, 2));
      
      // Use separate amendments if available - this takes priority
      setPendingAmendments(preloadedData.amendments);
      console.log(`📋 [processPreloadedData] Set ${preloadedData.amendments.length} amendments from separate array`);
    }
    setIsDataProcessing(true);
    setDataLoadingStage('Processing data...');
    
    // Small delay to ensure UI updates
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('🚀 [processPreloadedData] Available preloaded data:', {
      hasPreloadedData: !!preloadedData,
      hasStoresWithSubmissions: !!preloadedData?.storesWithSubmissions,
      storesWithSubmissionsLength: preloadedData?.storesWithSubmissions?.length || 0,
      hasCurrentWeek: !!currentWeek,
      currentWeekRef: currentWeek?.week_reference,
      sampleDataItem: preloadedData?.storesWithSubmissions?.[0],
      sampleDataKeys: preloadedData?.storesWithSubmissions?.[0] ? Object.keys(preloadedData.storesWithSubmissions[0]) : []
    });
    
    // Debug: Log the entire structure of the first few amendments
    if (preloadedData?.storesWithSubmissions?.length > 0) {
      console.log('🔍 [processPreloadedData] First 3 amendment records:', 
        preloadedData.storesWithSubmissions.slice(0, 3).map(item => ({
          id: item.id,
          stock_code: item.stock_code,
          category: item.category,
          store_name: item.store_name,
          order_qty: item.order_qty,
          add_ons_qty: item.add_ons_qty,
          hasAllFields: !!(item.category && item.stock_code)
        }))
      );
    }
    
    if (!preloadedData?.storesWithSubmissions || !currentWeek) {
      console.log('🛑 [processPreloadedData] Missing preloaded weekly plan data:', {
        hasStoresWithSubmissions: !!preloadedData?.storesWithSubmissions,
        hasCurrentWeek: !!currentWeek,
        preloadedDataKeys: preloadedData ? Object.keys(preloadedData) : [],
        storesWithSubmissionsLength: preloadedData?.storesWithSubmissions?.length || 0
      });
      setIsDataProcessing(false);
      setDataLoadingStage('');
      return false;
    }
    
    try {
      const weeklyPlanData = preloadedData.storesWithSubmissions;
      console.log(`📦 [processPreloadedData] Processing ${weeklyPlanData.length} preloaded weekly plan items`);
      setDataLoadingStage('Organizing categories...');
      
      // Small delay to show the organizing stage
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Extract unique categories from weekly plan data and build proper structure
      const categoryMap = new Map();
      
      weeklyPlanData.forEach((planItem: any) => {
        if (planItem.category && planItem.stock_code) {
          const categoryKey = planItem.category;
          
          if (!categoryMap.has(categoryKey)) {
            categoryMap.set(categoryKey, {
              id: planItem.category,
              name: planItem.category,
              category: planItem.category,
              description: `${planItem.category} products`,
              qty_per_week: 0,
              totalOrderQty: 0,
              totalAddOnsQty: 0,
              totalQtyToOrder: 0,
              pendingAmendments: 0,
              submittedAmendments: 0,
              storeBreakdown: {},
              items: [],
              subCategories: []
            });
          }
          
          const category = categoryMap.get(categoryKey);
          
          // Create line item from weekly plan data (may include amendments already applied)
          const lineItem = {
            id: planItem.id || `${planItem.store_id}_${planItem.stock_code}`,
            stock_code: planItem.stock_code,
            description: planItem.description || `${planItem.stock_code}`,
            order_qty: planItem.order_qty || 0,
            add_ons_qty: planItem.add_ons_qty || 0,
            qty_on_hand: planItem.qty_on_hand || 0,
            qty_in_transit: planItem.qty_in_transit || 0,
            qty_pending_orders: planItem.qty_pending_orders || 0,
            model_stock_qty: planItem.model_stock_qty || 0,
            store_id: planItem.store_id,
            store_name: planItem.store?.store_name || planItem.store_name || 'Unknown Store',
            status: planItem.status || 'active',
            created_by: planItem.created_by_user?.name || planItem.created_by_user?.email || 'System',
            created_at: planItem.created_at || planItem.start_date,
            amendment_id: planItem.id,
            // Amendment specific data
            has_amendment: planItem.has_amendment || false,
            amended_qty: planItem.amended_qty,
            justification: planItem.justification,
            original_order_qty: planItem.original_order_qty,
            original_add_ons_qty: planItem.original_add_ons_qty
          };
          
          // Create or find subcategory - for weekly plan items, group by stock code prefix or use category
          const stockCodePrefix = planItem.stock_code?.split('-')[0] || 'Unknown';
          const subCategoryName = planItem.sub_category || stockCodePrefix || planItem.category || 'Other';
          let subCategory = category.subCategories.find(sc => sc.name === subCategoryName);
          
          if (!subCategory) {
            subCategory = {
              id: `${categoryKey}_${subCategoryName}`,
              name: subCategoryName,
              totalOrderQty: 0,
              totalAddOnsQty: 0,
              totalQtyToOrder: 0,
              items: []
            };
            category.subCategories.push(subCategory);
          }
          
          // Add item to subcategory
          subCategory.items.push(lineItem);
          subCategory.totalOrderQty += lineItem.order_qty || 0;
          subCategory.totalAddOnsQty += lineItem.add_ons_qty || 0;
          subCategory.totalQtyToOrder += (lineItem.order_qty || 0) + (lineItem.add_ons_qty || 0);
          
          // Update category totals
          category.qty_per_week += (lineItem.order_qty || 0) + (lineItem.add_ons_qty || 0);
          category.totalOrderQty += lineItem.order_qty || 0;
          category.totalAddOnsQty += lineItem.add_ons_qty || 0;
          category.totalQtyToOrder += (lineItem.order_qty || 0) + (lineItem.add_ons_qty || 0);
        }
      });
      
      // Set processed categories with proper structure
      const processedCategories = Array.from(categoryMap.values());
      
      console.log(`📦 [processPreloadedData] Processed ${processedCategories.length} categories from ${weeklyPlanData.length} weekly plan items`);
      console.log('📦 [processPreloadedData] Categories with subcategories:', processedCategories.map(c => ({
        category: c.category,
        subCategoryCount: c.subCategories?.length || 0,
        totalItems: c.subCategories?.reduce((sum, sc) => sum + (sc.items?.length || 0), 0) || 0,
        subCategories: c.subCategories?.map(sc => ({
          name: sc.name,
          itemCount: sc.items?.length || 0
        })) || []
      })));
      
      // Set state directly without React.startTransition to avoid race conditions
      setCategories(processedCategories);
      // Extract actual amendments from the combined data - look for items that have amendments
      // Try multiple detection methods to catch all amendments
      const amendmentsByFlag = weeklyPlanData.filter((item: any) => 
        item.has_amendment === true && item.amendment_data
      );
      
      const amendmentsByStatus = weeklyPlanData.filter((item: any) => 
        item.status && ['pending', 'submitted', 'approved', 'rejected'].includes(item.status)
      );
      
      const amendmentsByQty = weeklyPlanData.filter((item: any) => 
        item.amended_qty !== null && item.amended_qty !== undefined
      );
      
      const amendmentsByJustification = weeklyPlanData.filter((item: any) => 
        item.justification && item.justification.trim().length > 0
      );
      
      console.log(`📋 [processPreloadedData] Amendment detection results:`, {
        byFlag: amendmentsByFlag.length,
        byStatus: amendmentsByStatus.length, 
        byQty: amendmentsByQty.length,
        byJustification: amendmentsByJustification.length
      });
      
      // Use the method that finds the most amendments (likely the correct one)
      let actualAmendments = amendmentsByFlag;
      if (amendmentsByStatus.length > actualAmendments.length) actualAmendments = amendmentsByStatus;
      if (amendmentsByQty.length > actualAmendments.length) actualAmendments = amendmentsByQty;
      if (amendmentsByJustification.length > actualAmendments.length) actualAmendments = amendmentsByJustification;
      
      const selectedMethod = actualAmendments === amendmentsByFlag ? 'flag' : 
                          actualAmendments === amendmentsByStatus ? 'status' :
                          actualAmendments === amendmentsByQty ? 'qty' : 'justification';
      
      console.log(`📋 [processPreloadedData] Selected '${selectedMethod}' method with ${actualAmendments.length} amendments`);
      console.log(`📋 [processPreloadedData] Checking first 3 items for amendment structure:`, weeklyPlanData.slice(0, 3).map(item => ({
        has_amendment: item.has_amendment,
        amendment_data: !!item.amendment_data,
        stock_code: item.stock_code,
        store_name: item.store_name
      })));
      
      if (actualAmendments.length > 0) {
        console.log(`📋 [processPreloadedData] Sample items with amendments:`, actualAmendments.slice(0, 2));
        console.log(`📋 [processPreloadedData] First amendment data:`, actualAmendments[0]?.amendment_data);
      } else {
        console.log(`📋 [processPreloadedData] No amendments found with has_amendment flag. Checking for alternative indicators...`);
        
        // Check for items with amendment-specific fields
        const itemsWithAmendedQty = weeklyPlanData.filter((item: any) => item.amended_qty !== null && item.amended_qty !== undefined);
        console.log(`📋 [processPreloadedData] Items with amended_qty: ${itemsWithAmendedQty.length}`);
        
        // Check for items with amendment status
        const itemsWithStatus = weeklyPlanData.filter((item: any) => 
          item.status && ['pending', 'submitted', 'approved', 'rejected'].includes(item.status)
        );
        console.log(`📋 [processPreloadedData] Items with amendment status: ${itemsWithStatus.length}`);
        
        // Check for items with justification (amendment indicator)
        const itemsWithJustification = weeklyPlanData.filter((item: any) => item.justification);
        console.log(`📋 [processPreloadedData] Items with justification: ${itemsWithJustification.length}`);
        
        // Use the most promising source for amendments
        if (itemsWithStatus.length > 0) {
          console.log(`📋 [processPreloadedData] Using ${itemsWithStatus.length} items with status as amendments`);
          const amendmentsForDisplay = itemsWithStatus.map((item: any) => ({
            id: item.id,
            weekly_plan_id: item.weekly_plan_id || item.id,
            store_id: item.store_id,
            stock_code: item.stock_code,
            category: item.category,
            sub_category: item.sub_category,
            week_reference: item.reference,
            amendment_type: item.amendment_type || 'quantity_change',
            original_qty: item.original_order_qty || item.order_qty,
            amended_qty: item.amended_qty,
            approved_qty: item.approved_qty,
            justification: item.justification,
            status: item.status,
            created_at: item.created_at,
            updated_at: item.updated_at,
            created_by: item.created_by,
            admin_notes: item.admin_notes,
            store_name: item.store_name,
            description: item.description
          }));
          setPendingAmendments(amendmentsForDisplay);
          return;
        }
      }
      
      // Convert to amendment format for the UI
      const amendmentsForDisplay = actualAmendments.map((item: any) => ({
        ...item.amendment_data,
        store_name: item.store_name,
        description: item.description,
        stock_code: item.stock_code,
        category: item.category,
        sub_category: item.sub_category
      }));
      
      console.log(`📋 [processPreloadedData] Setting ${amendmentsForDisplay.length} amendments for display`);
      setPendingAmendments(amendmentsForDisplay);
      
      // Set default active tab if categories exist
      if (processedCategories.length > 0 && !activeTab) {
        setActiveTab(processedCategories[0].id);
      }
      
      setIsInitialDataLoaded(true);
      setIsDataProcessing(false);
      setDataLoadingStage('');
      
      return true;
    } catch (error) {
      console.error('❌ [processPreloadedData] Error processing preloaded data:', error);
      console.error('❌ [processPreloadedData] Stack trace:', error.stack);
      
      // Even if processing fails, we should still set basic state to prevent database fallback
      try {
        React.startTransition(() => {
          setIsInitialDataLoaded(true);
          setIsDataProcessing(false);
          setDataLoadingStage('');
          if (preloadedData?.storesWithSubmissions) {
            setPendingAmendments(preloadedData.storesWithSubmissions);
          }
        });
        console.log('⚙️ [processPreloadedData] Set basic state despite processing error');
        return true; // Return true to prevent database fallback
      } catch (fallbackError) {
        console.error('❌ [processPreloadedData] Even fallback processing failed:', fallbackError);
        return false;
      }
    }
  }, [preloadedData, currentWeek]);
  
  // Load categories and amendments when using preloaded data
  const loadCategoriesAndAmendments = useCallback(async () => {
    console.log('🔍 [loadCategoriesAndAmendments] Called with:', {
      userHierarchy: !!userHierarchy,
      currentWeek: !!currentWeek,
      currentWeekReference: currentWeek?.week_reference,
      storeHierarchyLength: storeHierarchy.length,
      userRole,
      isInitialDataLoaded,
      categoriesLength: categories.length,
      hasPreloadedData: !!preloadedData,
      preloadedDataStoresWithSubmissionsLength: preloadedData?.storesWithSubmissions?.length || 0
    });
    
    // Prevent unnecessary reloading if data is already loaded
    if (isInitialDataLoaded && categories.length > 0) {
      console.log('🛑 [loadCategoriesAndAmendments] Data already loaded, skipping reload');
      return;
    }
    
    // Try preloaded data processing first
    if (preloadedData) {
      try {
        const processed = await processPreloadedData();
        console.log('✅ [loadCategoriesAndAmendments] Processed preloaded data:', processed);
        
        if (processed) {
          console.log('✅ [loadCategoriesAndAmendments] Successfully processed preloaded data, skipping database queries');
          return;
        } else {
          console.log('⚠️ [loadCategoriesAndAmendments] Preloaded data processing failed, but FORCING completion to prevent database fallback');
          // Force completion even if processing had issues
          setIsInitialDataLoaded(true);
          return;
        }
      } catch (error) {
        console.error('❌ [loadCategoriesAndAmendments] Error in processPreloadedData:', error);
        setIsInitialDataLoaded(true);
        return;
      }
    }
    
    if (!userHierarchy || !currentWeek || !storeHierarchy.length) {
      console.log('🛑 [loadCategoriesAndAmendments] Missing required data:', {
        userHierarchy: !!userHierarchy,
        currentWeek: !!currentWeek,
        storeHierarchyLength: storeHierarchy.length
      });
      return;
    }
    
    console.log('⚠️ [loadCategoriesAndAmendments] No preloaded data available, falling back to database queries');
    setIsLoading(true);
    setIsDataProcessing(true);
    setDataLoadingStage('Loading weekly plan data...');
    
    try {
      const db = checkSupabase();
      const storeNames = storeHierarchy.map(s => s.store_name);
      
      // Get weekly plan data with pagination to handle large datasets
      console.log('Loading weekly plan data for reference:', currentWeek.week_reference, 'userRole:', userRole);
      let weeklyPlanData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = db
          .from('weekly_plan')
          .select('*')
          .eq('reference', currentWeek.week_reference);
        
        // For non-admin users, filter by assigned store names
        if (userRole !== 'admin') {
          query = query.in('store_name', storeNames);
        }
        
        console.log(`Loading batch ${from} to ${from + pageSize - 1} for reference:`, currentWeek.week_reference);
        const { data: batchData, error: planError } = await query
          .range(from, from + pageSize - 1);

        if (planError) {
          console.error('Error loading weekly plan batch:', planError);
          throw planError;
        }

        if (batchData && batchData.length > 0) {
          console.log(`Loaded ${batchData.length} items in batch`);
          weeklyPlanData = [...weeklyPlanData, ...batchData];
          from += pageSize;
          hasMore = batchData.length === pageSize;
        } else {
          console.log('No more data to load');
          hasMore = false;
        }
      }
      
      console.log(`Total weekly plan items loaded: ${weeklyPlanData.length}`);

      // Get amendments based on user role - filter by user_id instead of amendment_type
      // Collect user IDs whose amendments we want to see based on role hierarchy
      const relevantUserIds: string[] = [];
      
      if (userRole === 'admin') {
        // Admin users see all amendments - don't filter by user ID
        // We'll handle this differently in the query
      } else if (userRole === 'area_manager') {
        // Area managers see their own amendments and store manager amendments from their stores
        relevantUserIds.push(userHierarchy.id); // Their own amendments
        
        // Add store managers from their hierarchy
        storeHierarchy.forEach(store => {
          if (store.store_manager_id) {
            relevantUserIds.push(store.store_manager_id);
          }
        });
      } else if (userRole === 'regional_manager') {
        // Regional managers see area manager amendments from their area
        relevantUserIds.push(userHierarchy.id); // Their own amendments
        
        // Add area managers from their hierarchy
        storeHierarchy.forEach(store => {
          if (store.area_manager_id) {
            relevantUserIds.push(store.area_manager_id);
          }
        });
      } else {
        // Store managers see only their own amendments
        relevantUserIds.push(userHierarchy.id);
      }
      
      // Remove duplicates
      const uniqueUserIds = [...new Set(relevantUserIds)];

      // Get amendments data with pagination to handle large datasets
      let amendmentData: any[] = [];
      let amendmentFrom = 0;
      let amendmentHasMore = true;

      while (amendmentHasMore) {
        // Get store IDs for the query
        const storeIds = storeHierarchy.map(s => s.store_id);
        
        let amendmentQuery = db
          .from('weekly_plan_amendments')
          .select('*')
          .eq('week_reference', currentWeek.week_reference);
        
        // For admin users, don't filter by user ID or store ID to see all amendments
        if (userRole !== 'admin') {
          amendmentQuery = amendmentQuery
            .in('user_id', uniqueUserIds)
            .in('store_id', storeIds);
        }
        
        const { data: batchAmendmentData, error: amendmentError } = await amendmentQuery
          .range(amendmentFrom, amendmentFrom + pageSize - 1);

        if (amendmentError) throw amendmentError;

        if (batchAmendmentData && batchAmendmentData.length > 0) {
          amendmentData = [...amendmentData, ...batchAmendmentData];
          amendmentFrom += pageSize;
          amendmentHasMore = batchAmendmentData.length === pageSize;
        } else {
          amendmentHasMore = false;
        }
      }

      // Process weekly plan data into categories
      const categoryMap = new Map<string, CategoryData>();
      
      (weeklyPlanData || []).forEach(item => {
        const category = item.category || 'Uncategorized';
        
        if (!categoryMap.has(category)) {
          categoryMap.set(category, {
            id: category,
            name: category,
            items: [],
            subCategories: [],
            storeBreakdown: {},
            pendingAmendments: 0,
            submittedAmendments: 0,
            totalOrderQty: 0,
            totalAddOnsQty: 0,
            totalQtyToOrder: 0
          });
        }
        
        const categoryData = categoryMap.get(category)!;
        const storeInfo = storeHierarchy.find(s => s.store_name === item.store_name);
        
        const weeklyPlanItem = {
          id: item.id,
          stock_code: item.stock_code,
          description: item.description,
          category: item.category,
          sub_category: item.sub_category,
          store_name: item.store_name,
          store_id: storeInfo?.store_id || null, // Use null instead of item.id to avoid confusion
          reference: item.reference,
          order_qty: item.order_qty || 0,
          act_order_qty: item.act_order_qty || 0,
          add_ons_qty: item.add_ons_qty || 0,
          qty_on_hand: item.qty_on_hand || 0,
          qty_in_transit: item.qty_in_transit || 0,
          qty_pending_orders: item.qty_pending_orders || 0,
          model_stock_qty: item.model_stock_qty || 0,
          start_date: item.start_date
        };

        categoryData.items.push(weeklyPlanItem);
        categoryData.totalOrderQty += weeklyPlanItem.order_qty;
        categoryData.totalAddOnsQty += weeklyPlanItem.add_ons_qty;
        categoryData.totalQtyToOrder += weeklyPlanItem.order_qty + weeklyPlanItem.add_ons_qty;
        
        // Track store breakdown
        if (!categoryData.storeBreakdown[item.store_name]) {
          categoryData.storeBreakdown[item.store_name] = {
            storeName: item.store_name,
            qty: 0
          };
        }
        categoryData.storeBreakdown[item.store_name].qty += weeklyPlanItem.order_qty + weeklyPlanItem.add_ons_qty;
      });

      // Group items by sub-category
      categoryMap.forEach((categoryData) => {
        const subCategoryMap = new Map<string, SubCategoryData>();
        
        categoryData.items.forEach(item => {
          const subCategory = item.sub_category || 'General';
          
          if (!subCategoryMap.has(subCategory)) {
            subCategoryMap.set(subCategory, {
              id: subCategory,
              name: subCategory,
              items: [],
              totalOrderQty: 0,
              totalAddOnsQty: 0,
              totalQtyToOrder: 0
            });
          }
          
          const subCategoryData = subCategoryMap.get(subCategory)!;
          subCategoryData.items.push(item);
          subCategoryData.totalOrderQty += item.order_qty;
          subCategoryData.totalAddOnsQty += item.add_ons_qty;
          subCategoryData.totalQtyToOrder += item.order_qty + item.add_ons_qty;
        });

        categoryData.subCategories = Array.from(subCategoryMap.values());
      });

      // Process amendments and sort by created_at to ensure we apply the latest amendment
      const amendmentsList: Amendment[] = (amendmentData || [])
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map(amendment => {
          // Find store name from hierarchy
          const store = storeHierarchy.find(s => s.store_id === amendment.store_id);
          return {
            id: amendment.id,
            weekly_plan_id: amendment.weekly_plan_id || amendment.id,
            store_id: amendment.store_id,
            stock_code: amendment.stock_code,
            category: amendment.category,
            week_reference: amendment.week_reference,
            week_start_date: amendment.week_start_date || currentWeek.week_start_date,
            amendment_type: amendment.amendment_type,
            original_qty: amendment.original_qty || 0,
            amended_qty: amendment.amended_qty || 0,
            approved_qty: amendment.approved_qty,
            justification: amendment.justification || '',
            status: amendment.status,
            created_by: amendment.created_by,
            admin_notes: amendment.admin_notes || '',
            created_at: amendment.created_at,
            updated_at: amendment.updated_at,
            store_name: store?.store_name || 'Unknown Store',
            description: amendment.description || ''
          };
        });

      // Apply amendments to items and update counts
      amendmentsList.forEach(amendment => {
        const category = categoryMap.get(amendment.category || 'Uncategorized');
        if (category) {
          // Update amendment counts
          if (amendment.status === 'pending') {
            category.pendingAmendments++;
          } else {
            category.submittedAmendments++;
          }

          // Apply amendments to items in subcategories (where they are actually rendered from)
          category.subCategories?.forEach(subCategory => {
            subCategory.items?.forEach(item => {
              if (item.id === amendment.weekly_plan_id && 
                  item.stock_code === amendment.stock_code &&
                  item.store_id === amendment.store_id) {
                // Use approved_qty if admin modified it, otherwise use amended_qty
                const finalQty = amendment.approved_qty !== null && amendment.approved_qty !== undefined 
                  ? amendment.approved_qty 
                  : amendment.amended_qty;
                item.add_ons_qty = finalQty;
              }
            });
          });
          
          // Also update in the main category items array
          category.items.forEach(item => {
            if (item.id === amendment.weekly_plan_id && 
                item.stock_code === amendment.stock_code &&
                item.store_id === amendment.store_id) {
              // Use approved_qty if admin modified it, otherwise use amended_qty
              const finalQty = amendment.approved_qty !== null && amendment.approved_qty !== undefined 
                ? amendment.approved_qty 
                : amendment.amended_qty;
              item.add_ons_qty = finalQty;
            }
          });
        } else {
          console.log(`Category not found for amendment: ${amendment.category}`);
        }
      });

      // Recalculate totals after applying amendments
      categoryMap.forEach((categoryData) => {
        // Reset category totals
        categoryData.totalOrderQty = 0;
        categoryData.totalAddOnsQty = 0;
        categoryData.totalQtyToOrder = 0;
        
        // Recalculate from subcategories
        categoryData.subCategories.forEach(subCategory => {
          subCategory.totalOrderQty = 0;
          subCategory.totalAddOnsQty = 0;
          subCategory.totalQtyToOrder = 0;
          
          subCategory.items?.forEach(item => {
            subCategory.totalOrderQty += item.order_qty;
            subCategory.totalAddOnsQty += item.add_ons_qty;
            subCategory.totalQtyToOrder += item.order_qty + item.add_ons_qty;
          });
          
          categoryData.totalOrderQty += subCategory.totalOrderQty;
          categoryData.totalAddOnsQty += subCategory.totalAddOnsQty;
          categoryData.totalQtyToOrder += subCategory.totalQtyToOrder;
        });
      });

      // Set all state at once
      const categoriesArray = Array.from(categoryMap.values());
      
      console.log('Categories processed:', {
        totalCategories: categoriesArray.length,
        categoryNames: categoriesArray.map(c => c.name),
        totalItems: categoriesArray.reduce((sum, c) => sum + (c.items?.length || 0), 0),
        totalSubCategories: categoriesArray.reduce((sum, c) => sum + (c.subCategories?.length || 0), 0),
        categoriesWithSubcategories: categoriesArray.map(c => ({
          name: c.name,
          itemsCount: c.items?.length || 0,
          subCategoriesCount: c.subCategories?.length || 0,
          subCategoryNames: c.subCategories.map(sc => sc.name)
        }))
      });
      
      setCategories(categoriesArray);
      setPendingAmendments(amendmentsList);
      
      // Set first tab as active
      if (categoriesArray.length > 0) {
        setActiveTab(showSummaryTab ? 'summary' : categoriesArray[0].id);
        console.log('Active tab set to:', showSummaryTab ? 'summary' : categoriesArray[0].id);
      } else {
        console.log('No categories available to set active tab');
      }

      toast({
        title: 'Success',
        description: 'Weekly plan data loaded successfully',
      });
    } catch (error) {
      console.error('Error loading categories and amendments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load categories and amendments. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
      setIsDataProcessing(false);
      setDataLoadingStage('');
    }
  }, [userHierarchy, currentWeek, storeHierarchy, userRole, showSummaryTab, toast, isInitialDataLoaded]); // Remove categories to prevent circular dependency

  const loadAllData = useCallback(async () => {
    if (!user || isDataLoaded) return;
    
    setIsLoading(true);
    
    try {
      // Get user hierarchy
      const hierarchy = await getUserHierarchy(user.id);
      if (!hierarchy) {
        setError('Access Denied: User not found in management hierarchy');
        return;
      }

      if (hierarchy.hierarchyRole !== userRole && hierarchy.hierarchyRole !== 'admin') {
        setError(`Access Denied: Required role ${userRole}, but user has ${hierarchy.hierarchyRole}`);
        return;
      }

      setUserHierarchy(hierarchy);

      // Get database connection first
      const db = checkSupabase();
      
      // Get store hierarchy - Admin users see all stores
      let stores;
      if (userRole === 'admin') {
        // For admin users, get all stores from the hierarchy table
        const { data: allStores, error: storesError } = await db
          .from('store_management_hierarchy')
          .select('*')
          .order('store_name', { ascending: true });
        
        if (storesError) {
          console.error('Error fetching all stores for admin:', storesError);
          setError('Failed to load stores for admin user');
          return;
        }
        
        stores = allStores || [];
      } else {
        // For non-admin users, get assigned stores only
        stores = await getStoreHierarchyForUser(hierarchy.id);
      }
      
      setStoreHierarchy(stores);

      if (stores.length === 0) {
        setError(userRole === 'admin' ? 'No stores found in the system' : 'No stores assigned to this user');
        return;
      }

      // Get current week
      const { data: weekData, error: weekError } = await db
        .from('week_selections')
        .select('*')
        .eq('is_current', true)
        .eq('is_active', true)
        .single();

      if (weekError || !weekData) {
        toast({
          title: 'Error',
          description: 'No active week found. Please contact admin.',
          variant: 'destructive'
        });
        return;
      }

      const weekInfo = {
        week_reference: weekData.week_reference,
        week_start_date: weekData.week_start_date,
        week_end_date: weekData.week_end_date,
        is_current: weekData.is_current,
        is_active: weekData.is_active,
        week_status: weekData.week_status
      };

      setCurrentWeek(weekInfo);

      // Get assigned store IDs
      const assignedStoreIds = stores.map(s => s.store_id);
      const storeNames = stores.map(s => s.store_name);

      // Get weekly plan data with pagination to handle large datasets
      let weeklyPlanData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = db
          .from('weekly_plan')
          .select('*')
          .eq('reference', weekInfo.week_reference);
        
        // For non-admin users, filter by assigned store names
        if (userRole !== 'admin') {
          query = query.in('store_name', storeNames);
        }
        
        const { data: batchData, error: planError } = await query
          .range(from, from + pageSize - 1);

        if (planError) throw planError;

        if (batchData && batchData.length > 0) {
          weeklyPlanData = [...weeklyPlanData, ...batchData];
          from += pageSize;
          hasMore = batchData.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      // Get amendments based on user role
      const amendmentType = userRole === 'admin' ? 'admin' :
                           userRole === 'regional_manager' ? 'area_manager' : 
                           userRole === 'area_manager' ? 'store_manager' : 
                           'store_manager';

      // Get amendments data with pagination to handle large datasets
      let amendmentData: any[] = [];
      from = 0;
      hasMore = true;

      while (hasMore) {
        let amendmentQuery = db
          .from('weekly_plan_amendments')
          .select(`
            *,
            weekly_plan:weekly_plan_id (
              store_name,
              description
            )
          `)
          .eq('week_reference', weekInfo.week_reference);
        
        // For non-admin users, filter by assigned store IDs and specific amendment type
        if (userRole !== 'admin') {
          amendmentQuery = amendmentQuery
            .in('store_id', assignedStoreIds)
            .eq('amendment_type', amendmentType);
        }
        // Admin users can see all amendment types, but we can optionally filter by admin workflow
        else if (adminWorkflow) {
          amendmentQuery = amendmentQuery.eq('amendment_type', amendmentType);
        }
        
        // For admin workflow, show multiple statuses including submitted, area_manager_approved, regional_direct, area_direct
        const { data: batchAmendmentData, error: amendmentError } = await amendmentQuery
          .in('status', adminWorkflow ? ['submitted', 'area_manager_approved', 'regional_direct', 'area_direct', 'pending'] : ['submitted'])
          .range(from, from + pageSize - 1);

        if (amendmentError) throw amendmentError;

        if (batchAmendmentData && batchAmendmentData.length > 0) {
          amendmentData = [...amendmentData, ...batchAmendmentData];
          from += pageSize;
          hasMore = batchAmendmentData.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      // Process weekly plan data into categories
      const categoryMap = new Map<string, CategoryData>();
      
      (weeklyPlanData || []).forEach(item => {
        const category = item.category || 'Uncategorized';
        
        if (!categoryMap.has(category)) {
          categoryMap.set(category, {
            id: category,
            name: category,
            items: [],
            subCategories: [],
            storeBreakdown: {},
            pendingAmendments: 0,
            submittedAmendments: 0,
            totalOrderQty: 0,
            totalAddOnsQty: 0,
            totalQtyToOrder: 0
          });
        }
        
        const categoryData = categoryMap.get(category)!;
        const weeklyPlanItem = {
          id: item.id,
          stock_code: item.stock_code,
          description: item.description,
          category: item.category,
          sub_category: item.sub_category,
          store_name: item.store_name,
          store_id: stores.find(s => s.store_name === item.store_name)?.store_id || item.id,
          reference: item.reference,
          order_qty: item.order_qty || 0,
          act_order_qty: item.act_order_qty || 0,
          add_ons_qty: item.add_ons_qty || 0,
          qty_on_hand: item.qty_on_hand || 0,
          qty_in_transit: item.qty_in_transit || 0,
          qty_pending_orders: item.qty_pending_orders || 0,
          model_stock_qty: item.model_stock_qty || 0,
          start_date: item.start_date
        };

        categoryData.items.push(weeklyPlanItem);
        categoryData.totalOrderQty += weeklyPlanItem.order_qty;
        categoryData.totalAddOnsQty += weeklyPlanItem.add_ons_qty;
        categoryData.totalQtyToOrder += weeklyPlanItem.order_qty + weeklyPlanItem.add_ons_qty;

        if (!categoryData.storeBreakdown[item.store_name]) {
          categoryData.storeBreakdown[item.store_name] = {
            storeName: item.store_name,
            qty: 0
          };
        }
        categoryData.storeBreakdown[item.store_name].qty += (item.order_qty || 0);
      });

      // Group items by sub-category
      console.log('Processing subcategories for', categoryMap.size, 'categories');
      categoryMap.forEach((categoryData) => {
        console.log(`Processing subcategories for category "${categoryData.name}" with ${categoryData.items?.length || 0} items`);
        const subCategoryMap = new Map<string, SubCategoryData>();
        
        categoryData.items.forEach(item => {
          const subCategory = item.sub_category || 'General';
          
          if (!subCategoryMap.has(subCategory)) {
            console.log(`Creating new subcategory "${subCategory}" in category "${categoryData.name}"`);
            subCategoryMap.set(subCategory, {
              id: subCategory,
              name: subCategory,
              items: [],
              totalOrderQty: 0,
              totalAddOnsQty: 0,
              totalQtyToOrder: 0
            });
          }
          
          const subCategoryData = subCategoryMap.get(subCategory)!;
          subCategoryData.items.push(item);
          subCategoryData.totalOrderQty += item.order_qty;
          subCategoryData.totalAddOnsQty += item.add_ons_qty;
          subCategoryData.totalQtyToOrder += item.order_qty + item.add_ons_qty;
        });

        categoryData.subCategories = Array.from(subCategoryMap.values());
        console.log(`Category "${categoryData.name}" now has ${categoryData.subCategories?.length || 0} subcategories:`, 
          categoryData.subCategories?.map(sc => `${sc.name} (${sc.items?.length || 0} items)`) || []);
      });

      // Process amendments
      const amendmentsList: Amendment[] = (amendmentData || []).map(item => ({
        id: item.id,
        weekly_plan_id: item.weekly_plan_id,
        store_id: item.store_id,
        stock_code: item.stock_code,
        category: item.category,
        week_reference: item.week_reference,
        week_start_date: item.week_start_date,
        amendment_type: item.amendment_type,
        original_qty: item.original_qty,
        amended_qty: item.amended_qty,
        approved_qty: item.approved_qty,
        justification: item.justification,
        status: item.status,
        created_at: item.created_at,
        updated_at: item.updated_at,
        created_by: item.created_by,
        admin_notes: item.admin_notes,
        store_name: item.weekly_plan?.store_name || 'Unknown Store',
        description: item.weekly_plan?.description || 'Unknown Item'
      }));

      // Set all state at once
      const categoriesArray = Array.from(categoryMap.values());
      
      setCategories(categoriesArray);
      setPendingAmendments(amendmentsList);
      
      // Set first tab as active
      if (categoriesArray.length > 0) {
        setActiveTab(showSummaryTab ? 'summary' : categoriesArray[0].id);
      }
      
      // Load regional managers for admin users (for filtering)
      if (userRole === 'admin' && enableRegionalFilter) {
        try {
          const { data: regionalManagersData, error: rmError } = await db
            .from('users')
            .select('id, first_name, last_name, email')
            .eq('role', 'regional_manager')
            .order('first_name');

          if (!rmError && regionalManagersData) {
            setRegionalManagers(regionalManagersData);
          }
        } catch (error) {
          console.error('Error loading regional managers:', error);
          // Don't fail the whole load for this optional feature
        }
      }

      setIsDataLoaded(true);
      setError(null);

      toast({
        title: 'Success',
        description: 'Weekly plan data loaded successfully',
      });
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load weekly plan data');
      toast({
        title: 'Error',
        description: 'Failed to load data. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, userRole, isDataLoaded, showSummaryTab, toast]);

  const handleRefresh = () => {
    setIsDataLoaded(false);
    setError(null);
    loadAllData();
  };

  // Handle amendment approval/rejection (for Regional Managers and Admins)
  const handleAmendmentAction = async (amendmentId: string, action: 'approve' | 'reject') => {
    if (userRole !== 'regional_manager' && userRole !== 'admin') return;

    try {
      const db = checkSupabase();
      
      const { error } = await db
        .from('weekly_plan_amendments')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          admin_notes: adminNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', amendmentId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Amendment ${action}d successfully`,
      });

      // Update local state
      setPendingAmendments(prev => prev.filter(a => a.id !== amendmentId));
      setReviewingAmendment(null);
      setAdminNotes('');
    } catch (error) {
      console.error('Error updating amendment:', error);
      toast({
        title: 'Error',
        description: `Failed to ${action} amendment`,
        variant: 'destructive'
      });
    }
  };

  // Handle admin modification of amendment (for Admins only)
  const handleAdminModifyAmendment = async (amendmentId: string, newQty: number) => {
    if (userRole !== 'admin' || !adminWorkflow) return;

    try {
      const db = checkSupabase();
      
      const { error } = await db
        .from('weekly_plan_amendments')
        .update({
          approved_qty: newQty,
          status: 'approved',
          admin_notes: adminNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', amendmentId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Amendment modified and approved with quantity ${newQty}`,
      });

      // Force reload by temporarily resetting data loaded flag
      setIsInitialDataLoaded(false);
      
      // Clear existing amendments to force reload
      setPendingAmendments([]);
      
      // If we have preloaded data, we need to refresh from parent component
      if (preloadedData) {
        // Signal to parent that data needs refresh
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'REFRESH_AMENDMENT_DATA' }, '*');
        }
        // For immediate update, we'll re-process preloaded data if available
        if (preloadedData.storesWithSubmissions || preloadedData.amendments) {
          await processPreloadedData();
        }
      }
      
      // Reload amendments
      await loadCategoriesAndAmendments();
      setReviewingAmendment(null);
      setAdminNotes('');
    } catch (error) {
      console.error('Error modifying amendment:', error);
      toast({
        title: 'Error',
        description: 'Failed to modify amendment. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Admin approval function for inline actions in detail view
  const handleAmendmentApproval = async (amendmentId: string, action: 'approve' | 'reject') => {
    if (userRole !== 'admin' || !adminWorkflow) return;

    try {
      const db = checkSupabase();
      
      // First get the amendment to access amended_qty
      const { data: amendment, error: fetchError } = await db
        .from('weekly_plan_amendments')
        .select('amended_qty, user_id')
        .eq('id', amendmentId)
        .single();

      if (fetchError || !amendment) {
        console.error('Error fetching amendment:', fetchError);
        toast({
          title: 'Error',
          description: 'Could not retrieve amendment details',
          variant: 'destructive'
        });
        return;
      }

      // Get admin info from preloaded data or user context
      const adminInfo = preloadedData?.areaManagerInfo || userHierarchy;
      
      const updateData = {
        status: action === 'approve' ? 'approved' : 'rejected',
        admin_id: adminInfo?.id || user?.id || null,
        approved_qty: action === 'approve' ? amendment.amended_qty : null,
        admin_notes: action === 'approve' ? 'Approved by admin' : 'Rejected by admin',
        admin_approved_at: action === 'approve' ? new Date().toISOString() : null,
        admin_rejected_at: action === 'reject' ? new Date().toISOString() : null,
        admin_approved_by: adminInfo?.name || adminInfo?.email || user?.fullName || 'Admin',
        updated_at: new Date().toISOString()
      };

      const { error } = await db
        .from('weekly_plan_amendments')
        .update(updateData)
        .eq('id', amendmentId);

      if (error) {
        console.error('Error updating amendment:', error);
        toast({
          title: 'Error',
          description: `Failed to update amendment: ${error.message}`,
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Success',
        description: `Amendment ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      });

      // Force reload by temporarily resetting data loaded flag
      setIsInitialDataLoaded(false);
      
      // Clear existing amendments to force reload
      setPendingAmendments([]);
      
      // If we have preloaded data, we need to refresh from parent component
      if (preloadedData) {
        // Signal to parent that data needs refresh
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'REFRESH_AMENDMENT_DATA' }, '*');
        }
        // For immediate update, we'll re-process preloaded data if available
        if (preloadedData.storesWithSubmissions || preloadedData.amendments) {
          await processPreloadedData();
        }
      }
      
      // Reload data
      await loadCategoriesAndAmendments();

    } catch (error) {
      console.error('Error in amendment approval:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive'
      });
    }
  };

  // Handle store context opening
  const handleOpenStoreContext = (storeId: string, storeName: string, amendment?: any) => {
    console.log('🏪 [StoreContext] Opening store context for:', { storeId, storeName });
    
    // Use raw unfiltered data from preloadedData instead of filtered categories
    let allStoreItems: any[] = [];
    
    if (preloadedData?.storesWithSubmissions) {
      // Get all items for this store from the original unfiltered data
      allStoreItems = preloadedData.storesWithSubmissions.filter((item: any) => 
        item.store_id === storeId
      );
    } else {
      // Fallback to categories if preloadedData not available
      categories.forEach(category => {
        category.items.forEach(item => {
          if (item.store_id === storeId) {
            allStoreItems.push(item);
          }
        });
      });
    }
    
    // Find all amendments for this store (this should remain unfiltered)
    const storeAmendments = pendingAmendments.filter(a => a.store_id === storeId);
    
    // Find store details
    const storeDetails = storeHierarchy.find(s => s.store_id === storeId);
    
    console.log('🏪 [StoreContext] Store data collected (from raw data):', {
      totalItems: allStoreItems.length,
      itemsWithQty: allStoreItems.filter(i => (i.qty_to_order || 0) > 0).length,
      amendments: storeAmendments.length,
      storeDetails,
      dataSource: preloadedData?.storesWithSubmissions ? 'preloadedData' : 'categories'
    });
    
    setSelectedStoreContext({
      storeId,
      storeName: storeName || storeDetails?.store_name || 'Unknown Store',
      region: storeDetails?.region,
      allItems: allStoreItems,
      amendments: storeAmendments
    });
    
    setStoreContextOpen(true);
  };

  // Handle line item editing
  const startEditingItem = (itemId: string, item: WeeklyPlanItem) => {
    setEditingItems(prev => new Set([...prev, itemId]));
    setEditingData(prev => ({
      ...prev,
      [itemId]: {
        order_qty: item.order_qty,
        add_ons_qty: item.add_ons_qty,
        comment: ''
      }
    }));
    
    // Focus the add_ons_qty input field after next render
    setTimeout(() => {
      const inputElement = document.querySelector(`input[data-item-id="${itemId}"]`) as HTMLInputElement;
      if (inputElement) {
        inputElement.focus();
        inputElement.select(); // Select all text for immediate replacement
      }
    }, 50);
  };

  const cancelEditingItem = (itemId: string) => {
    setEditingItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(itemId);
      return newSet;
    });
    setEditingData(prev => {
      const newData = { ...prev };
      delete newData[itemId];
      return newData;
    });
  };

  const updateEditingData = useCallback((itemId: string, field: 'order_qty' | 'add_ons_qty' | 'comment', value: number | string) => {
    // Only add_ons_qty is editable - order_qty is read-only for all roles
    if (field === 'order_qty') return;
    
    setEditingData(prev => {
      // Only update if value actually changed to prevent unnecessary re-renders
      if (prev[itemId] && prev[itemId][field] === value) {
        return prev;
      }
      return {
        ...prev,
        [itemId]: {
          ...prev[itemId],
          [field]: value
        }
      };
    });
  }, []);

  const saveItemEdit = async (itemId: string, item: WeeklyPlanItem) => {
    if (!userHierarchy || !currentWeek) return;

    const editData = editingData[itemId];
    if (!editData) return;

    try {
      const db = checkSupabase();
      
      // Find the store_id from store hierarchy using store_name
      const store = storeHierarchy.find(s => s.store_name === item.store_name);
      const storeId = store ? store.store_id : null;
      
      if (!storeId) {
        throw new Error(`Could not find store_id for store: ${item.store_name}`);
      }
      
      // Determine amendment type based on user role and change type
      // Database constraint allows: 'add_on', 'quantity_change', 'new_item', 'admin_edit'
      const amendmentTypeMap: Record<string, string> = {
        store_manager: 'quantity_change',
        area_manager: 'add_on', 
        regional_manager: 'add_on'
      };

      // Map user role to allowed created_by_role values
      // Database constraint allows: 'regional_manager', 'admin'
      const createdByRoleMap: Record<string, string> = {
        store_manager: 'regional_manager',
        area_manager: 'regional_manager', 
        regional_manager: 'regional_manager',
        admin: 'admin'
      };

      const amendmentData = {
        weekly_plan_id: item.id || null,
        user_id: userHierarchy.id || null,
        store_id: storeId,
        stock_code: item.stock_code,
        category: item.category,
        week_reference: currentWeek.week_reference,
        week_start_date: currentWeek.week_start_date,
        amendment_type: amendmentTypeMap[userRole] || 'add_on',
        original_qty: item.add_ons_qty,
        amended_qty: editData?.add_ons_qty || 0,
        justification: editData?.comment || '',
        status: 'pending',
        created_by_role: createdByRoleMap[userRole] || 'regional_manager',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { error: amendmentError } = await db
        .from('weekly_plan_amendments')
        .insert(amendmentData);

      if (amendmentError) throw amendmentError;

      // Update local state
      const updatedCategories = categories.map(category => ({
        ...category,
        subCategories: category.subCategories?.map(subCategory => ({
          ...subCategory,
          items: subCategory.items?.map(subItem => 
            subItem.id === itemId 
              ? { 
                  ...subItem, 
                  add_ons_qty: editData?.add_ons_qty || subItem.add_ons_qty
                }
              : subItem
          ) || []
        })) || []
      }));

      setCategories(updatedCategories);
      cancelEditingItem(itemId);

      toast({
        title: 'Success',
        description: 'Amendment created successfully',
      });
    } catch (error) {
      console.error('Error saving item edit:', error);
      toast({
        title: 'Error',
        description: 'Failed to save changes',
        variant: 'destructive'
      });
    }
  };

  // Submit all amendments (role-specific)
  const handleSubmitAllAmendments = async () => {
    if (!userHierarchy || !currentWeek) return;

    try {
      setIsSubmitting(true);

      const db = checkSupabase();
      
      // First check existing submissions to avoid duplicates
      const { data: existingSubmissions, error: checkError } = await db
        .from('weekly_plan_submissions')
        .select('store_id, area_submission_status, regional_submission_status, store_submission_status')
        .eq('week_reference', currentWeek.week_reference)
        .in('store_id', storeHierarchy.map(s => s.store_id));

      if (checkError) throw checkError;

      // Determine which stores need submission based on role
      const storesToSubmit = storeHierarchy.filter(store => {
        const existingSubmission = existingSubmissions?.find(s => s.store_id === store.store_id);
        
        if (userRole === 'area_manager') {
          // Only submit if area hasn't submitted yet
          return !existingSubmission || existingSubmission.area_submission_status !== 'submitted';
        } else if (userRole === 'regional_manager') {
          // Only submit if regional hasn't submitted yet
          return !existingSubmission || existingSubmission.regional_submission_status !== 'submitted';
        } else if (userRole === 'store_manager') {
          // Only submit if store hasn't submitted yet
          return !existingSubmission || existingSubmission.store_submission_status !== 'submitted';
        }
        
        return false;
      });

      if (storesToSubmit.length === 0) {
        toast({
          title: 'Already Submitted',
          description: 'All stores have already been submitted for this week',
        });
        return;
      }

      // Submit only for stores that haven't been submitted yet
      for (const store of storesToSubmit) {
        const { error: hierarchicalError } = await db
          .rpc('update_hierarchical_submission_status', {
            p_store_id: store.store_id,
            p_week_reference: currentWeek.week_reference,
            p_level: userRole === 'regional_manager' ? 'regional' : 
                     userRole === 'area_manager' ? 'area' : 'store',
            p_status: 'submitted',
            p_manager_id: userHierarchy.id
          });

        if (hierarchicalError) {
          console.error('Error updating hierarchical submission status:', hierarchicalError);
          throw hierarchicalError;
        }
      }

      toast({
        title: 'Success',
        description: `Successfully submitted ${storesToSubmit.length} store${storesToSubmit.length > 1 ? 's' : ''}`,
      });
    } catch (error) {
      console.error('Error submitting amendments:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit amendments',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get status badge - matching admin interface styling
  const getStatusBadge = (status: string) => {
    const getStatusBadgeVariant = (status: string) => {
      switch (status) {
        case 'pending': return 'secondary';
        case 'submitted': return 'default';
        case 'approved': return 'default';
        case 'rejected': return 'destructive';
        default: return 'outline';
      }
    };

    const getStatusBadgeClasses = (status: string) => {
      switch (status) {
        case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200';
        case 'submitted': return 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200';
        case 'approved': return 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200';
        default: return '';
      }
    };

    const getStatusText = (status: string) => {
      switch (status) {
        case 'pending': return 'Pending';
        case 'submitted': return 'Pending Review';
        case 'approved': return 'Approved';
        case 'rejected': return 'Rejected';
        default: return 'Draft';
      }
    };

    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'pending': return <Clock className="h-3 w-3 mr-1" />;
        case 'submitted': return <Clock className="h-3 w-3 mr-1" />;
        case 'approved': return <CheckCircle className="h-3 w-3 mr-1" />;
        case 'rejected': return <XCircle className="h-3 w-3 mr-1" />;
        default: return <Edit className="h-3 w-3 mr-1" />;
      }
    };

    return (
      <Badge 
        variant={getStatusBadgeVariant(status)}
        className={getStatusBadgeClasses(status)}
      >
        {getStatusIcon(status)}
        {getStatusText(status)}
      </Badge>
    );
  };


  // Load data on mount or use preloaded data - prevent multiple processing
  useEffect(() => {
    if (preloadedData && !isDataLoaded && !hasProcessedPreloadedData) {
      // Use preloaded data to avoid reloading
      if (preloadedData.currentWeek) {
        setCurrentWeek(preloadedData.currentWeek);
      }
      if (preloadedData.storeHierarchy) {
        setStoreHierarchy(preloadedData.storeHierarchy);
      }
      
      // Create user hierarchy from preloaded area/regional manager info
      if (preloadedData.areaManagerInfo && userRole === 'area_manager') {
        setUserHierarchy({
          id: preloadedData.areaManagerInfo.id,
          first_name: preloadedData.areaManagerInfo.first_name,
          last_name: preloadedData.areaManagerInfo.last_name,
          email: preloadedData.areaManagerInfo.email,
          hierarchyRole: 'area_manager'
        });
      }
      if (preloadedData.regionalManagerInfo && userRole === 'regional_manager') {
        setUserHierarchy({
          id: preloadedData.regionalManagerInfo.id,
          first_name: preloadedData.regionalManagerInfo.first_name,
          last_name: preloadedData.regionalManagerInfo.last_name,
          email: preloadedData.regionalManagerInfo.email,
          hierarchyRole: 'regional_manager'
        });
      }
      if (preloadedData.areaManagerInfo && userRole === 'admin') {
        // For admin users, use the admin info passed as areaManagerInfo
        setUserHierarchy({
          id: preloadedData.areaManagerInfo.id,
          first_name: preloadedData.areaManagerInfo.name?.split(' ')[0] || 'Admin',
          last_name: preloadedData.areaManagerInfo.name?.split(' ').slice(1).join(' ') || 'User',
          email: preloadedData.areaManagerInfo.email,
          hierarchyRole: 'admin'
        });
      }
      
      // Reset isInitialDataLoaded to ensure processing can occur
      setIsInitialDataLoaded(false);
      
      setIsDataLoaded(true);
      setIsLoading(false);
      setHasProcessedPreloadedData(true);
    } else if (user && !isDataLoaded && !preloadedData) {
      loadAllData();
    }
  }, [preloadedData, isDataLoaded, hasProcessedPreloadedData]); // Only process once per preloaded data

  // Load categories and amendments after preloaded data is set
  useEffect(() => {
    console.log('🔍 [WeeklyPlanInterface] useEffect for loadCategoriesAndAmendments triggered:', {
      hasPreloadedData: !!preloadedData,
      hasProcessedPreloadedData,
      isDataLoaded,
      hasUserHierarchy: !!userHierarchy,
      hasCurrentWeek: !!currentWeek,
      storeHierarchyLength: storeHierarchy.length,
      isInitialDataLoaded,
      timestamp: new Date().toISOString()
    });
    
    console.log('🔍 [WeeklyPlanInterface] hasProcessedPreloadedData:', hasProcessedPreloadedData);
    console.log('🔍 [WeeklyPlanInterface] isDataLoaded:', isDataLoaded);
    console.log('🔍 [WeeklyPlanInterface] userHierarchy exists:', !!userHierarchy);
    console.log('🔍 [WeeklyPlanInterface] currentWeek exists:', !!currentWeek);
    console.log('🔍 [WeeklyPlanInterface] storeHierarchy.length:', storeHierarchy.length);
    console.log('🔍 [WeeklyPlanInterface] isInitialDataLoaded:', isInitialDataLoaded);
    console.log('🔍 [WeeklyPlanInterface] categories.length:', categories.length);
    console.log('🔍 [WeeklyPlanInterface] Final condition result:', hasProcessedPreloadedData && isDataLoaded && userHierarchy && currentWeek && storeHierarchy.length > 0 && (!isInitialDataLoaded || categories.length === 0));
    
    if (hasProcessedPreloadedData && isDataLoaded && userHierarchy && currentWeek && storeHierarchy.length > 0 && (!isInitialDataLoaded || categories.length === 0)) {
      console.log('🚀 [WeeklyPlanInterface] All conditions met - calling loadCategoriesAndAmendments');
      console.log('🔍 [WeeklyPlanInterface] Trigger reason:', {
        initialLoad: !isInitialDataLoaded,
        noCategories: categories.length === 0
      });
      // Don't set isInitialDataLoaded here - let loadCategoriesAndAmendments handle it
      loadCategoriesAndAmendments();
    } else {
      console.log('🛑 [WeeklyPlanInterface] Conditions not met for loadCategoriesAndAmendments - skipping');
      
      // Debug fallback condition
      console.log('🔍 [WeeklyPlanInterface] Fallback condition check:', {
        hasProcessedPreloadedData,
        isDataLoaded,
        hasPreloadedData: !!preloadedData,
        pendingAmendmentsLength: pendingAmendments.length,
        shouldTriggerFallback: hasProcessedPreloadedData && isDataLoaded && preloadedData && pendingAmendments.length === 0
      });
      
      // Special case: If data is already loaded but we need to extract amendments
      if (hasProcessedPreloadedData && isDataLoaded && preloadedData && pendingAmendments.length === 0) {
        console.log('🔍 [WeeklyPlanInterface] Data loaded but no amendments found, attempting amendment extraction...');
        
        // Try to extract amendments directly
        if (preloadedData.amendments && preloadedData.amendments.length > 0) {
          console.log('📋 [WeeklyPlanInterface] Found separate amendments, setting them directly');
          setPendingAmendments(preloadedData.amendments);
        } else if (preloadedData.storesWithSubmissions && preloadedData.storesWithSubmissions.length > 0) {
          console.log('📋 [WeeklyPlanInterface] Attempting to extract amendments from storesWithSubmissions');
          const itemsWithStatus = preloadedData.storesWithSubmissions.filter((item: any) => 
            item.status && ['pending', 'submitted', 'approved', 'rejected'].includes(item.status)
          );
          if (itemsWithStatus.length > 0) {
            console.log(`📋 [WeeklyPlanInterface] Found ${itemsWithStatus.length} items with amendment status`);
            setPendingAmendments(itemsWithStatus);
          }
        }
      }
    }
  }, [hasProcessedPreloadedData, isDataLoaded, userHierarchy, currentWeek, storeHierarchy, isInitialDataLoaded, categories.length, preloadedData, pendingAmendments.length]); // Added preloadedData and pendingAmendments.length for amendment extraction

  // Separate useEffect specifically for amendment extraction - runs independently
  useEffect(() => {
    console.log('🔍 [AmendmentExtraction] Dedicated amendment extraction useEffect triggered');
    
    // Only run if we have data but no amendments
    if (preloadedData && pendingAmendments.length === 0 && isDataLoaded) {
      console.log('🔍 [AmendmentExtraction] Attempting dedicated amendment extraction...');
      
      // Try multiple extraction methods
      if (preloadedData.amendments && preloadedData.amendments.length > 0) {
        console.log('📋 [AmendmentExtraction] Found separate amendments array:', preloadedData.amendments.length);
        setPendingAmendments(preloadedData.amendments);
        return;
      }
      
      if (preloadedData.storesWithSubmissions && preloadedData.storesWithSubmissions.length > 0) {
        console.log('📋 [AmendmentExtraction] Checking storesWithSubmissions for amendments...');
        
        // Method 1: Look for items with amendment status
        const itemsWithStatus = preloadedData.storesWithSubmissions.filter((item: any) => 
          item.status && ['pending', 'submitted', 'approved', 'rejected'].includes(item.status)
        );
        
        if (itemsWithStatus.length > 0) {
          console.log(`📋 [AmendmentExtraction] Found ${itemsWithStatus.length} items with amendment status`);
          console.log('📋 [AmendmentExtraction] Sample items:', itemsWithStatus.slice(0, 2));
          setPendingAmendments(itemsWithStatus);
          return;
        }
        
        // Method 2: Look for items with has_amendment flag
        const itemsWithAmendmentFlag = preloadedData.storesWithSubmissions.filter((item: any) => 
          item.has_amendment === true && item.amendment_data
        );
        
        if (itemsWithAmendmentFlag.length > 0) {
          console.log(`📋 [AmendmentExtraction] Found ${itemsWithAmendmentFlag.length} items with amendment flag`);
          const amendmentsForDisplay = itemsWithAmendmentFlag.map((item: any) => ({
            ...item.amendment_data,
            store_name: item.store_name,
            description: item.description,
            stock_code: item.stock_code,
            category: item.category,
            sub_category: item.sub_category
          }));
          setPendingAmendments(amendmentsForDisplay);
          return;
        }
        
        // Method 3: Look for items with amended_qty
        const itemsWithAmendedQty = preloadedData.storesWithSubmissions.filter((item: any) => 
          item.amended_qty !== null && item.amended_qty !== undefined
        );
        
        if (itemsWithAmendedQty.length > 0) {
          console.log(`📋 [AmendmentExtraction] Found ${itemsWithAmendedQty.length} items with amended_qty`);
          setPendingAmendments(itemsWithAmendedQty);
          return;
        }
        
        console.log('📋 [AmendmentExtraction] No amendments found using any method');
      }
    }
  }, [preloadedData, pendingAmendments.length, isDataLoaded]); // Dedicated deps for amendment extraction

  // Auto-enable amendments filter for admin workflow (only once)
  useEffect(() => {
    if (adminWorkflow && !showAmendmentsOnly && pendingAmendments.length > 0 && !hasProcessedPreloadedData) {
      console.log('🔧 [AutoEnable] Auto-enabling amendments filter for admin workflow (one-time)');
      setShowAmendmentsOnly(true);
    }
  }, [adminWorkflow, pendingAmendments.length, hasProcessedPreloadedData]); // Removed showAmendmentsOnly to prevent loop

  // Show generic loading only if we're not processing preloaded data
  if (isLoading && !isDataProcessing) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 text-gray-400 mx-auto mb-4 animate-spin" />
          <p className="text-muted-foreground">Loading {title.toLowerCase()}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Access Error</h3>
              <p className="text-muted-foreground">{error}</p>
              <Button onClick={handleRefresh} variant="outline" className="mt-4">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!userHierarchy) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
              <p className="text-muted-foreground">You do not have permission to access this interface.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Debug logging at render time
  console.log('WeeklyPlanInterface render:', {
    isLoading,
    categoriesCount: categories.length,
    hasCategories: categories.length > 0,
    activeTab,
    userRole,
    isDataLoaded,
    isInitialDataLoaded
  });
  
  if (categories.length > 0) {
    console.log('Categories at render:', categories.map(c => ({
      name: c.name,
      itemsCount: c.items?.length || 0,
      subCategoriesCount: c.subCategories?.length || 0
    })));
  }

  return (
    <div className="space-y-6">


      {/* Pending Amendments Section (for Regional Managers) */}
      {userRole === 'regional_manager' && pendingAmendments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Pending Area Manager Amendments ({pendingAmendments.filter(amendment => selectedStoreFilter === 'all' || amendment.store_id === selectedStoreFilter).length})
              {selectedStoreFilter !== 'all' && (
                <Badge variant="outline" className="ml-2">
                  Filtered: {storeHierarchy.find(s => s.store_id === selectedStoreFilter)?.store_name}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingAmendments
                .filter(amendment => selectedStoreFilter === 'all' || amendment.store_id === selectedStoreFilter)
                .map((amendment) => (
                <Card key={amendment.id} className="border-orange-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="h-4 w-4" />
                          <span className="font-medium">{amendment.stock_code}</span>
                          <span className="text-sm text-muted-foreground">•</span>
                          <span className="text-sm text-muted-foreground">{amendment.store_name}</span>
                          {getStatusBadge(amendment.status)}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{amendment.description}</p>
                        <div className="flex items-center gap-4 text-sm">
                          <span>Original: <span className="font-medium">{amendment.original_qty}</span></span>
                          <span>→</span>
                          {amendment.approved_qty !== null && amendment.approved_qty !== undefined ? (
                            <>
                              <span>Admin Modified: <span className="font-medium text-green-600">{amendment.approved_qty}</span></span>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-muted-foreground">Change: {amendment.approved_qty - amendment.original_qty}</span>
                            </>
                          ) : (
                            <>
                              <span>Amended: <span className="font-medium text-blue-600">{amendment.amended_qty}</span></span>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-muted-foreground">Change: {amendment.amended_qty - amendment.original_qty}</span>
                            </>
                          )}
                        </div>
                        {amendment.justification && (
                          <div className="mt-2">
                            <p className="text-sm"><strong>Justification:</strong> {amendment.justification}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {reviewingAmendment === amendment.id ? (
                          <div className="flex items-center gap-2">
                            <Textarea
                              placeholder="Add notes (optional)"
                              value={adminNotes}
                              onChange={(e) => setAdminNotes(e.target.value)}
                              className="w-48 h-20"
                            />
                            <div className="flex flex-col gap-2">
                              {/* Admin-specific modification controls */}
                              {userRole === 'admin' && adminWorkflow && (
                                <div className="flex items-center gap-2 mb-2">
                                  <Label className="text-xs">Modify Qty:</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    defaultValue={amendment.amended_qty}
                                    className="w-20 h-8 text-sm"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        const newQty = parseInt((e.target as HTMLInputElement).value);
                                        if (!isNaN(newQty)) {
                                          handleAdminModifyAmendment(amendment.id, newQty);
                                        }
                                      }
                                    }}
                                    id={`modify-qty-${amendment.id}`}
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      const input = document.getElementById(`modify-qty-${amendment.id}`) as HTMLInputElement;
                                      const newQty = parseInt(input.value);
                                      if (!isNaN(newQty)) {
                                        handleAdminModifyAmendment(amendment.id, newQty);
                                      }
                                    }}
                                    className="bg-blue-600 hover:bg-blue-700 text-xs px-2 py-1"
                                  >
                                    <Edit className="h-3 w-3 mr-1" />
                                    Modify & Approve
                                  </Button>
                                </div>
                              )}
                              
                              <Button
                                size="sm"
                                onClick={() => handleAmendmentAction(amendment.id, 'approve')}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleAmendmentAction(amendment.id, 'reject')}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setReviewingAmendment(null);
                                  setAdminNotes('');
                                }}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReviewingAmendment(amendment.id)}
                          >
                            Review
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}


      {/* Weekly Plan Categories */}
      {categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Weekly Plan Categories
              </div>
              <div className="flex items-center gap-4">
                {/* Regional Filter - Admin Only */}
                {userRole === 'admin' && enableRegionalFilter && regionalManagers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="regional-filter" className="text-sm font-normal">Regional Manager:</Label>
                    <select
                      id="regional-filter"
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={selectedRegionalFilter}
                      onChange={(e) => setSelectedRegionalFilter(e.target.value)}
                    >
                      <option value="all">All Regional Managers</option>
                      {regionalManagers.map(rm => (
                        <option key={rm.id} value={rm.id}>
                          {rm.first_name} {rm.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                {/* Store Filter */}
                <div className="flex items-center gap-2">
                  <Label htmlFor="store-filter" className="text-sm font-normal">Store:</Label>
                  <select
                    id="store-filter"
                    className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedStoreFilter}
                    onChange={(e) => setSelectedStoreFilter(e.target.value)}
                  >
                    <option value="all">All Stores</option>
                    {adminWorkflow && (
                      <option value="all_with_amendments">All Stores with Amendments</option>
                    )}
                    {storeHierarchy.map(store => (
                      <option key={store.store_id} value={store.store_id}>
                        {store.store_name} ({store.store_code})
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Focus on Changed Items - Admin Only */}
                {userRole === 'admin' && focusOnChangedItems && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="changed-items-toggle" className="text-sm font-normal">Show Only Changed:</Label>
                    <input
                      id="changed-items-toggle"
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      checked={showOnlyChangedItems}
                      onChange={(e) => setShowOnlyChangedItems(e.target.checked)}
                    />
                  </div>
                )}
                
                {/* Suppress Zeros Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSuppressZeros(!suppressZeros)}
                  className="flex items-center gap-2"
                >
                  {suppressZeros ? <FilterX className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
                  {suppressZeros ? 'Show All' : 'Suppress Zeros'}
                </Button>
                
                {/* Amendments Only Filter Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAmendmentsOnly(!showAmendmentsOnly)}
                  className={`flex items-center gap-2 ${showAmendmentsOnly ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`}
                >
                  {showAmendmentsOnly ? <FilterX className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
                  {showAmendmentsOnly ? 'Show All Items' : 'Amendments Only'}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${categories.length}, 1fr)` }}>
                {categories.map((category) => (
                  <TabsTrigger key={category.id} value={category.id}>
                    {category.name} ({getFilteredCategoryTabCount(category)})
                    {selectedStoreFilter !== 'all' && getFilteredCategoryTabCount(category) !== category.totalQtyToOrder && (
                      <span className="text-xs text-muted-foreground ml-1">of {category.totalQtyToOrder}</span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
              
              {categories.map((category) => (
                <TabsContent key={category.id} value={category.id} className="space-y-4">
                  {/* Category Total */}
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-blue-800">
                          {category.name} - Category Total
                          {selectedStoreFilter !== 'all' && (
                            <Badge variant="outline" className="ml-2 bg-white">
                              Filtered: {storeHierarchy.find(s => s.store_id === selectedStoreFilter)?.store_name}
                            </Badge>
                          )}
                        </h3>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-blue-700">
                            <span className="font-medium">Order Qty:</span> {getFilteredCategoryTotals(category).totalOrderQty}
                            {selectedStoreFilter !== 'all' && (
                              <span className="text-xs text-blue-600 ml-1">of {category.totalOrderQty}</span>
                            )}
                          </div>
                          <div className="text-blue-700">
                            <span className="font-medium">Add-ons Qty:</span> {getFilteredCategoryTotals(category).totalAddOnsQty}
                            {selectedStoreFilter !== 'all' && (
                              <span className="text-xs text-blue-600 ml-1">of {category.totalAddOnsQty}</span>
                            )}
                          </div>
                          <div className="text-blue-800 font-bold">
                            <span className="font-medium">Total to Order:</span> {getFilteredCategoryTotals(category).totalQtyToOrder}
                            {selectedStoreFilter !== 'all' && (
                              <span className="text-xs text-blue-600 ml-1">of {category.totalQtyToOrder}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Sub-categories */}
                  {category.subCategories &&
                    category.subCategories
                    .filter((subCategory) => {
                      if (!suppressZeros && !showAmendmentsOnly) return true;
                      
                      // Filter items based on current filter settings
                      let visibleItems = subCategory.items || [];
                      
                      // Apply store filter
                      visibleItems = visibleItems.filter(item => {
                        // Handle special "all_with_amendments" filter
                        if (selectedStoreFilter === 'all_with_amendments') {
                          return item.has_amendment === true || 
                                 (item.amended_qty !== null && item.amended_qty !== undefined) ||
                                 pendingAmendments.some(amendment => 
                                   (amendment.stock_code === item.stock_code && amendment.store_id === item.store_id) ||
                                   amendment.weekly_plan_id === item.id
                                 );
                        }
                        return selectedStoreFilter === 'all' || item.store_id === selectedStoreFilter;
                      });
                      
                      // Apply amendment filter
                      if (showAmendmentsOnly) {
                        visibleItems = visibleItems.filter(item => {
                          return item.has_amendment === true || 
                                 (item.amended_qty !== null && item.amended_qty !== undefined) ||
                                 pendingAmendments.some(amendment => 
                                   amendment.weekly_plan_id === item.id || 
                                   (amendment.stock_code === item.stock_code && amendment.store_id === item.store_id)
                                 );
                        });
                      }
                      
                      // Apply suppressZeros filter
                      if (suppressZeros) {
                        visibleItems = visibleItems.filter(item => item.order_qty > 0 || item.add_ons_qty > 0);
                      }
                      
                      return visibleItems.length > 0;
                    })
                    .map((subCategory) => (
                    <div key={subCategory.id} className="space-y-2">
                      {/* Sub-category Header */}
                      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border">
                        <h4 className="text-md font-medium text-gray-800">
                          {subCategory.name}
                          {selectedStoreFilter !== 'all' && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              Filtered
                            </Badge>
                          )}
                        </h4>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>Order Qty: <span className="font-medium">{getFilteredSubCategoryTotals(subCategory).totalOrderQty}</span>
                            {selectedStoreFilter !== 'all' && (
                              <span className="text-xs text-gray-500 ml-1">of {subCategory.totalOrderQty}</span>
                            )}
                          </span>
                          <span>Add-ons Qty: <span className="font-medium">{getFilteredSubCategoryTotals(subCategory).totalAddOnsQty}</span>
                            {selectedStoreFilter !== 'all' && (
                              <span className="text-xs text-gray-500 ml-1">of {subCategory.totalAddOnsQty}</span>
                            )}
                          </span>
                          <span className="text-gray-800 font-bold">
                            Total to Order: <span className="font-medium">{getFilteredSubCategoryTotals(subCategory).totalQtyToOrder}</span>
                            {selectedStoreFilter !== 'all' && (
                              <span className="text-xs text-gray-500 ml-1">of {subCategory.totalQtyToOrder}</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Sub-category Items Table */}
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Store</TableHead>
                              <TableHead>Stock Code</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>On Hand</TableHead>
                              <TableHead>In Transit</TableHead>
                              <TableHead>Pending Orders</TableHead>
                              <TableHead>Model Stock</TableHead>
                              <TableHead>Order Qty</TableHead>
                              <TableHead>Add-ons Qty</TableHead>
                              <TableHead>Total to Order</TableHead>
                              {adminWorkflow && showAmendmentsOnly && <TableHead>Amendment Status</TableHead>}
                              {adminWorkflow && showAmendmentsOnly && <TableHead>Amendment Details</TableHead>}
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {subCategory.items
                              ?.filter(item => suppressZeros ? (item.order_qty > 0 || item.add_ons_qty > 0) : true)
                              ?.filter(item => {
                                // Handle special "all_with_amendments" filter
                                if (selectedStoreFilter === 'all_with_amendments') {
                                  return item.has_amendment === true || 
                                         (item.amended_qty !== null && item.amended_qty !== undefined) ||
                                         pendingAmendments.some(amendment => 
                                           (amendment.stock_code === item.stock_code && amendment.store_id === item.store_id) ||
                                           amendment.weekly_plan_id === item.id
                                         );
                                }
                                return selectedStoreFilter === 'all' || item.store_id === selectedStoreFilter;
                              })
                              ?.filter(item => {
                                // Amendment filter - show only items with amendments if enabled
                                if (showAmendmentsOnly) {
                                  return item.has_amendment === true || 
                                         (item.amended_qty !== null && item.amended_qty !== undefined) ||
                                         pendingAmendments.some(amendment => 
                                           amendment.weekly_plan_id === item.id || 
                                           (amendment.stock_code === item.stock_code && amendment.store_id === item.store_id)
                                         );
                                }
                                return true;
                              })
                              ?.filter(item => {
                                // Admin "show only changed items" filter
                                if (userRole === 'admin' && showOnlyChangedItems) {
                                  // Check if item has amendments or has been edited
                                  const hasAmendments = pendingAmendments.some(amendment => 
                                    amendment.weekly_plan_id === item.id || 
                                    (amendment.stock_code === item.stock_code && amendment.store_id === item.store_id)
                                  );
                                  const isEdited = editingItems.has(item.id);
                                  const hasChangedQty = (item.add_ons_qty || 0) !== 0;
                                  return hasAmendments || isEdited || hasChangedQty;
                                }
                                return true;
                              })
                              .map((item) => {
                                const isEditing = editingItems.has(item.id);
                                const editData = editingData[item.id];
                                const displayOrderQty = isEditing ? editData?.order_qty : item.order_qty;
                                const displayAddOnsQty = isEditing ? editData?.add_ons_qty : item.add_ons_qty;
                                const displayTotal = (displayOrderQty || 0) + (displayAddOnsQty || 0);
                                
                                return (
                                  <React.Fragment key={item.id}>
                                    <TableRow className={isEditing ? 'bg-yellow-50 border-yellow-200' : ''}>
                                      <TableCell>{item.store_name}</TableCell>
                                      <TableCell className="font-medium">{item.stock_code}</TableCell>
                                      <TableCell className="max-w-xs truncate">{item.description}</TableCell>
                                      <TableCell className="font-medium">{item.qty_on_hand}</TableCell>
                                      <TableCell className="font-medium">{item.qty_in_transit}</TableCell>
                                      <TableCell className="font-medium">{item.qty_pending_orders}</TableCell>
                                      <TableCell className="font-medium">{item.model_stock_qty}</TableCell>
                                      <TableCell className="font-medium">
                                        <div className="flex items-center gap-1">
                                          {displayOrderQty}
                                          {(() => {
                                            // Show amendment indicator if this item has amendments
                                            const hasAmendment = pendingAmendments.some(a => 
                                              (a.stock_code === item.stock_code && a.store_id === item.store_id) ||
                                              a.weekly_plan_id === item.id
                                            );
                                            if (hasAmendment) {
                                              return (
                                                <Badge variant="secondary" className="text-xs ml-1 bg-orange-100 text-orange-700 border-orange-200">
                                                  ⚠
                                                </Badge>
                                              );
                                            }
                                            return null;
                                          })()}
                                        </div>
                                      </TableCell>
                                      <TableCell className="font-medium">
                                        {isEditing ? (
                                          <Input
                                            type="number"
                                            min="0"
                                            value={editData?.add_ons_qty || 0}
                                            onChange={(e) => updateEditingData(item.id, 'add_ons_qty', parseInt(e.target.value) || 0)}
                                            className="w-20 h-8"
                                            data-item-id={item.id}
                                            style={{
                                              WebkitAppearance: 'textfield',
                                              MozAppearance: 'textfield'
                                            }}
                                            onKeyDown={(e) => {
                                              // Prevent up/down arrow keys from changing the value
                                              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                                e.preventDefault();
                                              }
                                            }}
                                          />
                                        ) : (
                                          displayAddOnsQty
                                        )}
                                      </TableCell>
                                      <TableCell className="font-medium text-blue-600">{displayTotal}</TableCell>
                                      {adminWorkflow && showAmendmentsOnly && (
                                        <TableCell>
                                          {(() => {
                                            // Find amendment for this item
                                            const amendment = pendingAmendments.find(a => 
                                              (a.stock_code === item.stock_code && a.store_id === item.store_id) ||
                                              a.weekly_plan_id === item.id
                                            );
                                            
                                            if (amendment) {
                                              return (
                                                <Badge 
                                                  variant={amendment.status === 'approved' ? 'default' : 
                                                          amendment.status === 'rejected' ? 'destructive' : 
                                                          amendment.status === 'submitted' ? 'secondary' : 'outline'}
                                                  className={amendment.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                            amendment.status === 'submitted' ? 'bg-blue-100 text-blue-800' : ''}
                                                >
                                                  {amendment.status === 'approved' && amendment.approved_qty !== null && amendment.approved_qty !== undefined && amendment.approved_qty !== amendment.amended_qty
                                                    ? 'amended by admin'
                                                    : amendment.status}
                                                </Badge>
                                              );
                                            }
                                            
                                            if (item.has_amendment || item.amended_qty !== null) {
                                              return (
                                                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                                                  Modified
                                                </Badge>
                                              );
                                            }
                                            
                                            return '-';
                                          })()}
                                        </TableCell>
                                      )}
                                      {adminWorkflow && showAmendmentsOnly && (
                                        <TableCell className="max-w-xs">
                                          {(() => {
                                            // Find amendment for this item
                                            const amendment = pendingAmendments.find(a => 
                                              (a.stock_code === item.stock_code && a.store_id === item.store_id) ||
                                              a.weekly_plan_id === item.id
                                            );
                                            
                                            if (amendment) {
                                              return (
                                                <div className="text-xs space-y-1">
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">Original:</span>
                                                    <span className="font-medium">{amendment.original_qty || item.order_qty}</span>
                                                    <span>→</span>
                                                    {amendment.approved_qty !== null && amendment.approved_qty !== undefined ? (
                                                      <>
                                                        <span className="text-muted-foreground">Admin Modified:</span>
                                                        <span className="font-medium text-green-600">{amendment.approved_qty}</span>
                                                      </>
                                                    ) : (
                                                      <>
                                                        <span className="text-muted-foreground">Amended:</span>
                                                        <span className="font-medium text-blue-600">{amendment.amended_qty}</span>
                                                      </>
                                                    )}
                                                  </div>
                                                  {amendment.justification && (
                                                    <div className="text-muted-foreground truncate" title={amendment.justification}>
                                                      "{amendment.justification}"
                                                    </div>
                                                  )}
                                                  {amendment.created_by && (
                                                    <div className="text-muted-foreground">
                                                      By: {amendment.created_by}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            }
                                            
                                            if (item.has_amendment && item.amended_qty !== null) {
                                              return (
                                                <div className="text-xs space-y-1">
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">Original:</span>
                                                    <span className="font-medium">{item.original_add_ons_qty || item.add_ons_qty}</span>
                                                    <span>→</span>
                                                    <span className="text-muted-foreground">Amended:</span>
                                                    <span className="font-medium text-blue-600">{item.amended_qty}</span>
                                                  </div>
                                                  {item.justification && (
                                                    <div className="text-muted-foreground truncate" title={item.justification}>
                                                      "{item.justification}"
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            }
                                            
                                            return '-';
                                          })()}
                                        </TableCell>
                                      )}
                                      <TableCell>
                                        {isEditing ? (
                                          <div className="flex items-center gap-2">
                                            <Button
                                              size="sm"
                                              onClick={() => saveItemEdit(item.id, item)}
                                              className="bg-green-600 hover:bg-green-700 h-8 px-2"
                                            >
                                              <Save className="h-3 w-3" />
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => cancelEditingItem(item.id)}
                                              className="h-8 px-2"
                                            >
                                              <X className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        ) : adminWorkflow ? (
                                          (() => {
                                            // Find amendment for this item
                                            const amendment = pendingAmendments.find(a => 
                                              (a.stock_code === item.stock_code && a.store_id === item.store_id) ||
                                              a.weekly_plan_id === item.id
                                            );
                                            
                                            if (amendment && (amendment.status === 'submitted' || amendment.status === 'pending' || amendment.status === 'area_manager_approved' || amendment.status === 'regional_direct' || amendment.status === 'area_direct')) {
                                              return (
                                                <div className="flex items-center gap-1">
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-purple-600 border-purple-300 hover:bg-purple-50 px-2 h-7"
                                                    onClick={() => handleOpenStoreContext(item.store_id, item.store_name || 'Unknown Store', amendment)}
                                                    title="View store context"
                                                  >
                                                    <Building2 className="h-3 w-3" />
                                                  </Button>
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-green-600 border-green-300 hover:bg-green-50 px-2 h-7"
                                                    onClick={() => handleAmendmentApproval(amendment.id, 'approve')}
                                                  >
                                                    <CheckCircle className="h-3 w-3" />
                                                  </Button>
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-red-600 border-red-300 hover:bg-red-50 px-2 h-7"
                                                    onClick={() => handleAmendmentApproval(amendment.id, 'reject')}
                                                  >
                                                    <XCircle className="h-3 w-3" />
                                                  </Button>
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-blue-600 border-blue-300 hover:bg-blue-50 px-2 h-7"
                                                    onClick={() => setReviewingAmendment(amendment.id)}
                                                  >
                                                    <Edit className="h-3 w-3" />
                                                  </Button>
                                                </div>
                                              );
                                            }
                                            
                                            if (amendment && (amendment.status === 'approved' || amendment.status === 'rejected')) {
                                              return (
                                                <div className="flex items-center gap-1">
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-purple-600 border-purple-300 hover:bg-purple-50 px-2 h-7"
                                                    onClick={() => handleOpenStoreContext(item.store_id, item.store_name || 'Unknown Store', amendment)}
                                                    title="View store context"
                                                  >
                                                    <Building2 className="h-3 w-3" />
                                                  </Button>
                                                  <Badge variant="outline" className="text-xs">
                                                    {amendment.status === 'approved' && amendment.approved_qty !== null && amendment.approved_qty !== undefined && amendment.approved_qty !== amendment.amended_qty
                                                      ? 'Amended by Admin'
                                                      : amendment.status === 'approved' ? 'Approved' : 'Rejected'}
                                                  </Badge>
                                                </div>
                                              );
                                            }
                                            
                                            // Show Store Context button even for items without amendments if there are amendments for this store
                                            const hasStoreAmendments = pendingAmendments.some(a => a.store_id === item.store_id);
                                            if (hasStoreAmendments) {
                                              return (
                                                <div className="flex items-center gap-1">
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-purple-600 border-purple-300 hover:bg-purple-50 px-2 h-7"
                                                    onClick={() => handleOpenStoreContext(item.store_id, item.store_name || 'Unknown Store')}
                                                    title="View store context"
                                                  >
                                                    <Building2 className="h-3 w-3" />
                                                  </Button>
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => startEditingItem(item.id, item)}
                                                    className="h-8 px-2"
                                                  >
                                                    <Edit className="h-3 w-3" />
                                                  </Button>
                                                </div>
                                              );
                                            }
                                            
                                            // Default edit button for items without amendments
                                            return (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => startEditingItem(item.id, item)}
                                                className="h-8 px-2"
                                              >
                                                <Edit className="h-3 w-3" />
                                              </Button>
                                            );
                                          })()
                                        ) : (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => startEditingItem(item.id, item)}
                                            className="h-8 px-2"
                                          >
                                            <Edit className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                    {/* Comment row for editing */}
                                    {isEditing && (
                                      <TableRow className="bg-yellow-50 border-yellow-200">
                                        <TableCell colSpan={11} className="p-4">
                                          <div className="space-y-2">
                                            <Label htmlFor={`comment-${item.id}`} className="text-sm font-medium">
                                              Comment for this change:
                                            </Label>
                                            <Textarea
                                              id={`comment-${item.id}`}
                                              placeholder="Enter justification for the quantity change..."
                                              value={editData?.comment || ''}
                                              onChange={(e) => updateEditingData(item.id, 'comment', e.target.value)}
                                              className="w-full"
                                              rows={3}
                                            />
                                            <div className="text-xs text-muted-foreground">
                                              <span>Original Add-ons: {item.add_ons_qty}</span>
                                              <span className="mx-2">→</span>
                                              <span>New Add-ons: {editData?.add_ons_qty || 0}</span>
                                              <span className="mx-2">|</span>
                                              <span>Change: {(editData?.add_ons_qty || 0) - item.add_ons_qty}</span>
                                              <span className="mx-2">|</span>
                                              <span>Order Qty (read-only): {item.order_qty}</span>
                                            </div>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )) || []}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Data processing indicator */}
      {isDataProcessing && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-3">
                <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                <div className="text-blue-800 font-medium">
                  {dataLoadingStage || 'Processing data...'}
                </div>
              </div>
            </div>
            <div className="mt-3 w-full bg-blue-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isDataProcessing && categories.length === 0 && pendingAmendments.length === 0 && (
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
              <p className="text-muted-foreground">
                No weekly plan data or pending amendments found for the current week.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Store Context Sheet */}
      {selectedStoreContext && (
        <StoreContextSheet
          isOpen={storeContextOpen}
          onClose={() => setStoreContextOpen(false)}
          storeId={selectedStoreContext.storeId}
          storeName={selectedStoreContext.storeName}
          region={selectedStoreContext.region}
          allStoreItems={selectedStoreContext.allItems}
          storeAmendments={selectedStoreContext.amendments}
          onAmendmentAction={(amendmentId: string, action: 'approve' | 'reject' | 'modify') => {
            if (action === 'modify') {
              setReviewingAmendment(amendmentId);
              setStoreContextOpen(false); // Close context when opening modify dialog
            } else {
              handleAmendmentApproval(amendmentId, action);
            }
          }}
        />
      )}
    </div>
  );
}