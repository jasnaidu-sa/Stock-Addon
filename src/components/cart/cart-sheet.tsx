import { useCart } from './cart-provider';
import { formatCurrency } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getSupabaseClient, supabaseAdmin } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@clerk/clerk-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { MinusIcon, PlusIcon, Trash2Icon, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
    
    const { data: nextSequence, error: updateError } = await supabaseAdmin
      .rpc('increment_and_get_order_number');
      
    if (updateError || nextSequence === null || nextSequence === undefined) {
      console.error("Error getting next sequence number:", updateError);
      try {
        await supabaseAdmin.rpc('log_order_number_error', {
          p_error_message: `Error getting next sequence: ${updateError?.message || 'No sequence returned'}`,
          p_additional_info: JSON.stringify({ error: updateError, sequence: nextSequence })
        });
      } catch (logError) {
        console.error("Failed to log order number error:", logError);
      }
      const timestamp = new Date().getTime();
      const randomPart = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      return `DYN${timestamp.toString().slice(-6)}${randomPart}`;
    }
    
    const orderNumber = `DYN${nextSequence.toString().padStart(6, '0')}`;
    console.log("Generated order number:", orderNumber, "from sequence:", nextSequence);
    
    return orderNumber;
  } catch (error) {
    console.error("Unexpected error in generateOrderNumber:", error);
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
    console.log('%c*** RUNNING DIRECT DB INSERT CHECKOUT - v8 ***', 'color: green; font-weight: bold; font-size: 16px');
    console.log('Cart items at checkout:', JSON.stringify(state.items, null, 2));

    if (!isSignedIn || !userId) {
      toast({ title: 'Authentication Error', description: 'You must be signed in to place an order.', variant: 'destructive' });
      return;
    }

    if (state.items.length === 0) {
      toast({ title: 'Cart is empty', description: 'Please add items to your cart before submitting.', variant: 'destructive' });
      return;
    }
    
    if (!state.store) {
      toast({ title: 'Store name is missing', description: 'Please enter a store name.', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);

    const supabaseClient = getSupabaseClient();
    if (!supabaseClient || !supabaseAdmin) {
      toast({ title: 'Database Error', description: 'Cannot connect to the database. Admin client missing.', variant: 'destructive' });
      setIsProcessing(false);
      return;
    }

    try {
      const orderNumber = await generateOrderNumber();

      // 1. Get Supabase user UUID from Clerk user ID
      const { data: supabaseUser, error: userError } = await supabaseClient
        .from('users')
        .select('id')
        .eq('clerk_id', userId)
        .single();

      if (userError || !supabaseUser) {
        console.error('Error fetching Supabase user:', userError);
        toast({ title: 'User Not Found', description: 'Could not find a corresponding user in the database.', variant: 'destructive' });
        return;
      }

      const supabaseUserId = supabaseUser.id;

      // 2. Create the order (using admin client to bypass RLS)
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert({ order_number: orderNumber, user_id: supabaseUserId, order_owner_id: supabaseUserId, store_name: state.store, value: state.total, status: 'pending' })
        .select()
        .single();

      if (orderError || !order) {
        console.error('Error creating order:', orderError);
        toast({ title: 'Order Creation Failed', description: orderError?.message || 'An unknown error occurred.', variant: 'destructive' });
        return;
      }

      // 2. Prepare order items directly from cart state
      const orderItems = state.items.map(item => {
        if (!item.id) {
          console.error('Cart item is missing an ID:', item);
          throw new Error('A cart item is missing its ID. Cannot proceed.');
        }
        return {
          order_id: order.id,
          stock_item_id: item.id,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity, // Calculate the line item total
          notes: item.notes,
          product_type: item.category,
          // For mattress or base, this is the item's own code.
          code: (item.category === 'mattress' || item.category === 'base') ? item.code : undefined,
          // For a mattress, this is its own code. For a base, it's the parent mattress's code.
          // @ts-ignore - Assuming mattress_code may exist on the cart item for associated bases.
          mattress_code: item.category === 'mattress' ? item.code : item.mattress_code,
        };
      });

      console.log('Order items to insert:', JSON.stringify(orderItems, null, 2));

      // 3. Insert order items (using admin client to bypass RLS)
      const { error: itemsError } = await supabaseAdmin.from('order_items').insert(orderItems);

      if (itemsError) {
        console.error('Error inserting order items:', itemsError);
        // Attempt to roll back the order creation (using admin client)
        await supabaseAdmin.from('orders').delete().eq('id', order.id);
        toast({ title: 'Order Failed', description: `Failed to save order items: ${itemsError.message}. The order has been cancelled.`, variant: 'destructive' });
        return;
      }

      // 4. Success
      dispatch({ type: 'CLEAR_CART' });
      toast({ title: 'Order Submitted!', description: `Your order #${orderNumber} has been placed.` });
      navigate(`/orders/${order.id}`);
    } catch (error) {
      console.error('An unexpected error occurred during checkout:', error);
      toast({ title: 'Checkout Error', description: error instanceof Error ? error.message : 'An unknown error occurred.', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full h-[calc(100vh-8rem)] flex flex-col sticky top-[5rem] border-0 shadow-none">
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