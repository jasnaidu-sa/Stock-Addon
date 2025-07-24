import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
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
      const { data, error } = await supabase
        .from('mattress')
        .select('*')
        .order('mattress_code');

      if (error) {
        throw error;
      }

      setMattresses(data || []);

      const initialQuantities: Record<string, number> = {};
      const initialIncludeBase: Record<string, boolean> = {};
      (data || []).forEach((product) => {
        initialQuantities[product.id] = 1;
        initialIncludeBase[product.id] = true; // Default to true for all
      });
      setQuantities(initialQuantities);
      setIncludeBase(initialIncludeBase);
    } catch (error) {
      console.error('Failed to load mattresses:', error);
      toast({
        title: 'Error',
        description: 'Could not load mattresses.',
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
    if (!supabase) return;
    setAddingToCart(product.id);
    try {
      const quantity = quantities[product.id] || 1;
      const shouldIncludeBase = includeBase[product.id];

      // Add mattress to cart first
      dispatch({
        type: 'ADD_ITEM',
        payload: {
          id: product.id,
          quantity,
          price: product.mattress_price ?? 0,
          name: product.description,
          code: product.mattress_code || product.id,
          category: 'mattress',
          product_type: 'mattress',
        },
      });

      // If base is included, find it and add it as a separate item
      if (shouldIncludeBase && product.base_code) {
        const { data: baseProduct, error: baseError } = await supabase
          .from('base')
          .select('*')
          .eq('code', product.base_code)
          .single();

        if (baseError) {
          throw new Error(
            `Could not find base for ${product.description}: ${baseError.message}`
          );
        }

        if (baseProduct) {
          dispatch({
            type: 'ADD_ITEM',
            payload: {
              id: `${product.id}_base`, // Synthetic ID for the base
              quantity,
              price: baseProduct.price ?? 0,
              name: `Base for ${product.description}`,
              code: baseProduct.code || baseProduct.id,
              category: 'base',
              product_type: 'base',
              mattress_id: product.id, // Link to parent mattress
            },
          });
        }
      }

      toast({
        title: 'Added to cart',
        description: `${product.description} has been added to your cart.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message || 'There was a problem adding the item to the cart.',
        variant: 'destructive',
      });
    } finally {
      setAddingToCart(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
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
                  {formatCurrency(Number(product.mattress_price || 0))}
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`include-base-${product.id}`}
                      checked={includeBase[product.id]}
                      disabled={!product.base_code}
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