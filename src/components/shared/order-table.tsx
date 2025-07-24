import React from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { OrderStatusBadge } from "@/lib/order-status"
import { Button } from "@/components/ui/button"
import { AlertCircle, Check, X } from "lucide-react"
import type { Order } from "@/types/order"
import { useState } from "react"
import { getSupabaseClient } from '@/lib/supabase';
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { fetchProductCodes } from "@/lib/product-utils"
import { OrderItemsSubTable } from "@/components/admin/order-items-sub-table"

interface OrderTableProps {
  orders: Order[]
  onOrderUpdated?: () => void
  showActions?: boolean
}

interface OrderHistory {
  id: string
  order_id: string
  created_at: string
  order_items: any[]
  action_type: string
  user_id: string
  details: string
  original_qty: number
  updated_qty: number
  original_value: number
  updated_value: number
  admin_notes?: string
  changes_summary?: string
  deleted_items?: any[]
}

export function OrderTable({
  orders,
  onOrderUpdated,
  showActions = false,
}: OrderTableProps) {
  const supabase = getSupabaseClient(); // Initialize Supabase client
  const [expandedOrderId, setExpandedOrderId] = React.useState<string | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [orderHistories, setOrderHistories] = useState<Record<string, OrderHistory | null>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [productCodes, setProductCodes] = useState<Record<string, {code: string, description: string, category: string}>>({});

  const getProductCode = React.useCallback((item: any) => {
    // First try using the fetched product codes
    if (item.stock_item_id && productCodes[item.stock_item_id]) {
      return productCodes[item.stock_item_id].code;
    }
    
    // Then try using the "code" field directly
    if (item.code) {
      return item.code;
    }
    
    // Only as a fallback, try category-specific fields like mattress_code
    if (item.category === 'mattress' && item.mattress_code) {
      return item.mattress_code;
    }
    
    // Extract from product name as a last resort
    if (item.product_name) {
      // Base products have a specific format
      if (item.product_name.startsWith('Base:')) {
        const baseMatch = item.product_name.match(/^Base:\s+([A-Z0-9]+-[A-Z0-9]+)/);
        if (baseMatch) {
          return baseMatch[1];
        }
      }
      
      // Try to match standard product code format at start of name
      const codeRegex = /^([A-Z0-9]+-[A-Z0-9]+(?:\s+XL)?)\s+-\s+/;
      const match = item.product_name.match(codeRegex);
      if (match) {
        return match[1];
      }
    }
    
    return 'Unknown';
  }, [productCodes]);

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return "R 0";
    }
    return `R ${amount.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };


  const loadOrderHistory = async (orderId: string) => {
    try {
      setLoading(prev => ({ ...prev, [orderId]: true }));
      setErrors(prev => ({ ...prev, [orderId]: null }));

      // Get the most recent order history record for changes summary and notes
      const { data: latestHistory, error: latestError } = await supabase
        .from('order_history')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (latestError) throw latestError;

      // Get all order history records to find deleted items
      const { data: allHistory, error: allHistoryError } = await supabase
        .from('order_history')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (allHistoryError) throw allHistoryError;

      // Extract deleted items from all history records
      const deletedItems = allHistory
        .filter(h => h.action_type === 'deleted' && h.order_items && h.order_items.length > 0)
        .flatMap(h => h.order_items.map((item: any) => ({
          ...item,
          order_id: orderId,
          is_deleted: true,
          action_type: 'deleted'
        })));

      // Combine latest history with deleted items
      const enhancedHistory = {
        ...latestHistory,
        deleted_items: deletedItems
      };

      setOrderHistories(prev => ({ ...prev, [orderId]: enhancedHistory }));
    } catch (err: any) {
      setErrors(prev => ({ ...prev, [orderId]: 'Failed to load order history: ' + err.message }));
    } finally {
      setLoading(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const handleAccept = async (orderId: string) => {
    try {
      setProcessing(prev => ({ ...prev, [orderId]: true }));
      setErrors(prev => ({ ...prev, [orderId]: null }));

      // Update order status to approved instead of completed
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'approved' })
        .eq('id', orderId);

      if (updateError) throw updateError;

      // Update order history to record acceptance
      const { error: historyError } = await supabase
        .from('order_history')
        .update({ 
          action_type: 'changes_accepted',
          details: 'Customer accepted order changes'
        })
        .eq('order_id', orderId);

      if (historyError) throw historyError;

      onOrderUpdated?.();
      setExpandedOrderId(null);
    } catch (err: any) {
      setErrors(prev => ({ ...prev, [orderId]: 'Failed to accept changes: ' + err.message }));
    } finally {
      setProcessing(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const handleReject = async (orderId: string) => {
    try {
      setProcessing(prev => ({ ...prev, [orderId]: true }));
      setErrors(prev => ({ ...prev, [orderId]: null }));

      const orderHistory = orderHistories[orderId];
      if (!orderHistory) throw new Error('No order history found');

      // Restore original order details
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          status: 'pending',
          quantity: orderHistory.original_qty,
          total: orderHistory.original_value
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      // Restore original order items
      const { error: itemsError } = await supabase
        .from('order_items')
        .upsert(orderHistory.order_items);

      if (itemsError) throw itemsError;

      // Update order history to record rejection
      const { error: historyError } = await supabase
        .from('order_history')
        .update({ 
          action_type: 'changes_rejected',
          details: 'Customer rejected order changes'
        })
        .eq('order_id', orderId);

      if (historyError) throw historyError;

      onOrderUpdated?.();
      setExpandedOrderId(null);
    } catch (err: any) {
      setErrors(prev => ({ ...prev, [orderId]: 'Failed to reject changes: ' + err.message }));
    } finally {
      setProcessing(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const columns: ColumnDef<Order>[] = [
    {
      accessorKey: "order_number",
      header: "Order",
    },
    {
      accessorKey: "created_at",
      header: "Date",
      cell: ({ row }) => formatDate(row.getValue("created_at")),
    },
    {
      accessorKey: "store_name",
      header: "Store",
      cell: ({ row }) => row.getValue("store_name") || "N/A",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <div className="flex items-center">
          <OrderStatusBadge status={row.getValue("status")} />
          {row.getValue("status") === "review" && (
            <AlertCircle className="ml-2 h-4 w-4 text-orange-500" />
          )}
        </div>
      ),
    },
    {
      accessorKey: "quantity",
      header: "Qty",
      cell: ({ row }) => {
        const quantity = row.getValue("quantity") as number;
        return quantity?.toLocaleString() || "0"
      },
    },
    {
      accessorKey: "total",
      header: "Value",
      cell: ({ row }) => {
        const value = row.getValue("total") as number;
        return value ? formatCurrency(value) : "R 0"
      },
    },
  ];

  const table = useReactTable({
    data: orders,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const toggleOrderItems = (orderId: string, order: Order) => {
    // If the order is in review status and we're expanding it, load the history
    if (order.status === 'review' && expandedOrderId !== orderId) {
      loadOrderHistory(orderId);
    }
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  };

  // Load product codes for expanded order items
  React.useEffect(() => {
    if (expandedOrderId) {
      const expandedOrder = orders.find(order => order.id === expandedOrderId);
      const items = expandedOrder?.items || expandedOrder?.order_items;
      if (items && items.length > 0) {
        // Get all stock_item_ids from the expanded order
        const stockItemIds = items
          .map(item => item.stock_item_id)
          .filter(Boolean);
        
        if (stockItemIds.length > 0) {
          // Load product codes using our utility function
          const loadProductCodes = async () => {
            try {
              const codes = await fetchProductCodes(stockItemIds);
              setProductCodes(prev => ({
                ...prev,
                ...codes
              }));
            } catch (err) {
              console.error('Error loading product codes:', err);
            }
          };
          
          loadProductCodes();
        }

      }
    }
  }, [expandedOrderId, orders]);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {table.getHeaderGroups()[0].headers.map((header) => (
              <TableHead key={header.id}>
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <React.Fragment key={row.id}>
                <TableRow
                  data-state={row.getIsSelected() && "selected"}
                  className={`cursor-pointer hover:bg-muted/50 ${row.original.status === 'review' ? 'bg-orange-50 hover:bg-orange-100/70' : ''}`}
                  onClick={() => toggleOrderItems(row.original.id, row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
                {/* Expandable Section */}
                {expandedOrderId === row.original.id && (
                  <TableRow 
                    className={`${row.original.status === 'review' ? 'bg-orange-50/50' : 'bg-muted/50'}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <TableCell colSpan={columns.length} className="p-0">
                      <div className="p-6">
                        {/* Regular Line Items for Orders (hide for review status when showActions is true) */}
                        {!(row.original.status === 'review' && showActions) && (
                          <OrderItemsSubTable
                            items={row.original.items || row.original.order_items || []}
                            getProductCode={getProductCode}
                            orderStatus={row.original.status}
                            orderId={row.original.id}
                          />
                        )}

                        {/* Review Section for Review Status Orders */}
                        {row.original.status === 'review' && showActions && (
                          <div className={`${!(row.original.status === 'review' && showActions) ? "mt-8" : ""} space-y-6`}>
                            {!(row.original.status === 'review' && showActions) && <Separator />}
                            <div>
                              <h2 className="text-lg font-semibold">Review Order Changes</h2>
                              <p className="text-sm text-muted-foreground">
                                Please review the changes made to your order
                              </p>
                            </div>

                            {errors[row.original.id] && (
                              <Alert variant="destructive">
                                <AlertDescription>{errors[row.original.id]}</AlertDescription>
                              </Alert>
                            )}

                            {loading[row.original.id] ? (
                              <div className="text-center py-4">Loading order history...</div>
                            ) : !orderHistories[row.original.id] ? (
                              <div className="text-center py-4">No order history found</div>
                            ) : (
                              <>
                                {orderHistories[row.original.id]?.admin_notes && (
                                  <div className="space-y-2">
                                    <h3 className="text-sm font-medium">Admin Notes</h3>
                                    <p className="text-sm text-muted-foreground rounded-md border p-3">
                                      {orderHistories[row.original.id]?.admin_notes}
                                    </p>
                                  </div>
                                )}

                                {orderHistories[row.original.id]?.changes_summary && (
                                  <div className="space-y-2">
                                    <h3 className="text-sm font-medium">Changes Made</h3>
                                    <p className="text-sm text-muted-foreground rounded-md border p-3">
                                      {orderHistories[row.original.id]?.changes_summary}
                                    </p>
                                  </div>
                                )}

                                <div className="space-y-4 mt-4">
                                  <Separator />
                                  
                                  <div>
                                    <h3 className="text-sm font-medium mb-3">Order Changes</h3>
                                    <OrderItemsSubTable
                                      items={row.original.items || row.original.order_items || []}
                                      getProductCode={getProductCode}
                                      orderStatus={row.original.status}
                                      orderId={row.original.id}
                                    />
                                  </div>
                                  
                                  <div className="flex justify-end gap-4 mt-6">
                                    <Button
                                      variant="outline"
                                      onClick={() => handleReject(row.original.id)}
                                      disabled={processing[row.original.id]}
                                    >
                                      <X className="h-4 w-4 mr-2" />
                                      Reject Changes
                                    </Button>
                                    <Button
                                      variant="default"
                                      onClick={() => handleAccept(row.original.id)}
                                      disabled={processing[row.original.id]}
                                    >
                                      <Check className="h-4 w-4 mr-2" />
                                      Approve Changes
                                    </Button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
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
  )
} 