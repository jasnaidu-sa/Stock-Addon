import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getSupabaseClient } from '@/lib/supabase';;
import { fetchBaseInfoByCode } from "@/lib/product-utils";
import { Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Define the structure of a base item
interface BaseOrderItem {
  id: string;
  order_id: string;
  product_name: string;
  stock_item_id?: string;
  code?: string;
}

export default function FixBaseCodesPage() {
  
  const supabase = getSupabaseClient(); // Initialize Supabase clientconst [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [baseItems, setBaseItems] = useState<BaseOrderItem[]>([]);
  const [diagnosticResult, setDiagnosticResult] = useState<string | null>(null);

  // Step 1: Fetch all base items that need fixing
  async function fetchBaseItems() {
    setIsProcessing(true);
    setProgress(5);
    
    try {
      // Get all order items where product_name starts with "Base:"
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .ilike('product_name', 'Base:%');
      
      if (error) {
        throw error;
      }
      
      // Filter for items that might have incorrect codes
      const baseItems = data.filter((item: any) => 
        item.product_name.startsWith('Base:')
      );
      
      setBaseItems(baseItems);
      setTotalCount(baseItems.length);
      
      toast.success(`Found ${baseItems.length} base items to process`);
      setProgress(10);
      
      return baseItems;
    } catch (error) {
      console.error("Error fetching base items:", error);
      toast.error("Failed to fetch base items");
      setIsProcessing(false);
      return [];
    }
  }

  // Step 2: Process the base items and fix their codes
  async function processBaseItems(items: BaseOrderItem[]) {
    try {
      let processed = 0;
      
      // Process in batches to avoid timeouts
      const batchSize = 10;
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        
        // Process each item in the batch
        await Promise.all(batch.map(async (item) => {
          try {
            // Extract base code from item name
            const baseMatch = item.product_name.match(/^Base:\s+([A-Z0-9]+-[A-Z0-9]+)/);
            if (!baseMatch) {
              console.log(`No base code found in product name: ${item.product_name}`);
              return;
            }
            
            const baseCode = baseMatch[1];
            
            // Look up the correct base information
            const baseInfo = await fetchBaseInfoByCode(baseCode);
            if (!baseInfo) {
              console.log(`Base not found with code: ${baseCode}`);
              return;
            }
            
            // Update the order item with correct information
            const { error } = await supabase
              .from('order_items')
              .update({
                stock_item_id: baseInfo.id,
                code: baseInfo.code
              })
              .eq('id', item.id);
              
            if (error) {
              console.error(`Error updating base item ${item.id}:`, error);
              return;
            }
            
            processed++;
          } catch (error) {
            console.error(`Error processing base item ${item.id}:`, error);
          }
        }));
        
        // Update progress
        setProcessedCount(processed);
        setProgress(10 + Math.floor((processed / items.length) * 90));
      }
      
      toast.success(`Successfully updated ${processed} base items`);
      return processed;
    } catch (error) {
      console.error("Error processing base items:", error);
      toast.error("Error while processing base items");
      return 0;
    } finally {
      setIsProcessing(false);
    }
  }

  // Main handler for the fix process
  async function handleFixBaseCodes() {
    if (isProcessing) return;
    
    try {
      setProgress(0);
      setProcessedCount(0);
      
      const items = await fetchBaseItems();
      if (items.length === 0) {
        setIsProcessing(false);
        return;
      }
      
      await processBaseItems(items);
    } catch (error) {
      console.error("Error fixing base codes:", error);
      toast.error("An error occurred while fixing base codes");
    } finally {
      setIsProcessing(false);
    }
  }

  // Function to diagnose specific stock item issues
  async function handleDiagnoseSpecificItem() {
    setDiagnosticResult("Running diagnostic...");
    
    try {
      // Check the specific item mentioned by the user
      const stockItemId = "0e5e5039-d1fa-40ee-ac7d-5fa71ee2b20f";
      
      // 1. First check the order_items table
      const { data: orderItem, error: orderItemError } = await supabase
        .from('order_items')
        .select('*')
        .eq('stock_item_id', stockItemId)
        .single();
        
      if (orderItemError) {
        throw new Error(`Error fetching order item: ${orderItemError.message}`);
      }
      
      if (!orderItem) {
        setDiagnosticResult(`No order item found with stock_item_id: ${stockItemId}`);
        return;
      }
      
      // 2. Check the mattress table (in case it's a mattress)
      const { data: mattressData, error: mattressError } = await supabase
        .from('mattress')
        .select('*')
        .eq('id', stockItemId)
        .single();
      
      // 3. Check the base table
      const { data: baseData, error: baseError } = await supabase
        .from('base')
        .select('*')
        .eq('id', stockItemId)
        .single();
      
      // 4. Try to get the correct base from the product name
      let baseCodeFromName = null;
      let correctBaseItem = null;
      
      if (orderItem.product_name && orderItem.product_name.startsWith('Base:')) {
        const baseMatch = orderItem.product_name.match(/^Base:\s+([A-Z0-9]+-[A-Z0-9]+)/);
        if (baseMatch) {
          baseCodeFromName = baseMatch[1];
          
          // Look up the correct base by code
          const { data: correctBase } = await supabase
            .from('base')
            .select('*')
            .eq('code', baseCodeFromName)
            .single();
            
          correctBaseItem = correctBase;
        }
      }
      
      // Build diagnostic results
      let result = `
### Diagnostic Results for Stock Item ID: ${stockItemId}

#### Order Item Details
- ID: ${orderItem.id}
- Order ID: ${orderItem.order_id}
- Product Name: ${orderItem.product_name}
- Stock Item ID: ${orderItem.stock_item_id}
- Code in Database: ${orderItem.code || 'Not set'}
- Mattress Code (TypeScript only): ${orderItem.mattress_code || 'Not set'}
- Category (TypeScript only): ${orderItem.category || 'Not set'}

#### Problem Analysis
`;

      if (mattressData) {
        result += `
#### Mattress Record Found
- Description: ${mattressData.description}
- Mattress Code: ${mattressData.mattress_code}
- Base Code: ${mattressData.base_code || 'Not set'}

This appears to be a mattress record, but the order item is for a base.
The system likely used the mattress's stock ID incorrectly for the base.
`;
      } else if (baseData) {
        result += `
#### Base Record Found
- Description: ${baseData.description}
- Code: ${baseData.code}

The order item is correctly using a base stock ID, but there might be issues with the code value.
`;
      } else {
        result += `
No matching record found in either mattress or base tables with this stock_item_id.
This indicates a data integrity issue.
`;
      }

      if (baseCodeFromName && correctBaseItem) {
        result += `
#### Correct Base Found
- ID: ${correctBaseItem.id}
- Description: ${correctBaseItem.description}
- Code: ${correctBaseItem.code}

This is the correct base that should be linked to this order item based on its name.
The stock_item_id should be updated to point to this base instead.
`;
      } else if (baseCodeFromName) {
        result += `
Base code "${baseCodeFromName}" extracted from product name, but no matching base found in the database.
`;
      }

      result += `
#### Resolution
The "Fix Base Codes" function will:
1. Extract the correct base code from the product name ("${baseCodeFromName || 'Not found'}")
2. Find the correct base record in the database
3. Update the order item with the correct stock_item_id and code
`;

      setDiagnosticResult(result);
      
    } catch (error: any) {
      console.error("Diagnostic error:", error);
      setDiagnosticResult(`Error running diagnostic: ${error.message}`);
    }
  }

  return (
    <div className="container mx-auto py-10 space-y-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Fix Base Product Codes</CardTitle>
          <CardDescription>
            This utility will update all base products in your orders with the correct product codes and stock item IDs.
            Use this if base products are showing incorrect codes in the admin dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button 
              onClick={handleFixBaseCodes} 
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Fix Base Product Codes"
              )}
            </Button>
            
            {isProcessing && (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Progress</span>
                  <span>{processedCount} of {totalCount} items</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Diagnose Specific Item</CardTitle>
          <CardDescription>
            Run a diagnostic on the specific item mentioned in the issue (ID: 0e5e5039-d1fa-40ee-ac7d-5fa71ee2b20f).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button 
              onClick={handleDiagnoseSpecificItem} 
              className="w-full"
              variant="outline"
            >
              <Search className="mr-2 h-4 w-4" />
              Run Diagnostic
            </Button>
            
            {diagnosticResult && (
              <div className="bg-muted p-4 rounded-md whitespace-pre-line">
                {diagnosticResult}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 