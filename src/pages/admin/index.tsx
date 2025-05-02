import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { DashboardPage } from '@/components/admin/dashboard';
import { useNavigate } from 'react-router-dom';

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Check authentication status
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      
      if (session?.user) {
        // Fetch user role from the users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();
          
        if (userError) throw userError;
        
        if (userData?.role === 'admin') {
          setIsAuthenticated(true);
          setLoading(false);
        } else {
          toast({
            title: 'Access Denied',
            description: 'You must be an admin to access this page.',
            variant: 'destructive',
          });
          navigate('/', { replace: true });
        }
      } else {
        toast({
          title: 'Authentication Required',
          description: 'Please log in to access the admin panel.',
          variant: 'destructive',
        });
        navigate('/login', { replace: true });
      }
    } catch (error: any) {
      console.error('Auth check error:', error);
      toast({
        title: 'Error',
        description: 'Failed to verify authentication status',
        variant: 'destructive',
      });
      navigate('/login', { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <DashboardPage />;
} 