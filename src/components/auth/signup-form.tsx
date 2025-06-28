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
import { supabaseAdmin } from '@/lib/supabase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSignUp } from '@clerk/clerk-react';

const signupSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  company_name: z.string().min(1, 'Company name is required'),
  group: z.enum(['Franchisee', 'Regional']),
});

type SignupFormData = z.infer<typeof signupSchema>;

export function SignupForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { isLoaded, signUp } = useSignUp();

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      company_name: '',
      group: 'Franchisee',
    },
  });

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    
    // Check if Clerk is loaded
    if (!isLoaded) {
      setIsLoading(false);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Authentication service not available. Please try again later."
      });
      return;
    }

    try {
      // First, check if the user already exists in our Supabase users table
      if (!supabaseAdmin) {
        throw new Error('Database connection not available');
      }
      
      const { data: existingUsers, error: checkError } = await supabaseAdmin
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

      // Step 1: Create user in Clerk
      console.log('Creating user in Clerk...');
      const clerkResult = await signUp.create({
        emailAddress: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
      });
      
      // Prepare the user for email verification
      await clerkResult.prepareEmailAddressVerification({ strategy: 'email_code' });
      
      // Get the Clerk user ID
      const clerkUserId = clerkResult.createdUserId;
      console.log('Clerk user created with ID:', clerkUserId);
      
      if (!clerkUserId) {
        throw new Error('Failed to create user account');
      }

      // Step 2: Create a new user record in Supabase with the Clerk user ID
      console.log('Creating user in Supabase with Clerk ID...');
      if (!supabaseAdmin) {
        throw new Error('Database connection not available');
      }
      
      const { error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          email: data.email,
          first_name: data.firstName,
          last_name: data.lastName,
          role: 'user',
          group_type: data.group,
          company_name: data.company_name,
          status: 'pending',
          clerk_id: clerkUserId // Store the Clerk user ID for mapping
        });
        
      if (insertError) {
        console.error('Error inserting user data:', insertError);
        throw insertError;
      }
      
      console.log('User created with pending status and Clerk ID mapping');
      
      toast({
        title: 'Registration Successful',
        description: 'Your account has been created. Please verify your email to continue.',
      });
      
      // Redirect to verification page
      window.location.href = `/verify?email=${encodeURIComponent(data.email)}`;
      
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
              disabled={isLoading}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>
          
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