import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { AdminOrderTable } from './admin-order-table';
import { UserManagement } from './user-management';
import { ExportPage } from '@/pages/admin/export'; // Import the new export page
import { FixOrderCodesPage } from '@/pages/admin/fix-order-codes'; // Import the fix order codes page
import FixBaseCodesPage from '@/pages/admin/fix-base-codes'; // Import the fix base codes page
import { formatCurrency, cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { LogOut, Download, X, Calendar as CalendarIcon, Wrench } from 'lucide-react';
import { debugOrderData } from '@/utils/debug';
import { DateRange } from 'react-day-picker';
import { addDays, format } from 'date-fns';
import * as XLSX from 'xlsx'; // Import xlsx library

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

interface DashboardStats {
  total: number;
  pending: number;
  completed: number;
  cancelled: number;
  totalQuantity: number;
  totalValue: number;
}

interface User {
  id: string;
  email: string;
  name?: string;
}

// Define mapping for category tables and fields
const categoryTableMap: Record<string, { table: string; nameField: string; priceField: string; codeField: string }> = {
  mattress: { table: 'mattress', nameField: 'description', priceField: 'set_price', codeField: 'mattress_code' },
  furniture: { table: 'furniture', nameField: 'description', priceField: 'price', codeField: 'code' },
  headboards: { table: 'headboards', nameField: 'description', priceField: 'price', codeField: 'code' },
  accessories: { table: 'accessories', nameField: 'description', priceField: 'price', codeField: 'code' },
  foam: { table: 'foam', nameField: 'description', priceField: 'price', codeField: 'code' },
  // Add other categories if they exist
};

// Define possible order statuses based on application usage
const ORDER_STATUSES = ['pending', 'approved', 'review', 'completed', 'cancelled']; // Added 'approved'

// Define the possible values for activeSection
type ActiveSection = 'dashboard' | 'users' | 'export' | 'fix-order-codes' | 'fix-base-codes';

export function DashboardPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterValue, setFilterValue] = useState('');
  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');
  const [showCompletedAdminOrders, setShowCompletedAdminOrders] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    pending: 0,
    completed: 0,
    cancelled: 0,
    totalQuantity: 0,
    totalValue: 0,
  });

  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardViewData();
  }, []);

  const loadDashboardViewData = async () => {
    setLoading(true);
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id, user_id, order_owner_id, order_number, store_name, category, status, created_at, value, quantity,
          order_items ( id, product_name, quantity, price, total, stock_item_id, code )
        `)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      if (ordersData) {
        const userIds = [...new Set([...ordersData.map(o => o.user_id), ...ordersData.map(o => o.order_owner_id)])].filter(Boolean);
        const { data: usersData, error: usersError } = await supabase.from('users').select('id, email, name').in('id', userIds);
        if (usersError) console.error('Error fetching users:', usersError);
        
        const userMap: Record<string, User> = {};
        (usersData || []).forEach(user => {
          if (user && user.id) {
            userMap[user.id] = user;
          }
        });

        const processedOrders = ordersData.map(order => {
          const user = order.user_id ? userMap[order.user_id] : undefined;
          const owner = order.order_owner_id ? userMap[order.order_owner_id] : undefined;
          const customer_name = user ? user.name || user.email : 'Unknown';
          const owner_name = owner ? owner.name || owner.email : 'Unknown';
          const quantity = order.order_items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;
          const value = order.order_items?.reduce((sum: number, item: any) => sum + (item.total || 0), 0) || 0;
          return { ...order, items: order.order_items || [], user, owner, customer_name, owner_name, quantity, value, total: value };
        });

        setOrders(processedOrders);
        updateStats(processedOrders);
      }
    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
      toast({ title: 'Error', description: error.message || 'Failed to load dashboard data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const updateStats = (ordersToCount: any[]) => {
    const newStats = {
      total: ordersToCount.length,
      pending: ordersToCount.filter(order => order.status === 'pending').length,
      completed: ordersToCount.filter(order => order.status === 'completed').length,
      cancelled: ordersToCount.filter(order => order.status === 'cancelled').length,
      totalQuantity: ordersToCount.reduce((sum: number, order: any) => sum + (order.quantity || 0), 0),
      totalValue: ordersToCount.reduce((sum: number, order: any) => sum + (order.value || 0), 0),
    };
    setStats(newStats);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Logged out",
        description: "You have been successfully logged out."
      });
      navigate('/login');
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to log out: " + error.message,
        variant: "destructive"
      });
    }
  };

  const filteredDashboardOrders = useMemo(() => {
    return orders.filter(order => {
      if (order.status === 'completed' && !showCompletedAdminOrders) {
          return false;
      }
      const searchStr = filterValue.toLowerCase();
      const matchesSearch = !searchStr ||
        order.order_number?.toLowerCase().includes(searchStr) ||
        order.customer_name?.toLowerCase().includes(searchStr) ||
        order.store_name?.toLowerCase().includes(searchStr) ||
        order.status?.toLowerCase().includes(searchStr);

      return matchesSearch;
    });
  }, [orders, filterValue, showCompletedAdminOrders]);

  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={activeSection === 'dashboard' ? 'default' : 'outline'}
            onClick={() => setActiveSection('dashboard')}
            size="sm"
          >
            Dashboard
          </Button>
          <Button
            variant={activeSection === 'users' ? 'default' : 'outline'}
            onClick={() => setActiveSection('users')}
            size="sm"
          >
            Users
          </Button>
          <Button
            variant={activeSection === 'export' ? 'default' : 'outline'}
            onClick={() => setActiveSection('export')}
            size="sm"
          >
            Export Orders
          </Button>
          <Button variant="outline" onClick={handleLogout} size="sm">
            <LogOut className="h-4 w-4 mr-2" />
            Log Out
          </Button>
        </div>
      </div>

      {activeSection === 'dashboard' && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
            </Card>
             <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.pending}</div></CardContent>
            </Card>
             <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.completed}</div></CardContent>
            </Card>
             <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.cancelled}</div></CardContent>
            </Card>
             <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.totalQuantity}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</div></CardContent>
            </Card>
          </div>

          <Card className="mb-6">
            <CardContent className="flex items-center justify-between gap-4 pt-6">
                <Input
                    placeholder="Search Orders (Order#, Customer, Store, Status)..."
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    className="max-w-sm"
                />
                <Button
                    variant="outline"
                    onClick={() => setShowCompletedAdminOrders(prev => !prev)}
                    size="sm"
                 >
                    {showCompletedAdminOrders ? "Hide Completed" : "Show Completed"}
                 </Button>
            </CardContent>
          </Card>

          <AdminOrderTable orders={filteredDashboardOrders} loading={loading} reloadOrders={loadDashboardViewData} />
        </>
      )}

      {activeSection === 'users' && (
        <UserManagement />
      )}

      {activeSection === 'export' && (
        <ExportPage />
      )}

      {activeSection === 'fix-order-codes' && (
        <FixOrderCodesPage />
      )}

      {activeSection === 'fix-base-codes' && (
        <FixBaseCodesPage />
      )}
    </div>
  );
}
