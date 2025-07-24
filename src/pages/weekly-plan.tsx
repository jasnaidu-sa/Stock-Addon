import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase';
import { useUser } from '@clerk/clerk-react';

export default function WeeklyPlan() {
  const supabase = getSupabaseClient();
  const navigate = useNavigate();
  const { isSignedIn, user } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const detectRoleAndRedirect = async () => {
      if (!isSignedIn || !user || !supabase) {
        setError('Authentication required');
        setIsLoading(false);
        return;
      }

      try {
        const clerkUserId = user.id;
        
        // Get user data from Supabase
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, role')
          .eq('clerk_id', clerkUserId)
          .single();

        if (userError || !userData) {
          setError('User not found in system');
          setIsLoading(false);
          return;
        }

        // Check admin role first
        if (userData.role === 'admin') {
          navigate('/admin');
          return;
        }

        // Check management hierarchy to determine role
        const { data: hierarchyData, error: hierarchyError } = await supabase
          .from('store_management_hierarchy')
          .select('store_manager_id, area_manager_id, regional_manager_id')
          .or(`store_manager_id.eq.${userData.id},area_manager_id.eq.${userData.id},regional_manager_id.eq.${userData.id}`)
          .limit(1);

        if (hierarchyError) {
          console.error('Error checking hierarchy:', hierarchyError);
          setError('Error checking user permissions');
          setIsLoading(false);
          return;
        }

        if (!hierarchyData || hierarchyData.length === 0) {
          setError('Access Denied: You are not assigned to any management role');
          setIsLoading(false);
          return;
        }

        const hierarchy = hierarchyData[0];
        
        // Determine role and redirect
        if (hierarchy.regional_manager_id === userData.id) {
          navigate('/regional-manager');
        } else if (hierarchy.area_manager_id === userData.id) {
          navigate('/area-manager');
        } else if (hierarchy.store_manager_id === userData.id) {
          navigate('/store-manager');
        } else {
          setError('Access Denied: Management role not recognized');
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error detecting role:', error);
        setError('System error occurred');
        setIsLoading(false);
      }
    };

    detectRoleAndRedirect();
  }, [isSignedIn, user, supabase, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 text-gray-400 mx-auto mb-4 animate-spin" />
          <p className="text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
              <p className="text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}