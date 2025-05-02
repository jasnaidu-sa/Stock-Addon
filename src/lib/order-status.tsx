import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import React from 'react';

// Define the valid order statuses
export type OrderStatus = 'pending' | 'approved' | 'cancelled' | 'completed' | 'review';

// Define the order status options
export const ORDER_STATUSES: OrderStatus[] = ['pending', 'approved', 'cancelled', 'completed', 'review'];

// Define the status colors for badges
export const STATUS_COLORS: Record<OrderStatus, { variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'warning', className: string }> = {
  pending: {
    variant: 'outline',
    className: 'text-yellow-500 border-yellow-500',
  },
  approved: {
    variant: 'default',
    className: 'bg-blue-500 hover:bg-blue-600',
  },
  cancelled: {
    variant: 'destructive',
    className: 'bg-red-600 hover:bg-red-700',
  },
  completed: {
    variant: 'secondary',
    className: 'bg-green-500 hover:bg-green-600',
  },
  review: {
    variant: 'outline',
    className: 'text-orange-500 border-orange-500',
  },
};

// Function to render a status badge
export const OrderStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const normalizedStatus = status?.toLowerCase() as OrderStatus;
  const colorConfig = STATUS_COLORS[normalizedStatus] || STATUS_COLORS.pending;

  // Custom badge for "review" status
  if (normalizedStatus === 'review') {
    return (
      <Badge variant="outline" className={colorConfig.className}>
        Under Review
      </Badge>
    );
  }

  return (
    <Badge variant={colorConfig.variant as any} className={colorConfig.className}>
      {status?.charAt(0).toUpperCase() + status?.slice(1)}
    </Badge>
  );
};

// Function to update order status (admin only)
export async function updateOrderStatus(
  orderId: string, 
  newStatus: OrderStatus, 
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the current order to record previous status
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single();
      
    if (orderError) {
      throw new Error(`Error fetching order: ${orderError.message}`);
    }
    
    const previousStatus = order?.status || 'unknown';
    
    // Update the order status
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);
      
    if (updateError) {
      throw new Error(`Error updating order status: ${updateError.message}`);
    }
    
    // Update status in order_items table
    const { error: itemsError } = await supabase
      .from('order_items')
      .update({ status: newStatus })
      .eq('order_id', orderId);
      
    if (itemsError) {
      console.error(`Error updating order items status: ${itemsError.message}`);
      // Continue execution even if this fails
    }
    
    // Log the status change in order_history
    const historyEntry = {
      order_id: orderId,
      action_type: 'status_change',
      user_id: userId,
      details: {
        previous_status: previousStatus,
        new_status: newStatus,
        changed_at: new Date().toISOString()
      }
    };
    
    const { error: historyError } = await supabase
      .from('order_history')
      .insert(historyEntry);
      
    if (historyError) {
      console.error(`Error logging to order history: ${historyError.message}`);
      // Continue execution even if this fails
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error in updateOrderStatus:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

// Function to get the current status of an order
export async function getOrderStatus(orderId: string): Promise<OrderStatus | null> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single();
      
    if (error) {
      throw new Error(`Error fetching order status: ${error.message}`);
    }
    
    return (data?.status as OrderStatus) || null;
  } catch (error) {
    console.error('Error in getOrderStatus:', error);
    return null;
  }
}

// Function to mark an order as needing review after admin edits
export async function markOrderForReview(
  orderId: string,
  userId: string,
  changeDetails: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the current order to record previous status
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single();
      
    if (orderError) {
      throw new Error(`Error fetching order: ${orderError.message}`);
    }
    
    const previousStatus = order?.status || 'unknown';
    
    // Only update if not already in review
    if (previousStatus !== 'review') {
      // Update the order status to review
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'review' })
        .eq('id', orderId);
        
      if (updateError) {
        throw new Error(`Error updating order status: ${updateError.message}`);
      }
    }
    
    // Log the edit in order_history
    const historyEntry = {
      order_id: orderId,
      action_type: 'admin_edit',
      user_id: userId,
      details: {
        previous_status: previousStatus,
        new_status: 'review',
        changes_summary: changeDetails,
        edited_at: new Date().toISOString()
      }
    };
    
    const { error: historyError } = await supabase
      .from('order_history')
      .insert(historyEntry);
      
    if (historyError) {
      console.error(`Error logging to order history: ${historyError.message}`);
      // Continue execution even if this fails
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error in markOrderForReview:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
} 