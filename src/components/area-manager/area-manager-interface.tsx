import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Building2, 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  Calendar,
  FileText,
  User,
  TrendingUp,
  RefreshCw,
  Package,
  Edit,
  Save,
  X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabaseAdmin } from '@/lib/supabase';
import { useAuth } from '@clerk/clerk-react';
import { ManagerLineItemDetail } from '@/components/shared/manager-line-item-detail';

interface WeeklyPlanItem {
  id?: string;
  stock_code: string;
  description: string;
  category: string;
  sub_category?: string;
  store_name: string;
  store_id?: string;
  reference: string;
  order_qty: number;
  add_ons_qty: number;
  qty_on_hand?: number;
  qty_in_transit?: number;
  qty_pending_orders?: number;
  model_stock_qty?: number;
  has_amendment?: boolean;
  amendment_data?: any;
}

interface WeekSelection {
  week_reference: string;
  week_start_date: string;
  week_end_date: string;
  is_current: boolean;
  is_active: boolean;
  week_status: string;
}

interface StoreHierarchy {
  store_id: string;
  store_code: string;
  store_name: string;
  region: string;
  store_active: boolean;
  store_status: string;
  store_manager_id: string;
  store_manager_first_name: string;
  store_manager_last_name: string;
  store_manager_email: string;
  store_manager_status: string;
  area_manager_id: string;
  area_manager_first_name: string;
  area_manager_last_name: string;
  area_manager_email: string;
  area_manager_status: string;
  regional_manager_id: string;
  regional_manager_first_name: string;
  regional_manager_last_name: string;
  regional_manager_email: string;
  regional_manager_status: string;
  effective_manager_id: string;
  effective_manager_level: string;
  effective_manager_email: string;
}

interface SubmissionStatus {
  store_id: string;
  week_reference: string;
  store_submission_status: string;
  area_submission_status: string;
  regional_submission_status: string;
  admin_submission_status: string;
  store_submitted_at: string;
  area_submitted_at: string;
  regional_submitted_at: string;
  admin_submitted_at: string;
  store_amendment_count: number;
  area_amendment_count: number;
  regional_amendment_count: number;
  admin_amendment_count: number;
  week_status: string;
}

interface StoreWithSubmissions extends StoreHierarchy {
  submission_status?: SubmissionStatus;
  total_amendments: number;
  has_store_submission: boolean;
  has_area_submission: boolean;
  has_regional_submission: boolean;
  weekly_plan_total_order_qty: number;
  weekly_plan_total_add_ons_qty: number;
  weekly_plan_total_qty: number;
  current_user_amendments: number;
  current_user_amendment_qty: number;
  current_user_pending_amendments: number;
  revised_total_qty: number;
}

interface AreaManagerInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  assigned_stores: string[];
}

interface SubmissionSummary {
  total_stores: number;
  stores_with_store_submission: number;
  stores_with_area_submission: number;
  stores_pending: number;
  total_amendments: number;
}

interface AreaManagerAmendmentSummary {
  total_amendment_qty: number;
  stores_with_changes: number;
  pending_amendments: number;
  total_amendments: number;
  approved_amendments: number;
  rejected_amendments: number;
}

export const AreaManagerInterface: React.FC = () => {
  const [currentWeek, setCurrentWeek] = useState<WeekSelection | null>(null);
  const [areaManagerInfo, setAreaManagerInfo] = useState<AreaManagerInfo | null>(null);
  const [storeHierarchy, setStoreHierarchy] = useState<StoreHierarchy[]>([]);
  const [storesWithSubmissions, setStoresWithSubmissions] = useState<StoreWithSubmissions[]>([]);
  const [summary, setSummary] = useState<SubmissionSummary>({
    total_stores: 0,
    stores_with_store_submission: 0,
    stores_with_area_submission: 0,
    stores_pending: 0,
    total_amendments: 0
  });
  const [areaManagerAmendments, setAreaManagerAmendments] = useState<AreaManagerAmendmentSummary>({
    total_amendment_qty: 0,
    stores_with_changes: 0,  
    pending_amendments: 0,
    total_amendments: 0,
    approved_amendments: 0,
    rejected_amendments: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeView, setActiveView] = useState<'summary' | 'amendments'>('summary');
  const [isLoadingAmendments, setIsLoadingAmendments] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0, isVisible: false });
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all');
  const [weeklyPlanData, setWeeklyPlanData] = useState<WeeklyPlanItem[]>([]);
  const { toast } = useToast();
  const { userId } = useAuth();

  // Cache for weekly plan data (30 minutes)
  const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  const weeklyPlanCache = new Map<string, { data: any; timestamp: number; expiry: number }>();

  // Load current week and area manager information
  const loadAreaManagerInfo = async () => {
    if (!userId) return;

    try {
      const { data: users, error: userError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('clerk_id', userId)
        .single();

      if (userError) throw userError;

      const supabaseUserId = users.id;

      // Get current active week
      const { data: weekData, error: weekError } = await supabaseAdmin
        .from('week_selections')
        .select('*')
        .eq('is_current', true)
        .eq('is_active', true)
        .single();

      if (weekError) {
        console.error('Error loading current week:', weekError);
        toast({
          title: 'Error',
          description: 'No active week found. Please contact admin.',
          variant: 'destructive'
        });
        return;
      }

      setCurrentWeek({
        week_reference: weekData.week_reference,
        week_start_date: weekData.week_start_date,
        week_end_date: weekData.week_end_date,
        is_current: weekData.is_current,
        is_active: weekData.is_active,
        week_status: weekData.week_status
      });

      // Get area manager info from hierarchy view
      const { data: hierarchyData, error: hierarchyError } = await supabaseAdmin
        .from('store_management_hierarchy')
        .select('*')
        .eq('area_manager_id', supabaseUserId);

      if (hierarchyError) throw hierarchyError;

      if (hierarchyData && hierarchyData.length > 0) {
        const firstStore = hierarchyData[0];
        const assignedStores = hierarchyData.map(h => h.store_id);

        setAreaManagerInfo({
          id: supabaseUserId,
          first_name: firstStore.area_manager_first_name,
          last_name: firstStore.area_manager_last_name,
          email: firstStore.area_manager_email,
          assigned_stores: assignedStores
        });
      }
    } catch (error) {
      console.error('Error loading area manager info:', error);
      toast({
        title: 'Error',
        description: 'Failed to load area manager information',
        variant: 'destructive'
      });
    }
  };

  // Cache helper functions
  const getCachedWeeklyPlan = (key: string) => {
    const cached = weeklyPlanCache.get(key);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }
    return null;
  };

  const setCachedWeeklyPlan = (key: string, data: any) => {
    weeklyPlanCache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + CACHE_DURATION
    });
  };

  // Load all weekly plan data for stores with pagination and caching
  const loadAllWeeklyPlanData = async (storeNames: string[], weekReference: string) => {
    // Check cache first
    const cacheKey = `weekly_plan_${weekReference}_${storeNames.join('_')}`;
    const cachedData = getCachedWeeklyPlan(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    try {
      // Show progress bar
      setLoadingProgress({ current: 0, total: 0, isVisible: true });

      let allData: any[] = [];
      let from = 0;
      const limit = 1000;
      let hasMore = true;
      let totalEstimated = 0;

      // First request to get an estimate of total records
      const { data: firstBatch, error: firstError, count } = await supabaseAdmin
        .from('weekly_plan')
        .select('store_name, order_qty, add_ons_qty', { count: 'estimated' })
        .eq('reference', weekReference)
        .in('store_name', storeNames)
        .range(0, limit - 1);

      if (firstError) {
        console.error('Error in first batch:', firstError);
        throw firstError;
      }

      if (firstBatch) {
        allData = firstBatch;
        totalEstimated = count || firstBatch.length;
        from = limit;
        hasMore = firstBatch.length === limit;

        // Update progress
        setLoadingProgress({ 
          current: allData.length, 
          total: Math.max(totalEstimated, allData.length),
          isVisible: true 
        });
      }

      // Continue fetching remaining batches
      while (hasMore) {
        const { data, error } = await supabaseAdmin
          .from('weekly_plan')
          .select('store_name, order_qty, add_ons_qty')
          .eq('reference', weekReference)
          .in('store_name', storeNames)
          .range(from, from + limit - 1);

        if (error) {
          console.error('Error in batch:', error);
          throw error;
        }

        if (data && data.length > 0) {
          allData = allData.concat(data);
          from += limit;
          hasMore = data.length === limit;

          // Update progress
          setLoadingProgress({ 
            current: allData.length, 
            total: Math.max(totalEstimated, allData.length),
            isVisible: true 
          });
        } else {
          hasMore = false;
        }
      }

      // Cache the data
      setCachedWeeklyPlan(cacheKey, allData);

      // Hide progress bar after a short delay
      setTimeout(() => {
        setLoadingProgress({ current: 0, total: 0, isVisible: false });
      }, 1000);

      return allData;
    } catch (error) {
      // Hide progress bar on error
      setLoadingProgress({ current: 0, total: 0, isVisible: false });
      throw error;
    }
  };

  // Load complete store hierarchy and submissions
  const loadStoreHierarchyAndSubmissions = async () => {
    if (!areaManagerInfo || !currentWeek) return;

    try {
      setIsLoading(true);

      // Get all store hierarchy data for this area manager
      const { data: hierarchy, error: hierarchyError } = await supabaseAdmin
        .from('store_management_hierarchy')
        .select('*')
        .eq('area_manager_id', areaManagerInfo.id);

      if (hierarchyError) throw hierarchyError;

      setStoreHierarchy(hierarchy || []);

      // Get submission status for all stores under this area manager
      const storeIds = hierarchy?.map(h => h.store_id) || [];
      const storeNames = hierarchy?.map(h => h.store_name) || [];
      
      const { data: submissions, error: submissionError } = await supabaseAdmin
        .from('weekly_plan_submissions')
        .select('*')
        .eq('week_reference', currentWeek.week_reference)
        .in('store_id', storeIds);

      if (submissionError) throw submissionError;

      // Get weekly plan totals for all stores
      const weeklyPlanData = await loadAllWeeklyPlanData(storeNames, currentWeek.week_reference);

      // Get current user's amendments by store (including status for pending logic)
      const { data: currentUserAmendments, error: amendmentError } = await supabaseAdmin
        .from('weekly_plan_amendments')
        .select('store_id, amended_qty, status')
        .eq('week_reference', currentWeek.week_reference)
        .eq('user_id', areaManagerInfo.id)
        .in('store_id', storeIds);

      if (amendmentError) {
        console.warn('Error loading current user amendments:', amendmentError);
      }

      // Create amendments map for current user
      const currentUserAmendmentsMap = new Map<string, { count: number; total_qty: number; pending_count: number; approved_count: number; rejected_count: number }>();
      (currentUserAmendments || []).forEach(amendment => {
        const existing = currentUserAmendmentsMap.get(amendment.store_id) || { count: 0, total_qty: 0, pending_count: 0, approved_count: 0, rejected_count: 0 };
        existing.count += 1;
        existing.total_qty += amendment.amended_qty || 0;
        if (amendment.status === 'pending' || amendment.status === 'draft') {
          existing.pending_count += 1;
        } else if (amendment.status === 'admin_approved') {
          existing.approved_count += 1;
        } else if (amendment.status === 'admin_rejected') {
          existing.rejected_count += 1;
        }
        currentUserAmendmentsMap.set(amendment.store_id, existing);
      });

      // Create submission map for easy lookup
      const submissionMap = new Map<string, SubmissionStatus>();
      (submissions || []).forEach(sub => {
        submissionMap.set(sub.store_id, {
          store_id: sub.store_id,
          week_reference: sub.week_reference,
          store_submission_status: sub.store_submission_status,
          area_submission_status: sub.area_submission_status,
          regional_submission_status: sub.regional_submission_status,
          admin_submission_status: sub.admin_submission_status,
          store_submitted_at: sub.store_submitted_at,
          area_submitted_at: sub.area_submitted_at,
          regional_submitted_at: sub.regional_submitted_at,
          admin_submitted_at: sub.admin_submitted_at,
          store_amendment_count: sub.store_amendment_count,
          area_amendment_count: sub.area_amendment_count,
          regional_amendment_count: sub.regional_amendment_count,
          admin_amendment_count: sub.admin_amendment_count,
          week_status: sub.week_status
        });
      });

      // Create weekly plan totals map for easy lookup
      const weeklyPlanTotalsMap = new Map<string, { order_qty: number; add_ons_qty: number; total_qty: number }>();
      (weeklyPlanData || []).forEach(plan => {
        const currentTotal = weeklyPlanTotalsMap.get(plan.store_name) || { order_qty: 0, add_ons_qty: 0, total_qty: 0 };
        currentTotal.order_qty += plan.order_qty || 0;
        currentTotal.add_ons_qty += plan.add_ons_qty || 0;
        currentTotal.total_qty += (plan.order_qty || 0) + (plan.add_ons_qty || 0);
        weeklyPlanTotalsMap.set(plan.store_name, currentTotal);
      });

      // Combine hierarchy with submission data
      const storesWithSubmissions: StoreWithSubmissions[] = (hierarchy || []).map(store => {
        const submission = submissionMap.get(store.store_id);
        const totalAmendments = submission ? 
          submission.store_amendment_count + submission.area_amendment_count + 
          submission.regional_amendment_count + submission.admin_amendment_count : 0;

        const weeklyPlanTotals = weeklyPlanTotalsMap.get(store.store_name) || { order_qty: 0, add_ons_qty: 0, total_qty: 0 };
        const currentUserAmendmentData = currentUserAmendmentsMap.get(store.store_id) || { count: 0, total_qty: 0, pending_count: 0 };
        const revisedTotalQty = weeklyPlanTotals.total_qty + currentUserAmendmentData.total_qty;

        // Check for submissions using both old and new structure
        const hasStoreSubmission = submission?.store_submission_status === 'submitted' || 
          submissions?.some(s => s.store_id === store.store_id && s.level === 'store' && s.is_current);
        const hasAreaSubmission = submission?.area_submission_status === 'submitted' || 
          submissions?.some(s => s.store_id === store.store_id && s.level === 'area' && s.is_current);
        const hasRegionalSubmission = submission?.regional_submission_status === 'submitted' || 
          submissions?.some(s => s.store_id === store.store_id && s.level === 'regional' && s.is_current);

        return {
          ...store,
          submission_status: submission,
          total_amendments: totalAmendments,
          has_store_submission: hasStoreSubmission,
          has_area_submission: hasAreaSubmission,
          has_regional_submission: hasRegionalSubmission,
          weekly_plan_total_order_qty: weeklyPlanTotals.order_qty,
          weekly_plan_total_add_ons_qty: weeklyPlanTotals.add_ons_qty,
          weekly_plan_total_qty: weeklyPlanTotals.total_qty,
          current_user_amendments: currentUserAmendmentData.count,
          current_user_amendment_qty: currentUserAmendmentData.total_qty,
          current_user_pending_amendments: currentUserAmendmentData.pending_count,
          revised_total_qty: revisedTotalQty
        };
      });

      setStoresWithSubmissions(storesWithSubmissions);
      calculateSummary(storesWithSubmissions);
      await calculateAreaManagerAmendments(storesWithSubmissions);
      
      // Load weekly plan data for detail view
      await loadWeeklyPlanDataForDetail(storeNames, currentWeek.week_reference);
    } catch (error) {
      console.error('Error loading store hierarchy and submissions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load store data',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load weekly plan data for detail view
  const loadWeeklyPlanDataForDetail = async (storeNames: string[], weekReference: string) => {
    try {
      console.log(`📊 [AreaManager] Loading weekly plan data for detail view: ${storeNames.length} stores`);
      
      let allData: WeeklyPlanItem[] = [];
      let from = 0;
      const limit = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabaseAdmin
          .from('weekly_plan')
          .select(`
            id, stock_code, description, category, sub_category,
            store_name, reference, order_qty, add_ons_qty,
            qty_on_hand, qty_in_transit, qty_pending_orders, model_stock_qty
          `)
          .eq('reference', weekReference)
          .in('store_name', storeNames)
          .range(from, from + limit - 1);
          
        if (error) {
          console.error('Error loading weekly plan data:', error);
          throw error;
        }
        
        if (data && data.length > 0) {
          allData = allData.concat(data.map(item => ({
            ...item,
            has_amendment: false,
            amendment_data: null
          })));
          from += limit;
          hasMore = data.length === limit;
        } else {
          hasMore = false;
        }
      }
      
      // Load amendments for these items (from all users)
      if (allData.length > 0) {
        const storeIds = storesWithSubmissions.map(s => s.store_id);
        const { data: amendments, error: amendmentError } = await supabaseAdmin
          .from('weekly_plan_amendments')
          .select('*')
          .eq('week_reference', weekReference)
          .in('store_id', storeIds);
          
        console.log(`📊 [AreaManager] Loaded ${amendments?.length || 0} amendments for ${storeIds.length} stores`);
          
        if (amendmentError) {
          console.warn('Error loading amendments:', amendmentError);
        } else if (amendments) {
          // Create amendment map for faster lookup
          const amendmentMap = new Map();
          amendments.forEach(amendment => {
            const key = `${amendment.stock_code}_${amendment.store_id}`;
            amendmentMap.set(key, amendment);
          });
          
          // Apply amendments to weekly plan data
          let amendedItemsCount = 0;
          allData = allData.map(item => {
            const store = storesWithSubmissions.find(s => s.store_name === item.store_name);
            if (store) {
              const key = `${item.stock_code}_${store.store_id}`;
              const amendment = amendmentMap.get(key);
              if (amendment) {
                amendedItemsCount++;
                return {
                  ...item,
                  has_amendment: true,
                  amendment_data: amendment
                };
              }
            }
            return item;
          });
          
          console.log(`📊 [AreaManager] Applied amendments to ${amendedItemsCount} items out of ${allData.length} total items`);
        }
      }
      
      console.log(`✅ [AreaManager] Loaded ${allData.length} weekly plan items for detail view`);
      setWeeklyPlanData(allData);
    } catch (error) {
      console.error('Error loading weekly plan data for detail:', error);
      toast({
        title: 'Error',
        description: 'Failed to load weekly plan data for detail view',
        variant: 'destructive'
      });
    }
  };

  // Update local amendment data without full refresh
  const updateLocalAmendmentData = (savedAmendment: any) => {
    console.log('🔄 [AreaManager] Updating local amendment data:', savedAmendment);
    
    // Update the weeklyPlanData to reflect the new/updated amendment
    setWeeklyPlanData(prevData => {
      return prevData.map(item => {
        const store = storesWithSubmissions.find(s => s.store_id === savedAmendment.store_id);
        if (item.stock_code === savedAmendment.stock_code && 
            item.store_name === store?.store_name) {
          return {
            ...item,
            has_amendment: true,
            amendment_data: savedAmendment
          };
        }
        return item;
      });
    });
    
    // Update the store submissions data to reflect new amendment counts
    setStoresWithSubmissions(prevStores => {
      return prevStores.map(store => {
        if (store.store_id === savedAmendment.store_id) {
          const storeItems = weeklyPlanData.filter(item => item.store_name === store.store_name);
          const amendedItems = storeItems.filter(item => 
            item.has_amendment || (item.stock_code === savedAmendment.stock_code)
          );
          
          return {
            ...store,
            total_amendments: amendedItems.length,
            current_user_amendments: amendedItems.length,
            current_user_amendment_qty: store.current_user_amendment_qty + (savedAmendment.amended_qty || 0),
            revised_total_qty: store.weekly_plan_total_qty + store.current_user_amendment_qty + (savedAmendment.amended_qty || 0)
          };
        }
        return store;
      });
    });
  };

  // Calculate summary statistics
  const calculateSummary = (storesWithSubmissions: StoreWithSubmissions[]) => {
    const totalAmendments = storesWithSubmissions.reduce((sum, store) => sum + store.total_amendments, 0);

    setSummary({
      total_stores: storesWithSubmissions.length,
      stores_with_store_submission: storesWithSubmissions.filter(s => s.has_store_submission).length,
      stores_with_area_submission: storesWithSubmissions.filter(s => s.has_area_submission).length,
      stores_pending: storesWithSubmissions.filter(s => !s.has_store_submission && !s.has_area_submission).length,
      total_amendments: totalAmendments
    });
  };

  // Calculate area manager amendment statistics
  const calculateAreaManagerAmendments = async (storesWithSubmissions: StoreWithSubmissions[]) => {
    const totalAmendmentQty = storesWithSubmissions.reduce((sum, store) => sum + store.current_user_amendment_qty, 0);
    const storesWithChanges = storesWithSubmissions.filter(s => s.current_user_amendments > 0).length;
    const pendingAmendments = storesWithSubmissions.reduce((sum, store) => sum + store.current_user_pending_amendments, 0);
    const totalAmendments = storesWithSubmissions.reduce((sum, store) => sum + store.current_user_amendments, 0);

    // Get all amendments for current week to calculate approved/rejected counts
    let approvedAmendments = 0;
    let rejectedAmendments = 0;
    
    try {
      if (currentWeek && areaManagerInfo) {
        // Get store IDs from the area manager's assigned stores
        const storeIds = storesWithSubmissions.map(store => store.store_id);

        if (storeIds.length > 0) {
          const { data: amendments, error } = await supabaseAdmin
            .from('weekly_plan_amendments')
            .select('status')
            .eq('week_reference', currentWeek.week_reference)
            .in('store_id', storeIds);

          if (!error && amendments) {
            approvedAmendments = amendments.filter(a => 
              a.status === 'approved' || a.status === 'admin_approved'
            ).length;
            rejectedAmendments = amendments.filter(a => 
              a.status === 'rejected' || a.status === 'admin_rejected'
            ).length;
          }
        }
      }
    } catch (error) {
      console.warn('Error calculating amendment status counts:', error);
    }

    setAreaManagerAmendments({
      total_amendment_qty: totalAmendmentQty,
      stores_with_changes: storesWithChanges,
      pending_amendments: pendingAmendments,
      total_amendments: totalAmendments,
      approved_amendments: approvedAmendments,
      rejected_amendments: rejectedAmendments
    });
  };

  // Calculate filtered summary for display
  const getFilteredSummary = () => {
    const filteredStores = selectedStoreFilter === 'all' 
      ? storesWithSubmissions 
      : storesWithSubmissions.filter(store => store.store_id === selectedStoreFilter);
    
    const totalAmendments = filteredStores.reduce((sum, store) => sum + store.total_amendments, 0);

    return {
      total_stores: filteredStores.length,
      stores_with_store_submission: filteredStores.filter(s => s.has_store_submission).length,
      stores_with_area_submission: filteredStores.filter(s => s.has_area_submission).length,
      stores_pending: filteredStores.filter(s => !s.has_store_submission && !s.has_area_submission).length,
      total_amendments: totalAmendments
    };
  };

  // Handle single store submission
  const handleSubmitSingleStore = async (storeId: string) => {
    if (!areaManagerInfo || !currentWeek) return;

    try {
      setIsSubmitting(true);

      const { error: hierarchicalError } = await supabaseAdmin
        .rpc('update_hierarchical_submission_status', {
          p_store_id: storeId,
          p_week_reference: currentWeek.week_reference,
          p_level: 'area',
          p_status: 'submitted',
          p_manager_id: areaManagerInfo.id,
          p_amendment_items: {} // Empty object for now, will contain actual amendments later
        });

      if (hierarchicalError) {
        console.error('Error updating hierarchical submission status:', hierarchicalError);
        throw hierarchicalError;
      }

      toast({
        title: 'Success',
        description: 'Store submission approved successfully',
      });

      // Reload data
      await loadStoreHierarchyAndSubmissions();
    } catch (error) {
      console.error('Error submitting single store:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit store',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle submission approval
  const handleSubmitAllAmendments = async () => {
    if (!areaManagerInfo || !currentWeek) return;

    try {
      setIsSubmitting(true);

      // Get all stores that haven't been approved by area manager yet
      const storesToSubmit = storesWithSubmissions.filter(
        s => !s.has_area_submission
      );

      if (storesToSubmit.length === 0) {
        toast({
          title: 'No Stores to Submit',
          description: 'All stores have already been submitted by area manager',
        });
        return;
      }

      // Update hierarchical submission status for area level for all stores
      const storeIds = storesToSubmit.map(s => s.store_id);
      
      let successCount = 0;
      for (const storeId of storeIds) {
        const { error: hierarchicalError } = await supabaseAdmin
          .rpc('update_hierarchical_submission_status', {
            p_store_id: storeId,
            p_week_reference: currentWeek.week_reference,
            p_level: 'area',
            p_status: 'submitted',
            p_manager_id: areaManagerInfo.id,
            p_amendment_items: {} // Empty object for now, will contain actual amendments later
          });

        if (hierarchicalError) {
          console.error('Error updating hierarchical submission status:', hierarchicalError);
          // Don't throw, just log the error and continue with other stores
        } else {
          successCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: 'Success',
          description: `Successfully submitted ${successCount} store${successCount > 1 ? 's' : ''} for area manager approval`,
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to submit any stores',
          variant: 'destructive'
        });
      }

      // Reload data
      await loadStoreHierarchyAndSubmissions();
    } catch (error) {
      console.error('Error submitting all stores:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit all stores',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get submission level badge
  const getSubmissionLevelBadge = (store: StoreWithSubmissions) => {
    if (store.has_area_submission) {
      return <Badge variant="default" className="bg-blue-500"><CheckCircle className="h-3 w-3 mr-1" />Area Submitted</Badge>;
    }
    if (store.has_store_submission) {
      return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Store Submitted</Badge>;
    }
    return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />No Submission</Badge>;
  };

  // Load data on mount
  useEffect(() => {
    loadAreaManagerInfo();
  }, [userId]);

  useEffect(() => {
    if (areaManagerInfo && currentWeek) {
      loadStoreHierarchyAndSubmissions();
    }
  }, [areaManagerInfo, currentWeek]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 text-gray-400 mx-auto mb-4 animate-spin" />
          <p className="text-muted-foreground">Loading area manager information...</p>
        </div>
      </div>
    );
  }

  if (!areaManagerInfo) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Area Manager Access Required</h3>
          <p className="text-muted-foreground">You need to be assigned as an Area Manager to access this interface.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Area Manager Dashboard</h1>
          <p className="text-muted-foreground mb-3">
            Welcome, {areaManagerInfo.first_name} {areaManagerInfo.last_name}
          </p>
          {currentWeek && (
            <div className="flex items-center gap-4 mb-4">
              <Badge variant="default" className="bg-green-100 text-green-800">
                {currentWeek.week_reference}
              </Badge>
              <div className="text-sm text-muted-foreground">
                {new Date(currentWeek.week_start_date).toLocaleDateString()} - {new Date(currentWeek.week_end_date).toLocaleDateString()}
              </div>
              <Badge variant="outline" className="border-green-500 text-green-600">
                {currentWeek.week_status === 'open' ? 'Open for Submissions' : 'Closed'}
              </Badge>
            </div>
          )}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-500" />
              <span className="text-muted-foreground">Your Changes:</span>
              <Badge variant="outline" className="border-blue-500 text-blue-600">
                {areaManagerAmendments.total_amendments} amendments
              </Badge>
              <span className="text-muted-foreground">
                ({areaManagerAmendments.total_amendment_qty > 0 ? '+' : ''}{areaManagerAmendments.total_amendment_qty} qty)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">Stores with Changes:</span>
              <Badge variant="outline" className="border-green-500 text-green-600">
                {areaManagerAmendments.stores_with_changes} of {summary.total_stores}
              </Badge>
            </div>
            {areaManagerAmendments.pending_amendments > 0 && (
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <span className="text-muted-foreground">Pending:</span>
                <Badge variant="outline" className="border-orange-500 text-orange-600">
                  {areaManagerAmendments.pending_amendments} changes
                </Badge>
              </div>
            )}
          </div>
        </div>
        <Button onClick={() => { loadStoreHierarchyAndSubmissions(); }} variant="outline" disabled={isLoading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Navigation - Badge-Style Buttons */}
      <Card>
        <CardContent className="p-6">
          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => setActiveView('summary')}
              className={`rounded-lg px-8 py-3 font-semibold text-sm transition-all ${
                activeView === 'summary' 
                  ? 'bg-green-600 text-white hover:bg-green-700' 
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              <TrendingUp className="h-5 w-5 mr-2" />
              SUMMARY VIEW
            </Button>
            <Button
              onClick={() => {
                setIsLoadingAmendments(true);
                setTimeout(() => {
                  setActiveView('amendments');
                  setIsLoadingAmendments(false);
                }, 200);
              }}
              className={`rounded-lg px-8 py-3 font-semibold text-sm transition-all ${
                activeView === 'amendments' 
                  ? 'bg-amber-600 text-white hover:bg-amber-700' 
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              }`}
            >
              <Edit className="h-5 w-5 mr-2" />
              DETAILED VIEW
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading Progress Bar for Weekly Plan Data */}
      {loadingProgress.isVisible && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <RefreshCw className="h-4 w-4 text-green-600 animate-spin" />
                <div className="text-green-800 font-medium">Loading Weekly Plan Data...</div>
              </div>
              <div className="text-sm text-green-700">
                {loadingProgress.current.toLocaleString()} of {loadingProgress.total.toLocaleString()} records
              </div>
            </div>
            <div className="w-full bg-green-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${loadingProgress.total > 0 ? (loadingProgress.current / loadingProgress.total) * 100 : 0}%` 
                }}
              ></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading Status Bar for Amendments Detail */}
      {isLoadingAmendments && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-3">
                <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                <div className="text-blue-800 font-medium">Loading Amendments Detail...</div>
              </div>
            </div>
            <div className="mt-3 w-full bg-blue-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Render appropriate view */}
      {!isLoadingAmendments && activeView === 'summary' ? (
        <div className="space-y-6">


          {/* Store Filter */}
          {storesWithSubmissions.length > 1 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">Filter by Store:</span>
                    <Select value={selectedStoreFilter} onValueChange={setSelectedStoreFilter}>
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder="Select store to filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Stores</SelectItem>
                        {storesWithSubmissions.map((store) => (
                          <SelectItem key={store.store_id} value={store.store_id}>
                            {store.store_name} ({store.store_code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedStoreFilter !== 'all' && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSelectedStoreFilter('all')}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Clear Filter
                      </Button>
                    )}
                  </div>
                  <Button 
                    onClick={handleSubmitAllAmendments} 
                    disabled={isSubmitting || !currentWeek}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {isSubmitting ? 'Submitting...' : 'Submit All Stores'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submit All Stores Button - when no filter card is shown */}
          {storesWithSubmissions.length <= 1 && storesWithSubmissions.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Actions:</span>
                  <Button 
                    onClick={handleSubmitAllAmendments} 
                    disabled={isSubmitting || !currentWeek}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {isSubmitting ? 'Submitting...' : 'Submit All Stores'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Store Submissions Table */}
          <Card>
            <CardHeader>
              <CardTitle>
                Store Submissions Overview
                {selectedStoreFilter !== 'all' && (
                  <Badge variant="outline" className="ml-2">
                    Filtered: {storesWithSubmissions.find(s => s.store_id === selectedStoreFilter)?.store_name}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store</TableHead>
                    <TableHead>Store Manager</TableHead>
                    <TableHead>Submission Status</TableHead>
                    <TableHead>Original Qty</TableHead>
                    <TableHead>Add-ons</TableHead>
                    <TableHead>Your Changes</TableHead>
                    <TableHead>Total Qty</TableHead>
                    <TableHead>Revised Total</TableHead>
                    <TableHead>Current Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {storesWithSubmissions
                    .filter(store => selectedStoreFilter === 'all' || store.store_id === selectedStoreFilter)
                    .map((store) => (
                    <TableRow key={store.store_id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{store.store_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {store.store_code} • {store.region}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm">
                            {store.store_manager_first_name && store.store_manager_last_name ? 
                              `${store.store_manager_first_name} ${store.store_manager_last_name}` : 'Unknown'}
                          </div>
                          <div className="text-xs text-muted-foreground">{store.store_manager_email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getSubmissionLevelBadge(store)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {store.weekly_plan_total_order_qty}
                        </div>
                      </TableCell>
                      <TableCell>
                        {store.total_amendments > 0 ? (
                          <Badge variant="outline" className="border-orange-500 text-orange-600">
                            {store.total_amendments}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-center">
                          {store.current_user_amendments > 0 ? (
                            <div>
                              <Badge variant="outline" className="border-blue-500 text-blue-600">
                                {store.current_user_amendments} Changes
                              </Badge>
                              {store.current_user_amendment_qty !== 0 && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {store.current_user_amendment_qty > 0 ? '+' : ''}{store.current_user_amendment_qty}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-blue-600">
                          {store.weekly_plan_total_qty}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {store.current_user_amendment_qty !== 0 ? (
                            <div>
                              <div className="text-green-600 font-semibold">
                                {store.revised_total_qty}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ({store.current_user_amendment_qty > 0 ? '+' : ''}{store.current_user_amendment_qty})
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">{store.weekly_plan_total_qty}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-center">
                          {store.current_user_pending_amendments > 0 ? (
                            <Badge variant="outline" className="border-orange-500 text-orange-600">
                              {store.current_user_pending_amendments} Pending
                            </Badge>
                          ) : store.current_user_amendments > 0 ? (
                            <Badge variant="outline" className="border-green-500 text-green-600">
                              Changes Saved
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">No Change</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {store.has_area_submission ? (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Submitted
                          </Badge>
                        ) : store.current_user_pending_amendments > 0 ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSubmitSingleStore(store.store_id)}
                            disabled={isSubmitting}
                            className="h-8 border-orange-500 text-orange-600 hover:bg-orange-50"
                          >
                            <Save className="h-3 w-3 mr-1" />
                            Submit Store
                          </Button>
                        ) : store.has_store_submission ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSubmitSingleStore(store.store_id)}
                            disabled={isSubmitting}
                            className="h-8 border-blue-500 text-blue-600 hover:bg-blue-50"
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Approve Store
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSubmitSingleStore(store.store_id)}
                            disabled={isSubmitting}
                            className="h-8 border-gray-500 text-gray-600 hover:bg-gray-50"
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Submit Store
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>


          {storesWithSubmissions.filter(store => selectedStoreFilter === 'all' || store.store_id === selectedStoreFilter).length === 0 && !isLoading && currentWeek && (
            <Card>
              <CardContent className="p-8">
                <div className="text-center">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {selectedStoreFilter === 'all' ? 'No Stores Found' : 'No Matching Stores'}
                  </h3>
                  <p className="text-muted-foreground">
                    {selectedStoreFilter === 'all' 
                      ? `No stores assigned to this area manager for the current week (${currentWeek.week_reference})`
                      : 'The selected store filter returned no results'
                    }
                  </p>
                  {selectedStoreFilter !== 'all' && (
                    <Button 
                      variant="outline" 
                      className="mt-4" 
                      onClick={() => setSelectedStoreFilter('all')}
                    >
                      Show All Stores
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : !isLoadingAmendments && areaManagerInfo && currentWeek ? (
        <ManagerLineItemDetail
          title="Area Manager - Weekly Plan Details"
          managerInfo={{
            id: areaManagerInfo.id,
            first_name: areaManagerInfo.first_name,
            last_name: areaManagerInfo.last_name,
            email: areaManagerInfo.email,
            assigned_stores: areaManagerInfo.assigned_stores
          }}
          currentWeek={currentWeek}
          storesWithSubmissions={storesWithSubmissions}
          weeklyPlanData={weeklyPlanData}
          managerRole="area_manager"
          onAmendmentSave={updateLocalAmendmentData}
          onRefresh={loadStoreHierarchyAndSubmissions}
        />
      ) : null}
    </div>
  );
};

export default AreaManagerInterface;