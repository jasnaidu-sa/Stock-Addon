import React from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Order } from '@/types/order';

interface RecentOrdersProps {
  orders: Order[];
  loading: boolean;
  formatOrderId: (id: string) => string;
  formatDate: (date: string) => string;
  formatCurrency: (amount: number) => string;
}

export function RecentOrders({
  orders,
  loading,
  formatOrderId,
  formatDate,
  formatCurrency
}: RecentOrdersProps) {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  if (orders.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        No orders found
      </div>
    );
  }
  
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order ID</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Store</TableHead>
          <TableHead>Quantity</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.slice(0, 5).map((order) => (
          <TableRow key={order.id}>
            <TableCell className="font-medium">
              {formatOrderId(order.id)}
            </TableCell>
            <TableCell>{formatDate(order.created_at)}</TableCell>
            <TableCell>{order.store_name || 'N/A'}</TableCell>
            <TableCell>{order.quantity || 0}</TableCell>
            <TableCell>{formatCurrency(order.value || 0)}</TableCell>
            <TableCell className="font-medium">{formatCurrency(order.total || 0)}</TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={
                  order.status === 'delivered' || order.status === 'completed' ? 'bg-green-100 text-green-800' :
                  order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                  order.status === 'processing' ? 'bg-purple-100 text-purple-800' :
                  order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }
              >
                {order.status || 'unknown'}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
} 