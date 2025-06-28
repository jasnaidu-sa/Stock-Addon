import { Header } from './header';
import { Outlet, useLocation } from 'react-router-dom';
import { CartSheet } from '@/components/cart/cart-sheet';
// Removed UserRedirect import as it's causing redirect loops

export function Layout() {
  const location = useLocation();
  const showCart = location.pathname.startsWith('/category/');
  
  // No session check needed here - Clerk handles authentication
  // and redirects automatically via ClerkProvider in your app

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* UserRedirect removed to prevent redirect loops */}
      
      <Header />
      <div className="flex-1">
        <div className="container py-6">
          <div className="flex gap-6">
            {showCart && (
              <div className="w-[300px] flex-none">
                <CartSheet />
              </div>
            )}
            <div className={showCart ? "flex-1" : "w-full"}>
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}