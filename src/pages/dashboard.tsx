import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package2, ShoppingCart, Clock, AlertCircle, PackageCheck, DollarSign } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { supabase } from '@/lib/supabase';
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
  const [orders, setOrders] = useState<Order[]>([]);
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

  useEffect(() => {
    loadDashboardData();
  }, [toast]);

  async function loadDashboardData() {
    try {
      // Get current user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw sessionError;
      }

      if (!session?.user) {
        console.error('No authenticated user found');
        toast({
          title: 'Authentication Required',
          description: 'Please log in to access the dashboard.',
          variant: 'destructive',
        });
        // Redirect to login
        window.location.href = '/login';
        return;
      }

      console.log('User authenticated:', session.user.id);

      // Get user data with regular client
      let { data: userData, error: userError } = await supabase.rpc('get_user_role', {
        user_id: session.user.id
      });

      if (userError) {
        console.error('User role fetch error:', userError);
        throw userError;
      }

      if (!userData || !Array.isArray(userData) || userData.length === 0) {
        console.error('No user data found');
        throw new Error('User data not found');
      }

      const userInfo = userData[0];
      console.log('User role:', userInfo.role);

      // If user is not active, redirect to login
      if (userInfo.status !== 'active') {
        console.log('User is not active, redirecting to login');
        window.location.href = '/login';
        return;
      }

      // Use regular client with RLS policies
      const client = supabase;

      // Fetch orders data
      const { data: ordersData, error: ordersError } = await client
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Orders fetch error:', ordersError);
        throw ordersError;
      }

      // Fetch all order items for these orders
      const { data: allOrderItems, error: itemsError } = await client
        .from('order_items')
        .select('*')
        .in('order_id', ordersData.map(order => order.id));

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
            const orderItems = allOrderItems.filter(item => item.order_id === order.id);
            const orderTotal = orderItems.reduce((sum, item) => sum + (item.total || 0), 0);

            if (order.user_id) {
              const { data: userData, error: userError } = await client
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

  // Use useMemo to filter orders based on the toggle state
  const filteredUserOrders = useMemo(() => {
    if (showCompletedUserOrders) {
      return orders; // Show all orders if toggle is on
    } else {
      return orders.filter(order => order.status !== 'completed'); // Hide completed otherwise
    }
  }, [orders, showCompletedUserOrders]); // Dependencies

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
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
          {/* Toggle Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCompletedUserOrders(prev => !prev)}
          >
            {showCompletedUserOrders ? "Hide Completed" : "Show Completed"}
          </Button>
        </CardHeader>
        <CardContent>
          <OrderTable 
            orders={filteredUserOrders}
            showActions={true} 
            onOrderUpdated={loadDashboardData} 
          />
        </CardContent>
      </Card>

      {/* Orders Needing Review */}
      {orders.some(order => order.status === 'review') && (
        <Card className="border-orange-300">
          <CardHeader className="bg-orange-50">
            <CardTitle className="flex items-center">
              <Clock className="h-5 w-5 mr-2 text-orange-500" />
              Orders Waiting for Your Approval
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              The following orders have been modified and need your approval. Please review the changes and approve or reject them.
            </p>
            <OrderTable 
              orders={orders.filter(order => order.status === 'review')} 
              showActions={true}
              onOrderUpdated={loadDashboardData}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}