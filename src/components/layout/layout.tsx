import { Header } from './header';
import { Outlet, useLocation } from 'react-router-dom';
import { CartSheet } from '@/components/cart/cart-sheet';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { AdminRedirect } from './admin-redirect';

export function Layout() {
  const location = useLocation();
  const showCart = location.pathname.startsWith('/category/');
  const { toast } = useToast();

  useEffect(() => {
    // Verify session on layout mount and route changes
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        toast({
          title: 'Session Error',
          description: 'Please log in again.',
          variant: 'destructive',
        });
        window.location.href = '/login';
        return;
      }
    };

    checkSession();
  }, [location.pathname, toast]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AdminRedirect />
      
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