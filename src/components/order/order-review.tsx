import React from "react"
import { useState, useEffect } from "react"
import { getSupabaseClient } from '@/lib/supabase';
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Check, X } from "lucide-react"
import type { Order, OrderItem, OrderStatus } from "@/types/order"

interface OrderHistory {
  id: string;
  order_id: string;
  created_at: string;
  // order_items might not be what we expect here; it was a snapshot.
  // The detailed changes will come from OrderItemChange[]
  order_items?: any[]; // Keep for now if used by old logic, but new logic uses detailedItemChanges
  action_type?: string;
  user_id?: string;
  details?: string; // This was a summary string
  original_qty?: number;
  updated_qty?: number;
  original_value?: number;
  updated_value?: number;
  admin_notes?: string;
  changes_summary?: string; // This was the old summary string

  // Fields from the direct order_history table schema that are relevant
  changed_by?: string;
  change_type?: string;
  previous_status?: string; // Status of the order before this history entry
  new_status?: string;    // Status of the order after this history entry (e.g., 'review')
  notes?: string;           // Admin notes for THIS history event
  metadata?: {             // JSONB field for structured data
    original_quantity?: number;
    updated_quantity?: number;
    original_value?: number;
    updated_value?: number;
    // Add other relevant metadata if stored
  };
}

// Add interface for individual item changes from order_item_history
interface OrderItemChange {
  id: string;
  order_history_id: string;
  order_item_id?: string; // Can be null for 'added' items initially if ID comes from insert
  stock_item_id?: string;
  product_name?: string;
  previous_quantity?: number;
  new_quantity?: number;
  previous_price?: number;
  new_price?: number;
  action: 'added' | 'modified' | 'removed';
}

// Interface for the items that will be displayed, augmented with change info
interface DisplayOrderItem extends OrderItem {
  action: 'added' | 'modified' | 'removed' | 'unchanged' | 'current';
  order_item_id?: string; // Used in `display.some` and for mapping
  previous_quantity?: number;
  previous_price?: number;
}

interface OrderReviewProps {
  order: Order
  onClose: () => void
  onOrderUpdated?: () => void
}

export function OrderReview({ 
  const supabase = getSupabaseClient(); // Initialize Supabase clientorder, onClose, onOrderUpdated }: OrderReviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editSessionHistory, setEditSessionHistory] = useState<OrderHistory | null>(null);
  const [detailedItemChanges, setDetailedItemChanges] = useState<OrderItemChange[]>([]);
  const [displayItems, setDisplayItems] = useState<DisplayOrderItem[]>([]);

  useEffect(() => {
    const fetchOrderHistoryAndChanges = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // 1. Fetch the latest 'review' or 'edited' order_history entry for this order
        const { data: historyData, error: historyError } = await supabase
          .from('order_history')
          .select('*')
          .eq('order_id', order.id)
          // .eq('new_status', 'review') // Ensure we fetch the one that triggered review state
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (historyError) {
          if (historyError.code === 'PGRST116') { // "single" row expected, but 0 rows found
            setError("No pending review session found for this order.");
            setEditSessionHistory(null);
            // Still need to set displayItems to current order items if no history
             const currentItems = order.items?.map(item => ({
                ...item,
                action: 'current' as 'current', // Explicitly type 'current'
                original_quantity: item.quantity,
                original_price: item.price,
             })) || [];
            setDisplayItems(currentItems);
            setIsLoading(false);
            return;
          }
          throw historyError;
        }
        setEditSessionHistory(historyData);

        // 2. Fetch associated order_item_history entries for that order_history.id
        const { data: itemChangesData, error: itemChangesError } = await supabase
          .from('order_item_history')
          .select('*')
          .eq('order_history_id', historyData.id);

        if (itemChangesError) throw itemChangesError;
        setDetailedItemChanges(itemChangesData || []);

        // 3. Construct displayItems
        const processedItems = processOrderChanges(
          order.items || [],
          itemChangesData || [],
          historyData // Pass the fetched history data
        );
        setDisplayItems(processedItems);

      } catch (err: any) {
        console.error("Error fetching order review data:", err);
        setError("Failed to load review details: " + err.message);
        // Display current items if history fails
        const currentItems = order.items?.map(item => ({
            ...item,
            action: 'current' as 'current',
            original_quantity: item.quantity,
            original_price: item.price,
         })) || [];
        setDisplayItems(currentItems);
      } finally {
        setIsLoading(false);
      }
    };

    if (order && order.status === 'review') {
      fetchOrderHistoryAndChanges();
    } else {
      // If not in review, just display current items
      const currentItems = order.items?.map(item => ({
        ...item,
        action: 'current' as 'current',
        original_quantity: item.quantity,
        original_price: item.price,
      })) || [];
      setDisplayItems(currentItems);
      setIsLoading(false);
    }
  }, [order]);


  // This function will combine current items and changes
  const processOrderChanges = (
    currentItems: OrderItem[],
    changes: OrderItemChange[],
    history: OrderHistory | null
  ): DisplayOrderItem[] => {
    const display: DisplayOrderItem[] = [];
    const handledChangeIds = new Set<string>();

    // Add modified and removed items first based on changes
    changes.forEach(change => {
      if (change.order_item_id) handledChangeIds.add(change.order_item_id);

      if (change.action === 'modified' && change.order_item_id) {
        const currentItem = currentItems.find(item => item.id === change.order_item_id);
        if (currentItem) {
          display.push({
            ...currentItem, // Spread currentItem first to get all OrderItem props
            order_item_id: currentItem.id, // Explicitly ensure order_item_id if needed, though currentItem.id should suffice
            action: 'modified',
            previous_quantity: change.previous_quantity,
            previous_price: change.previous_price,
          });
        } else {
          // Item was modified but then possibly removed by a later admin action not part of this history log?
          // Or it refers to an item that was removed and this is the record of its modification prior to removal.
          // For display, it might be clearer to show it as removed with its last known state.
           display.push({
            id: change.order_item_id || `removed-${change.id}`,
            order_id: order.id, // Assuming order context is available
            order_item_id: change.order_item_id,
            stock_item_id: change.stock_item_id || '', // Fallback for undefined
            product_name: change.product_name || 'Unknown (from history)', // Fallback for undefined
            quantity: 0, // Show 0 quantity for removed
            price: change.previous_price || 0,
            total: 0,
            action: 'removed',
            previous_quantity: change.previous_quantity,
            previous_price: change.previous_price,
            // Ensure all OrderItem fields are present if DisplayOrderItem extends OrderItem
            // and these are not covered by the above. Add placeholders if necessary.
            product_id: '', // Example placeholder, adjust if needed
            // Add other OrderItem fields if they are not optional and not covered
          });
        }
      } else if (change.action === 'removed') {
        display.push({
          id: change.order_item_id || `removed-${change.id}`, // Use actual item ID if available
          order_id: order.id, // Assuming order context
          order_item_id: change.order_item_id,
          stock_item_id: change.stock_item_id || '', // Fallback
          product_name: change.product_name || 'Unknown (from history)', // Fallback
          quantity: 0, // Show 0 quantity for removed
          price: change.previous_price || 0,
          total: 0,
          action: 'removed',
          previous_quantity: change.previous_quantity,
          previous_price: change.previous_price,
          // Ensure all OrderItem fields
          product_id: '', // Example placeholder
        });
      } else if (change.action === 'added') {
         const currentItem = currentItems.find(item => item.id === change.order_item_id);
         if (currentItem) { // Item exists in current items, means it was added
            display.push({
                ...currentItem,
                action: 'added',
            });
         } else {
            // This case should ideally not happen if 'added' change means it's in currentItems.
            // If it can, log or handle appropriately.
            console.warn('Added item from history not found in current order items:', change);
         }
      }
    });

    // Add current items that were not part of "modified" or "removed" (i.e., unchanged or truly new)
    currentItems.forEach(item => {
      // If an item was part of a 'modified' log, it's already handled.
      // If an item was logged as 'added', it's also handled.
      // We only want to add items here that are in currentItems but *not* in detailedItemChanges as 'modified' or 'removed'.
      // And also not already added to displayItems if they were 'added' type changes.

      const alreadyProcessed = display.some(di => di.order_item_id === item.id && (di.action === 'modified' || di.action === 'added'));

      if (!alreadyProcessed) {
        // Check if this item ID exists in any change log. If it does, it means it was modified or added.
        // If it doesn't, it means it's an existing, unchanged item from before the edit session.
        const changeForThisItem = changes.find(c => c.order_item_id === item.id);
        if (!changeForThisItem) {
             display.push({
                ...item,
                action: 'unchanged', // Or 'current' if you prefer
             });
        }
        // If changeForThisItem exists but it wasn't added to display (e.g., an 'added' change where item was missing from currentItems),
        // this logic might need refinement. The current setup prioritizes data from 'changes'.
      }
    });
    
    // Filter out duplicates if any occurred, prioritizing the version from 'changes'
    const uniqueDisplayItems = Array.from(new Map(display.map(item => [item.id, item])).values());
    
    // Sort items for consistent display: e.g., by name or original order
    uniqueDisplayItems.sort((a, b) => (a.product_name || '').localeCompare(b.product_name || ''));


    return uniqueDisplayItems;
  };


  const handleAccept = async () => {
    try {
      setProcessing(true)
      setError(null)

      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'pending' }) // Example: revert to pending or set to 'confirmed_by_customer'
        .eq('id', order.id);

      if (updateError) throw updateError;

      if (editSessionHistory) {
        const { error: historyUpdateError } = await supabase
          .from('order_history')
          .update({
            notes: (editSessionHistory.notes || "") + "\nCustomer accepted changes.",
            // Optionally update action_type or add a customer_action field/status
          })
          .eq('id', editSessionHistory.id);

        if (historyUpdateError) {
          console.warn("Failed to update order history on acceptance:", historyUpdateError);
        }
      }

      onOrderUpdated?.()
      onClose()
    } catch (err: any) {
      console.error('Error accepting changes:', err)
      setError(`Failed to accept changes: ${err.message}`)
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    try {
      setProcessing(true);
      setError(null);

      if (!editSessionHistory || detailedItemChanges.length === 0) {
        throw new Error('Cannot reject changes: No detailed edit history found for this review session.');
      }

      const operations = [];

      for (const change of detailedItemChanges) {
        if (change.action === 'added' && change.order_item_id) {
          operations.push(
            supabase.from('order_items').delete().eq('id', change.order_item_id)
          );
        } else if (change.action === 'modified' && change.order_item_id) {
          operations.push(
            supabase.from('order_items').update({
              quantity: change.previous_quantity,
              price: change.previous_price,
              total: (change.previous_quantity || 0) * (change.previous_price || 0),
            }).eq('id', change.order_item_id)
          );
        } else if (change.action === 'removed' && change.order_item_id) {
          const itemToReinsert: Partial<OrderItem> & { stock_item_id: string; product_name: string;} = {
            order_id: order.id,
            stock_item_id: change.stock_item_id || '', // Provide fallback
            product_name: change.product_name || '', // Provide fallback
            quantity: change.previous_quantity,
            price: change.previous_price,
            total: (change.previous_quantity || 0) * (change.previous_price || 0),
          };
          if (change.order_item_id && change.order_item_id.length === 36) { // Basic UUID check
             (itemToReinsert as any).id = change.order_item_id; 
          }
          operations.push(
            supabase.from('order_items').insert(itemToReinsert as any) // Cast to any if type is too complex for insert
          );
        }
      }
      
      const results = await Promise.allSettled(operations.map(op => op.then(res => {
          if (res.error) throw res.error; // Throw if Supabase op itself had an error
          return res;
      })));

      results.forEach(result => {
        if (result.status === 'rejected') {
          console.error("A revert operation failed:", result.reason);
        }
      });
      
      const hasFailures = results.some(r => r.status === 'rejected');
      if(hasFailures){
          // Decide if this is a critical failure
          console.warn("Some revert operations failed. Order might be in an inconsistent state.");
          // Potentially throw new Error("Could not fully revert order changes.") to stop further processing.
      }

      // Revert main order details based on what was stored in editSessionHistory
      const originalOrderMetadata = editSessionHistory.metadata;
      const updateOrderPayload: Partial<Order> = {
        status: (editSessionHistory.previous_status || 'pending') as OrderStatus,
      };
      if (originalOrderMetadata?.original_quantity !== undefined) {
        updateOrderPayload.quantity = originalOrderMetadata.original_quantity;
      }
      if (originalOrderMetadata?.original_value !== undefined) {
        updateOrderPayload.value = originalOrderMetadata.original_value;
      }

      const { data: updatedOrderData, error: updateOrderError } = await supabase
        .from('orders')
        .update(updateOrderPayload)
        .eq('id', order.id)
        .select()
        .single();

      if (updateOrderError) {
        console.error("Error reverting order status/totals:", updateOrderError);
        throw updateOrderError;
      }
      
      if (editSessionHistory) {
        const { error: historyUpdateError } = await supabase
          .from('order_history')
          .update({
             notes: (editSessionHistory.notes || "") + "\nCustomer rejected changes. Order reverted.",
          })
          .eq('id', editSessionHistory.id);
        if (historyUpdateError) {
            console.warn("Failed to update order history on rejection:", historyUpdateError);
        }
      }

      onOrderUpdated?.();
      onClose();
    } catch (err: any) {
      console.error('Error rejecting changes:', err);
      setError(`Failed to reject changes: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-center">Loading order details for review...</div>
  }

  if (error) { // Display error if fetching/processing failed
    return (
      <div className="space-y-6 p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Error loading order review: {error} <br />
            Please try again or contact support if the issue persists.
          </AlertDescription>
        </Alert>
        <Button onClick={onClose}>Close</Button>
      </div>
    );
  }
  
  // If not in review status, or if it's in review but we decided not to show a diff (e.g. no history)
  // This part of the logic might need refinement based on how strictly we want to enforce diff view for 'review' status
  if (order.status !== 'review' || !editSessionHistory) {
     // This case should ideally be handled by the loading state or initial useEffect logic.
     // If we reach here, it means an order not in 'review' was passed or history failed to load.
     // Display a simplified view of current order items if displayItems has them.
     if (displayItems.length > 0) {
        return (
            <div className="space-y-6 p-6">
                <div>
                    <h2 className="text-lg font-semibold">Order Details</h2>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-right">Price</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {displayItems.map((item, index) => (
                            <TableRow key={item.id || index}>
                                <TableCell>{item.product_name}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                                <TableCell className="text-right">{item.quantity}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                            </TableRow>
                        ))}
                        <TableRow>
                            <TableCell colSpan={2} />
                            <TableCell className="text-right font-medium">Total:</TableCell>
                            <TableCell className="text-right font-medium">
                                {formatCurrency(order.value || 0)}
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose}>Close</Button>
                </div>
            </div>
        );
     }
     // Fallback if displayItems is also empty
     return (
      <div className="space-y-6 p-6">
        <div>
          <h2 className="text-lg font-semibold">Order Details</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayItems.map((item, index) => (
              <TableRow key={item.id || index}>
                <TableCell>{item.product_name}</TableCell>
                <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
                <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={2} />
              <TableCell className="text-right font-medium">Total:</TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(order.value || 0)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    );
  }


  // Main review display
  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold">Review Order Changes</h2>
        <p className="text-sm text-muted-foreground">
          Please review the changes made to your order
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {editSessionHistory?.admin_notes && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Admin Notes</h3>
          <p className="text-sm text-muted-foreground rounded-md border p-3">
            {editSessionHistory.admin_notes}
          </p>
        </div>
      )}

      {editSessionHistory?.changes_summary && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Changes Made</h3>
          <p className="text-sm text-muted-foreground rounded-md border p-3">
            {editSessionHistory.changes_summary}
          </p>
        </div>
      )}

      <div className="space-y-4">
        <Separator />
        <h3 className="text-sm font-medium mb-3">Order Items (Review Changes)</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayItems.map((item, index) => {
              let rowClass = "";
              let statusText = "";
              let quantityDisplay = String(item.quantity);
              let priceDisplay = formatCurrency(item.price);

              switch (item.action) {
                case 'added':
                  rowClass = "bg-green-100 dark:bg-green-900";
                  statusText = "Added";
                  break;
                case 'removed':
                  rowClass = "bg-red-100 dark:bg-red-900 line-through";
                  statusText = "Removed";
                  quantityDisplay = String(item.previous_quantity); // Show original quantity
                  priceDisplay = formatCurrency(item.previous_price || 0); // Show original price
                  break;
                case 'modified':
                  rowClass = "bg-yellow-100 dark:bg-yellow-900";
                  statusText = "Modified";
                  // Show "new (old)"
                  quantityDisplay = `${item.quantity} (was ${item.previous_quantity})`;
                  priceDisplay = `${formatCurrency(item.price)} (was ${formatCurrency(item.previous_price || 0)})`;
                  break;
                case 'unchanged':
                    statusText = "Unchanged"
                    break;
                default: // 'current' or undefined
                    statusText = "Current"; // Should ideally be 'unchanged'
                    break;
              }

              return (
                <TableRow key={item.id || `item-${index}`} className={rowClass}>
                  <TableCell>{item.product_name}</TableCell>
                  <TableCell className="text-right">{priceDisplay}</TableCell>
                  <TableCell className="text-right">{quantityDisplay}</TableCell>
                  <TableCell className="text-right">
                    {item.action === 'removed' ? formatCurrency(0) : formatCurrency(item.total)}
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow>
              <TableCell colSpan={3} />
              <TableCell className="text-right font-medium">Final Total:</TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(order.value || 0)} 
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <Separator />

      <div className="flex justify-end gap-4">
        <Button
          variant="outline"
          onClick={handleReject}
          disabled={isProcessing}
        >
          <X className="mr-2 h-4 w-4" />
          Reject Changes
        </Button>
        <Button
          onClick={handleAccept}
          disabled={isProcessing}
        >
          <Check className="mr-2 h-4 w-4" />
          Accept Changes
        </Button>
      </div>
    </div>
  )
}

// Helper to format currency - replace with your actual utility
const formatCurrency = (amount: number | undefined | null) => {
  if (amount === undefined || amount === null) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}; 