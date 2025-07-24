import { useState, useEffect, useMemo } from 'react';
import { supabaseAdmin } from '@/lib/supabase';

interface RoleBasedDataState {
  isLoading: boolean;
  loadingProgress: {
    currentOperation: string;
    completed: number;
    total: number;
    actualRecordsLoaded: number;
    estimatedTotal: number;
  };
  selectedWeek: any;
  userInfo: any;
  organizationalData: {
    stores: any[];
    storeHierarchy: any[];
    amendments: any[];
  };
  error: string | null;
  isDataLoaded: boolean;
}

interface LoadingOperation {
  name: string;
  table: string;
  estimatedRecords: number;
  priority: number;
  paginated?: boolean;
  filtered?: boolean;
  derived?: boolean;
}

// Same loading operations as admin but with role-based filtering
const createLoadingOperations = (userRole: string): LoadingOperation[] => {
  const baseOperations: LoadingOperation[] = [
    { name: 'Users & Managers', table: 'users', estimatedRecords: 500, priority: 1 },
    { name: 'Stores', table: 'stores', estimatedRecords: 200, priority: 2 },
    { name: 'Store Hierarchy', table: 'store_management_hierarchy', estimatedRecords: 200, priority: 3 },
    { name: 'Week Selections', table: 'week_selections', estimatedRecords: 50, priority: 4 },
    { name: 'Weekly Plan Data (Role Filtered)', table: 'weekly_plan', estimatedRecords: userRole === 'regional_manager' ? 25000 : 10000, priority: 5, paginated: true, filtered: true },
    { name: 'Weekly Plan Submissions', table: 'weekly_plan_submissions', estimatedRecords: 500, priority: 6, filtered: true },
    { name: 'Weekly Plan Amendments', table: 'weekly_plan_amendments', estimatedRecords: 1000, priority: 7, filtered: true },
    { name: 'Data Processing', derived: true, estimatedRecords: 1000, priority: 8 },
    { name: 'Final Integration', derived: true, estimatedRecords: 500, priority: 9 }
  ];
  
  return baseOperations;
};

export function useRoleBasedDataLoading(
  userRole: 'area_manager' | 'regional_manager',
  userId: string,
  weekReference: string
) {
  const [state, setState] = useState<RoleBasedDataState>({
    isLoading: false,
    loadingProgress: {
      currentOperation: '',
      completed: 0,
      total: 9,
      actualRecordsLoaded: 0,
      estimatedTotal: userRole === 'regional_manager' ? 27000 : 12000
    },
    selectedWeek: null,
    userInfo: null,
    organizationalData: {
      stores: [],
      storeHierarchy: [],
      amendments: []
    },
    error: null,
    isDataLoaded: false
  });

  const [cachedData, setCachedData] = useState<Map<string, any>>(new Map());

  // Create cache key based on role, user, and week
  const cacheKey = useMemo(() => 
    `${userRole}_${userId}_${weekReference}`, 
    [userRole, userId, weekReference]
  );

  // Get accessible stores based on role
  const getAccessibleStores = async (role: string, id: string) => {
    console.log(`🔍 [RoleBasedDataLoading] Getting accessible stores for ${role}: ${id}`);
    
    const filterField = role === 'area_manager' ? 'area_manager_id' : 'regional_manager_id';
    
    const { data: accessibleStores, error } = await supabaseAdmin
      .from('store_management_hierarchy')
      .select('*')
      .eq(filterField, id)
      .order('store_name');

    if (error) {
      console.error(`Error fetching accessible stores for ${role}:`, error);
      throw error;
    }

    console.log(`✅ [RoleBasedDataLoading] Found ${accessibleStores?.length || 0} accessible stores for ${role}`);
    return accessibleStores || [];
  };

  // Filter weekly plan data by accessible store IDs
  const filterDataByStores = (data: any[], accessibleStores: any[]) => {
    const storeIds = new Set(accessibleStores.map(store => store.store_id));
    return data.filter(item => storeIds.has(item.store_id));
  };

  // Main data loading function (similar to admin but with role filtering)
  const loadRoleBasedData = async () => {
    console.log(`🚀 [RoleBasedDataLoading] Starting role-based data loading for ${userRole}: ${userId}`);
    
    // Check cache first
    if (cachedData.has(cacheKey)) {
      console.log('📦 [RoleBasedDataLoading] Using cached data');
      const cached = cachedData.get(cacheKey);
      setState(prev => ({
        ...prev,
        ...cached,
        isDataLoaded: true,
        isLoading: false
      }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Step 1: Get accessible stores for this role
      const accessibleStores = await getAccessibleStores(userRole, userId);
      
      if (accessibleStores.length === 0) {
        throw new Error(`No accessible stores found for ${userRole}: ${userId}`);
      }

      const storeIds = accessibleStores.map(store => store.store_id);
      // Get store names for weekly_plan table filtering (it uses store_name, not store_id)
      const storeNames = accessibleStores.map(store => store.store_name);
      console.log(`📋 [RoleBasedDataLoading] Will filter data for ${storeIds.length} stores by names:`, storeNames.slice(0, 3));

      // Step 2: Load week selection data
      setState(prev => ({
        ...prev,
        loadingProgress: { ...prev.loadingProgress, currentOperation: 'Loading week selection...', completed: 1 }
      }));

      const { data: weekData, error: weekError } = await supabaseAdmin
        .from('week_selections')
        .select('*')
        .eq('week_reference', weekReference)
        .single();

      if (weekError && weekError.code !== 'PGRST116') {
        throw weekError;
      }

      // Step 3: Get user info
      setState(prev => ({
        ...prev,
        loadingProgress: { ...prev.loadingProgress, currentOperation: 'Loading user information...', completed: 2 }
      }));

      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      // Step 4: Load weekly plan data (filtered by accessible stores)
      setState(prev => ({
        ...prev,
        loadingProgress: { ...prev.loadingProgress, currentOperation: 'Loading weekly plan data...', completed: 3 }
      }));

      let allWeeklyPlanData: any[] = [];
      const batchSize = 5000;
      let currentOffset = 0;
      let hasMoreData = true;
      let totalRecordsLoaded = 0;

      while (hasMoreData) {
        console.log(`🔄 [RoleBasedDataLoading] Loading batch: offset ${currentOffset}, batch size ${batchSize}`);
        
        const { data: batchData, error } = await supabaseAdmin
          .from('weekly_plan')
          .select('*')
          .eq('reference', weekReference)
          .in('store_name', storeNames)
          .range(currentOffset, currentOffset + batchSize - 1)
          .order('store_name', { ascending: true });

        if (error) {
          console.error(`❌ [RoleBasedDataLoading] Batch loading error at offset ${currentOffset}:`, error);
          throw error;
        }

        if (batchData && batchData.length > 0) {
          allWeeklyPlanData = [...allWeeklyPlanData, ...batchData];
          totalRecordsLoaded += batchData.length;
          currentOffset += batchSize;
          
          console.log(`✅ [RoleBasedDataLoading] Batch loaded: ${batchData.length} records (total: ${totalRecordsLoaded})`);
          
          // Update progress
          setState(prev => ({
            ...prev,
            loadingProgress: { 
              ...prev.loadingProgress, 
              actualRecordsLoaded: totalRecordsLoaded,
              currentOperation: `Loading weekly plan data... (${totalRecordsLoaded} records)` 
            }
          }));

          hasMoreData = batchData.length === batchSize;
          console.log(`🔄 [RoleBasedDataLoading] Has more data: ${hasMoreData} (batch size: ${batchData.length}/${batchSize})`);
        } else {
          console.log(`⏹️ [RoleBasedDataLoading] No more data - ending pagination`);
          hasMoreData = false;
        }
      }

      console.log(`📊 [RoleBasedDataLoading] Loaded ${allWeeklyPlanData.length} weekly plan records for ${storeNames.length} stores`);
      
      // Debug: Check which stores have data
      const storesWithData = new Set(allWeeklyPlanData.map(item => item.store_name));
      const storesWithoutData = storeNames.filter(name => !storesWithData.has(name));
      
      console.log(`📊 [RoleBasedDataLoading] DETAILED STORE ANALYSIS:`);
      console.log(`   - Total accessible stores: ${storeNames.length}`);
      console.log(`   - Stores with weekly plan data: ${storesWithData.size}`);
      console.log(`   - Stores WITHOUT weekly plan data: ${storesWithoutData.length}`);
      console.log(`   - Total weekly plan records loaded: ${allWeeklyPlanData.length}`);
      
      if (storesWithData.size > 0) {
        console.log(`✅ [RoleBasedDataLoading] Stores WITH data:`, Array.from(storesWithData));
      }
      if (storesWithoutData.length > 0) {
        console.log(`❌ [RoleBasedDataLoading] Stores WITHOUT data:`, storesWithoutData);
      }
      
      // Debug: Check record distribution per store
      const recordsPerStore = new Map();
      allWeeklyPlanData.forEach(item => {
        const count = recordsPerStore.get(item.store_name) || 0;
        recordsPerStore.set(item.store_name, count + 1);
      });
      
      console.log(`📊 [RoleBasedDataLoading] Records per store (top 10):`);
      Array.from(recordsPerStore.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .forEach(([store, count]) => {
          console.log(`   - ${store}: ${count} records`);
        });

      // Step 5: Load amendments (filtered by accessible stores)
      setState(prev => ({
        ...prev,
        loadingProgress: { ...prev.loadingProgress, currentOperation: 'Loading amendments...', completed: 5 }
      }));

      const { data: amendmentsData, error: amendmentsError } = await supabaseAdmin
        .from('weekly_plan_amendments')
        .select(`
          id, stock_code, store_id, amended_qty, justification, 
          status, created_by_role, user_id, created_at, updated_at,
          admin_notes, category, sub_category, week_reference,
          created_by_user:users!user_id(name, email),
          store:stores!store_id(store_name, region)
        `)
        .eq('week_reference', weekReference)
        .in('store_id', storeIds)
        .order('created_at', { ascending: false });

      if (amendmentsError) throw amendmentsError;

      console.log(`📋 [RoleBasedDataLoading] Loaded ${amendmentsData?.length || 0} amendments`);
      
      // Debug: Show amendment details if any exist
      if (amendmentsData && amendmentsData.length > 0) {
        console.log(`📋 [RoleBasedDataLoading] Sample amendments:`, amendmentsData.slice(0, 3).map(a => ({
          id: a.id,
          stock_code: a.stock_code,
          store_id: a.store_id,
          amended_qty: a.amended_qty,
          created_by_role: a.created_by_role,
          status: a.status
        })));
      } else {
        console.log(`❌ [RoleBasedDataLoading] No amendments found for week ${weekReference} and store IDs:`, storeIds.slice(0, 5));
      }

      // Step 6: Load submissions (filtered by accessible stores)
      setState(prev => ({
        ...prev,
        loadingProgress: { ...prev.loadingProgress, currentOperation: 'Loading submissions...', completed: 6 }
      }));

      const { data: submissionsData, error: submissionsError } = await supabaseAdmin
        .from('weekly_plan_submissions')
        .select('*')
        .eq('week_reference', weekReference)
        .in('store_id', storeIds);

      if (submissionsError) throw submissionsError;

      console.log(`📋 [RoleBasedDataLoading] Loaded ${submissionsData?.length || 0} submissions`);

      // Step 7: Process and combine data (same logic as admin)
      setState(prev => ({
        ...prev,
        loadingProgress: { ...prev.loadingProgress, currentOperation: 'Processing data...', completed: 7 }
      }));

      // Create amendment map for efficient lookup
      const amendmentMap = new Map();
      amendmentsData?.forEach(amendment => {
        const key = `${amendment.store_id}_${amendment.stock_code}`;
        amendmentMap.set(key, amendment);
      });

      console.log(`📋 [RoleBasedDataLoading] Amendment map created with ${amendmentMap.size} entries`);
      if (amendmentMap.size > 0) {
        console.log(`📋 [RoleBasedDataLoading] Sample amendment keys:`, Array.from(amendmentMap.keys()).slice(0, 5));
        console.log(`📋 [RoleBasedDataLoading] Sample amendment values:`, Array.from(amendmentMap.values()).slice(0, 3).map(a => ({
          stock_code: a.stock_code,
          store_id: a.store_id,
          amended_qty: a.amended_qty,
          created_by_role: a.created_by_role
        })));
      }

      // Combine weekly plan data with amendments
      let amendmentMatchCount = 0;
      let storeIdMismatchCount = 0;
      const combinedPlanData = allWeeklyPlanData.map(planItem => {
        // Find store by store_name (weekly_plan table uses store_name)
        const store = accessibleStores.find(s => s.store_name === planItem.store_name);
        const storeId = store?.store_id;
        
        if (!storeId) {
          storeIdMismatchCount++;
          if (storeIdMismatchCount <= 3) {
            console.log(`⚠️ [RoleBasedDataLoading] Store ID not found for store_name: ${planItem.store_name}`);
          }
        }
        
        // Create amendment key using store_id (amendments table uses store_id)
        const amendmentKey = storeId ? `${storeId}_${planItem.stock_code}` : null;
        const amendment = amendmentKey ? amendmentMap.get(amendmentKey) : null;
        
        if (amendment) {
          amendmentMatchCount++;
          console.log(`🎯 [RoleBasedDataLoading] Amendment match found: ${amendmentKey} -> ${amendment.amended_qty} (${amendment.status})`);
        }
        
        return {
          ...planItem,
          store_id: storeId || null, // Add store_id for compatibility
          store: store ? {
            id: store.store_id,
            store_code: store.store_code,
            store_name: store.store_name,
            region: store.region
          } : null,
          has_amendment: !!amendment,
          amendment_data: amendment || null,
          store_name: planItem.store_name || 'Unknown Store'
        };
      });

      console.log(`🔄 [RoleBasedDataLoading] Combined ${combinedPlanData.length} plan items with amendments`);
      console.log(`📊 [RoleBasedDataLoading] Amendment matches found: ${amendmentMatchCount} out of ${amendmentMap.size} possible amendments`);
      if (storeIdMismatchCount > 0) {
        console.log(`⚠️ [RoleBasedDataLoading] Store ID mismatches: ${storeIdMismatchCount} plan items had no matching store in hierarchy`);
      }
      
      // Debug: Show items with amendments
      const itemsWithAmendments = combinedPlanData.filter(item => item.has_amendment);
      console.log(`📋 [RoleBasedDataLoading] Final items with amendments: ${itemsWithAmendments.length}`);
      if (itemsWithAmendments.length > 0) {
        console.log(`📋 [RoleBasedDataLoading] Sample amended items:`, itemsWithAmendments.slice(0, 3).map(item => ({
          store: item.store_name,
          stock_code: item.stock_code,
          amended_qty: item.amendment_data?.amended_qty,
          has_amendment: item.has_amendment
        })));
      }
      
      // Debug: Final store summary
      const finalStoresWithData = new Set(combinedPlanData.map(item => item.store_name));
      console.log(`📊 [RoleBasedDataLoading] Final combined data covers ${finalStoresWithData.size} stores:`, Array.from(finalStoresWithData).slice(0, 5));

      // Step 8: Final data organization
      setState(prev => ({
        ...prev,
        loadingProgress: { ...prev.loadingProgress, currentOperation: 'Finalizing data...', completed: 8 }
      }));

      // Create a complete store dataset that includes all accessible stores,
      // even if they don't have weekly plan data for this week
      const completeStoreData = accessibleStores.map(store => {
        const storeWeeklyPlanItems = combinedPlanData.filter(item => item.store_name === store.store_name);
        
        return {
          ...store,
          weeklyPlanItems: storeWeeklyPlanItems,
          hasWeeklyPlanData: storeWeeklyPlanItems.length > 0
        };
      });

      const organizationalData = {
        stores: accessibleStores, // All accessible stores from hierarchy
        storeHierarchy: accessibleStores,
        amendments: combinedPlanData, // Combined weekly plan + amendment data
        completeStoreData: completeStoreData // All stores with their weekly plan items
      };
      
      console.log(`📊 [RoleBasedDataLoading] Organizational data summary: ${accessibleStores.length} total stores, ${combinedPlanData.length} plan items`);

      const finalState = {
        selectedWeek: weekData || { week_reference: weekReference },
        userInfo: userData,
        organizationalData,
        isDataLoaded: true,
        isLoading: false,
        loadingProgress: {
          currentOperation: 'Complete',
          completed: 9,
          total: 9,
          actualRecordsLoaded: totalRecordsLoaded,
          estimatedTotal: totalRecordsLoaded
        }
      };

      // Cache the result
      setCachedData(prev => new Map(prev.set(cacheKey, finalState)));

      setState(prev => ({ ...prev, ...finalState }));

      console.log(`✅ [RoleBasedDataLoading] Data loading complete for ${userRole}`);

    } catch (error) {
      console.error('❌ [RoleBasedDataLoading] Error loading data:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        isLoading: false
      }));
    }
  };

  // Auto-load data when dependencies change
  useEffect(() => {
    if (userId && weekReference) {
      loadRoleBasedData();
    }
  }, [userRole, userId, weekReference]);

  // Memoized preloaded data for WeeklyPlanInterface
  const preloadedData = useMemo(() => {
    if (!state.isDataLoaded) return null;

    return {
      currentWeek: state.selectedWeek,
      areaManagerInfo: state.userInfo, // Will be regionalManagerInfo for regional managers
      storeHierarchy: state.organizationalData.storeHierarchy,
      storesWithSubmissions: state.organizationalData.amendments // Combined plan data with amendments
    };
  }, [state.selectedWeek, state.userInfo, state.organizationalData]);

  return {
    // State
    isLoading: state.isLoading,
    loadingProgress: state.loadingProgress,
    error: state.error,
    isDataLoaded: state.isDataLoaded,
    
    // Data for UI
    selectedWeek: state.selectedWeek,
    userInfo: state.userInfo,
    organizationalData: state.organizationalData,
    
    // Formatted for WeeklyPlanInterface  
    preloadedData,
    
    // Actions
    reload: loadRoleBasedData,
    clearCache: () => setCachedData(new Map())
  };
}