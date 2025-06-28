import { useCart } from './cart-provider';
import { formatCurrency } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getSupabaseClient, supabaseAdmin } from '@/lib/supabase';
// Direct import for admin client to ensure we get the latest

import { useToast } from '@/hooks/use-toast';
import { useUser } from '@clerk/clerk-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { MinusIcon, PlusIcon, Trash2Icon, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { enrichOrderItemsWithCodes } from '@/lib/product-utils';

// Function to generate a sequential order number
async function generateOrderNumber() {
  // Use supabaseAdmin to bypass RLS for order number generation
  if (!supabaseAdmin) {
    console.error('Supabase admin client is null');
    const timestamp = new Date().getTime();
    const randomPart = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `DYN${timestamp.toString().slice(-6)}${randomPart}`;
  }
  try {
    console.log("Generating order number...");
    
    // Direct atomic approach: Get the next sequence number via RPC function
    // This will atomically increment and return the new value in one operation
    const { data: nextSequence, error: updateError } = await supabaseAdmin
      .rpc('increment_and_get_order_number');
      
    if (updateError || nextSequence === null || nextSequence === undefined) {
      console.error("Error getting next sequence number:", updateError);
      
      // Log the error
      try {
        await supabaseAdmin.rpc('log_order_number_error', {
          p_error_message: `Error getting next sequence: ${updateError?.message || 'No sequence returned'}`,
          p_additional_info: JSON.stringify({ error: updateError, sequence: nextSequence })
        });
      } catch (logError) {
        console.error("Failed to log order number error:", logError);
      }
      
      // Use a timestamp-based fallback for emergencies
      const timestamp = new Date().getTime();
      const randomPart = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      return `DYN${timestamp.toString().slice(-6)}${randomPart}`;
    }
    
    // Format the order number: DYN + 6-digit number using the NEW sequence value
    const orderNumber = `DYN${nextSequence.toString().padStart(6, '0')}`;
    console.log("Generated order number:", orderNumber, "from sequence:", nextSequence);
    
    return orderNumber;
  } catch (error) {
    console.error("Unexpected error in generateOrderNumber:", error);
    
    // Log the error to the order_number_errors table
    try {
      const supabaseClient = getSupabaseClient();
      if (supabaseClient) {
        await supabaseClient.rpc('log_order_number_error', {
          p_error_message: `Unexpected error in generateOrderNumber: ${error}`,
          p_additional_info: JSON.stringify({ error })
        });
      }
    } catch (logError) {
      console.error("Failed to log order number error:", logError);
    }
    
    // Use a timestamp-based fallback as last resort
    const timestamp = new Date().getTime();
    const randomPart = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `DYN${timestamp.toString().slice(-6)}${randomPart}`;
  }
}

export function CartSheet() {
  const { state, dispatch } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useUser();
  const userId = user?.id;
  const isSignedIn = !!user;


  const executeCheckoutV2 = async () => {
    console.log('executeCheckoutV2: Initial state.items:', JSON.stringify(state.items, null, 2));
    // VERSION IDENTIFIER
    console.log('%c*** RUNNING DIRECT DB INSERT CHECKOUT - v6 (FINAL) ***', 'color: green; font-weight: bold; font-size: 16px');

    console.time('checkout');
    if (state.items.length === 0) {
      toast({ title: 'Cart is empty', description: 'Please add items to your cart before checking out.', variant: 'destructive' });
      return;
    }

    if (!state.store || state.store.trim() === '') {
      toast({ title: 'Store name required', description: 'Please enter a store name before checking out.', variant: 'destructive' });
      return;
    }
    
    if (!userId || !isSignedIn) {
      toast({ title: 'Authentication Error', description: 'Please log in again to continue with checkout.', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    
    try {
      const orderNumber = await generateOrderNumber();
      console.log(`Generated order number: ${orderNumber}`);

      if (!supabaseAdmin) throw new Error('Admin client not available');
      
      // 1. Get Supabase UUID for the current Clerk user
      console.time('user_lookup');
      let supabaseUserId = null;
      try {
        const { data: userMapping, error: userError } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('clerk_id', userId) // Corrected column name
          .single();
        
        if (userError) throw userError;
        
        if (userMapping) {
          supabaseUserId = userMapping.id;
        } else {
          throw new Error('User mapping not found in Supabase.');
        }
      } catch (error) {
        console.error('User mapping lookup failed:', error);
        throw new Error('Could not verify user for order creation.');
      }
      console.timeEnd('user_lookup');

      // 3. Prepare order items (this step now comes before order insertion to calculate totals)
      //    Creating separate entries for mattresses and bases
      let rawOrderItemsToProcess = [];
      console.log('Processing cart items for order. Cart state.items:', JSON.stringify(state.items, null, 2));

      for (const item of state.items) {
        console.log('Processing cart item:', JSON.stringify(item, null, 2));

        const commonProductDetails = {
          stock_item_id: item.id,
          product_name: item.name,
          quantity: item.quantity,
          price: item.price,
          notes: item.notes || '',
          code: item.code,
          product_type: item.product_type,
          category: item.category, // Use category from cart item
          mattress_code: item.product_type === 'mattress' ? item.code : undefined,
        };

        // Validate/fallback category for the main item
        if (!commonProductDetails.category && item.product_type === 'mattress') {
          commonProductDetails.category = 'mattress';
          console.warn(`Cart item ${item.id} category was not set, defaulting to "mattress" for mattress product_type.`);
        } else if (!commonProductDetails.category && item.product_type === 'base') {
          commonProductDetails.category = 'base';
          console.warn(`Cart item ${item.id} category was not set, defaulting to "base" for base product_type.`);
        } else if (!commonProductDetails.category) {
          console.error(`CRITICAL: Cart item ${item.id} category is missing. product_type: ${item.product_type}. This item's category might be incorrect.`);
        }
        
        rawOrderItemsToProcess.push(commonProductDetails);
        console.log('Added main product to rawOrderItemsToProcess:', JSON.stringify(commonProductDetails, null, 2));

        if (item.product_type === 'mattress' && item.base && item.base.id) {
          const baseOrderItem = {
            stock_item_id: item.base.id,
            product_name: item.base.description || `Base for ${item.name}`,
            quantity: item.quantity,
            price: item.base.price,
            notes: `Included base for ${item.name}`,
            code: item.base.code,
            product_type: 'base',
            category: 'base', // Explicitly set category for base
            mattress_code: item.code,
          };
          rawOrderItemsToProcess.push(baseOrderItem);
          console.log('Added separate base order item to rawOrderItemsToProcess:', JSON.stringify(baseOrderItem, null, 2));
        } else if (item.product_type === 'mattress' && item.base) {
          console.warn('Mattress item has a base object, but base.id is missing. Base will not be added as a separate line item. Base object:', item.base);
        } else if (item.product_type === 'mattress' && !item.base) {
          console.log('Mattress item does not have an associated base object. Item:', item);
        }
      }
      console.log('Final rawOrderItemsToProcess (used for order totals and enrichment):', JSON.stringify(rawOrderItemsToProcess, null, 2));

      // Calculate totals from rawOrderItemsToProcess for the main order record
      const totalAmountForOrder = rawOrderItemsToProcess.reduce((sum, currentItem) => sum + (currentItem.price * currentItem.quantity), 0);
      const totalQuantityForOrder = rawOrderItemsToProcess.reduce((sum, currentItem) => sum + currentItem.quantity, 0);
      console.log(`Calculated for orders table: totalAmountForOrder = ${totalAmountForOrder}, totalQuantityForOrder = ${totalQuantityForOrder}`);

      // Determine category for the main 'orders' record
      let orderCategory = 'unknown'; // Default category
      if (rawOrderItemsToProcess.some(item => item.product_type === 'mattress')) {
        orderCategory = 'mattress';
      } else if (rawOrderItemsToProcess.length > 0) {
        // Fallback to the category of the first item if no mattress
        orderCategory = rawOrderItemsToProcess[0].category || 'unknown'; 
      }
      console.log(`Determined order category for 'orders' table: ${orderCategory}`);

      // 2. Create the main order record (moved after item processing to include totals and category)
      const orderPayload = {
        order_number: orderNumber,
        user_id: supabaseUserId,
        order_owner_id: supabaseUserId, // Assuming this is correct, maps to order_owner_id in DB
        store_name: state.store,
        status: 'pending', 
        value: totalAmountForOrder, // Corrected: Use 'value' for total amount
        quantity: totalQuantityForOrder, // Corrected: Use 'quantity' for total quantity
        category: orderCategory, // This was already correct
      };
    
      console.time('order_insert');
      const { data: createdOrder, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert(orderPayload)
        .select()
        .single();
      console.timeEnd('order_insert');

      if (orderError || !createdOrder) {
        console.error('Order insertion failed. Payload:', JSON.stringify(orderPayload, null, 2));
        throw new Error(`Failed to create order. Details: ${orderError?.message}`);
      }
      console.log('Order inserted with ID:', createdOrder.id, 'Payload:', JSON.stringify(createdOrder, null, 2));

      // console.time('enrich_items');
    // // enrichOrderItemsWithCodes should ideally handle product_type correctly
    // // or be adjusted if it makes assumptions based on just code/mattress_code
    // const enrichedItemsWithoutOrderId = await enrichOrderItemsWithCodes(rawOrderItemsToProcess);
    // console.log('Enriched items (output of enrichOrderItemsWithCodes):', JSON.stringify(enrichedItemsWithoutOrderId, null, 2));

    // Using rawOrderItemsToProcess directly as enrichment seems redundant now
    console.log('Skipping enrichOrderItemsWithCodes, using rawOrderItemsToProcess directly.');
    const itemsReadyForInsert = rawOrderItemsToProcess.map(item => ({
      ...item,
      order_id: createdOrder.id,
      price: item.price, // Corrected: Map to 'price' column in order_items
      total: item.price * item.quantity, // Added: Calculate line item total
      // Ensure your 'order_items' table has 'price', 'total', 'code', 'mattress_code', 'product_type', 'category'
      // 'stock_item_id', 'product_name', 'quantity', 'notes' should also be present from ...item spread
    }));
    // If 'price' itself should not be in the final insert object for order_items, 
    // you might need to delete it or ensure the spread operator handles it correctly based on target schema.
    // For now, assuming 'price' from cart item becomes 'price_at_purchase'

    console.log('Final order items to insert (with order_id):', JSON.stringify(itemsReadyForInsert, null, 2));

      // 5. Batch insert all order items
      console.time('order_items_insert');
    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(itemsReadyForInsert); // Use itemsReadyForInsert
    console.timeEnd('order_items_insert');

      if (itemsError) {
        console.error('Error inserting order items:', itemsError);
        await supabaseAdmin.from('orders').delete().eq('id', createdOrder.id);
        throw new Error(`Failed to add items to order. Details: ${itemsError.message}`);
      }
      
      console.log(`Order ${createdOrder.order_number} created successfully with ${itemsReadyForInsert.length} items.`);
      
      // 6. Clear cart and show success
      dispatch({ type: 'CLEAR_CART' });
      toast({
        title: 'Order Placed!',
        description: `Your order #${createdOrder.order_number} has been successfully placed.`,
      });
      
      // 7. Navigate to orders page
      navigate('/orders');

    } catch (error) {
      console.error('Checkout failed:', error);
      toast({
        title: 'Checkout Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      console.timeEnd('checkout');
    }
  };

  return (
    <Card className="w-full h-[calc(100vh-8rem)] flex flex-col sticky top-[5rem]">
      <CardHeader className="flex-none py-3">
        <CardTitle>Shopping Cart</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-2 p-3 overflow-hidden">
        <Input
          placeholder="Enter store name"
          value={useCart().state.store}
          onChange={(e) => dispatch({ type: 'SET_STORE', payload: e.target.value })}
          className="h-8 flex-none"
        />
        <ScrollArea className="flex-1">
          {state.items.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">
              Your cart is empty
            </p>
          ) : (
            <div className="space-y-4 pr-4">
              {state.items.map((item) => (
                <div
                  key={item.id}
                  className="space-y-2 pb-4 border-b"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(item.price * item.quantity)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => 
                          dispatch({
                            type: 'UPDATE_QUANTITY',
                            payload: { id: item.id, quantity: Math.max(1, item.quantity - 1) }
                          })
                        }
                        disabled={isProcessing}
                      >
                        <MinusIcon className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => 
                          dispatch({
                            type: 'UPDATE_QUANTITY',
                            payload: { id: item.id, quantity: item.quantity + 1 }
                          })
                        }
                        disabled={isProcessing}
                      >
                        <PlusIcon className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => dispatch({ type: 'REMOVE_ITEM', payload: item.id })}
                        disabled={isProcessing}
                      >
                        <Trash2Icon className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    placeholder="Add notes for this item..."
                    value={item.notes || ''}
                    onChange={(e) => 
                      dispatch({
                        type: 'UPDATE_NOTES',
                        payload: { id: item.id, notes: e.target.value }
                      })
                    }
                    className="min-h-[60px] text-sm resize-none"
                    disabled={isProcessing}
                  />
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
      <CardFooter className="flex-none border-t p-3 space-y-4 flex flex-col">
        <div className="flex items-center justify-between w-full font-medium">
          <span>Total</span>
          <span>{formatCurrency(state.total)}</span>
        </div>
        <Button
          className="w-full"
          disabled={state.items.length === 0 || !state.store || isProcessing}
          onClick={executeCheckoutV2}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Submit'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}