import React, { useState, useEffect } from 'react';
import { Loader2, Clock, AlertCircle, Info } from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { getSupabaseClient } from '@/lib/supabase';
import { OrderStatusBadge } from '@/lib/order-status';

interface OrderHistoryItem {
  id: string;
  order_id: string;
  changed_by: string;
  changed_at: string;
  change_type: string;
  previous_status?: string;
  new_status?: string;
  notes?: string;
  metadata?: any;
  user_name?: string; // Added after fetching user data
}

interface OrderItemHistoryItem {
  id: string;
  order_history_id: string;
  order_item_id: string;
  product_name: string;
  previous_quantity?: number;
  new_quantity?: number;
  previous_price?: number;
  new_price?: number;
  previous_notes?: string;
  new_notes?: string;
  action: string;
}

interface OrderHistoryProps {
  orderId: string;
  formatDate: (date: string) => string;
}

export function OrderHistory({ orderId, formatDate }: OrderHistoryProps) {
  const supabase = getSupabaseClient(); // Initialize Supabase client
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<OrderHistoryItem[]>([]);
  const [itemHistory, setItemHistory] = useState<Record<string, OrderItemHistoryItem[]>>({});
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  useEffect(() => {
    loadOrderHistory();
  }, [orderId]);

  const loadOrderHistory = async () => {
    setLoading(true);
    try {
      // Fetch order history
      const { data: historyData, error: historyError } = await supabase
        .from('order_history')
        .select('*')
        .eq('order_id', orderId)
        .order('changed_at', { ascending: false });

      if (historyError) throw historyError;

      if (historyData && historyData.length > 0) {
        // Get unique user IDs to fetch user names
        const userIds = [...new Set(historyData.map(item => item.changed_by).filter(Boolean))];
        
        // Fetch user names
        const userMap: Record<string, string> = {};
        if (userIds.length > 0) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, name')
            .in('id', userIds);
            
          if (!userError && userData) {
            userData.forEach(user => {
              userMap[user.id] = user.name || 'Unknown User';
            });
          }
        }
        
        // Add user names to history items
        const historyWithUserNames = historyData.map(item => ({
          ...item,
          user_name: item.changed_by ? userMap[item.changed_by] || 'Unknown User' : 'System'
        }));
        
        setHistory(historyWithUserNames);
        
        // Fetch item history for each history entry that might have item changes
        const itemHistoryEntries: Record<string, OrderItemHistoryItem[]> = {};
        
        for (const historyItem of historyData) {
          if (['item_added', 'item_modified', 'item_removed', 'items_modified'].includes(historyItem.change_type)) {
            const { data: itemData, error: itemError } = await supabase
              .from('order_item_history')
              .select('*')
              .eq('order_history_id', historyItem.id);
              
            if (!itemError && itemData) {
              itemHistoryEntries[historyItem.id] = itemData;
            }
          }
        }
        
        setItemHistory(itemHistoryEntries);
      } else {
        setHistory([]);
        setItemHistory({});
      }
    } catch (error) {
      console.error('Error loading order history:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleItemHistory = (historyId: string) => {
    setExpandedHistoryId(expandedHistoryId === historyId ? null : historyId);
  };

  const getChangeTypeIcon = (changeType: string) => {
    switch (changeType) {
      case 'status_change':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'order_created':
        return <Info className="h-4 w-4 text-green-500" />;
      case 'item_added':
      case 'item_modified':
      case 'item_removed':
      case 'items_modified':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string | undefined) => {
    if (!status) return null;
    return <OrderStatusBadge status={status} />;
  };

  const formatChangeDescription = (item: OrderHistoryItem) => {
    switch (item.change_type) {
      case 'status_change':
        return (
          <span>
            Status changed from{' '}
            {getStatusBadge(item.previous_status)}{' '}
            to{' '}
            {getStatusBadge(item.new_status)}
          </span>
        );
      case 'order_created':
        return <span>Order created with status {getStatusBadge(item.new_status)}</span>;
      case 'item_added':
        return <span>Item added to order</span>;
      case 'item_modified':
        return <span>Item modified</span>;
      case 'item_removed':
        return <span>Item removed from order</span>;
      case 'items_modified':
        return <span>Multiple items modified</span>;
      default:
        return <span>{item.notes || 'Order updated'}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        No history available for this order
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Change</TableHead>
            <TableHead>By</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((item) => (
            <React.Fragment key={item.id}>
              <TableRow 
                className={itemHistory[item.id]?.length ? "cursor-pointer hover:bg-muted/50" : ""}
                onClick={() => itemHistory[item.id]?.length ? toggleItemHistory(item.id) : null}
              >
                <TableCell className="whitespace-nowrap">
                  {formatDate(item.changed_at)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getChangeTypeIcon(item.change_type)}
                    {formatChangeDescription(item)}
                  </div>
                </TableCell>
                <TableCell>{item.user_name}</TableCell>
                <TableCell>{item.notes}</TableCell>
              </TableRow>
              
              {/* Item history details if expanded */}
              {expandedHistoryId === item.id && itemHistory[item.id]?.length > 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="bg-slate-50 p-0">
                    <div className="p-4">
                      <h4 className="text-sm font-medium mb-2">Item Changes</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Previous Qty</TableHead>
                            <TableHead>New Qty</TableHead>
                            <TableHead>Previous Price</TableHead>
                            <TableHead>New Price</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {itemHistory[item.id].map((itemChange) => (
                            <TableRow key={itemChange.id}>
                              <TableCell>{itemChange.product_name || 'Unnamed Product'}</TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {itemChange.action}
                                </Badge>
                              </TableCell>
                              <TableCell>{itemChange.previous_quantity ?? '-'}</TableCell>
                              <TableCell>{itemChange.new_quantity ?? '-'}</TableCell>
                              <TableCell>{itemChange.previous_price ?? '-'}</TableCell>
                              <TableCell>{itemChange.new_price ?? '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
} 