import { SignupForm } from '@/components/auth/signup-form';
import { BackgroundPaths } from '@/components/ui/background-paths';

export default function SignupPage() {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-white dark:bg-neutral-950">
      <div className="absolute inset-0">
        <BackgroundPaths title="Create Account" />
      </div>
      <div className="relative z-10 w-full max-w-md px-4">
        <SignupForm />
      </div>
    </div>
  );
} 