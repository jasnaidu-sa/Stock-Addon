import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Package2, ShoppingCart, Clock, PackageCheck, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { AdminOrderTable } from '@/components/admin/admin-order-table';
import type { Order } from '@/types/order';
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

export function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterValue, setFilterValue] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    pending: 0,
    completed: 0,
    cancelled: 0,
    totalQuantity: 0,
    totalValue: 0
  });

  useEffect(() => {
    loadOrders();
  }, [toast]);

  async function loadOrders() {
    setLoading(true);
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          user_id,
          store_name
        `)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          id, 
          order_id, 
          product_id, 
          product_name, 
          quantity, 
          price, 
          total, 
          stock_item_id, 
          notes, 
          status, 
          category, 
          mattress_code, 
          code
        `)
        .in('order_id', ordersData?.map(order => order.id) || []);

      if (itemsError) throw itemsError;

      const ordersWithItems = (ordersData || []).map(order => ({
        ...order,
        items: (orderItems || []).filter(item => item.order_id === order.id)
      }));

      setOrders(ordersWithItems);

      // Calculate stats based on the *fetched* orders, before filtering for display
      const fetchedOrders = ordersWithItems;
      const totalQuantity = fetchedOrders.reduce((sum, order) => sum + (order.quantity || 0), 0);
      const totalValue = fetchedOrders.reduce((sum, order) => sum + (order.value || 0), 0);

      setStats({
        total: fetchedOrders.length,
        pending: fetchedOrders.filter(order => order.status === 'pending').length,
        completed: fetchedOrders.filter(order => order.status === 'completed').length,
        cancelled: fetchedOrders.filter(order => order.status === 'cancelled').length,
        totalQuantity,
        totalValue
      });
    } catch (error) {
      console.error('Error loading orders:', error);
      toast({
        title: 'Error',
        description: 'Failed to load orders',
        variant: 'destructive',
      });
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  // Apply filtering for display
  const filteredOrders = orders.filter(order => {
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
      {/* Dashboard Stats */}
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

      {/* Orders Table Section */}
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
                id="show-completed-admin"
                checked={showCompleted}
                onCheckedChange={setShowCompleted}
              />
              <Label htmlFor="show-completed-admin">Show Completed</Label>
            </div>
          </div>
        </div>
        <AdminOrderTable 
          orders={filteredOrders}
          reloadOrders={loadOrders}
          loading={loading}
        />
      </div>
    </div>
  );
} 