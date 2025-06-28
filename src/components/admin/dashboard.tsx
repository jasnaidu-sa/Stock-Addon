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
import { LogOut, Download, UserPlus, UserCircle } from 'lucide-react';
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

interface DashboardStats {
  total: number;
  pending: number;
  completed: number;
  cancelled: number;
  totalQuantity: number;
  totalValue: number;
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

  const { toast } = useToast();
  // useNavigate hook is available if needed
  const { isSignedIn, user } = useUser();
  const { signOut } = useClerk();

  useEffect(() => {
    // Only load dashboard data when user is signed in (Clerk is initialized)
    if (isSignedIn) {
      loadDashboardViewData();
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
    <div className="container mx-auto py-6">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      </div>
      
      {/* Enhanced Navigation Bar with User Profile - fixed size container */}
      <div className="bg-card border shadow-sm rounded-lg p-3 mb-6 w-full">
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.pending}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.completed}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.cancelled}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.totalQuantity}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</div></CardContent>
            </Card>
          </div>

          <Card className="mb-6">
            <CardContent className="flex items-center justify-between gap-4 pt-6">
                <Input
                    placeholder="Search Orders (Order#, Customer, Store, Status)..."
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    className="max-w-sm"
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

          <AdminOrderTable orders={filteredDashboardOrders} loading={loading} reloadOrders={loadDashboardViewData} />
        </>
      )}

      {activeSection === 'users' && (
        <AdminUserManagementPage />
      )}

      {activeSection === 'export' && (
        <ExportPage />
      )}

      {/* Removed unused sections */}
    </div>
  );
}
