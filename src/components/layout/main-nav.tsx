import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useLocation } from 'react-router-dom';
import { Bed, Sofa, Package, Box, HomeIcon, Settings, Download, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { useClerk, useUser } from '@clerk/clerk-react';

export function MainNav() {
  const supabase = getSupabaseClient();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const { isSignedIn } = useUser();
  const { user } = useClerk();

  // Check if current user is admin or manager using Clerk user ID
  useEffect(() => {
    const checkUserRoles = async () => {
      if (isSignedIn && user && supabase) {
        const clerkUserId = user.id;
        
        // Query Supabase for admin role using clerk_id
        const { data: userData } = await supabase
          .from('users')
          .select('role, id')
          .eq('clerk_id', clerkUserId)
          .single();
        
        setIsAdmin(userData?.role === 'admin');
        
        // Check if user is a manager in the hierarchy
        if (userData?.id) {
          const { data: hierarchyData } = await supabase
            .from('store_management_hierarchy')
            .select('store_manager_id, area_manager_id, regional_manager_id')
            .or(`store_manager_id.eq.${userData.id},area_manager_id.eq.${userData.id},regional_manager_id.eq.${userData.id}`)
            .limit(1);
          
          setIsManager(hierarchyData && hierarchyData.length > 0);
        }
      }
    };
    
    checkUserRoles();
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
      href: '/weekly-plan',
      label: 'Weekly Plan',
      icon: Calendar,
      active: location.pathname === '/weekly-plan' || location.pathname.startsWith('/weekly-plan/'),
      managerOnly: true
    },
    {
      href: '/export-orders',
      label: 'Export Orders',
      icon: Download,
      active: location.pathname === '/export-orders',
      adminOnly: false
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
        .filter(route => {
          if (route.href === '/admin') return isAdmin;
          if (route.href === '/export-orders') return !isAdmin;
          if (route.managerOnly) return isManager;
          return true;
        })
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