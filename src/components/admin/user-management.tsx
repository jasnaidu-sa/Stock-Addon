import React, { useState, useEffect } from 'react';
import { Loader2, Plus, Search, RefreshCw, Mail, MoreHorizontal } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase, supabaseAdmin } from '@/lib/supabase';
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
}

interface NewUserData {
  email: string;
  name: string;
  role: string;
  group: 'Franchisee' | 'Regional';
  company_name: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewUserDialogOpen, setIsNewUserDialogOpen] = useState(false);
  const [newUserData, setNewUserData] = useState<NewUserData>({
    email: '',
    name: '',
    role: 'user',
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

      // Fetch all users with direct columns
      const { data, error } = await supabase
        .from('users')
        .select('id, email, name, role, group_type, company_name, created_at, last_sign_in_at, status')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        throw error;
      }

      console.log('Raw users data:', data);

      // Transform the data to match our interface, with null checks
      const transformedUsers = (data || []).map(user => ({
        id: user.id,
        email: user.email || '',
        name: user.name || '',
        role: user.role || 'user',
        group: (user.group_type || null) as 'Franchisee' | 'Regional' | null,
        company_name: user.company_name || null,
        created_at: user.created_at || new Date().toISOString(),
        last_sign_in_at: user.last_sign_in_at || null,
        status: (user.status || 'pending') as 'pending' | 'active' | 'disabled',
      }));

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
      if (!newUserData.email || !newUserData.name) {
        throw new Error('Email and name are required');
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
      
      // Create a new user record with pending status
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          email: newUserData.email,
          name: newUserData.name,
          role: newUserData.role,
          group_type: newUserData.group,
          company_name: newUserData.company_name,
          status: 'pending'
        });
        
      if (insertError) {
        console.error('Error inserting user data:', insertError);
        throw insertError;
      }
      
      console.log('User created with pending status');
      
      toast({
        title: 'Success',
        description: `User ${newUserData.email} created with pending status. They will need to be approved before they can log in.`,
      });
      
      // Reset form and close dialog
      setNewUserData({
        email: '',
        name: '',
        role: 'user',
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
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail);
      
      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Password reset email sent',
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
    // Ensure the target role is valid ('admin' or 'user')
    if (!['admin', 'user'].includes(newRole)) {
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
      setLoading(true); // Indicate loading state for the specific user or globally
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
    } finally {
      setLoading(false); // Reset loading state
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
                <Plus className="h-4 w-4 mr-2" />
                New User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Create a new user account. The user will need to be approved before they can log in.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUserData.email}
                    onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={newUserData.name}
                    onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="company">Company Name</Label>
                  <Input
                    id="company"
                    value={newUserData.company_name}
                    onChange={(e) => setNewUserData({ ...newUserData, company_name: e.target.value })}
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
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="user">User</SelectItem>
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
            No users found
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
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
                  <TableCell>{user.company_name || '-'}</TableCell>
                  <TableCell>{user.group || '-'}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
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
                  <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      {user.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApproveUser(user.id)}
                        >
                          Approve
                        </Button>
                      )}
                      {user.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDisableUser(user.id)}
                        >
                          Disable
                        </Button>
                      )}
                      {user.status === 'disabled' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApproveUser(user.id)}
                        >
                          Enable
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResetPassword(user.id, user.email)}
                      >
                        Reset Password
                      </Button>
                    </div>
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