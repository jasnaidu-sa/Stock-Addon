import { Fragment, useState } from 'react';
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
  ShieldCheck,
  Users,
  Calendar,
  Database,
  ChevronDown,
  ChevronRight,
  TestTube,
  TrendingUp,
  Upload,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserStoreUpload } from '@/components/admin/user-store-upload';
import { CategoryDataUpload } from '@/components/admin/category-data-upload';
import { WeeklyPlanUpload } from '@/components/admin/weekly-plan-upload';

interface AdminSidebarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

type UploadType = 'user-store' | 'category-data' | 'weekly-plan' | null;

interface MenuItemBase {
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MenuItemWithHref extends MenuItemBase {
  href: string;
  onClick?: never;
}

interface MenuItemWithClick extends MenuItemBase {
  onClick: () => void;
  href?: never;
}

type MenuItem = MenuItemWithHref | MenuItemWithClick;

export function AdminSidebar({ open, setOpen }: AdminSidebarProps) {
  const location = useLocation();
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const [testMenuOpen, setTestMenuOpen] = useState(false);
  const [weeklyPlanMenuOpen, setWeeklyPlanMenuOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [activeUploadType, setActiveUploadType] = useState<UploadType>(null);

  const openUploadDialog = (type: UploadType) => {
    setActiveUploadType(type);
    setUploadDialogOpen(true);
    setOpen(false); // Close mobile sidebar
  };

  const closeUploadDialog = () => {
    setUploadDialogOpen(false);
    setActiveUploadType(null);
  };

  const toggleUploadMenu = () => {
    setUploadMenuOpen(!uploadMenuOpen);
  };

  const toggleWeeklyPlanMenu = () => {
    setWeeklyPlanMenuOpen(!weeklyPlanMenuOpen);
  };

  const getUploadDialogTitle = () => {
    switch (activeUploadType) {
      case 'user-store':
        return 'User-Store Assignment Upload';
      case 'category-data':
        return 'Category Data Upload';
      case 'weekly-plan':
        return 'Weekly Plan Upload';
      default:
        return 'Data Upload';
    }
  };

  const renderUploadComponent = () => {
    switch (activeUploadType) {
      case 'user-store':
        return <UserStoreUpload />;
      case 'category-data':
        return <CategoryDataUpload />;
      case 'weekly-plan':
        return <WeeklyPlanUpload />;
      default:
        return null;
    }
  };

  const navigation = [
    {
      name: 'Dashboard',
      href: '/admin',
      icon: HomeIcon,
      current: location.pathname === '/admin' || location.pathname === '/admin/orders',
    },
    {
      name: 'Mattresses',
      href: '/admin/category/mattress',
      icon: Bed,
      current: location.pathname === '/admin/category/mattress',
      state: { 
        category: { id: 'mattress', name: 'Mattresses' },
        table: 'mattress'
      }
    },
    {
      name: 'Furniture',
      href: '/admin/category/furniture',
      icon: Sofa,
      current: location.pathname === '/admin/category/furniture',
      state: {
        category: { id: 'furniture', name: 'Furniture' },
        table: 'furniture'
      }
    },
    {
      name: 'Accessories',
      href: '/admin/category/accessories',
      icon: Package,
      current: location.pathname === '/admin/category/accessories',
      state: {
        category: { id: 'accessories', name: 'Accessories' },
        table: 'accessories'
      }
    },
    {
      name: 'Foam',
      href: '/admin/category/foam',
      icon: Box,
      current: location.pathname === '/admin/category/foam',
      state: {
        category: { id: 'foam', name: 'Foam' },
        table: 'foam'
      }
    },
    {
      name: 'User Management',
      href: '/admin/user-management',
      icon: Users,
      current: location.pathname === '/admin/user-management',
    },
    {
      name: 'Export Orders',
      href: '/admin/export-orders',
      icon: Download,
      current: location.pathname === '/admin/export-orders',
    },
    {
      name: 'Weekly Plan',
      href: '#',
      icon: Calendar,
      current: false,
      hasSubmenu: true,
      onClick: toggleWeeklyPlanMenu,
    },
    {
      name: 'Hierarchy Management',
      href: '/admin/hierarchy',
      icon: Users,
      current: location.pathname === '/admin/hierarchy',
    },
    {
      name: 'Data Upload',
      href: '#',
      icon: Database,
      current: false,
      hasSubmenu: true,
      onClick: toggleUploadMenu,
    },
    {
      name: 'Test Interfaces',
      href: '#',
      icon: TestTube,
      current: false,
      hasSubmenu: true,
      onClick: () => setTestMenuOpen(!testMenuOpen),
    }
  ];

  const uploadSubMenuItems = [
    {
      name: 'Category Data',
      description: 'Product codes & prices',
      icon: Package,
      onClick: () => openUploadDialog('category-data'),
    },
    {
      name: 'Weekly Plan Data',
      description: 'Store order proposals',
      icon: Calendar,
      onClick: () => openUploadDialog('weekly-plan'),
    },
  ];

  const weeklyPlanSubMenuItems: MenuItem[] = [
    {
      name: 'Weekly Plan Upload',
      description: 'Upload weekly plan files',
      icon: Upload,
      href: '/admin/weekly-plan',
    },
    {
      name: 'User-Store Assignments',
      description: 'Link users to stores',
      icon: Users,
      onClick: () => openUploadDialog('user-store'),
    },
    {
      name: 'Amendment Management',
      description: 'Manage plan amendments',
      icon: Settings,
      href: '/admin/amendment-management',
    },
  ];

  const testSubMenuItems = [
    {
      name: 'Store Manager Interface',
      description: 'Test store manager dashboard',
      icon: Users,
      href: '/admin/test-store-manager',
    },
    {
      name: 'Area Manager Interface',
      description: 'Test area manager dashboard',
      icon: Users,
      href: '/admin/test-area-manager',
    },
    {
      name: 'Regional Manager Interface',
      description: 'Test regional manager dashboard',
      icon: Users,
      href: '/admin/test-regional-manager',
    },
  ];

  return (
    <>
      {/* Desktop sidebar - Fixed position */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-56 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white dark:bg-gray-900 pt-5 pb-4 overflow-y-auto border-r border-gray-200 dark:border-gray-700 shadow-lg">
            {/* Logo */}
            <div className="flex items-center flex-shrink-0 px-4">
              <ShieldCheck className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">
                Admin Portal
              </span>
            </div>
            
            {/* Navigation */}
            <nav className="mt-8 flex-1 flex flex-col divide-y divide-gray-200 dark:divide-gray-700 overflow-y-auto">
              <div className="px-2 space-y-1">
                {navigation.map((item) => (
                  <div key={item.name}>
                    {item.hasSubmenu ? (
                      <button
                        onClick={item.onClick}
                        className={cn(
                          'w-full group flex items-center justify-between px-3 py-3 text-sm font-medium rounded-l-md transition-all duration-200 hover:shadow-sm',
                          'text-gray-600 dark:text-gray-300 hover:bg-blue-50/50 dark:hover:bg-gray-800 hover:text-blue-700 dark:hover:text-blue-300 hover:translate-x-1'
                        )}
                      >
                        <div className="flex items-center">
                          <item.icon
                            className={cn(
                              'text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 group-hover:scale-110',
                              'mr-3 flex-shrink-0 h-5 w-5 transition-all duration-200'
                            )}
                            aria-hidden="true"
                          />
                          {item.name}
                        </div>
                        {(item.name === 'Data Upload' && uploadMenuOpen) || 
                         (item.name === 'Weekly Plan' && weeklyPlanMenuOpen) || 
                         (item.name === 'Test Interfaces' && testMenuOpen) ? (
                          <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-all duration-200" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-all duration-200" />
                        )}
                      </button>
                    ) : (
                      <Link
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
                    )}
                    
                    {/* Upload Submenu */}
                    {item.name === 'Data Upload' && uploadMenuOpen && (
                      <div className="ml-6 mt-2 space-y-1">
                        {uploadSubMenuItems.map((subItem) => (
                          <button
                            key={subItem.name}
                            onClick={subItem.onClick}
                            className="w-full group flex items-center px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-blue-50/50 dark:hover:bg-gray-800 hover:text-blue-700 dark:hover:text-blue-300 rounded-md transition-all duration-200"
                          >
                            <subItem.icon
                              className="mr-3 flex-shrink-0 h-4 w-4 text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-all duration-200"
                              aria-hidden="true"
                            />
                            <div className="flex flex-col items-start">
                              <span className="font-medium">{subItem.name}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{subItem.description}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {/* Weekly Plan Submenu */}
                    {item.name === 'Weekly Plan' && weeklyPlanMenuOpen && (
                      <div className="ml-6 mt-2 space-y-1">
                        {weeklyPlanSubMenuItems.map((subItem) => (
                          subItem.href ? (
                            <Link
                              key={subItem.name}
                              to={subItem.href}
                              className="w-full group flex items-center px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-blue-50/50 dark:hover:bg-gray-800 hover:text-blue-700 dark:hover:text-blue-300 rounded-md transition-all duration-200"
                            >
                              <subItem.icon
                                className="mr-3 flex-shrink-0 h-4 w-4 text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-all duration-200"
                                aria-hidden="true"
                              />
                              <div className="flex flex-col items-start">
                                <span className="font-medium">{subItem.name}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">{subItem.description}</span>
                              </div>
                            </Link>
                          ) : (
                            <button
                              key={subItem.name}
                              onClick={subItem.onClick}
                              className="w-full group flex items-center px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-blue-50/50 dark:hover:bg-gray-800 hover:text-blue-700 dark:hover:text-blue-300 rounded-md transition-all duration-200"
                            >
                              <subItem.icon
                                className="mr-3 flex-shrink-0 h-4 w-4 text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-all duration-200"
                                aria-hidden="true"
                              />
                              <div className="flex flex-col items-start">
                                <span className="font-medium">{subItem.name}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">{subItem.description}</span>
                              </div>
                            </button>
                          )
                        ))}
                      </div>
                    )}
                    
                    {/* Test Interfaces Submenu */}
                    {item.name === 'Test Interfaces' && testMenuOpen && (
                      <div className="ml-6 mt-2 space-y-1">
                        {testSubMenuItems.map((subItem) => (
                          <Link
                            key={subItem.name}
                            to={subItem.href}
                            className="w-full group flex items-center px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-blue-50/50 dark:hover:bg-gray-800 hover:text-blue-700 dark:hover:text-blue-300 rounded-md transition-all duration-200"
                          >
                            <subItem.icon
                              className="mr-3 flex-shrink-0 h-4 w-4 text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-all duration-200"
                              aria-hidden="true"
                            />
                            <div className="flex flex-col items-start">
                              <span className="font-medium">{subItem.name}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{subItem.description}</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </nav>

            {/* Footer */}
            <div className="flex-shrink-0 flex border-t border-gray-200 dark:border-gray-700 p-4">
              <div className="flex-shrink-0 group block">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  The Bed Shop - Admin
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
            <ShieldCheck className="h-8 w-8 text-blue-600" />
            <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">
              Admin Portal
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
              <div key={item.name}>
                {item.hasSubmenu ? (
                  <button
                    onClick={item.onClick}
                    className={cn(
                      'w-full group flex items-center justify-between px-3 py-3 text-sm font-medium rounded-l-md transition-all duration-200 hover:shadow-sm',
                      'text-gray-600 dark:text-gray-300 hover:bg-blue-50/50 dark:hover:bg-gray-800 hover:text-blue-700 dark:hover:text-blue-300 hover:translate-x-1'
                    )}
                  >
                    <div className="flex items-center">
                      <item.icon
                        className={cn(
                          'text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 group-hover:scale-110',
                          'mr-3 flex-shrink-0 h-5 w-5 transition-all duration-200'
                        )}
                        aria-hidden="true"
                      />
                      {item.name}
                    </div>
                    {(item.name === 'Data Upload' && uploadMenuOpen) || 
                     (item.name === 'Weekly Plan' && weeklyPlanMenuOpen) || 
                     (item.name === 'Test Interfaces' && testMenuOpen) ? (
                      <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-all duration-200" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-all duration-200" />
                    )}
                  </button>
                ) : (
                  <Link
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
                )}
                
                {/* Upload Submenu */}
                {item.name === 'Data Upload' && uploadMenuOpen && (
                  <div className="ml-6 mt-2 space-y-1">
                    {uploadSubMenuItems.map((subItem) => (
                      <button
                        key={subItem.name}
                        onClick={subItem.onClick}
                        className="w-full group flex items-center px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-blue-50/50 dark:hover:bg-gray-800 hover:text-blue-700 dark:hover:text-blue-300 rounded-md transition-all duration-200"
                      >
                        <subItem.icon
                          className="mr-3 flex-shrink-0 h-4 w-4 text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-all duration-200"
                          aria-hidden="true"
                        />
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{subItem.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{subItem.description}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Weekly Plan Submenu */}
                {item.name === 'Weekly Plan' && weeklyPlanMenuOpen && (
                  <div className="ml-6 mt-2 space-y-1">
                    {weeklyPlanSubMenuItems.map((subItem) => (
                      subItem.href ? (
                        <Link
                          key={subItem.name}
                          to={subItem.href}
                          onClick={() => setOpen(false)}
                          className="w-full group flex items-center px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-blue-50/50 dark:hover:bg-gray-800 hover:text-blue-700 dark:hover:text-blue-300 rounded-md transition-all duration-200"
                        >
                          <subItem.icon
                            className="mr-3 flex-shrink-0 h-4 w-4 text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-all duration-200"
                            aria-hidden="true"
                          />
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{subItem.name}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{subItem.description}</span>
                          </div>
                        </Link>
                      ) : (
                        <button
                          key={subItem.name}
                          onClick={subItem.onClick}
                          className="w-full group flex items-center px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-blue-50/50 dark:hover:bg-gray-800 hover:text-blue-700 dark:hover:text-blue-300 rounded-md transition-all duration-200"
                        >
                          <subItem.icon
                            className="mr-3 flex-shrink-0 h-4 w-4 text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-all duration-200"
                            aria-hidden="true"
                          />
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{subItem.name}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{subItem.description}</span>
                          </div>
                        </button>
                      )
                    ))}
                  </div>
                )}
                
                {/* Test Interfaces Submenu */}
                {item.name === 'Test Interfaces' && testMenuOpen && (
                  <div className="ml-6 mt-2 space-y-1">
                    {testSubMenuItems.map((subItem) => (
                      <Link
                        key={subItem.name}
                        to={subItem.href}
                        onClick={() => setOpen(false)}
                        className="w-full group flex items-center px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-blue-50/50 dark:hover:bg-gray-800 hover:text-blue-700 dark:hover:text-blue-300 rounded-md transition-all duration-200"
                      >
                        <subItem.icon
                          className="mr-3 flex-shrink-0 h-4 w-4 text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-all duration-200"
                          aria-hidden="true"
                        />
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{subItem.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{subItem.description}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </nav>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={closeUploadDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{getUploadDialogTitle()}</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {renderUploadComponent()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}