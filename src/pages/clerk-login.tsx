import { SignIn } from "@clerk/clerk-react";
import { BackgroundPaths } from "@/components/ui/background-paths";

export default function ClerkLoginPage() {

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-white dark:bg-neutral-950">
      <div className="absolute inset-0">
        <BackgroundPaths title="Welcome Back" />
      </div>
      
      <div className="relative z-10 p-6 bg-white/90 dark:bg-neutral-900/90 rounded-lg shadow-lg backdrop-blur-sm">
        <SignIn 
          routing="path" 
          path="/clerk-login" 
          signUpUrl="/signup"
          fallbackRedirectUrl="/"
          appearance={{
            elements: {
              rootBox: "w-full mx-auto max-w-md",
              card: "rounded-xl border shadow-sm",
              headerTitle: "text-2xl font-bold text-center",
              headerSubtitle: "text-center",
              formButtonPrimary: "bg-primary hover:bg-primary/90 text-white",
              footerAction: "text-sm text-muted-foreground",
              formFieldLabel: "text-sm font-medium text-foreground",
              formFieldInput: "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
              dividerText: "text-xs text-muted-foreground",
              identityPreviewText: "text-sm text-foreground",
              identityPreviewEditButton: "text-primary hover:text-primary/90",
            }
          }}
        />
      </div>
    </div>
  );
}
