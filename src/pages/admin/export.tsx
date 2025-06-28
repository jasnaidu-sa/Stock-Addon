import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseClient } from '@/lib/supabase';;
import { formatCurrency, cn } from '@/lib/utils';
import { Download, X, Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { addDays, format } from 'date-fns';
import * as XLSX from 'xlsx';
import { getProductCode, fetchProductCodes } from '@/lib/product-utils'; // Import utilities

// Import necessary shadcn/ui components
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Order } from '@/types/order'; // Assuming Order type is here
import { AdminOrderTable } from '@/components/admin/admin-order-table'; // Correct import path

interface User {
  id: string;
  email: string;
  name?: string;
}

// Define mapping for category tables and fields (Copied from dashboard)
const categoryTableMap: Record<string, { table: string; nameField: string; priceField: string; codeField: string }> = {
  mattress: { table: 'mattress', nameField: 'description', priceField: 'set_price', codeField: 'mattress_code' },
  furniture: { table: 'furniture', nameField: 'description', priceField: 'price', codeField: 'code' },
  headboards: { table: 'headboards', nameField: 'description', priceField: 'price', codeField: 'code' },
  accessories: { table: 'accessories', nameField: 'description', priceField: 'price', codeField: 'code' },
  foam: { table: 'foam', nameField: 'description', priceField: 'price', codeField: 'code' },
};

const ORDER_STATUSES = ['pending', 'approved', 'review', 'completed', 'cancelled'];

export function ExportPage() {
  
  const supabase = getSupabaseClient(); // Initialize Supabase client
  const [orders, setOrders] = useState<Order[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [filterValue, setFilterValue] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(ORDER_STATUSES);

  const { toast } = useToast();

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Fetch users for the dropdown
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email, name')
        .order('name', { ascending: true });

      if (usersError) throw usersError;
      setAllUsers(usersData || []);

      // Fetch orders with related user and store data using explicit joins instead of foreign key references
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          user_id,
          store_name,
          items:order_items(id, order_id, product_name, quantity, price, total, stock_item_id, notes, status, code)
        `)
        .order('created_at', { ascending: false });

      if (ordersError) {
          console.error("Supabase orders query error:", ordersError);
          throw ordersError;
      }

      // Fetch stores if needed (assuming store_id exists in orders)
      let storesById: Record<string, any> = {};
      
      // Create complete order objects with nested user and store data
      const ordersWithRelations = (ordersData || []).map(order => {
        // Safely handle user lookup with null checks
        const user = order.user_id && usersData ? usersData.find(user => user && user.id === order.user_id) : null;
        
        return {
          ...order,
          user: user || null,
          store: { name: order.store_name || 'Unknown Store' },
          // Add these fields for the AdminOrderTable component
          owner_name: user ? (user.name || user.email || 'Unknown User') : 'N/A',
          customer_name: null, // We don't need the current user field
          // Make sure all fields required by AdminOrderTable are present
          order_number: order.order_number || `ORD-${order.id}`,
          status: order.order_status || order.status || 'pending',
          created_at: order.created_at || new Date().toISOString(),
          quantity: order.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0,
          value: order.total_price || 0
        };
      });

      // Set orders state with the manually joined data
      setOrders(ordersWithRelations as Order[]);

    } catch (error: any) {
      console.error('Error loading initial data:', error);
      // toast and setAllUsers are accessible here from component scope
      toast({ title: 'Error', description: error.message || 'Failed to load page data', variant: 'destructive' });
      setAllUsers([]); // Ensure states are reset on error
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    console.log("Recalculating filteredOrders...", orders?.length || 0); // Log when filter recalculates
    
    // Guard against orders being undefined or null
    if (!orders || !Array.isArray(orders)) {
      console.warn("Orders is not a valid array", orders);
      return [];
    }
    
    return orders.filter(order => {
      // Skip invalid orders
      if (!order) return false;
      
      try {
        const searchStr = (filterValue || '').toLowerCase();

        // Handle cases where order properties might be undefined
        const orderNumber = (order.order_number || '').toLowerCase();
        const userName = (order.user?.name || '').toLowerCase();
        const userEmail = (order.user?.email || '').toLowerCase();
        const status = order.status || '';
        
        const matchesSearch = !searchStr ||
          orderNumber.includes(searchStr) ||
          userName.includes(searchStr) ||
          userEmail.includes(searchStr) ||
          (order.store_name || '').toLowerCase().includes(searchStr);

        const orderDate = order.created_at ? new Date(order.created_at) : new Date();
        const matchesDate = !dateRange || 
          ((!dateRange.from || orderDate >= dateRange.from) && 
           (!dateRange.to || orderDate <= addDays(dateRange.to, 1)));

        const matchesCustomer = selectedCustomer === 'all' || order.user_id === selectedCustomer;

        const matchesStatus = selectedStatuses.length === 0 ||
          selectedStatuses.length === ORDER_STATUSES.length || 
          selectedStatuses.includes(status);

        return matchesSearch && matchesDate && matchesCustomer && matchesStatus;
      } catch (err) {
        console.error("Error filtering order:", err, order);
        return false;
      }
    });
  }, [orders, filterValue, dateRange, selectedCustomer, selectedStatuses]);

  // Status filter handlers (keep)
  const handleStatusChange = (status: string, checked: boolean) => {
    setSelectedStatuses(prev =>
      checked ? [...prev, status] : prev.filter(s => s !== status)
    );
  };

  const handleSelectAllStatuses = (checked: boolean) => {
    setSelectedStatuses(checked ? ORDER_STATUSES : []);
  };

  const handleExport = async () => {
      setIsExporting(true);
      toast({ title: "Starting Export...", description: "Fetching and processing data." });
      
      try {
        // Build query params based on filters
        let query = supabase.from('orders').select(`
          *,
          user_id,
          store_name,
          items:order_items(id, order_id, product_name, quantity, price, total, stock_item_id, notes, status, code)
        `).order('created_at', { ascending: false });
        
        // Apply filters
        if (dateRange?.from) {
          const fromDate = dateRange.from.toISOString();
          query = query.gte('created_at', fromDate);
        }
        
        if (dateRange?.to) {
          const toDate = addDays(dateRange.to, 1).toISOString();
          query = query.lt('created_at', toDate);
        }
        
        if (selectedCustomer !== 'all') {
          query = query.eq('user_id', selectedCustomer);
        }
        
        if (selectedStatuses.length !== ORDER_STATUSES.length) {
          query = query.in('status', selectedStatuses);
        }
        
        // Execute the query to get filtered orders
        const { data: ordersData, error: ordersError } = await query;
        
        if (ordersError) {
          throw ordersError;
        }

        // --- Fetch Product Codes for all items in filtered orders --- START
        const allItemIds = ordersData
          .flatMap(order => order.items || [])
          .map(item => item.stock_item_id)
          .filter(Boolean);
        
        let productCodesMap: Record<string, {code: string, category: string}> = {};
        if (allItemIds.length > 0) {
          try {
            productCodesMap = await fetchProductCodes(allItemIds);
          } catch (codeError) {
            console.error("Error fetching product codes for export:", codeError);
            toast({ title: "Warning", description: "Could not fetch all product codes, export might be incomplete.", variant: "destructive" });
          }
        }
        // --- Fetch Product Codes for all items in filtered orders --- END
        
        // Get user data for the orders
        const userIds = ordersData?.map(order => order.user_id).filter(Boolean) || [];
        let usersById: Record<string, User> = {};
        
        if (userIds.length > 0) {
          const { data: usersData } = await supabase
            .from('users')
            .select('id, email, name')
            .in('id', userIds);
          
          usersById = (usersData || []).reduce((acc, user) => {
            acc[user.id] = user;
            return acc;
          }, {} as Record<string, User>);
        }
        
        // Process the data for Excel format with line items
        let excelData: any[] = [];
        
        // Process each order
        ordersData.forEach(order => {
          const user = order.user_id ? usersById[order.user_id] : null;
          const customerName = user ? (user.name || user.email) : 'N/A';
          
          // If order has no items, add a single row for the order
          if (!order.items || order.items.length === 0) {
            excelData.push({
              'Order Number': order.order_number || '',
              'Date': new Date(order.created_at).toLocaleDateString(),
              'Customer': customerName,
              'Store': order.store_name || '',
              'Status': order.status || '',
              'Product Code': 'N/A',
              'Product': 'N/A',
              'Product Price': '',
              'Quantity': order.quantity || 0,
              'Line Total': '',
              'Order Total': order.value ? `R ${order.value.toLocaleString()}` : 'R 0'
            });
          } else {
            // Add a row for each line item
            order.items.forEach((item: any, index: number) => {
              // Use getProductCode utility function
              const productCode = getProductCode(item, productCodesMap);
              
              // Use the original product name directly
              let productDesc = item.product_name || 'N/A';

              // Remove "(x1)" suffix specifically for base-like product descriptions
              if (productDesc.includes('(x1)')) { // Simple check, adjust if needed for more complex cases
                  productDesc = productDesc.replace(/\s*\(x1\)$/, '').trim();
              }
              
              excelData.push({
                'Order Number': order.order_number || '',
                'Date': new Date(order.created_at).toLocaleDateString(),
                'Customer': customerName,
                'Store': order.store_name || '',
                'Status': order.status || '',
                'Product Code': productCode, 
                'Product': productDesc, // Use the cleaned product name
                'Product Price': item.price ? `R ${item.price.toLocaleString()}` : '',
                'Quantity': item.quantity || 0,
                'Line Total': item.total ? `R ${item.total.toLocaleString()}` : '',
                'Order Total': index === 0 ? (order.value ? `R ${order.value.toLocaleString()}` : 'R 0') : '' 
              });
            });
          }
        });
        
        // Generate Excel file
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
        
        // Adjust column widths
        const columnWidths = [
          { wch: 15 }, // Order Number
          { wch: 12 }, // Date
          { wch: 30 }, // Customer
          { wch: 20 }, // Store
          { wch: 12 }, // Status
          { wch: 15 }, // Product Code
          { wch: 35 }, // Product
          { wch: 12 }, // Product Price
          { wch: 10 }, // Quantity
          { wch: 12 }, // Line Total
          { wch: 12 }  // Order Total
        ];
        
        worksheet['!cols'] = columnWidths;
        
        // Generate filename with current date
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `orders_export_${dateStr}.xlsx`;
        
        // Write and download file
        XLSX.writeFile(workbook, fileName);
        
        toast({ 
          title: "Export Complete", 
          description: `${excelData.length} orders exported to ${fileName}` 
        });
      } catch (error: any) {
        console.error('Export error:', error);
        toast({ 
          title: 'Export Failed', 
          description: error.message || 'Failed to export data', 
          variant: 'destructive' 
        });
      } finally {
        setIsExporting(false);
      }
  };

  // UI Rendering
  if (loading) { // Show loading indicator while fetching data
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="ml-4 text-muted-foreground">Loading orders and filters...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6 min-h-[800px]">
       <h2 className="text-2xl font-semibold tracking-tight">Export Orders</h2>
       <p className="text-sm text-muted-foreground">
         Select filters below and click "Export to Excel" to download the order data.
       </p>
        {/* Filters and Export Section Card */}
        <Card className="min-w-[1000px]">
            <CardHeader>
                <CardTitle className="text-lg">Filter & Export Orders</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Date Range Picker */}
                    <div className="space-y-1">
                        <Label>Date Range</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button id="date" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>) : format(dateRange.from, "LLL dd, y")) : (<span>Pick a date range</span>)}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2}/>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Customer Select */}
                    <div className="space-y-1">
                        <Label htmlFor="customer-filter">Customer</Label>
                        <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                            <SelectTrigger id="customer-filter" className="w-full"><SelectValue placeholder="Select Customer" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Customers</SelectItem>
                                {allUsers.map(user => (<SelectItem key={user.id} value={user.id}>{user.name || user.email}</SelectItem>))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Status Multi-Select Popover */}
                    <div className="space-y-1">
                        <Label>Status</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start">
                                    {selectedStatuses.length === 0 ? 'Select Status(es)' : selectedStatuses.length === ORDER_STATUSES.length ? 'All Statuses' : `${selectedStatuses.length} Selected`}
                                    <X className={`ml-auto h-4 w-4 text-muted-foreground hover:text-foreground ${selectedStatuses.length === 0 ? 'hidden' : ''}`} onClick={(e) => { e.stopPropagation(); setSelectedStatuses([]); }}/>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[250px] p-4 space-y-2">
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="status-all" checked={selectedStatuses.length === ORDER_STATUSES.length} onCheckedChange={(checked) => handleSelectAllStatuses(!!checked)}/>
                                    <Label htmlFor="status-all" className="font-medium">Select All</Label>
                                </div>
                                <hr />
                                {ORDER_STATUSES.map(status => (
                                    <div key={status} className="flex items-center space-x-2">
                                        <Checkbox id={`status-${status}`} checked={selectedStatuses.includes(status)} onCheckedChange={(checked) => handleStatusChange(status, !!checked)}/>
                                        <Label htmlFor={`status-${status}`} className="capitalize">{status}</Label>
                                    </div>
                                ))}
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Add back search input */}
                    <div className="space-y-1">
                         <Label htmlFor="search-filter">Search Preview</Label>
                         <Input
                            id="search-filter"
                            placeholder="Filter preview by Order#, Customer, Store..."
                            value={filterValue}
                            onChange={(e) => setFilterValue(e.target.value)}
                            className="w-full"
                         />
                     </div>
                </div>

                {/* Export Button */}
                <div className="flex justify-end pt-2">
                     <Button onClick={handleExport} disabled={isExporting || loading} size="sm">
                        {isExporting ? (<><Download className="mr-2 h-4 w-4 animate-pulse" /> Exporting...</>) : (<><Download className="mr-2 h-4 w-4" /> Export to Excel</>)}
                     </Button>
                </div>
            </CardContent>
          </Card>

          {/* Re-add the preview table section */}
          <div className="mt-6">
             <h3 className="text-lg font-semibold mb-2">Order Preview (Based on Filters)</h3>
             <p className="text-sm text-muted-foreground mb-4">
                This table shows a preview of the orders matching your current filter selections. The actual export will fetch fresh data based on these filters.
             </p>
             <AdminOrderTable
                orders={filteredOrders}
                loading={loading}
                reloadOrders={async () => {}}
             />
          </div>
    </div>
  );
}
