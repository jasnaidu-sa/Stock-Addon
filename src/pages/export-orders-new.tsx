import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Download, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";
import { useSupabase } from '@/hooks/use-supabase';
import { OrderTable } from '@/components/shared/order-table';
import { useToast } from '@/hooks/use-toast';
import { Order } from '@/types/order';
import { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export function ExportOrdersPage() {
  const { supabase, isLoading: isClientLoading, error: clientError } = useSupabase();
  const { userId } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCompletedUserOrders, setShowCompletedUserOrders] = useState(true);
  const { toast } = useToast();
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [orderNumberFilter, setOrderNumberFilter] = useState<string>('');
  const [selectedOrderNumbers, setSelectedOrderNumbers] = useState<string[]>([]);

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
      loadOrdersData();
    }
  }, [supabase, userId]);

  async function loadOrdersData() {
    try {
      setIsLoading(true);
      if (!supabase || !userId) return;

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_id', userId)
        .single();

      if (userError || !userData) {
        throw new Error('Could not find user profile.');
      }

      const supabaseUserId = userData.id;

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', supabaseUserId)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      if (ordersData && ordersData.length > 0) {
        const orderIds = ordersData.map((order) => order.id);
        const { data: allOrderItems, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds);

        if (itemsError) throw itemsError;

        const ordersWithItems = ordersData.map((order) => {
          const orderItems = allOrderItems.filter((item) => item.order_id === order.id);
          
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
      toast({
        title: 'Error loading orders',
        description: error.message || 'An unknown error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Handler functions for order number filter
  const handleAddOrderNumber = () => {
    if (!orderNumberFilter || selectedOrderNumbers.includes(orderNumberFilter)) return;
    setSelectedOrderNumbers([...selectedOrderNumbers, orderNumberFilter]);
    setOrderNumberFilter('');
  };
  
  const handleRemoveOrderNumber = (orderNumber: string) => {
    setSelectedOrderNumbers(selectedOrderNumbers.filter(num => num !== orderNumber));
  };

  const filteredUserOrders = useMemo(() => {
    let filtered = orders;
    // Apply date filter
    if (date?.from) {
      const fromDate = new Date(date.from);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = date.to ? new Date(date.to) : new Date(date.from);
      toDate.setHours(23, 59, 59, 999);

      filtered = filtered.filter((order) => {
        const orderDate = new Date(order.created_at);
        return orderDate >= fromDate && orderDate <= toDate;
      });
    }

    // Apply order number filter if any selected
    if (selectedOrderNumbers.length > 0) {
      filtered = filtered.filter((order) => 
        selectedOrderNumbers.includes(order.order_number || '')
      );
    }

    // Apply completed filter if needed
    if (!showCompletedUserOrders) {
      filtered = filtered.filter((order) => order.status !== 'completed');
    }

    return filtered;
  }, [orders, date, selectedOrderNumbers, showCompletedUserOrders]);

  const handleExportToExcel = () => {
    if (filteredUserOrders.length === 0) return;

    const exportData: any[] = [];
    filteredUserOrders.forEach(order => {
      if (order.order_items && order.order_items.length > 0) {
        order.order_items.forEach(item => {
          exportData.push({
            'Order Number': order.order_number || `ORD-${order.id}`,
            'Store': order.store_name || 'N/A',
            'Status': order.status || 'N/A',
            'Date': order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A',
            'Product': item.product_name || 'N/A',
            'Code': item.code || 'N/A',
            'Price': item.price || 0,
            'Quantity': item.quantity || 0,
            'Total': item.total || (item.price * item.quantity) || 0
          });
        });
      } else {
        exportData.push({
          'Order Number': order.order_number || `ORD-${order.id}`,
          'Store': order.store_name || 'N/A',
          'Status': order.status || 'N/A',
          'Date': order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A',
          'Product': 'N/A',
          'Code': 'N/A',
          'Price': 0,
          'Quantity': 0,
          'Total': 0
        });
      }
    });
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [ { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 40 }, { wch: 12 }, { wch: 15 }, { wch: 12 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'My Orders');
    XLSX.writeFile(workbook, `My_Orders_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: 'Export Successful', description: 'Your orders have been exported to Excel' });
  };

  if (isLoading || isClientLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading orders...</p>
        </div>
      </div>
    );
  }

  // NEW LAYOUT: All filters and controls on a single row within the Order Filters section
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Export Orders</h2>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Order Filters</CardTitle>
          <CardDescription>Filter orders by order number</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            {/* Date Range Filter */}
            <div className="flex-grow-0">
              <DatePickerWithRange date={date} setDate={setDate} />
            </div>
            
            {/* Export Button */}
            <div className="flex-shrink-0">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportToExcel} 
                disabled={filteredUserOrders.length === 0}
              >
                <Download className="mr-2 h-4 w-4" /> Export to Excel
              </Button>
            </div>
            
            {/* Show Completed Toggle */}
            <div className="flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCompletedUserOrders(prev => !prev)}
                className="whitespace-nowrap"
              >
                {showCompletedUserOrders ? "Hide Completed" : "Show Completed"}
              </Button>
            </div>
            
            {/* Order Number Filter */}
            <div className="flex-grow min-w-[300px]">
              <div className="flex space-x-2">
                <Input
                  id="orderNumber"
                  value={orderNumberFilter}
                  onChange={(e) => setOrderNumberFilter(e.target.value)}
                  placeholder="Enter order number"
                  className="flex-1"
                />
                <Button onClick={handleAddOrderNumber} type="button">
                  Add
                </Button>
              </div>
            </div>
          </div>
          
          {/* Selected Order Numbers */}
          {selectedOrderNumbers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedOrderNumbers.map((num) => (
                <Badge key={num} variant="secondary" className="flex items-center gap-1">
                  {num}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => handleRemoveOrderNumber(num)}
                  />
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Order List</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderTable orders={filteredUserOrders} />
        </CardContent>
      </Card>
    </div>
  );
}
