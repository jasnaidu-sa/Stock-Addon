import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit3, Trash2, RefreshCw, Key, UserPlus } from 'lucide-react';
import { fetchUsers, deleteUser, resetUserPassword } from '@/lib/clerk-admin';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserForm } from '@/components/admin/user-form';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface User {
  id: string;
  firstName: string | null;
  lastName: string | null;
  emailAddress: string;
  publicMetadata: Record<string, any>;
  createdAt: Date;
  lastSignInAt: Date | null;
  supabaseData?: {
    id: string;
    role: string;
    group_type: string;
    company_name: string;
    status: string;
  };
}

const AdminUserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isPasswordResetting, setIsPasswordResetting] = useState(false);
  const { toast } = useToast();

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const userList = await fetchUsers();
      // Ensure the type is compatible with our User interface
      setUsers(userList as unknown as User[]);
    } catch (err: any) {
      console.error('Error loading users:', err);
      setError(err.message || 'An unknown error occurred');
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Function removed as back button is no longer needed

  const handleAddUser = () => {
    setIsAddUserOpen(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsEditUserOpen(true);
  };

  const handleResetPassword = (user: User) => {
    setSelectedUser(user);
    setNewPassword('');
    setIsResetPasswordOpen(true);
  };

  const handleDeleteUser = async (user: User) => {
    if (!user.supabaseData?.id) {
      toast({
        title: 'Error',
        description: 'User does not have associated database record',
        variant: 'destructive',
      });
      return;
    }

    if (window.confirm(`Are you sure you want to delete user ${user.firstName || ''} ${user.lastName || ''}? This action cannot be undone.`)) {
      try {
        setIsLoading(true);
        await deleteUser(user.supabaseData.id, user.id);
        toast({
          title: 'User Deleted',
          description: 'User has been successfully deleted',
        });
        await loadUsers();
      } catch (err: any) {
        console.error('Error deleting user:', err);
        toast({
          title: 'Error',
          description: err.message || 'Failed to delete user',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handlePasswordReset = async () => {
    if (!selectedUser || !newPassword) return;

    try {
      setIsPasswordResetting(true);
      await resetUserPassword(selectedUser.id, newPassword);
      toast({
        title: 'Password Reset',
        description: 'Password has been successfully reset',
      });
      setIsResetPasswordOpen(false);
    } catch (err: any) {
      console.error('Error resetting password:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to reset password',
        variant: 'destructive',
      });
    } finally {
      setIsPasswordResetting(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6 min-h-[800px]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <h2 className="text-3xl font-bold">User Management</h2>
        </div>
        <Button onClick={handleAddUser}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center p-8">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="p-4 text-center">
              <h3 className="text-xl font-semibold text-red-500 mb-2">Error Loading Users</h3>
              <p className="mb-4">{error}</p>
              <p className="mb-4 text-gray-600">
                Admin functionality for Clerk users requires additional setup. You may need to:
              </p>
              <ul className="text-left text-gray-600 list-disc pl-6 mb-4">
                <li>Install the Clerk Admin SDK on your backend</li>
                <li>Create backend API endpoints for user management</li>
                <li>Set up proper permissions and API keys</li>
              </ul>
              <Button onClick={() => loadUsers()} variant="outline">
                Retry Loading Users
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">No users found</p>
              <Button onClick={handleAddUser}>
                <UserPlus className="mr-2 h-4 w-4" /> Create First User
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full min-w-[1000px]">
          <CardContent className="p-6">
            <Table className="w-full min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.firstName || ''} {user.lastName || ''}
                </TableCell>
                <TableCell>{user.emailAddress}</TableCell>
                <TableCell>
                  <Badge variant={user.supabaseData?.role === 'admin' ? 'default' : 'outline'}>
                    {user.supabaseData?.role || user.publicMetadata?.role || 'user'}
                  </Badge>
                </TableCell>
                <TableCell>{user.supabaseData?.group_type || '-'}</TableCell>
                <TableCell>{user.supabaseData?.company_name || '-'}</TableCell>
                <TableCell>
                  <Badge variant={user.supabaseData?.status === 'active' ? 'default' : 'secondary'}>
                    {user.supabaseData?.status || 'pending'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleResetPassword(user)} 
                    className="mr-1"
                    title="Reset Password"
                  >
                    <Key className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleEditUser(user)} 
                    className="mr-1"
                    title="Edit User"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDeleteUser(user)} 
                    className="text-red-500 hover:text-red-600"
                    title="Delete User"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
          </CardContent>
        </Card>
      )}

      {/* Add User Dialog */}
      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account. This will create the user in both Clerk and Supabase.
            </DialogDescription>
          </DialogHeader>
          <UserForm 
            onSuccess={() => {
              setIsAddUserOpen(false);
              loadUsers();
            }} 
          />
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information in both Clerk and Supabase.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && selectedUser.supabaseData && (
            <UserForm 
              isEdit 
              userId={selectedUser.supabaseData.id}
              clerkId={selectedUser.id}
              initialData={{
                email: selectedUser.emailAddress,
                firstName: selectedUser.firstName || '',
                lastName: selectedUser.lastName || '',
                company_name: selectedUser.supabaseData.company_name,
                group: selectedUser.supabaseData.group_type as any,
                role: selectedUser.supabaseData.role as any,
              }}
              onSuccess={() => {
                setIsEditUserOpen(false);
                setSelectedUser(null);
                loadUsers();
              }} 
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter a new password for {selectedUser?.firstName} {selectedUser?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input 
                id="new-password" 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full"
              />
            </div>
            <Button 
              onClick={handlePasswordReset} 
              disabled={!newPassword || isPasswordResetting}
              className="w-full"
            >
              {isPasswordResetting && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Reset Password
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUserManagementPage;
