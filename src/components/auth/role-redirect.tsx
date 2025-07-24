import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { getSupabaseClient } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export function RoleRedirect() {
  const navigate = useNavigate();
  const { user, isSignedIn, isLoaded } = useUser();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkUserRole = async () => {
      if (!isLoaded) return;
      
      if (!isSignedIn || !user) {
        navigate('/clerk-login');
        return;
      }

      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          console.error('Supabase client not initialized');
          navigate('/');
          return;
        }

        // Check user role in database
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('clerk_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user role:', error);
          navigate('/');
          return;
        }

        // Redirect based on role
        if (data?.role === 'admin') {
          console.log('Redirecting to admin dashboard');
          navigate('/admin');
        } else if (data?.role === 'store_manager') {
          console.log('Redirecting to store manager dashboard');
          navigate('/store-manager');
        } else if (data?.role === 'area_manager') {
          console.log('Redirecting to area manager dashboard');
          navigate('/area-manager');
        } else if (data?.role === 'regional_manager') {
          console.log('Redirecting to regional manager dashboard');
          navigate('/regional-manager');
        } else {
          console.log('Redirecting to customer dashboard');
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Error in role check:', error);
        navigate('/');
      } finally {
        setChecking(false);
      }
    };

    checkUserRole();
  }, [isLoaded, isSignedIn, user, navigate]);

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return null;
}