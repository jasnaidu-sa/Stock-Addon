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
import { OrderReview } from "@/components/order/order-review"
import type { Order } from "@/types/order"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { fetchProductCodes, getProductCode } from "@/lib/product-utils"

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
}

export function OrderTable({
  orders,
  onOrderUpdated,
  showActions = false,
}: OrderTableProps) {
  const [expandedOrderId, setExpandedOrderId] = React.useState<string | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [orderHistories, setOrderHistories] = useState<Record<string, OrderHistory | null>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [productCodes, setProductCodes] = useState<Record<string, string>>({});

  const formatCurrency = (amount: number) => {
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

      const { data, error } = await supabase
        .from('order_history')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;

      setOrderHistories(prev => ({ ...prev, [orderId]: data }));
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
      if (expandedOrder?.items && expandedOrder.items.length > 0) {
        // Get all stock_item_ids from the expanded order
        const stockItemIds = expandedOrder.items
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
                          <>
                            <h4 className="text-sm font-medium mb-4">Line Items</h4>
                            {row.original.items && row.original.items.length > 0 ? (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Product</TableHead>
                                    <TableHead className="text-right">Price</TableHead>
                                    <TableHead className="text-right">Qty</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {row.original.items.map((item: any, index: number) => {
                                    // Use our utility function to get the product code
                                    const productCode = getProductCode(item, productCodes);
                                    
                                    // Extract the product description without the code prefix
                                    let productDesc = item.product_name || '';
                                    const codeRegex = /^([A-Z0-9]+-[A-Z0-9]+(?:\s+XL)?)\s+-\s+/;
                                    const codeMatch = productDesc.match(codeRegex);
                                    if (codeMatch) {
                                      productDesc = productDesc.replace(codeRegex, '');
                                    }
                                      
                                    return (
                                      <TableRow key={item.id || index}>
                                        <TableCell className="py-3 font-medium">{productCode}</TableCell>
                                        <TableCell className="py-3">{productDesc}</TableCell>
                                        <TableCell className="text-right py-3">{formatCurrency(item.price)}</TableCell>
                                        <TableCell className="text-right py-3">{item.quantity}</TableCell>
                                        <TableCell className="text-right py-3">{formatCurrency(item.total)}</TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            ) : (
                              <div className="text-center py-4 text-muted-foreground">
                                No line items found for this order
                              </div>
                            )}
                          </>
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
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Status</TableHead>
                                          <TableHead>Code</TableHead>
                                          <TableHead>Product</TableHead>
                                          <TableHead className="text-right">Price</TableHead>
                                          <TableHead className="text-right">Qty</TableHead>
                                          <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {/* Compare and display items */}
                                        {(() => {
                                          const originalItems = orderHistories[row.original.id]?.order_items || [];
                                          const updatedItems = row.original.items || [];
                                          
                                          // Create maps for easier comparison
                                          const originalMap = new Map(
                                            originalItems.map((item: any) => [item.product_name, item])
                                          );
                                          const updatedMap = new Map(
                                            updatedItems.map((item: any) => [item.product_name, item])
                                          );
                                          
                                          // All product names from both sets
                                          const allProductNames = new Set([
                                            ...originalItems.map((item: any) => item.product_name),
                                            ...updatedItems.map((item: any) => item.product_name)
                                          ]);
                                          
                                          // Generate rows for the diff table
                                          return Array.from(allProductNames).map(productName => {
                                            const originalItem = originalMap.get(productName);
                                            const updatedItem = updatedMap.get(productName);
                                            
                                            // Extract product code
                                            const getProductCode = (item: any) => {
                                              if (!item) return '';
                                              
                                              // Try to extract product code using regex pattern
                                              const codeRegex = /^([A-Z0-9]+-[A-Z0-9]+(?:\s+XL)?)\s+-\s+/;
                                              const codeMatch = item.product_name ? item.product_name.match(codeRegex) : null;
                                              
                                              if (codeMatch) {
                                                return codeMatch[1];
                                              } else if (item.product_name && item.product_name.startsWith('Base: ')) {
                                                const baseMatch = item.product_name.match(/^Base:\s+([A-Z0-9]+-[A-Z0-9]+)/);
                                                if (baseMatch) {
                                                  return baseMatch[1];
                                                }
                                              } else if (item.product_name && (
                                                item.product_name.includes('Comfo Sleep') || 
                                                item.product_name.includes('Orthopaedic') || 
                                                item.product_name.includes('Orthpdaedic') || 
                                                item.product_name.toLowerCase().includes('mattress'))) {
                                                // This is likely a mattress product
                                                const mattressCodeMatch = item.product_name.match(/([A-Z]{2,3}\d-\d{3}M)/);
                                                if (mattressCodeMatch) {
                                                  return mattressCodeMatch[1];
                                                } else {
                                                  return `M-${item.stock_item_id ? item.stock_item_id.substring(0, 6) : 'ID'}`;
                                                }
                                              } else if (item.product_name && (
                                                item.product_name.toLowerCase().includes('storage base') ||
                                                item.product_name.toLowerCase().includes('base ') ||
                                                item.product_name.toLowerCase().includes('furniture'))) {
                                                // This is likely furniture
                                                const furnitureCodeMatch = item.product_name.match(/([A-Z]{2,4}-\d{3}(?:\s+XL)?)/);
                                                if (furnitureCodeMatch) {
                                                  return furnitureCodeMatch[1];
                                                } else {
                                                  return `F-${item.stock_item_id ? item.stock_item_id.substring(0, 6) : 'ID'}`;
                                                }
                                              }
                                              
                                              return item.stock_item_id ? item.stock_item_id.substring(0, 8) : 'N/A';
                                            };
                                            
                                            // Get product description without code
                                            const getProductDesc = (item: any) => {
                                              if (!item || !item.product_name) return '';
                                              
                                              const codeRegex = /^([A-Z0-9]+-[A-Z0-9]+(?:\s+XL)?)\s+-\s+/;
                                              const codeMatch = item.product_name.match(codeRegex);
                                              
                                              if (codeMatch) {
                                                return item.product_name.replace(codeRegex, '');
                                              }
                                              
                                              return item.product_name;
                                            };
                                            
                                            if (originalItem && updatedItem) {
                                              // Item exists in both - check if changed
                                              if (
                                                originalItem.price !== updatedItem.price ||
                                                originalItem.quantity !== updatedItem.quantity ||
                                                originalItem.total !== updatedItem.total
                                              ) {
                                                // Item was modified
                                                return (
                                                  <React.Fragment key={productName}>
                                                    {/* Removed version */}
                                                    <TableRow className="bg-red-50">
                                                      <TableCell>
                                                        <span className="inline-block bg-red-100 text-red-800 rounded-full px-2 py-1 text-xs font-semibold">
                                                          Removed
                                                        </span>
                                                      </TableCell>
                                                      <TableCell className="line-through text-red-700">{getProductCode(originalItem)}</TableCell>
                                                      <TableCell className="line-through text-red-700">{getProductDesc(originalItem)}</TableCell>
                                                      <TableCell className="text-right line-through text-red-700">{formatCurrency(originalItem.price)}</TableCell>
                                                      <TableCell className="text-right line-through text-red-700">{originalItem.quantity}</TableCell>
                                                      <TableCell className="text-right line-through text-red-700">{formatCurrency(originalItem.total)}</TableCell>
                                                    </TableRow>
                                                    {/* Added version */}
                                                    <TableRow className="bg-green-50">
                                                      <TableCell>
                                                        <span className="inline-block bg-green-100 text-green-800 rounded-full px-2 py-1 text-xs font-semibold">
                                                          Added
                                                        </span>
                                                      </TableCell>
                                                      <TableCell>{getProductCode(updatedItem)}</TableCell>
                                                      <TableCell>{getProductDesc(updatedItem)}</TableCell>
                                                      <TableCell className="text-right">{formatCurrency(updatedItem.price)}</TableCell>
                                                      <TableCell className="text-right">{updatedItem.quantity}</TableCell>
                                                      <TableCell className="text-right">{formatCurrency(updatedItem.total)}</TableCell>
                                                    </TableRow>
                                                  </React.Fragment>
                                                );
                                              } else {
                                                // Item unchanged
                                                return (
                                                  <TableRow key={productName}>
                                                    <TableCell>
                                                      <span className="inline-block bg-gray-100 text-gray-800 rounded-full px-2 py-1 text-xs font-semibold">
                                                        Unchanged
                                                      </span>
                                                    </TableCell>
                                                    <TableCell>{getProductCode(originalItem)}</TableCell>
                                                    <TableCell>{getProductDesc(originalItem)}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(originalItem.price)}</TableCell>
                                                    <TableCell className="text-right">{originalItem.quantity}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(originalItem.total)}</TableCell>
                                                  </TableRow>
                                                );
                                              }
                                            } else if (originalItem) {
                                              // Item was removed
                                              return (
                                                <TableRow key={productName} className="bg-red-50">
                                                  <TableCell>
                                                    <span className="inline-block bg-red-100 text-red-800 rounded-full px-2 py-1 text-xs font-semibold">
                                                      Removed
                                                    </span>
                                                  </TableCell>
                                                  <TableCell className="line-through text-red-700">{getProductCode(originalItem)}</TableCell>
                                                  <TableCell className="line-through text-red-700">{getProductDesc(originalItem)}</TableCell>
                                                  <TableCell className="text-right line-through text-red-700">{formatCurrency(originalItem.price)}</TableCell>
                                                  <TableCell className="text-right line-through text-red-700">{originalItem.quantity}</TableCell>
                                                  <TableCell className="text-right line-through text-red-700">{formatCurrency(originalItem.total)}</TableCell>
                                                </TableRow>
                                              );
                                            } else {
                                              // Item was added
                                              return (
                                                <TableRow key={productName} className="bg-green-50">
                                                  <TableCell>
                                                    <span className="inline-block bg-green-100 text-green-800 rounded-full px-2 py-1 text-xs font-semibold">
                                                      Added
                                                    </span>
                                                  </TableCell>
                                                  <TableCell>{getProductCode(updatedItem)}</TableCell>
                                                  <TableCell>{getProductDesc(updatedItem)}</TableCell>
                                                  <TableCell className="text-right">{formatCurrency(updatedItem.price)}</TableCell>
                                                  <TableCell className="text-right">{updatedItem.quantity}</TableCell>
                                                  <TableCell className="text-right">{formatCurrency(updatedItem.total)}</TableCell>
                                                </TableRow>
                                              );
                                            }
                                          });
                                        })()}
                                        
                                        {/* Total row */}
                                        <TableRow className="border-t-2">
                                          <TableCell colSpan={3} />
                                          <TableCell className="text-right font-medium">Original Total:</TableCell>
                                          <TableCell className="text-right font-medium">
                                            {formatCurrency(orderHistories[row.original.id]?.original_value || 0)}
                                          </TableCell>
                                        </TableRow>
                                        <TableRow>
                                          <TableCell colSpan={3} />
                                          <TableCell className="text-right font-medium">Updated Total:</TableCell>
                                          <TableCell className="text-right font-medium">
                                            {formatCurrency((row.original as any).total || 0)}
                                          </TableCell>
                                        </TableRow>
                                      </TableBody>
                                    </Table>
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