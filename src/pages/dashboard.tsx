import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Package2, ShoppingCart, Clock, AlertCircle, PackageCheck, DollarSign, Loader2 } from 'lucide-react';
import { useSupabase } from '@/hooks/use-supabase';
import { useToast } from '@/hooks/use-toast';
import { Order } from '@/types/order';
import { Button } from "@/components/ui/button";
import { OrderTable } from '@/components/shared/order-table';

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
  const { userId } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCompletedOrders, setShowCompletedOrders] = useState(true);
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
    if (clientError) {
      toast({
        title: 'Connection Error',
        description: 'Failed to connect to the database. Please try refreshing the page.',
        variant: 'destructive',
      });
    }
  }, [clientError, toast]);

  useEffect(() => {
    if (supabase && userId) {
      loadDashboardData();
    }
  }, [supabase, userId]);

  async function loadDashboardData() {
    try {
      setIsLoading(true);
      if (!supabase || !userId) {
        setIsLoading(false);
        return;
      }

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders_with_user_details')
        .select('*')
        .eq('clerk_id', userId)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      if (ordersData && ordersData.length > 0) {
        const orderIds = ordersData.map((order: RawOrder) => order.id);
        const { data: allOrderItems, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds);

        if (itemsError) throw itemsError;

        const ordersWithItems = ordersData.map((order: RawOrder) => {
          const orderItems = allOrderItems.filter((item: any) => item.order_id === order.id);
          
          // Calculate the total value for this order
          const totalValue = orderItems.reduce((sum, item) => {
            return sum + (item.price || 0) * (item.quantity || 0);
          }, 0);

          // Calculate the total quantity
          const totalQuantity = orderItems.reduce((sum, item) => {
            return sum + (item.quantity || 0);
          }, 0);
          
          return {
            ...order,
            order_items: orderItems,
            total: totalValue,    // Add the calculated total value
            quantity: totalQuantity  // Add the calculated total quantity
          };
        });
        
        setOrders(ordersWithItems as unknown as Order[]);
      } else {
        setOrders([]);
      }
    } catch (error: any) {
      toast({ title: 'Error fetching data', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }
  
  const calculateStats = (ordersToStat: Order[]) => {
    const total = ordersToStat.length;
    const pending = ordersToStat.filter(o => o.status === 'pending').length;
    const completed = ordersToStat.filter(o => o.status === 'completed').length;
    const cancelled = ordersToStat.filter(o => o.status === 'cancelled').length;
    const review = ordersToStat.filter(o => o.status === 'review').length;
    
    let totalQuantity = 0;
    let totalValue = 0;
    
    ordersToStat.forEach(order => {      
      if (order.order_items && order.order_items.length > 0) {
        const orderQuantity = order.order_items.reduce((qAcc, item) => qAcc + (item.quantity || 0), 0);
        const orderValue = order.order_items.reduce((vAcc, item) => vAcc + (item.price || 0) * (item.quantity || 0), 0);
        totalQuantity += orderQuantity;
        totalValue += orderValue;
      }
    });
    
    const newStats: DashboardStats = {
      total,
      pending,
      completed,
      cancelled,
      review,
      totalQuantity,
      totalValue,
    };
    
    setStats(newStats);
  };

  useEffect(() => {
    calculateStats(orders);
  }, [orders]);



  if (isLoading || isClientLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  // Filter orders to show/hide completed orders based on user preference
  const filteredOrders = showCompletedOrders 
    ? orders 
    : orders.filter(order => order.status !== 'completed');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard Overview</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
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
            <div className="text-2xl font-bold text-right">R {stats.totalValue.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
      </div>

      {/* Add the order list back to the dashboard */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Your order history.</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCompletedOrders(prev => !prev)}
          >
            {showCompletedOrders ? "Hide Completed" : "Show Completed"}
          </Button>
        </CardHeader>
        <CardContent>
          <OrderTable 
            orders={filteredOrders} 
            showActions={true}
            onOrderUpdated={loadDashboardData}
          />
        </CardContent>
      </Card>
    </div>
  );
}