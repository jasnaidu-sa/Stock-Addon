import { useEffect, useState, useCallback } from 'react';
import { useAuth } from "@clerk/clerk-react";
import { Package2, ShoppingCart, Clock, PackageCheck, DollarSign } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseClient } from '@/lib/supabase'; 
import { AdminOrderTable } from '@/components/admin/admin-order-table';
import type { Order, OrderItem } from '@/types/order';

// Simplified Product type for this page, matching expected structure for AdminOrderTable
interface Product {
  id: string; 
  name: string;
  price: number;
  product_id: string; 
  code?: string;
  stock_item_id?: string;
}
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface DashboardStats {
  total: number;
  pending: number;
  completed: number;
  cancelled: number;
  totalQuantity: number;
  totalValue: number;
}

export default function DashboardPage() {
  console.log('!!! ORDERS.TSX - DashboardPage Component Rendering - TOP LEVEL LOG !!!');
  const { isLoaded, isSignedIn } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterValue, setFilterValue] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [productCodes, setProductCodes] = useState<Product[]>([]);
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    pending: 0,
    completed: 0,
    cancelled: 0,
    totalQuantity: 0,
    totalValue: 0
  });

  const loadOrders = useCallback(async () => {
    console.log('[OrdersPage DEBUG] loadOrders: Function Entered.');
    setLoading(true);
    console.log('[OrdersPage DEBUG] loadOrders: setLoading(true) executed.');

    const supabase = getSupabaseClient();
    console.log('[OrdersPage DEBUG] loadOrders: getSupabaseClient() result -', supabase ? 'ClientInstance' : 'null');

    if (!supabase) {
      console.error('[OrdersPage DEBUG] loadOrders: Supabase client is null. Aborting data fetch for now.');
      setLoading(false);
      console.log('[OrdersPage DEBUG] loadOrders: Supabase client null, setLoading(false) executed, returning.');
      toast({ title: 'Connection Error', description: 'Supabase client not available for loading orders.', variant: 'destructive' });
      return;
    }

    console.log(`[OrdersPage DEBUG] loadOrders: Supabase client OK. Proceeding to fetch orders at ${new Date().toISOString()}`);
    try {
      const { data, error: ordersError } = await supabase
        .from('orders_with_user_details') // Query the new view
        .select(`
          *,
          order_items ( * ) // order_items are still joined from the original orders table via the view
        `)
        .order('created_at', { ascending: false });

      const ordersData = data as unknown as Order[]; // Cast to unknown first, then to Order[]

      if (ordersError) {
        console.error('[OrdersPage DEBUG] loadOrders: Error fetching ordersData -', ordersError);
        throw ordersError;
      }
      console.log('[OrdersPage DEBUG] loadOrders: Fetched ordersData -', ordersData ? `${ordersData.length} orders` : 'null/undefined');

      // Fetch history for orders in 'review' status
      for (const order of ordersData) {
        if (order.status === 'review' && order.order_items) {
          console.log(`[OrdersPage DEBUG] Found order in 'review': ${order.id}. Fetching item history.`);
          for (const item of order.order_items) {
            const { data: historyData, error: historyError } = await supabase
              .from('order_history')
              .select('*')
              .eq('order_line_id', item.id)
              .order('created_at', { ascending: false });

            if (historyError) {
              console.error(`[OrdersPage DEBUG] Error fetching history for item ${item.id}:`, historyError);
            } else if (historyData && historyData.length > 0) {
              // The history property needs to be defined on the OrderItem type
              // Ensure history is sorted correctly (most recent first) by created_at timestamp
              const sortedHistory = [...historyData].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              item.history = sortedHistory; // Assign sorted history to the item

              // If the most recent history item (from sorted list) is a removal, update the item's current state
              if (sortedHistory.length > 0 && sortedHistory[0].action_type === 'ITEM_REMOVED') {
                console.log(`[OrdersPage DEBUG] Item ${item.id} (${item.product_name}) latest history (after explicit sort) is REMOVED. Original qty before removal: ${sortedHistory[0].original_qty}. Setting current item.quantity and item.total to 0.`);
                item.quantity = 0;
                item.total = 0; 
              }
              console.log(`[OrdersPage DEBUG] Attached history to item ${item.id}:`, historyData);
            }
          }
        }
      }

      const ordersWithItemsAndUsers = (ordersData || []).map((order: Order) => {
        // Directly use first_name and last_name from the order object (from the view)
        // The view 'orders_with_user_details' already joins users and provides these fields.
        let customerName = `${order.first_name || ''} ${order.last_name || ''}`.trim();
        if (!customerName) {
          customerName = order.store_name || 'N/A'; // Fallback to store_name if first/last name are blank, then N/A
        }

        // Calculate total items and value for this order
        const total_items = order.order_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
        const total_value = order.order_items?.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0) || 0;
        
        return {
          ...order,
          customer_name: customerName, // Use the derived customerName
          // associated_user is no longer needed here as user details are top-level
          total_items,
          total_value,
        };
      });

      console.log('[OrdersPage DEBUG] loadOrders: Successfully merged orders with items and user data.');
      setOrders(ordersWithItemsAndUsers);

      const allProductsMap = new Map<string, Product>();
      ordersWithItemsAndUsers.forEach((order: Order) => {
        order.items?.forEach((item: OrderItem) => {
          const productCode = item.code || item.mattress_code;
          // Ensure stock_item_id is a valid string before proceeding
          if (productCode && typeof item.stock_item_id === 'string' && item.stock_item_id.length > 0 && !allProductsMap.has(item.stock_item_id)) {
            allProductsMap.set(item.stock_item_id, {
              id: item.stock_item_id, 
              name: item.product_name,
              price: item.price,
              product_id: item.stock_item_id, // Use stock_item_id as product_id for the Product object
              code: productCode,
              stock_item_id: item.stock_item_id,
            });
          }
        });
      });
      setProductCodes(Array.from(allProductsMap.values()));
      console.log('[OrdersPage DEBUG] loadOrders: Product codes extracted and set.');

      let totalRevenue = 0;
      let pending = 0;
      let completed = 0;
      let cancelled = 0; 
      let totalQuantity = 0;

      ordersWithItemsAndUsers.forEach((order: Order) => { 
        totalRevenue += order.value || 0;
        order.items?.forEach((item: OrderItem) => {
          totalQuantity += item.quantity || 0;
        });

        if (order.status === 'completed') {
          completed++;
        } else if (order.status === 'cancelled') {
          cancelled++;
        } else {
          pending++;
        }
      });

      setStats({
        total: ordersWithItemsAndUsers.length,
        pending: pending,
        completed: completed,
        cancelled: cancelled,
        totalQuantity: totalQuantity,
        totalValue: totalRevenue,
      });
      console.log('[OrdersPage DEBUG] loadOrders: Stats updated.');

    } catch (error: any) {
      console.error('[OrdersPage DEBUG] loadOrders: CATCH block error -', error);
      toast({
        title: 'Error Loading Orders',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
      setOrders([]);
      setStats({ total: 0, pending: 0, completed: 0, cancelled: 0, totalQuantity: 0, totalValue: 0 });
      console.log('[OrdersPage DEBUG] loadOrders: CATCH block, setOrders([]) and reset stats executed.');
    } finally {
      console.log('[OrdersPage DEBUG] loadOrders: FINALLY block entered.');
      setLoading(false);
      console.log('[OrdersPage DEBUG] loadOrders: FINALLY block, setLoading(false) executed.');
    }
  }, [setOrders, setLoading, setStats, toast]);

  useEffect(() => {
    if (isLoaded) { 
      console.log('[OrdersPage DEBUG v2] Mount useEffect: Clerk is loaded. Now triggering loadOrders.');
      if (isSignedIn) { 
        loadOrders();
      } else {
        console.log('[OrdersPage DEBUG v2] User not signed in. Not loading orders.');
        setLoading(false); 
        // toast({ title: 'Authentication Required', description: 'Please sign in to view orders.', variant: 'destructive' });
      }
    } else {
      console.log('[OrdersPage DEBUG v2] Mount useEffect: Clerk not yet loaded. Waiting to call loadOrders.');
    }
  }, [isLoaded, isSignedIn, loadOrders]); 

  const filteredOrders = orders.filter((order: Order) => {
    const matchesFilter = 
      (!filterValue) || 
      order.order_number?.toLowerCase().includes(filterValue.toLowerCase()) ||
      order.store_name?.toLowerCase().includes(filterValue.toLowerCase());
    
    const matchesCompletionStatus = showCompleted || order.status !== 'completed';

    return matchesFilter && matchesCompletionStatus;
  });

  if (loading) {
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
            <ShoppingCart className="h-4 w-4 text-muted-foreground" /> 
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

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Input
              placeholder="Filter orders..."
              value={filterValue}
              onChange={(event) => setFilterValue(event.target.value)}
              className="max-w-sm"
            />
            <div className="flex items-center space-x-2">
              <Switch 
                id="show-completed-admin-orders" 
                checked={showCompleted}
                onCheckedChange={setShowCompleted}
              />
              <Label htmlFor="show-completed-admin-orders">Show Completed</Label>
            </div>
          </div>
        </div>
        <AdminOrderTable 
          initialOrders={filteredOrders}
          reloadOrders={loadOrders}
          initialProductCodes={productCodes}
        />
    </div>
  </div>
);
}