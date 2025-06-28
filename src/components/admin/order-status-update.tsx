import { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { OrderStatus, ORDER_STATUSES, updateOrderStatus, STATUS_COLORS } from '@/lib/order-status-fixed';

interface OrderStatusUpdateProps {
  orderId: string;
  currentStatus: string;
  onStatusUpdated: () => void;
}

export function OrderStatusUpdate({ orderId, currentStatus, onStatusUpdated }: OrderStatusUpdateProps) {
  // Always use the current status from props to ensure UI is in sync with data
  const [isUpdating, setIsUpdating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  
  // Use Clerk hooks to get current user ID
  const { userId } = useAuth();
  
  // No need for refs here - we're using direct event handlers instead

  // Filter out 'review' status from selectable options
  // Only show 'review' in the dropdown if the current status is already 'review'
  const availableStatuses = ORDER_STATUSES.filter(s => s !== 'review' || currentStatus === 'review');

  const handleStatusChange = async (newStatus: OrderStatus) => {
    console.log('Status change requested:', { from: currentStatus, to: newStatus });
    if (newStatus === currentStatus) {
      console.log('Skipping update - status unchanged');
      return;
    }
    
    // Store these for comparison later
    const originalStatus = currentStatus;

    // Prevent manually setting status to 'review'
    if (newStatus === 'review') {
      toast({
        title: 'Action not allowed',
        description: 'Orders can only be set to review status when they are edited.',
        variant: 'destructive',
      });
      return;
    }

    // Don't set local status, only show updating indicator
    setIsUpdating(true);

    try {
      // Get current user ID from Clerk hook instead of window global object
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      console.log('Updating order status with Clerk user ID:', userId);
      const result = await updateOrderStatus(orderId, newStatus, userId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to update order status');
      }

      toast({
        title: 'Status updated',
        description: `Order status changed to ${newStatus}`,
      });

      // Update local state to reflect the new status immediately
      console.log('Status update successful, triggering data reload');
      
      // Call onStatusUpdated immediately to refresh the parent component
      console.log(`Reloading data after status change from ${originalStatus} to ${newStatus}`);
      onStatusUpdated();
      
      // Force a refresh again after a delay to handle any database replication lag
      setTimeout(() => {
        console.log('Running secondary refresh to handle potential replication lag');
        onStatusUpdated();
      }, 700);
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update order status',
        variant: 'destructive',
      });
      // No need to reset status as we're now using props directly
    } finally {
      setIsUpdating(false);
    }
  };

  const statusConfig = STATUS_COLORS[currentStatus as OrderStatus] || { variant: 'outline', className: 'bg-gray-100 text-gray-800' };

  const handleOpenChange = (open: boolean) => {
    // Always allow opening, only allow closing if not updating
    if (open || !isUpdating) {
      setIsOpen(open);
    }
  };
  
  // Handle direct click on trigger button to ensure dropdown opens on first click
  const handleTriggerClick = (e: React.MouseEvent) => {
    if (!isOpen && !isUpdating) {
      // Prevent default behavior and force open
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(true);
    }
  };

  return (
    <Select 
      value={currentStatus as OrderStatus}
      onValueChange={(value) => handleStatusChange(value as OrderStatus)}
      disabled={isUpdating}
      open={isOpen}
      onOpenChange={handleOpenChange}
    >
      <SelectTrigger 
        className={`h-7 px-2 rounded-md font-medium text-xs border-0 ${statusConfig.className} hover:opacity-90 transition-opacity`}
        onClick={handleTriggerClick}
        onPointerDown={(e) => {
          // Ensure dropdown opens on first click using pointer events
          if (!isOpen) {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
      >
        <SelectValue>
          {isUpdating ? '...' : currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
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