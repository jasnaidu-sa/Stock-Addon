import React, { useState } from 'react';
import { Loader2, RefreshCw, Search } from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Order } from '@/types/order';
import { SortConfig } from '@/types/common';
import { AdminOrderTable } from './admin-order-table';
import { OrderDetail } from './order-detail';
import { getSupabaseClient } from '@/lib/supabase';;
import { useToast } from '@/hooks/use-toast';

interface OrdersTabProps {
  orders: Order[];
  loading: boolean;
  sortConfig: SortConfig;
  handleSort: (field: string) => void;
  loadOrders: () => void;
  formatOrderId: (id: string) => string;
  formatDate: (date: string) => string;
  formatCurrency: (amount: number) => string;
  onSelectOrder?: (order: Order) => void;
}

export function OrdersTab({
  
  const supabase = getSupabaseClient(); // Initialize Supabase clientorders,
  loading,
  sortConfig,
  handleSort,
  loadOrders,
  formatOrderId,
  formatDate,
  formatCurrency,
  onSelectOrder
}: OrdersTabProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderSearch, setOrderSearch] = useState('');
  const { toast } = useToast();

  // Filter orders based on search
  const filteredOrders = orders.filter(order => {
    if (!orderSearch) return true;
    
    const searchLower = orderSearch.toLowerCase();
    return (
      (order.id && order.id.toLowerCase().includes(searchLower)) ||
      (order.order_number && order.order_number.toLowerCase().includes(searchLower)) ||
      (order.customer_name && order.customer_name.toLowerCase().includes(searchLower)) ||
      (order.status && order.status.toLowerCase().includes(searchLower)) ||
      (order.store_name && order.store_name.toLowerCase().includes(searchLower))
    );
  });

  const handleOrderAction = async (order: Order, action: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: action })
        .eq('id', order.id);

      if (error) throw error;

      loadOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update order status',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Orders Management</CardTitle>
          <CardDescription>View and manage customer orders</CardDescription>
        </div>
        <Button 
          variant="outline" 
          onClick={() => {
            setSelectedOrderId(null);
            loadOrders();
          }}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search orders by ID, customer, or status..."
            className="pl-8"
            value={orderSearch}
            onChange={(e) => setOrderSearch(e.target.value)}
          />
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            No orders found
          </div>
        ) : selectedOrderId ? (
          // Order detail view
          (() => {
            const order = orders.find(o => o.id === selectedOrderId);
            if (!order) return <div>Order not found</div>;
            
            return (
              <OrderDetail
                order={order}
                onBack={() => setSelectedOrderId(null)}
                formatOrderId={formatOrderId}
                formatDate={formatDate}
                formatCurrency={formatCurrency}
                onOrderUpdated={loadOrders}
              />
            );
          })()
        ) : (
          // Orders list view using AdminOrderTable
          <AdminOrderTable
            orders={filteredOrders}
            onOrderUpdated={loadOrders}
          />
        )}
      </CardContent>
    </Card>
  );
} 