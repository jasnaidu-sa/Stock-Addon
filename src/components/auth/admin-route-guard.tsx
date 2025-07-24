/**
 * Admin Route Guard Component
 * Checks user role from database and protects admin routes
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import { getUserHierarchy } from '@/lib/user-role';

interface AdminRouteGuardProps {
  children: React.ReactNode;
  fallbackPath?: string;
}

export function AdminRouteGuard({ 
  children, 
  fallbackPath = "/" 
}: AdminRouteGuardProps) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAdminStatus() {
      if (!isLoaded || !isSignedIn || !userId) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      try {
        const hierarchy = await getUserHierarchy(userId);
        setIsAdmin(hierarchy?.hierarchyRole === 'admin');
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkAdminStatus();
  }, [isLoaded, isSignedIn, userId]);

  // Show loading state while checking
  if (!isLoaded || isLoading) {
    return (
      <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-white dark:bg-neutral-950">
        <div className="absolute inset-0">
          <div className="h-full w-full bg-white bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-neutral-950 dark:bg-[radial-gradient(#ffffff33_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_0%,transparent_100%)]"></div>
        </div>
        <p className="z-10 text-lg md:text-7xl bg-clip-text text-transparent bg-gradient-to-b from-neutral-200 to-neutral-600 font-sans font-bold">
          Checking Permissions...
        </p>
      </div>
    );
  }

  // Redirect if not signed in
  if (!isSignedIn) {
    return <Navigate to="/clerk-login" replace />;
  }

  // Redirect if not admin
  if (isAdmin === false) {
    return <Navigate to={fallbackPath} replace />;
  }

  // Render children if admin
  return <>{children}</>;
}