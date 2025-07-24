import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WeeklyPlanInterface } from '@/components/shared/weekly-plan-interface';
import { supabaseAdmin } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { CheckCircle, XCircle, Edit3, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from '@/hooks/use-toast';

interface AdminAmendmentInterfaceState {
  loading: boolean;
  error: string | null;
  showDetailView: boolean;
  selectedWeek: any;
  adminInfo: any;
  organizationalData: {
    regionalManagers: any[];
    areaManagers: any[];
    storeManagers: any[];
    stores: any[];
    amendments: any[];
  };
  filteredAmendments: any[];
  statsData: {
    totalAmendments: number;
    pendingAmendments: number;
    submittedAmendments: number;
    approvedAmendments: number;
    rejectedAmendments: number;
    regionalManagerCount: number;
    areaManagerCount: number;
    storeCount: number;
  };
  filters: {
    status: string;
    regionalManager: string;
    areaManager: string;
    store: string;
    searchTerm: string;
  };
}

export function AdminAmendmentInterface() {
  const { userId } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useState<AdminAmendmentInterfaceState>({
    loading: true,
    error: null,
    showDetailView: false,
    selectedWeek: null,
    adminInfo: null,
    organizationalData: {
      regionalManagers: [],
      areaManagers: [],
      storeManagers: [],
      stores: [],
      amendments: []
    },
    filteredAmendments: [],
    statsData: {
      totalAmendments: 0,
      pendingAmendments: 0,
      submittedAmendments: 0,
      approvedAmendments: 0,
      rejectedAmendments: 0,
      regionalManagerCount: 0,
      areaManagerCount: 0,
      storeCount: 0
    },
    filters: {
      status: 'all',
      regionalManager: 'all',
      areaManager: 'all', 
      store: 'all',
      searchTerm: ''
    }
  });

  // Approval modal state
  const [modifyDialogOpen, setModifyDialogOpen] = useState(false);
  const [selectedAmendment, setSelectedAmendment] = useState<any>(null);
  const [modifyQuantity, setModifyQuantity] = useState<number>(0);
  const [modifyReason, setModifyReason] = useState<string>('');

  const loadAdminData = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      if (!supabaseAdmin) {
        throw new Error('Supabase admin client not available');
      }

      const { data: adminData, error: adminError } = await supabaseAdmin
        .from('users')
        .select('id, email, name, role, clerk_id')
        .eq('clerk_id', userId)
        .eq('role', 'admin')
        .limit(1)
        .single();

      if (adminError || !adminData) {
        console.error('Admin lookup error:', adminError);
        throw new Error('Admin user not found or insufficient permissions');
      }

      console.log('Admin user found:', adminData);
      const adminInfo = adminData;

      // Get current week
      const { data: weekData } = await supabaseAdmin
        .from('week_selections')
        .select('*')
        .eq('is_current', true)
        .order('week_start_date', { ascending: false })
        .limit(1)
        .single();

      const currentWeek = weekData || null;

      // Load all organizational data
      const [regionalManagersResult, areaManagersResult, storeManagersResult, storesResult, amendmentsResult] = await Promise.all([
        // Regional Managers
        supabaseAdmin
          .from('users')
          .select('id, email, name, first_name, last_name, username, role, clerk_id')
          .eq('role', 'regional_manager')
          .order('first_name'),
        
        // Area Managers  
        supabaseAdmin
          .from('users')
          .select('id, email, name, first_name, last_name, username, role, clerk_id')
          .eq('role', 'area_manager')
          .order('first_name'),

        // Store Managers
        supabaseAdmin
          .from('users')
          .select('id, email, name, role, clerk_id')
          .eq('role', 'store_manager')
          .order('name'),

        // All Stores
        supabaseAdmin
          .from('stores')
          .select('id, store_name, address, region')
          .order('store_name'),

        // All Amendments with user and store info - derive status from submissions
        supabaseAdmin
          .from('weekly_plan_amendments')
          .select(`
            id, stock_code, store_id, amended_qty, justification, 
            status, created_by_role, user_id, created_at, updated_at,
            admin_notes, category, week_reference, weekly_plan_id,
            created_by_user:users!user_id(name, email),
            store:stores!store_id(store_name, region)
          `)
          .order('created_at', { ascending: false })
      ]);

      // Get submissions to determine correct amendment status
      const { data: submissionsData, error: submissionsError } = await supabaseAdmin
        .from('weekly_plan_submissions')
        .select('user_id, store_id, status, week_reference, created_at')
        .eq('week_reference', currentWeek?.week_reference || 'Week 28');

      console.log('Query results:', {
        regionalManagers: regionalManagersResult.data?.length || 0,
        areaManagers: areaManagersResult.data?.length || 0, 
        storeManagers: storeManagersResult.data?.length || 0,
        stores: storesResult.data?.length || 0,
        amendments: amendmentsResult.data?.length || 0,
        regionalManagersError: regionalManagersResult.error,
        areaManagersError: areaManagersResult.error,
        storeManagersError: storeManagersResult.error,
        amendmentsError: amendmentsResult.error,
        storesError: storesResult.error,
        sampleStore: storesResult.data?.[0]
      });

      // Debug manager data for filters
      console.log('Regional Managers for filters:', regionalManagersResult.data?.map(rm => ({
        id: rm.id,
        name: rm.name,
        email: rm.email
      })));
      console.log('Area Managers for filters:', areaManagersResult.data?.map(am => ({
        id: am.id, 
        name: am.name,
        email: am.email
      })));
      
      // Debug actual name values - detailed
      console.log('Regional Manager names:', regionalManagersResult.data?.map(rm => rm.name));
      console.log('Area Manager names:', areaManagersResult.data?.map(am => am.name));
      console.log('Regional Manager full objects:', regionalManagersResult.data);
      console.log('Area Manager full objects:', areaManagersResult.data);
      

      // Debug specific amendment
      const bdbn5Amendments = amendmentsResult.data?.filter(a => a.stock_code?.includes('BDBN5'));
      console.log('All BDBN5 amendments:', bdbn5Amendments?.map(a => ({
        id: a.id,
        stock_code: a.stock_code,
        status: a.status,
        amended_qty: a.amended_qty,
        justification: a.justification,
        created_at: a.created_at,
        updated_at: a.updated_at,
        created_by_role: a.created_by_role,
        store_name: a.store?.store_name,
        user_email: a.created_by_user?.email
      })));
      
      // Also debug all amendment statuses to see the distribution
      const statusCounts = amendmentsResult.data?.reduce((acc: Record<string, number>, a) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      }, {});
      console.log('Amendment status distribution:', statusCounts);

      // Create a map of submissions by user_id and store_id for quick lookup
      const submissionMap = new Map<string, any>();
      (submissionsData || []).forEach(submission => {
        const key = `${submission.user_id}-${submission.store_id}`;
        submissionMap.set(key, submission);
      });

      // Derive correct status for amendments based on submissions
      const amendmentsWithCorrectStatus = (amendmentsResult.data || []).map(amendment => {
        const submissionKey = `${amendment.user_id}-${amendment.store_id}`;
        const submission = submissionMap.get(submissionKey);
        
        let effectiveStatus = amendment.status;
        
        // If amendment is "pending" but there's a "submitted" submission, status should be "submitted"
        if (amendment.status === 'pending' && submission?.status === 'submitted') {
          effectiveStatus = 'submitted';
        }
        
        return {
          ...amendment,
          originalStatus: amendment.status,
          status: effectiveStatus,
          hasSubmission: !!submission,
          submissionStatus: submission?.status
        };
      });

      console.log('Amendments with corrected status:', amendmentsWithCorrectStatus.length);
      console.log('Status corrections applied:', amendmentsWithCorrectStatus.filter(a => a.originalStatus !== a.status).length);
      
      // Debug the specific BDBN5-152 amendment after correction
      const correctedBdbn5 = amendmentsWithCorrectStatus.find(a => a.stock_code === 'BDBN5-152');
      if (correctedBdbn5) {
        console.log('BDBN5-152 after status correction:', {
          stock_code: correctedBdbn5.stock_code,
          originalStatus: correctedBdbn5.originalStatus,
          correctedStatus: correctedBdbn5.status,
          hasSubmission: correctedBdbn5.hasSubmission,
          submissionStatus: correctedBdbn5.submissionStatus,
          created_at: correctedBdbn5.created_at,
          justification: correctedBdbn5.justification
        });
      }

      // Create display names for managers
      const createDisplayName = (user: any) => {
        if (user.name) return user.name;
        if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
        if (user.first_name) return user.first_name;
        if (user.username) return user.username;
        return user.email || 'Unknown User';
      };

      const organizationalData = {
        regionalManagers: (regionalManagersResult.data || []).map(rm => ({
          ...rm,
          display_name: createDisplayName(rm)
        })),
        areaManagers: (areaManagersResult.data || []).map(am => ({
          ...am,
          display_name: createDisplayName(am)
        })),
        storeManagers: storeManagersResult.data || [],
        stores: storesResult.data || [],
        amendments: amendmentsWithCorrectStatus
      };

      // Calculate stats
      const amendments = organizationalData.amendments;
      const statsData = {
        totalAmendments: amendments.length,
        pendingAmendments: amendments.filter((a: any) => a.status === 'pending').length,
        submittedAmendments: amendments.filter((a: any) => a.status === 'submitted').length,
        approvedAmendments: amendments.filter((a: any) => a.status === 'approved').length,
        rejectedAmendments: amendments.filter((a: any) => a.status === 'rejected').length,
        regionalManagerCount: organizationalData.regionalManagers.length,
        areaManagerCount: organizationalData.areaManagers.length,
        storeCount: organizationalData.stores.length
      };

      setState(prev => ({
        ...prev,
        loading: false,
        adminInfo,
        selectedWeek: currentWeek,
        organizationalData,
        filteredAmendments: amendments,
        statsData
      }));

      // Debug dropdown data after state is set
      console.log('Final dropdown data check:', {
        regionalManagersLength: organizationalData.regionalManagers.length,
        areaManagersLength: organizationalData.areaManagers.length,
        regionalManagersArray: organizationalData.regionalManagers,
        areaManagersArray: organizationalData.areaManagers
      });

    } catch (error: any) {
      console.error('Error loading admin data:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to load admin data'
      }));
    }
  };

  const applyFilters = () => {
    const { status, regionalManager, areaManager, store, searchTerm } = state.filters;
    let filtered = [...state.organizationalData.amendments];

    // Status filter
    if (status !== 'all') {
      filtered = filtered.filter(amendment => amendment.status === status);
    }

    // Regional Manager filter - simplified for now
    if (regionalManager !== 'all') {
      filtered = filtered.filter(amendment => amendment.user_id === regionalManager);
    }

    // Area Manager filter
    if (areaManager !== 'all') {
      filtered = filtered.filter(amendment => amendment.user_id === areaManager);
    }

    // Store filter
    if (store !== 'all') {
      filtered = filtered.filter(amendment => amendment.store_id === store);
    }

    // Search term filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(amendment =>
        amendment.stock_code?.toLowerCase().includes(term) ||
        amendment.store?.store_name?.toLowerCase().includes(term) ||
        amendment.justification?.toLowerCase().includes(term) ||
        amendment.created_by_user?.name?.toLowerCase().includes(term) ||
        amendment.created_by_user?.email?.toLowerCase().includes(term)
      );
    }

    setState(prev => ({ ...prev, filteredAmendments: filtered }));
  };

  const updateFilter = (key: keyof typeof state.filters, value: string) => {
    setState(prev => ({
      ...prev,
      filters: { ...prev.filters, [key]: value }
    }));
  };

  const clearFilters = () => {
    setState(prev => ({
      ...prev,
      filters: {
        status: 'all',
        regionalManager: 'all',
        areaManager: 'all',
        store: 'all',
        searchTerm: ''
      }
    }));
  };

  const switchToDetailView = () => {
    setState(prev => ({ ...prev, showDetailView: true }));
  };

  const switchToSummaryView = () => {
    setState(prev => ({ ...prev, showDetailView: false }));
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending': return 'secondary';
      case 'submitted': return 'default'; // Will be styled green with custom classes
      case 'approved': return 'default';
      case 'rejected': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'submitted': return 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200';
      case 'approved': return 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200';
      default: return '';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Approval action functions
  const handleQuickApproval = async (amendmentId: string, action: 'approve' | 'reject', reason?: string) => {
    try {
      if (!supabaseAdmin) {
        toast({ title: 'Error', description: 'Database connection not available', variant: 'destructive' });
        return;
      }

      // First get the amendment to access amended_qty
      const { data: amendment, error: fetchError } = await supabaseAdmin
        .from('weekly_plan_amendments')
        .select('amended_qty')
        .eq('id', amendmentId)
        .single();

      if (fetchError || !amendment) {
        console.error('Error fetching amendment:', fetchError);
        toast({ title: 'Error', description: 'Could not retrieve amendment details', variant: 'destructive' });
        return;
      }

      const updateData = {
        status: action === 'approve' ? 'approved' : 'rejected',
        admin_id: state.adminInfo?.id || userId || null,
        approved_qty: action === 'approve' ? amendment.amended_qty : null,
        admin_notes: reason || '',
        admin_approved_at: action === 'approve' ? new Date().toISOString() : null,
        admin_rejected_at: action === 'reject' ? new Date().toISOString() : null,
        admin_approved_by: state.adminInfo?.name || state.adminInfo?.email || 'Admin',
      };

      const { error } = await supabaseAdmin
        .from('weekly_plan_amendments')
        .update(updateData)
        .eq('id', amendmentId);

      if (error) {
        console.error('Error updating amendment:', error);
        toast({ title: 'Error', description: `Failed to update amendment: ${error.message}`, variant: 'destructive' });
        return;
      }

      toast({ 
        title: 'Success', 
        description: `Amendment ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      });

      // Reload data
      loadAdminData();

    } catch (error) {
      console.error('Error in quick approval:', error);
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' });
    }
  };

  const handleAmendmentModification = async (
    originalAmendmentId: string, 
    modifiedQuantity: number, 
    modificationReason: string
  ) => {
    try {
      if (!supabaseAdmin) {
        toast({ title: 'Error', description: 'Database connection not available', variant: 'destructive' });
        return;
      }

      // First, get the original amendment data
      const { data: originalAmendment, error: fetchError } = await supabaseAdmin
        .from('weekly_plan_amendments')
        .select('*')
        .eq('id', originalAmendmentId)
        .single();

      if (fetchError || !originalAmendment) {
        console.error('Error fetching original amendment:', fetchError);
        toast({ title: 'Error', description: 'Could not retrieve original amendment', variant: 'destructive' });
        return;
      }

      // Mark original amendment as rejected with modification reason
      const { error: updateError } = await supabaseAdmin
        .from('weekly_plan_amendments')
        .update({
          status: 'rejected',
          admin_id: state.adminInfo?.id || userId || null,
          admin_notes: `Modified by admin. Original quantity: ${originalAmendment.amended_qty}, Modified to: ${modifiedQuantity}. Reason: ${modificationReason}`,
          admin_rejected_at: new Date().toISOString(),
          admin_approved_by: state.adminInfo?.name || state.adminInfo?.email || 'Admin',
        })
        .eq('id', originalAmendmentId);

      if (updateError) {
        console.error('Error updating original amendment:', updateError);
        toast({ title: 'Error', description: 'Failed to update original amendment', variant: 'destructive' });
        return;
      }

      // Create new admin amendment record
      const { error: insertError } = await supabaseAdmin
        .from('weekly_plan_amendments')
        .insert({
          user_id: state.adminInfo?.id || '',
          store_id: originalAmendment.store_id,
          stock_code: originalAmendment.stock_code,
          week_reference: originalAmendment.week_reference,
          week_start_date: originalAmendment.week_start_date,
          product_name: originalAmendment.product_name,
          category: originalAmendment.category,
          sub_category: originalAmendment.sub_category,
          original_qty: originalAmendment.original_qty,
          amended_qty: modifiedQuantity,
          approved_qty: modifiedQuantity,
          amendment_type: 'admin_edit',
          justification: `Admin modification of amendment ${originalAmendmentId}. ${modificationReason}`,
          status: 'approved',
          admin_id: state.adminInfo?.id || userId || null,
          admin_approved_at: new Date().toISOString(),
          admin_approved_by: state.adminInfo?.name || state.adminInfo?.email || 'Admin',
          original_amendment_id: originalAmendmentId,
          admin_notes: `Admin modified from ${originalAmendment.amended_qty} to ${modifiedQuantity}`,
          created_by_role: 'admin',
        });

      if (insertError) {
        console.error('Error creating admin amended record:', insertError);
        toast({ title: 'Error', description: 'Failed to create admin amendment record', variant: 'destructive' });
        return;
      }

      toast({ 
        title: 'Success', 
        description: `Amendment modified and approved. Quantity changed from ${originalAmendment.amended_qty} to ${modifiedQuantity}`,
      });

      // Reload data
      loadAdminData();

    } catch (error) {
      console.error('Error in amendment modification:', error);
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' });
    }
  };

  const openModifyDialog = (amendment: any) => {
    setSelectedAmendment(amendment);
    setModifyQuantity(amendment.amended_qty);
    setModifyReason('');
    setModifyDialogOpen(true);
  };

  const handleModifySubmit = async () => {
    if (!selectedAmendment || !modifyReason.trim()) {
      toast({ title: 'Error', description: 'Please provide a reason for modification', variant: 'destructive' });
      return;
    }

    await handleAmendmentModification(selectedAmendment.id, modifyQuantity, modifyReason);
    setModifyDialogOpen(false);
    setSelectedAmendment(null);
    setModifyQuantity(0);
    setModifyReason('');
  };

  useEffect(() => {
    if (userId) {
      loadAdminData();
    }
  }, [userId]);

  useEffect(() => {
    applyFilters();
  }, [state.filters, state.organizationalData.amendments]);

  if (state.loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin amendment data...</p>
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
            onClick={loadAdminData}
            className="ml-2"
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (state.showDetailView) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin - Weekly Plan Management</h1>
          <Button variant="outline" onClick={switchToSummaryView}>
            ← Back to Summary
          </Button>
        </div>
        
        <WeeklyPlanInterface
          userRole="admin"
          title="Admin - Amendment Management"
          description="Review and manage weekly plan amendments across all regions and stores"
          allowedAmendmentTypes={['admin']}
          hierarchyLevel="Admin"
          adminWorkflow={true}
          showSummaryTab={false}
          preloadedData={{
            currentWeek: (() => {
              console.log('Passing currentWeek to WeeklyPlanInterface:', state.selectedWeek);
              return state.selectedWeek;
            })(),
            areaManagerInfo: (() => {
              console.log('Passing areaManagerInfo to WeeklyPlanInterface:', state.adminInfo);
              return state.adminInfo;
            })(),
            storeHierarchy: (() => {
              const transformedStores = state.organizationalData.stores.map(store => ({
                ...store,
                store_id: store.id,
                store_code: store.store_name
              }));
              console.log('Passing storeHierarchy to WeeklyPlanInterface:', transformedStores.length, 'stores');
              return transformedStores;
            })(),
            storesWithSubmissions: state.organizationalData.amendments
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Amendment Filters</CardTitle>
            <div className="flex items-center gap-4">
              <p className="text-sm text-gray-600">
                Showing {state.filteredAmendments.length} of {state.statsData.totalAmendments} amendments
              </p>
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Select value={state.filters.status} onValueChange={(value) => updateFilter('status', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select value={state.filters.regionalManager} onValueChange={(value) => updateFilter('regionalManager', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Regional Managers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regional Managers</SelectItem>
                {(() => {
                  console.log('Rendering Regional Manager dropdown with data:', state.organizationalData.regionalManagers);
                  console.log('Regional Manager SelectItems being created:', state.organizationalData.regionalManagers.map(rm => ({
                    key: rm.id,
                    value: rm.id,
                    name: rm.name,
                    display_name: rm.display_name,
                    hasName: !!rm.name,
                    hasDisplayName: !!rm.display_name
                  })));
                  return state.organizationalData.regionalManagers.map(rm => (
                    <SelectItem key={rm.id} value={rm.id}>{rm.display_name || 'Unknown Manager'}</SelectItem>
                  ));
                })()}
              </SelectContent>
            </Select>

            <Select value={state.filters.areaManager} onValueChange={(value) => updateFilter('areaManager', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Area Managers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Area Managers</SelectItem>
                {(() => {
                  console.log('Rendering Area Manager dropdown with data:', state.organizationalData.areaManagers);
                  console.log('Area Manager SelectItems being created:', state.organizationalData.areaManagers.map(am => ({
                    key: am.id,
                    value: am.id,
                    name: am.name,
                    display_name: am.display_name,
                    hasName: !!am.name,
                    hasDisplayName: !!am.display_name
                  })));
                  return state.organizationalData.areaManagers.map(am => (
                    <SelectItem key={am.id} value={am.id}>{am.display_name || 'Unknown Manager'}</SelectItem>
                  ));
                })()}
              </SelectContent>
            </Select>

            <Select value={state.filters.store} onValueChange={(value) => updateFilter('store', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Stores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stores</SelectItem>
                {state.organizationalData.stores.map(store => (
                  <SelectItem key={store.id} value={store.id}>{store.store_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Search amendments..."
              value={state.filters.searchTerm}
              onChange={(e) => updateFilter('searchTerm', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Amendments Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Amendments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stock Code</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Original Qty</TableHead>
                  <TableHead>Amended Qty</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Created Date</TableHead>
                  <TableHead>Justification</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.filteredAmendments.map((amendment) => (
                  <TableRow key={amendment.id}>
                    <TableCell className="font-medium">{amendment.stock_code}</TableCell>
                    <TableCell>{amendment.store?.store_name || 'Unknown Store'}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={getStatusBadgeVariant(amendment.status)}
                        className={getStatusBadgeClasses(amendment.status)}
                      >
                        {amendment.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{'-'}</TableCell>
                    <TableCell className="font-medium">{amendment.amended_qty}</TableCell>
                    <TableCell>{amendment.created_by_user?.name || amendment.created_by_user?.email || 'Unknown'}</TableCell>
                    <TableCell>{formatDate(amendment.created_at)}</TableCell>
                    <TableCell className="max-w-xs truncate" title={amendment.justification}>
                      {amendment.justification}
                    </TableCell>
                    <TableCell>
                      {(amendment.status === 'submitted' || amendment.status === 'area_manager_approved' || amendment.status === 'regional_direct' || amendment.status === 'area_direct') && (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-blue-600 border-blue-300 hover:bg-blue-50 px-2"
                            onClick={() => openModifyDialog(amendment)}
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-300 hover:bg-green-50 px-2"
                            onClick={() => handleQuickApproval(amendment.id, 'approve')}
                          >
                            <CheckCircle className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-300 hover:bg-red-50 px-2"
                            onClick={() => handleQuickApproval(amendment.id, 'reject', 'Rejected by admin')}
                          >
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      {(amendment.status === 'admin_approved' || amendment.status === 'admin_rejected') && (
                        <Badge variant="outline" className="text-xs">
                          {amendment.status === 'admin_approved' ? 'Approved' : 'Rejected'}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {state.filteredAmendments.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No amendments found matching the current filters.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Amendment Modification Dialog */}
      <Dialog open={modifyDialogOpen} onOpenChange={setModifyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modify Amendment</DialogTitle>
            <DialogDescription>
              Make changes to the amendment before approval. This will create a new "amended by admin" record.
            </DialogDescription>
          </DialogHeader>
          
          {selectedAmendment && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm font-medium">{selectedAmendment.store?.store_name}</div>
                <div className="text-sm text-gray-600">{selectedAmendment.stock_code}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Original Type: {selectedAmendment.amendment_type} • 
                  Requested by: {selectedAmendment.created_by_user?.name || selectedAmendment.created_by_user?.email}
                </div>
              </div>
              
              <div>
                <Label htmlFor="modify-quantity">Modified Quantity</Label>
                <Input
                  id="modify-quantity"
                  type="number"
                  value={modifyQuantity}
                  onChange={(e) => setModifyQuantity(Number(e.target.value))}
                  className="mt-1"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Original quantity: {selectedAmendment.amended_qty}
                </div>
              </div>
              
              <div>
                <Label htmlFor="modify-reason">Modification Reason</Label>
                <Textarea
                  id="modify-reason"
                  value={modifyReason}
                  onChange={(e) => setModifyReason(e.target.value)}
                  placeholder="Explain why you're modifying this amendment..."
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setModifyDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleModifySubmit}>
              Modify & Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}