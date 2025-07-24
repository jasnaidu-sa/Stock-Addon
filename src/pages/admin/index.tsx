import { Navigate } from 'react-router-dom';

// This file is kept for backward compatibility
// The actual admin layout is now in src/components/layout/admin-layout.tsx
// and routing is handled directly in App.tsx

export default function AdminPage() {
  // Simply redirect to the admin orders page
  // This component is no longer used for layout
  return <Navigate to="/admin/orders" replace />;
}