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
import { supabase } from '@/lib/supabase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const signupSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  name: z.string().min(1, 'Name is required'),
  company_name: z.string().min(1, 'Company name is required'),
  group: z.enum(['Franchisee', 'Regional']),
});

type SignupFormData = z.infer<typeof signupSchema>;

export function SignupForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      name: '',
      company_name: '',
      group: 'Franchisee',
    },
  });

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    console.log('=== Starting Registration Process ===');

    try {
      // First, check if the user already exists in our users table
      const { data: existingUsers, error: checkError } = await supabase
        .from('users')
        .select('email')
        .eq('email', data.email)
        .limit(1);
        
      if (checkError) {
        console.error('Error checking existing user:', checkError);
        throw checkError;
      }
      
      if (existingUsers && existingUsers.length > 0) {
        throw new Error('An account with this email already exists');
      }

      // Create a new user record with pending status
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          email: data.email,
          name: data.name,
          role: 'user',
          group_type: data.group,
          company_name: data.company_name,
          status: 'pending'
        });
        
      if (insertError) {
        console.error('Error inserting user data:', insertError);
        throw insertError;
      }
      
      console.log('User created with pending status');
      
      toast({
        title: 'Registration Successful',
        description: 'Your account has been created and is pending approval. You will be notified when your account is approved.',
      });
      
      form.reset();
    } catch (error) {
      console.error('Registration Error:', error);
      
      let errorMessage = 'Registration failed';
      if (error instanceof Error) {
        if (error.message.includes('duplicate key')) {
          errorMessage = 'An account with this email already exists';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: 'Registration Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
        <CardDescription>
          Enter your details to request a new account. An administrator will review and approve your request.
        </CardDescription>
      </CardHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              {...form.register('name')}
              className={form.formState.errors.name ? 'border-destructive' : ''}
              disabled={isLoading}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...form.register('email')}
              className={form.formState.errors.email ? 'border-destructive' : ''}
              disabled={isLoading}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>
          
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
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Request Account
          </Button>
          
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              window.location.href = '/auth';
            }}
            disabled={isLoading}
          >
            Back to Sign In
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
} 