import React, { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { OrderStatus, ORDER_STATUSES, updateOrderStatus, STATUS_COLORS } from '@/lib/order-status';
import { supabase } from '@/lib/supabase';

interface OrderStatusUpdateProps {
  orderId: string;
  currentStatus: string;
  onStatusUpdated: () => void;
}

export function OrderStatusUpdate({ orderId, currentStatus, onStatusUpdated }: OrderStatusUpdateProps) {
  const [status, setStatus] = useState<OrderStatus>(currentStatus as OrderStatus || 'pending');
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  // Filter out 'review' status from selectable options
  // Only show 'review' in the dropdown if the current status is already 'review'
  const availableStatuses = ORDER_STATUSES.filter(s => s !== 'review' || status === 'review');

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (newStatus === currentStatus) {
      return;
    }

    // Prevent manually setting status to 'review'
    if (newStatus === 'review') {
      toast({
        title: 'Action not allowed',
        description: 'Orders can only be set to review status when they are edited.',
        variant: 'destructive',
      });
      return;
    }

    setStatus(newStatus);
    setIsUpdating(true);

    try {
      // Get current user for the history record
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const result = await updateOrderStatus(orderId, newStatus, user.id);

      if (!result.success) {
        throw new Error(result.error || 'Failed to update order status');
      }

      toast({
        title: 'Status updated',
        description: `Order status changed to ${newStatus}`,
      });

      // Notify parent component to refresh data
      onStatusUpdated();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update order status',
        variant: 'destructive',
      });
      // Revert the status back if there was an error
      setStatus(currentStatus as OrderStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  const statusConfig = STATUS_COLORS[status] || { variant: 'outline', className: 'bg-gray-100 text-gray-800' };

  return (
    <Select 
      value={status} 
      onValueChange={(value) => handleStatusChange(value as OrderStatus)}
      disabled={isUpdating}
    >
      <SelectTrigger 
        className={`h-7 px-2 rounded-md font-medium text-xs border-0 ${statusConfig.className} hover:opacity-90 transition-opacity`}
      >
        <SelectValue>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {availableStatuses.map((statusOption) => (
          <SelectItem 
            key={statusOption} 
            value={statusOption}
            className="capitalize"
          >
            {statusOption}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
} 