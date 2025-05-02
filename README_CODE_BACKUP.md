# Backup of Original Code for enrichOrderItemsWithCodes and updateOrderItemCodes

## enrichOrderItemsWithCodes (Original)

```typescript
export async function enrichOrderItemsWithCodes(orderItems: any[]): Promise<any[]> {
  if (!orderItems || orderItems.length === 0) {
    return orderItems;
  }

  try {
    // Extract all stock_item_ids
    const stockItemIds = orderItems
      .map(item => item.stock_item_id)
      .filter(Boolean);
    
    if (stockItemIds.length === 0) {
      return orderItems;
    }
    
    // Fetch all product codes in one batch
    const productCodes = await fetchProductCodes(stockItemIds);
    
    // Enrich each order item with the appropriate code field
    return orderItems.map(item => {
      if (!item.stock_item_id) {
        return item;
      }
      
      const code = productCodes[item.stock_item_id];
      
      if (!code) {
        return item;
      }
      
      // Set the appropriate code field based on category
      if (item.category === 'mattress') {
        return { ...item, mattress_code: code };
      } else {
        return { ...item, code };
      }
    });
  } catch (error) {
    console.error('Error enriching order items with codes:', error);
    return orderItems; // Return original items if there was an error
  }
}
```

## updateOrderItemCodes (Original)

```typescript
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
    // First check if the required columns exist, and add them if not
    try {
      // Create a temporary item to check if columns exist
      const { error: checkError } = await supabase
        .from('order_items')
        .select('category, code, mattress_code')
        .limit(1);

      // If columns don't exist, add them
      if (checkError && checkError.message.includes('column')) {
        console.log('Adding missing columns to order_items table');
        // Try to add the missing columns
        if (checkError.message.includes('category')) {
          await supabase.rpc('add_column_if_not_exists', { 
            table_name: 'order_items',
            column_name: 'category',
            column_type: 'text'
          });
        }
        if (checkError.message.includes('code')) {
          await supabase.rpc('add_column_if_not_exists', {
            table_name: 'order_items',
            column_name: 'code',
            column_type: 'text'
          });
        }
        if (checkError.message.includes('mattress_code')) {
          await supabase.rpc('add_column_if_not_exists', {
            table_name: 'order_items',
            column_name: 'mattress_code',
            column_type: 'text'
          });
        }
      }
    } catch (columnError) {
      console.error('Error checking/adding columns:', columnError);
      // Continue anyway, in case the columns actually exist
    }

    // 1. Get all items for this order
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);
      
    if (itemsError) {
      console.error('Error fetching order items:', itemsError);
      return false;
    }
    
    if (!orderItems || orderItems.length === 0) {
      return true; // No items to update
    }
    
    // 2. Get stock item IDs to fetch product codes
    const stockItemIds: string[] = orderItems
      .map((item: OrderItem) => item.stock_item_id)
      .filter((id): id is string => id !== undefined && id !== null);
    
    if (stockItemIds.length === 0) {
      // Extract codes from product names if possible
      for (const item of orderItems as OrderItem[]) {
        let extractedCode = '';
        let extractedCategory = '';
        
        // Storage Base pattern (e.g., "SBB-107 - Storage Base Black")
        if (item.product_name.match(/^SB[A-Z]+-\d+/)) {
          const codeMatch = item.product_name.match(/^(SB[A-Z]+-\d+(?:\s+XL)?)/);
          if (codeMatch) {
            extractedCode = codeMatch[1];
            extractedCategory = 'furniture';
          }
        } 
        // Base pattern (e.g., "Base: BDGRY4-092")
        else if (item.product_name.startsWith('Base:')) {
          const codeMatch = item.product_name.match(/^Base:\s+([A-Z0-9]+-[A-Z0-9]+)/);
          if (codeMatch) {
            extractedCode = codeMatch[1];
            extractedCategory = 'furniture';
          }
        }
        // Standard product code at start (e.g., "CB4-092 - Comfort Basic")
        else {
          const codeMatch = item.product_name.match(/^([A-Z0-9]+-[A-Z0-9]+(?:\s+XL)?)\s+-\s+/);
          if (codeMatch) {
            extractedCode = codeMatch[1];
            // Determine category based on code prefix
            if (extractedCode.startsWith('CB') || extractedCode.startsWith('CS')) {
              extractedCategory = 'mattress';
            } else {
              extractedCategory = 'furniture';
            }
          }
        }
        
        if (extractedCode && extractedCategory) {
          // Update with extracted code
          const updateData = extractedCategory === 'mattress'
            ? { category: extractedCategory, mattress_code: extractedCode }
            : { category: extractedCategory, code: extractedCode };
            
          const { error } = await supabase
            .from('order_items')
            .update(updateData)
            .eq('id', item.id);
            
          if (error) {
            console.error(`Error updating order item ${item.id} with extracted code:`, error);
          }
        }
      }
      
      return true;
    }
    
    // 3. Fetch product codes from category tables
    const productCodesData = await fetchProductCodes(stockItemIds);
    
    // 4. Update each item with the correct code and category
    for (const item of orderItems as OrderItem[]) {
      if (!item.stock_item_id || !productCodesData[item.stock_item_id]) {
        continue;
      }
      
      const { code, category } = productCodesData[item.stock_item_id];
      
      // Skip if no valid code found
      if (!code || !category) {
        continue;
      }
      
      // Prepare update data based on category
      const updateData = category === 'mattress'
        ? { category, mattress_code: code, code: null }
        : { category, code, mattress_code: null };
        
      // Update the item
      const { error } = await supabase
        .from('order_items')
        .update(updateData)
        .eq('id', item.id);
        
      if (error) {
        console.error(`Error updating order item ${item.id}:`, error);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error updating order item codes:', error);
    return false;
  }
}
``` 