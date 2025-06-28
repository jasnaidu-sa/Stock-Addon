import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { getSupabaseClient, supabaseAdmin } from '@/lib/supabase';
import { useAuth, useUser } from '@clerk/clerk-react';
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
  const supabase = getSupabaseClient(); // Initialize Supabase client with Clerk auth
  // const { userId, isSignedIn } = useUser(); // Not currently used
  // const { getToken } = useAuth(); // Not currently used
  const { id } = useParams();
  const location = useLocation();
  const { toast } = useToast();
  const { dispatch } = useCart();
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
        
        // Products need to be visible to all customers, so we use supabaseAdmin just for product catalog viewing
        // This approach is appropriate for product catalog data that should be visible to all authenticated users
        // Note: For user-specific data we would still use the authenticated client
        let query;
        if (table === 'mattress') {
          // Use supabaseAdmin for mattress data to bypass RLS for catalog viewing
          query = supabaseAdmin
            .from(table)
            .select('*')
            .order('mattress_code');
            
          console.log('Using supabaseAdmin for mattress products (catalog data)');
        } else {
          // Use supabaseAdmin for other product tables to bypass RLS for catalog viewing
          query = supabaseAdmin
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
        
        // If we're working with mattress data and need base information,
        // we can fetch it in a separate query if needed
        if (table === 'mattress' && data && data.length > 0 && data[0].base_code) {
          // Extract all base_code values
          const baseCodes = data.map(item => item.base_code).filter(code => !!code);
          
          if (baseCodes.length > 0) {
            // supabaseAdmin null check is already performed at the beginning of loadProducts
            const { data: baseData, error: baseError } = await supabaseAdmin
              .from('base')
              .select('*')
              .in('code', baseCodes); // Match against 'code' column in 'base' table
              
            if (!baseError && baseData) {
              // Manually join the data
              data.forEach(mattress => {
                if (mattress.base_code) {
                  const matchingBase = baseData.find(base => base.code === mattress.base_code); // Match base.code with mattress.base_code
                  if (matchingBase) {
                    mattress.base = matchingBase;
                  }
                }
              });
            } else {
              console.warn('Could not fetch base data:', baseError);
            }
          }
        }
        
        console.log(`Products loaded: ${data?.length || 0}`);
        setProducts(data || []);
        
        const initialQuantities: Record<string, number> = {};
        const initialIncludeBase: Record<string, boolean> = {};
        data?.forEach((product) => {
          initialQuantities[product.id] = 1;
          // Set include base to true by default for mattresses
          initialIncludeBase[product.id] = table === 'mattress' ? true : false;
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
    const quantity = quantities[product.id] || 1;
    const shouldIncludeBase = table === 'mattress' && includeBase[product.id] && product.base;

    let itemPricePerUnit: number;
    let itemCategory: ProductCategory = category as ProductCategory;
    let itemProductType: ProductCategory | undefined = category as ProductCategory;
    let itemBase: Product['base'] | undefined = undefined; // Type from Product interface
    let itemName = product.description;
    let itemCode = product.code || '';

    if (table === 'mattress') {
      itemPricePerUnit = Number(product.mattress_price || 0); // Mattress-only price
      itemCategory = 'mattress';
      itemProductType = 'mattress';
      itemCode = product.mattress_code || '';

      if (shouldIncludeBase && product.base) {
        itemBase = product.base; // Attach the full base object
        // itemName = `${product.description} (Mattress)`; // Optional: Clarify item name
      }
    } else {
      itemPricePerUnit = Number(product.price || 0);
      // itemProductType is already defaulted to category for non-mattress items
    }

    const cartItemPayload = {
      id: product.id,
      stock_item_id: product.stock_item_id,
      name: itemName,
      code: itemCode,
      price: itemPricePerUnit, // Price per unit for this specific item (mattress or other)
      quantity: quantity,
      image_url: product.image_url,
      category: itemCategory,
      product_type: itemProductType,
      base: itemBase, // This will be undefined for non-mattress items or if base not included
    };

    dispatch({
      type: 'ADD_ITEM',
      payload: cartItemPayload,
    });

    toast({
      title: 'Item added to cart',
      description: `${itemName} (Qty: ${quantity}) has been added.`,
    });

    setAddingToCart(null);
    setQuantities(prev => ({ ...prev, [product.id]: 1 }));
    if (table === 'mattress') {
      setIncludeBase(prev => ({ ...prev, [product.id]: false }));
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