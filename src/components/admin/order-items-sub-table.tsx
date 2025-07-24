import React, { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrderItem as BaseOrderItem } from '@/types/order';
import { formatCurrency } from '@/lib/utils';
import { supabaseAdmin } from '@/lib/supabase';

interface OrderItemsSubTableProps {
  items: BaseOrderItem[];
  getProductCode: (item: BaseOrderItem) => string;
  orderStatus: string;
  orderId: string; 
}

interface OrderHistoryItem {
  id: string;
  order_id: string;
  order_line_id: string;
  action_type: 'added' | 'amended' | 'deleted' | 'no-change';
  original_qty: number;
  updated_qty: number;
  original_value: number;
  updated_value: number;
  order_items?: {
    id: string;
    product_name: string;
    price: number;
    quantity: number;
    stock_item_id: string;
    code?: string;
    total?: number;
  };
  created_at: string;
}

interface EnhancedOrderItem extends BaseOrderItem {
  is_deleted?: boolean;
  action_type?: 'added' | 'amended' | 'deleted' | 'no-change';
  description?: string;
}

export const OrderItemsSubTable: React.FC<OrderItemsSubTableProps> = ({ items, getProductCode, orderId }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [allItems, setAllItems] = useState<EnhancedOrderItem[]>([]);

  // Function to fetch product descriptions
  const fetchProductDescriptions = async (items: EnhancedOrderItem[]): Promise<EnhancedOrderItem[]> => {
    if (!supabaseAdmin) {
      return items;
    }

    const itemsWithDescriptions = await Promise.all(
      items.map(async (item) => {
        try {
          let description = '';
          
          // For deleted items, try to get description from stored data first
          if (item.is_deleted && item.product_name) {
            // Use the product_name as description for deleted items as it often contains the full description
            description = item.product_name;
          } else if (item.stock_item_id) {
            // If we have stock_item_id, try to fetch description
            if (item.product_type) {
              // Use product_type if available
              switch (item.product_type) {
                case 'mattress':
                  const { data: mattressData } = await supabaseAdmin
                    .from('mattress')
                    .select('description')
                    .eq('id', item.stock_item_id)
                    .single();
                  description = mattressData?.description || '';
                  break;
                  
                case 'base':
                  const { data: baseData } = await supabaseAdmin
                    .from('base')
                    .select('description')
                    .eq('id', item.stock_item_id)
                    .single();
                  description = baseData?.description || '';
                  break;
                  
                case 'accessories':
                  const { data: accessoryData } = await supabaseAdmin
                    .from('accessories')
                    .select('description')
                    .eq('id', item.stock_item_id)
                    .single();
                  description = accessoryData?.description || '';
                  break;
                  
                case 'furniture':
                  const { data: furnitureData } = await supabaseAdmin
                    .from('furniture')
                    .select('description')
                    .eq('id', item.stock_item_id)
                    .single();
                  description = furnitureData?.description || '';
                  break;
                  
                case 'foam':
                  const { data: foamData } = await supabaseAdmin
                    .from('foam')
                    .select('description')
                    .eq('id', item.stock_item_id)
                    .single();
                  description = foamData?.description || '';
                  break;
                  
                default:
                  description = item.product_name || '';
              }
            } else {
              // No product_type available (common for deleted items), so try all tables
              const productTables = ['mattress', 'base', 'accessories', 'furniture', 'foam'];
              
              for (const table of productTables) {
                try {
                  const { data } = await supabaseAdmin
                    .from(table)
                    .select('description')
                    .eq('id', item.stock_item_id)
                    .single();
                  
                  if (data?.description) {
                    description = data.description;
                    break; // Found a match, stop searching
                  }
                } catch (error) {
                  // Item not found in this table, continue to next table
                  continue;
                }
              }
              
              // If no description found in any table, use product_name as fallback
              if (!description) {
                description = item.product_name || '';
              }
            }
          } else {
            // Fallback to product_name if no stock_item_id
            description = item.product_name || '';
          }
          
          return {
            ...item,
            description
          };
        } catch (error) {
          console.error(`Error fetching description for item ${item.id}:`, error);
          return {
            ...item,
            description: item.product_name || ''
          };
        }
      })
    );
    
    return itemsWithDescriptions;
  };

  useEffect(() => {
    const fetchOrderHistory = async () => {
      if (!orderId) return;
      
      setIsLoading(true);
      
      if (!supabaseAdmin) {
        console.error('supabaseAdmin client is not available');
        setIsLoading(false);
        return;
      }
      
      try {
        // Fetch order history
        const { data: historyData, error: historyError } = await supabaseAdmin
          .from('order_history')
          .select('*')
          .eq('order_id', orderId);
        
        if (historyError) {
          console.error('Error fetching order history:', historyError);
          const itemsWithDescriptions = await fetchProductDescriptions(items as EnhancedOrderItem[]);
          setAllItems(itemsWithDescriptions);
          setIsLoading(false);
          return;
        }
        
        if (!historyData || historyData.length === 0) {
          // No history data, just show current items as-is
          console.log('No history data found for order:', orderId);
          const itemsWithDescriptions = await fetchProductDescriptions(items as EnhancedOrderItem[]);
          setAllItems(itemsWithDescriptions);
          setIsLoading(false);
          return;
        }

        // Sort by created_at date (newest first) to get the latest status
        const historyItems = (historyData as OrderHistoryItem[]).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        console.log('Order history data received:', historyItems);
        
        // Create a map to store the latest action type for each item ID
        const actionTypeMap = new Map<string, string>();
        
        // Process history to identify action types
        historyItems.forEach(entry => {
          if (entry.order_line_id) {
            // Only set if this item doesn't already have a more recent entry
            if (!actionTypeMap.has(entry.order_line_id)) {
              actionTypeMap.set(entry.order_line_id, entry.action_type);
            }
          }
          
          // Check for items in the order_items JSONB array
          if (entry.order_items && Array.isArray(entry.order_items)) {
            entry.order_items.forEach(item => {
              if (item.id && !actionTypeMap.has(item.id)) {
                actionTypeMap.set(item.id, entry.action_type);
              }
            });
          }
        });
        
        console.log('Action type map:', Object.fromEntries(actionTypeMap));
        
        // Extract deleted items from history
        const deletedItems = historyItems
          .filter(h => h.action_type === 'deleted' && h.order_items && h.order_items.length > 0)
          .flatMap(h => h.order_items.map(item => ({
            ...item,
            order_id: orderId,
            is_deleted: true,
            action_type: 'deleted' as const
          } as EnhancedOrderItem)));
        
        // Create a map of existing item IDs to avoid duplicates
        const existingItemIds = new Set(items.map(item => item.id));
        
        // Filter out deleted items that are already in the current items list
        const uniqueDeletedItems = deletedItems.filter(item => !existingItemIds.has(item.id));
        
        // Enhance current items with action types
        const enhancedItems = items.map(item => {
          const actionType = actionTypeMap.get(item.id) as 'added' | 'amended' | 'deleted' | 'no-change' | undefined;
          return {
            ...item,
            action_type: actionType || 'no-change'
          } as EnhancedOrderItem;
        });
        
        console.log('Enhanced items:', enhancedItems);
        console.log('Unique deleted items:', uniqueDeletedItems);
        
        // Combine current items with deleted items from history and fetch descriptions
        const combinedItems = [...enhancedItems, ...uniqueDeletedItems];
        const itemsWithDescriptions = await fetchProductDescriptions(combinedItems);
        setAllItems(itemsWithDescriptions);
      } catch (err) {
        console.error('Unexpected error processing order history:', err);
        const itemsWithDescriptions = await fetchProductDescriptions(items as EnhancedOrderItem[]);
        setAllItems(itemsWithDescriptions);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchOrderHistory();
  }, [orderId, items]);

  if (isLoading) {
    return <div className="p-4 text-center text-sm text-gray-500">Loading order history...</div>;
  }

  if (allItems.length === 0) {
    return <div className="p-4 text-center text-sm text-gray-500">No items in this order.</div>;
  }

  // Calculate totals (excluding deleted items)
  const activeItems = allItems.filter(item => !item.is_deleted && item.action_type !== 'deleted');
  
  const totalQuantity = activeItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalValue = activeItems.reduce((sum, item) => {
    const itemTotal = item.total || item.price * item.quantity;
    return sum + (itemTotal || 0);
  }, 0);

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Code</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allItems.map((item) => {
            const itemStyle = item.is_deleted || item.action_type === 'deleted'
              ? 'line-through text-gray-500 bg-red-50'
              : item.action_type === 'amended'
                ? 'bg-amber-50'
                : item.action_type === 'added'
                  ? 'bg-green-50'
                  : '';
            
            return (
              <TableRow key={item.id} className={itemStyle}>
                <TableCell>
                  {item.description || item.product_name || 'No description'}
                </TableCell>
                <TableCell>
                  {getProductCode(item)}
                </TableCell>
                <TableCell className="text-right">
                  {item.quantity}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(item.price)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(item.total || (item.price * item.quantity))}
                </TableCell>
                <TableCell className="text-right">
                  {item.action_type && (
                    <span className={`px-2 py-1 rounded text-xs ${item.action_type === 'deleted' ? 'bg-red-100 text-red-800' : 
                      item.action_type === 'amended' ? 'bg-amber-100 text-amber-800' : 
                      item.action_type === 'added' ? 'bg-green-100 text-green-800' : ''}`}>
                      {item.action_type.charAt(0).toUpperCase() + item.action_type.slice(1)}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          
          {/* Summary row showing the active totals */}
          <TableRow className="font-medium bg-gray-100 dark:bg-gray-700">
            <TableCell colSpan={2}>Order Total (excluding deleted items)</TableCell>
            <TableCell className="text-right">{totalQuantity}</TableCell>
            <TableCell></TableCell>
            <TableCell className="text-right">{formatCurrency(totalValue)}</TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};
