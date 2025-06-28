import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { CartProvider } from '@/components/cart/cart-provider';
import { Layout } from '@/components/layout/layout';
import SignupPage from '@/pages/signup'; 
import ResetPasswordPage from '@/pages/auth/reset-password';
import { DashboardPage } from '@/pages/dashboard';
import { CategoryPage } from '@/pages/category/[id]'; 
import AdminPage from '@/pages/admin'; 
import MattressPage from '@/pages/mattresses';
import ClerkLoginPage from '@/pages/clerk-login';
import { ClerkTestPage } from '@/pages/clerk-test';
import {
  SignIn, 
  SignUp, 
  useAuth, 
  useUser,
  useClerk
} from "@clerk/clerk-react";
import { useEffect, useState } from 'react'; // Added useState
// Import only the initializer function
import { initializeSupabaseWithClerk } from './lib/supabase'; 
import './App.css';


function App() {
  const { getToken, isLoaded, isSignedIn } = useAuth(); 
  const { user } = useUser();
  const { signOut } = useClerk();
  const [supabaseReady, setSupabaseReady] = useState(false); // New state for Supabase readiness

  // Initialize Supabase with Clerk's getToken - only once when Clerk is loaded
  useEffect(() => {
    // Ensure Clerk is loaded and getToken function is available
    if (isLoaded && typeof getToken === 'function') { 
      console.log('[App.tsx DEBUG] Clerk is loaded and getToken is available. Attempting to initialize Supabase.');
      try {
        initializeSupabaseWithClerk(getToken); // Pass the actual getToken function
        setSupabaseReady(true); // Mark Supabase as ready
        console.log('[App.tsx DEBUG] Supabase initialized with Clerk successfully.');
      } catch (error) {
        console.error('[App.tsx DEBUG] Error initializing Supabase with Clerk:', error);
        // Optionally, set an error state here to inform the user
      }
    } else {
      console.log('[App.tsx DEBUG] Waiting for Clerk (isLoaded and getToken) before initializing Supabase.');
    }
  }, [isLoaded, getToken]); // Dependencies are correct
  
  // Handle sign out with redirect to clerk-login
  // Export to window to make it accessible from layout components
  window.handleClerkSignOut = () => {
    signOut(() => {
      window.location.href = '/clerk-login';
    });
  };

  // Updated loading condition: wait for Clerk and Supabase initialization
  if (!isLoaded || !supabaseReady) { 
    return (
      <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-white dark:bg-neutral-950">
        <div className="absolute inset-0">
          <div className="h-full w-full bg-white bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-neutral-950 dark:bg-[radial-gradient(#ffffff33_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_0%,transparent_100%)]"></div>
        </div>
        <p className="z-10 text-lg md:text-7xl bg-clip-text text-transparent bg-gradient-to-b from-neutral-200 to-neutral-600 font-sans font-bold">
          Loading Application...
        </p>
      </div>
    );
  }

  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <Toaster />
      <CartProvider>
        {/* Debug info - show when Clerk is loaded/user is signed in */}
        <div className="hidden">
          Debug: {isLoaded ? 'Clerk Loaded' : 'Clerk Loading'} | 
          {isSignedIn ? 'User Signed In' : 'User Not Signed In'} |
          Supabase: {supabaseReady ? 'Ready' : 'Initializing...'}
        </div>
        <Routes>
            <Route path="/clerk-login/*" element={<ClerkLoginPage />} />
            <Route path="/clerk-test" element={<ClerkTestPage />} />
            <Route path="/sign-in/*" element={<SignIn routing="path" path="/sign-in" fallbackRedirectUrl="/clerk-login" />} />
            <Route path="/sign-up/*" element={<SignUp routing="path" path="/sign-up" fallbackRedirectUrl="/clerk-login" />} />
            
            <Route path="/signup-legacy" element={<SignupPage />} /> 
            <Route 
              path="/reset-password" 
              element={<ResetPasswordPage />} 
            />
            
            <Route path="/verify" element={<Navigate to="/auth/verify" />} />
            <Route path="/auth/verify" element={<Outlet />} />
            
            <Route 
              path="/admin/*" 
              element={isSignedIn && user?.publicMetadata?.role === 'admin' ? <AdminPage /> : <Navigate to={isSignedIn ? "/" : "/clerk-login"} replace />}
            />

            {/* Protected routes with Layout */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                {/* Dashboard route */}
                <Route 
                  path="/" 
                  element={
                    user?.publicMetadata?.role === 'admin' 
                      ? <Navigate to="/admin/orders" replace /> 
                      : <DashboardPage />
                  } 
                />
                <Route path="/category/:id" element={<CategoryPage />} />
                <Route path="/mattresses" element={<MattressPage />} />
              </Route>
            </Route>
            
            
            <Route 
              path="*" 
              element={
                isSignedIn 
                  ? (user?.publicMetadata?.role === 'admin' 
                    ? <Navigate to="/admin" replace /> 
                    : <Navigate to="/clerk-login" replace />)
                  : <Navigate to="/clerk-login" replace />
              }
            />
        </Routes>
      </CartProvider>
    </ThemeProvider>
  );
};

// Protected route component
const ProtectedRoute = () => {
  const { isLoaded, isSignedIn } = useAuth();
  
  if (!isLoaded) {
    return <div>Loading auth...</div>;
  }
  
  return isSignedIn ? <Outlet /> : <Navigate to="/clerk-login" replace />;
};


export default App;