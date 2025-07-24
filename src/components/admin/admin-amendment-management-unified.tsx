import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp,
  Edit,
  BarChart3,
  RefreshCw,
  Building2,
  UserCheck,
  Users,
  Download
} from 'lucide-react';
import { AdminSubmissionTracking } from '@/pages/admin/submission-tracking';
import { AdminAmendmentInterface } from '@/components/admin/admin-amendment-interface';
import { WeeklyPlanInterface } from '@/components/shared/weekly-plan-interface';
import { AmendmentExport } from '@/components/admin/amendment-export';
import { supabaseAdmin } from '@/lib/supabase';

// Data caching infrastructure
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const dataCache = new Map<string, { data: any; timestamp: number; expiry: number }>();

const getCachedData = (key: string) => {
  const cached = dataCache.get(key);
  if (cached && Date.now() < cached.expiry) {
    console.log(`Cache hit for key: ${key}`);
    return cached.data;
  }
  if (cached) {
    console.log(`Cache expired for key: ${key}`);
    dataCache.delete(key);
  }
  return null;
};

const setCachedData = (key: string, data: any) => {
  console.log(`Caching data for key: ${key}`);
  dataCache.set(key, {
    data,
    timestamp: Date.now(),
    expiry: Date.now() + CACHE_DURATION
  });
};

// Comprehensive data loading operations for single week
const FULL_LOAD_OPERATIONS = [
  { name: 'Users & Managers', table: 'users', estimatedRecords: 500, priority: 1 },
  { name: 'Stores', table: 'stores', estimatedRecords: 200, priority: 2 },
  { name: 'Store Hierarchy', table: 'store_management_hierarchy', estimatedRecords: 200, priority: 3 },
  { name: 'Week Selections', table: 'week_selections', estimatedRecords: 50, priority: 4 },
  { name: 'Full Weekly Plan Data', table: 'weekly_plan', estimatedRecords: 55000, priority: 5, paginated: true },
  { name: 'Current Week Submissions', table: 'weekly_plan_submissions', estimatedRecords: 500, priority: 6 },
  { name: 'Regional Manager Amendments', table: 'weekly_plan_amendments', estimatedRecords: 1000, priority: 7, filtered: true },
  { name: 'Data Processing', derived: true, estimatedRecords: 1000, priority: 8 },
  { name: 'Summary Calculations', derived: true, estimatedRecords: 100, priority: 9 }
];

interface FullDataset {
  users: any[];
  regionalManagers: any[];
  areaManagers: any[];
  storeManagers: any[];
  stores: any[];
  storeHierarchy: any[];
  weekSelections: any[];
  weeklyPlanData: any[];
  currentWeekSubmissions: any[];
  currentWeekAmendments: any[];
  processedSubmissionData: any[];
  combinedPlanData: any[];
}

interface AdminAmendmentManagementUnifiedState {
  loading: boolean;
  error: string | null;
  activeView: 'submission' | 'summary' | 'detail' | 'export';
  adminInfo: any;
  selectedWeek: any;
  isLoadingView: boolean;
  fullDataset: FullDataset;
  organizationalData: {
    stores: any[];
    amendments: any[];
  };
  submissionSummary: {
    total_stores: number;
    stores_submitted: number;
    stores_pending: number;
    area_managers_submitted: number;
    area_managers_pending: number;
    total_amendments: number;
  };
  loadingProgress: {
    totalOperations: number;
    currentOperation: number;
    currentOperationName: string;
    totalEstimatedRecords: number;
    actualRecordsLoaded: number;
    isVisible: boolean;
    startTime: number;
    estimatedTimeRemaining: number;
    operationsDetails: typeof FULL_LOAD_OPERATIONS;
  };
  realTimeChannel: any;
}

export function AdminAmendmentManagementUnified() {
  const { userId } = useAuth();
  
  console.log(`🔄 [Component Render] AdminAmendmentManagementUnified rendering at ${new Date().toISOString()}`);
  
  const [state, setState] = useState<AdminAmendmentManagementUnifiedState>({
    loading: true,
    error: null,
    activeView: 'submission', // Default to submission tracking
    adminInfo: null,
    selectedWeek: null,
    isLoadingView: false,
    fullDataset: {
      users: [],
      regionalManagers: [],
      areaManagers: [],
      storeManagers: [],
      stores: [],
      storeHierarchy: [],
      weekSelections: [],
      currentWeekSubmissions: [],
      currentWeekAmendments: [],
      processedSubmissionData: []
    },
    organizationalData: {
      stores: [],
      amendments: []
    },
    submissionSummary: {
      total_stores: 0,
      stores_submitted: 0,
      stores_pending: 0,
      area_managers_submitted: 0,
      area_managers_pending: 0,
      total_amendments: 0
    },
    loadingProgress: {
      totalOperations: FULL_LOAD_OPERATIONS.length,
      currentOperation: 0,
      currentOperationName: '',
      totalEstimatedRecords: FULL_LOAD_OPERATIONS.reduce((sum, op) => sum + op.estimatedRecords, 0),
      actualRecordsLoaded: 0,
      isVisible: false,
      startTime: 0,
      estimatedTimeRemaining: 0,
      operationsDetails: FULL_LOAD_OPERATIONS
    },
    realTimeChannel: null
  });

  const loadAdminInfo = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      if (!supabaseAdmin) {
        throw new Error('Supabase admin client not available');
      }

      const { data: adminData, error: adminError } = await supabaseAdmin
        .from('users')
        .select('id, email, name, first_name, last_name, role, clerk_id')
        .eq('clerk_id', userId)
        .eq('role', 'admin')
        .limit(1)
        .single();

      if (adminError || !adminData) {
        console.error('Admin lookup error:', adminError);
        throw new Error('Admin user not found or insufficient permissions');
      }

      console.log('Admin user found:', adminData);

      // Get current week
      const { data: weekData } = await supabaseAdmin
        .from('week_selections')
        .select('*')
        .eq('is_current', true)
        .order('week_start_date', { ascending: false })
        .limit(1)
        .single();

      const currentWeek = weekData || null;

      setState(prev => ({
        ...prev,
        loading: false,
        adminInfo: adminData,
        selectedWeek: currentWeek
      }));

    } catch (error: any) {
      console.error('Error loading admin info:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to load admin information'
      }));
    }
  };

  // Comprehensive full dataset loading function - memoized
  const loadFullDataset = useCallback(async () => {
    if (!state.selectedWeek || !supabaseAdmin) return;

    const cacheKey = `full_dataset_${state.selectedWeek.week_reference}`;
    
    // Check cache first
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      console.log('Using cached full dataset for week:', state.selectedWeek.week_reference);
      setState(prev => ({
        ...prev,
        fullDataset: cachedData.fullDataset,
        organizationalData: cachedData.organizationalData
      }));
      return;
    }

    try {
      console.log('Starting comprehensive data load for ~55k records...');
      const startTime = Date.now();
      
      // Initialize loading progress
      setState(prev => ({
        ...prev,
        loadingProgress: {
          ...prev.loadingProgress,
          isVisible: true,
          startTime,
          currentOperation: 0,
          currentOperationName: 'Initializing...',
          actualRecordsLoaded: 0
        }
      }));

      const fullDataset: FullDataset = {
        users: [],
        regionalManagers: [],
        areaManagers: [],
        storeManagers: [],
        stores: [],
        storeHierarchy: [],
        weekSelections: [],
        weeklyPlanData: [],
        currentWeekSubmissions: [],
        currentWeekAmendments: [],
        processedSubmissionData: [],
        combinedPlanData: []
      };

      let totalRecordsLoaded = 0;

      // Execute each operation sequentially with progress tracking
      for (let i = 0; i < FULL_LOAD_OPERATIONS.length; i++) {
        const operation = FULL_LOAD_OPERATIONS[i];
        const elapsed = Date.now() - startTime;
        const avgTimePerOperation = elapsed / Math.max(i, 1);
        const remainingOperations = FULL_LOAD_OPERATIONS.length - i;
        // More realistic time estimates based on operation complexity
        let estimatedTimeRemaining;
        if (i < 5) {
          // Early operations are faster (metadata loads)
          estimatedTimeRemaining = remainingOperations * 500; // 500ms average per operation
        } else if (i === 5) {
          // Weekly plan data load is the longest (operation 5)
          estimatedTimeRemaining = 12000 + (remainingOperations - 1) * 1000; // 12s for weekly plan + 1s each for remaining
        } else {
          // Later operations (processing) are medium speed
          estimatedTimeRemaining = remainingOperations * 1000; // 1s per remaining operation
        }

        // Update progress
        setState(prev => ({
          ...prev,
          loadingProgress: {
            ...prev.loadingProgress,
            currentOperation: i + 1,
            currentOperationName: operation.name,
            estimatedTimeRemaining: Math.round(estimatedTimeRemaining / 1000) // Convert to seconds
          }
        }));

        console.log(`[${i + 1}/${FULL_LOAD_OPERATIONS.length}] Loading ${operation.name}...`);

        if (operation.derived) {
          // Handle derived/processing operations
          if (operation.name === 'Data Processing') {
            console.log('Processing and combining weekly plan data with amendments...');
            
            // Create maps for efficient lookups
            const submissionMap = new Map();
            fullDataset.currentWeekSubmissions.forEach(sub => {
              submissionMap.set(sub.store_id, sub);
            });

            // Create amendment map by store_id + stock_code for precise matching
            const amendmentMap = new Map();
            fullDataset.currentWeekAmendments.forEach(amendment => {
              const key = `${amendment.store_id}_${amendment.stock_code}`;
              amendmentMap.set(key, amendment);
            });

            // Combine weekly plan data with amendments using correct mapping
            const combinedData = fullDataset.weeklyPlanData.map(planItem => {
              // Find matching amendment using store_id (from store lookup) and stock_code
              const storeMatch = fullDataset.stores.find(store => store.store_name === planItem.store_name);
              const amendmentKey = storeMatch ? `${storeMatch.id}_${planItem.stock_code}` : null;
              const amendment = amendmentKey ? amendmentMap.get(amendmentKey) : null;
              
              // Apply amendment if it exists, otherwise use original plan data
              return {
                ...planItem,
                // Store mapping
                store_id: storeMatch?.id || null,
                // Store object for WeeklyPlanInterface compatibility
                store: {
                  id: storeMatch?.id || null,
                  store_name: planItem.store_name,
                  region: storeMatch?.region || null
                },
                // Original quantities
                original_order_qty: planItem.order_qty,
                original_add_ons_qty: planItem.add_ons_qty,
                // Final quantities (with amendments applied)
                order_qty: amendment ? amendment.amended_qty : planItem.order_qty,
                add_ons_qty: amendment ? amendment.amended_qty : planItem.add_ons_qty,
                // Amendment metadata
                has_amendment: !!amendment,
                amendment_data: amendment || null,
                // Amendment details for WeeklyPlanInterface compatibility
                amended_qty: amendment ? amendment.amended_qty : null,
                justification: amendment ? amendment.justification : null,
                status: amendment ? amendment.status : null,
                created_by_role: amendment ? amendment.created_by_role : null,
                // User information for amendments
                created_by_user: amendment?.created_by_user || null,
                // Ensure sub_category is populated from amendment or fallback
                sub_category: amendment?.sub_category || planItem.sub_category || (planItem.stock_code?.split('-')[0]) || 'Other',
                // Calculate totals
                total_to_order: (amendment ? amendment.amended_qty : planItem.order_qty || 0) + 
                               (amendment ? amendment.amended_qty : planItem.add_ons_qty || 0)
              };
            });

            fullDataset.combinedPlanData = combinedData;

            // Process submission data for store hierarchy
            fullDataset.processedSubmissionData = fullDataset.storeHierarchy.map(store => ({
              ...store,
              submission: submissionMap.get(store.store_id)
            }));
            
            totalRecordsLoaded += fullDataset.processedSubmissionData.length + combinedData.length;
            console.log(`Combined ${combinedData.length} plan items with ${fullDataset.currentWeekAmendments.length} amendments`);
            console.log('Sample combined data items:', combinedData.slice(0, 3));
            
            // Update progress
            setState(prev => ({
              ...prev,
              loadingProgress: {
                ...prev.loadingProgress,
                actualRecordsLoaded: totalRecordsLoaded
              }
            }));
          } else if (operation.name === 'Summary Calculations') {
            // Perform summary calculations here
            totalRecordsLoaded += 100; // Simulated processing
          }
        } else {
          // Handle database operations
          let result;
          switch (operation.table) {
            case 'users':
              result = await supabaseAdmin
                .from('users')
                .select('*')
                .order('created_at', { ascending: false });
              
              if (result.data) {
                fullDataset.users = result.data;
                fullDataset.regionalManagers = result.data.filter(u => u.role === 'regional_manager');
                fullDataset.areaManagers = result.data.filter(u => u.role === 'area_manager');
                fullDataset.storeManagers = result.data.filter(u => u.role === 'store_manager');
                totalRecordsLoaded += result.data.length;
              }
              break;

            case 'stores':
              result = await supabaseAdmin
                .from('stores')
                .select('id, store_name, address, region')
                .order('store_name');
              
              if (result.data) {
                fullDataset.stores = result.data;
                totalRecordsLoaded += result.data.length;
              }
              break;

            case 'store_management_hierarchy':
              result = await supabaseAdmin
                .from('store_management_hierarchy')
                .select('*')
                .order('store_name');
              
              if (result.data) {
                fullDataset.storeHierarchy = result.data;
                totalRecordsLoaded += result.data.length;
              }
              break;

            case 'week_selections':
              result = await supabaseAdmin
                .from('week_selections')
                .select('*')
                .order('week_start_date', { ascending: false });
              
              if (result.data) {
                fullDataset.weekSelections = result.data;
                totalRecordsLoaded += result.data.length;
              }
              break;

            case 'weekly_plan_submissions':
              result = await supabaseAdmin
                .from('weekly_plan_submissions')
                .select('*')
                .eq('week_reference', state.selectedWeek.week_reference);
              
              if (result.data) {
                fullDataset.currentWeekSubmissions = result.data;
                totalRecordsLoaded += result.data.length;
              }
              break;

            case 'weekly_plan':
              console.log('Loading full weekly plan data - this may take a while for ~55k records...');
              // Load weekly plan data with pagination like regional manager
              let allWeeklyPlanData: any[] = [];
              let offset = 0;
              const batchSize = 1000;
              let hasMoreData = true;
              
              while (hasMoreData) {
                const { data: batchData, error: batchError } = await supabaseAdmin
                  .from('weekly_plan')
                  .select(`
                    id, store_name, stock_code, description, category, sub_category,
                    order_qty, add_ons_qty, qty_on_hand, qty_in_transit, 
                    qty_pending_orders, model_stock_qty, reference, start_date
                  `)
                  .eq('reference', state.selectedWeek.week_reference)
                  .range(offset, offset + batchSize - 1)
                  .order('store_name', { ascending: true });

                if (batchError) {
                  console.error('Error loading weekly plan batch:', batchError);
                  break;
                }

                if (batchData && batchData.length > 0) {
                  allWeeklyPlanData = [...allWeeklyPlanData, ...batchData];
                  offset += batchSize;
                  
                  // Update progress for this batch
                  setState(prev => ({
                    ...prev,
                    loadingProgress: {
                      ...prev.loadingProgress,
                      actualRecordsLoaded: totalRecordsLoaded + allWeeklyPlanData.length
                    }
                  }));
                  
                  // Check if we got a full batch (more data available)
                  hasMoreData = batchData.length === batchSize;
                } else {
                  hasMoreData = false;
                }
              }
              
              fullDataset.weeklyPlanData = allWeeklyPlanData;
              totalRecordsLoaded += allWeeklyPlanData.length;
              console.log(`Loaded ${allWeeklyPlanData.length} weekly plan records`);
              break;

            case 'weekly_plan_amendments':
              console.log('Loading ALL amendments (not filtering by role)...');
              // Load all amendments to match the 11 from submission-tracking
              result = await supabaseAdmin
                .from('weekly_plan_amendments')
                .select(`
                  id, stock_code, store_id, amended_qty, justification, 
                  status, created_by_role, user_id, created_at, updated_at,
                  admin_notes, category, sub_category, week_reference,
                  created_by_user:users!user_id(name, email),
                  store:stores!store_id(store_name, region)
                `)
                .eq('week_reference', state.selectedWeek.week_reference)
                .order('created_at', { ascending: false });
              
              if (result.data) {
                fullDataset.currentWeekAmendments = result.data;
                totalRecordsLoaded += result.data.length;
                console.log(`Loaded ${result.data.length} amendments (all roles & statuses)`);
              }
              break;

            default:
              console.warn(`Unknown table: ${operation.table}`);
          }

          if (result?.error) {
            console.error(`Error loading ${operation.name}:`, result.error);
          }
        }

        // Update progress with actual records loaded
        setState(prev => ({
          ...prev,
          loadingProgress: {
            ...prev.loadingProgress,
            actualRecordsLoaded: totalRecordsLoaded
          }
        }));

        // Small delay to ensure UI updates
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Create organizational data from full dataset - use combined data instead of just amendments
      const organizationalData = {
        stores: fullDataset.stores,
        storeHierarchy: fullDataset.stores, // Add storeHierarchy from stores for WeeklyPlanInterface compatibility
        amendments: fullDataset.combinedPlanData // Use the combined weekly plan + amendments data
      };

      // Cache the complete dataset
      setCachedData(cacheKey, { fullDataset, organizationalData });

      console.log('Full dataset load completed:', {
        totalRecordsLoaded,
        timeElapsed: Math.round((Date.now() - startTime) / 1000),
        users: fullDataset.users.length,
        stores: fullDataset.stores.length,
        amendments: fullDataset.currentWeekAmendments.length
      });

      // Update state with loaded data and hide loading
      console.log(`📦 [loadFullDataset] Setting final state with loaded data:`, {
        fullDatasetStores: fullDataset.stores.length,
        fullDatasetAmendments: fullDataset.currentWeekAmendments.length,
        fullDatasetWeeklyPlanData: fullDataset.weeklyPlanData.length,
        fullDatasetCombinedData: fullDataset.combinedPlanData.length,
        organizationalDataStores: organizationalData.stores.length,
        organizationalDataAmendments: organizationalData.amendments.length
      });
      
      console.log('Sample organizational amendments (first 2):', organizationalData.amendments.slice(0, 2));
      
      setState(prev => ({
        ...prev,
        fullDataset,
        organizationalData,
        loadingProgress: {
          ...prev.loadingProgress,
          isVisible: false,
          currentOperationName: 'Complete'
        }
      }));

    } catch (error) {
      console.error('Error loading full dataset:', error);
      setState(prev => ({
        ...prev,
        loadingProgress: {
          ...prev.loadingProgress,
          isVisible: false,
          currentOperationName: 'Error occurred'
        }
      }));
    }
  }, [state.selectedWeek?.week_reference, supabaseAdmin]); // Add dependency array


  const loadSubmissionSummary = useCallback(async () => {
    if (!state.selectedWeek || !supabaseAdmin) return;

    try {
      // Load the same data that AdminSubmissionTracking uses
      const [hierarchyResult, submissionsResult, amendmentsResult] = await Promise.all([
        supabaseAdmin
          .from('store_management_hierarchy')
          .select('*')
          .order('store_name'),
        supabaseAdmin
          .from('weekly_plan_submissions')
          .select('*')
          .eq('week_reference', state.selectedWeek.week_reference),
        supabaseAdmin
          .from('weekly_plan_amendments')
          .select('amended_qty, created_by_role, week_reference')
          .eq('week_reference', state.selectedWeek.week_reference)
      ]);

      const storeHierarchy = hierarchyResult.data || [];
      const submissionStatuses = submissionsResult.data || [];
      const amendments = amendmentsResult.data || [];

      // Calculate summary statistics (same logic as AdminSubmissionTracking)
      const submissionMap = new Map();
      submissionStatuses.forEach(sub => {
        submissionMap.set(sub.store_id, sub);
      });

      const totalStores = storeHierarchy.length;
      let storesSubmitted = 0;
      let totalAmendments = 0;

      const areaManagers = new Set();
      const regionalManagers = new Set();
      const submittedAreaManagers = new Set();
      const submittedRegionalManagers = new Set();

      storeHierarchy.forEach(store => {
        const submission = submissionMap.get(store.store_id);
        
        if (store.area_manager_id) {
          areaManagers.add(store.area_manager_id);
        }
        if (store.regional_manager_id) {
          regionalManagers.add(store.regional_manager_id);
        }

        if (submission) {
          if (submission.store_submission_status === 'submitted') {
            storesSubmitted++;
          }
          if (submission.area_submission_status === 'submitted' && store.area_manager_id) {
            submittedAreaManagers.add(store.area_manager_id);
          }
          if (submission.regional_submission_status === 'submitted' && store.regional_manager_id) {
            submittedRegionalManagers.add(store.regional_manager_id);
          }
        }
      });

      // Calculate amendment totals
      amendments.forEach(amendment => {
        totalAmendments += amendment.amended_qty || 0;
      });

      const summaryData = {
        total_stores: totalStores,
        stores_submitted: storesSubmitted,
        stores_pending: totalStores - storesSubmitted,
        area_managers_submitted: submittedAreaManagers.size,
        area_managers_pending: areaManagers.size - submittedAreaManagers.size,
        total_amendments: Math.abs(totalAmendments) // Use absolute value for display
      };

      setState(prev => ({
        ...prev,
        submissionSummary: summaryData
      }));

    } catch (error) {
      console.error('Error loading submission summary:', error);
    }
  }, [state.selectedWeek?.week_reference, supabaseAdmin]);

  const switchToView = async (view: 'submission' | 'summary' | 'detail' | 'export') => {
    console.log(`🔍 [switchToView] Starting view switch from '${state.activeView}' to '${view}'`);
    console.log(`🔍 [switchToView] Current data state:`, {
      hasAdminInfo: !!state.adminInfo,
      hasSelectedWeek: !!state.selectedWeek,
      organizationalDataStores: state.organizationalData.stores.length,
      organizationalDataAmendments: state.organizationalData.amendments.length,
      fullDatasetStores: state.fullDataset.stores.length,
      fullDatasetAmendments: state.fullDataset.currentWeekAmendments.length
    });
    
    setState(prev => ({ ...prev, isLoadingView: true }));
    
    // Longer timeout for detail view due to data processing complexity
    const loadingTimeout = view === 'detail' ? 600 : 200;
    
    setTimeout(() => {
      console.log(`🔍 [switchToView] Completing view switch to '${view}'`);
      setState(prev => ({ 
        ...prev, 
        activeView: view,
        isLoadingView: false 
      }));
    }, loadingTimeout);
  };

  useEffect(() => {
    console.log(`🔄 [useEffect] userId changed:`, { userId, hasUserId: !!userId });
    if (userId) {
      loadAdminInfo();
    }
  }, [userId]);

  useEffect(() => {
    console.log(`🔄 [useEffect] selectedWeek changed:`, { 
      hasSelectedWeek: !!state.selectedWeek, 
      weekReference: state.selectedWeek?.week_reference 
    });
    if (state.selectedWeek) {
      loadSubmissionSummary();
      loadFullDataset(); // Load complete dataset upfront (includes organizational data)
    }
  }, [state.selectedWeek?.week_reference]); // Use stable reference

  // Set up real-time subscriptions for amendment updates - optimized
  useEffect(() => {
    if (!state.selectedWeek || !supabaseAdmin || state.realTimeChannel) return;

    console.log('Setting up real-time subscriptions for amendments...');
    
    let batchTimer: NodeJS.Timeout | null = null;
    let pendingUpdates: any[] = [];
    
    const batchUpdateHandler = () => {
      if (pendingUpdates.length === 0) return;
      
      console.log(`📡 [Batch Update] Processing ${pendingUpdates.length} batched updates`);
      
      setState(prev => {
        let updatedAmendments = [...prev.fullDataset.currentWeekAmendments];
        
        pendingUpdates.forEach(payload => {
          if (payload.eventType === 'INSERT') {
            updatedAmendments.unshift(payload.new);
          } else if (payload.eventType === 'UPDATE') {
            const index = updatedAmendments.findIndex(a => a.id === payload.new.id);
            if (index !== -1) {
              updatedAmendments[index] = payload.new;
            }
          } else if (payload.eventType === 'DELETE') {
            const index = updatedAmendments.findIndex(a => a.id === payload.old.id);
            if (index !== -1) {
              updatedAmendments.splice(index, 1);
            }
          }
        });
        
        return {
          ...prev,
          fullDataset: {
            ...prev.fullDataset,
            currentWeekAmendments: updatedAmendments
          },
          organizationalData: {
            ...prev.organizationalData,
            amendments: updatedAmendments
          }
        };
      });
      
      pendingUpdates = [];
    };
    
    // Create real-time channel for current week amendments
    const channel = supabaseAdmin
      .channel(`amendments_${state.selectedWeek.week_reference}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'weekly_plan_amendments',
          filter: `week_reference=eq.${state.selectedWeek.week_reference}`
        },
        (payload) => {
          console.log('Real-time amendment update received:', payload);
          
          // Batch updates to reduce re-renders
          pendingUpdates.push(payload);
          
          if (batchTimer) clearTimeout(batchTimer);
          batchTimer = setTimeout(batchUpdateHandler, 100); // 100ms batching window
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public', 
          table: 'weekly_plan_submissions',
          filter: `week_reference=eq.${state.selectedWeek.week_reference}`
        },
        (payload) => {
          console.log('Real-time submission update received:', payload);
          
          // Use React.startTransition for non-urgent updates
          React.startTransition(() => {
            setState(prev => {
              const updatedSubmissions = [...prev.fullDataset.currentWeekSubmissions];
              
              if (payload.eventType === 'INSERT') {
                updatedSubmissions.unshift(payload.new);
              } else if (payload.eventType === 'UPDATE') {
                const index = updatedSubmissions.findIndex(s => s.id === payload.new.id);
                if (index !== -1) {
                  updatedSubmissions[index] = payload.new;
                }
              } else if (payload.eventType === 'DELETE') {
                const index = updatedSubmissions.findIndex(s => s.id === payload.old.id);
                if (index !== -1) {
                  updatedSubmissions.splice(index, 1);
                }
              }
              
              return {
                ...prev,
                fullDataset: {
                  ...prev.fullDataset,
                  currentWeekSubmissions: updatedSubmissions
                }
              };
            });
            
            // Trigger summary recalculation
            loadSubmissionSummary();
          });
        }
      )
      .subscribe((status) => {
        console.log('Real-time subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscriptions active for current week amendments and submissions');
        }
      });

    // Store the channel in state for cleanup
    setState(prev => ({
      ...prev,
      realTimeChannel: channel
    }));

    // Cleanup function
    return () => {
      console.log('Cleaning up real-time subscriptions...');
      if (batchTimer) clearTimeout(batchTimer);
      if (channel) {
        supabaseAdmin.removeChannel(channel);
      }
    };
  }, [state.selectedWeek?.week_reference, supabaseAdmin]); // Use stable reference

  // Cleanup real-time subscriptions when component unmounts
  useEffect(() => {
    return () => {
      if (state.realTimeChannel && supabaseAdmin) {
        console.log('Component unmounting - cleaning up real-time channel');
        supabaseAdmin.removeChannel(state.realTimeChannel);
      }
    };
  }, []);
  
  // Memoize preloadedData to prevent unnecessary re-renders (must be at top level)
  const preloadedData = useMemo(() => {
    if (!state.adminInfo || !state.selectedWeek) return null;
    
    return {
      currentWeek: state.selectedWeek,
      areaManagerInfo: state.adminInfo,
      storeHierarchy: (state.organizationalData.storeHierarchy || []).map(store => ({
        ...store,
        store_id: store.store_id || store.id,
        store_code: store.store_code || store.store_name // Use actual store_code field
      })),
      storesWithSubmissions: state.organizationalData.amendments // This now contains the full combined plan data
    };
  }, [state.selectedWeek, state.adminInfo, state.organizationalData.storeHierarchy, state.organizationalData.amendments]);

  if (state.loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin information...</p>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <Alert className="max-w-md mx-auto mt-8">
        <AlertDescription>
          {state.error}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadAdminInfo}
            className="ml-2"
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Amendment Management Dashboard</h1>
          <p className="text-gray-600">Weekly Plan Submission Tracking & Amendment Management</p>
          {state.selectedWeek && (
            <div className="flex items-center gap-4 mt-2 mb-3">
              <Badge variant="default" className="bg-green-100 text-green-800">
                {state.selectedWeek.week_reference}
              </Badge>
              <div className="text-sm text-muted-foreground">
                {new Date(state.selectedWeek.week_start_date).toLocaleDateString()} - {new Date(state.selectedWeek.week_end_date).toLocaleDateString()}
              </div>
            </div>
          )}
          
          {/* Summary Information in Badge Format */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-500" />
              <span className="text-muted-foreground">Total Stores:</span>
              <Badge variant="outline" className="border-blue-500 text-blue-600">
                {state.submissionSummary.total_stores}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">Submitted:</span>
              <Badge variant="outline" className="border-green-500 text-green-600">
                {state.submissionSummary.stores_submitted} stores
              </Badge>
              <span className="text-muted-foreground">
                ({state.submissionSummary.stores_pending} pending)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-muted-foreground">Area Managers:</span>
              <Badge variant="outline" className="border-blue-500 text-blue-600">
                {state.submissionSummary.area_managers_submitted} submitted
              </Badge>
              <span className="text-muted-foreground">
                ({state.submissionSummary.area_managers_pending} pending)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-500" />
              <span className="text-muted-foreground">Total Amendments:</span>
              <Badge variant="outline" className="border-orange-500 text-orange-600">
                {state.submissionSummary.total_amendments}
              </Badge>
            </div>
          </div>
        </div>
        <Button onClick={loadAdminInfo} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Navigation - Badge-Style Buttons */}
      <Card>
        <CardContent className="p-6">
          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => switchToView('submission')}
              className={`rounded-lg px-8 py-3 font-semibold text-sm transition-all ${
                state.activeView === 'submission' 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              <BarChart3 className="h-5 w-5 mr-2" />
              SUBMISSION TRACKING
            </Button>
            <Button
              onClick={() => switchToView('summary')}
              className={`rounded-lg px-8 py-3 font-semibold text-sm transition-all ${
                state.activeView === 'summary' 
                  ? 'bg-green-600 text-white hover:bg-green-700' 
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              <TrendingUp className="h-5 w-5 mr-2" />
              SUMMARY VIEW
            </Button>
            <Button
              onClick={() => switchToView('detail')}
              className={`rounded-lg px-8 py-3 font-semibold text-sm transition-all ${
                state.activeView === 'detail' 
                  ? 'bg-amber-600 text-white hover:bg-amber-700' 
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              }`}
            >
              <Edit className="h-5 w-5 mr-2" />
              DETAILED VIEW
            </Button>
            <Button
              onClick={() => switchToView('export')}
              className={`rounded-lg px-8 py-3 font-semibold text-sm transition-all ${
                state.activeView === 'export' 
                  ? 'bg-purple-600 text-white hover:bg-purple-700' 
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              }`}
            >
              <Download className="h-5 w-5 mr-2" />
              EXPORT
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading Status Bar for View Changes */}
      {state.isLoadingView && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-3">
                <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                <div className="text-blue-800 font-medium">
                  {state.activeView === 'detail' ? 'Preparing Data View...' : 'Loading View...'}
                </div>
              </div>
            </div>
            <div className="mt-3 w-full bg-blue-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div>
            </div>
            {state.activeView === 'detail' && (
              <div className="mt-2 text-center text-sm text-blue-600">
                Processing line item details...
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Comprehensive Loading Progress Bar for Full Dataset */}
      {state.loadingProgress.isVisible && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-center mb-4">
              <div className="flex items-center gap-3">
                <RefreshCw className="h-5 w-5 text-green-600 animate-spin" />
                <div className="text-green-800 font-semibold text-lg">
                  Loading Complete Dataset (~55k records)
                </div>
              </div>
            </div>
            
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-green-700">
                  {state.loadingProgress.currentOperationName}
                </span>
                <span className="text-sm text-green-600">
                  Operation {state.loadingProgress.currentOperation} of {state.loadingProgress.totalOperations}
                </span>
              </div>
              
              <div className="w-full bg-green-200 rounded-full h-4 mb-2">
                <div 
                  className="bg-green-600 h-4 rounded-full transition-all duration-500 ease-out" 
                  style={{ 
                    width: state.loadingProgress.totalOperations > 0 
                      ? `${(state.loadingProgress.currentOperation / state.loadingProgress.totalOperations) * 100}%` 
                      : '0%' 
                  }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-green-800 font-medium">Records Loaded</div>
                <div className="text-green-600">
                  {state.loadingProgress.actualRecordsLoaded.toLocaleString()} / {state.loadingProgress.totalEstimatedRecords.toLocaleString()}
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-green-800 font-medium">Time Elapsed</div>
                <div className="text-green-600">
                  {state.loadingProgress.startTime ? Math.round((Date.now() - state.loadingProgress.startTime) / 1000) : 0}s
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-green-800 font-medium">Estimated Remaining</div>
                <div className="text-green-600">
                  {state.loadingProgress.estimatedTimeRemaining}s
                </div>
              </div>
            </div>

            <div className="mt-4 text-xs text-green-600 text-center">
              This comprehensive load happens once per session and includes all stores, amendments, and organizational data
            </div>
          </CardContent>
        </Card>
      )}

      {/* Render all views with visibility control (component persistence) */}
      {!state.isLoadingView && (
        <>
          {/* Submission Tracking View - Always mounted, visibility controlled */}
          <div style={{ display: state.activeView === 'submission' ? 'block' : 'none' }}>
            <AdminSubmissionTracking />
          </div>

          {/* Summary View - Always mounted, visibility controlled */}
          <div style={{ display: state.activeView === 'summary' ? 'block' : 'none' }}>
            <AdminAmendmentInterface />
          </div>

          {/* Detail View - Always mounted, visibility controlled */}
          {state.adminInfo && state.selectedWeek && (
            <div 
              className="space-y-4" 
              style={{ display: state.activeView === 'detail' ? 'block' : 'none' }}
            >
              {(() => {
                console.log(`🔍 [DetailView Render] Rendering WeeklyPlanInterface with:`, {
                  isVisible: state.activeView === 'detail',
                  hasCurrentWeek: !!state.selectedWeek,
                  hasAdminInfo: !!state.adminInfo,
                  weekReference: state.selectedWeek?.week_reference,
                  adminInfoId: state.adminInfo?.id,
                  storeHierarchyCount: state.organizationalData.stores.length,
                  amendmentsCount: state.organizationalData.amendments.length,
                  timestamp: new Date().toISOString()
                });
                
                // Log the preloadedData structure
                console.log(`🔍 [DetailView Render] PreloadedData contents:`, {
                  currentWeekExists: !!preloadedData?.currentWeek,
                  areaManagerInfoExists: !!preloadedData?.areaManagerInfo,
                  storeHierarchyLength: preloadedData?.storeHierarchy.length || 0,
                  storesWithSubmissionsLength: preloadedData?.storesWithSubmissions.length || 0
                });
                
                if (!preloadedData) {
                  return <div>Loading detail view...</div>;
                }
                
                return (
                  <WeeklyPlanInterface
                    key="admin-detail-view-persistent"
                    userRole="admin"
                    title="Admin - Amendment Management Detail"
                    description="Review and manage weekly plan amendments across all regions and stores. Use the 'Amendments Only' filter to focus on items requiring approval."
                    allowedAmendmentTypes={['admin']}
                    hierarchyLevel="Admin"
                    adminWorkflow={true}
                    showSummaryTab={false}
                    enableRegionalFilter={true}
                    focusOnChangedItems={true}
                    preloadedData={preloadedData}
                  />
                );
              })()}
            </div>
          )}
          
          {/* Export View - Always mounted, visibility controlled */}
          <div style={{ display: state.activeView === 'export' ? 'block' : 'none' }}>
            <AmendmentExport />
          </div>
        </>
      )}
    </div>
  );
}