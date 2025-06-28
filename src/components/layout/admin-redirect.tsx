import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getSupabaseClient } from '@/lib/supabase';
import { useUser } from '@clerk/clerk-react';

export function UserRedirect() {
  const supabase = getSupabaseClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { isSignedIn, user } = useUser();

  useEffect(() => {
    // IMPORTANT: Only redirect if we're on the exact root path
    // This prevents redirect loops by not running on any other paths
    if (location.pathname !== '/') {
      console.log('UserRedirect: Not on root path, skipping redirect check');
      return;
    }

    const checkUserRole = async () => {
      try {
        if (!supabase) {
          console.error('Supabase client not initialized');
          return;
        }
        
        // Check if user is signed in with Clerk
        if (isSignedIn && user) {
          const clerkUserId = user.id;
          
          // Check user role in database using clerk_id
          const { data } = await supabase
            .from('users')
            .select('role')
            .eq('clerk_id', clerkUserId)
            .single();
          
          // Redirect based on user role
          if (data?.role === 'admin') {
            console.log('Redirecting admin user to admin dashboard');
            navigate('/admin');
          } else {
            // For all other user types (customer, user, etc.)
            console.log('Redirecting regular user to customer dashboard');
            navigate('/dashboard');
          }
        }
      } catch (error) {
        console.error('Error checking user role:', error);
      } finally {
        // Session check completed
      }
    };

    checkUserRole();
  }, [navigate, location.pathname, isSignedIn, user, supabase]);

  // Return null as this is just a redirect component
  return null;
} 