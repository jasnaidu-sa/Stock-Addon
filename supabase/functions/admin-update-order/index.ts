import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verify, decode } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface OrderHistoryEntry {
  order_id: string;
  user_id: string; // Clerk User ID
  action_type: string; // e.g., 'ITEM_AMENDED', 'ITEM_ADDED', 'ITEM_REMOVED', 'ORDER_ADMIN_NOTES_UPDATED'
  order_line_id?: string | null; // Foreign key to order_items.id

  // Fields for item changes specifically
  previous_product_name?: string | null;
  current_product_name?: string | null;
  original_qty?: number | null; // Existing column, for previous quantity
  updated_qty?: number | null; // Existing column, for current quantity
  previous_price_at_purchase?: number | null;
  current_price_at_purchase?: number | null;
  previous_code?: string | null;
  current_code?: string | null;

  // General purpose fields from existing table
  details?: any | null; // jsonb, for any miscellaneous structured data if needed
  changes_summary?: string | null; // Textual summary of changes
  admin_notes?: string | null; // For order-level admin notes (used for a specific entry type)
  // 'status' field in order_history table will use its default 'pending' or be set explicitly for status changes
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Admin-update-order function entered try block.');

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRoleKey) throw new Error('Server error: SUPABASE_SERVICE_ROLE_KEY is not set.');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!supabaseUrl) throw new Error('Server error: SUPABASE_URL is not set.');

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { orderId, itemsToUpdate, itemsToAdd, itemsToDelete, notes } = await req.json();

    if (!orderId) throw new Error('orderId is required.');

    // Manually verify the JWT from Clerk
    console.log('Attempting to verify JWT...');
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');

    // NOTE: It is recommended to store this URL in an environment variable
    const CLERK_JWKS_URL = "https://humorous-foal-6.clerk.accounts.dev/.well-known/jwks.json";
    
    const [header] = decode(token);
    
    const jwks = await (await fetch(CLERK_JWKS_URL)).json();
    const jwk = jwks.keys.find(k => k.kid === header.kid);

    if (!jwk) {
      throw new Error('JWK not found for the given kid.');
    }

    const publicKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      true,
      ["verify"]
    );

    const decodedPayload = await verify(token, publicKey);
    const userId = decodedPayload.sub;

    if (!userId) {
      console.error('Verified JWT payload is missing "sub" claim. Full payload:', decodedPayload);
      throw new Error('Could not extract user ID (sub) from token.');
    }
    console.log('Successfully verified JWT and extracted user ID:', userId);

    const errors: string[] = [];
    console.log(`[START] Processing order ${orderId} for user ${userId}`);

    // Step 1: Fetch current order items for snapshot
    console.log('[Step 1] Fetching current items for snapshot...');
    const { data: itemsBeforeAmendment, error: snapshotError } = await supabaseAdmin
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (snapshotError) {
      throw new Error(`[FAIL] Step 1: Failed to create snapshot: ${snapshotError.message}`);
    }
    console.log('[Step 1] Snapshot successful.');
    console.log('[DEBUG] Item structure example:', itemsBeforeAmendment.length > 0 ? JSON.stringify(itemsBeforeAmendment[0]) : 'No items');

    // Step 2: Log the amendment to order_history
    console.log('[Step 2] Logging amendment to order_history...');
    
    // Prepare history entries array
    const historyEntries: OrderHistoryEntry[] = [];

    // Process updated items
    if (itemsToUpdate && itemsToUpdate.length > 0) {
      for (const updatedItem of itemsToUpdate) {
        const originalItem = itemsBeforeAmendment.find(item => item.id === updatedItem.id);
        if (originalItem) {
          const changedFields: string[] = [];
          if (originalItem.product_name !== updatedItem.product_name) changedFields.push('product_name');
          if ((originalItem.quantity || 0) !== (updatedItem.quantity || 0)) changedFields.push('quantity');
          if ((originalItem.price_at_purchase || 0) !== (updatedItem.price_at_purchase || 0)) changedFields.push('price_at_purchase');
          if (originalItem.code !== updatedItem.code) changedFields.push('code');

          if (changedFields.length > 0) {
            historyEntries.push({
              order_id: orderId,
              order_line_id: updatedItem.id, // Maps to order_history.order_line_id
              user_id: userId,
              action_type: 'ITEM_AMENDED',
              previous_product_name: originalItem.product_name,
              current_product_name: updatedItem.product_name || originalItem.product_name,
              original_qty: originalItem.quantity,
              updated_qty: updatedItem.quantity,
              previous_price_at_purchase: originalItem.price_at_purchase,
              current_price_at_purchase: updatedItem.price_at_purchase ?? originalItem.price_at_purchase,
              previous_code: originalItem.code,
              current_code: updatedItem.code || originalItem.code,
              changes_summary: `Item amended. Changed: ${changedFields.join(', ')}.`
            });
          }
        }
      }
    }

    // Process added items
    // Note: itemsToAdd should contain the final item details including the DB-generated ID if possible.
    // If ID is generated client-side temporarily, ensure it's updated or handled appropriately.
    if (itemsToAdd && itemsToAdd.length > 0) {
      for (const addedItem of itemsToAdd) {
        historyEntries.push({
          order_id: orderId,
          order_line_id: addedItem.id, // Assumes addedItem.id is the actual ID from order_items table
          user_id: userId,
          action_type: 'ITEM_ADDED',
          current_product_name: addedItem.product_name,
          updated_qty: addedItem.quantity, // Maps to order_history.updated_qty
          current_price_at_purchase: addedItem.price_at_purchase,
          current_code: addedItem.code,
          original_qty: 0, // Explicitly set previous quantity to 0 for added items
          changes_summary: `Item added: ${addedItem.product_name || addedItem.code || 'New Item'}. Quantity: ${addedItem.quantity}`
        });
      }
    }

    // Process deleted items
    if (itemsToDelete && itemsToDelete.length > 0) {
      for (const deletedItemId of itemsToDelete) {
        const originalItem = itemsBeforeAmendment.find(item => item.id === deletedItemId);
        if (originalItem) {
          historyEntries.push({
            order_id: orderId,
            order_line_id: originalItem.id,
            user_id: userId,
            action_type: 'ITEM_REMOVED',
            previous_product_name: originalItem.product_name,
            original_qty: originalItem.quantity, // Maps to order_history.original_qty
            previous_price_at_purchase: originalItem.price_at_purchase,
            previous_code: originalItem.code,
            updated_qty: 0, // Explicitly set current quantity to 0 for removed items
            changes_summary: `Item removed: ${originalItem.product_name || originalItem.code || 'Item ' + originalItem.id}.`
          });
        }
      }
    }

    // If admin notes were provided in the request, create a specific history entry for them.
    if (notes) {
      historyEntries.push({
        order_id: orderId,
        user_id: userId,
        action_type: 'ORDER_ADMIN_NOTES_UPDATED',
        admin_notes: notes
      });
    }
    
    // Insert all history entries in a single operation
    const { error: historyError } = await supabaseAdmin
      .from('order_history')
      .insert(historyEntries);

    if (historyError) {
      // This is a critical failure, throw immediately
      throw new Error(`[FAIL] Step 2: Failed to log history: ${historyError.message}`);
    }
    console.log('[Step 2] History logging successful.');

    // Step 3: Apply changes to order_items
    console.log('[Step 3] Applying item changes...');
    if (itemsToUpdate && itemsToUpdate.length > 0) {
      console.log(`[Step 3a] Updating ${itemsToUpdate.length} items.`);
      for (const item of itemsToUpdate) {
        // Only update quantity. The 'total' is a generated column in the DB.
        // price_at_purchase should remain unchanged for this operation.
        const { error } = await supabaseAdmin
          .from('order_items')
          .update({ quantity: item.quantity }) // Total is removed from here
          .eq('id', item.id);
        if (error) {
          errors.push(`Failed to update item ${item.id}: ${error.message}`);
        } else {
          console.log(`Item ${item.id} quantity updated to ${item.quantity}. DB will recalculate total.`);
        }
      }
    }

    if (itemsToAdd && itemsToAdd.length > 0) {
      console.log(`[Step 3b] Adding ${itemsToAdd.length} new items.`);
      const newItemsWithOrderId = itemsToAdd.map(item => ({ ...item, order_id: orderId }));
      const { error } = await supabaseAdmin.from('order_items').insert(newItemsWithOrderId);
      if (error) errors.push(`Failed to add new items: ${error.message}`);
    }

    if (itemsToDelete && itemsToDelete.length > 0) {
      console.log(`[Step 3c] Deleting ${itemsToDelete.length} items.`);
      const { error } = await supabaseAdmin.from('order_items').delete().in('id', itemsToDelete);
      if (error) errors.push(`Failed to delete items: ${error.message}`);
    }
    console.log('[Step 3] Item changes applied.');

    // Step 4: Update the main order's admin_notes
    console.log("[Step 4] Updating order's admin_notes...");
    const { error: notesError } = await supabaseAdmin.from('orders').update({ admin_notes: notes }).eq('id', orderId);
    if (notesError) errors.push(`Failed to update order notes: ${notesError.message}`);
    console.log("[Step 4] Admin notes updated.");

    if (errors.length > 0) {
      throw new Error(`[FAIL] Errors occurred during item updates: ${errors.join('; ')}`);
    }

    // Step 5: Recalculate and update the total for the order
    console.log('[Step 5] Recalculating order total...');
    const { data: currentItems, error: fetchError } = await supabaseAdmin
      .from('order_items')
      .select('total')
      .eq('order_id', orderId);

    if (fetchError) {
      errors.push(`Failed to fetch items for total recalculation: ${fetchError.message}`);
    } else {
      const newTotal = currentItems.reduce((acc, item) => acc + (item.total || 0), 0);
      console.log(`[Step 5] New calculated total: ${newTotal}`);
      const { error: updateTotalError } = await supabaseAdmin
        .from('orders')
        .update({ value: newTotal })
        .eq('id', orderId);
      
      if (updateTotalError) {
        errors.push(`Failed to update order total: ${updateTotalError.message}`);
      }
    }
    console.log('[Step 5] Order total updated.');

    // Step 6: Set order status to 'review'
    console.log("[Step 6] Setting order status to 'review'...");
    const { error: updateStatusError } = await supabaseAdmin
      .from('orders')
      .update({ status: 'review' })
      .eq('id', orderId);

    if (updateStatusError) {
      errors.push(`Failed to update order status: ${updateStatusError.message}`);
    }
    console.log("[Step 6] Order status updated.");

    if (errors.length > 0) {
      throw new Error(`[FAIL] Errors occurred during finalization: ${errors.join('; ')}`);
    }

    console.log(`[SUCCESS] Order ${orderId} processed successfully.`);
    const data = { message: `Order ${orderId} updated successfully and set to review.` };

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error processing order update:', error);
    const errorMessage = error instanceof Error ? error.stack : String(error);
    return new Response(JSON.stringify({ error: `Function error: ${errorMessage}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
