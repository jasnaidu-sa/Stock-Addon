import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSignIn, useSignUp } from '@clerk/clerk-react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function VerifyPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const { isLoaded: isSignUpLoaded, signUp, setActive } = useSignUp();
  const { isLoaded: isSignInLoaded, signIn } = useSignIn();
  const { toast } = useToast();

  useEffect(() => {
    // If no email is provided, redirect to signup
    if (!email && isSignUpLoaded) {
      window.location.href = '/auth/signup';
    }
  }, [email, isSignUpLoaded]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isSignUpLoaded) {
      toast({
        title: 'Error',
        description: 'Authentication service not available. Please try again later.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const verification = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      });
      
      if (verification.status === 'complete') {
        // Set the user as active
        await setActive({ session: verification.createdSessionId });
        
        toast({
          title: 'Verification Successful',
          description: 'Your email has been verified. You are now signed in.',
        });
        
        // Redirect to dashboard
        window.location.href = '/dashboard';
      } else {
        toast({
          title: 'Verification Error',
          description: 'Unable to verify your email. Please check the code and try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Verification Error:', error);
      
      toast({
        title: 'Verification Error',
        description: error instanceof Error ? error.message : 'Failed to verify email',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!isSignUpLoaded) {
      toast({
        title: 'Error',
        description: 'Authentication service not available. Please try again later.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsResending(true);
    
    try {
      // Try to prepare email verification through sign up
      await signUp.prepareEmailAddressVerification({ 
        strategy: 'email_code'
      });
      
      toast({
        title: 'Code Sent',
        description: 'A new verification code has been sent to your email.',
      });
    } catch (error) {
      console.error('Resend Error:', error);
      
      // If sign up preparation fails, try through sign in
      if (isSignInLoaded) {
        try {
          const { supportedFirstFactors } = await signIn.create({
            identifier: email,
          });
          
          const emailFactor = supportedFirstFactors?.find(
            (factor) => factor.strategy === 'email_code'
          );
          
          if (emailFactor && 'emailAddressId' in emailFactor) {
            await signIn.prepareFirstFactor({
              strategy: 'email_code',
              emailAddressId: emailFactor.emailAddressId,
            });
            
            toast({
              title: 'Code Sent',
              description: 'A new verification code has been sent to your email.',
            });
          } else {
            throw new Error('Email verification not supported');
          }
        } catch (signInError) {
          console.error('Sign In Error:', signInError);
          
          toast({
            title: 'Error',
            description: signInError instanceof Error ? signInError.message : 'Failed to send verification code',
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to send verification code',
          variant: 'destructive',
        });
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verify Your Email</CardTitle>
          <CardDescription>
            We've sent a verification code to {email}. Please enter the code below to verify your email address.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleVerify}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                id="verification-code"
                placeholder="Verification Code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="text-center text-lg tracking-widest"
                maxLength={6}
                disabled={isLoading}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || !verificationCode}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify Email
            </Button>
            
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleResendCode}
              disabled={isResending}
            >
              {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Resend Code
            </Button>
            
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                window.location.href = '/auth';
              }}
              disabled={isLoading || isResending}
            >
              Back to Sign In
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
