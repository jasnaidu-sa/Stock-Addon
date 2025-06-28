// Imports
import { Badge } from "@/components/ui/badge";
import { getSupabaseClient, supabaseAdmin } from './supabase';

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
export async function markOrderForReview(orderId: string): Promise<boolean> {
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
): Promise<{ success: boolean; error?: string; data?: { status: string; orderId: string; previousStatus: string } }> {
  console.log('[updateOrderStatus] Called with:', { orderId, newStatus, userId });
  
  // Extract real Clerk user ID from JWT if possible
  let realUserId = userId;
  let supabaseUserId: string | null = null;
  
  try {
    // Instead of directly accessing window.Clerk which may be unreliable
    // We should be using the userId directly from the caller which should
    // already be the Clerk user ID from the session.
    // If session wasn't passed correctly, we'll use what we have
    
    // Make sure the userId is in a valid format for Clerk
    if (typeof userId === 'string') {
      // For Clerk IDs that start with 'user_' we can use them directly
      if (userId.startsWith('user_')) {
        realUserId = userId;
        console.log('[updateOrderStatus] Using provided Clerk user ID:', realUserId);
        
        // Get corresponding Supabase UUID from users table
        if (supabaseAdmin) {
          const { data: userMapping, error: mappingError } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('clerk_id', realUserId)
            .single();
            
          if (userMapping && !mappingError) {
            supabaseUserId = userMapping.id;
            console.log('[updateOrderStatus] Found Supabase UUID mapping:', supabaseUserId);
          } else {
            console.warn('[updateOrderStatus] Could not find Supabase UUID for Clerk ID:', mappingError);
          }
        }
      } else {
        // For backward compatibility, try to get the user ID from the Clerk singleton if available
        if (typeof window !== 'undefined' && window.Clerk?.user?.id) {
          realUserId = window.Clerk.user.id;
          console.log('[updateOrderStatus] Retrieved Clerk user ID:', realUserId);
          
          // Get corresponding Supabase UUID from users table
          if (supabaseAdmin) {
            const { data: userMapping, error: mappingError } = await supabaseAdmin
              .from('users')
              .select('id')
              .eq('clerk_id', realUserId)
              .single();
              
            if (userMapping && !mappingError) {
              supabaseUserId = userMapping.id;
              console.log('[updateOrderStatus] Found Supabase UUID mapping:', supabaseUserId);
            } else {
              console.warn('[updateOrderStatus] Could not find Supabase UUID for Clerk ID:', mappingError);
            }
          }
        } else {
          console.log('[updateOrderStatus] Using fallback user ID:', userId);
        }
      }
    }
  } catch (error) {
    console.warn('[updateOrderStatus] Error processing user ID:', error);
    // Continue with original userId
  }

  // Get regular Supabase client for user-level operations
  const supabase = getSupabaseClient();
  
  // Using the imported supabaseAdmin directly instead of trying to access via window
  // This ensures we have the proper admin client with service role key
  
  if (!supabase) {
    console.error('Supabase client is not initialized in updateOrderStatus');
    return { success: false, error: 'Database connection error' };
  }

  try {
    let isAdmin = false;
    try {
      // First check if we're running in a browser context
      if (typeof window !== 'undefined' && window.Clerk?.user) {
        isAdmin = window.Clerk.user.publicMetadata?.role === 'admin';
      }
      console.log(`Operating as ${isAdmin ? 'admin' : 'customer'} with Clerk ID: ${realUserId}`);
    } catch (error) {
      console.error('Error checking admin status:', error);
      // Default to non-admin for safety
      isAdmin = false;
    }
    
    // Initialize previousStatus variable to be used throughout the function
    let orderPreviousStatus: string = 'unknown';
    
    // Get the current order to record previous status and check ownership
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('status, user_id')
      .eq('id', orderId)
      .single();
      
    if (orderError) {
      throw new Error(`Error fetching order: ${orderError.message}`);
    }
    
    if (order) {
      orderPreviousStatus = order.status;
    }
    
    // Check if customer has permission to change this status
    if (!isAdmin) {
      // Only allow customers to change their own orders and only to specific statuses
      // Use the mapped Supabase UUID for comparison since order.user_id is now a UUID
      const isOwnOrder = order?.user_id === supabaseUserId;
      const allowedCustomerStatusChanges = {
        'pending': ['cancelled'],
        'approved': ['cancelled'],
        'processing': ['cancelled'],
        'shipped': ['delivered'],
        'delivered': ['completed']
      };
      
      const allowedStatusesForCustomer = allowedCustomerStatusChanges[orderPreviousStatus as keyof typeof allowedCustomerStatusChanges] || [];
      const canChangeStatus = isOwnOrder && allowedStatusesForCustomer.includes(newStatus);
      
      if (!canChangeStatus) {
        return { 
          success: false, 
          error: `Customers can only change their own orders and only to specific statuses: ${allowedStatusesForCustomer.join(', ')}` 
        };
      }
    }
    
    console.log(`Updating order ${orderId} status to ${newStatus}`);
    
    console.log('Updating order status in database using admin client');
    // Define a minimal type for the order data we need
    type OrderData = { status: string; id: string };
    let updatedData: OrderData[] = [];
    try {
      if (!supabaseAdmin) {
        return { success: false, error: 'Admin client not available. Check service role key configuration.' };
      }
      
      // Use supabaseAdmin for the update to ensure it bypasses RLS policies
      const { data, error } = await supabaseAdmin
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)
        .select('*');
        
      if (error) {
        console.error('Error updating order status:', error);
        return { success: false, error: error.message };
      }
      
      console.log('Update result from database:', data);
      updatedData = data;
      
      if (!data || data.length === 0) {
        console.error('No rows were updated in the database. Order ID may be invalid or database issue.');
        return { success: false, error: 'No order found with that ID' };
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
    
    // Update our previous status variable if we have data
    if (updatedData && updatedData.length > 0) {
      orderPreviousStatus = updatedData[0].status;
    }
    
    // Update status in order_items table
    try {
      if (!supabaseAdmin) {
        console.warn('Admin client not available for order items update');
      } else {
        const { data: itemData, error: itemError } = await supabaseAdmin
          .from('order_items')
          .update({ status: newStatus })
          .eq('order_id', orderId)
          .select('id'); // Add select to ensure we get data back
        
        if (itemError) {
          console.warn(`Error updating order items: ${itemError.message}`);
        } else {
          const itemCount = Array.isArray(itemData) ? itemData.length : 0;
          console.log(`Updated ${itemCount} order items to status: ${newStatus}`);
        }
      }
    } catch (itemUpdateError) {
      console.error('Exception in order items update:', itemUpdateError);
    }
    
    // Log the status change in order_history - we can now use proper UUIDs for user_id
    // But still keep Clerk ID in details for reference and backward compatibility
    const historyEntry = {
      order_id: orderId,
      action_type: 'status_change',
      user_id: supabaseUserId, // Use the mapped UUID instead of null
      details: {
        previous_status: orderPreviousStatus,
        new_status: newStatus,
        changed_at: new Date().toISOString(),
        clerk_user_id: realUserId, // Keep Clerk ID for reference
        original_user_id: userId,
        user_type: isAdmin ? 'admin' : 'customer'
      }
    };
    
    try {
      if (!supabaseAdmin) {
        console.error('Admin client not available for order history');
        return { success: true, data: { status: newStatus, orderId, previousStatus: orderPreviousStatus } };
      }
      
      console.log('Inserting order history with admin client');
      const { error } = await supabaseAdmin
        .from('order_history')
        .insert([historyEntry]);
        
      if (error) {
        console.error('Error logging to order history with admin client:', error.message);
        // Log but don't fail the operation
      } else {
        console.log('Successfully inserted order history using admin client');
      }
    } catch (historyError) {
      console.error('Exception in order history logging:', historyError);
      // Don't fail the overall operation due to history logging issues
    }
    
    return { 
      success: true,
      data: {
        status: newStatus,
        orderId,
        previousStatus: orderPreviousStatus
      }
    };
  } catch (error) {
    console.error('Error in updateOrderStatus:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}
