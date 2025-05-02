import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import type { Order, OrderItem } from '@/types/order';
import { formatCurrency } from '@/lib/utils';

interface OrderEditProps {
  order: Order;
  onClose: () => void;
  onOrderUpdated: () => void;
}

export function OrderEdit({ order, onClose, onOrderUpdated }: OrderEditProps) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<OrderItem[]>(order.items || []);
  const [adminNotes, setAdminNotes] = useState('');

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    setItems(currentItems =>
      currentItems.map(item => {
        if (item.id === itemId) {
          const total = item.price * newQuantity;
          return { ...item, quantity: newQuantity, total };
        }
        return item;
      })
    );
  };

  const handlePriceChange = (itemId: string, newPrice: number) => {
    setItems(currentItems =>
      currentItems.map(item => {
        if (item.id === itemId) {
          const total = newPrice * item.quantity;
          return { ...item, price: newPrice, total };
        }
        return item;
      })
    );
  };

  const calculateChanges = () => {
    const originalItems = order.items || [];
    const changes: string[] = [];

    // Compare quantities and prices
    items.forEach(newItem => {
      const originalItem = originalItems.find(item => item.id === newItem.id);
      if (originalItem) {
        if (originalItem.quantity !== newItem.quantity) {
          changes.push(`${newItem.product_name}: Quantity changed from ${originalItem.quantity} to ${newItem.quantity}`);
        }
        if (originalItem.price !== newItem.price) {
          changes.push(`${newItem.product_name}: Price changed from ${formatCurrency(originalItem.price)} to ${formatCurrency(newItem.price)}`);
        }
      }
    });

    return changes.join('\n');
  };

  const calculateTotals = () => {
    return items.reduce((acc, item) => ({
      quantity: acc.quantity + item.quantity,
      value: acc.value + item.total
    }), { quantity: 0, value: 0 });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const originalOrder = { ...order };
      const totals = calculateTotals();
      const changesSummary = calculateChanges();

      // Store original order in history
      const { error: historyError } = await supabase
        .from('order_history')
        .insert({
          order_id: order.id,
          order_items: order.items,
          action_type: 'edit',
          original_qty: order.quantity,
          updated_qty: totals.quantity,
          original_value: order.total,
          updated_value: totals.value,
          status: 'pending',
          changes_summary: changesSummary,
          admin_notes: adminNotes,
          details: originalOrder
        });

      if (historyError) throw historyError;

      // Update order with new details
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'review',
          items: items,
          quantity: totals.quantity,
          total: totals.value
        })
        .eq('id', order.id);

      if (updateError) throw updateError;

      // Update order items
      for (const item of items) {
        const { error: itemError } = await supabase
          .from('order_items')
          .update({
            quantity: item.quantity,
            price: item.price,
            total: item.total
          })
          .eq('id', item.id);

        if (itemError) throw itemError;
      }

      toast({
        title: 'Order Updated',
        description: 'The order has been updated and is pending customer review.',
      });

      onOrderUpdated();
      onClose();
    } catch (error: any) {
      console.error('Error updating order:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update order',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Edit Order {order.order_number}</h2>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.product_name}</TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    value={item.price}
                    onChange={(e) => handlePriceChange(item.id, parseFloat(e.target.value) || 0)}
                    className="w-24 text-right"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                    className="w-24 text-right"
                  />
                </TableCell>
                <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Admin Notes</label>
          <Textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder="Enter any notes about the changes..."
            className="min-h-[100px]"
          />
        </div>

        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
} 