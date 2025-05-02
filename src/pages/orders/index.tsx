import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { OrderTable } from '@/components/shared/order-table';
import type { Order, OrderStatus } from '@/types/order';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterValue, setFilterValue] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadOrders();
  }, [toast]);

  async function loadOrders() {
    setLoading(true);
    try {
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orders?.map(order => order.id) || []);

      if (itemsError) throw itemsError;

      const ordersWithItems = (orders || []).map(order => ({
        ...order,
        items: (orderItems || []).filter(item => item.order_id === order.id)
      }));

      setOrders(ordersWithItems);
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
              id="show-completed-customer"
              checked={showCompleted}
              onCheckedChange={setShowCompleted}
            />
            <Label htmlFor="show-completed-customer">Show Completed</Label>
          </div>
        </div>
        <Button asChild>
          <Link to="/orders/new">
            <Plus className="mr-2 h-4 w-4" /> New Order
          </Link>
        </Button>
      </div>
      <OrderTable 
        orders={filteredOrders} 
        showActions={true}
        onOrderUpdated={loadOrders}
      />
    </div>
  );
}