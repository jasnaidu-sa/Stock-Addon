import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface UserProfile {
  email: string;
  name: string;
  company_name: string;
  group_type: string;
  role: string;
  status: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          throw new Error('No authenticated user');
        }

        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error) throw error;
        if (!data) throw new Error('No profile data found');

        setProfile(data);
      } catch (error) {
        console.error('Error loading profile:', error);
        toast({
          title: 'Error',
          description: 'Failed to load profile data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Profile not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Your account details are displayed below
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <div className="p-2 rounded-md bg-muted">
              {profile.name}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Email</Label>
            <div className="p-2 rounded-md bg-muted">
              {profile.email}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Company Name</Label>
            <div className="p-2 rounded-md bg-muted">
              {profile.company_name}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Group Type</Label>
            <div className="p-2 rounded-md bg-muted">
              {profile.group_type}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Account Status</Label>
            <div className="p-2 rounded-md bg-muted">
              {profile.status}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Role</Label>
            <div className="p-2 rounded-md bg-muted">
              {profile.role}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 