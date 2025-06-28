// Copy this entire function into admin-order-table.tsx to replace the broken handleSave function

const handleSave = async (order: Order) => {
  try {
    setIsSaving(true);
    const editedOrderItems = editingItems[order.id];
    if (!editedOrderItems) {
      toast({ title: "No changes", description: "No items were modified.", variant: "default" });
      setIsSaving(false);
      return;
    }

    const originalOrderItems = order.items || [];
    const newTotals = calculateTotals(editedOrderItems);
    
    // Use Clerk auth with proper hooks
    if (!isSignedIn || !userId) {
      toast({ title: "Authentication Error", description: "Please sign in again to continue.", variant: "destructive" });
      setIsSaving(false);
      return;
    }
    
    // 1. Create a single order_history entry for this edit session
    // Use supabaseAdmin for privileged operations to bypass RLS
    if (!supabaseAdmin) {
      console.error('SupabaseAdmin client not initialized for order history');
      toast({ title: "Admin Error", description: "Admin database client not available", variant: "destructive" });
      setIsSaving(false);
      return;
    }
    
    console.log('Using supabaseAdmin client for order_history operations');
    const { data: historyEntryResult, error: historyEntryError } = await supabaseAdmin
      .from('order_history')
      .insert({
        order_id: order.id,
        details: { clerk_user_id: userId },
        changed_by: null,
        change_type: 'items_modified',
        notes: adminNotes[order.id] || '',
        previous_status: order.status,
        new_status: 'review',
        metadata: {
          original_quantity: order.quantity,
          updated_quantity: newTotals.quantity,
          original_value: order.value,
          updated_value: newTotals.value,
        }
      })
      .select('id')
      .single();

    if (historyEntryError || !historyEntryResult) {
      console.error('Failed to create order_history entry:', historyEntryError);
      toast({ title: "Error", description: "Failed to log high-level order changes.", variant: "destructive" });
      setIsSaving(false);
      return;
    }
    
    const orderHistoryId = historyEntryResult.id;
    const itemHistoryEntries = [];

    // 2. Process item changes (Added, Modified, Removed)
    const newItemsToInsert = [];
    const existingItemsToUpdate = [];
    const removedItemOriginalDetails = [];

    // Populate newItemsToInsert and existingItemsToUpdate from editedOrderItems
    for (const editedItem of editedOrderItems) {
      if (editedItem.id.startsWith('temp_')) {
        newItemsToInsert.push(editedItem);
      } else {
        const originalItem = originalOrderItems.find(oi => oi.id === editedItem.id);
        if (originalItem) {
          if (originalItem.quantity !== editedItem.quantity || originalItem.price !== editedItem.price) {
            existingItemsToUpdate.push(editedItem);
            itemHistoryEntries.push({
              order_history_id: orderHistoryId,
              order_item_id: originalItem.id,
              stock_item_id: originalItem.stock_item_id,
              product_name: editedItem.product_name,
              previous_quantity: originalItem.quantity,
              new_quantity: editedItem.quantity,
              previous_price: originalItem.price,
              new_price: editedItem.price,
              action: 'modified'
            });
          }
        } else {
          console.warn("Edited item not found in original items and not a temp_ item:", editedItem);
        }
      }
    }
    
    // Identify removed items
    originalOrderItems.forEach(originalItem => {
      const stillExists = editedOrderItems.find(ei => ei.id === originalItem.id);
      if (!stillExists) {
        removedItemOriginalDetails.push(originalItem);
        itemHistoryEntries.push({
          order_history_id: orderHistoryId,
          order_item_id: originalItem.id,
          stock_item_id: originalItem.stock_item_id,
          product_name: originalItem.product_name,
          previous_quantity: originalItem.quantity,
          new_quantity: 0,
          previous_price: originalItem.price,
          new_price: originalItem.price,
          action: 'removed'
        });
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
            itemHistoryEntries.push({
              order_history_id: orderHistoryId,
              order_item_id: dbItem.id,
              stock_item_id: tempItemDetails.stock_item_id,
              product_name: tempItemDetails.product_name,
              previous_quantity: 0,
              new_quantity: tempItemDetails.quantity,
              previous_price: 0,
              new_price: tempItemDetails.price,
              action: 'added'
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
      }
    }

    // 6. Insert item history entries
    if (itemHistoryEntries.length > 0) {
      const { error: itemHistoryError } = await supabaseAdmin
        .from('order_item_history')
        .insert(itemHistoryEntries);

      if (itemHistoryError) {
        console.error('Failed to save detailed order_item_history:', itemHistoryError);
        toast({ 
          title: "Warning", 
          description: "Order items updated, but detailed history logging failed.", 
          variant: "destructive" 
        });
      }
    }

    // 7. Update the main orders table
    const { error: updateOrderError } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'review',
        quantity: newTotals.quantity,
        value: newTotals.value,
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

    reloadOrders();
  } catch (error) {
    console.error('Error updating order:', error);
    toast({
      title: "Error",
      description: error.message || "Failed to update order",
      variant: "destructive",
    });
  } finally {
    setIsSaving(false);
  }
};
