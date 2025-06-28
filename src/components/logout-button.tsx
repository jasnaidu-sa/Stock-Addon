import React from 'react';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export function LogoutButton() {
  const handleLogout = () => {
    // Use the global handleClerkSignOut function we attached to the window object
    if (typeof window !== 'undefined' && window.handleClerkSignOut) {
      window.handleClerkSignOut();
    } else {
      console.error('handleClerkSignOut function not found on window object');
    }
  };

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={handleLogout}
      className="gap-2"
    >
      <LogOut className="h-4 w-4" />
      <span>Logout</span>
    </Button>
  );
}
