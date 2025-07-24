import { Outlet } from 'react-router-dom';
import { CustomerHeader } from './customer-header';

export function ManagerLayout() {
  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Main content area without sidebar */}
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <CustomerHeader showMenuButton={false} />
        
        {/* Page content - full width without sidebar */}
        <main className="flex-1 overflow-y-auto bg-white dark:bg-gray-800">
          <div className="px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}