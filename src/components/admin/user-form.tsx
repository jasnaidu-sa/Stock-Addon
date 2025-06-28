import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createUser, updateUserMetadata, updateUserInSupabase } from '../../lib/clerk-admin';

const userSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  username: z.string().min(3, 'Username must be at least 3 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  company_name: z.string().min(1, 'Company name is required'),
  group: z.enum(['Franchisee', 'Regional']),
  role: z.enum(['user', 'admin']),
});

export type UserFormData = z.infer<typeof userSchema>;

interface UserFormProps {
  onSuccess?: () => void;
  initialData?: Partial<UserFormData>;
  isEdit?: boolean;
  userId?: string;
  clerkId?: string;
}

export function UserForm({ onSuccess, initialData, isEdit = false, userId, clerkId }: UserFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // For edit mode, password is optional
  const formSchema = isEdit 
    ? userSchema.omit({ password: true }) 
    : userSchema;

  const form = useForm<UserFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: initialData?.email || '',
      username: initialData?.username || '',
      password: initialData?.password || '',
      firstName: initialData?.firstName || '',
      lastName: initialData?.lastName || '',
      company_name: initialData?.company_name || '',
      group: initialData?.group || 'Franchisee',
      role: initialData?.role || 'user',
    },
  });

  const onSubmit = async (data: UserFormData) => {
    setIsLoading(true);
    
    try {
      if (!isEdit) {
        // Create new user
        // Log what we're about to send for debugging
        console.log('Creating user with data:', {
          email: data.email,
          username: data.username,
          passwordLength: data.password ? data.password.length : 0,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
          groupType: data.group,
          companyName: data.company_name
        });
        
        const newClerkId = await createUser({
          emailAddress: data.email,
          username: data.username,
          password: data.password || '',
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
          groupType: data.group,
          companyName: data.company_name
        });
        
        if (!newClerkId) {
          throw new Error('Failed to create user account');
        }
        
        toast({
          title: 'User Created',
          description: `User ${data.firstName} ${data.lastName} has been created successfully.`,
        });
      } else if (userId && clerkId) {
        // Update existing user
        await updateUserMetadata(clerkId, { role: data.role });
        
        // Update user details in Supabase
        await updateUserInSupabase(userId, {
          first_name: data.firstName,
          last_name: data.lastName,
          role: data.role,
          group_type: data.group,
          company_name: data.company_name,
        });
        
        toast({
          title: 'User Updated',
          description: `User ${data.firstName} ${data.lastName} has been updated successfully.`,
        });
      }
      
      form.reset();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('User Form Error:', error);
      
      let errorMessage = isEdit ? 'Failed to update user' : 'Failed to create user';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{isEdit ? 'Edit User' : 'Create New User'}</CardTitle>
        <CardDescription>
          {isEdit 
            ? 'Update user details in both Clerk and Supabase.'
            : 'Create a new user account. This will create the user in both Clerk and Supabase.'}
        </CardDescription>
      </CardHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                type="text"
                autoComplete="given-name"
                {...form.register('firstName')}
                className={form.formState.errors.firstName ? 'border-destructive' : ''}
                disabled={isLoading}
              />
              {form.formState.errors.firstName && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.firstName.message}
                </p>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                type="text"
                autoComplete="family-name"
                {...form.register('lastName')}
                className={form.formState.errors.lastName ? 'border-destructive' : ''}
                disabled={isLoading}
              />
              {form.formState.errors.lastName && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.lastName.message}
                </p>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...form.register('email')}
              className={form.formState.errors.email ? 'border-destructive' : ''}
              disabled={isLoading || isEdit} // Email can't be changed in edit mode
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              {...form.register('username')}
              className={form.formState.errors.username ? 'border-destructive' : ''}
              disabled={isLoading || isEdit} // Username can't be changed in edit mode
            />
            {form.formState.errors.username && (
              <p className="text-sm text-destructive">
                {form.formState.errors.username.message}
              </p>
            )}
          </div>
          
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...form.register('password')}
                className={form.formState.errors.password ? 'border-destructive' : ''}
                disabled={isLoading}
              />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="company_name">Company Name</Label>
            <Input
              id="company_name"
              type="text"
              {...form.register('company_name')}
              className={form.formState.errors.company_name ? 'border-destructive' : ''}
              disabled={isLoading}
            />
            {form.formState.errors.company_name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.company_name.message}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="group">Group</Label>
            <Select
              defaultValue={form.getValues('group')}
              onValueChange={(value) => form.setValue('group', value as 'Franchisee' | 'Regional')}
              disabled={isLoading}
            >
              <SelectTrigger className={form.formState.errors.group ? 'border-destructive' : ''}>
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Franchisee">Franchisee</SelectItem>
                <SelectItem value="Regional">Regional</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.group && (
              <p className="text-sm text-destructive">
                {form.formState.errors.group.message}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              defaultValue={form.getValues('role')}
              onValueChange={(value) => form.setValue('role', value as 'user' | 'admin')}
              disabled={isLoading}
            >
              <SelectTrigger className={form.formState.errors.role ? 'border-destructive' : ''}>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.role && (
              <p className="text-sm text-destructive">
                {form.formState.errors.role.message}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end space-x-2">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => onSuccess?.()}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Update User' : 'Create User'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
