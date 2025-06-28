import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';;
import { useToast } from '@/hooks/use-toast';
import { useCart } from '@/components/cart/cart-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import { Loader2, MinusIcon, PlusIcon, ShoppingCartIcon } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { Product } from '@/types/product';

export default function MattressPage() {
  
    const supabase = getSupabaseClient();
  const [mattresses, setMattresses] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [includeBase, setIncludeBase] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const { dispatch } = useCart();

  useEffect(() => {
    loadMattresses();
  }, []);

  const loadMattresses = async () => {
    if (!supabase) {
      toast({
        title: 'Error',
        description: 'Database connection not available.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }
    try {
      // Try a different approach without quoted table names
      console.log('Fetching mattresses...');
      
      // Use the table name directly without quotes  
      const { data, error } = await supabase
        .from('mattress')
        .select('*')
        .order('mattress_code')
        .throwOnError(); // Added to throw error immediately if any
          
      if (error) {
        console.error('Error fetching mattresses:', error);
        throw error;
      }
      
      console.log('Mattresses loaded successfully:', data?.length || 0);
      
      // If we need base data, fetch it separately
      let mattressesWithBases = [...(data || [])]; 
      
      // Get unique base codes from mattresses
      const baseCodes = [...new Set(data?.map((m: any) => m.base_code).filter(Boolean) || [])];
      
      if (baseCodes.length > 0) {
        console.log('Fetching bases for codes:', baseCodes);
        try {
          // Use the base table directly
          const { data: baseData, error: baseError } = await supabase
            .from('base')
            .select('id, code, description, price')
            .in('code', baseCodes)
            .throwOnError(); // Added to throw error immediately if any
            
          if (baseError) throw baseError;
          
          console.log('Bases loaded successfully:', baseData?.length || 0);
          
          // Add base details to each mattress
          mattressesWithBases = mattressesWithBases.map(mattress => {
            const baseInfo = baseData.find((b: any) => b.code === mattress.base_code);
            return {
              ...mattress,
              base: baseInfo ? {
                id: baseInfo.id, // Ensure the base's own ID is stored
                code: baseInfo.code,
                description: baseInfo.description,
                price: baseInfo.price,
              } : null
            };
          });
        }
        catch (baseError) {
          console.error('Error fetching bases:', baseError);
        }
      }
      
      setMattresses(mattressesWithBases);
      
      // Initialize quantities and includeBase states
      const initialQuantities: Record<string, number> = {};
      const initialIncludeBase: Record<string, boolean> = {};
      mattressesWithBases.forEach((product) => {
        initialQuantities[product.id] = 1;
        initialIncludeBase[product.id] = true;
      });
      setQuantities(initialQuantities);
      setIncludeBase(initialIncludeBase);
    } catch (error) {
      console.error('Failed to load mattresses:', error);
      toast({
        title: 'Error',
        description: 'Failed to load mattresses. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [productId]: Math.max(1, (prev[productId] || 1) + delta),
    }));
  };

  const addToCart = async (product: Product) => {
    setAddingToCart(product.id);
    try {
      const quantity = quantities[product.id] || 1;
      const shouldIncludeBase = includeBase[product.id];
      const price = includeBase[product.id] ? Number(product.set_price || 0) : Number(product.mattress_price || 0);
      const name = product.description;
      const code = product.mattress_code || '';

      const cartItem = {
        id: shouldIncludeBase ? `${product.id}_set` : product.id, // Ensure unique ID if base is included vs not
        quantity,
        price, // This is the price for the mattress, or mattress + base if 'set_price' is used
        name,
        code: code || product.id, // Fallback to product.id if mattress_code is missing
        category: 'mattress' as const, // Explicitly 'mattress' for items from this page. Consider if product_type makes this redundant.
        product_type: 'mattress' as const, // Set product_type based on the source (mattresses page)
        base: shouldIncludeBase && product.base ? product.base : undefined, // Include the base object if selected and available
      };

      dispatch({
        type: 'ADD_ITEM',
        payload: cartItem,
      });

      toast({
        title: 'Added to Cart',
        description: `${name} ${shouldIncludeBase ? '(with base)' : ''} (×${quantity}) has been added to your cart`,
      });
    } catch (error) {
      console.error('Failed to add to cart:', error);
      toast({
        title: 'Error',
        description: 'Failed to add item to cart',
        variant: 'destructive',
      });
    } finally {
      setAddingToCart(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Mattresses</h1>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mattress Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Size</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Include Base</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mattresses.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">
                  {product.mattress_code}
                </TableCell>
                <TableCell>{product.description}</TableCell>
                <TableCell>{product.size}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(
                    includeBase[product.id]
                      ? Number(product.set_price || 0)
                      : Number(product.mattress_price || 0)
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`include-base-${product.id}`}
                      checked={includeBase[product.id]}
                      onCheckedChange={(checked) => {
                        setIncludeBase(prev => ({
                          ...prev,
                          [product.id]: checked as boolean
                        }));
                      }}
                    />
                    <Label htmlFor={`include-base-${product.id}`}>Add Base</Label>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 w-32">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateQuantity(product.id, -1)}
                    >
                      <MinusIcon className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      value={quantities[product.id] || 1}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (!isNaN(value) && value >= 1) {
                          setQuantities((prev) => ({
                            ...prev,
                            [product.id]: value,
                          }));
                        }
                      }}
                      className="w-14 text-center"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateQuantity(product.id, 1)}
                    >
                      <PlusIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-[110px]"
                    onClick={() => addToCart(product)}
                    disabled={addingToCart === product.id}
                  >
                    {addingToCart === product.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <ShoppingCartIcon className="h-4 w-4 mr-2" />
                        Add
                      </>
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
} 