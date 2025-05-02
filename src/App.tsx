import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { CartProvider } from '@/components/cart/cart-provider';
import { AuthPage } from '@/pages/auth';
import LoginPage from '@/pages/login';
import SignupPage from '@/pages/signup';
import ResetPasswordPage from '@/pages/auth/reset-password';
import { DashboardPage } from '@/pages/dashboard';
import { CategoryPage } from '@/pages/category/[id]';
import AdminPage from '@/pages/admin';
import { Layout } from '@/components/layout/layout';
import { testSupabaseConnection } from './lib/supabase-test';
import { BackgroundPaths } from '@/components/ui/background-paths';
import React from 'react';
import { useToast } from '@/hooks/use-toast';
import ProfilePage from '@/pages/profile';
import MattressPage from '@/pages/mattresses';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('=== Initial Session Check ===', {
        hasSession: !!session,
        userId: session?.user?.id,
        email: session?.user?.email
      });
      setSession(session);
      
      // Get user role if session exists
      if (session?.user) {
        getUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('=== Auth State Changed ===', {
        event: _event,
        hasSession: !!session,
        userId: session?.user?.id,
        email: session?.user?.email
      });
      setSession(session);
      
      // Update user role when auth state changes
      if (session?.user) {
        getUserRole(session.user.id);
      } else {
        setUserRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch user role and status from database
  const getUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_user_role', {
        user_id: userId
      });
      
      if (error) throw error;
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error('User data not found');
      }
      
      const userData = data[0];
      
      // If user is not active, sign them out
      if (userData.status !== 'active') {
        console.log('User is not active, signing out');
        await supabase.auth.signOut();
        setUserRole(null);
        
        toast({
          title: 'Account Not Active',
          description: 'Your account is pending approval. Please contact an administrator.',
          variant: 'destructive',
        });
        return;
      }
      
      setUserRole(userData.role);
    } catch (error) {
      console.error('Error fetching user role:', error);
      setUserRole(null);
    } finally {
      setLoading(false);
    }
  };

  // Test Supabase connection on app load
  useEffect(() => {
    testSupabaseConnection().then((result) => {
      console.log('=== Initial Supabase Connection Test ===', {
        success: result.success,
        hasAuthData: !!result.authData,
        error: result.error
      });
    });
  }, []);

  if (loading) {
    return (
      <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-white dark:bg-neutral-950">
        <div className="absolute inset-0">
          <BackgroundPaths title="" />
        </div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">Loading your experience...</p>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route 
              path="/auth" 
              element={
                !session ? (
                  <AuthPage />
                ) : (
                  <Navigate to="/" replace />
                )
              } 
            />
            <Route 
              path="/auth/signup" 
              element={
                !session ? (
                  <SignupPage />
                ) : (
                  <Navigate to="/" replace />
                )
              } 
            />
            <Route 
              path="/auth/reset-password" 
              element={<ResetPasswordPage />} 
            />
            <Route 
              path="/login" 
              element={
                !session ? (
                  <LoginPage />
                ) : (
                  <Navigate to="/" replace />
                )
              } 
            />
            <Route 
              path="/admin/*" 
              element={
                loading ? (
                  <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : session && userRole === 'admin' ? (
                  <AdminPage />
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            <Route 
              element={
                session ? (
                  <Layout />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="/category/:id" element={<CategoryPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/category/mattress" element={<MattressPage />} />
            </Route>
            <Route 
              path="*" 
              element={
                <Navigate 
                  to={session ? "/" : "/login"} 
                  replace 
                />
              } 
            />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </CartProvider>
    </ThemeProvider>
  );
}

export default App;