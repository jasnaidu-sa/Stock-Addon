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

const authSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  name: z.string().optional(),
});

type AuthFormData = z.infer<typeof authSchema>;

export function AuthForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const { toast } = useToast();

  const form = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: '',
      password: '',
      name: '',
    },
  });

  const onSubmit = async (data: AuthFormData) => {
    setIsLoading(true);
    console.log('=== Starting Authentication Process ===');

    try {
      if (isResetPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });

        if (error) throw error;

        toast({
          title: 'Password Reset Email Sent',
          description: 'Please check your email for the reset link',
        });
        setIsResetPassword(false);
      } else if (isSignUp) {
        console.log('Starting signup process...');
        // First sign up the user
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              name: data.name,
            },
          },
        });

        if (signUpError) {
          console.error('Signup error:', signUpError);
          throw signUpError;
        }
        
        if (!authData.user) {
          console.error('No user data returned from signup');
          throw new Error('Failed to create user');
        }

        console.log('User created successfully, creating profile...');

        // Then create the user profile
        const { error: userError } = await supabase.from('users').insert([
          {
            id: authData.user.id,
            name: data.name,
            email: data.email,
            role: 'customer',
          },
        ]);

        if (userError) {
          console.error('Profile creation error:', userError);
          throw userError;
        }

        console.log('Profile created successfully');

        toast({
          title: 'Account created',
          description: 'Please check your email to verify your account',
        });
        setIsSignUp(false);
      } else {
        console.log('Starting signin process...');
        // Login Process
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

        if (signInError) {
          console.error('Signin error:', signInError);
          throw signInError;
        }

        if (!signInData?.user) {
          console.error('No user data received from signin');
          throw new Error('No user data received');
        }

        console.log('Signin successful, verifying session...');

        // Verify the session was created
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('Session verification error:', sessionError);
          throw sessionError;
        }

        if (!session) {
          console.error('No session created after signin');
          throw new Error('Failed to create session');
        }

        console.log('Session verified successfully');

        toast({
          title: 'Welcome back!',
          description: 'Successfully signed in',
        });
      }
      form.reset();
    } catch (error) {
      console.error('Authentication Error:', error);
      
      let errorMessage = 'Authentication failed';
      if (error instanceof Error) {
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Please verify your email address';
        } else if (error.message.includes('Invalid API key')) {
          errorMessage = 'Authentication service error. Please try again later.';
          console.error('API Key error - check environment variables');
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: 'Authentication Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{isResetPassword ? 'Reset Password' : isSignUp ? 'Create Account' : 'Sign In'}</CardTitle>
        <CardDescription>
          {isResetPassword
            ? 'Enter your email to receive a password reset link'
            : isSignUp
            ? 'Enter your details to create a new account'
            : 'Enter your credentials to access your account'}
        </CardDescription>
      </CardHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          {isSignUp && !isResetPassword && (
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
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
          )}
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
          {!isResetPassword && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
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
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isResetPassword ? 'Send Reset Link' : isSignUp ? 'Create Account' : 'Sign In'}
          </Button>
          
          {!isResetPassword && (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                if (isSignUp) {
                  setIsSignUp(false);
                } else {
                  window.location.href = '/auth/signup';
                }
                form.reset();
              }}
              disabled={isLoading}
            >
              {isSignUp
                ? 'Already have an account? Sign In'
                : "Don't have an account? Sign Up"}
            </Button>
          )}
          
          {!isSignUp && !isResetPassword && (
            <Button
              type="button"
              variant="link"
              className="w-full"
              onClick={() => {
                setIsResetPassword(true);
                setIsSignUp(false);
                form.reset();
              }}
              disabled={isLoading}
            >
              Forgot your password?
            </Button>
          )}
          
          {isResetPassword && (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setIsResetPassword(false);
                form.reset();
              }}
              disabled={isLoading}
            >
              Back to Sign In
            </Button>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}