import React from 'react';
import { Badge } from "@/components/ui/badge";
import { getSupabaseClient, getSupabaseAdminClient } from './supabase';

// Re-export the existing types and constants
export type OrderStatus = 'pending' | 'approved' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'review' | 'completed';

export const ORDER_STATUSES: OrderStatus[] = ['pending', 'approved', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'review'];

// Status colors configuration for UI
export const STATUS_COLORS = {
  pending: { variant: 'outline', className: 'bg-gray-100 text-gray-800 hover:bg-gray-200' },
  approved: { variant: 'outline', className: 'bg-blue-100 text-blue-800 hover:bg-blue-200' },
  processing: { variant: 'outline', className: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200' },
  shipped: { variant: 'outline', className: 'bg-purple-100 text-purple-800 hover:bg-purple-200' },
  delivered: { variant: 'outline', className: 'bg-green-100 text-green-800 hover:bg-green-200' },
  completed: { variant: 'outline', className: 'bg-green-100 text-green-800 hover:bg-green-200' },
  cancelled: { variant: 'destructive', className: 'bg-red-100 text-red-800 hover:bg-red-200' },
  review: { variant: 'outline', className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' },
};

// OrderStatusBadge component for displaying status
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const statusConfig = STATUS_COLORS[status] || { variant: 'outline', className: 'bg-gray-100 text-gray-800' };

  return (
    <Badge variant={statusConfig.variant as any} className={statusConfig.className}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

// Get the order status 
export async function getOrderStatus(orderId: string): Promise<OrderStatus | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  
  const { data, error } = await supabase
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .single();
    
  if (error || !data) {
    console.error('Error fetching order status:', error);
    return null;
  }
  
  return data.status as OrderStatus;
}

// Function to mark an order for review (e.g. after an edit)
export async function markOrderForReview(orderId: string, userId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;
  
  // Update the order status to 'review'
  const { error } = await supabase
    .from('orders')
    .update({ status: 'review' })
    .eq('id', orderId);
    
  if (error) {
    console.error('Error marking order for review:', error);
    return false;
  }
  
  return true;
}

// FIXED VERSION: Function to update order status with support for both admin and customer operations
export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  console.log('[updateOrderStatus] Called with:', { orderId, newStatus, userId });
  
  // Extract real Clerk user ID from JWT if possible
  let realUserId = userId;
  
  try {
    if (typeof userId === 'string' && userId.startsWith('sess_')) {
      // If we have window.Clerk, try to get the actual user ID
      if (window.Clerk && window.Clerk.user) {
        realUserId = window.Clerk.user.id;
        console.log('[updateOrderStatus] Using Clerk user ID:', realUserId);
      }
    }
  } catch (error) {
    console.warn('[updateOrderStatus] Error getting Clerk user ID:', error);
    // Continue with original userId
  }

  // Get both regular and admin Supabase clients
  const supabase = getSupabaseClient();
  const supabaseAdmin = getSupabaseAdminClient();
  
  if (!supabase) {
    console.error('Supabase client is not initialized in updateOrderStatus');
    return { success: false, error: 'Database connection error' };
  }

  try {
    // Determine if this is an admin or customer based on Clerk metadata
    const isAdmin = (
      window.Clerk?.user?.publicMetadata?.admin === true || 
      window.Clerk?.user?.publicMetadata?.role === 'admin'
    );
    
    console.log(`Operating as ${isAdmin ? 'admin' : 'customer'} with Clerk ID: ${realUserId}`);
    
    // Get the current order to record previous status and check ownership
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('status, user_id')
      .eq('id', orderId)
      .single();
      
    if (orderError) {
      throw new Error(`Error fetching order: ${orderError.message}`);
    }
    
    const previousStatus = order?.status || 'unknown';
    
    // Check if customer has permission to change this status
    if (!isAdmin) {
      // Only allow customers to change their own orders and only to specific statuses
      const isOwnOrder = order?.user_id === realUserId;
      const allowedCustomerStatusChanges = {
        'pending': ['cancelled'],
        'approved': ['cancelled'],
        'processing': ['cancelled'],
        'shipped': ['delivered'],
        'delivered': ['completed']
      };
      
      const allowedStatusesForCustomer = allowedCustomerStatusChanges[previousStatus as keyof typeof allowedCustomerStatusChanges] || [];
      const canChangeStatus = isOwnOrder && allowedStatusesForCustomer.includes(newStatus);
      
      if (!canChangeStatus) {
        return { 
          success: false, 
          error: `Customers can only change their own orders and only to specific statuses: ${allowedStatusesForCustomer.join(', ')}` 
        };
      }
    }
    
    console.log(`Updating order ${orderId} status to ${newStatus}`);
    
    // Update the order status in the orders table
    const { data: updateResult, error: updateError } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId)
      .select('status');
      
    console.log('Update result:', updateResult);
      
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
    
    // Log the status change in order_history - without user_id field
    // Instead, store the Clerk ID in details to avoid UUID format issues
    const historyEntry = {
      order_id: orderId,
      action_type: 'status_change',
      details: {
        previous_status: previousStatus,
        new_status: newStatus,
        changed_at: new Date().toISOString(),
        clerk_user_id: realUserId,
        original_user_id: userId,
        user_type: isAdmin ? 'admin' : 'customer'
      }
    };
    
    // Always use admin client for order_history to bypass RLS constraints
    if (supabaseAdmin) {
      const { error: historyError } = await supabaseAdmin
        .from('order_history')
        .insert(historyEntry);
        
      if (historyError) {
        console.error(`Error logging to order history with admin client: ${historyError.message}`);
      } else {
        console.log('Successfully logged order history with admin client');
      }
    } else {
      // Fallback to regular client if admin client isn't available
      const { error: historyError } = await supabase
        .from('order_history')
        .insert(historyEntry);
        
      if (historyError) {
        console.error(`Error logging to order history with regular client: ${historyError.message}`);
      }
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
