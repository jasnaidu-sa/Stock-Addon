import { getSupabaseClient } from '@/lib/supabase';

// Get Supabase client on demand to ensure it's initialized with the latest auth context
const getClient = () => {
  const client = getSupabaseClient();
  if (!client) {
    console.error('Supabase client not initialized');
  }
  return client;
};

/**
 * Fetches product codes and descriptions from all category tables based on stock_item_id
 * 
 * @param stockItemIds Array of stock_item_ids to fetch codes for
 * @returns Object mapping stock_item_id to its product code, description, and category
 */
export async function fetchProductCodes(stockItemIds?: string[]): Promise<Record<string, {code: string, description: string, category: string}>> {
  // Filter out undefined or null IDs if stockItemIds is provided
  const validIds = stockItemIds ? stockItemIds.filter(Boolean) : [];
  // If specific IDs were provided and none are valid, return empty. 
  // If no IDs were provided (fetch all mode), validIds will be empty but we proceed.
  if (stockItemIds && validIds.length === 0) return {};

  const productCodes: Record<string, {code: string, description: string, category: string}> = {};

  // Define our category tables with their code field names and description field
  const categoryTables = [
    { table: 'mattress', codeField: 'mattress_code', descField: 'description', category: 'mattress' },
    { table: 'base', codeField: 'code', descField: 'description', category: 'base' },
    { table: 'furniture', codeField: 'code', descField: 'description', category: 'furniture' },
    { table: 'headboards', codeField: 'code', descField: 'description', category: 'headboards' },
    { table: 'accessories', codeField: 'code', descField: 'description', category: 'accessories' },
    { table: 'foam', codeField: 'code', descField: 'description', category: 'foam' }
  ];

  // Define a type for the database records
  type DbRecord = Record<string, any> & { id?: string };

  // Check each table for the stock item IDs
  for (const { table, codeField, descField, category } of categoryTables) {
    try {
      const client = getClient();
      if (!client) {
        console.error(`Supabase client not initialized when searching ${table}`);
        continue;
      }
      
      let queryBuilder = client
        .from(table)
        .select(`id, ${codeField}, ${descField}`);

      // Only add the .in filter if stockItemIds were provided and there are valid IDs to filter by
      if (stockItemIds && validIds.length > 0) {
        queryBuilder = queryBuilder.in('id', validIds);
      }
      // If stockItemIds was not provided, no .in() filter is added, so it fetches all from the table.

      const { data, error } = await queryBuilder;

      if (error) {
        console.error(`Error fetching from ${table}:`, error);
        continue;
      }

      // Process the results
      if (data && Array.isArray(data)) {
        (data as DbRecord[]).forEach(item => {
          if (item && item.id && item[codeField]) {
            productCodes[item.id] = { 
              code: item[codeField], 
              description: item[descField] || `${category} product`,
              category 
            };
          }
        });
      }
    } catch (err) {
      console.error(`Error searching ${table} table:`, err);
    }
  }

  return productCodes;
}

/**
 * Gets the product code from an OrderItem
 * Handles all the different ways a code might be stored
 */
export function getProductCode(
  item: any, 
  productCodes: Record<string, any> = {}
): string {
  // First try using the "code" field directly
  if (item.code) {
    return item.code;
  }
  
  // Then try using the fetched product codes
  if (item.stock_item_id && productCodes[item.stock_item_id]) {
    if (typeof productCodes[item.stock_item_id] === 'object') {
      return productCodes[item.stock_item_id].code;
    }
    return productCodes[item.stock_item_id];
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
      if (baseMatch) return baseMatch[1];
    }
    
    // Try to match standard product code format at start of name
    const codeRegex = /^([A-Z0-9]+-[A-Z0-9]+(?:\s+XL)?)\s+-\s+/;
    const match = item.product_name.match(codeRegex);
    if (match) return match[1];
  }
  
  // Last resort: return N/A
  return 'N/A';
}

/**
 * Handles the special case of base products
 * Base products are typically added alongside mattresses and need special handling to get the correct stock_item_id and code
 * 
 * @param baseCodeFromName - The base code extracted from the product name (e.g., "BDGRY4-092" from "Base: BDGRY4-092")
 * @returns Object with base stock_item_id and code, or null if not found
 */
export async function fetchBaseInfoByCode(baseCodeFromName: string): Promise<{ id: string, code: string } | null> {
  try {
    // Get the client
    const client = getClient();
    if (!client) {
      console.error('Supabase client not initialized when searching base table');
      return null;
    }
    
    // Try to find the base in the base table using the code
    const { data, error } = await client
      .from('base')
      .select('id, code')
      .eq('code', baseCodeFromName)
      .single();
    
    if (error || !data) {
      console.error('Error finding base by code:', error);
      return null;
    }
    
    return {
      id: data.id,
      code: data.code
    };
  } catch (err) {
    console.error('Error in fetchBaseInfoByCode:', err);
    return null;
  }
}

/**
 * Enriches an order item with product code before inserting into database
 * This should be called whenever creating new order items
 * 
 * @param orderItems - Array of order items to enrich with product codes
 * @returns Array of enriched order items with product codes
 */
export async function enrichOrderItemsWithCodes(orderItems: any[]): Promise<any[]> {
  if (!orderItems || orderItems.length === 0) {
    return orderItems;
  }

  try {
    const result = [];
    
    // Process each item one by one (since we need to handle bases specially)
    for (const item of orderItems) {
      let enrichedItem = { ...item };
      
      // Remove category and mattress_code properties since they don't exist in the database
      const { category, mattress_code, ...itemWithoutUnsupportedFields } = enrichedItem;
      enrichedItem = itemWithoutUnsupportedFields;
      
      // Special handling for base products
      if (item.product_name && item.product_name.startsWith('Base:')) {
        const baseMatch = item.product_name.match(/^Base:\s+([A-Z0-9]+-[A-Z0-9]+)/);
        if (baseMatch) {
          const baseCode = baseMatch[1];
          // Look up the correct base information
          const baseInfo = await fetchBaseInfoByCode(baseCode);
          
          if (baseInfo) {
            // Update the item with correct base information
            enrichedItem = {
              ...enrichedItem,
              stock_item_id: baseInfo.id, // Use the correct base ID
              code: baseInfo.code         // Use the correct base code
            };
            result.push(enrichedItem);
            continue;
          }
        }
      }
      
      // Standard processing for non-base items
      if (item.stock_item_id) {
        // Extract all stock_item_ids
        const stockItemIds = [item.stock_item_id].filter(Boolean);
        
        if (stockItemIds.length > 0) {
          // Fetch product codes for this item
          const productCodes = await fetchProductCodes(stockItemIds);
          const codeInfo = productCodes[item.stock_item_id];
          
          if (codeInfo) {
            enrichedItem = { 
              ...enrichedItem, 
              code: codeInfo.code
              // Removed mattress_code since it doesn't exist in the database
            };
          }
        }
      }
      
      result.push(enrichedItem);
    }
    
    return result;
  } catch (error) {
    console.error('Error enriching order items with codes:', error);
    return orderItems; // Return original items if there was an error
  }
}

/**
 * Updates existing order items with the correct product codes
 * Use this for orders that already exist but are missing product codes
 * 
 * @param orderId - ID of the order whose items need code updates
 * @returns Boolean indicating success or failure
 */
export async function updateOrderItemCodes(orderId: string): Promise<boolean> {
  interface OrderItem {
    id: string;
    order_id: string;
    stock_item_id?: string;
    product_name: string;
    category?: string;
    code?: string;
    mattress_code?: string;
    [key: string]: any;
  }

  try {
    // Get the client
    const client = getClient();
    if (!client) {
      console.error('Supabase client not initialized when updating order item codes');
      return false;
    }
    
    // 1. Get all items for this order
    const { data: orderItemsData, error: itemsError } = await client
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);
      
    if (itemsError) {
      console.error('Error fetching order items:', itemsError);
      return false;
    }
    
    if (!orderItemsData || orderItemsData.length === 0) {
      return true; // No items to update
    }
    const orderItems: OrderItem[] = orderItemsData as OrderItem[];
    
    // 2. Enrich the items with product codes
    const enrichedItems: OrderItem[] = await enrichOrderItemsWithCodes(orderItems) as OrderItem[];
    
    // 3. Update each item in the database
    for (const item of enrichedItems) { // item is now OrderItem
      if (item.code) {
        const updateData: Record<string, any> = { 
          code: item.code
          // Removed category and mattress_code since they don't exist in the database
        };
        
        // If stock_item_id was updated (for bases), update that too
        if (item.stock_item_id !== orderItems.find((oi: OrderItem) => oi.id === item.id)?.stock_item_id) { // oi is now OrderItem
          updateData.stock_item_id = item.stock_item_id;
        }
        
        const client = getClient();
        if (!client) {
          console.error('Supabase client not initialized when updating order item');
          continue;
        }
        
        const { error } = await client
          .from('order_items')
          .update(updateData)
          .eq('id', item.id);
          
        if (error) {
          console.error(`Error updating order item ${item.id}:`, error);
        }
      }
    }
    return true;
  } catch (error) {
    console.error('Error updating order item codes:', error);
    return false;
  }
} 