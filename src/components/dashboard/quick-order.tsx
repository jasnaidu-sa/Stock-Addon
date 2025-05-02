import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Bed, Sofa, Package, Box } from 'lucide-react';

const categories = [
  {
    id: 'mattress',
    name: 'Mattresses',
    icon: Bed,
    description: 'Browse our selection of quality mattresses',
    table: 'mattress',
    href: '/category/mattress'
  },
  {
    id: 'furniture',
    name: 'Furniture',
    icon: Sofa,
    description: 'Explore our furniture collection',
    table: 'furniture',
  },
  {
    id: 'accessories',
    name: 'Accessories',
    icon: Package,
    description: 'Find the perfect accessories',
    table: 'accessories',
  },
  {
    id: 'foam',
    name: 'Foam',
    icon: Box,
    description: 'Custom foam solutions',
    table: 'foam',
  },
] as const;

export function QuickOrder() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const handleCategoryClick = async (category: typeof categories[number]) => {
    setLoading(category.id);
    try {
      navigate(`/category/${category.id}`, {
        state: { category, table: category.table },
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load category',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {categories.map((category) => (
        <Card key={category.id} className="relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-lg">
              <category.icon className="mr-2 h-5 w-5" />
              {category.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {category.description}
            </p>
            <Button
              className="w-full"
              onClick={() => handleCategoryClick(category)}
              disabled={loading === category.id}
            >
              Browse Products
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}