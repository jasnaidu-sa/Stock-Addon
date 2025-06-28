import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseClient, supabaseAdmin } from '@/lib/supabase';
import { Loader2, Eye, EyeOff, RefreshCw, Download, BarChart3 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  group_type: string | null;
  company_name: string | null;
}

interface UserStats {
  total: number;
  byRole: Record<string, number>;
  byStatus: Record<string, number>;
  recentSignups: number;
}

export function PasswordManager() {
  
  const supabase = getSupabaseClient(); // Initialize Supabase client
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showGeneratedPassword, setShowGeneratedPassword] = useState(false);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [showStats, setShowStats] = useState(false);
  
  // Edit user state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: '',
    status: '',
    group_type: '',
    company_name: ''
  });

  // New admin creation state
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminForm, setAdminForm] = useState({
    email: '',
    password: '',
    name: '',
    role: 'admin',
    group_type: '',
    company_name: ''
  });
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  // Password generator settings
  const [passwordSettings, setPasswordSettings] = useState({
    length: 12,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true
  });

  const { toast } = useToast();

  // Function to create admin user directly in the database
  const createAdminUserDirectly = async () => {
    try {
      if (!adminForm.email || !adminForm.password || !adminForm.name || !adminForm.group_type || !adminForm.company_name) {
        toast({
          title: 'Error',
          description: 'All fields (Email, Password, Name, Group Type, Company Name) are required',
          variant: 'destructive',
        });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(adminForm.email)) {
        toast({
          title: 'Invalid Email',
          description: 'Please enter a valid email address',
          variant: 'destructive',
        });
        return;
      }

      // Check if email exists
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', adminForm.email)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing user:', checkError);
        throw new Error(`Error checking existing user: ${checkError.message}`);
      }

      if (existingUser) {
        toast({
          title: 'Error',
          description: `A user with email ${adminForm.email} already exists`,
          variant: 'destructive',
        });
        return;
      }

      setCreatingAdmin(true);

      // Step 1: Create the user in Auth using the admin client
      // For direct creation, we might only create the profile or also an auth user
      // This example focuses on profile creation, assuming auth might be handled elsewhere or not needed for all direct entries

      const { data: authUser, error: authError } = await supabaseAdmin!.auth.admin.createUser({
        email: adminForm.email,
        password: adminForm.password,
        email_confirm: true,
        user_metadata: {
          name: adminForm.name,
          role: adminForm.role,
          group_type: adminForm.group_type,
          company_name: adminForm.company_name,
        }
      });

      if (authError) {
        console.error('Error creating auth user directly:', authError);
        toast({
          title: 'Auth Creation Error',
          description: authError.message || 'Failed to create auth user.',
          variant: 'destructive',
        });
        // Decide if we should proceed to create profile if auth fails
        // For now, let's stop if auth creation fails to maintain consistency
        setCreatingAdmin(false);
        return; 
      }

      if (!authUser || !authUser.user) {
        toast({
          title: 'Auth Creation Error',
          description: 'Failed to create auth user, no user data returned.',
          variant: 'destructive',
        });
        setCreatingAdmin(false);
        return;
      }

      // Step 2: Insert user profile into the public.users table
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: authUser.user.id, // Use the ID from the created auth user
          email: adminForm.email,
          name: adminForm.name,
          role: adminForm.role,
          status: 'active', // Default status
          group_type: adminForm.group_type,
          company_name: adminForm.company_name,
          created_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Error creating user profile:', insertError);
        toast({
          title: 'Error',
          description: `Failed to create user profile: ${insertError.message}`,
          variant: 'destructive',
        });
        return;
      }

      // Success
      toast({
        title: 'Success',
        description: `Admin user ${adminForm.name} created successfully!`,
      });

      // Reset form
      setAdminForm({
        email: '',
        password: '',
        name: '',
        role: 'admin',
        group_type: '',
        company_name: ''
      });
      setShowAdminForm(false);

      // Reload users
      loadUsers();

    } catch (error: any) {
      console.error('Error creating admin user directly:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create admin user',
        variant: 'destructive',
      });
    } finally {
      setCreatingAdmin(false);
    }
  };

  // Function to create a new admin user
  const createAdminUser = async () => {
    if (!adminForm.email || !adminForm.password || !adminForm.name || !adminForm.group_type || !adminForm.company_name) {
      toast({
        title: 'Error',
        description: 'All fields (Email, Password, Name, Group Type, Company Name) are required.',
        variant: 'destructive',
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminForm.email)) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    // Validate password length
    if (adminForm.password.length < 6) {
      toast({
        title: 'Password Too Short',
        description: 'Password must be at least 6 characters long',
        variant: 'destructive',
      });
      return;
    }

    setCreatingAdmin(true);

    try {
      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to create an admin user');
      }

      // Call the admin-create-user edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: adminForm.email,
          password: adminForm.password,
          name: adminForm.name,
          role: adminForm.role,
          group_type: adminForm.group_type,
          company_name: adminForm.company_name,
          status: 'active',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Log detailed error information
        console.error('Error response from admin-create-user:', result);
        
        // Extract detailed error message if available
        let errorMessage = 'Failed to create admin user';
        if (result.error) {
          errorMessage = result.error;
        } else if (result.message) {
          errorMessage = result.message;
        } else if (typeof result === 'string') {
          errorMessage = result;
        }
        
        throw new Error(errorMessage);
      }

      toast({
        title: 'Success',
        description: `Admin user ${adminForm.name} created successfully!`,
      });

      // Reset form and hide it
      setAdminForm({
        email: '',
        password: '',
        name: '',
        role: 'admin',
        group_type: '',
        company_name: ''
      });
      setShowAdminForm(false);

      // Reload the user list
      loadUsers();

    } catch (error: any) {
      console.error('Error creating admin user:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create admin user',
        variant: 'destructive',
      });
    } finally {
      setCreatingAdmin(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      console.log('Checking auth state...');
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw sessionError;
      }
      
      if (!session) {
        console.error('No session found');
        throw new Error('Not authenticated');
      }
      
      console.log('Current user:', session.user);

      // Fetch the current user's role from the database
      const { data: currentUserData, error: roleError } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (roleError) {
        console.error('Error fetching current user role:', roleError);
        throw new Error('Could not verify user role');
      }

      // Check if the current user has the 'admin' role
      if (currentUserData?.role !== 'admin') {
        console.warn('Unauthorized access attempt to password manager by:', session.user.email);
        throw new Error('Unauthorized: Admin access required');
      }

      console.log('Admin access granted for password manager.');

      const { data: users, error } = await supabase
        .from('users')
        .select('id, name, email, role, status, created_at, group_type, company_name')
        .order('name', { ascending: true });

      if (error) throw error;

      console.log('Password Manager - Raw users data:', users);
      console.log('Password Manager - Number of users loaded:', users?.length || 0);
      
      setUsers(users || []);
      toast({
        title: 'Success',
        description: `Loaded ${users?.length || 0} users successfully!`,
      });
    } catch (error: any) {
      console.error('Error loading users:', error);
      toast({
        title: 'Error',
        description: `Error: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Force clear search term on mount and prevent email auto-setting
    console.log('Component mounted, clearing search term');
    setSearchTerm('');
    
    // Also clear any URL parameters that might be setting search terms
    const url = new URL(window.location.href);
    if (url.searchParams.has('search') || url.searchParams.has('filter')) {
      console.log('Clearing URL search parameters');
      url.searchParams.delete('search');
      url.searchParams.delete('filter');
      window.history.replaceState({}, '', url.toString());
    }
    
    loadUsers();
  }, []);

  // Monitor search term changes and prevent unwanted values
  useEffect(() => {
    if (searchTerm) {
      console.log('Search term changed to:', searchTerm);
      // If search term contains an email or looks like it was auto-set, clear it immediately
      if (searchTerm.includes('@') || searchTerm.includes('jnaidu') || searchTerm.length > 50) {
        console.log('Auto-clearing unwanted search term:', searchTerm);
        // Use setTimeout to avoid infinite loops
        setTimeout(() => setSearchTerm(''), 0);
      }
    }
  }, [searchTerm]);

  // Additional effect to force clear search term every 100ms for the first 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (searchTerm && (searchTerm.includes('@') || searchTerm.includes('jnaidu'))) {
        console.log('Force clearing persistent search term:', searchTerm);
        setSearchTerm('');
      }
    }, 100);

    // Clear the interval after 2 seconds
    const timeout = setTimeout(() => clearInterval(interval), 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [searchTerm]);

  const resetUserPassword = async () => {
    if (!selectedUser) {
      toast({
        title: 'Error',
        description: 'Please select a user first',
        variant: 'destructive',
      });
      return;
    }

    if (!newPassword) {
      toast({
        title: 'Error',
        description: 'Please enter a new password',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Error',
        description: 'Password must be at least 6 characters long',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Call the Edge Function
      const { data, error } = await supabase.functions.invoke('admin-reset-user-password', {
        body: { 
          userId: selectedUser.id,
          newPassword: newPassword
        },
      });

      if (error) {
        console.error('Edge function invocation error:', error);
        throw new Error(error.message || 'Failed to reset password via function.');
      }

      if (data?.error) { // Check for error returned by the function itself
        console.error('Error from admin-reset-user-password function:', data.error);
        throw new Error(data.error);
      }

      toast({
        title: 'Success',
        description: `Password for ${selectedUser.email} has been reset. Please inform the user.`,
      });
      setNewPassword('');
      setSelectedUser(null); // Clear selection after successful reset

    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast({
        title: 'Error',
        description: `Failed to reset password: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generatePassword = () => {
    const { length, includeUppercase, includeLowercase, includeNumbers, includeSymbols } = passwordSettings;
    
    let charset = '';
    if (includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (includeNumbers) charset += '0123456789';
    if (includeSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (!charset) {
      toast({
        title: 'Error',
        description: 'Please select at least one character type',
        variant: 'destructive',
      });
      return;
    }

    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    setGeneratedPassword(password);
    setShowGeneratedPassword(true);
    toast({
      title: 'Success',
      description: 'Password generated successfully!',
    });
  };

  const useGeneratedPassword = () => {
    if (generatedPassword) {
      setNewPassword(generatedPassword);
      toast({
        title: 'Success',
        description: 'Generated password copied to password field',
      });
    } else {
      toast({
        title: 'Error',
        description: 'Please generate a password first',
        variant: 'destructive',
      });
    }
  };

  const editUser = (user: User) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      group_type: user.group_type || '',
      company_name: user.company_name || ''
    });
  };

  const saveUserEdits = async () => {
    if (!editingUser) return;

    if (!editForm.name || !editForm.email) {
      toast({
        title: 'Error',
        description: 'Name and email are required',
        variant: 'destructive',
      });
      return;
    }

    if (!editForm.email.includes('@')) {
      toast({
        title: 'Error',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    try {
      toast({
        title: 'Info',
        description: 'Saving user changes...',
      });

      const { error } = await supabase
        .from('users')
        .update({
          name: editForm.name,
          email: editForm.email,
          role: editForm.role,
          status: editForm.status,
          group_type: editForm.group_type,
          company_name: editForm.company_name,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingUser.id);

      if (error) throw error;

      // Update local users array
      setUsers(users.map(user => 
        user.id === editingUser.id 
          ? { ...user, ...editForm }
          : user
      ));

      setEditingUser(null);
      toast({
        title: 'Success',
        description: `✅ User updated successfully!`,
      });
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast({
        title: 'Error',
        description: `❌ Error: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const deleteUser = async (user: User) => {
    if (!confirm(`Are you sure you want to delete user "${user.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      toast({
        title: 'Info',
        description: `Deleting user: ${user.name}...`,
      });

      // Delete from auth system first
      try {
        await supabase.auth.admin.deleteUser(user.id);
      } catch (authError) {
        console.log('Auth deletion failed, continuing with database deletion...');
      }

      // Delete from database
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', user.id);

      if (error) throw error;

      // Remove from local array
      setUsers(users.filter(u => u.id !== user.id));

      // Clear edit form if this user was being edited
      if (editingUser && editingUser.id === user.id) {
        setEditingUser(null);
      }

      // Clear password reset selection if this user was selected
      if (selectedUser && selectedUser.id === user.id) {
        setSelectedUser(null);
      }

      toast({
        title: 'Success',
        description: `✅ User "${user.name}" deleted successfully!`,
      });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Error',
        description: `❌ Error: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const exportUsers = () => {
    if (users.length === 0) {
      toast({
        title: 'Error',
        description: 'No users to export. Please load users first.',
        variant: 'destructive',
      });
      return;
    }

    const csvContent = [
      ['Name', 'Email', 'Role', 'Status', 'Created Date', 'Group Type', 'Company Name'].join(','),
      ...users.map(user => [
        `"${user.name}"`,
        `"${user.email}"`,
        user.role,
        user.status,
        new Date(user.created_at).toLocaleDateString(),
        user.group_type,
        user.company_name
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Success',
      description: `✅ Exported ${users.length} users to CSV file`,
    });
  };

  const generateUserStats = () => {
    if (users.length === 0) {
      toast({
        title: 'Error',
        description: 'No users loaded. Please load users first.',
        variant: 'destructive',
      });
      return;
    }

    const stats: UserStats = {
      total: users.length,
      byRole: {},
      byStatus: {},
      recentSignups: 0
    };

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    users.forEach(user => {
      // Count by role
      stats.byRole[user.role] = (stats.byRole[user.role] || 0) + 1;

      // Count by status
      stats.byStatus[user.status] = (stats.byStatus[user.status] || 0) + 1;

      // Count recent signups
      if (new Date(user.created_at) > oneWeekAgo) {
        stats.recentSignups++;
      }
    });

    setUserStats(stats);
    setShowStats(true);
    toast({
      title: 'Success',
      description: 'User statistics generated',
    });
  };

  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true;
    const query = searchTerm.toLowerCase();
    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  });

  const createAuthUserForExisting = async (user: User, password: string = 'tempPassword123') => {
    try {
      console.log('🔧 Creating auth user for:', user.name, user.email);
      console.log('🔧 Admin client available:', !!supabaseAdmin);
      console.log('🔧 Service role key length:', import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY?.length);
      console.log('🔧 Service role key format:', import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ? 
        `${import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...${import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY.substring(import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY.length - 20)}` : 
        'NOT FOUND'
      );

      // Check if we have admin client available
      if (!supabaseAdmin) {
        throw new Error('Service role key not configured. Please add VITE_SUPABASE_SERVICE_ROLE_KEY to your environment variables.');
      }

      toast({
        title: 'Info',
        description: `Creating auth account for ${user.name}...`,
      });

      // Try to create the user with admin client
      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: password,
        email_confirm: true, // Auto-confirm the email
        user_metadata: {
          name: user.name,
          role: user.role,
          group_type: user.group_type,
          company_name: user.company_name
        }
      });

      if (createError) {
        if (createError.message.includes('User already registered')) {
          // User exists, try to update password instead
          toast({
            title: 'Info',
            description: `User already exists in auth. Updating password for ${user.name}...`,
          });

          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            user.id,
            { password: password }
          );

          if (updateError) {
            throw updateError;
          }

          toast({
            title: 'Success',
            description: `✅ Password updated for existing auth user ${user.name}!`,
          });
        } else {
          throw createError;
        }
      } else {
        // Successfully created new auth user
        if (authData.user) {
          // Update the database user record with the new auth ID if different
          if (authData.user.id !== user.id) {
            await supabase
              .from('users')
              .update({ 
                id: authData.user.id,
                status: 'active',
                email_confirmed_at: new Date().toISOString()
              })
              .eq('email', user.email);
          }

          toast({
            title: 'Success',
            description: `✅ Auth account created successfully for ${user.name}! Password: ${password}`,
          });

          console.log(`Auth user created for ${user.name} (${user.email}) with ID: ${authData.user.id}`);
        }
      }

    } catch (error: any) {
      console.error('Error creating auth user:', error);
      
      if (error.message.includes('Service role key not configured')) {
        // Show detailed setup instructions
        toast({
          title: 'Configuration Required',
          description: `❗ Service role key needed. Check the setup instructions.`,
          variant: 'destructive',
        });
        
        // Show detailed setup instructions
        const instructions = `
SETUP REQUIRED: Service Role Key

To create auth users automatically, you need to add your service role key:

1. Go to your Supabase Dashboard
2. Navigate to Settings → API
3. Copy the "service_role" key (NOT the anon key)
4. Add it to your environment:
   - Create/edit .env.local file
   - Add: VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
5. Restart your development server

MANUAL ALTERNATIVE for ${user.name}:
1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User"
3. Email: ${user.email}
4. Password: ${password}
5. Auto Confirm: Yes
        `;
        
        console.log(instructions);
        
        // Create a setup instruction popup
        const alertDiv = document.createElement('div');
        alertDiv.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          border: 2px solid #dc3545;
          color: #333;
          padding: 20px;
          border-radius: 12px;
          max-width: 600px;
          max-height: 80vh;
          overflow-y: auto;
          z-index: 1000;
          font-size: 14px;
          line-height: 1.4;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        `;
        
        alertDiv.innerHTML = `
          <div style="text-align: center; margin-bottom: 20px;">
            <h3 style="color: #dc3545; margin: 0 0 10px 0;">🔧 Service Role Key Required</h3>
            <p style="margin: 0; color: #666;">To create auth users automatically, please configure your service role key:</p>
          </div>
          
          <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #721c24; margin: 0 0 10px 0;">📝 Setup Steps:</h4>
            <ol style="margin: 0; padding-left: 20px; color: #721c24;">
              <li>Go to <strong>Supabase Dashboard → Settings → API</strong></li>
              <li>Copy the <strong>"service_role"</strong> key (NOT the anon key)</li>
              <li>Create/edit <code>.env.local</code> file in your project root</li>
              <li>Add: <code>VITE_SUPABASE_SERVICE_ROLE_KEY=your_key_here</code></li>
              <li>Restart your development server</li>
            </ol>
          </div>
          
          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #856404; margin: 0 0 10px 0;">🔄 Manual Alternative for ${user.name}:</h4>
            <p style="margin: 0 0 10px 0; color: #856404;">Go to Supabase Dashboard → Authentication → Users → Add User</p>
            <div style="background: white; padding: 10px; border-radius: 4px; font-family: monospace;">
              Email: ${user.email}<br>
              Password: ${password}<br>
              Auto Confirm: Yes
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px;">
            <button onclick="this.parentElement.remove(); document.getElementById('setup-backdrop').remove();" 
                    style="background: #dc3545; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 16px;">
              Got It!
            </button>
          </div>
        `;

        // Create backdrop
        const backdrop = document.createElement('div');
        backdrop.id = 'setup-backdrop';
        backdrop.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.5);
          z-index: 999;
        `;
        backdrop.onclick = () => {
          alertDiv.remove();
          backdrop.remove();
        };

        document.body.appendChild(backdrop);
        document.body.appendChild(alertDiv);
        
      } else {
        toast({
          title: 'Error',
          description: `❌ Error: ${error.message}`,
          variant: 'destructive',
        });
      }
    }
  };

  const checkAndFixAuthUsers = async () => {
    try {
      toast({
        title: 'Info',
        description: 'Setting up auth for all users...',
      });

      // Since we can't use admin API without service role key, 
      // we'll provide instructions for manual setup
      const instructions = `
MANUAL AUTH SETUP REQUIRED

Since admin API access requires service role key, please manually add users to auth:

${users.map((user, index) => `
${index + 1}. ${user.name} (${user.email})
   - Go to Supabase Dashboard → Authentication → Users
   - Click "Add User"
   - Email: ${user.email}
   - Password: ${user.name.toLowerCase().replace(/\s+/g, '')}123
   - Auto Confirm: Yes
`).join('')}

Alternative: Ask each user to use "Forgot Password" on your login page.
      `;

      console.log(instructions);

      // Create a detailed instruction popup
      const alertDiv = document.createElement('div');
      alertDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border: 2px solid #007bff;
        color: #333;
        padding: 20px;
        border-radius: 12px;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        z-index: 1000;
        font-size: 14px;
        line-height: 1.4;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      `;
      
      const userList = users.map((user, index) => `
        <div style="background: #f8f9fa; padding: 10px; margin: 5px 0; border-radius: 6px; border-left: 4px solid #007bff;">
          <strong>${index + 1}. ${user.name}</strong><br>
          Email: <code>${user.email}</code><br>
          Suggested Password: <code>${user.name.toLowerCase().replace(/\s+/g, '')}123</code>
        </div>
      `).join('');

      alertDiv.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
          <h3 style="color: #007bff; margin: 0 0 10px 0;">🔧 Manual Auth Setup Required</h3>
          <p style="margin: 0; color: #666;">Admin API requires service role key. Please add users manually:</p>
        </div>
        
        <div style="margin: 20px 0;">
          <h4 style="color: #333; margin: 0 0 10px 0;">📋 Users to Add (${users.length} total):</h4>
          ${userList}
        </div>
        
        <div style="background: #e7f3ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h4 style="color: #0066cc; margin: 0 0 10px 0;">📝 Instructions:</h4>
          <ol style="margin: 0; padding-left: 20px;">
            <li>Go to your <strong>Supabase Dashboard</strong></li>
            <li>Navigate to <strong>Authentication → Users</strong></li>
            <li>Click <strong>"Add User"</strong> for each person above</li>
            <li>Use the email and suggested password shown</li>
            <li>Enable <strong>"Auto Confirm User"</strong></li>
          </ol>
        </div>
        
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h4 style="color: #856404; margin: 0 0 10px 0;">🔄 Alternative (User Self-Service):</h4>
          <p style="margin: 0;">Ask each user to visit your login page and click <strong>"Forgot Password"</strong> with their email.</p>
        </div>
        
        <div style="text-align: center; margin-top: 20px;">
          <button onclick="this.parentElement.remove(); document.getElementById('backdrop').remove();" 
                  style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 16px;">
            Got It!
          </button>
        </div>
      `;

      // Create backdrop
      const backdrop = document.createElement('div');
      backdrop.id = 'backdrop';
      backdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 999;
      `;
      backdrop.onclick = () => {
        alertDiv.remove();
        backdrop.remove();
      };

      document.body.appendChild(backdrop);
      document.body.appendChild(alertDiv);

      toast({
        title: 'Instructions Provided',
        description: `📋 Manual setup instructions shown for ${users.length} users. Check the popup for details.`,
      });

    } catch (error: any) {
      console.error('Error checking auth users:', error);
      toast({
        title: 'Error',
        description: `❌ Error: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Debug Section - Remove this after fixing */}
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-700">🐛 Debug Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</p>
            <p><strong>Users Array Length:</strong> {users.length}</p>
            <p><strong>Search Term:</strong> "{searchTerm}"</p>
            <p><strong>Filtered Users Length:</strong> {filteredUsers.length}</p>
            {searchTerm && (
              <div className="flex gap-2 items-center">
                <span className="text-red-600">⚠️ Search filter active!</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setSearchTerm('')}
                >
                  Clear Search Now
                </Button>
              </div>
            )}
            <p><strong>Raw Users Data:</strong></p>
            <pre className="bg-white p-2 rounded text-xs overflow-auto max-h-32">
              {JSON.stringify(users, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Simple Test Users List for backup verification */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-700">🧪 Simple Users Test (Backup)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-2"><strong>Users found:</strong> {users.length}</p>
          {users.length > 0 ? (
            <ul className="space-y-1">
              {users.map((user, index) => (
                <li key={user.id} className="text-sm p-2 bg-white rounded">
                  {index + 1}. {user.name} ({user.email}) - {user.role}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No users to display</p>
          )}
        </CardContent>
      </Card>

      {/* Users List - Moved to top for better visibility */}
      <Card>
        <CardHeader>
          <CardTitle>📋 Users List ({users.length} users loaded)</CardTitle>
          <p className="text-sm text-muted-foreground">
            {loading ? 'Loading users...' : `Showing ${filteredUsers.length} of ${users.length} users`}
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading users...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No users found in database</p>
              <Button onClick={loadUsers} className="mt-4">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Loading Users
              </Button>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p>No users found matching your search: "{searchTerm}"</p>
              <Button variant="outline" onClick={() => setSearchTerm('')} className="mt-2">
                Clear Search
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground mb-4">
                Debug info: Total users: {users.length}, Filtered: {filteredUsers.length}, Search: "{searchTerm}"
              </div>
              {filteredUsers.map((user) => (
                <div key={user.id} className="border rounded-lg p-4 space-y-3 bg-card">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="font-medium text-lg">{user.name}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                      <div className="flex gap-2">
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role}
                        </Badge>
                        <Badge
                          variant={
                            user.status === 'active'
                              ? 'default'
                              : user.status === 'pending'
                              ? 'outline'
                              : 'destructive'
                          }
                        >
                          {user.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Created: {new Date(user.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ID: {user.id}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Group Type: {user.group_type}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Company Name: {user.company_name}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedUser(user)}
                      >
                        Select for Password Reset
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => editUser(user)}
                      >
                        Edit User
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => createAuthUserForExisting(user, `${user.name.toLowerCase().replace(/\s+/g, '')}123`)}
                      >
                        Create Auth Account
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteUser(user)}
                      >
                        Delete User
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔐 Password Manager
            <Button
              variant="outline"
              size="sm"
              onClick={loadUsers}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage user passwords directly from the admin dashboard.
          </p>
          <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded">
            <strong>Debug Info:</strong> 
            Loading: {loading ? 'Yes' : 'No'} | 
            Users loaded: {users.length} | 
            Search term: "{searchTerm}" | 
            Filtered users: {filteredUsers.length}
          </div>
        </CardHeader>
      </Card>

      {/* Search Users */}
      <Card>
        <CardHeader>
          <CardTitle>🔍 Find User</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="searchUser">Search by name or email:</Label>
            <div className="flex gap-2">
              <Input
                id="searchUser"
                placeholder="Type to search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={() => setSearchTerm('')}
                disabled={!searchTerm}
              >
                Clear
              </Button>
            </div>
            {searchTerm && (
              <p className="text-sm text-muted-foreground">
                Currently filtering by: "{searchTerm}"
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Actions Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Reset User Password */}
        <Card>
          <CardHeader>
            <CardTitle>👤 Reset User Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userSelect">Select User:</Label>
              <Select
                value={selectedUser?.id || ''}
                onValueChange={(value) => {
                  const user = users.find(u => u.id === value);
                  setSelectedUser(user || null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredUsers.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password:</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password (min 6 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={resetUserPassword} className="flex-1">
                Reset Password
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Edit User */}
        <Card>
          <CardHeader>
            <CardTitle>✏️ Edit User</CardTitle>
          </CardHeader>
          <CardContent>
            {editingUser ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="editUserName">Name:</Label>
                  <Input
                    id="editUserName"
                    placeholder="Enter user name"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editUserEmail">Email:</Label>
                  <Input
                    id="editUserEmail"
                    type="email"
                    placeholder="Enter email address"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editUserRole">Role:</Label>
                  <Select
                    value={editForm.role}
                    onValueChange={(value) => setEditForm({ ...editForm, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="moderator">Moderator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editUserStatus">Status:</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editUserGroupType">Group Type:</Label>
                  <Input
                    id="editUserGroupType"
                    placeholder="Enter group type"
                    value={editForm.group_type}
                    onChange={(e) => setEditForm({ ...editForm, group_type: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editUserCompanyName">Company Name:</Label>
                  <Input
                    id="editUserCompanyName"
                    placeholder="Enter company name"
                    value={editForm.company_name}
                    onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={saveUserEdits} className="flex-1">
                    Save Changes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditingUser(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a user from the list below to edit their information.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Password Generator and User Management */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Password Generator */}
        <Card>
          <CardHeader>
            <CardTitle>🎲 Password Generator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="passwordLength">Password Length:</Label>
              <Input
                id="passwordLength"
                type="number"
                min="6"
                max="50"
                value={passwordSettings.length}
                onChange={(e) => setPasswordSettings({
                  ...passwordSettings,
                  length: parseInt(e.target.value) || 12
                })}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeUppercase"
                  checked={passwordSettings.includeUppercase}
                  onCheckedChange={(checked) => setPasswordSettings({
                    ...passwordSettings,
                    includeUppercase: checked as boolean
                  })}
                />
                <Label htmlFor="includeUppercase">Include Uppercase (A-Z)</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeLowercase"
                  checked={passwordSettings.includeLowercase}
                  onCheckedChange={(checked) => setPasswordSettings({
                    ...passwordSettings,
                    includeLowercase: checked as boolean
                  })}
                />
                <Label htmlFor="includeLowercase">Include Lowercase (a-z)</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeNumbers"
                  checked={passwordSettings.includeNumbers}
                  onCheckedChange={(checked) => setPasswordSettings({
                    ...passwordSettings,
                    includeNumbers: checked as boolean
                  })}
                />
                <Label htmlFor="includeNumbers">Include Numbers (0-9)</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeSymbols"
                  checked={passwordSettings.includeSymbols}
                  onCheckedChange={(checked) => setPasswordSettings({
                    ...passwordSettings,
                    includeSymbols: checked as boolean
                  })}
                />
                <Label htmlFor="includeSymbols">Include Symbols (!@#$%)</Label>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={generatePassword} className="flex-1">
                Generate Password
              </Button>
              <Button
                variant="outline"
                onClick={useGeneratedPassword}
                disabled={!generatedPassword}
              >
                Use This Password
              </Button>
            </div>

            {showGeneratedPassword && generatedPassword && (
              <div className="p-3 bg-muted rounded-md font-mono text-sm break-all">
                {generatedPassword}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Admin User */}
        <Card>
          <CardHeader>
            <CardTitle>👤 Create Admin User</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAdminForm(!showAdminForm);
                if (!showAdminForm) {
                  // If opening the form, generate a password
                  generatePassword();
                  setAdminForm(prev => ({ ...prev, password: generatedPassword }));
                }
              }}
            >
              {showAdminForm ? 'Hide Form' : 'Create New Admin'}
            </Button>

            {showAdminForm && (
              <div className="space-y-4 p-4 border rounded-md">
                <div className="space-y-1">
                  <Label htmlFor="admin-email">Email</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@example.com"
                    value={adminForm.email}
                    onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="admin-name">Name</Label>
                  <Input
                    id="admin-name"
                    type="text"
                    placeholder="Admin User"
                    value={adminForm.name}
                    onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="admin-role">Role</Label>
                  <Input
                    id="admin-role"
                    value={adminForm.role}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="admin-group-type">Group Type</Label>
                  <Input
                    id="admin-group-type"
                    type="text"
                    placeholder="e.g., trial, paid, internal"
                    value={adminForm.group_type}
                    onChange={(e) => setAdminForm({ ...adminForm, group_type: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="admin-company-name">Company Name</Label>
                  <Input
                    id="admin-company-name"
                    type="text"
                    placeholder="Company LLC"
                    value={adminForm.company_name}
                    onChange={(e) => setAdminForm({ ...adminForm, company_name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1 relative">
                  <Label htmlFor="admin-password">Password</Label>
                  <div className="flex">
                    <Input
                      id="admin-password"
                      type={showPassword ? "text" : "password"}
                      value={adminForm.password}
                      onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                      className="pr-10"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-6"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => {
                      generatePassword();
                      setAdminForm(prev => ({ ...prev, password: generatedPassword }));
                    }}
                  >
                    Generate Password
                  </Button>
                </div>

                <div className="space-y-2">
                  <Button 
                    className="w-full" 
                    onClick={createAdminUser}
                    disabled={creatingAdmin || !adminForm.email || !adminForm.password || !adminForm.name || !adminForm.group_type || !adminForm.company_name}
                  >
                    {creatingAdmin ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : 'Create Admin User'}
                  </Button>
                  
                  <div className="flex space-x-2 mt-2">
                    <Button 
                      variant="outline"
                      className="flex-1" 
                      onClick={createAdminUserDirectly}
                      size="sm"
                    >
                      Create User Directly
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Management Tools */}
        <Card>
          <CardHeader>
            <CardTitle>🗑️ User Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Bulk Actions:</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={exportUsers}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Users
                </Button>
                <Button
                  variant="outline"
                  onClick={generateUserStats}
                  className="flex-1"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Show Statistics
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={checkAndFixAuthUsers}
                  className="flex-1"
                >
                  🔧 Fix Auth Users
                </Button>
              </div>
            </div>

            {showStats && userStats && (
              <div className="p-4 bg-muted rounded-md space-y-3">
                <h4 className="font-semibold">📊 User Statistics</h4>
                <div className="space-y-2 text-sm">
                  <p><strong>Total Users:</strong> {userStats.total}</p>
                  <p><strong>Recent Signups (7 days):</strong> {userStats.recentSignups}</p>
                  
                  <div>
                    <strong>By Role:</strong>
                    {userStats.byRole && Object.entries(userStats.byRole).map(([role, count]) => (
                      <p key={role} className="ml-2">
                        • {role}: {count} ({userStats && Math.round(count/userStats.total*100)}%)
                      </p>
                    ))}
                  </div>
                  
                  <div>
                    <strong>By Status:</strong>
                    {userStats.byStatus && Object.entries(userStats.byStatus).map(([status, count]) => (
                      <p key={status} className="ml-2">
                        • {status}: {count} ({userStats && Math.round(count/userStats.total*100)}%)
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 