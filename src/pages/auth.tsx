import { AuthForm } from '@/components/auth/auth-form';
import { BackgroundPaths } from '@/components/ui/background-paths';

export function AuthPage() {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-white dark:bg-neutral-950">
      <div className="absolute inset-0">
        <BackgroundPaths title="Dynamic Stock Addon" />
      </div>
      
      <div className="relative z-10">
        <AuthForm />
      </div>
    </div>
  );
}