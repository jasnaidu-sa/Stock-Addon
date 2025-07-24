import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AdminSidebar } from './admin-sidebar';
import { AdminHeaderNew } from './admin-header-new';
import { CartSheet } from '@/components/cart/cart-sheet';

export function AdminLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const showCart = location.pathname.startsWith('/admin/category/');

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Fixed Sidebar */}
      <AdminSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      
      {/* Main content area with fixed left margin to account for sidebar */}
      <div className="lg:ml-56 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <AdminHeaderNew onMenuClick={() => setSidebarOpen(true)} />
        
        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-white dark:bg-gray-800">
          <div className="px-4 py-6">
            {showCart ? (
              <div className="flex gap-6">
                <div className="w-[300px] flex-none">
                  <CartSheet />
                </div>
                <div className="flex-1 min-w-0">
                  <Outlet />
                </div>
              </div>
            ) : (
              <div className="w-full">
                <Outlet />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity lg:hidden z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
