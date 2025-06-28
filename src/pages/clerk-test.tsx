import { UserButton, useUser } from '@clerk/clerk-react';

export function ClerkTestPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  
  return (
    <div className="container py-10">
      <h1 className="text-2xl font-bold mb-6">Clerk Test Page</h1>
      
      <div className="p-6 border rounded-lg bg-white shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Clerk Status</h2>
        <div className="grid grid-cols-2 gap-2">
          <div className="font-medium">isLoaded:</div>
          <div>{isLoaded ? 'Yes' : 'No'}</div>
          
          <div className="font-medium">isSignedIn:</div>
          <div>{isSignedIn ? 'Yes' : 'No'}</div>
          
          <div className="font-medium">User ID:</div>
          <div>{user?.id || 'Not available'}</div>
          
          <div className="font-medium">Email:</div>
          <div>{user?.primaryEmailAddress?.emailAddress || 'Not available'}</div>
        </div>
      </div>
      
      <div className="p-6 border rounded-lg bg-white shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">UserButton Test</h2>
        <p className="mb-4">Default UserButton:</p>
        <div className="p-2 border rounded mb-4 inline-block">
          <UserButton afterSignOutUrl="/clerk-login" />
        </div>
        
        <p className="mb-4">UserButton with forced visibility:</p>
        <div className="p-2 border rounded mb-4 inline-block">
          <div style={{ 
            display: 'block', 
            visibility: 'visible' as const,
            position: 'relative',
            zIndex: 100
          }} className="!block !visible">
            <UserButton 
              afterSignOutUrl="/clerk-login"
              appearance={{
                elements: {
                  userButtonAvatarBox: {
                    width: '2.5rem',
                    height: '2.5rem',
                    display: 'flex !important',
                    visibility: 'visible !important',
                    opacity: '1 !important'
                  }
                }
              }}
            />
          </div>
        </div>
      </div>
      
      <div className="p-6 border rounded-lg bg-white shadow">
        <h2 className="text-xl font-semibold mb-4">Clerk Environment Variables</h2>
        <div className="grid grid-cols-2 gap-2">
          <div className="font-medium">VITE_CLERK_PUBLISHABLE_KEY:</div>
          <div className="break-all">{import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'Not set'}</div>
        </div>
      </div>
    </div>
  );
}

export default ClerkTestPage;
