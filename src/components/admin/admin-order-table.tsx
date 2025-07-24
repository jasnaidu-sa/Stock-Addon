import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getFilteredRowModel,
  getExpandedRowModel,
  ExpandedState,
  OnChangeFn,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit3, } from "lucide-react";
import { OrderEditDialog } from "./order-edit-dialog";

import { useToast } from '@/hooks/use-toast';
import { useAuth } from "@clerk/clerk-react";
import { fetchProductCodes } from "@/lib/product-utils";
import { formatCurrency, formatDate } from '@/lib/utils';
import { Order, OrderItem, OrderStatus } from '@/types/order';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OrderItemsSubTable } from './order-items-sub-table';
import { getSupabaseClient, supabaseAdmin } from '@/lib/supabase';

const orderStatusOptions: OrderStatus[] = ['pending', 'approved', 'completed', 'cancelled', 'review', 'shipped', 'rejected'];

const getStatusClasses = (status: OrderStatus): string => {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'shipped':
      return 'bg-blue-100 text-blue-800';
    case 'approved':
      return 'bg-yellow-100 text-yellow-800';
    case 'pending':
      return 'bg-gray-100 text-gray-800';
    case 'review':
      return 'bg-purple-100 text-purple-800';
    case 'cancelled':
      return 'bg-red-200 text-red-900';
    case 'rejected':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getColumnsDef = (
  handleStatusUpdate: (orderId: string, newStatus: OrderStatus) => Promise<void>,
  openEditDialog: (order: Order) => void,
  formatCurrency: (value: number) => string,
  hideEditButton: boolean = false
  // getProductCode is not used for defining these top-level columns
): ColumnDef<Order>[] => [
  {
    accessorKey: 'order_number',
    header: 'Order Number',
  },
  {
    accessorKey: 'customer_name',
    header: 'Customer Name',
  },
  {
    accessorKey: 'store_name',
    header: 'Store',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const order = row.original;
      return (
        <Select
          value={order.status}
          onValueChange={(value) => handleStatusUpdate(order.id, value as OrderStatus)}
        >
          <SelectTrigger className={`w-[120px] h-8 text-xs font-semibold border-none rounded-md ${getStatusClasses(order.status)}`}>
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            {orderStatusOptions.map(statusOption => (
              <SelectItem key={statusOption} value={statusOption} className="text-xs">
                {statusOption.charAt(0).toUpperCase() + statusOption.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    },
  },
  {
    accessorKey: 'created_at',
    header: 'Date',
    cell: ({ row }) => formatDate(row.original.created_at),
  },
  {
    accessorKey: 'value',
    header: 'Total Value',
    cell: ({ row }) => formatCurrency(row.original.value),
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => (
      <div className="flex items-center space-x-1">
        {!hideEditButton && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => openEditDialog(row.original)}
            title="Edit Order Items"
            className="h-8 w-8"
          >
            <Edit3 className="h-4 w-4" />
          </Button>
        )}
      </div>
    ),
  }
];

export interface AdminOrderTableProps {
  initialOrders: Order[];
  reloadOrders: () => void;
  hideEditButton?: boolean;
}

export const AdminOrderTable = ({ initialOrders, reloadOrders, hideEditButton = false }: AdminOrderTableProps): JSX.Element => {
  const { toast } = useToast();
  const { userId } = useAuth();
  
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [editingItems, setEditingItems] = useState<Record<string, OrderItem[]>>({});
  
  // Removed fetchOrders reference as it doesn't exist
  useEffect(() => {
    // Initial load is handled by initialOrders prop
  }, []);

  useEffect(() => {
    const fetchCodes = async () => {
      // Extract all stock_item_ids from all orders
      const stockItemIds = orders
        .flatMap(order => order.order_items || [])
        .map(item => item.stock_item_id)
        .filter(Boolean);
      
      if (stockItemIds.length === 0) return;
      
      console.log(`Fetching product codes for ${stockItemIds.length} items`);
      const codes = await fetchProductCodes(stockItemIds);
      console.log('Fetched product codes:', codes);
      setProductCodes(codes);
    };
    
    if (orders.length > 0) {
      fetchCodes();
    }
  }, [orders]);

  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [modifiedItemKeys, setModifiedItemKeys] = useState<Set<string>>(new Set());
  const [addedItemKeys, setAddedItemKeys] = useState<Set<string>>(new Set());
  const [deletedItemKeys, setDeletedItemKeys] = useState<Set<string>>(new Set());
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [globalFilter, setGlobalFilter] = useState<string>("");

  // Track if we're in the middle of an edit operation
  const [isEditing, setIsEditing] = useState(false);
  const [productCodes, setProductCodes] = useState<Record<string, {code: string, description: string, category: string}>>({});
  
  useEffect(() => {
    // Only reset state when not in the middle of an edit operation
    if (!isEditing) {
      // Reset all editing state when not in edit mode
      setOrders(initialOrders);
      setEditingItems({});
      setAdminNotes({});
      setModifiedItemKeys(new Set());
      setAddedItemKeys(new Set());
      setDeletedItemKeys(new Set());
    } else {
      // Just update orders without clearing editing state when in edit mode
      setOrders(initialOrders);
    }
  }, [initialOrders, isEditing]);

  const handleStatusUpdate = useCallback(async (orderId: string, newStatus: OrderStatus) => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        toast({
          title: "Error",
          description: "Supabase client not available",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) {
        console.error('Error updating order status:', error);
        toast({
          title: "Error",
          description: "Failed to update order status",
          variant: "destructive"
        });
        return;
      }

      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );

      toast({
        title: "Status Updated",
        description: `Order status changed to ${newStatus}`,
      });
    } catch (error) {
      console.error('Error in handleStatusUpdate:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    }
  }, [toast]);

  const getProductCode = useCallback((item: OrderItem) => {
    // First try using the fetched product codes
    if (item.stock_item_id && productCodes[item.stock_item_id]) {
      console.log(`Found code in productCodes for ${item.product_name}: ${productCodes[item.stock_item_id].code}`);
      return productCodes[item.stock_item_id].code;
    }
    
    // Then try using the "code" field directly
    if (item.code) {
      console.log(`Found direct code for ${item.product_name}: ${item.code}`);
      return item.code;
    }
    
    // Only as a fallback, try category-specific fields like mattress_code
    if (item.category === 'mattress' && item.mattress_code) {
      console.log(`Found mattress_code for ${item.product_name}: ${item.mattress_code}`);
      return item.mattress_code;
    }
    
    // Extract from product name as a last resort
    if (item.product_name) {
      // Base products have a specific format
      if (item.product_name.startsWith('Base:')) {
        const baseMatch = item.product_name.match(/^Base:\s+([A-Z0-9]+-[A-Z0-9]+)/);
        if (baseMatch) {
          console.log(`Extracted base code from name for ${item.product_name}: ${baseMatch[1]}`);
          return baseMatch[1];
        }
      }
      
      // Try to match standard product code format at start of name
      const codeRegex = /^([A-Z0-9]+-[A-Z0-9]+(?:\s+XL)?)\s+-\s+/;
      const match = item.product_name.match(codeRegex);
      if (match) {
        console.log(`Extracted code from name for ${item.product_name}: ${match[1]}`);
        return match[1];
      }
    }
    
    console.log(`No code found for ${item.product_name}, stock_item_id: ${item.stock_item_id}`);
    return 'Unknown';
  }, [productCodes]);

  const handleOpenEditDialog = useCallback(async (order: Order) => {
    setIsEditing(true);
    setCurrentOrder(order);

    // Fetch deleted items from order_item_history
    const { data: historyData } = await supabaseAdmin!
      .from('order_history')
      .select('id, order_id')
      .eq('order_id', order.id)
      .eq('action_type', 'items_modified');

    let deletedItems: OrderItem[] = [];
    
    if (historyData && historyData.length > 0) {
      // Get all history IDs to fetch related item history
      const historyIds = historyData.map(h => h.id);
      
      const { data: itemHistoryData } = await supabaseAdmin!
        .from('order_item_history')
        .select('*')
        .in('order_history_id', historyIds)
        .eq('action', 'removed');
      
      if (itemHistoryData && itemHistoryData.length > 0) {
        // Convert deleted item history records to OrderItem format
        deletedItems = itemHistoryData.map(item => ({
          id: item.order_item_id,
          order_id: order.id,
          product_name: item.product_name || 'Unknown Product',
          quantity: item.previous_quantity || 0,
          price: item.previous_price || 0,
          price_at_purchase: item.previous_price || 0,
          total: (item.previous_price || 0) * (item.previous_quantity || 0),
          code: '',  // Will be filled by getProductCode if possible
          is_deleted: true,  // Mark as deleted for UI
          stock_item_id: item.stock_item_id
        }));
      }
    }

    if (!editingItems[order.id]) {
      // Use order_items instead of items since that's the property being populated
      console.log('Opening order with items:', order.order_items?.length || 0);
      console.log('Found deleted items:', deletedItems.length);
      
      // Combine current items with deleted items
      setEditingItems(prev => ({
        ...prev,
        [order.id]: [...(order.order_items || []), ...deletedItems]
      }));
    }

    setEditDialogOpen(true);
  }, [editingItems, setCurrentOrder, setEditDialogOpen, setEditingItems, setIsEditing]);

  const handleQuantityChange = useCallback((orderId: string, itemId: string, quantity: number) => {
    setEditingItems(prev => {
      const items = prev[orderId] || [];
      const updatedItems = items.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      );

      if (!addedItemKeys.has(`${orderId}-${itemId}`)) {
        setModifiedItemKeys(prevKeys => new Set(prevKeys).add(`${orderId}-${itemId}`));
      }
      return { ...prev, [orderId]: updatedItems };
    });
  }, [addedItemKeys, setModifiedItemKeys, setEditingItems]);

  const handleDeleteItem = useCallback(
    (orderId: string, itemId: string) => {
      const key = `${orderId}-${itemId}`;
      const currentOrderItems = editingItems[orderId] || [];
      const isNewItem = addedItemKeys.has(key);

      if (isNewItem) {
        // For newly added items, remove from addedItemKeys and filter out from the items array
        setAddedItemKeys(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        
        // Remove the item from the array
        const filteredItems = currentOrderItems.filter(item => item.id !== itemId);
        setEditingItems(prev => {
          const next = { ...prev };
          next[orderId] = filteredItems;
          return next;
        });

        toast({
          title: "Item Removed",
          description: "New item has been removed from the order."
        });
      } else {
        // For existing items, just mark them for deletion but keep in the array
        setDeletedItemKeys(prev => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });
        
        toast({
          title: "Item Marked for Deletion",
          description: "Item will be removed when changes are saved."
        });
      }
    },
    [editingItems, addedItemKeys, deletedItemKeys, setAddedItemKeys, setDeletedItemKeys, setEditingItems, toast]
  );

  const handleDiscard = useCallback((orderId: string) => {
    const { [orderId]: _, ...restItems } = editingItems;
    setEditingItems(restItems);

    setEditDialogOpen(false);
    setCurrentOrder(null);
    
    // Set editing mode to false when dialog closes
    setIsEditing(false);
  }, [editingItems, setEditDialogOpen, setCurrentOrder, setEditingItems, setIsEditing]);

  // Helper function to calculate order totals from items
  const calculateTotals = (items: OrderItem[]) => {
    const quantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const value = items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);
    return { quantity, value };
  };

  const handleSave = useCallback(async (order: Order) => {
    try {
      setIsSaving(true);
      const allEditedOrderItems = editingItems[order.id];
      if (!allEditedOrderItems) {
        toast({ title: "No changes", description: "No items were modified.", variant: "default" });
        setIsSaving(false);
        return;
      }

      // Filter out deleted items from the edited items
      const editedOrderItems = allEditedOrderItems.filter(item => {
        const key = `${order.id}-${item.id}`;
        return !deletedItemKeys.has(key);
      });

      const originalOrderItems = order.order_items || [];
      const newTotals = calculateTotals(editedOrderItems);
      
      // Validate the user is authenticated
      if (!userId) {
        toast({ title: "Authentication Error", description: "Please sign in again to continue.", variant: "destructive" });
        setIsSaving(false);
        return;
      }
      
      // Use supabaseAdmin for privileged operations to bypass RLS
      if (!supabaseAdmin) {
        console.error('SupabaseAdmin client not initialized for order history');
        toast({ title: "Admin Error", description: "Admin database client not available", variant: "destructive" });
        setIsSaving(false);
        return;
      }
      
      console.log('Using supabaseAdmin client for order_history operations');
      
      // Process item changes (Added, Modified, Removed)
      const newItemsToInsert: OrderItem[] = [];
      const existingItemsToUpdate: OrderItem[] = [];
      const removedItemOriginalDetails: OrderItem[] = [];

      // Check for modified or new items
      editedOrderItems.forEach((item) => {
        if (item.id.startsWith('new-')) {
          // This is a new item
          newItemsToInsert.push(item);
        } else {
          // This is an existing item that might have been modified
          const originalItem = originalOrderItems.find(oi => oi.id === item.id);
          if (originalItem) {
            if (
              item.quantity !== originalItem.quantity ||
              item.price !== originalItem.price
            ) {
              // Item was modified
              existingItemsToUpdate.push(item);
            }
          } else {
            console.warn("Edited item not found in original items and not a new- item:", item);
          }
        }
      });
      
      // Identify removed items
      originalOrderItems.forEach((originalItem) => {
        const stillExists = editedOrderItems.find((ei) => ei.id === originalItem.id);
        if (!stillExists) {
          removedItemOriginalDetails.push(originalItem);
        }
      });

      // 3. Insert new items
      if (newItemsToInsert.length > 0) {
        const itemsToInsertForDB = newItemsToInsert.map(item => ({
          order_id: order.id,
          product_id: item.product_id,
          product_name: item.product_name,
          price: item.price,
          quantity: item.quantity,
          total: item.price * item.quantity,
          stock_item_id: item.stock_item_id
        }));

        const { data: insertedItemsData, error: insertNewItemsError } = await supabaseAdmin
          .from('order_items')
          .insert(itemsToInsertForDB)
          .select('id, product_name');

        if (insertNewItemsError) {
          console.error('Failed to insert new order items:', insertNewItemsError);
          toast({ 
            title: "Error", 
            description: "Failed to save new items to your order.", 
            variant: "destructive" 
          });
          setIsSaving(false);
          return;
        }

        if (insertedItemsData && insertedItemsData.length > 0) {
          insertedItemsData.forEach((dbItem) => {
            const tempItemDetails = newItemsToInsert.find(
              temp => temp.product_name === dbItem.product_name && temp.order_id === order.id
            );
            
            if (tempItemDetails) {
              // Add directly to orderHistoryEntries instead
              orderHistoryEntries.push({
                order_id: order.id,
                order_line_id: dbItem.id,
                user_id: userId,
                admin_notes: adminNotes[order.id] || '',
                order_number: order.order_number,
                action_type: 'added',
                original_qty: 0,
                updated_qty: tempItemDetails.quantity,
                original_value: 0,
                updated_value: tempItemDetails.price * tempItemDetails.quantity,
              });
            }
          });
        }
      }

      // 4. Update existing items
      for (const itemToUpdate of existingItemsToUpdate) {
        const { error: updateItemError } = await supabaseAdmin
          .from('order_items')
          .update({
            quantity: itemToUpdate.quantity,
            price: itemToUpdate.price,
            total: itemToUpdate.price * itemToUpdate.quantity
          })
          .eq('id', itemToUpdate.id);

        if (updateItemError) {
          console.error('Error updating order item:', itemToUpdate.id, updateItemError);
          toast({
            title: "Warning", 
            description: `Failed to update item ${itemToUpdate.product_name}.`, 
            variant: "destructive"
          });
        }
      }
      
      // 5. Delete removed items
      const removedItemIds = removedItemOriginalDetails.map(item => item.id);
      console.log('Items to be removed:', removedItemOriginalDetails);
      console.log('Removed item IDs:', removedItemIds);
      
      if (removedItemIds.length > 0) {
        const { error: deleteItemsError } = await supabaseAdmin
          .from('order_items')
          .delete()
          .in('id', removedItemIds);

        if (deleteItemsError) {
          console.error('Error deleting order items:', deleteItemsError);
          toast({ 
            title: "Error", 
            description: "Failed to remove items from order.", 
            variant: "destructive" 
          });
          setIsSaving(false);
          return;
        } else {
          console.log('Successfully deleted items from order_items table');
        }
      }

      // 6. Create individual order_history entries for every item in the order
      // First, prepare all the history entries with the appropriate action_type
      const orderHistoryEntries: Array<{
        order_id: string;
        order_line_id: string;
        user_id: string;
        admin_notes: string;
        order_number: string;
        action_type: string;
        original_qty: number;
        updated_qty: number;
        original_value: number;
        updated_value: number;
      }> = [];
      
      // Process modified items
      const modifiedItemIds = existingItemsToUpdate.map(item => item.id);
      
      // Process removed items
      // We already have the removedItemIds from earlier
      
      // Process added items
      const addedItems = newItemsToInsert;
      
      // Find unchanged items (in both original and edited, with no changes)
      originalOrderItems.forEach((originalItem) => {
        // Skip items that were removed or modified (already handled)
        if (removedItemIds.includes(originalItem.id) || modifiedItemIds.includes(originalItem.id)) {
          return;
        }
        
        const editedItem = editedOrderItems.find(item => item.id === originalItem.id);
        if (editedItem && 
            editedItem.quantity === originalItem.quantity && 
            editedItem.price === originalItem.price) {
          // This is an unchanged item - add it with 'no-change' action_type
          orderHistoryEntries.push({
            order_id: order.id,
            order_line_id: originalItem.id,
            user_id: userId,
            admin_notes: adminNotes[order.id] || '',
            order_number: order.order_number,
            action_type: 'no-change',
            original_qty: originalItem.quantity,
            updated_qty: originalItem.quantity,
            original_value: originalItem.price * originalItem.quantity,
            updated_value: originalItem.price * originalItem.quantity,
          });
        }
      });
      
      // Add entries for modified items
      existingItemsToUpdate.forEach(item => {
        const originalItem = originalOrderItems.find(oi => oi.id === item.id);
        if (originalItem) {
          orderHistoryEntries.push({
            order_id: order.id,
            order_line_id: item.id,
            user_id: userId,
            admin_notes: adminNotes[order.id] || '',
            order_number: order.order_number,
            action_type: 'amended',
            original_qty: originalItem.quantity,
            updated_qty: item.quantity,
            original_value: originalItem.price * originalItem.quantity,
            updated_value: item.price * item.quantity,
          });
        }
      });
      
      // Add entries for removed items
      removedItemOriginalDetails.forEach(item => {
        const historyEntry = {
          order_id: order.id,
          order_line_id: item.id,
          user_id: userId,
          admin_notes: adminNotes[order.id] || '',
          order_number: order.order_number,
          action_type: 'deleted',
          original_qty: item.quantity,
          updated_qty: 0,
          original_value: item.price * item.quantity,
          updated_value: 0,
          // Store the full item details in the order_items JSONB field
          order_items: [{
            id: item.id,
            order_id: order.id,
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity,
            stock_item_id: item.stock_item_id,
            code: item.code || getProductCode(item),
            category: item.category,
            mattress_code: item.mattress_code
          }]
        };
        
        console.log('Adding history entry for deleted item:', historyEntry);
        orderHistoryEntries.push(historyEntry);
      });
      
      // Add entries for added items
      addedItems.forEach(item => {
        orderHistoryEntries.push({
          order_id: order.id,
          order_line_id: item.id,
          user_id: userId,
          admin_notes: adminNotes[order.id] || '',
          order_number: order.order_number,
          action_type: 'added',
          original_qty: 0,
          updated_qty: item.quantity,
          original_value: 0,
          updated_value: item.price * item.quantity,
        });
      });
      
      // Insert all history entries in a single batch
      console.log('Inserting order history entries:', orderHistoryEntries);
      const { data: batchHistoryResult, error: batchHistoryError } = await supabaseAdmin
        .from('order_history')
        .insert(orderHistoryEntries)
        .select('id');
        
      console.log('History insert result:', batchHistoryResult);
      if (batchHistoryError) {
        console.error('History insert error:', batchHistoryError);
      }

      if (batchHistoryError || !batchHistoryResult) {
        console.error('Failed to create order_history entries:', batchHistoryError);
        toast({ title: "Error", description: "Failed to log order changes.", variant: "destructive" });
        setIsSaving(false);
        return;
      }
      
      // Note: historyEntryResult is an array of objects, not a single object
      // We don't need to use orderHistoryId for anything else in this function

      // 7. Update the main orders table
      // Set amend_status to "yes" to indicate this order has been amended
      const { error: updateOrderError } = await supabaseAdmin
        .from('orders')
        .update({
          status: 'review',
          quantity: newTotals.quantity,
          value: newTotals.value,
          amend_status: 'yes',
        })
        .eq('id', order.id);

      if (updateOrderError) {
        console.error('Error updating main order record:', updateOrderError);
        toast({ 
          title: "Error", 
          description: "Failed to update order summary.", 
          variant: "destructive" 
        });
        setIsSaving(false);
        return;
      }

      toast({
        title: "Order Updated",
        description: `Order ${order.order_number} has been updated and set for customer review.`,
      });


      
      // Clear editing state
      setEditingItems(current => {
        const { [order.id]: _, ...rest } = current;
        return rest;
      });
      
      setAdminNotes(current => {
        const { [order.id]: _, ...rest } = current;
        return rest;
      });
      
      // Clear state tracking sets for this order
      setAddedItemKeys(prev => {
        const next = new Set(prev);
        Array.from(prev).forEach(key => {
          if (key.startsWith(`${order.id}-`)) next.delete(key);
        });
        return next;
      });
      
      setModifiedItemKeys(prev => {
        const next = new Set(prev);
        Array.from(prev).forEach(key => {
          if (key.startsWith(`${order.id}-`)) next.delete(key);
        });
        return next;
      });
      
      setDeletedItemKeys(prev => {
        const next = new Set(prev);
        Array.from(prev).forEach(key => {
          if (key.startsWith(`${order.id}-`)) next.delete(key);
        });
        return next;
      });

      reloadOrders();
      setEditDialogOpen(false);
      setCurrentOrder(null);
      
      // Set editing mode to false when dialog closes after saving
      setIsEditing(false);
    } catch (error: any) {
      console.error('Error updating order:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update order",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [editingItems, adminNotes, userId, toast, reloadOrders, deletedItemKeys]);
  
  // handleDialogSaveChanges has been removed as it was redundant

  const columns = useMemo(() => getColumnsDef(handleStatusUpdate, handleOpenEditDialog, formatCurrency, hideEditButton), [handleStatusUpdate, handleOpenEditDialog, formatCurrency, hideEditButton]);

  const table = useReactTable({
    data: orders,
    columns,
    state: {
      expanded,
      globalFilter,
    },
    onExpandedChange: setExpanded as OnChangeFn<ExpandedState>,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    getRowCanExpand: () => true,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Input
          placeholder="Filter orders..."
          value={globalFilter ?? ''}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <React.Fragment key={row.id}>
                  <TableRow 
                    key={row.id} 
                    onClick={() => row.toggleExpanded()} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {row.getIsExpanded() && (
                    <TableRow className="bg-muted/10 hover:bg-muted/20 transition-colors">
                      <TableCell colSpan={columns.length}>
                        <OrderItemsSubTable
                          items={row.original.order_items || []}
                          getProductCode={getProductCode}
                          orderStatus={row.original.status}
                          orderId={row.original.id}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
        <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          Next
        </Button>
      </div>

      {editDialogOpen && currentOrder && (
        <OrderEditDialog
          open={editDialogOpen}
          onOpenChange={(isOpen) => {
            if (!isOpen && !isSaving) {
              setTimeout(() => {
                setCurrentOrder(null);
                setEditDialogOpen(false);
              }, 50);
            }
          }}
          currentOrder={currentOrder}
          orderItems={editingItems[currentOrder.id] || []}
          adminNotes={adminNotes[currentOrder.id] || ""}
          onAdminNotesChange={(notes) => setAdminNotes(prev => ({ ...prev, [currentOrder.id]: notes }))}
          onQuantityChange={(itemId, quantity) => handleQuantityChange(currentOrder.id, itemId, quantity)}
          onDeleteItem={(itemId) => handleDeleteItem(currentOrder.id, itemId)}
          onSave={() => handleSave(currentOrder)}
          onDiscard={() => handleDiscard(currentOrder.id)}
          isSaving={isSaving}
          isItemModified={(itemId) => modifiedItemKeys.has(`${currentOrder.id}-${itemId}`)}
          isItemAdded={(itemId) => addedItemKeys.has(`${currentOrder.id}-${itemId}`)}
          isItemDeleted={(itemId) => deletedItemKeys.has(`${currentOrder.id}-${itemId}`)}
          getProductCode={getProductCode}
        />
      )}
    </div>
  );
};