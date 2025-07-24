import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  Bed, 
  Sofa, 
  Package, 
  Box, 
  HomeIcon, 
  Download,
  X,
  Store
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CustomerSidebarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function CustomerSidebar({ open, setOpen }: CustomerSidebarProps) {
  const location = useLocation();

  const navigation = [
    {
      name: 'Dashboard',
      href: '/',
      icon: HomeIcon,
      current: location.pathname === '/',
    },
    {
      name: 'Mattresses',
      href: '/category/mattress',
      icon: Bed,
      current: location.pathname === '/category/mattress',
      state: { 
        category: { id: 'mattress', name: 'Mattresses' },
        table: 'mattress'
      }
    },
    {
      name: 'Furniture',
      href: '/category/furniture',
      icon: Sofa,
      current: location.pathname === '/category/furniture',
      state: {
        category: { id: 'furniture', name: 'Furniture' },
        table: 'furniture'
      }
    },
    {
      name: 'Accessories',
      href: '/category/accessories',
      icon: Package,
      current: location.pathname === '/category/accessories',
      state: {
        category: { id: 'accessories', name: 'Accessories' },
        table: 'accessories'
      }
    },
    {
      name: 'Foam',
      href: '/category/foam',
      icon: Box,
      current: location.pathname === '/category/foam',
      state: {
        category: { id: 'foam', name: 'Foam' },
        table: 'foam'
      }
    },
    {
      name: 'Export Orders',
      href: '/export-orders',
      icon: Download,
      current: location.pathname === '/export-orders',
    }
  ];

  return (
    <>
      {/* Desktop sidebar - Fixed position */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white dark:bg-gray-900 pt-5 pb-4 overflow-y-auto border-r border-gray-200 dark:border-gray-700 shadow-lg">
            {/* Logo */}
            <div className="flex items-center flex-shrink-0 px-4">
              <Store className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">
                The Bed Shop
              </span>
            </div>
            
            {/* Navigation */}
            <nav className="mt-8 flex-1 flex flex-col divide-y divide-gray-200 dark:divide-gray-700 overflow-y-auto">
              <div className="px-2 space-y-1">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    state={item.state}
                    className={cn(
                      item.current
                        ? 'bg-blue-50 dark:bg-blue-900/50 border-r-4 border-blue-600 text-blue-700 dark:text-blue-300 shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-blue-50/50 dark:hover:bg-gray-800 hover:text-blue-700 dark:hover:text-blue-300 hover:translate-x-1',
                      'group flex items-center px-3 py-3 text-sm font-medium rounded-l-md transition-all duration-200 hover:shadow-sm'
                    )}
                  >
                    <item.icon
                      className={cn(
                        item.current
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 group-hover:scale-110',
                        'mr-3 flex-shrink-0 h-5 w-5 transition-all duration-200'
                      )}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                ))}
              </div>
            </nav>

            {/* Footer */}
            <div className="flex-shrink-0 flex border-t border-gray-200 dark:border-gray-700 p-4">
              <div className="flex-shrink-0 group block">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Customer Portal
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Mobile sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 overflow-y-auto transition duration-300 transform lg:hidden shadow-xl",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between flex-shrink-0 px-4 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Store className="h-8 w-8 text-blue-600" />
            <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">
              The Bed Shop
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>
        
        <nav className="mt-4 flex-1 flex flex-col divide-y divide-gray-200 dark:divide-gray-700">
          <div className="px-2 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                state={item.state}
                onClick={() => setOpen(false)}
                className={cn(
                  item.current
                    ? 'bg-blue-50 dark:bg-blue-900/50 border-r-4 border-blue-600 text-blue-700 dark:text-blue-300 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-blue-50/50 dark:hover:bg-gray-800 hover:text-blue-700 dark:hover:text-blue-300 hover:translate-x-1',
                  'group flex items-center px-3 py-3 text-sm font-medium rounded-l-md transition-all duration-200 hover:shadow-sm'
                )}
              >
                <item.icon
                  className={cn(
                    item.current
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 group-hover:scale-110',
                    'mr-3 flex-shrink-0 h-5 w-5 transition-all duration-200'
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </>
  );
}