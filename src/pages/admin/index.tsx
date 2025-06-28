import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { UserButton } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, Download } from 'lucide-react';

// Page components for the routes
import AdminOrdersPage from './orders'; // Content for the main "Dashboard" tab
import AdminUserManagementPage from './user-management'; // Assuming default export
import { ExportPage } from './export'; // Assuming named export

const navLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/user-management", label: "User Management", icon: Users },
  { href: "/admin/export-orders", label: "Export Orders", icon: Download },
];

export default function AdminPage() {
  const location = useLocation();

  const isLinkActive = (path: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === path;
    }
    // For non-exact, ensure it's the base for /admin to avoid matching /admin/orders when /admin is active
    if (path === "/admin" && location.pathname !== "/admin") return false;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="p-4 md:p-8 min-h-screen bg-background text-foreground">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      </div>

      <div className="flex justify-between items-center border-b pb-4 mb-6">
        <nav className="flex items-center space-x-2">
          {navLinks.map((link) => {
            // Special handling for /admin to ensure it's active for /admin and /admin/orders (if orders is the dashboard content)
            // Or, if Dashboard link is /admin/orders, then it's simpler.
            // Given navLink for Dashboard is /admin (exact: true), it will only match /admin.
            // The index route for /admin renders AdminOrdersPage.
            const isActive = isLinkActive(link.href, link.exact);
            return (
              <Button
                key={link.label}
                variant={isActive ? "secondary" : "ghost"} // Using secondary for active, ghost for others as per typical ShadCN UI
                asChild
                className={`px-3 py-1.5 text-sm font-medium rounded-md ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground'}`}
              >
                <Link to={link.href} className="flex items-center space-x-2">
                  <link.icon className={`h-4 w-4 ${isActive ? '' : 'text-muted-foreground'}`} />
                  <span>{link.label}</span>
                </Link>
              </Button>
            );
          })}
        </nav>
        <UserButton afterSignOutUrl="/" />
      </div>

      <div className="mt-6">
        <Routes>
          <Route index element={<AdminOrdersPage />} /> {/* Renders AdminOrdersPage (stats + table) at /admin */}
          <Route path="orders" element={<AdminOrdersPage />} /> {/* Explicit route for /admin/orders */}
          <Route path="user-management" element={<AdminUserManagementPage />} />
          <Route path="export-orders" element={<ExportPage />} />
          <Route path="*" element={<div className='text-center p-10'>Admin Page Section Not Found</div>} />
        </Routes>
      </div>
    </div>
  );
}