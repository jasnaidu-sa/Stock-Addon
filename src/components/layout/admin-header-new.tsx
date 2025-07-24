import { useUser, useClerk } from '@clerk/clerk-react';
import { Button } from "@/components/ui/button";
import { Sun, Moon, Menu, LogOut } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AdminHeaderProps {
  onMenuClick: () => void;
}

export function AdminHeaderNew({ onMenuClick }: AdminHeaderProps) {
  const { theme, setTheme } = useTheme();
  const { isSignedIn, user: clerkUser } = useUser();
  const { signOut } = useClerk();

  const handleSignOut = () => {
    signOut({ redirectUrl: '/clerk-login' });
  };

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="flex h-16 items-center px-6">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden mr-4"
          onClick={onMenuClick}
        >
          <Menu className="h-6 w-6" />
        </Button>

        {/* Title */}
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Admin Portal</h1>

        {/* Right side actions */}
        <div className="ml-auto flex items-center space-x-4">
          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="text-gray-600 dark:text-gray-300"
          >
            {theme === 'light' ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </Button>

          {/* User menu */}
          {isSignedIn && clerkUser ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={clerkUser.imageUrl} alt={clerkUser.fullName || 'User'} />
                    <AvatarFallback className="bg-blue-100 text-blue-700">
                      {clerkUser.firstName?.charAt(0) || clerkUser.fullName?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{clerkUser.fullName || 'Admin User'}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {clerkUser.primaryEmailAddress?.emailAddress}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 dark:text-red-400">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </header>
  );
}