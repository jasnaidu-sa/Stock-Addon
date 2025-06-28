import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Package2, ShoppingCart, Clock, AlertCircle, PackageCheck, DollarSign, Loader2, CheckCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";
import { useSupabase } from '@/hooks/use-supabase';
import { OrderTable } from '@/components/shared/order-table';
import { useToast } from '@/hooks/use-toast';
import { Order } from '@/types/order';

// Define a type for the raw order data from the database
interface RawOrder {
  id: string;
  created_at: string;
  user_id?: string;
  order_number?: string;
  status?: string;
  store_name?: string;
  description?: string;
  category?: string;
  quantity?: number;
  value?: number;
  [key: string]: any; // Allow for any other properties
}

interface DashboardStats {
  total: number;
  pending: number;
  completed: number;
  cancelled: number;
  review: number;
  totalQuantity: number;
  totalValue: number;
}

export function DashboardPage() {
  const { supabase, isLoading: isClientLoading, error: clientError } = useSupabase();
  const [orders, setOrders] = useState<Order[]>([]);
  // Combine both loading states - client initialization and data fetching
  const [isLoading, setIsLoading] = useState(true);
  const [showCompletedUserOrders, setShowCompletedUserOrders] = useState(false);
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    pending: 0,
    completed: 0,
    cancelled: 0,
    review: 0,
    totalQuantity: 0,
    totalValue: 0
  });

  // Show error message if Supabase client initialization failed
  useEffect(() => {
    if (clientError) {
      toast({
        title: 'Connection Error',
        description: 'Failed to connect to the database. Please try refreshing the page.',
        variant: 'destructive',
      });
    }
  }, [clientError, toast]);

  // Load dashboard data when Supabase client is ready
  useEffect(() => {
    if (supabase) {
      loadDashboardData();
    }
  }, [supabase]);

  async function loadDashboardData() {
    try {
      setIsLoading(true);
      
      // Check if Supabase client is available
      if (!supabase) {
        console.log('Supabase client not available yet, waiting for initialization');
        return;
      }
      
      console.log('Loading dashboard data with initialized Supabase client');
      
      // Clerk should be handling the top-level auth guard and JWT token for Supabase
      // All commented code related to session handling is no longer needed
      // as Clerk handles authentication and the JWT is passed to Supabase automatically

      // Fetch orders data
      console.log('Fetching orders data with Supabase client...');
      
      // Add a delay to avoid hammering the server during development
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Orders fetch error:', ordersError);
        console.error('Orders fetch error details:', {
          message: ordersError.message,
          code: ordersError.code,
          details: ordersError.details,
          hint: ordersError.hint
        });
        
        // Check if this is an authentication error
        if (ordersError.message?.includes('No API key found') || 
            ordersError.message?.includes('JWT') || 
            ordersError.message?.includes('Unauthorized') ||
            ordersError.message?.includes('401')) {
          toast({
            title: 'Authentication Error',
            description: 'Please sign in again to refresh your session.',
            variant: 'destructive',
          });
          // Consider redirecting to login or showing a sign-in prompt
        }
        
        throw ordersError;
      }
      
      console.log('Orders data response:', {
        hasData: !!ordersData,
        isArray: Array.isArray(ordersData),
        length: ordersData?.length || 0,
        sample: ordersData && ordersData.length > 0 ? ordersData[0] : null
      });

      // Fetch all order items for these orders
      const { data: allOrderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', ordersData.map((order: RawOrder) => order.id));

      if (itemsError) {
        console.error('Order items fetch error:', itemsError);
        throw itemsError;
      }

      if (ordersData && Array.isArray(ordersData)) {
        console.log('Orders data received:', ordersData.length, 'orders');
        // Enhance orders with customer information and items
        const ordersWithCustomers = await Promise.all(
          (ordersData as unknown as RawOrder[]).map(async (order) => {
            // Get items for this order
            const orderItems = allOrderItems.filter((item: any) => item.order_id === order.id);
            const orderTotal = orderItems.reduce((sum: number, item: any) => sum + (item.total || 0), 0);

            if (order.user_id) {
              const { data: userData, error: userError } = await supabase
                .from('users')
                .select('name')
                .eq('id', order.user_id)
                .single();
              
              if (!userError && userData) {
                return {
                  ...order,
                  customer_name: userData.name,
                  items: orderItems,
                  total: orderTotal || order.value || order.amount || order.price || 0,
                  status: order.status || 'pending',
                  order_number: order.order_number || `ORD-${order.id.substring(0, 8)}`,
                };
              }
            }
            return {
              ...order,
              customer_name: 'Unknown Customer',
              items: orderItems,
              total: orderTotal || order.value || order.amount || order.price || 0,
              status: order.status || 'pending',
              order_number: order.order_number || `ORD-${order.id.substring(0, 8)}`,
            };
          })
        );
        
        // Sort orders by date (newest first) to ensure they're always in correct order
        const sortedOrders = ordersWithCustomers.sort((a, b) => {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        
        console.log('Setting orders with customer data');
        setOrders(sortedOrders as unknown as Order[]);
      } else {
        console.log('No orders data received');
        setOrders([]);
      }

      if (ordersData) {
        console.log('Setting stats data');
        // Calculate total quantity and value
        const totalQuantity = ordersData?.reduce((sum, order) => sum + (order.quantity || 0), 0) || 0;
        const totalValue = ordersData?.reduce((sum, order) => sum + (order.value || 0), 0) || 0;
        
        setStats({
          total: ordersData.length,
          pending: ordersData.filter(order => order.status === 'pending').length,
          completed: ordersData.filter(order => order.status === 'completed').length,
          cancelled: ordersData.filter(order => order.status === 'cancelled').length,
          review: ordersData.filter(order => order.status === 'review').length,
          totalQuantity,
          totalValue
        });
      } else {
        console.log('No stats data received');
        setStats({
          total: 0,
          pending: 0,
          completed: 0,
          cancelled: 0,
          review: 0,
          totalQuantity: 0,
          totalValue: 0
        });
      }
    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
      // Log the full error object for debugging
      console.dir(error);
      
      let errorMessage = 'Failed to load dashboard data';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.error_description) {
        errorMessage = error.error_description;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Handle export to Excel functionality
  const handleExportToExcel = () => {
    try {
      if (filteredUserOrders.length === 0) {
        toast({
          title: "No orders to export",
          description: "There are no orders available to export.",
          variant: "destructive"
        });
        return;
      }

      // Create a worksheet from the filtered orders
      const worksheet = XLSX.utils.json_to_sheet(
        filteredUserOrders.map(order => ({
          'Order #': order.order_number || 'N/A',
          'Store': order.store_name || 'N/A',
          'Status': order.status || 'N/A',
          'Date': order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A',
          'Quantity': order.quantity || 0,
          'Value': `R ${order.value?.toLocaleString() || '0.00'}`,
        }))
      );

      // Create a workbook and add the worksheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'My Orders');

      // Generate the Excel file with the current date in the filename
      XLSX.writeFile(workbook, `My_Orders_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast({
        title: 'Export Successful',
        description: 'Your orders have been exported to Excel',
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: 'There was an error exporting your orders to Excel',
      });
    }
  };

  // Use useMemo to filter orders based on the toggle state
  const filteredUserOrders = useMemo(() => {
    if (showCompletedUserOrders) {
      return orders; // Show all orders if toggle is on
    } else {
      return orders.filter(order => order.status !== 'completed'); // Hide completed otherwise
    }
  }, [orders, showCompletedUserOrders]); // Dependencies

  // Show loading state when either client is initializing or data is loading
  const showLoading = isClientLoading || isLoading;

  if (showLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">
            {isClientLoading ? 'Connecting to database...' : 'Loading dashboard data...'}
          </p>
        </div>
      </div>
    );
  }

  if (clientError) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Connection Error</CardTitle>
          <CardDescription>
            Failed to connect to the database. Please try refreshing the page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => window.location.reload()}
            variant="outline"
          >
            Refresh Page
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        {/* Review Stats Card with Attention-Grabbing Design */}
        <Card className={`${stats.review > 0 ? 'bg-orange-50 border-orange-300' : ''}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Awaiting Approval</CardTitle>
            <Clock className={`h-4 w-4 ${stats.review > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.review > 0 ? 'text-orange-600' : ''}`}>
              {stats.review}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancelled Orders</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cancelled}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
            <PackageCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalQuantity}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R {stats.totalValue.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Recent Orders</CardTitle>
          <div className="flex space-x-2">
            {/* Export Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportToExcel}
              disabled={filteredUserOrders.length === 0}
            >
              <Download className="mr-2 h-4 w-4" /> Export to Excel
            </Button>
            
            {/* Toggle Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCompletedUserOrders(prev => !prev)}
            >
              {showCompletedUserOrders ? "Hide Completed" : "Show Completed"}
            </Button>
          </div>
        </CardHeader>
        {filteredUserOrders.length > 0 ? (
          <CardContent>
            <OrderTable 
              orders={filteredUserOrders}
              showActions={true} 
              onOrderUpdated={loadDashboardData} 
            />
          </CardContent>
        ) : (
          <CardContent>
            <Card className="p-8 text-center">
              <CardHeader>
                <CardTitle>No Orders Found</CardTitle>
                <CardDescription>
                  There are no orders in the system yet. Orders will appear here once they are created.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
              </CardContent>
            </Card>
          </CardContent>
        )}
      </Card>

      {/* Orders Needing Review */}
      <Card className="border-orange-300">
        <CardHeader className="bg-orange-50">
          <CardTitle className="flex items-center">
            <Clock className="h-5 w-5 mr-2 text-orange-500" />
            Orders Waiting for Your Approval
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orders.some(order => order.status === 'review') ? (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                The following orders have been modified and need your approval. Please review the changes and approve or reject them.
              </p>
              <OrderTable
                orders={orders.filter(order => order.status === 'review')}
                showActions={true}
                onOrderUpdated={loadDashboardData}
              />
            </>
          ) : (
            <div className="text-center py-8">
              <div className="mx-auto rounded-full bg-orange-50 p-3 w-16 h-16 flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-orange-500" />
              </div>
              <h3 className="text-lg font-medium mb-2">No Orders Need Review</h3>
              <p className="text-sm text-muted-foreground">
                All orders have been processed. You're all caught up!
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}