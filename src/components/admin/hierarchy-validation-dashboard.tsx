import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  Users, 
  Building, 
  RefreshCw,
  CheckCircle,
  XCircle,
  UserCheck,
  UserX
} from 'lucide-react';
import { supabaseAdmin } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface HierarchyGap {
  store_code: string;
  store_name: string;
  missing_positions: string[];
  current_manager: string | null;
  escalated_manager: string | null;
  escalated_manager_level: string | null;
}

interface ValidationStats {
  total_stores: number;
  stores_with_gaps: number;
  vacant_store_managers: number;
  vacant_area_managers: number;
  vacant_regional_managers: number;
  pending_conflicts: number;
}

interface SyncConflict {
  sync_id: string;
  conflict_type: string;
  entity_type: string;
  conflict_description: string;
  created_at: string;
}

export function HierarchyValidationDashboard() {
  const [hierarchyGaps, setHierarchyGaps] = useState<HierarchyGap[]>([]);
  const [validationStats, setValidationStats] = useState<ValidationStats | null>(null);
  const [syncConflicts, setSyncConflicts] = useState<SyncConflict[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { toast } = useToast();

  const checkSupabase = () => {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }
    return supabaseAdmin;
  };

  const loadValidationData = async () => {
    setIsLoading(true);
    try {
      const db = checkSupabase();

      // Get hierarchy gaps using the store_management_hierarchy view
      const { data: gapsData, error: gapsError } = await db
        .from('store_management_hierarchy')
        .select(`
          store_code,
          store_name,
          store_manager_first_name,
          store_manager_last_name,
          area_manager_first_name,
          area_manager_last_name,
          regional_manager_first_name,
          regional_manager_last_name,
          effective_manager_level,
          effective_manager_email
        `);

      if (gapsError) throw gapsError;

      // Process gaps data
      const gaps: HierarchyGap[] = [];
      gapsData?.forEach(row => {
        const missingPositions: string[] = [];
        
        // Check for vacant positions
        const storeManagerName = row.store_manager_first_name && row.store_manager_last_name 
          ? `${row.store_manager_first_name} ${row.store_manager_last_name}` : null;
        const areaManagerName = row.area_manager_first_name && row.area_manager_last_name 
          ? `${row.area_manager_first_name} ${row.area_manager_last_name}` : null;
        const regionalManagerName = row.regional_manager_first_name && row.regional_manager_last_name 
          ? `${row.regional_manager_first_name} ${row.regional_manager_last_name}` : null;
        
        if (!storeManagerName) {
          missingPositions.push('Store Manager');
        }
        if (!areaManagerName) {
          missingPositions.push('Area Manager');
        }
        if (!regionalManagerName) {
          missingPositions.push('Regional Manager');
        }

        if (missingPositions.length > 0) {
          // Get effective manager email to determine name
          let effectiveManagerName = null;
          if (row.effective_manager_email) {
            if (row.effective_manager_level === 'store_manager') {
              effectiveManagerName = storeManagerName;
            } else if (row.effective_manager_level === 'area_manager') {
              effectiveManagerName = areaManagerName;
            } else if (row.effective_manager_level === 'regional_manager') {
              effectiveManagerName = regionalManagerName;
            }
          }

          gaps.push({
            store_code: row.store_code,
            store_name: row.store_name,
            missing_positions: missingPositions,
            current_manager: storeManagerName,
            escalated_manager: effectiveManagerName,
            escalated_manager_level: row.effective_manager_level
          });
        }
      });

      setHierarchyGaps(gaps);

      // Get sync conflicts
      const { data: conflictsData, error: conflictsError } = await db
        .from('sync_conflicts')
        .select('sync_id, conflict_type, entity_type, conflict_description, created_at')
        .eq('resolution_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50);

      if (conflictsError) {
        console.warn('Could not load sync conflicts:', conflictsError);
      }

      setSyncConflicts(conflictsData || []);

      // Calculate validation stats
      const stats: ValidationStats = {
        total_stores: gapsData?.length || 0,
        stores_with_gaps: gaps.length,
        vacant_store_managers: gaps.filter(g => g.missing_positions.includes('Store Manager')).length,
        vacant_area_managers: gaps.filter(g => g.missing_positions.includes('Area Manager')).length,
        vacant_regional_managers: gaps.filter(g => g.missing_positions.includes('Regional Manager')).length,
        pending_conflicts: conflictsData?.length || 0
      };

      setValidationStats(stats);
      setLastUpdated(new Date());

    } catch (error) {
      console.error('Error loading validation data:', error);
      
      // Log more detailed error information
      if (error && typeof error === 'object') {
        console.error('Error details:', JSON.stringify(error, null, 2));
      }
      
      toast({
        title: 'Load Error',
        description: error instanceof Error ? error.message : 'Failed to load validation data',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadValidationData();
  }, []);

  const getSeverityColor = (missingPositions: string[]) => {
    if (missingPositions.includes('Store Manager')) return 'destructive';
    if (missingPositions.includes('Area Manager')) return 'secondary';
    return 'outline';
  };

  const getSeverityIcon = (missingPositions: string[]) => {
    if (missingPositions.includes('Store Manager')) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    if (missingPositions.includes('Area Manager')) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
    return <UserX className="h-4 w-4 text-orange-500" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Hierarchy Validation Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor vacant positions and management coverage across all stores
          </p>
        </div>
        <Button 
          onClick={loadValidationData} 
          disabled={isLoading}
          variant="outline"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {validationStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Stores</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{validationStats.total_stores}</div>
              <p className="text-xs text-muted-foreground">
                Active store locations
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stores with Gaps</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {validationStats.stores_with_gaps}
              </div>
              <p className="text-xs text-muted-foreground">
                {((validationStats.stores_with_gaps / validationStats.total_stores) * 100).toFixed(1)}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vacant Store Managers</CardTitle>
              <UserX className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {validationStats.vacant_store_managers}
              </div>
              <p className="text-xs text-muted-foreground">
                Stores without managers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vacant Area Managers</CardTitle>
              <Users className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {validationStats.vacant_area_managers}
              </div>
              <p className="text-xs text-muted-foreground">
                Areas without managers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Conflicts</CardTitle>
              <AlertTriangle className={`h-4 w-4 ${validationStats.pending_conflicts > 0 ? 'text-red-500' : 'text-green-500'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${validationStats.pending_conflicts > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {validationStats.pending_conflicts}
              </div>
              <p className="text-xs text-muted-foreground">
                Upload validation issues
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Last Updated */}
      {lastUpdated && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Last updated: {lastUpdated.toLocaleString()}
          </AlertDescription>
        </Alert>
      )}

      {/* Hierarchy Gaps Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Hierarchy Gaps by Store
          </CardTitle>
          <CardDescription>
            Stores with vacant management positions and their escalation coverage
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading validation data...
            </div>
          ) : hierarchyGaps.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-center">
              <div>
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-green-700">No Hierarchy Gaps Found</h3>
                <p className="text-muted-foreground">
                  All stores have proper management coverage
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {hierarchyGaps.map((gap) => (
                <div key={gap.store_code} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {getSeverityIcon(gap.missing_positions)}
                        <h4 className="font-semibold">
                          {gap.store_name} ({gap.store_code})
                        </h4>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {gap.missing_positions.length} vacant position{gap.missing_positions.length > 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {gap.missing_positions.map((position) => (
                        <Badge 
                          key={position} 
                          variant={getSeverityColor(gap.missing_positions)}
                          className="text-xs"
                        >
                          {position}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-muted-foreground">Current Manager:</span>
                      <div className="mt-1">
                        {gap.current_manager ? (
                          <div className="flex items-center gap-1">
                            <UserCheck className="h-3 w-3 text-green-500" />
                            {gap.current_manager}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <UserX className="h-3 w-3 text-red-500" />
                            No assigned manager
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="font-medium text-muted-foreground">Escalated To:</span>
                      <div className="mt-1">
                        {gap.escalated_manager ? (
                          <div className="flex items-center gap-1">
                            <UserCheck className="h-3 w-3 text-blue-500" />
                            {gap.escalated_manager} ({gap.escalated_manager_level})
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <XCircle className="h-3 w-3 text-red-500" />
                            No escalation available
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Conflicts */}
      {syncConflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Upload Validation Conflicts ({syncConflicts.length})
            </CardTitle>
            <CardDescription>
              These issues must be resolved before successful Excel uploads
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {syncConflicts.map((conflict, index) => (
                <div key={index} className="border rounded-lg p-3 bg-red-50 border-red-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-800">
                        {conflict.conflict_description}
                      </p>
                      <div className="flex gap-4 mt-1 text-xs text-red-600">
                        <span>Type: {conflict.conflict_type}</span>
                        <span>Entity: {conflict.entity_type}</span>
                        <span>Time: {new Date(conflict.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>To resolve:</strong> Fix the data issues in your Excel file and re-upload. 
                Common issues include duplicate emails, invalid email formats, or missing required fields.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coverage Summary */}
      {validationStats && validationStats.stores_with_gaps > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Action Required:</strong> {validationStats.stores_with_gaps} store{validationStats.stores_with_gaps > 1 ? 's have' : ' has'} management gaps. 
            Consider uploading updated hierarchy data or manually assigning managers to ensure proper coverage.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}