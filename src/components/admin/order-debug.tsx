import React, { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';;
import { Button } from '@/components/ui/button';

export function OrderDebug() {
  
  const supabase = getSupabaseClient(); // Initialize Supabase clientconst [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runDebug = async () => {
    setLoading(true);
    try {
      // Fetch a sample order
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            product_name,
            quantity,
            price,
            total,
            notes
          )
        `)
        .limit(1);

      if (ordersError) throw ordersError;
      
      // If no orders, show that
      if (!ordersData || ordersData.length === 0) {
        setDebugInfo({ error: "No orders found" });
        return;
      }

      const order = ordersData[0];
      
      // Fetch user data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('id', order.user_id)
        .single();
        
      // Fetch owner data if different from user
      let ownerData = null;
      let ownerError = null;
      
      if (order.order_owner_id && order.order_owner_id !== order.user_id) {
        const ownerResult = await supabase
          .from('users')
          .select('id, email, name')
          .eq('id', order.order_owner_id)
          .single();
          
        ownerData = ownerResult.data;
        ownerError = ownerResult.error;
      }
      
      // Set debug info
      setDebugInfo({
        order,
        userData,
        userError,
        ownerData,
        ownerError,
        formattedUserName: userData ? userData.name || userData.email : 'Unknown',
        formattedOwnerName: ownerData ? ownerData.name || ownerData.email : 'Same as user'
      });
    } catch (error) {
      console.error('Debug error:', error);
      setDebugInfo({ error });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border p-4 rounded-md mt-8">
      <h2 className="text-xl font-bold mb-4">Order Debug Tool</h2>
      <Button onClick={runDebug} disabled={loading}>
        {loading ? 'Running...' : 'Run Debug'}
      </Button>
      
      {debugInfo && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Debug Results:</h3>
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-[500px] text-sm">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
} 