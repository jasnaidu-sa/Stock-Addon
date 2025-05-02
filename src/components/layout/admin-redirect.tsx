import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export function AdminRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Skip redirect if already on admin page or not on the homepage
    if (location.pathname.startsWith('/admin') || location.pathname !== '/') {
      setIsChecking(false);
      return;
    }

    const checkUserRole = async () => {
      try {
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Check if user is admin
          const { data } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single();
          
          // If admin, redirect to admin dashboard
          if (data?.role === 'admin') {
            navigate('/admin');
          }
        }
      } catch (error) {
        console.error('Error checking user role:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkUserRole();
  }, [navigate, location.pathname]);

  // Return null as this is just a redirect component
  return null;
} 