import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
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
  X,
  Eye
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@clerk/clerk-react';
import { ManagerLineItemDetail } from '@/components/shared/manager-line-item-detail';
import { useRoleBasedDataLoading } from '@/hooks/use-role-based-data-loading';
import { supabaseAdmin } from '@/lib/supabase';

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

interface StoreWithSubmissions {
  store_id: string;
  store_code: string;
  store_name: string;
  region: string;
  store_active: boolean;
  store_status: string;
  submission_status?: {
    has_store_submission: boolean;
    has_area_submission: boolean;
    has_regional_submission: boolean;
    submission_date?: string;
    status: 'pending' | 'submitted' | 'approved' | 'rejected';
  };
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

export const AreaManagerInterfaceV2: React.FC = () => {
  // Current view state - maintain existing UI structure
  const [currentView, setCurrentView] = useState<'submission' | 'detail'>('submission');
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all');
  const [weekSelections, setWeekSelections] = useState<WeekSelection[]>([]);
  const [currentWeek, setCurrentWeek] = useState<WeekSelection | null>(null);
  const [storesWithSubmissions, setStoresWithSubmissions] = useState<StoreWithSubmissions[]>([]);
  const [weeklyPlanData, setWeeklyPlanData] = useState<WeeklyPlanItem[]>([]);
  
  const { toast } = useToast();
  const { userId } = useAuth();

  // Get user ID from Clerk for role-based data loading
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);

  // Use the new shared role-based data loading hook
  const {
    isLoading: isDataLoadingFromService,
    loadingProgress,
    error: dataLoadingError,
    isDataLoaded,
    selectedWeek,
    userInfo,
    organizationalData,
    preloadedData,
    reload: reloadData
  } = useRoleBasedDataLoading(
    'area_manager',
    supabaseUserId || '',
    currentWeek?.week_reference || ''
  );

  // Get Supabase user ID from Clerk user ID
  useEffect(() => {
    const getUserId = async () => {
      if (!userId) return;
      
      try {
        const { supabaseAdmin } = await import('@/lib/supabase');
        const { data: userData, error } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('clerk_id', userId)
          .single();

        if (error || !userData) {
          throw new Error('User not found in database');
        }

        setSupabaseUserId(userData.id);
      } catch (error) {
        console.error('Error getting user ID:', error);
        toast({
          title: 'Authentication Error',
          description: 'Unable to verify user credentials',
          variant: 'destructive'
        });
      }
    };

    getUserId();
  }, [userId]);

  // Load week selections
  useEffect(() => {
    const loadWeekSelections = async () => {
      try {
        const { supabaseAdmin } = await import('@/lib/supabase');
        const { data, error } = await supabaseAdmin
          .from('week_selections')
          .select('*')
          .eq('is_active', true)
          .order('week_start_date', { ascending: false });

        if (error) throw error;

        setWeekSelections(data || []);
        
        // Set current week
        const current = data?.find(w => w.is_current) || data?.[0];
        if (current) {
          setCurrentWeek(current);
        }
      } catch (error) {
        console.error('Error loading weeks:', error);
        toast({
          title: 'Error',
          description: 'Failed to load week selections',
          variant: 'destructive'
        });
      }
    };

    loadWeekSelections();
  }, []);

  // Process stores data when organizational data is loaded
  useEffect(() => {
    if (isDataLoaded && organizationalData.stores) {
      console.log(`📊 [AreaManagerV2] PROCESSING DATA SUMMARY:`);
      console.log(`   - Total stores from hierarchy: ${organizationalData.stores.length}`);
      console.log(`   - Total combined plan items: ${organizationalData.amendments.length}`);
      
      // Debug: Check if organizational data has the complete store dataset
      if (organizationalData.completeStoreData) {
        console.log(`   - Complete store data available: ${organizationalData.completeStoreData.length} stores`);
        const storesWithPlanData = organizationalData.completeStoreData.filter(s => s.hasWeeklyPlanData);
        console.log(`   - Stores with weekly plan data: ${storesWithPlanData.length}`);
        console.log(`   - Stores without weekly plan data: ${organizationalData.completeStoreData.length - storesWithPlanData.length}`);
      }
      
      const processedStores: StoreWithSubmissions[] = organizationalData.stores.map(store => {
        // Calculate metrics from weekly plan data - filter by store_name since some items might not have store_id
        const storeWeeklyPlanItems = organizationalData.amendments.filter(item => 
          item.store_name === store.store_name
        );
        
        const storeAmendments = storeWeeklyPlanItems.filter(item => item.has_amendment);
        
        const totalOrderQty = storeWeeklyPlanItems
          .reduce((sum, item) => sum + (item.order_qty || 0), 0);
          
        const totalAddOnsQty = storeWeeklyPlanItems
          .reduce((sum, item) => sum + (item.add_ons_qty || 0), 0);

        const totalAmendmentQty = storeAmendments
          .reduce((sum, item) => sum + (item.amendment_data?.amended_qty || 0), 0);
          
        console.log(`📊 [AreaManagerV2] Store ${store.store_name}: ${storeWeeklyPlanItems.length} plan items, ${storeAmendments.length} amendments`);

        return {
          ...store,
          submission_status: {
            has_store_submission: false, // Will be updated with actual submission data
            has_area_submission: false,
            has_regional_submission: false,
            status: 'pending' as const
          },
          total_amendments: storeAmendments.length,
          has_store_submission: false,
          has_area_submission: false, 
          has_regional_submission: false,
          weekly_plan_total_order_qty: totalOrderQty,
          weekly_plan_total_add_ons_qty: totalAddOnsQty,
          weekly_plan_total_qty: totalOrderQty + totalAddOnsQty,
          current_user_amendments: storeAmendments.length,
          current_user_amendment_qty: totalAmendmentQty,
          current_user_pending_amendments: storeAmendments.filter(a => 
            a.amendment_data?.status === 'pending'
          ).length,
          revised_total_qty: totalOrderQty + totalAddOnsQty + totalAmendmentQty
        };
      });

      console.log(`✅ [AreaManagerV2] FINAL PROCESSING RESULTS:`);
      console.log(`   - Total processed stores: ${processedStores.length}`);
      console.log(`   - Stores with plan data: ${processedStores.filter(s => s.weekly_plan_total_qty > 0).length}`);
      console.log(`   - Stores with amendments: ${processedStores.filter(s => s.total_amendments > 0).length}`);
      
      // Debug: Show all stores and their data status
      console.log(`📋 [AreaManagerV2] All processed stores:`);
      processedStores.forEach(store => {
        const hasData = store.weekly_plan_total_qty > 0;
        const hasAmendments = store.total_amendments > 0;
        console.log(`   - ${store.store_name} (${store.store_code}): ${hasData ? '✅' : '❌'} data, ${hasAmendments ? store.total_amendments : 0} amendments`);
      });
      
      setStoresWithSubmissions(processedStores);
      
      // Also set the weekly plan data for detail view
      if (organizationalData.amendments) {
        const weeklyPlanItems: WeeklyPlanItem[] = organizationalData.amendments.map(item => ({
          id: item.id,
          stock_code: item.stock_code,
          description: item.description,
          category: item.category,
          sub_category: item.sub_category,
          store_name: item.store_name,
          store_id: item.store_id,
          reference: item.reference,
          order_qty: item.order_qty,
          add_ons_qty: item.add_ons_qty,
          qty_on_hand: item.qty_on_hand,
          qty_in_transit: item.qty_in_transit,
          qty_pending_orders: item.qty_pending_orders,
          model_stock_qty: item.model_stock_qty,
          has_amendment: item.has_amendment,
          amendment_data: item.amendment_data
        }));
        
        // Debug: Check amendment data in Area Manager
        const itemsWithAmendments = weeklyPlanItems.filter(item => item.has_amendment);
        console.log(`📊 [AreaManagerV2] Setting weekly plan data: ${weeklyPlanItems.length} total items, ${itemsWithAmendments.length} with amendments`);
        if (itemsWithAmendments.length > 0) {
          console.log(`📋 [AreaManagerV2] Sample amended items:`, itemsWithAmendments.slice(0, 3).map(item => ({
            store: item.store_name,
            stock_code: item.stock_code,
            has_amendment: item.has_amendment,
            amended_qty: item.amendment_data?.amended_qty
          })));
        }
        
        setWeeklyPlanData(weeklyPlanItems);
      }
    }
  }, [isDataLoaded, organizationalData]);

  // Handle view switching
  const handleViewSwitch = (view: 'submission' | 'detail') => {
    console.log(`🔍 [AreaManagerV2] Switching view from '${currentView}' to '${view}'`);
    setCurrentView(view);
  };

  // Handle week selection change
  const handleWeekChange = (weekReference: string) => {
    const selectedWeek = weekSelections.find(w => w.week_reference === weekReference);
    if (selectedWeek) {
      setCurrentWeek(selectedWeek);
    }
  };

  // Render loading progress (same as admin)
  const renderLoadingProgress = () => {
    if (!isDataLoadingFromService) return null;

    const progressPercentage = loadingProgress.total > 0 
      ? (loadingProgress.completed / loadingProgress.total) * 100 
      : 0;

    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading Area Manager Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{loadingProgress.currentOperation}</span>
              <span>{loadingProgress.completed}/{loadingProgress.total}</span>
            </div>
            <Progress value={progressPercentage} className="w-full" />
          </div>
          
          {loadingProgress.actualRecordsLoaded > 0 && (
            <div className="text-sm text-muted-foreground">
              📊 Loaded {loadingProgress.actualRecordsLoaded.toLocaleString()} records
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render error state
  if (dataLoadingError) {
    return (
      <div className="container mx-auto p-4">
        <Card className="w-full max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Error Loading Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{dataLoadingError}</p>
            <Button onClick={reloadData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render loading state
  if (isDataLoadingFromService || !currentWeek) {
    return (
      <div className="container mx-auto p-4 space-y-6">
        {renderLoadingProgress()}
      </div>
    );
  }

  // Get filtered stores for display
  const filteredStores = storesWithSubmissions.filter(store => 
    selectedStoreFilter === 'all' || store.store_id === selectedStoreFilter
  );

  // Update local amendment data without full refresh
  const updateLocalAmendmentData = (savedAmendment: any) => {
    console.log('🔄 [AreaManagerV2] Updating local amendment data:', savedAmendment);
    
    // Update the weeklyPlanData to reflect the new/updated amendment
    setWeeklyPlanData(prevData => {
      return prevData.map(item => {
        if (item.stock_code === savedAmendment.stock_code && 
            item.store_name === storesWithSubmissions.find(s => s.store_id === savedAmendment.store_id)?.store_name) {
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
  const totalStores = storesWithSubmissions.length;
  const storesWithAmendments = storesWithSubmissions.filter(s => s.total_amendments > 0).length;
  const totalAmendments = storesWithSubmissions.reduce((sum, s) => sum + s.total_amendments, 0);
  const pendingAmendments = storesWithSubmissions.reduce((sum, s) => sum + s.current_user_pending_amendments, 0);

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Area Manager Dashboard</h1>
          <p className="text-muted-foreground">
            {userInfo ? `${userInfo.first_name} ${userInfo.last_name}` : 'Loading...'} • {totalStores} Stores
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Week Selection */}
          <Select value={currentWeek.week_reference} onValueChange={handleWeekChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {weekSelections.map(week => (
                <SelectItem key={week.week_reference} value={week.week_reference}>
                  {week.week_reference}
                  {week.is_current && ' (Current)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* View Toggle */}
          <div className="flex rounded-lg border bg-background p-1">
            <Button
              variant={currentView === 'submission' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleViewSwitch('submission')}
              className="rounded-md"
            >
              <Building2 className="h-4 w-4 mr-2" />
              Submission View
            </Button>
            <Button
              variant={currentView === 'detail' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleViewSwitch('detail')}
              className="rounded-md"
              disabled={!isDataLoaded}
            >
              <Eye className="h-4 w-4 mr-2" />
              Detail View
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stores</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStores}</div>
            <p className="text-xs text-muted-foreground">
              Under your management
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stores with Amendments</CardTitle>
            <Edit className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{storesWithAmendments}</div>
            <p className="text-xs text-muted-foreground">
              {totalStores > 0 ? Math.round((storesWithAmendments / totalStores) * 100) : 0}% of total stores
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amendments</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAmendments}</div>
            <p className="text-xs text-muted-foreground">
              Across all stores
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingAmendments}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting review
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      {currentView === 'submission' ? (
        <div className="space-y-6">
          {/* Store Filter */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Store Filter
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedStoreFilter} onValueChange={setSelectedStoreFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stores ({totalStores})</SelectItem>
                  {storesWithSubmissions.map(store => (
                    <SelectItem key={store.store_id} value={store.store_id}>
                      {store.store_name} ({store.store_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Stores Table */}
          <Card>
            <CardHeader>
              <CardTitle>Store Submissions & Amendments</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amendments</TableHead>
                    <TableHead>Weekly Plan Total</TableHead>
                    <TableHead>Revised Total</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStores.map(store => (
                    <TableRow key={store.store_id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{store.store_name}</div>
                          <div className="text-sm text-muted-foreground">{store.store_code}</div>
                        </div>
                      </TableCell>
                      <TableCell>{store.region}</TableCell>
                      <TableCell>
                        <Badge variant={store.store_active ? 'default' : 'secondary'}>
                          {store.store_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{store.total_amendments}</span>
                          {store.current_user_pending_amendments > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {store.current_user_pending_amendments} pending
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {store.weekly_plan_total_qty.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{store.revised_total_qty.toLocaleString()}</span>
                          {store.revised_total_qty !== store.weekly_plan_total_qty && (
                            <Badge variant="outline" className="text-xs">
                              {store.current_user_amendment_qty > 0 ? '+' : ''}
                              {store.current_user_amendment_qty}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewSwitch('detail')}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredStores.length === 0 && (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Stores Found</h3>
                  <p className="text-muted-foreground">
                    {selectedStoreFilter === 'all' 
                      ? 'No stores are assigned to this area manager'
                      : 'The selected filter returned no results'
                    }
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        // Detail View using ManagerLineItemDetail component
        userInfo && currentWeek && (
          <ManagerLineItemDetail
            title="Area Manager - Weekly Plan Details"
            managerInfo={{
              id: userInfo.id,
              first_name: userInfo.first_name,
              last_name: userInfo.last_name,
              email: userInfo.email,
              assigned_stores: userInfo.assigned_stores || []
            }}
            currentWeek={currentWeek}
            storesWithSubmissions={storesWithSubmissions}
            weeklyPlanData={weeklyPlanData}
            managerRole="area_manager"
            onAmendmentSave={updateLocalAmendmentData}
            onRefresh={reloadData}
          />
        )
      )}
    </div>
  );
};