import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Database,
  Building2,
  Tag,
  Users,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { StoresUpload } from './stores-upload';
import { CategoriesUpload } from './categories-upload';
import { AllocationsUpload } from './allocations-upload';
import { UploadResult } from '@/types/amendment-system';

interface UploadStatus {
  stores: UploadResult | null;
  categories: UploadResult | null;
  allocations: UploadResult | null;
}

export const MasterDataDashboard: React.FC = () => {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    stores: null,
    categories: null,
    allocations: null,
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const handleUploadComplete = (type: keyof UploadStatus) => (result: UploadResult) => {
    setUploadStatus(prev => ({
      ...prev,
      [type]: result
    }));
    setLastUpdated(new Date());
  };

  const getStatusIcon = (result: UploadResult | null) => {
    if (!result) return <Clock className="h-4 w-4 text-gray-400" />;
    if (result.success) return <CheckCircle className="h-4 w-4 text-green-600" />;
    return <AlertCircle className="h-4 w-4 text-red-600" />;
  };

  const getStatusBadge = (result: UploadResult | null) => {
    if (!result) return <Badge variant="secondary">Pending</Badge>;
    if (result.success) return <Badge variant="default" className="bg-green-600">Success</Badge>;
    return <Badge variant="destructive">Errors</Badge>;
  };

  const getTotalSuccessful = () => {
    return Object.values(uploadStatus).reduce((total, result) => {
      return total + (result?.successfulRows || 0);
    }, 0);
  };

  const getTotalErrors = () => {
    return Object.values(uploadStatus).reduce((total, result) => {
      return total + (result?.errorRows || 0);
    }, 0);
  };

  const refreshDashboard = () => {
    setUploadStatus({
      stores: null,
      categories: null,
      allocations: null,
    });
    setLastUpdated(null);
  };

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-6 w-6" />
              <CardTitle>Master Data Management Dashboard</CardTitle>
            </div>
            <div className="flex items-center gap-4">
              {lastUpdated && (
                <div className="text-sm text-muted-foreground">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={refreshDashboard}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Upload Status Cards */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">Stores</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(uploadStatus.stores)}
                    {getStatusBadge(uploadStatus.stores)}
                  </div>
                </div>
                {uploadStatus.stores && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {uploadStatus.stores.successfulRows} successful, {uploadStatus.stores.errorRows} errors
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Categories</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(uploadStatus.categories)}
                    {getStatusBadge(uploadStatus.categories)}
                  </div>
                </div>
                {uploadStatus.categories && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {uploadStatus.categories.successfulRows} successful, {uploadStatus.categories.errorRows} errors
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-600" />
                    <span className="font-medium">Allocations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(uploadStatus.allocations)}
                    {getStatusBadge(uploadStatus.allocations)}
                  </div>
                </div>
                {uploadStatus.allocations && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {uploadStatus.allocations.successfulRows} successful, {uploadStatus.allocations.errorRows} errors
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Summary Stats */}
          {(getTotalSuccessful() > 0 || getTotalErrors() > 0) && (
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Upload Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Total Successful: {getTotalSuccessful()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span>Total Errors: {getTotalErrors()}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Tabs */}
      <Card>
        <CardContent className="p-0">
          <Tabs defaultValue="stores" className="w-full">
            <div className="border-b">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="stores" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Stores Upload
                </TabsTrigger>
                <TabsTrigger value="categories" className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Categories Upload
                </TabsTrigger>
                <TabsTrigger value="allocations" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Allocations Upload
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="stores" className="p-6">
              <StoresUpload onUploadComplete={handleUploadComplete('stores')} />
            </TabsContent>

            <TabsContent value="categories" className="p-6">
              <CategoriesUpload onUploadComplete={handleUploadComplete('categories')} />
            </TabsContent>

            <TabsContent value="allocations" className="p-6">
              <AllocationsUpload onUploadComplete={handleUploadComplete('allocations')} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <h4 className="font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-600" />
                1. Stores Upload
              </h4>
              <p className="text-sm text-muted-foreground ml-6">
                Upload your store master data first. This creates the foundation for store allocations.
                Required columns: Store Code, Store Name
              </p>
            </div>
            <div>
              <h4 className="font-medium flex items-center gap-2">
                <Tag className="h-4 w-4 text-green-600" />
                2. Categories Upload
              </h4>
              <p className="text-sm text-muted-foreground ml-6">
                Upload product categories for the amendment system UI navigation.
                Required columns: Category Code, Category Name
              </p>
            </div>
            <div>
              <h4 className="font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-600" />
                3. Store Allocations Upload
              </h4>
              <p className="text-sm text-muted-foreground ml-6">
                Upload which stores each regional manager is responsible for.
                Required columns: Regional Manager Email, Store Code
              </p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <h5 className="font-medium text-blue-900 mb-1">Important Notes:</h5>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Download the template for each upload to ensure correct format</li>
              <li>• Regional managers must exist in the system before uploading allocations</li>
              <li>• Store codes in allocations must match store codes from stores upload</li>
              <li>• Duplicate allocations will be automatically skipped</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};