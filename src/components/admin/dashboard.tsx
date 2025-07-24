import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseClient } from '@/lib/supabase';
import { AdminOrderTable } from './admin-order-table';
// Import the new user management page
import AdminUserManagementPage from '@/pages/admin/user-management';
import { ExportPage } from '@/pages/admin/export'; // Import the new export page
import { formatCurrency } from '@/lib/utils';
// import { useNavigate } from 'react-router-dom'; // Commented out as not currently used
import { LogOut, Download, UserPlus, UserCircle, CheckCircle, XCircle, Clock, AlertTriangle, Edit3 } from 'lucide-react';
import * as XLSX from 'xlsx'; // Import xlsx library
import { useUser, useClerk } from '@clerk/clerk-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface DashboardStats {
  total: number;
  pending: number;
  completed: number;
  cancelled: number;
  totalQuantity: number;
  totalValue: number;
}

interface AmendmentStats {
  totalPending: number;
  storeManagerAmendments: number;
  areaManagerAmendments: number;
  regionalManagerAmendments: number;
  rejectedAmendments: number;
}

interface User {
  id: string;
  email: string;
  name?: string;
}

// Note: Category and status definitions have been moved to their respective utility files
// and are imported where needed to avoid duplication

// Define the possible values for activeSection
type ActiveSection = 'dashboard' | 'users' | 'export';

interface DashboardPageProps {
  initialSection?: ActiveSection;
}

export function DashboardPage({ initialSection = 'dashboard' }: DashboardPageProps = {}) {
  
  // Supabase client will be initialized when needed
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterValue, setFilterValue] = useState('');
  const [activeSection, setActiveSection] = useState<ActiveSection>(initialSection);
  const [showCompletedAdminOrders, setShowCompletedAdminOrders] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    pending: 0,
    completed: 0,
    cancelled: 0,
    totalQuantity: 0,
    totalValue: 0,
  });

  const [amendmentStats, setAmendmentStats] = useState<AmendmentStats>({
    totalPending: 0,
    storeManagerAmendments: 0,
    areaManagerAmendments: 0,
    regionalManagerAmendments: 0,
    rejectedAmendments: 0,
  });

  const [pendingAmendments, setPendingAmendments] = useState<any[]>([]);
  const [modifyDialogOpen, setModifyDialogOpen] = useState(false);
  const [selectedAmendment, setSelectedAmendment] = useState<any>(null);
  const [modifyQuantity, setModifyQuantity] = useState<number>(0);
  const [modifyReason, setModifyReason] = useState<string>('');

  const { toast } = useToast();
  // useNavigate hook is available if needed
  const { isSignedIn, user } = useUser();
  const { signOut } = useClerk();

  useEffect(() => {
    // Only load dashboard data when user is signed in (Clerk is initialized)
    if (isSignedIn) {
      loadDashboardViewData();
      loadAmendmentData();
    }
  }, [isSignedIn]);

  const loadDashboardViewData = async () => {
    setLoading(true);
    try {
      const supabaseClient = getSupabaseClient();
      if (!supabaseClient) {
        console.error('Supabase client not initialized');
        setLoading(false);
        return;
      }
      
      const { data: ordersData, error: ordersError } = await supabaseClient
        .from('orders')
        .select(`
          id, user_id, order_owner_id, order_number, store_name, category, status, created_at, value, quantity,
          order_items ( id, product_name, quantity, price, total, stock_item_id, code )
        `)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      if (ordersData) {
        const userIds = [...new Set([...ordersData.map(o => o.user_id), ...ordersData.map(o => o.order_owner_id)])].filter(Boolean);
        const { data: usersData, error: usersError } = await supabaseClient.from('users').select('id, email, name').in('id', userIds);
        if (usersError) console.error('Error fetching users:', usersError);
        
        const userMap: Record<string, User> = {};
        (usersData || []).forEach(user => {
          if (user && user.id) {
            userMap[user.id] = user;
          }
        });

        const processedOrders = ordersData.map(order => {
          const user = order.user_id ? userMap[order.user_id] : undefined;
          const owner = order.order_owner_id ? userMap[order.order_owner_id] : undefined;
          const customer_name = user ? user.name || user.email : 'Unknown';
          const owner_name = owner ? owner.name || owner.email : 'Unknown';
          const quantity = order.order_items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;
          const value = order.order_items?.reduce((sum: number, item: any) => sum + (item.total || 0), 0) || 0;
          return { ...order, items: order.order_items || [], user, owner, customer_name, owner_name, quantity, value, total: value };
        });

        setOrders(processedOrders);
        updateStats(processedOrders);
      }
    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
      toast({ title: 'Error', description: error.message || 'Failed to load dashboard data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const updateStats = (ordersToCount: any[]) => {
    const newStats = {
      total: ordersToCount.length,
      pending: ordersToCount.filter(order => order.status === 'pending').length,
      completed: ordersToCount.filter(order => order.status === 'completed').length,
      cancelled: ordersToCount.filter(order => order.status === 'cancelled').length,
      totalQuantity: ordersToCount.reduce((sum: number, order: any) => sum + (order.quantity || 0), 0),
      totalValue: ordersToCount.reduce((sum: number, order: any) => sum + (order.value || 0), 0),
    };
    setStats(newStats);
  };

  const loadAmendmentData = async () => {
    try {
      const supabaseClient = getSupabaseClient();
      if (!supabaseClient) {
        console.error('Supabase client not initialized');
        return;
      }

      // Load amendments pending admin approval
      const { data: amendmentsData, error: amendmentsError } = await supabaseClient
        .from('weekly_plan_amendments')
        .select(`
          *,
          users:user_id(id, email, name, role),
          stores:store_name(store_name, area_manager, regional_manager)
        `)
        .in('status', ['area_manager_approved', 'regional_direct', 'area_direct', 'submitted'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (amendmentsError) {
        console.error('Error loading amendments:', amendmentsError);
        return;
      }

      // Calculate amendment statistics
      const stats = {
        totalPending: amendmentsData?.length || 0,
        storeManagerAmendments: amendmentsData?.filter(a => a.users?.role === 'store_manager').length || 0,
        areaManagerAmendments: amendmentsData?.filter(a => a.users?.role === 'area_manager').length || 0,
        regionalManagerAmendments: amendmentsData?.filter(a => a.users?.role === 'regional_manager').length || 0,
        rejectedAmendments: 0, // Will be calculated when we add rejection tracking
      };

      setAmendmentStats(stats);
      setPendingAmendments(amendmentsData || []);

    } catch (error) {
      console.error('Error loading amendment data:', error);
    }
  };

  const handleQuickApproval = async (amendmentId: string, action: 'approve' | 'reject', reason?: string) => {
    try {
      const supabaseClient = getSupabaseClient();
      if (!supabaseClient) {
        toast({ title: 'Error', description: 'Database connection not available', variant: 'destructive' });
        return;
      }

      const updateData = {
        status: action === 'approve' ? 'admin_approved' : 'admin_rejected',
        admin_notes: reason || '',
        admin_approved_at: action === 'approve' ? new Date().toISOString() : null,
        admin_rejected_at: action === 'reject' ? new Date().toISOString() : null,
        admin_approved_by: user?.id || '',
      };

      const { error } = await supabaseClient
        .from('weekly_plan_amendments')
        .update(updateData)
        .eq('id', amendmentId);

      if (error) {
        console.error('Error updating amendment:', error);
        toast({ title: 'Error', description: 'Failed to update amendment', variant: 'destructive' });
        return;
      }

      toast({ 
        title: 'Success', 
        description: `Amendment ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      });

      // Reload amendment data
      loadAmendmentData();

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
      const supabaseClient = getSupabaseClient();
      if (!supabaseClient) {
        toast({ title: 'Error', description: 'Database connection not available', variant: 'destructive' });
        return;
      }

      // First, get the original amendment data
      const { data: originalAmendment, error: fetchError } = await supabaseClient
        .from('weekly_plan_amendments')
        .select('*')
        .eq('id', originalAmendmentId)
        .single();

      if (fetchError || !originalAmendment) {
        console.error('Error fetching original amendment:', fetchError);
        toast({ title: 'Error', description: 'Could not retrieve original amendment', variant: 'destructive' });
        return;
      }

      // Mark original amendment as admin_modified
      const { error: updateError } = await supabaseClient
        .from('weekly_plan_amendments')
        .update({
          status: 'admin_modified',
          admin_notes: `Modified by admin. Original quantity: ${originalAmendment.quantity}, Modified to: ${modifiedQuantity}. Reason: ${modificationReason}`,
          admin_approved_at: new Date().toISOString(),
          admin_approved_by: user?.id || '',
        })
        .eq('id', originalAmendmentId);

      if (updateError) {
        console.error('Error updating original amendment:', updateError);
        toast({ title: 'Error', description: 'Failed to update original amendment', variant: 'destructive' });
        return;
      }

      // Create new "admin_amended" record
      const { error: insertError } = await supabaseClient
        .from('weekly_plan_amendments')
        .insert({
          user_id: user?.id || '',
          store_name: originalAmendment.store_name,
          week_reference: originalAmendment.week_reference,
          product_name: originalAmendment.product_name,
          category: originalAmendment.category,
          quantity: modifiedQuantity,
          amendment_type: 'admin_amended',
          justification: `Admin modification of amendment ${originalAmendmentId}. ${modificationReason}`,
          status: 'admin_approved',
          admin_approved_at: new Date().toISOString(),
          admin_approved_by: user?.id || '',
          original_amendment_id: originalAmendmentId,
          admin_notes: `Admin modified from ${originalAmendment.quantity} to ${modifiedQuantity}`,
        });

      if (insertError) {
        console.error('Error creating admin amended record:', insertError);
        toast({ title: 'Error', description: 'Failed to create admin amendment record', variant: 'destructive' });
        return;
      }

      toast({ 
        title: 'Success', 
        description: `Amendment modified and approved. Quantity changed from ${originalAmendment.quantity} to ${modifiedQuantity}`,
      });

      // Reload amendment data
      loadAmendmentData();

    } catch (error) {
      console.error('Error in amendment modification:', error);
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' });
    }
  };

  const openModifyDialog = (amendment: any) => {
    setSelectedAmendment(amendment);
    setModifyQuantity(amendment.quantity);
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

  const handleExportToExcel = async () => {
    try {
      if (filteredDashboardOrders.length === 0) {
        toast({
          title: "No orders to export",
          description: "There are no orders that match your filter criteria.",
          variant: "destructive"
        });
        return;
      }

      const supabaseClient = getSupabaseClient();
      if (!supabaseClient) {
        toast({
          title: "Error",
          description: "Could not initialize database connection.",
          variant: "destructive"
        });
        return;
      }

      // We'll use the already loaded and filtered orders for export
      console.log('Exporting orders:', filteredDashboardOrders.length);

      // Create a worksheet from the filtered orders
      const worksheet = XLSX.utils.json_to_sheet(
        filteredDashboardOrders.map(order => ({
          'Order #': order.order_number || 'N/A',
          'Store': order.store_name || 'N/A',
          'Status': order.status || 'N/A',
          'Date': order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A',
          'Quantity': order.quantity || 0,
          'Value': order.value ? formatCurrency(order.value) : 'R0.00',
        }))
      );

      // Create a workbook and add the worksheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');

      // Generate the Excel file
      XLSX.writeFile(workbook, `Orders_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast({
        title: 'Export Successful',
        description: 'Orders have been exported to Excel',
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: 'There was an error exporting orders to Excel',
      });
    }
  };

  const handleLogout = async () => {
    try {
      // Sign out using Clerk and redirect to clerk login page
      await signOut({ redirectUrl: '/clerk-login' });
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const filteredDashboardOrders = useMemo(() => {
    return orders.filter(order => {
      if (order.status === 'completed' && !showCompletedAdminOrders) {
          return false;
      }
      const searchStr = filterValue.toLowerCase();
      const matchesSearch = !searchStr ||
        order.order_number?.toLowerCase().includes(searchStr) ||
        order.customer_name?.toLowerCase().includes(searchStr) ||
        order.store_name?.toLowerCase().includes(searchStr) ||
        order.status?.toLowerCase().includes(searchStr);

      return matchesSearch;
    });
  }, [orders, filterValue, showCompletedAdminOrders]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h2>
      </div>
      
      {/* Enhanced Navigation Bar with User Profile - fixed size container */}
      <div className="bg-card border shadow-sm rounded-lg p-3 w-full">
        <div className="flex items-center justify-between flex-nowrap">
          <nav className="flex items-center space-x-2 overflow-x-auto flex-shrink-0">
            <Button
              variant={activeSection === 'dashboard' ? 'default' : 'outline'}
              onClick={() => setActiveSection('dashboard')}
              size="default"
              className="font-medium flex-shrink-0 whitespace-nowrap"
            >
              Dashboard
            </Button>
            <Button
              variant={activeSection === 'users' ? 'default' : 'outline'}
              onClick={() => setActiveSection('users')}
              size="default"
              className="font-medium flex-shrink-0 whitespace-nowrap"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              User Management
            </Button>
            <Button
              variant={activeSection === 'export' ? 'default' : 'outline'}
              onClick={() => setActiveSection('export')}
              size="default"
              className="font-medium flex-shrink-0 whitespace-nowrap"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Orders
            </Button>
          </nav>
          
          {/* User profile dropdown */}
          <div className="ml-auto">
            {isSignedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.imageUrl} alt={user?.fullName || 'User'} />
                      <AvatarFallback>{user?.firstName?.charAt(0) || user?.fullName?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline-block">{user?.firstName || user?.fullName?.split(' ')[0] || 'User'}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.fullName || 'User'}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.primaryEmailAddress?.emailAddress}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <a href="/clerk-login">
                  <UserCircle className="h-4 w-4 mr-2" />
                  Sign In
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      {activeSection === 'dashboard' && (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold mt-2">{stats.total}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold mt-2">{stats.pending}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold mt-2">{stats.completed}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold mt-2">{stats.cancelled}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold mt-2">{stats.totalQuantity}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold mt-2">{formatCurrency(stats.totalValue)}</div></CardContent>
            </Card>
          </div>

          {/* Amendment Approval Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Pending Approvals</h3>
            
            {/* Amendment Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-orange-800">Total Pending</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-900">{amendmentStats.totalPending}</div>
                  <p className="text-xs text-orange-600 mt-1">Awaiting admin approval</p>
                </CardContent>
              </Card>
              
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-blue-800">Regional Manager</CardTitle>
                  <Clock className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-900">{amendmentStats.regionalManagerAmendments}</div>
                  <p className="text-xs text-blue-600 mt-1">Direct amendments</p>
                </CardContent>
              </Card>
              
              <Card className="border-green-200 bg-green-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-green-800">Area Manager</CardTitle>
                  <Clock className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-900">{amendmentStats.areaManagerAmendments}</div>
                  <p className="text-xs text-green-600 mt-1">Direct amendments</p>
                </CardContent>
              </Card>
              
              <Card className="border-purple-200 bg-purple-50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-purple-800">Store Manager</CardTitle>
                  <Clock className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-900">{amendmentStats.storeManagerAmendments}</div>
                  <p className="text-xs text-purple-600 mt-1">Via area manager</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Amendments List */}
            {pendingAmendments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent Pending Amendments</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingAmendments.slice(0, 5).map((amendment) => (
                    <div key={amendment.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{amendment.stores?.store_name}</span>
                          <span className="text-sm text-gray-500">•</span>
                          <span className="text-sm text-gray-600">{amendment.product_name}</span>
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {amendment.amendment_type} • Qty: {amendment.quantity} • 
                          By: {amendment.users?.name || amendment.users?.email}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-blue-600 border-blue-300 hover:bg-blue-50"
                          onClick={() => openModifyDialog(amendment)}
                        >
                          <Edit3 className="h-4 w-4 mr-1" />
                          Modify
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-300 hover:bg-green-50"
                          onClick={() => handleQuickApproval(amendment.id, 'approve')}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-300 hover:bg-red-50"
                          onClick={() => handleQuickApproval(amendment.id, 'reject', 'Rejected from dashboard')}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                  {pendingAmendments.length > 5 && (
                    <div className="text-center pt-2">
                      <Button 
                        variant="link" 
                        onClick={() => window.open('/admin/amendment-management', '_blank')}
                      >
                        View all {amendmentStats.totalPending} pending amendments →
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {pendingAmendments.length === 0 && (
              <Card>
                <CardContent className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h4>
                  <p className="text-gray-500">No amendments pending your approval at this time.</p>
                </CardContent>
              </Card>
            )}
          </div>

          <Card>
            <CardContent className="flex items-center justify-between gap-4 py-6">
                <Input
                    placeholder="Search Orders (Order#, Customer, Store, Status)..."
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    className="w-72"
                />
                <div className="flex gap-2">
                  <Button
                      variant="secondary"
                      onClick={() => setShowCompletedAdminOrders(!showCompletedAdminOrders)}
                      size="sm"
                  >
                      {showCompletedAdminOrders ? "Hide Completed" : "Show Completed"}
                  </Button>
                  
                  <Button
                      variant="secondary"
                      onClick={handleExportToExcel}
                      size="sm"
                  >
                      <Download className="h-4 w-4 mr-2" />
                      Export to Excel
                  </Button>
                </div>
            </CardContent>
          </Card>

          <AdminOrderTable initialOrders={filteredDashboardOrders} reloadOrders={loadDashboardViewData} />
        </>
      )}

      {activeSection === 'users' && (
        <AdminUserManagementPage />
      )}

      {activeSection === 'export' && (
        <ExportPage />
      )}

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
                <div className="text-sm font-medium">{selectedAmendment.stores?.store_name}</div>
                <div className="text-sm text-gray-600">{selectedAmendment.product_name}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Original Type: {selectedAmendment.amendment_type} • 
                  Requested by: {selectedAmendment.users?.name || selectedAmendment.users?.email}
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
                  Original quantity: {selectedAmendment.quantity}
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

      {/* Removed unused sections */}
    </div>
  );
}
