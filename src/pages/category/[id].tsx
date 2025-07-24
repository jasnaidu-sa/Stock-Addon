import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { supabaseAdmin } from '@/lib/supabase';
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
import { Product } from '@/types/product';

export function CategoryPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { toast } = useToast();
  const { dispatch } = useCart();
  
  // State variables
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includeBase, setIncludeBase] = useState<Record<string, boolean>>({});

  // Get category and table from location state or derive from URL
  const category = location.state?.category || { id: id, name: id?.charAt(0).toUpperCase() + id?.slice(1) || 'Products' };
  const table = location.state?.table || id || '';

  useEffect(() => {
    loadProducts();
  }, [id, table]);

  const loadProducts = async () => {
    if (!id) {
      setError('Category ID is missing.');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);

    if (!supabaseAdmin) {
      toast({
        title: 'Configuration Error',
        description: 'Admin database client is not available. Cannot load products.',
        variant: 'destructive',
      });
      setError('Admin database client is not available.');
      setLoading(false);
      return;
    }

    if (!table) {
      setError('Invalid category or missing table information');
      setLoading(false);
      return;
    }

    try {
      console.log(`Loading products from table: ${table}`);
      
      let query;
      if (table === 'mattress') {
        query = supabaseAdmin
          .from(table)
          .select('*')
          .order('mattress_code');
      } else {
        query = supabaseAdmin
          .from(table)
          .select('*')
          .order('code');
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading products:', error);
        setError(`Failed to load products: ${error.message}`);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      // Initialize quantities and includeBase objects for each product
      const initialQuantities: Record<string, number> = {};
      const initialIncludeBase: Record<string, boolean> = {};
      
      data.forEach(product => {
        initialQuantities[product.id] = 1;
        if (table === 'mattress') {
          initialIncludeBase[product.id] = true;
        } else {
          initialIncludeBase[product.id] = false;
        }
      });

      setProducts(data);
      setQuantities(initialQuantities);
      setIncludeBase(initialIncludeBase);
      setLoading(false);
    } catch (err) {
      console.error('Error in loadProducts:', err);
      setError('An unexpected error occurred while loading products.');
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

    const quantity = quantities[product.id] || 1;
    const isMattress = table === 'mattress';
    const baseIncluded = isMattress && includeBase[product.id];

    // Add mattress item
    dispatch({
      type: 'ADD_ITEM',
      payload: {
        id: product.id,
        name: product.description,
        price: Number(isMattress ? product.mattress_price : product.price || 0),
        code: (isMattress ? product.mattress_code : product.code) || product.id,
        category: table,
        product_type: table,
        quantity,
      },
    });

    // If it's a mattress and base is included, find and add the base
    if (isMattress && baseIncluded && product.base_code) {
      if (!supabaseAdmin) {
        toast({
          title: 'Database Error',
          description: 'Cannot connect to the database.',
          variant: 'destructive',
        });
        setAddingToCart(null);
        return;
      }

      const { data: baseData, error: baseError } = await supabaseAdmin
        .from('base')
        .select('*')
        .eq('code', product.base_code)
        .single();

      if (baseError || !baseData) {
        console.error('Error finding base:', baseError);
        toast({
          title: 'Error',
          description: `Could not find the corresponding base for ${product.description}.`,
          variant: 'destructive',
        });
      } else {
        dispatch({
          type: 'ADD_ITEM',
          payload: {
            id: baseData.id, // Use the actual base ID
            name: baseData.description,
            price: Number(baseData.price || 0),
            code: baseData.code,
            category: 'base',
            product_type: 'base',
            quantity,
          },
        });
      }
    }

    // Simulate adding to cart
    setTimeout(() => {
      setAddingToCart(null);
    }, 1000);

    toast({
      title: 'Added to Cart',
      description: `${quantity} x ${product.description} has been added to your cart.`,
    });
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
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{category?.name || 'Category'} Products</h2>
      </div>
      
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{category?.name || id}</h1>
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
                      className="w-[140px]"
                      onClick={() => addToCart(product)}
                      disabled={addingToCart === product.id}
                    >
                      {addingToCart === product.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <ShoppingCartIcon className="h-4 w-4 mr-2" />
                          Add to Cart
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
    </div>
  );
}