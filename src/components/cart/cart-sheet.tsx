import { useCart } from './cart-provider';
import { formatCurrency } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
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
  try {
    console.log("Generating order number...");
    
    // Check if the order_sequence table exists
    const { data: tableExists, error: tableCheckError } = await supabase
      .from('order_sequence')
      .select('current_value')
      .limit(1);
      
    if (tableCheckError) {
      console.error("Error checking order_sequence table:", tableCheckError);
      
      // Log the error to the order_number_errors table
      try {
        await supabase.rpc('log_order_number_error', {
          p_error_message: `Error checking order_sequence table: ${tableCheckError.message}`,
          p_additional_info: JSON.stringify({ error: tableCheckError })
        });
      } catch (logError) {
        console.error("Failed to log order number error:", logError);
      }
      
      // If the table doesn't exist, use a fallback approach
      if (tableCheckError.message && tableCheckError.message.includes('relation "order_sequence" does not exist')) {
        console.log("Using fallback approach for order number generation");
        
        // Generate a timestamp-based order number as fallback
        const timestamp = new Date().getTime();
        const randomPart = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `DYN${timestamp.toString().slice(-6)}${randomPart}`;
      } else {
        // Some other error occurred, use a timestamp-based fallback
        console.error("Unknown error checking order_sequence table:", tableCheckError);
        const timestamp = new Date().getTime();
        const randomPart = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `DYN${timestamp.toString().slice(-6)}${randomPart}`;
      }
    }
    
    // Get the current sequence value
    const { data: sequenceData, error: sequenceError } = await supabase
      .from('order_sequence')
      .select('current_value')
      .eq('id', 1)
      .single();
      
    if (sequenceError) {
      console.error("Error getting sequence value:", sequenceError);
      
      // Log the error to the order_number_errors table
      try {
        await supabase.rpc('log_order_number_error', {
          p_error_message: `Error getting sequence value: ${sequenceError.message}`,
          p_additional_info: JSON.stringify({ error: sequenceError })
        });
      } catch (logError) {
        console.error("Failed to log order number error:", logError);
      }
      
      // Try to insert the initial value
      try {
        console.log("Trying to insert initial sequence value...");
        const { error: insertError } = await supabase
          .from('order_sequence')
          .insert({ id: 1, current_value: 1000 });
          
        if (insertError) {
          console.error("Error inserting initial sequence value:", insertError);
          
          // Log the error to the order_number_errors table
          try {
            await supabase.rpc('log_order_number_error', {
              p_error_message: `Error inserting initial sequence value: ${insertError.message}`,
              p_additional_info: JSON.stringify({ error: insertError })
            });
          } catch (logError) {
            console.error("Failed to log order number error:", logError);
          }
          
          // Use a timestamp-based fallback
          const timestamp = new Date().getTime();
          const randomPart = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
          return `DYN${timestamp.toString().slice(-6)}${randomPart}`;
        }
        
        console.log("Initial sequence value inserted successfully");
        return `DYN${(1000).toString().padStart(6, '0')}`;
      } catch (insertError) {
        console.error("Exception inserting initial sequence value:", insertError);
        
        // Log the error to the order_number_errors table
        try {
          await supabase.rpc('log_order_number_error', {
            p_error_message: `Exception inserting initial sequence value: ${insertError}`,
            p_additional_info: JSON.stringify({ error: insertError })
          });
        } catch (logError) {
          console.error("Failed to log order number error:", logError);
        }
        
        // Use a timestamp-based fallback
        const timestamp = new Date().getTime();
        const randomPart = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `DYN${timestamp.toString().slice(-6)}${randomPart}`;
      }
    }
    
    // Get the current value
    const currentValue = sequenceData?.current_value || 1000;
    console.log("Current sequence value:", currentValue);
    
    // Increment the sequence
    const newValue = currentValue + 1;
    
    // Update the sequence
    const { error: updateError } = await supabase
      .from('order_sequence')
      .update({ current_value: newValue })
      .eq('id', 1);
      
    if (updateError) {
      console.error("Error updating sequence:", updateError);
      
      // Log the error to the order_number_errors table
      try {
        await supabase.rpc('log_order_number_error', {
          p_error_message: `Error updating sequence: ${updateError.message}`,
          p_additional_info: JSON.stringify({ 
            error: updateError,
            current_value: currentValue,
            new_value: newValue
          })
        });
      } catch (logError) {
        console.error("Failed to log order number error:", logError);
      }
      
      // Still use the current value even if we couldn't update it
      return `DYN${currentValue.toString().padStart(6, '0')}`;
    }
    
    // Format the order number: DYN + 6-digit number
    const orderNumber = `DYN${currentValue.toString().padStart(6, '0')}`;
    console.log("Generated order number:", orderNumber);
    
    return orderNumber;
  } catch (error) {
    console.error("Unexpected error in generateOrderNumber:", error);
    
    // Log the error to the order_number_errors table
    try {
      await supabase.rpc('log_order_number_error', {
        p_error_message: `Unexpected error in generateOrderNumber: ${error}`,
        p_additional_info: JSON.stringify({ error })
      });
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
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();

  const handleCheckout = async () => {
    if (state.items.length === 0) {
      toast({
        title: 'Cart is empty',
        description: 'Please add items to your cart before checking out.',
        variant: 'destructive',
      });
      return;
    }

    // Validate store name
    if (!state.store || state.store.trim() === '') {
      toast({
        title: 'Store name required',
        description: 'Please enter a store name before checking out.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Get the current user's session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error('Authentication error. Please log in again.');
      }
      
      // Generate order number
      const orderNumber = await generateOrderNumber();

      // Group items by category to calculate totals
      const categoryTotals = state.items.reduce((acc, item) => {
        const category = item.category;
        if (!acc[category]) {
          acc[category] = {
            quantity: 0,
            value: 0
          };
        }
        acc[category].quantity += item.quantity;
        acc[category].value += item.price * item.quantity;
        return acc;
      }, {} as Record<string, { quantity: number; value: number }>);

      // Create orders for each category
      for (const [category, totals] of Object.entries(categoryTotals)) {
        // For bases, attach them to the mattress order
        if (category === 'base') continue;

        const orderData = {
          order_number: orderNumber,
          user_id: sessionData.session.user.id,
          order_owner_id: sessionData.session.user.id,
          store_name: state.store,
          category,
          quantity: totals.quantity,
          value: totals.value,
          status: 'pending',
        };
      
        // Insert the order
        const { data: insertedOrder, error: insertError } = await supabase
          .from('orders')
          .insert(orderData)
          .select()
          .single();

        if (insertError || !insertedOrder) {
          throw new Error(`Failed to create order: ${insertError?.message || 'Unknown error'}`);
        }

        // Get items for this category
        const categoryItems = state.items.filter(item => {
          // If this is a mattress order, include both mattress and its base
          if (category === 'mattress') {
            return item.category === 'mattress' || item.category === 'base';
          }
          // For other categories, just include matching items
          return item.category === category;
        });

        // Create order items
        const orderItems = categoryItems.map(item => ({
          order_id: insertedOrder.id,
          stock_item_id: item.id.replace('_base', ''), // Remove _base suffix if present
          product_name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
          notes: item.notes || ''
        }));

        // Enrich order items with product codes
        const enrichedItems = await enrichOrderItemsWithCodes(orderItems);

        // Insert order items
        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(enrichedItems);

        if (itemsError) {
          throw new Error(`Failed to create order items: ${itemsError.message}`);
        }
      }
      
      // Clear the cart
      dispatch({ type: 'CLEAR_CART' });
      
      toast({
        title: 'Order placed successfully',
        description: `Your order number is ${orderNumber}`,
      });
      
      // Navigate to orders page
      navigate('/orders');
    } catch (error) {
      console.error('Error creating order:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create order',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
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
          value={state.store}
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
          onClick={handleCheckout}
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