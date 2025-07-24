import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Sun, Moon, UserCircle, LogOut, Menu, Bell } from 'lucide-react';
import { useUser, useClerk } from '@clerk/clerk-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface CustomerHeaderProps {
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

export function CustomerHeader({ onMenuClick, showMenuButton = true }: CustomerHeaderProps) {
  const { theme, setTheme } = useTheme();
  const { isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  
  const handleSignOut = () => {
    signOut({ redirectUrl: '/clerk-login' });
  };

  return (
    <header className="bg-white dark:bg-gray-900 shadow-md border-b border-gray-200 dark:border-gray-700 backdrop-blur-sm bg-white/95 dark:bg-gray-900/95">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Left side */}
          <div className="flex items-center">
            {/* Mobile menu button - only show if showMenuButton is true */}
            {showMenuButton && onMenuClick && (
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden mr-2"
                onClick={onMenuClick}
              >
                <Menu className="h-6 w-6" />
              </Button>
            )}
            
            {/* Page title or breadcrumb could go here */}
            <div className="hidden lg:flex lg:items-center lg:space-x-4">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                Customer Portal
              </h1>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-5 w-5" />
              <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs">
                3
              </Badge>
            </Button>

            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              {theme === 'light' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>

            {/* User menu */}
            {isSignedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.imageUrl} alt={user?.fullName || 'User'} />
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        {user?.firstName?.charAt(0) || user?.fullName?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user?.fullName || 'User'}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.primaryEmailAddress?.emailAddress}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <UserCircle className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <a href="/clerk-login">
                  <UserCircle className="h-4 w-4 mr-2" />
                  Sign In
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}