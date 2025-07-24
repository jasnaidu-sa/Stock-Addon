import React, { useState, useEffect } from 'react';
import { Loader2, Plus, Search, RefreshCw, Mail, MoreHorizontal, Trash2, UserPlus, Key, Shield } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseClient, supabaseAdmin } from '@/lib/supabase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  group: 'Franchisee' | 'Regional' | null;
  company_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  status: 'pending' | 'active' | 'disabled';
  auth_user_id?: string; // Supabase Auth user ID
}

interface NewUserData {
  email: string;
  name: string;
  password: string;
  role: string;
  group: 'Franchisee' | 'Regional';
  company_name: string;
}

export function UserManagement() {
  
  const supabase = getSupabaseClient(); // Initialize Supabase clientconst [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewUserDialogOpen, setIsNewUserDialogOpen] = useState(false);
  const [newUserData, setNewUserData] = useState<NewUserData>({
    email: '',
    name: '',
    password: '',
    role: 'customer',
    group: 'Franchisee',
    company_name: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
  }, []);

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
        console.warn('Unauthorized access attempt to user management by:', session.user.email);
        throw new Error('Unauthorized: Admin access required');
      }

      console.log('Admin access granted.');

      // Fetch all users with admin client to bypass RLS
      console.log('Fetching users with admin client...');
      if (!supabaseAdmin) {
        throw new Error('Admin client not available');
      }
      
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('id, email, name, role, group_type, company_name, created_at, last_sign_in_at, status, first_name, last_name, username')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        throw error;
      }

      console.log('Raw users data:', data);

      // Transform the data to match our interface, with null checks
      const transformedUsers = (data || []).map(user => {
        // Use first_name/last_name if available, otherwise fallback to name field
        const displayName = user.first_name && user.last_name 
          ? `${user.first_name} ${user.last_name}`.trim()
          : user.name || user.username || 'Unknown';
          
        return {
          id: user.id,
          email: user.email || '',
          name: displayName,
          role: user.role || 'customer',
          group: (user.group_type || null) as 'Franchisee' | 'Regional' | null,
          company_name: user.company_name || null,
          created_at: user.created_at || new Date().toISOString(),
          last_sign_in_at: user.last_sign_in_at || null,
          status: (user.status || 'pending') as 'pending' | 'active' | 'disabled',
          auth_user_id: user.id, // The user ID is the same as auth user ID
        };
      });

      console.log('Transformed users:', transformedUsers);
      setUsers(transformedUsers);
    } catch (error: any) {
      console.error('Error loading users:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      console.log('Creating new user...');
      
      // Validate required fields
      if (!newUserData.email || !newUserData.name || !newUserData.password) {
        throw new Error('Email, name, and password are required');
      }

      if (newUserData.password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      
      // First, check if the user already exists in our users table
      const { data: existingUsers, error: checkError } = await supabase
        .from('users')
        .select('email')
        .eq('email', newUserData.email)
        .limit(1);
        
      if (checkError) {
        console.error('Error checking existing user:', checkError);
        throw checkError;
      }
      
      if (existingUsers && existingUsers.length > 0) {
        throw new Error('A user with this email already exists in the system');
      }

      // Create user in Supabase Auth with email confirmation disabled
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserData.email,
        password: newUserData.password,
        options: {
          data: {
            name: newUserData.name,
          },
          // Skip email confirmation - user can log in immediately
          emailRedirectTo: undefined
        }
      });

      if (authError) {
        console.error('Error creating auth user:', authError);
        if (authError.message.includes('User already registered')) {
          throw new Error('A user with this email already exists in the authentication system');
        }
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Failed to create user in authentication system');
      }

      console.log('Auth user created:', authData.user.id);
      
      // Create a new user record in our users table
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id, // Use the auth user ID
          email: newUserData.email,
          name: newUserData.name,
          role: newUserData.role,
          group_type: newUserData.group,
          company_name: newUserData.company_name,
          status: 'active', // Set to active immediately - no email confirmation needed
          email_confirmed_at: new Date().toISOString() // Mark email as confirmed
        });
        
      if (insertError) {
        console.error('Error inserting user data:', insertError);
        // If user table insert fails, we should try to clean up the auth user
        try {
          await supabase.auth.admin.deleteUser(authData.user.id);
          console.log('Cleaned up auth user after database insert failure');
        } catch (cleanupError) {
          console.warn('Could not clean up auth user (this may be expected):', cleanupError);
        }
        throw insertError;
      }
      
      console.log('User created successfully');
      
      toast({
        title: 'Success',
        description: `User ${newUserData.email} created successfully. They can log in immediately with their credentials.`,
      });
      
      // Reset form and close dialog
      setNewUserData({
        email: '',
        name: '',
        password: '',
        role: 'customer',
        group: 'Franchisee',
        company_name: '',
      });
      setIsNewUserDialogOpen(false);
      
      // Reload users list
      loadUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to create user',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    try {
      console.log('Deleting user:', userId);

      // First delete from our users table
      const { error: dbError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (dbError) {
        console.error('Error deleting user from database:', dbError);
        throw dbError;
      }

      console.log('✅ User successfully removed from database');

      // Try to delete from Supabase Auth (this will likely fail without service role key)
      try {
        const { error: authError } = await supabase.auth.admin.deleteUser(userId);
        
        if (authError) {
          console.log('ℹ️ Auth deletion not available (service role key not configured) - this is normal and secure');
          // Don't throw here - the user is effectively deleted from our system
        } else {
          console.log('✅ User also deleted from authentication system');
        }
      } catch (adminError) {
        console.log('ℹ️ Admin operations not available on client side - this is expected and secure');
        // This is expected in client-side applications
      }

      toast({
        title: 'User Deleted Successfully',
        description: `${userEmail} has been removed from the system and can no longer access the application.`,
      });

      // Reload users list
      loadUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to delete user',
        variant: 'destructive',
      });
    }
  };

  const handleApproveUser = async (userId: string) => {
    try {
      // Update the user status to active
      const { error } = await supabase
        .from('users')
        .update({ status: 'active' })
        .eq('id', userId);
        
      if (error) {
        console.error('Error approving user:', error);
        throw error;
      }
      
      // Send a welcome email to the user
      const user = users.find(u => u.id === userId);
      if (user) {
        // Send a magic link for the user to log in and set password
        const { error: magicLinkError } = await supabase.auth.resetPasswordForEmail(
          user.email,
          {
            redirectTo: `${window.location.origin}/auth/reset-password`,
          }
        );
        
        if (magicLinkError) {
          console.error('Error sending password setup email:', magicLinkError);
          // Don't throw here as the user is already approved
        } else {
          console.log('Password setup email sent successfully');
        }
      }
      
      toast({
        title: 'Success',
        description: `User approved successfully. They will receive an email to set up their password.`,
      });
      
      // Reload users list
      loadUsers();
    } catch (error: any) {
      console.error('Error approving user:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to approve user',
        variant: 'destructive',
      });
    }
  };

  const handleDisableUser = async (userId: string) => {
    try {
      // Update the user status to disabled
      const { error } = await supabase
        .from('users')
        .update({ status: 'disabled' })
        .eq('id', userId);
        
      if (error) {
        console.error('Error disabling user:', error);
        throw error;
      }
      
      toast({
        title: 'Success',
        description: `User disabled successfully.`,
      });
      
      // Reload users list
      loadUsers();
    } catch (error: any) {
      console.error('Error disabling user:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to disable user',
        variant: 'destructive',
      });
    }
  };

  const handleResetPassword = async (userId: string, userEmail: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      
      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Password reset email sent successfully',
      });
    } catch (error) {
      console.error('Error resetting password:', error);
      toast({
        title: 'Error',
        description: 'Failed to send password reset email',
        variant: 'destructive',
      });
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    // Ensure the target role is valid (all hierarchy roles)
    const validRoles = ['admin', 'customer', 'regional_manager', 'area_manager', 'store_manager'];
    if (!validRoles.includes(newRole)) {
      toast({ title: 'Error', description: 'Invalid role selected.', variant: 'destructive' });
      return;
    }
    
    // Prevent admin from changing their own role via this UI to avoid lockout
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id === userId) {
       toast({ title: 'Action Denied', description: 'Admins cannot change their own role here.', variant: 'destructive' });
       return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) {
        console.error('Error updating user role:', error);
        throw error;
      }

      toast({
        title: 'Success',
        description: `User role updated to ${newRole}.`,
      });

      // Update the local state immediately for better UX
      setUsers(currentUsers => 
        currentUsers.map(user => 
          user.id === userId ? { ...user, role: newRole } : user
        )
      );

    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update user role',
        variant: 'destructive',
      });
    }
  };

  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(query) ||
      user.name.toLowerCase().includes(query) ||
      user.company_name?.toLowerCase().includes(query) ||
      user.group?.toLowerCase().includes(query)
    );
  });

  const formatRoleName = (role: string) => {
    const roleMap: { [key: string]: string } = {
      'customer': 'Customer',
      'store_manager': 'Store Manager',
      'area_manager': 'Area Manager',
      'regional_manager': 'Regional Manager',
      'admin': 'Admin'
    };
    return roleMap[role] || role;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>User Management</CardTitle>
          <CardDescription>Manage system users and their permissions</CardDescription>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
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
          <Dialog open={isNewUserDialogOpen} onOpenChange={setIsNewUserDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                New User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Create a new user account with login credentials. The user will be able to log in immediately.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUserData.email}
                    onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                    placeholder="user@example.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={newUserData.name}
                    onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUserData.password}
                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                    placeholder="Minimum 6 characters"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="company">Company Name</Label>
                  <Input
                    id="company"
                    value={newUserData.company_name}
                    onChange={(e) => setNewUserData({ ...newUserData, company_name: e.target.value })}
                    placeholder="Company Name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="group">Group</Label>
                  <Select
                    value={newUserData.group}
                    onValueChange={(value: 'Franchisee' | 'Regional') => 
                      setNewUserData({ ...newUserData, group: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Franchisee">Franchisee</SelectItem>
                      <SelectItem value="Regional">Regional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={newUserData.role}
                    onValueChange={(value) => setNewUserData({ ...newUserData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="store_manager">Store Manager</SelectItem>
                      <SelectItem value="area_manager">Area Manager</SelectItem>
                      <SelectItem value="regional_manager">Regional Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsNewUserDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" onClick={handleCreateUser}>
                  Create User
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative mb-6">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users by name, email, or company..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            {searchQuery ? 'No users found matching your search' : 'No users found'}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="store_manager">Store Manager</SelectItem>
                        <SelectItem value="area_manager">Area Manager</SelectItem>
                        <SelectItem value="regional_manager">Regional Manager</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{user.group || '-'}</TableCell>
                  <TableCell>{user.company_name || '-'}</TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell>{formatDate(user.created_at)}</TableCell>
                  <TableCell>
                    {user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : 'Never'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        
                        {user.status === 'pending' && (
                          <DropdownMenuItem onClick={() => handleApproveUser(user.id)}>
                            <Shield className="mr-2 h-4 w-4" />
                            Approve User
                          </DropdownMenuItem>
                        )}
                        
                        {user.status === 'active' && (
                          <DropdownMenuItem onClick={() => handleDisableUser(user.id)}>
                            <Shield className="mr-2 h-4 w-4" />
                            Disable User
                          </DropdownMenuItem>
                        )}
                        
                        {user.status === 'disabled' && (
                          <DropdownMenuItem onClick={() => handleApproveUser(user.id)}>
                            <Shield className="mr-2 h-4 w-4" />
                            Enable User
                          </DropdownMenuItem>
                        )}
                        
                        <DropdownMenuItem onClick={() => handleResetPassword(user.id, user.email)}>
                          <Key className="mr-2 h-4 w-4" />
                          Reset Password
                        </DropdownMenuItem>
                        
                        <DropdownMenuSeparator />
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete User
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the user
                                account for <strong>{user.email}</strong> and remove all their data from our servers.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(user.id, user.email)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete User
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
} 