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
import { OrderStatusUpdate } from "./order-status-update"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import type { Order, OrderItem } from "@/types/order"
import { fetchProductCodes, getProductCode } from "@/lib/product-utils"

interface AdminOrderTableProps {
  orders: Order[];
  reloadOrders: () => Promise<void>;
  loading: boolean;
}

interface ProductCategory {
  id: string
  name: string
  products: Product[]
}

interface Product {
  id: string
  name: string
  price: number
  category_id: string
}

export function AdminOrderTable({
  orders,
  reloadOrders,
  loading,
}: AdminOrderTableProps) {
  const [expandedOrderId, setExpandedOrderId] = React.useState<string | null>(null);
  const [editingItems, setEditingItems] = React.useState<{ [key: string]: OrderItem[] }>({});
  const [adminNotes, setAdminNotes] = React.useState<{ [key: string]: string }>({});
  const [categories, setCategories] = React.useState<ProductCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [productCodes, setProductCodes] = React.useState<Record<string, {code: string, category: string}>>({});

  // Add more detailed logging about the orders received
  console.log('AdminOrderTable - orders received:', orders);
  if (orders.length > 0) {
    console.log('AdminOrderTable - first order full data:', orders[0]);
    console.log('AdminOrderTable - first order properties:', Object.keys(orders[0]));
  }

  const formatCurrency = (amount: number) => {
    return `R ${amount.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Load categories and products when component mounts
  React.useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      // Define our category tables with their specific column mappings
      const categoryTables = [
        { 
          id: 'mattress', 
          name: 'Mattresses', 
          table: 'mattress',
          nameField: 'description',
          priceField: 'set_price',
          codeField: 'mattress_code'
        },
        { 
          id: 'furniture', 
          name: 'Furniture', 
          table: 'furniture',
          nameField: 'description',
          priceField: 'price',
          codeField: 'code'
        },
        { 
          id: 'headboards', 
          name: 'Headboards', 
          table: 'headboards',
          nameField: 'description',
          priceField: 'price',
          codeField: 'code'
        },
        { 
          id: 'accessories', 
          name: 'Accessories', 
          table: 'accessories',
          nameField: 'description',
          priceField: 'price',
          codeField: 'code'
        },
        { 
          id: 'foam', 
          name: 'Foam', 
          table: 'foam',
          nameField: 'description',
          priceField: 'price',
          codeField: 'code'
        }
      ];

      // Fetch products from each category table
      const categoriesWithProducts = await Promise.all(
        categoryTables.map(async (category) => {
          const { data, error } = await supabase
            .from(category.table)
            .select(`
              id,
              ${category.nameField},
              ${category.priceField},
              ${category.codeField}
            `);

          if (error) {
            console.error(`Error loading ${category.name}:`, error);
            return {
              id: category.id,
              name: category.name,
              products: []
            };
          }

          return {
            id: category.id,
            name: category.name,
            products: data.map((product: any) => ({
              id: product.id,
              name: `${product[category.codeField]} - ${product[category.nameField]}`,
              price: product[category.priceField],
              category_id: category.id
            }))
          };
        })
      );

      const validCategories = categoriesWithProducts.filter(cat => cat.products.length > 0);
      setCategories(validCategories);
      
      // Select first category with products by default
      if (validCategories.length > 0) {
        setSelectedCategory(validCategories[0].id);
      }
    } catch (err: any) {
      console.error('Error loading categories:', err);
      toast({
        title: "Error",
        description: "Failed to load products: " + (err.message || 'Unknown error'),
        variant: "destructive",
      });
    }
  };

  const initializeOrderEdit = (order: Order) => {
    if (!editingItems[order.id]) {
      setEditingItems({
        ...editingItems,
        [order.id]: [...(order.items || [])]
      });
      setAdminNotes({
        ...adminNotes,
        [order.id]: ""
      });
    }
  };

  const handleQuantityChange = (orderId: string, itemId: string, newQuantity: number) => {
    setEditingItems(current => ({
      ...current,
      [orderId]: current[orderId].map(item => {
        if (item.id === itemId) {
          return { ...item, quantity: newQuantity, total: item.price * newQuantity };
        }
        return item;
      })
    }));
  };

  const handleDeleteItem = (orderId: string, itemId: string) => {
    setEditingItems(current => ({
      ...current,
      [orderId]: current[orderId].filter(item => item.id !== itemId)
    }));
  };

  const handleAddItem = (orderId: string, product: Product) => {
    const newItem: OrderItem = {
      id: `temp_${Date.now()}`, // Temporary ID, will be replaced on save
      product_id: product.id,
      product_name: product.name,
      price: product.price,
      quantity: 1,
      total: product.price,
      order_id: orderId,
      stock_item_id: product.id // Assuming product.id can be used as stock_item_id
    };

    setEditingItems(current => ({
      ...current,
      [orderId]: [...current[orderId], newItem]
    }));

    toast({
      title: "Item Added",
      description: `${product.name} has been added to the order`,
    });
  };

  const handleStartEditing = (order: Order) => {
    initializeOrderEdit(order);
  };

  const handleDiscard = (orderId: string) => {
    setEditingItems(current => {
      const { [orderId]: _, ...rest } = current;
      return rest;
    });
    setAdminNotes(current => {
      const { [orderId]: _, ...rest } = current;
      return rest;
    });
    toast({
      title: "Changes Discarded",
      description: "All changes have been discarded",
    });
  };

  const calculateTotals = (items: OrderItem[]) => {
    return items.reduce((acc, item) => ({
      quantity: acc.quantity + item.quantity,
      value: acc.value + item.total
    }), { quantity: 0, value: 0 });
  };

  const handleSave = async (order: Order) => {
    try {
      setIsSaving(true);
      const items = editingItems[order.id];
      const totals = calculateTotals(items);
      const changes: string[] = [];

      // Check authentication session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error("Authentication error. Please log in again.");
      }

      // Log auth data for debugging
      console.log('Auth user:', {
        id: sessionData.session.user.id,
        email: sessionData.session.user.email,
        role: sessionData.session.user.role,
        app_metadata: sessionData.session.user.app_metadata,
        user_metadata: sessionData.session.user.user_metadata
      });
      
      // Enable more detailed error logging
      console.log('Starting order update process...');

      // Compare quantities and log changes
      order.items?.forEach(originalItem => {
        const newItem = items.find(item => item.id === originalItem.id);
        if (!newItem) {
          changes.push(`Removed item: ${originalItem.product_name}`);
        } else if (originalItem.quantity !== newItem.quantity) {
          changes.push(`${newItem.product_name}: Quantity changed from ${originalItem.quantity} to ${newItem.quantity}`);
        }
      });

      // Check for new items
      items.forEach(newItem => {
        const originalItem = order.items?.find(item => item.id === newItem.id);
        if (!originalItem) {
          changes.push(`Added item: ${newItem.product_name} (Quantity: ${newItem.quantity})`);
        }
      });

      // Step 1: Update existing order items first
      for (const item of items) {
        if (!item.id.startsWith('temp_')) {
          try {
            console.log(`Updating existing item: ${item.product_name}`);
            // Update existing item
            const { error: itemError } = await supabase
              .from('order_items')
              .update({
                quantity: item.quantity,
                total: item.price * item.quantity
              })
              .eq('id', item.id);

            if (itemError) {
              console.error('Error updating item:', itemError);
              throw itemError;
            }
          } catch (err) {
            console.error('Failed to update item:', err);
            throw new Error('Failed to update existing items');
          }
        }
      }

      // Step 2: Insert new items using the standard Supabase client
      const newItems = items.filter(item => item.id.startsWith('temp_'));
      if (newItems.length > 0) {
        try {
          console.log(`Inserting ${newItems.length} new items`);
          
          // Convert new items to the format expected by the API
          const itemsToInsert = newItems.map(item => ({
            order_id: order.id,
            stock_item_id: item.stock_item_id,
            product_name: item.product_name,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity
          }));

          // Insert items one by one to better track errors
          for (const itemToInsert of itemsToInsert) {
            console.log('Inserting item:', itemToInsert);
            
            try {
              const { error } = await supabase
                .from('order_items')
                .insert(itemToInsert);
              
              if (error) {
                console.error('Error inserting item:', error);
                throw new Error(`Failed to add item: ${error.message}`);
              }
            } catch (itemError: any) {
              console.error('Error adding item:', itemError);
              throw new Error(`Failed to add item: ${itemError.message}`);
            }
          }
          
          console.log('New items added successfully');
        } catch (err) {
          console.error('Failed to insert new items:', err);
          throw new Error('Failed to add new items to order');
        }
      }

      // Step 3: Delete removed items
      const removedItemIds = order.items
        ?.filter(originalItem => !items.some(item => item.id === originalItem.id))
        .map(item => item.id) || [];

      if (removedItemIds.length > 0) {
        try {
          console.log(`Deleting ${removedItemIds.length} removed items`);
          const { error: deleteError } = await supabase
            .from('order_items')
            .delete()
            .in('id', removedItemIds);

          if (deleteError) {
            console.error('Error deleting items:', deleteError);
            throw deleteError;
          }
        } catch (err) {
          console.error('Failed to delete items:', err);
          throw new Error('Failed to remove items from order');
        }
      }

      // Step 4: Update the order totals last
      try {
        console.log('Updating order totals');
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            status: 'review',
            quantity: totals.quantity,
            value: totals.value
          })
          .eq('id', order.id);

        if (updateError) {
          console.error('Error updating order:', updateError);
          throw updateError;
        }
      } catch (err) {
        console.error('Failed to update order:', err);
        throw new Error('Failed to update order details');
      }

      // Step 5: Create order history record
      try {
        // Prepare order history data
        const historyRecord = {
          order_id: order.id,
          order_items: order.items,
          action_type: 'edit',
          user_id: sessionData.session.user.id,
          original_qty: order.quantity,
          updated_qty: totals.quantity,
          original_value: order.value,
          updated_value: totals.value,
          status: 'review',
          changes_summary: changes.join('\n'),
          admin_notes: adminNotes[order.id]
        };
        
        console.log('Attempting to insert order history:', historyRecord);
        
        // First try with regular insert
        const { data: historyResult, error: historyError } = await supabase
          .from('order_history')
          .insert(historyRecord)
          .select();

        if (historyError) {
          console.error('History error details:', historyError);
          // If the insert fails, show a warning but continue with the order update
          toast({
            title: "Warning",
            description: "Order updated but history tracking incomplete. Admin is reviewing changes.",
            variant: "destructive",
          });
        } else {
          console.log('History record created successfully:', historyResult);
        }
      } catch (err) {
        console.error('Failed to save history:', err);
        // Continue even if history fails
        toast({
          title: "Warning",
          description: "Order updated but history tracking encountered an issue. Admin is reviewing changes.",
          variant: "destructive",
        });
      }

      toast({
        title: "Order Updated",
        description: `Order ${order.order_number} has been updated successfully.`,
      });

      // Add a console log of the changes
      if (changes.length > 0) {
        console.log('Order changes:', changes.join('\n'));
      }

      // Clear editing state
      setEditingItems(current => {
        const { [order.id]: _, ...rest } = current;
        return rest;
      });
      setAdminNotes(current => {
        const { [order.id]: _, ...rest } = current;
        return rest;
      });

      reloadOrders();
    } catch (error: any) {
      console.error('Error updating order:', error);
      
      // General error handling
      toast({
        title: "Error",
        description: error.message || "Failed to update order",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
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
      accessorKey: "owner_name",
      header: "Customer",
      cell: ({ row }) => {
        const value = row.getValue("owner_name");
        return value || "N/A";
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const order = row.original;
        return (
          <OrderStatusUpdate
            orderId={order.id}
            currentStatus={order.status || 'pending'}
            onStatusUpdated={reloadOrders}
          />
        );
      },
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
      accessorKey: "value",
      header: "Value",
      cell: ({ row }) => {
        const value = row.getValue("value") as number;
        return value ? formatCurrency(value) : "R 0"
      },
    },
  ];

  const table = useReactTable({
    data: orders,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  // Load product codes for expanded order items
  React.useEffect(() => {
    if (expandedOrderId && editingItems[expandedOrderId]) {
      // Get all stock_item_ids from the expanded order
      const stockItemIds = editingItems[expandedOrderId]
        .map(item => item.stock_item_id)
        .filter(Boolean);
      
      console.log('Stock item IDs to fetch codes for:', stockItemIds);
      
      if (stockItemIds.length > 0) {
        // Load product codes using our utility function
        const loadProductCodes = async () => {
          try {
            const codes = await fetchProductCodes(stockItemIds);
            console.log('Product codes fetched:', codes);
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
  }, [expandedOrderId, editingItems]);

  const toggleOrderItems = (orderId: string, order: Order) => {
    if (expandedOrderId !== orderId) {
      initializeOrderEdit(order);
    }
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  };

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
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleOrderItems(row.original.id, row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
                {/* Expandable Line Items Section */}
                {expandedOrderId === row.original.id && (
                  <TableRow 
                    className="bg-muted/50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <TableCell colSpan={columns.length} className="p-0">
                      <div className="p-6 space-y-6">
                        <div className="flex justify-between items-center">
                          <h4 className="text-sm font-medium">Line Items</h4>
                          <Button 
                            size="sm"
                            onClick={() => handleStartEditing(row.original)}
                          >
                            Edit Order
                          </Button>
                        </div>

                        {expandedOrderId === row.original.id && (
                          <>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Code</TableHead>
                                  <TableHead>Product</TableHead>
                                  <TableHead className="text-right">Price</TableHead>
                                  <TableHead className="text-right w-[150px]">Qty</TableHead>
                                  <TableHead className="text-right">Total</TableHead>
                                  <TableHead className="w-[70px]"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {editingItems[row.original.id]?.map((item: OrderItem, index) => {
                                  // Use the same getProductCode function that works in the customer view
                                  const productCode = getProductCode(item, productCodes);
                                  
                                  // Extract the product description without the code prefix
                                  let productDesc = item.product_name || '';
                                  const codeRegex = /^([A-Z0-9]+-[A-Z0-9]+(?:\s+XL)?)\s+-\s+/;
                                  const codeMatch = productDesc.match(codeRegex);
                                  if (codeMatch) {
                                    productDesc = productDesc.replace(codeRegex, '');
                                  }
                                  
                                  return (
                                    <TableRow key={item.id}>
                                      <TableCell className="font-medium">{productCode}</TableCell>
                                      <TableCell>{productDesc}</TableCell>
                                      <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                                      <TableCell className="text-right">
                                        <Input
                                          type="number"
                                          min="0"
                                          value={item.quantity}
                                          onChange={(e) => handleQuantityChange(
                                            row.original.id,
                                            item.id,
                                            parseInt(e.target.value) || 0
                                          )}
                                          className="w-20 ml-auto"
                                        />
                                      </TableCell>
                                      <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                                      <TableCell>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleDeleteItem(row.original.id, item.id)}
                                        >
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                                <TableRow>
                                  <TableCell colSpan={3} />
                                  <TableCell className="text-right font-medium">Total:</TableCell>
                                  <TableCell className="text-right font-medium">
                                    {formatCurrency(calculateTotals(editingItems[row.original.id]).value)}
                                  </TableCell>
                                  <TableCell />
                                </TableRow>
                              </TableBody>
                            </Table>

                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium mb-2">
                                  Admin Notes
                                </label>
                                <Textarea
                                  value={adminNotes[row.original.id] || ""}
                                  onChange={(e) => setAdminNotes(current => ({
                                    ...current,
                                    [row.original.id]: e.target.value
                                  }))}
                                  placeholder="Enter notes about the changes..."
                                  className="min-h-[100px]"
                                />
                              </div>

                              <div className="flex justify-end gap-4">
                                <Button
                                  variant="outline"
                                  onClick={() => handleDiscard(row.original.id)}
                                  disabled={loading}
                                >
                                  Discard Changes
                                </Button>
                                <Button
                                  onClick={() => handleSave(row.original)}
                                  disabled={isSaving || loading}
                                >
                                  {isSaving ? "Saving..." : "Save Changes"}
                                </Button>
                              </div>
                            </div>
                          </>
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