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
import { getSupabaseClient } from '@/lib/supabase';;

const authSchema = z.object({
  emailOrUsername: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
  name: z.string().optional(),
});

type AuthFormData = z.infer<typeof authSchema>;

export function AuthForm() {
  
  const supabase = getSupabaseClient(); // Initialize Supabase clientconst [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const { toast } = useToast();

  const form = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      emailOrUsername: '',
      password: '',
      name: '',
    },
  });

  // Helper function to determine if input is email or username
  const isEmail = (input: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(input);
  };

  // Helper function to find user by username
  const findUserByUsername = async (username: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('email')
      .eq('name', username)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data.email;
  };

  const onSubmit = async (data: AuthFormData) => {
    setIsLoading(true);
    console.log('=== Starting Authentication Process ===');

    try {
      if (isResetPassword) {
        // For password reset, we need an email
        let email = data.emailOrUsername;
        
        if (!isEmail(email)) {
          // If it's a username, try to find the email
          const userEmail = await findUserByUsername(email);
          if (!userEmail) {
            throw new Error('User not found. Please use your email address for password reset.');
          }
          email = userEmail;
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
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
        
        // For signup, emailOrUsername should be an email
        if (!isEmail(data.emailOrUsername)) {
          throw new Error('Please enter a valid email address for signup');
        }
        
        // First sign up the user
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: data.emailOrUsername,
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
            email: data.emailOrUsername,
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
        
        let email = data.emailOrUsername;
        
        // If it's not an email, try to find the email by username
        if (!isEmail(data.emailOrUsername)) {
          console.log('Input appears to be a username, looking up email...');
          const userEmail = await findUserByUsername(data.emailOrUsername);
          if (!userEmail) {
            throw new Error('User not found. Please check your username or email.');
          }
          email = userEmail;
          console.log('Found email for username:', email);
        }
        
        // Login Process
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: email,
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
          errorMessage = 'Invalid email/username or password';
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
            ? 'Enter your email or username to receive a password reset link'
            : isSignUp
            ? 'Enter your details to create a new account'
            : 'Enter your email/username and password to access your account'}
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
            <Label htmlFor="emailOrUsername">
              {isSignUp ? 'Email' : 'Email or Username'}
            </Label>
            <Input
              id="emailOrUsername"
              type={isSignUp ? 'email' : 'text'}
              autoComplete={isSignUp ? 'email' : 'username'}
              placeholder={isSignUp ? 'Enter your email' : 'Enter email or username'}
              {...form.register('emailOrUsername')}
              className={form.formState.errors.emailOrUsername ? 'border-destructive' : ''}
              disabled={isLoading}
            />
            {form.formState.errors.emailOrUsername && (
              <p className="text-sm text-destructive">
                {form.formState.errors.emailOrUsername.message}
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