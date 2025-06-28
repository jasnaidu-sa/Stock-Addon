import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getFilteredRowModel,
  getExpandedRowModel,
  ExpandedState,
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
import { Edit3, ChevronDown, ChevronUp } from "lucide-react";
import { OrderEditDialog } from "./order-edit-dialog";

import { useToast } from '@/hooks/use-toast';
import { useAuth } from "@clerk/clerk-react";
import { formatCurrency, formatDate } from '@/lib/utils';
import { Order, OrderItem, OrderStatus } from '@/types/order';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OrderItemsSubTable } from './order-items-sub-table';
import { getSupabaseClient } from '@/lib/supabase';

// Placeholder Product type
interface Product {
  id: string;
  name: string;
  price: number;
  product_id: string;
  code?: string;
  stock_item_id?: string;
}

const orderStatusOptions: OrderStatus[] = ['pending', 'approved', 'completed', 'cancelled', 'review'];

const getColumnsDef = (
  handleStatusUpdate: (orderId: string, newStatus: OrderStatus) => Promise<void>,
  openEditDialog: (order: Order) => void,
  formatCurrency: (value: number) => string,
  formatDate: (dateString: string) => string
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
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const order = row.original;
      return (
        <Select
          defaultValue={order.status}
          onValueChange={(value) => handleStatusUpdate(order.id, value as OrderStatus)}
        >
          <SelectTrigger className="w-[120px] h-8 text-xs">
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
        <Button
          variant="outline"
          size="icon"
          onClick={() => openEditDialog(row.original)}
          title="Edit Order Items"
          className="h-8 w-8"
        >
          <Edit3 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={row.getToggleExpandedHandler()}
          title={row.getIsExpanded() ? "Collapse Items" : "Expand Items"}
          className="h-8 w-8"
        >
          {row.getIsExpanded() ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>
    ),
  }
];

export interface AdminOrderTableProps {
  initialOrders: Order[];
  initialProductCodes: Product[];
  reloadOrders: () => Promise<void>;
}

export const AdminOrderTable: React.FC<AdminOrderTableProps> = ({ initialOrders, initialProductCodes, reloadOrders }) => {
  const { toast } = useToast();
  const { getToken } = useAuth();
  
  const [orders, setOrders] = useState<Order[]>(initialOrders);

  useEffect(() => {
    setOrders(initialOrders);
    // Reset editing states when orders are reloaded to avoid stale data
    setEditingItems({});
    setAdminNotes({});
    setModifiedItemKeys(new Set());
    setAddedItemKeys(new Set());
    setDeletedItemKeys(new Set());
  }, [initialOrders]);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [editingItems, setEditingItems] = useState<Record<string, OrderItem[]>>({});
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [modifiedItemKeys, setModifiedItemKeys] = useState<Set<string>>(new Set());
  const [addedItemKeys, setAddedItemKeys] = useState<Set<string>>(new Set());
  const [deletedItemKeys, setDeletedItemKeys] = useState<Set<string>>(new Set());
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [globalFilter, setGlobalFilter] = useState("");

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast({ title: "Error", description: "Supabase client not available.", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);

    if (error) {
      console.error("Error updating order status:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setOrders(prev => prev.map(order => order.id === orderId ? { ...order, status: newStatus } : order));
      toast({ title: "Status Updated", description: `Order status changed to ${newStatus}.` });
    }
  };

  const getProductCode = useCallback((item: OrderItem): string => {
    console.log('[AdminOrderTable DEBUG] getProductCode - item:', JSON.parse(JSON.stringify(item)));
    if (item.code) {
      return item.code;
    }
    if (item.mattress_code) { // Fallback to mattress_code if item.code is not present
      return item.mattress_code;
    }
    // The old logic relying on initialProductCodes and item.product_id can be a further fallback
    // but item.product_id is often not directly on the OrderItem from order_items table.
    // If item.product_id were available, this would be the next step:
    // if (item.product_id) {
    //   const product = initialProductCodes.find(p => p.product_id === item.product_id);
    //   if (product?.code) {
    //     return product.code;
    //   }
    // }
    return 'N/A';
  }, []); // initialProductCodes removed from dependencies as it's not directly used in this revised primary logic

  const initializeOrderEdit = useCallback((order: Order) => {
    setEditingItems({ [order.id]: JSON.parse(JSON.stringify(order.order_items || [])) });
    setAdminNotes({ [order.id]: order.admin_notes || '' });
    setModifiedItemKeys(new Set());
    setAddedItemKeys(new Set());
    setDeletedItemKeys(new Set());
  }, []);

  const handleOpenEditDialog = useCallback((order: Order) => {
    setCurrentOrder(order);
    initializeOrderEdit(order);
    setEditDialogOpen(true);
  }, [initializeOrderEdit]);

  const handleQuantityChange = useCallback((orderId: string, itemId: string, quantity: number) => {
    setEditingItems(prev => {
      const items = prev[orderId] || [];
      const updatedItems = items.map(item =>
        item.id === itemId ? { ...item, quantity: Math.max(0, quantity) } : item
      );
      if (!addedItemKeys.has(`${orderId}-${itemId}`)) {
        setModifiedItemKeys(prevKeys => new Set(prevKeys).add(`${orderId}-${itemId}`));
      }
      return { ...prev, [orderId]: updatedItems };
    });
  }, [addedItemKeys]);

  const handleDeleteItem = useCallback((orderId: string, itemId: string) => {
    if (addedItemKeys.has(`${orderId}-${itemId}`)) {
      setAddedItemKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${orderId}-${itemId}`);
        return newSet;
      });
      setEditingItems(prev => ({
        ...prev,
        [orderId]: (prev[orderId] || []).filter(item => item.id !== itemId)
      }));
      toast({ title: "Item Removed", description: "Newly added item removed from list." });
    } else {
      setDeletedItemKeys(prev => new Set(prev).add(`${orderId}-${itemId}`));
      toast({ title: "Item Marked for Deletion", description: "Item will be removed upon saving changes." });
    }
    if (modifiedItemKeys.has(`${orderId}-${itemId}`)){ 
      setModifiedItemKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${orderId}-${itemId}`);
        return newSet;
      });
    }
  }, [addedItemKeys, modifiedItemKeys, toast]);
  
  const handleDiscard = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
        initializeOrderEdit(order);
        toast({ title: "Changes Discarded", description: "Your pending changes have been discarded." });
    }
    setEditDialogOpen(false);
  };

  const handleDialogSaveChanges = async (orderId: string, currentItems: OrderItem[], notes: string) => {
    setIsSaving(true);
    try {
      const supabaseToken = await getToken({ template: 'supabase' });
      if (!supabaseToken) throw new Error("Authentication token not available.");
      
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Supabase client not available.");

      const itemsToUpdate = currentItems.filter(item => modifiedItemKeys.has(`${orderId}-${item.id}`));
      const itemsToAdd = currentItems.filter(item => addedItemKeys.has(`${orderId}-${item.id}`));
      const itemsToDelete = Array.from(deletedItemKeys)
        .filter(key => key.startsWith(`${orderId}-`))
        .map(key => key.substring(orderId.length + 1));

      const { error: invokeError } = await supabase.functions.invoke('admin-update-order', {
        headers: {
          Authorization: `Bearer ${supabaseToken}`,
        },
        body: {
          orderId,
          itemsToUpdate,
          itemsToAdd,
          itemsToDelete,
          notes,
        }
      });

      if (invokeError) throw invokeError;

      toast({ title: "Order Updated", description: "Changes saved successfully!", variant: "success" });
      await reloadOrders();
      setEditDialogOpen(false);

    } catch (err: any) {
      console.error('Save operation failed:', err);
      toast({ title: "Error Saving Changes", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const columns = useMemo(() => getColumnsDef(
    handleStatusUpdate,
    handleOpenEditDialog,
    formatCurrency,
    formatDate
  ), [handleOpenEditDialog]);

  const table = useReactTable({
    data: orders,
    columns,
    state: { expanded, globalFilter },
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    getRowCanExpand: () => true,
  });

  return (
    <div className="w-full">
      <div className="flex items-center py-4">
        <Input
          placeholder="Search orders..."
          value={globalFilter ?? ""}
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
                  <TableRow data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {row.getIsExpanded() && (
                    <TableRow>
                      <TableCell colSpan={columns.length}>
                        <OrderItemsSubTable
                          items={row.original.order_items || []}
                          getProductCode={getProductCode}
                          orderStatus={row.original.status}
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
        <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          Next
        </Button>
      </div>

      {currentOrder && (
        <OrderEditDialog
          open={editDialogOpen}
          onOpenChange={(isOpen) => {
            if (!isOpen && !isSaving) setCurrentOrder(null);
            setEditDialogOpen(isOpen);
          }}
          currentOrder={currentOrder}
          orderItems={editingItems[currentOrder.id] || []}
          adminNotes={adminNotes[currentOrder.id] || ""}
          onAdminNotesChange={(notes) => setAdminNotes(prev => ({ ...prev, [currentOrder.id]: notes }))}
          onQuantityChange={(itemId, quantity) => handleQuantityChange(currentOrder.id, itemId, quantity)}
          onDeleteItem={(itemId) => handleDeleteItem(currentOrder.id, itemId)}
          onSave={() => handleDialogSaveChanges(currentOrder.id, editingItems[currentOrder.id], adminNotes[currentOrder.id])}
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