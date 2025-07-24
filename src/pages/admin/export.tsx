import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminOrderTable } from '@/components/admin/admin-order-table';
import { Button } from '@/components/ui/button';
import { getSupabaseClient } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { Download, Loader2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { Order } from '@/types/order';
import { fetchProductCodes } from '@/lib/product-utils';

export function ExportPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [orderNumberFilter, setOrderNumberFilter] = useState<string>('');
  const [selectedOrderNumbers, setSelectedOrderNumbers] = useState<string[]>([]);
  const [showCompletedOrders, setShowCompletedOrders] = useState(true);
  const { toast } = useToast();

  const loadInitialData = async () => {
    setLoading(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast({ title: "Error", description: "Database connection failed.", variant: "destructive" });
      setLoading(false);
      return;
    }
    try {
      // Fetch all users to map to orders
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, clerk_id');
      if (usersError) throw usersError;

      // Fetch orders with their line items
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false });
      if (ordersError) throw ordersError;
      
      // Extract productIds from order items to fetch product details
      const orderItems = ordersData?.flatMap(order => order.order_items || []) || [];
      const productIds = orderItems.map(item => item.product_id).filter(Boolean);
      
      // Fetch product codes and descriptions using the utility
      const productCodeMap = await fetchProductCodes(productIds);
      
      // Combine orders with their user data and product details
      const ordersWithRelations = (ordersData || []).map(order => {
        const user = usersData?.find(u => u.id === order.user_id) || null;
        
        // Process order items with product details
        const enhancedOrderItems = (order.order_items || []).map((item: any) => {
          // Look up product details from the map using product_id
          const productDetails = productCodeMap[item.product_id] || {};
          
          return {
            ...item,
            // Use fetched code or fallback
            code: productDetails.code || item.code || 'N/A',
            // Use fetched description or fallback
            description: productDetails.description || item.description || item.name || 'N/A'
          };
        });
        
        // Calculate total
        const total = enhancedOrderItems.reduce((sum: number, item: any) => {
          return sum + ((item.price || 0) * (item.quantity || 0));
        }, 0);

        return {
          ...order,
          order_items: enhancedOrderItems,
          customer_name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Unknown',
          store_name: order.store_name || 'Unknown',
          total,
          value: total, // Add value property to match expected property in order table
          order_number: order.order_number || `ORD-${order.id}`,
        };
      });

      setOrders(ordersWithRelations as Order[]);
    } catch (error: any) {
      console.error('Error loading initial data:', error);
      toast({ title: 'Error', description: error.message || 'Failed to load page data', variant: 'destructive' });
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter orders based on date range and selected order numbers
  const filteredOrders = useMemo(() => {
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
    if (!showCompletedOrders) {
      filtered = filtered.filter((order) => order.status !== 'completed');
    }

    return filtered;
  }, [orders, date, selectedOrderNumbers, showCompletedOrders]);
  
  // Handle adding an order number to the filter
  const handleAddOrderNumber = () => {
    if (!orderNumberFilter || selectedOrderNumbers.includes(orderNumberFilter)) return;
    setSelectedOrderNumbers([...selectedOrderNumbers, orderNumberFilter]);
    setOrderNumberFilter('');
  };
  
  // Handle removing an order number from the filter
  const handleRemoveOrderNumber = (orderNumber: string) => {
    setSelectedOrderNumbers(selectedOrderNumbers.filter(num => num !== orderNumber));
  };

  // Export to Excel functionality
  const handleExportToExcel = () => {
    // Create export data with line items
    let exportData: any[] = [];
    
    filteredOrders.forEach(order => {
      if (order.order_items && order.order_items.length > 0) {
        // Add each line item as a separate row
        order.order_items.forEach((item: any) => {
          exportData.push({
            'Order Number': order.order_number,
            'Customer': order.customer_name || 'Unknown',
            'Store': order.store_name || 'Unknown',
            'Status': order.status || 'N/A',
            'Date': order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A',
            // Use the enhanced code and description properties we've added during data processing
            'Product Code': item.code || 'N/A',
            'Product Description': item.description || item.name || 'N/A', 
            'Item Price': item.price || 0,
            'Item Quantity': item.quantity || 0,
            'Line Total': (item.price || 0) * (item.quantity || 0)
          });
        });
      } else {
        // Add a placeholder row for orders with no items
        exportData.push({
          'Order Number': order.order_number,
          'Customer': order.customer_name || 'Unknown',
          'Store': order.store_name || 'Unknown',
          'Status': order.status || 'N/A',
          'Date': order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A',
          'Product Code': 'N/A',
          'Product Description': 'Order details not available',
          'Item Price': 0,
          'Item Quantity': order.quantity || 0,
          'Line Total': (order as any).total || order.value || 0
        });
      }
    });
    
    // Create and download the Excel file
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [ { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 40 }, { wch: 12 }, { wch: 15 }, { wch: 12 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
    XLSX.writeFile(workbook, `Orders_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: 'Export Successful', description: 'Orders have been exported to Excel' });
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Export Orders</h2>
      </div>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Order Filters</CardTitle>
            <CardDescription>Filter orders by order number</CardDescription>
          </div>
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
                disabled={filteredOrders.length === 0}
              >
                <Download className="mr-2 h-4 w-4" /> Export to Excel
              </Button>
            </div>
            
            {/* Show Completed Toggle */}
            <div className="flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCompletedOrders(prev => !prev)}
                className="whitespace-nowrap"
              >
                {showCompletedOrders ? "Hide Completed" : "Show Completed"}
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
          <AdminOrderTable
            initialOrders={filteredOrders} 
            reloadOrders={loadInitialData}
            hideEditButton={true}
          />
        </CardContent>
      </Card>
    </div>
  );
}
