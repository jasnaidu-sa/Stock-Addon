import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseClient } from '@/lib/supabase';;
import { updateOrderItemCodes } from '@/lib/product-utils';
import { Loader2, CheckCircle2, Info } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export function FixOrderCodesPage() {
  
  const supabase = getSupabaseClient(); // Initialize Supabase clientconst [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [processedOrders, setProcessedOrders] = useState<number>(0);
  const [totalOrders, setTotalOrders] = useState<number>(0);
  const [completedSuccessfully, setCompletedSuccessfully] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);
  const { toast } = useToast();

  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
    console.log(message);
  };

  const handleUpdateCodes = async () => {
    setIsProcessing(true);
    setProgress(0);
    setProcessedOrders(0);
    setCompletedSuccessfully(false);
    setLogs([]);

    try {
      // Check if columns exist first
      addLog("Checking if necessary columns exist...");
      try {
        // Create a temporary item to check if columns exist
        const { error: checkError } = await supabase
          .from('order_items')
          .select('category, code, mattress_code')
          .limit(1);

        // If columns don't exist, add them
        if (checkError && checkError.message.includes('column')) {
          addLog("Adding missing columns to order_items table...");
          
          // Try to add the missing columns using RPC
          if (checkError.message.includes('category')) {
            addLog("Adding 'category' column...");
            await supabase.rpc('add_column_if_not_exists', { 
              table_name: 'order_items',
              column_name: 'category',
              column_type: 'text'
            });
          }
          if (checkError.message.includes('code')) {
            addLog("Adding 'code' column...");
            await supabase.rpc('add_column_if_not_exists', {
              table_name: 'order_items',
              column_name: 'code',
              column_type: 'text'
            });
          }
          if (checkError.message.includes('mattress_code')) {
            addLog("Adding 'mattress_code' column...");
            await supabase.rpc('add_column_if_not_exists', {
              table_name: 'order_items',
              column_name: 'mattress_code',
              column_type: 'text'
            });
          }
        } else {
          addLog("All necessary columns already exist.");
        }
      } catch (columnError: any) {
        addLog(`Error checking/adding columns: ${columnError.message || columnError}`);
        // Continue anyway, in case the columns actually exist
      }

      // Fetch all orders with items
      addLog("Fetching orders...");
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (!orders || orders.length === 0) {
        addLog("No orders found.");
        toast({
          title: 'No orders found',
          description: 'There are no orders to update.',
          variant: 'default',
        });
        setIsProcessing(false);
        return;
      }

      // Set total for progress tracking
      const total = orders.length;
      setTotalOrders(total);
      addLog(`Found ${total} orders to process.`);
      
      // Process orders in batches to avoid timeouts (10 at a time)
      const batchSize = 10;
      let processed = 0;
      let successCount = 0;
      
      for (let i = 0; i < orders.length; i += batchSize) {
        const batch = orders.slice(i, i + batchSize);
        addLog(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(orders.length/batchSize)}...`);
        
        // Process each order in the batch
        for (const order of batch) {
          try {
            const success = await updateOrderItemCodes(order.id);
            if (success) {
              successCount++;
            }
          } catch (orderError: any) {
            addLog(`Error updating order ${order.id}: ${orderError.message || orderError}`);
          }
          
          // Update progress
          processed++;
          setProcessedOrders(processed);
          setProgress(Math.floor((processed / total) * 100));
        }
      }

      addLog(`Processing complete. Successfully updated ${successCount} orders.`);
      toast({
        title: 'Update completed',
        description: `Successfully processed ${successCount} orders.`,
        variant: 'default',
      });
      
      setCompletedSuccessfully(true);
    } catch (error: any) {
      console.error('Error updating order codes:', error);
      addLog(`Fatal error: ${error.message || error}`);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update order codes',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Fix Order Item Codes</h2>
      <p className="text-sm text-muted-foreground">
        This utility updates all existing order items to ensure they have the correct product codes in the 'code' field. 
        All product codes (including mattress codes) will be consolidated into the single 'code' field for consistent display.
      </p>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Update Product Codes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            This process will scan through all orders and update their items with the correct product codes 
            from the product tables into a single 'code' field. This may take a few minutes to complete.
          </p>
          
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Processing orders ({processedOrders}/{totalOrders})</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
          
          {completedSuccessfully && !isProcessing && (
            <div className="rounded-md bg-green-50 p-4 mb-4">
              <div className="flex">
                <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                <span className="text-green-800">
                  Successfully updated product codes for {processedOrders} orders.
                </span>
              </div>
            </div>
          )}
          
          {logs.length > 0 && (
            <div className="mt-4 border rounded-md p-3 bg-slate-50 max-h-60 overflow-y-auto">
              <div className="flex items-center mb-2">
                <Info className="h-4 w-4 mr-2 text-slate-500" />
                <h3 className="text-sm font-medium">Process Logs</h3>
              </div>
              <div className="space-y-1 text-xs font-mono text-slate-700">
                {logs.map((log, i) => (
                  <div key={i} className="border-l-2 border-slate-300 pl-2 py-1">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <Button 
            onClick={handleUpdateCodes} 
            disabled={isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating Codes...
              </>
            ) : (
              'Update All Order Item Codes'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
} 