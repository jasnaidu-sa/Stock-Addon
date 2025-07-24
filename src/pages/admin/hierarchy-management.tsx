import React, { useState } from 'react';
import { HierarchyUpload } from '@/components/admin/hierarchy-upload';
import { HierarchyValidationDashboard } from '@/components/admin/hierarchy-validation-dashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Building, AlertTriangle, Upload, BarChart3 } from 'lucide-react';

type TabType = 'upload' | 'validation';

export const HierarchyManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('validation');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Hierarchy Management</h1>
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'validation' ? 'default' : 'outline'}
            onClick={() => setActiveTab('validation')}
            className="flex items-center gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Validation Dashboard
          </Button>
          <Button
            variant={activeTab === 'upload' ? 'default' : 'outline'}
            onClick={() => setActiveTab('upload')}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Upload Data
          </Button>
        </div>
      </div>

      {/* Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Multi-Level Structure
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4 Levels</div>
            <p className="text-xs text-muted-foreground">
              Regional → Area → Store Manager
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Excel Upload Format
            </CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">13 Columns</div>
            <p className="text-xs text-muted-foreground">
              RM, AM, Store Manager + Store data
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Auto-Processing
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Sync Mode</div>
            <p className="text-xs text-muted-foreground">
              Creates users, stores, assignments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tab Content */}
      {activeTab === 'validation' && <HierarchyValidationDashboard />}
      
      {activeTab === 'upload' && (
        <>
          {/* Upload Component */}
          <HierarchyUpload />

          {/* Instructions */}
          <Card>
        <CardHeader>
          <CardTitle>Excel File Requirements</CardTitle>
          <CardDescription>
            Ensure your Excel file follows the exact format for successful processing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Required Columns (in order):</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div className="space-y-1">
                <div>• <code>rm_name</code> - Regional Manager first name</div>
                <div>• <code>rm_surname</code> - Regional Manager last name</div>
                <div>• <code>rm_email</code> - Regional Manager email</div>
                <div>• <code>rm_username</code> - Regional Manager username</div>
                <div>• <code>am_name</code> - Area Manager first name</div>
                <div>• <code>am_surname</code> - Area Manager last name</div>
                <div>• <code>am_username</code> - Area Manager username</div>
              </div>
              <div className="space-y-1">
                <div>• <code>am_email</code> - Area Manager email</div>
                <div>• <code>Store</code> - Store name</div>
                <div>• <code>store_code</code> - Store code (unique)</div>
                <div>• <code>store_manager</code> - Store Manager name</div>
                <div>• <code>Store_manager_email</code> - Store Manager email</div>
                <div>• <code>Store_manager_username</code> - Store Manager username</div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Important Notes:</h4>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li>Use "Vacant" for empty positions (case-insensitive)</li>
              <li>Passwords auto-generated as: [LastName]2024! (e.g., Smith2024!)</li>
              <li>All email addresses must be unique across the file</li>
              <li>Store codes must be unique</li>
              <li>Validation errors will block the entire upload</li>
              <li>Users not in Excel will be marked as inactive</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">What happens during upload:</h4>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li><strong>Deduplication:</strong> Unique users extracted (same manager across multiple stores = 1 user)</li>
              <li><strong>User Creation:</strong> New users created in Clerk and Supabase with auto-generated passwords</li>
              <li><strong>Store Processing:</strong> All stores created or updated</li>
              <li><strong>Assignment Linking:</strong> Relationships created (RM→AM, AM→Stores, SM→Store)</li>
              <li><strong>Hierarchy View:</strong> Auto-escalation rules activated via database view</li>
              <li><strong>Audit Trail:</strong> Sync logs track all changes with timestamps</li>
            </ul>
          </div>
        </CardContent>
      </Card>
        </>
      )}
    </div>
  );
};

export default HierarchyManagement;