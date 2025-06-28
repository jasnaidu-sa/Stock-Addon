import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useLocation } from 'react-router-dom';
import { Bed, Sofa, Package, Box, HomeIcon, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { useClerk, useUser } from '@clerk/clerk-react';

export function MainNav() {
  const supabase = getSupabaseClient();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const { isSignedIn } = useUser();
  const { user } = useClerk();

  // Check if current user is admin using Clerk user ID
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (isSignedIn && user && supabase) {
        const clerkUserId = user.id;
        
        // Query Supabase for admin role using clerk_id
        const { data } = await supabase
          .from('users')
          .select('role')
          .eq('clerk_id', clerkUserId)
          .single();
        
        setIsAdmin(data?.role === 'admin');
      }
    };
    
    checkAdminStatus();
  }, [isSignedIn, user, supabase]);

  const categories = [
    {
      href: '/category/mattress',
      label: 'Mattresses',
      icon: Bed,
      active: location.pathname === '/category/mattress',
      state: { 
        category: { id: 'mattress', name: 'Mattresses' },
        table: 'mattress'
      }
    },
    {
      href: '/category/furniture',
      label: 'Furniture',
      icon: Sofa,
      active: location.pathname === '/category/furniture',
      state: {
        category: { id: 'furniture', name: 'Furniture' },
        table: 'furniture'
      }
    },
    {
      href: '/category/accessories',
      label: 'Accessories',
      icon: Package,
      active: location.pathname === '/category/accessories',
      state: {
        category: { id: 'accessories', name: 'Accessories' },
        table: 'accessories'
      }
    },
    {
      href: '/category/foam',
      label: 'Foam',
      icon: Box,
      active: location.pathname === '/category/foam',
      state: {
        category: { id: 'foam', name: 'Foam' },
        table: 'foam'
      }
    },
    {
      href: '/',
      label: 'Dashboard',
      icon: HomeIcon,
      active: location.pathname === '/',
    },
    {
      href: '/admin',
      label: 'Admin',
      icon: Settings,
      active: location.pathname === '/admin' || location.pathname.startsWith('/admin/'),
    }
  ];

  return (
    <nav className="flex items-center space-x-4 lg:space-x-6">
      {categories
        .filter(route => route.href !== '/admin' || isAdmin)
        .map((route) => (
          <Button
            key={route.href}
            variant={route.active ? 'default' : 'ghost'}
            asChild
          >
            <Link
              to={route.href}
              state={route.state}
              className={cn(
                'flex items-center text-sm font-medium transition-colors hover:text-primary',
                route.active
                  ? 'text-black dark:text-primary-foreground'
                  : 'text-muted-foreground'
              )}
            >
              <route.icon className="mr-2 h-4 w-4" />
              {route.label}
            </Link>
          </Button>
        ))}
    </nav>
  );
}