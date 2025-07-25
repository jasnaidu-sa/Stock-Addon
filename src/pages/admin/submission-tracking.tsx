import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Users, 
  Building2, 
  UserCheck, 
  UserX, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Calendar,
  Filter,
  RefreshCw,
  Eye,
  Settings,
  TrendingUp
} from 'lucide-react';
import { supabaseAdmin } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/utils';

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

interface WeekSelection {
  week_reference: string;
  week_start_date: string;
  week_end_date: string;
  is_current: boolean;
  is_active: boolean;
  week_status: string;
}

interface SubmissionSummary {
  total_stores: number;
  stores_submitted: number;
  stores_pending: number;
  area_managers_submitted: number;
  area_managers_pending: number;
  regional_managers_submitted: number;
  regional_managers_pending: number;
  total_amendments: number;
}

interface OrganizationalData {
  regionalManagers: any[];
  areaManagers: any[];
  stores: any[];
}

export const AdminSubmissionTracking: React.FC = () => {
  const [storeHierarchy, setStoreHierarchy] = useState<StoreHierarchy[]>([]);
  const [submissionStatuses, setSubmissionStatuses] = useState<SubmissionStatus[]>([]);
  const [weekSelections, setWeekSelections] = useState<WeekSelection[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [organizationalData, setOrganizationalData] = useState<OrganizationalData>({
    regionalManagers: [],
    areaManagers: [],
    stores: []
  });
  const [filters, setFilters] = useState({
    status: 'all',
    regionalManager: 'all',
    areaManager: 'all',
    store: 'all',
    searchTerm: ''
  });
  const [summary, setSummary] = useState<SubmissionSummary>({
    total_stores: 0,
    stores_submitted: 0,
    stores_pending: 0,
    area_managers_submitted: 0,
    area_managers_pending: 0,
    regional_managers_submitted: 0,
    regional_managers_pending: 0,
    total_amendments: 0
  });
  const { toast } = useToast();

  // Load store hierarchy and organizational data
  const loadStoreHierarchy = async () => {
    try {
      const [hierarchyResult, regionalManagersResult, areaManagersResult, storesResult] = await Promise.all([
        supabaseAdmin
          .from('store_management_hierarchy')
          .select('*')
          .order('store_name'),
        
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

        // All Stores
        supabaseAdmin
          .from('stores')
          .select('id, store_name, address, region')
          .order('store_name')
      ]);

      if (hierarchyResult.error) throw hierarchyResult.error;
      setStoreHierarchy(hierarchyResult.data || []);

      // Create display names for managers
      const createDisplayName = (user: any) => {
        if (user.name) return user.name;
        if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
        if (user.first_name) return user.first_name;
        if (user.username) return user.username;
        return user.email || 'Unknown User';
      };

      setOrganizationalData({
        regionalManagers: (regionalManagersResult.data || []).map(rm => ({
          ...rm,
          display_name: createDisplayName(rm)
        })),
        areaManagers: (areaManagersResult.data || []).map(am => ({
          ...am,
          display_name: createDisplayName(am)
        })),
        stores: storesResult.data || []
      });
    } catch (error) {
      console.error('Error loading store hierarchy:', error);
      toast({
        title: 'Error',
        description: 'Failed to load store hierarchy',
        variant: 'destructive'
      });
    }
  };

  // Load week selections
  const loadWeekSelections = async () => {
    try {
      const { data, error } = await supabaseAdmin
        .from('week_selections')
        .select('*')
        .order('week_start_date', { ascending: false });

      if (error) throw error;
      setWeekSelections(data || []);
      
      // Set current week as default if no week selected
      if (!selectedWeek && data && data.length > 0) {
        const currentWeek = data.find(w => w.is_current) || data[0];
        setSelectedWeek(currentWeek.week_reference);
      }
    } catch (error) {
      console.error('Error loading week selections:', error);
      toast({
        title: 'Error',
        description: 'Failed to load week selections',
        variant: 'destructive'
      });
    }
  };

  // Load submission statuses
  const loadSubmissionStatuses = async () => {
    if (!selectedWeek) return;

    try {
      // Load both submissions and amendments data
      const [submissionsResult, amendmentsResult] = await Promise.all([
        supabaseAdmin
          .from('weekly_plan_submissions')
          .select('*')
          .eq('week_reference', selectedWeek),
        supabaseAdmin
          .from('weekly_plan_amendments')
          .select('id, user_id, store_id, amended_qty, created_by_role, week_reference, status')
          .eq('week_reference', selectedWeek)
      ]);

      if (submissionsResult.error) throw submissionsResult.error;
      if (amendmentsResult.error) throw amendmentsResult.error;

      console.log('Amendments data loaded:', amendmentsResult.data?.length || 0, 'amendments');

      // Transform the data to aggregate by store and create proper status fields
      const transformedData = transformSubmissionData(submissionsResult.data || [], amendmentsResult.data || []);
      setSubmissionStatuses(transformedData);
      
      // Calculate summary
      calculateSummary(transformedData);
    } catch (error) {
      console.error('Error loading submission statuses:', error);
      toast({
        title: 'Error',
        description: 'Failed to load submission statuses',
        variant: 'destructive'
      });
    }
  };

  // Transform submission data to proper format for the UI
  const transformSubmissionData = (rawSubmissions: any[], rawAmendments: any[]): SubmissionStatus[] => {
    console.log('Raw submission data:', rawSubmissions.length, 'records');
    console.log('Raw amendments data:', rawAmendments.length, 'amendments');
    
    const storeMap = new Map<string, SubmissionStatus>();
    
    // Group submissions by user and type for processing
    const submissionsByUser = new Map<string, any[]>();
    rawSubmissions.forEach(submission => {
      const userId = submission.user_id;
      if (!userId) return;
      
      if (!submissionsByUser.has(userId)) {
        submissionsByUser.set(userId, []);
      }
      submissionsByUser.get(userId)!.push(submission);
    });

    console.log('Submissions by user:', Object.fromEntries(
      Array.from(submissionsByUser.entries()).map(([userId, subs]) => [
        userId, 
        {
          count: subs.length,
          types: [...new Set(subs.map(s => s.submission_type))],
          levels: [...new Set(subs.map(s => s.level))],
          submitted: subs.filter(s => s.status === 'submitted').length
        }
      ])
    ));

    // Group amendments by store and role
    const amendmentsByStore = new Map<string, any[]>();
    rawAmendments.forEach(amendment => {
      const storeId = amendment.store_id;
      if (!storeId) return;
      
      if (!amendmentsByStore.has(storeId)) {
        amendmentsByStore.set(storeId, []);
      }
      amendmentsByStore.get(storeId)!.push(amendment);
    });

    console.log('Amendments by store:', amendmentsByStore.size, 'stores have amendments');

    // First pass: Create entries for all stores from hierarchy
    storeHierarchy.forEach(store => {
      const storeStatus: SubmissionStatus = {
        store_id: store.store_id,
        week_reference: selectedWeek,
        store_submission_status: 'not_submitted',
        area_submission_status: 'not_submitted', 
        regional_submission_status: 'not_submitted',
        admin_submission_status: 'not_submitted',
        store_submitted_at: '',
        area_submitted_at: '',
        regional_submitted_at: '',
        admin_submitted_at: '',
        store_amendment_count: 0,
        area_amendment_count: 0,
        regional_amendment_count: 0,
        admin_amendment_count: 0,
        week_status: 'open'
      };
      storeMap.set(store.store_id, storeStatus);
    });

    // Second pass: Apply submitted statuses based on manager hierarchy
    rawSubmissions.forEach(submission => {
      if (submission.status !== 'submitted') return;
      
      const submissionType = submission.submission_type;
      const level = submission.level;
      const userId = submission.user_id;
      const submittedAt = submission.created_at;

      // Handle direct store submissions
      if (submission.store_id) {
        const storeStatus = storeMap.get(submission.store_id);
        if (storeStatus) {
          if (submissionType === 'store_submission' || level === 'store') {
            storeStatus.store_submission_status = 'submitted';
            storeStatus.store_submitted_at = submittedAt;
          } else if (submissionType === 'area_submission' || level === 'area') {
            storeStatus.area_submission_status = 'submitted';
            storeStatus.area_submitted_at = submittedAt;
          } else if (submissionType === 'regional_submission' || level === 'regional') {
            storeStatus.regional_submission_status = 'submitted';
            storeStatus.regional_submitted_at = submittedAt;
          }
        }
      } else {
        // Handle aggregate submissions (affects multiple stores)
        if (submissionType === 'regional_submission' && userId) {
          // Find all stores managed by this regional manager
          storeHierarchy.forEach(store => {
            if (store.regional_manager_id === userId) {
              const storeStatus = storeMap.get(store.store_id);
              if (storeStatus) {
                storeStatus.regional_submission_status = 'submitted';
                storeStatus.regional_submitted_at = submittedAt;
              }
            }
          });
        } else if (submissionType === 'area_submission' && userId) {
          // Find all stores managed by this area manager
          storeHierarchy.forEach(store => {
            if (store.area_manager_id === userId) {
              const storeStatus = storeMap.get(store.store_id);
              if (storeStatus) {
                storeStatus.area_submission_status = 'submitted';
                storeStatus.area_submitted_at = submittedAt;
              }
            }
          });
        }
      }
    });

    // Third pass: Calculate amendment counts by store and role, and determine admin status
    amendmentsByStore.forEach((amendments, storeId) => {
      const storeStatus = storeMap.get(storeId);
      if (!storeStatus) return;

      const store = storeHierarchy.find(s => s.store_id === storeId);
      if (!store) return;

      // Track all amendment statuses for this store to determine aggregate status
      let hasAdminAmendments = false;
      let latestAdminAmendmentDate = '';
      let allAmendmentStatuses = {
        approved: 0,
        rejected: 0,
        pending: 0,
        submitted: 0,
        admin_review: 0
      };

      amendments.forEach(amendment => {
        const role = amendment.created_by_role;
        const amendmentQty = amendment.amended_qty || 0;
        const amendmentStatus = amendment.status;
        const amendmentDate = amendment.updated_at || amendment.created_at;

        if (role === 'store_manager') {
          storeStatus.store_amendment_count += amendmentQty;
        } else if (role === 'area_manager') {
          storeStatus.area_amendment_count += amendmentQty;
        } else if (role === 'regional_manager') {
          storeStatus.regional_amendment_count += amendmentQty;
        } else if (role === 'admin') {
          storeStatus.admin_amendment_count += amendmentQty;
          hasAdminAmendments = true;
          
          // Track latest date for admin amendments
          if (!latestAdminAmendmentDate || amendmentDate > latestAdminAmendmentDate) {
            latestAdminAmendmentDate = amendmentDate;
          }
        }

        // Count all amendment statuses (regardless of role) for aggregate status
        if (allAmendmentStatuses.hasOwnProperty(amendmentStatus)) {
          allAmendmentStatuses[amendmentStatus]++;
        }
      });

      // Determine admin submission status based on ALL amendment statuses with priority hierarchy
      if (hasAdminAmendments || allAmendmentStatuses.approved > 0 || allAmendmentStatuses.rejected > 0 || allAmendmentStatuses.pending > 0) {
        const totalAmendments = Object.values(allAmendmentStatuses).reduce((sum, count) => sum + count, 0);
        
        // Priority-based status determination:
        if (allAmendmentStatuses.rejected > 0) {
          // Any rejections = rejected status (highest priority)
          storeStatus.admin_submission_status = 'rejected';
        } else if (allAmendmentStatuses.pending > 0 || allAmendmentStatuses.submitted > 0 || allAmendmentStatuses.admin_review > 0) {
          // Any pending work = pending status
          storeStatus.admin_submission_status = 'pending';
        } else if (allAmendmentStatuses.approved > 0 && totalAmendments === allAmendmentStatuses.approved) {
          // All approved = approved status
          storeStatus.admin_submission_status = 'approved';
        } else {
          // Mixed or unknown states = pending
          storeStatus.admin_submission_status = 'pending';
        }
        
        storeStatus.admin_submitted_at = latestAdminAmendmentDate || new Date().toISOString();
      }
    });

    // Fourth pass: Auto-approve admin status for stores with submission but no lower-level amendments
    storeMap.forEach((storeStatus, storeId) => {
      // Check if management levels have submitted for this store (any level submission counts)
      const hasManagementSubmission = storeStatus.regional_submission_status === 'submitted' || 
                                     storeStatus.area_submission_status === 'submitted';
      
      // Check if there are any amendments from lower levels (store, area, regional) that need admin review
      const hasLowerLevelAmendments = storeStatus.store_amendment_count > 0 || 
                                    storeStatus.area_amendment_count > 0 || 
                                    storeStatus.regional_amendment_count > 0;
      
      // Check if admin has already taken action (has admin amendments)
      const hasAdminAction = storeStatus.admin_amendment_count > 0;
      
      // Auto-approve if:
      // 1. Any management level (area or regional) has submitted
      // 2. No amendments from lower levels exist 
      // 3. Admin hasn't already taken action
      // 4. Admin status is still 'not_submitted'
      if (hasManagementSubmission && 
          !hasLowerLevelAmendments && 
          !hasAdminAction && 
          storeStatus.admin_submission_status === 'not_submitted') {
        
        storeStatus.admin_submission_status = 'approved';
        // Use the latest submission date from any level
        storeStatus.admin_submitted_at = storeStatus.regional_submitted_at || 
                                       storeStatus.area_submitted_at || 
                                       new Date().toISOString();
        
        console.log(`Auto-approved admin status for store ${storeId} - no amendments to review from management submission`);
      }
    });

    const result = Array.from(storeMap.values());
    console.log('Transformed submission data:', result.length, 'stores');
    console.log('Regional submissions found:', result.filter(r => r.regional_submission_status === 'submitted').length);
    console.log('Area submissions found:', result.filter(r => r.area_submission_status === 'submitted').length);
    console.log('Admin submissions found:', result.filter(r => r.admin_submission_status === 'submitted').length);
    console.log('Admin approvals found:', result.filter(r => r.admin_submission_status === 'approved').length);
    console.log('Admin auto-approvals found:', result.filter(r => r.admin_submission_status === 'approved' && r.admin_amendment_count === 0).length);
    console.log('Admin rejections found:', result.filter(r => r.admin_submission_status === 'rejected').length);
    console.log('Admin pending found:', result.filter(r => r.admin_submission_status === 'pending').length);
    console.log('Stores with mixed amendment statuses:', result.filter(r => 
      (r.store_amendment_count + r.area_amendment_count + r.regional_amendment_count + r.admin_amendment_count > 1) &&
      r.admin_submission_status === 'rejected'
    ).length);
    console.log('Stores with amendments:', result.filter(r => 
      r.store_amendment_count + r.area_amendment_count + r.regional_amendment_count + r.admin_amendment_count > 0
    ).length);
    console.log('Admin amendments by status:', result.filter(r => r.admin_amendment_count > 0).map(r => ({
      store_id: r.store_id,
      admin_status: r.admin_submission_status,
      admin_count: r.admin_amendment_count
    })));
    
    return result;
  };

  // Calculate submission summary
  const calculateSummary = (submissions: SubmissionStatus[]) => {
    const submissionMap = new Map<string, SubmissionStatus>();
    submissions.forEach(sub => {
      submissionMap.set(sub.store_id, sub);
    });

    const totalStores = storeHierarchy.length;
    let storesSubmitted = 0;
    let areaManagersSubmitted = 0;
    let regionalManagersSubmitted = 0;
    let totalAmendments = 0;

    // Track unique managers
    const areaManagers = new Set<string>();
    const regionalManagers = new Set<string>();
    const submittedAreaManagers = new Set<string>();
    const submittedRegionalManagers = new Set<string>();

    storeHierarchy.forEach(store => {
      const submission = submissionMap.get(store.store_id);
      
      // Track managers
      if (store.area_manager_id) {
        areaManagers.add(store.area_manager_id);
      }
      if (store.regional_manager_id) {
        regionalManagers.add(store.regional_manager_id);
      }

      if (submission) {
        // Count store submissions
        if (submission.store_submission_status === 'submitted') {
          storesSubmitted++;
        }

        // Count area manager submissions
        if (submission.area_submission_status === 'submitted' && store.area_manager_id) {
          submittedAreaManagers.add(store.area_manager_id);
        }

        // Count regional manager submissions
        if (submission.regional_submission_status === 'submitted' && store.regional_manager_id) {
          submittedRegionalManagers.add(store.regional_manager_id);
        }

        // Count amendments
        totalAmendments += submission.store_amendment_count + 
                          submission.area_amendment_count + 
                          submission.regional_amendment_count + 
                          submission.admin_amendment_count;
      }
    });

    setSummary({
      total_stores: totalStores,
      stores_submitted: storesSubmitted,
      stores_pending: totalStores - storesSubmitted,
      area_managers_submitted: submittedAreaManagers.size,
      area_managers_pending: areaManagers.size - submittedAreaManagers.size,
      regional_managers_submitted: submittedRegionalManagers.size,
      regional_managers_pending: regionalManagers.size - submittedRegionalManagers.size,
      total_amendments: totalAmendments
    });
  };

  // Update week status
  const updateWeekStatus = async (weekReference: string, status: 'open' | 'closed') => {
    try {
      const { error } = await supabaseAdmin
        .from('week_selections')
        .update({ week_status: status })
        .eq('week_reference', weekReference);

      if (error) throw error;

      // Also update all submission records for this week
      const { error: submissionError } = await supabaseAdmin
        .from('weekly_plan_submissions')
        .update({ week_status: status })
        .eq('week_reference', weekReference);

      if (submissionError) throw submissionError;

      toast({
        title: 'Success',
        description: `Week ${weekReference} is now ${status}`,
      });

      // Reload data
      loadWeekSelections();
      loadSubmissionStatuses();
    } catch (error) {
      console.error('Error updating week status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update week status',
        variant: 'destructive'
      });
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const getStatusBadgeVariant = (status: string) => {
      switch (status) {
        case 'pending': 
        case 'not_submitted': 
          return 'secondary';
        case 'submitted': 
        case 'approved': 
          return 'default';
        case 'rejected': 
          return 'destructive';
        case 'amended': 
          return 'outline';
        default: 
          return 'secondary';
      }
    };

    const getStatusBadgeClasses = (status: string) => {
      switch (status) {
        case 'pending': 
          return 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200';
        case 'submitted': 
          return 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200';
        case 'approved': 
          return 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200';
        case 'amended': 
          return 'border-orange-500 text-orange-600 hover:bg-orange-50';
        case 'not_submitted':
          return 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200';
        default: 
          return '';
      }
    };

    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'submitted': 
          return <CheckCircle className="h-3 w-3 mr-1" />;
        case 'approved': 
          return <CheckCircle className="h-3 w-3 mr-1" />;
        case 'rejected': 
          return <XCircle className="h-3 w-3 mr-1" />;
        case 'amended': 
          return <AlertCircle className="h-3 w-3 mr-1" />;
        case 'pending': 
        case 'not_submitted':
        default: 
          return <Clock className="h-3 w-3 mr-1" />;
      }
    };

    const getStatusText = (status: string) => {
      switch (status) {
        case 'submitted': 
          return 'Submitted';
        case 'approved': 
          return 'Approved';
        case 'rejected': 
          return 'Rejected';
        case 'amended': 
          return 'Amended';
        case 'pending': 
          return 'Pending';
        case 'not_submitted': 
          return 'Not Submitted';
        default: 
          return 'Pending';
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

  // Update filter function
  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      status: 'all',
      regionalManager: 'all',
      areaManager: 'all',
      store: 'all',
      searchTerm: ''
    });
  };

  // Filter stores based on current filters
  const filteredStores = storeHierarchy.filter(store => {
    const submission = submissionStatuses.find(s => s.store_id === store.store_id);
    
    // Search filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      if (!store.store_name.toLowerCase().includes(searchLower) &&
          !store.store_code.toLowerCase().includes(searchLower) &&
          !store.region?.toLowerCase().includes(searchLower)) {
        return false;
      }
    }

    // Regional Manager filter
    if (filters.regionalManager !== 'all') {
      if (store.regional_manager_id !== filters.regionalManager) {
        return false;
      }
    }

    // Area Manager filter
    if (filters.areaManager !== 'all') {
      if (store.area_manager_id !== filters.areaManager) {
        return false;
      }
    }

    // Store filter
    if (filters.store !== 'all') {
      if (store.store_id !== filters.store) {
        return false;
      }
    }

    // Status filter
    if (filters.status !== 'all') {
      if (!submission) return filters.status === 'pending';
      
      const hasStatus = {
        'submitted': submission.store_submission_status === 'submitted' || 
                    submission.area_submission_status === 'submitted' || 
                    submission.regional_submission_status === 'submitted',
        'pending': submission.store_submission_status === 'not_submitted' && 
                  submission.area_submission_status === 'not_submitted' && 
                  submission.regional_submission_status === 'not_submitted',
        'approved': false, // Not applicable for submission tracking
        'rejected': false, // Not applicable for submission tracking
        'amendments': submission.store_amendment_count > 0 || 
                     submission.area_amendment_count > 0 || 
                     submission.regional_amendment_count > 0
      }[filters.status];

      if (!hasStatus) return false;
    }

    return true;
  });

  // Load data on mount and when week changes
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        loadStoreHierarchy(),
        loadWeekSelections()
      ]);
      setIsLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (selectedWeek) {
      loadSubmissionStatuses();
    }
  }, [selectedWeek, storeHierarchy]);

  const currentWeek = weekSelections.find(w => w.week_reference === selectedWeek);

  return (
    <div className="space-y-6">
      {/* Week Selection & Status Control with Summary Information */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label htmlFor="week-select" className="text-sm font-medium">Select Week:</label>
                <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select week" />
                  </SelectTrigger>
                  <SelectContent>
                    {weekSelections.map((week) => (
                      <SelectItem key={week.week_reference} value={week.week_reference}>
                        {week.week_reference} {week.is_current && '(Current)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {currentWeek && (
                <>
                  <Badge variant={currentWeek.week_status === 'open' ? 'default' : 'secondary'}>
                    {currentWeek.week_status === 'open' ? 'Open' : 'Closed'}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateWeekStatus(selectedWeek, currentWeek.week_status === 'open' ? 'closed' : 'open')}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    {currentWeek.week_status === 'open' ? 'Close Week' : 'Open Week'}
                  </Button>
                </>
              )}
            </div>
            <Button onClick={() => { loadStoreHierarchy(); loadSubmissionStatuses(); }} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Submission Filters
            </CardTitle>
            <div className="flex items-center gap-4">
              <p className="text-sm text-gray-600">
                Showing {filteredStores.length} of {storeHierarchy.length} stores
              </p>
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Select value={filters.status} onValueChange={(value) => updateFilter('status', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="amendments">Has Amendments</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.regionalManager} onValueChange={(value) => updateFilter('regionalManager', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Regional Managers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regional Managers</SelectItem>
                {organizationalData.regionalManagers.map(rm => (
                  <SelectItem key={rm.id} value={rm.id}>{rm.display_name || 'Unknown Manager'}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.areaManager} onValueChange={(value) => updateFilter('areaManager', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Area Managers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Area Managers</SelectItem>
                {organizationalData.areaManagers.map(am => (
                  <SelectItem key={am.id} value={am.id}>{am.display_name || 'Unknown Manager'}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.store} onValueChange={(value) => updateFilter('store', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Stores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stores</SelectItem>
                {organizationalData.stores.map(store => (
                  <SelectItem key={store.id} value={store.id}>{store.store_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Search stores..."
              value={filters.searchTerm}
              onChange={(e) => updateFilter('searchTerm', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Submission Tracking Table */}
      <Card>
        <CardHeader>
          <CardTitle>Store Submission Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Store Manager</TableHead>
                  <TableHead>Area Manager</TableHead>
                  <TableHead>Regional Manager</TableHead>
                  <TableHead>Store Status</TableHead>
                  <TableHead>Area Status</TableHead>
                  <TableHead>Regional Status</TableHead>
                  <TableHead>Admin Status</TableHead>
                  <TableHead>Amendments</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStores.map((store) => {
                  const submission = submissionStatuses.find(s => s.store_id === store.store_id);
                  const totalAmendments = submission ? 
                    submission.store_amendment_count + submission.area_amendment_count + 
                    submission.regional_amendment_count + submission.admin_amendment_count : 0;
                  
                  return (
                    <TableRow key={store.store_id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{store.store_name}</div>
                          <div className="text-sm text-muted-foreground">{store.store_code}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {store.store_manager_first_name ? (
                          <div>
                            <div className="text-sm">{store.store_manager_first_name} {store.store_manager_last_name}</div>
                            <div className="text-xs text-muted-foreground">{store.store_manager_email}</div>
                          </div>
                        ) : (
                          <Badge variant="outline">No Manager</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {store.area_manager_first_name ? (
                          <div>
                            <div className="text-sm">{store.area_manager_first_name} {store.area_manager_last_name}</div>
                            <div className="text-xs text-muted-foreground">{store.area_manager_email}</div>
                          </div>
                        ) : (
                          <Badge variant="outline">No Manager</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {store.regional_manager_first_name ? (
                          <div>
                            <div className="text-sm">{store.regional_manager_first_name} {store.regional_manager_last_name}</div>
                            <div className="text-xs text-muted-foreground">{store.regional_manager_email}</div>
                          </div>
                        ) : (
                          <Badge variant="outline">No Manager</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(submission?.store_submission_status || 'not_submitted')}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(submission?.area_submission_status || 'not_submitted')}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(submission?.regional_submission_status || 'not_submitted')}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(submission?.admin_submission_status || 'not_submitted')}
                      </TableCell>
                      <TableCell>
                        {totalAmendments > 0 ? (
                          <Badge variant="outline" className="border-orange-500 text-orange-600">
                            {totalAmendments}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {submission?.area_submitted_at ? (
                          <div className="text-xs text-muted-foreground">
                            {formatDate(submission.area_submitted_at)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          
          {filteredStores.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No stores found matching current filters
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSubmissionTracking;