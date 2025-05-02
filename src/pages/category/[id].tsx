import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
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
import { Product, ProductCategory } from '@/types/product';

export function CategoryPage() {
  const { id } = useParams();
  const location = useLocation();
  const { toast } = useToast();
  const { state: cartState, dispatch } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includeBase, setIncludeBase] = useState<Record<string, boolean>>({});

  // Get category and table from location state
  const category = location.state?.category;
  const table = location.state?.table;

  console.log("Category page mounted with id:", id);
  console.log("Location state:", location.state);
  console.log("Using table:", table);

  useEffect(() => {
    async function loadProducts() {
      if (!table) {
        setError('Invalid category or missing table information');
        setLoading(false);
        return;
      }

      try {
        console.log(`Loading products from table: ${table}`);
        
        let query;
        if (table === 'mattress') {
          query = supabase
            .from(table)
            .select(`
              *,
              base:base(
                base_code,
                description,
                price
              )
            `)
            .order('mattress_code');
        } else {
          query = supabase
            .from(table)
            .select('*')
            .order('code');
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error loading products:', error);
          setError(`Failed to load products: ${error.message}`);
          throw error;
        }
        
        console.log(`Products loaded: ${data?.length || 0}`);
        setProducts(data || []);
        
        const initialQuantities: Record<string, number> = {};
        const initialIncludeBase: Record<string, boolean> = {};
        data?.forEach((product) => {
          initialQuantities[product.id] = 1;
          initialIncludeBase[product.id] = false;
        });
        setQuantities(initialQuantities);
        setIncludeBase(initialIncludeBase);
      } catch (error) {
        console.error('Error loading products:', error);
        setError(error instanceof Error ? error.message : 'Failed to load products');
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to load products',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, [table, toast]);

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
      const shouldIncludeBase = table === 'mattress' && includeBase[product.id];
      
      // Add mattress to cart
      dispatch({
        type: 'ADD_ITEM',
        payload: {
          id: product.id,
          quantity,
          price: Number(product.mattress_price) || Number(product.price) || 0,
          name: product.description,
          code: product.mattress_code || product.code || '',
          category: id as ProductCategory,
        },
      });

      // If base is included, add it using the base data from the joined query
      if (shouldIncludeBase && product.base) {
        dispatch({
          type: 'ADD_ITEM',
          payload: {
            id: `${product.id}_base`,
            quantity,
            price: product.base.price,
            name: `Base: ${product.base.description}`,
            code: product.base.base_code,
            category: 'base' as ProductCategory,
          },
        });
      }

      toast({
        title: 'Added to cart',
        description: `${product.description} ${shouldIncludeBase ? '(with base)' : ''} (×${quantity}) has been added to your cart`,
      });
    } catch (error) {
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

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-4">
        <h2 className="text-2xl font-bold text-destructive mb-4">Error</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => window.history.back()}>Go Back</Button>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-4">
        <h2 className="text-2xl font-bold mb-4">No Products Found</h2>
        <p className="text-muted-foreground mb-6">There are no products available in this category.</p>
        <Button onClick={() => window.history.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{category?.name || id}</h1>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{table === 'mattress' ? 'Mattress Code' : 'Code'}</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Size</TableHead>
              <TableHead className="text-right">Price</TableHead>
              {table === 'mattress' && <TableHead>Include Base</TableHead>}
              <TableHead>Quantity</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">
                  {table === 'mattress' ? product.mattress_code : product.code}
                </TableCell>
                <TableCell>{product.description}</TableCell>
                <TableCell>{product.size}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(
                    table === 'mattress'
                      ? (includeBase[product.id]
                          ? Number(product.set_price || 0)
                          : Number(product.mattress_price || 0))
                      : Number(product.price || 0)
                  )}
                </TableCell>
                {table === 'mattress' && (
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
                )}
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