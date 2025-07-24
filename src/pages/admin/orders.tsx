import { useEffect, useState, useCallback } from 'react';


import { useAuth } from "@clerk/clerk-react";
import { Package2, Clock, AlertCircle, DollarSign } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { useToast } from '@/hooks/use-toast';
import { getSupabaseClient } from '@/lib/supabase'; 
import { AdminOrderTable } from '@/components/admin/admin-order-table';
import type { Order } from '@/types/order';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function AdminOrdersPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  const [loading, setLoading] = useState(true);
  const [filterValue, setFilterValue] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [productCodes, setProductCodes] = useState<Record<string, { code: string; category: string; }>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast } = useToast();

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      toast({ title: 'Connection Error', description: 'Supabase client not available.', variant: 'destructive' });
      return;
    }
    try {
      const { data, error: ordersError } = await supabase
        .from('orders_with_user_details')
        .select(`*, order_items ( * )`)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      const ordersData = (data as unknown as Order[] || []).map(order => ({
        ...order,
        customer_name: `${order.first_name || ''} ${order.last_name || ''}`.trim() || 'N/A',
      }));

      const reviewOrderLineIds = ordersData
        .filter(order => order.status === 'review' && order.order_items)
        .flatMap(order => order.order_items!.map(item => item.id));

      let finalOrdersData = ordersData;

      if (reviewOrderLineIds.length > 0) {
        const { data: allHistoryData, error: allHistoryError } = await supabase
          .from('order_history')
          .select('*')
          .in('order_line_id', reviewOrderLineIds);

        if (allHistoryError) throw allHistoryError;

        const historyMap = new Map<string, any[]>();
        allHistoryData?.forEach(history => {
          if (!historyMap.has(history.order_line_id)) {
            historyMap.set(history.order_line_id, []);
          }
          historyMap.get(history.order_line_id)!.push(history);
        });

        finalOrdersData = ordersData.map(order => {
          if (order.status === 'review' && order.order_items) {
            const newOrderItems = order.order_items.map(item => ({
              ...item,
              order_history: historyMap.get(item.id) || []
            }));
            return { ...order, order_items: newOrderItems };
          }
          return order;
        });
      }

      setOrders(finalOrdersData);

      // Build productCodes map from all order items
      const newProductCodes: Record<string, { code: string; category: string; }> = {};
      finalOrdersData.forEach(order => {
        order.order_items?.forEach(item => {
          if (item.product_id && !newProductCodes[item.product_id]) {
            newProductCodes[item.product_id] = {
              code: item.code || 'N/A',
              category: item.category || 'N/A'
            };
          }
        });
      });
      setProductCodes(newProductCodes);

    } catch (error: any) {
      console.error('Error loading orders:', error);
      toast({ 
        title: 'Error Loading Orders', 
        description: error.message || 'Failed to load orders from database', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  }, [toast, setOrders, setProductCodes, setLoading]);

  const triggerReload = () => {
    console.log('[OrdersPage DEBUG] triggerReload called. Incrementing refreshKey.');
    setRefreshKey(prev => prev + 1);
  };

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      console.log(`[OrdersPage DEBUG] useEffect triggered. Key: ${refreshKey}`);
      loadOrders();

    }
  }, [isLoaded, isSignedIn, refreshKey, loadOrders]);

  const filteredOrders = orders.filter(order => {
    const matchesFilter = filterValue === '' ||
      order.customer_name?.toLowerCase().includes(filterValue.toLowerCase()) ||
      order.order_number?.toLowerCase().includes(filterValue.toLowerCase());
    const matchesCompletedToggle = showCompleted || order.status !== 'completed';
    return matchesFilter && matchesCompletedToggle;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center">
          <Package2 className="h-12 w-12 animate-pulse text-gray-400" />
          <p className="text-lg text-gray-600 mt-4">Loading Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  // Simple stats calculation
  const calculateStats = () => {
    if (!orders || !Array.isArray(orders)) {
      return {
        total: 0,
        pending: 0,
        approved: 0,
        completed: 0,
        review: 0,
        cancelled: 0,
        totalValue: 0
      };
    }

    return {
      total: orders.length,
      pending: orders.filter(order => order?.status === 'pending').length,
      approved: orders.filter(order => order?.status === 'approved').length,
      completed: orders.filter(order => order?.status === 'completed').length,
      review: orders.filter(order => order?.status === 'review').length,
      cancelled: orders.filter(order => order?.status === 'cancelled').length,
      totalValue: orders.reduce((sum, order) => sum + (order?.value || 0), 0)
    };
  };
  
  const stats = calculateStats();

  return (
    <div className="space-y-6">
      {/* Dashboard Stats Tiles */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            <CardTitle className="text-sm font-medium">Under Review</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.review}</div>
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

      {/* Manage Orders Table */}
      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle>Manage Orders</CardTitle>
          <div className="flex items-center space-x-4">
            <Input
              placeholder="Filter orders by customer or ID..."
              value={filterValue}
              onChange={(event) => setFilterValue(event.target.value)}
              className="max-w-sm h-8"
            />
            <div className="flex items-center space-x-2">
              <Switch
                id="show-completed-admin-orders"
                checked={showCompleted}
                onCheckedChange={setShowCompleted}
              />
              <Label htmlFor="show-completed-admin-orders" className="text-sm">Show Completed</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <AdminOrderTable 
            initialOrders={filteredOrders} 
            reloadOrders={triggerReload} 
            initialProductCodes={productCodes}
          />
        </CardContent>
      </Card>
    </div>
  );
}