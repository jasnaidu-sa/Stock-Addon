import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Calendar, 
  FileSpreadsheet, 
  Trash2, 
  Search, 
  BarChart3,
  Download,
  Loader2
} from 'lucide-react';
import { WeeklyPlanUpload } from '@/components/admin/weekly-plan-upload';
import { supabaseAdmin } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { WeeklyPlan } from '@/types/weekly-plan';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

interface WeeklyPlanSummary {
  reference: string;
  start_date: string;
  total_records: number;
  stores_count: number;
  categories: string[];
  created_at: string;
  uploaded_by: string;
}

export const WeeklyPlanManagement: React.FC = () => {
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlanSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [weekDetails, setWeekDetails] = useState<WeeklyPlan[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const { toast } = useToast();

  const loadWeeklyPlans = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabaseAdmin
        .from('weekly_plan')
        .select(`
          reference,
          start_date,
          created_at,
          uploaded_by,
          store_name,
          category
        `)
        .order('start_date', { ascending: false });

      if (error) throw error;

      // Group by reference to create summaries
      const summaryMap = new Map<string, WeeklyPlanSummary>();
      
      data?.forEach((item) => {
        const key = item.reference;
        if (!summaryMap.has(key)) {
          summaryMap.set(key, {
            reference: item.reference,
            start_date: item.start_date,
            total_records: 0,
            stores_count: 0,
            categories: [],
            created_at: item.created_at,
            uploaded_by: item.uploaded_by
          });
        }
        
        const summary = summaryMap.get(key)!;
        summary.total_records++;
        
        // Count unique stores
        const stores = new Set<string>();
        const categories = new Set<string>();
        
        data.filter(d => d.reference === key).forEach(d => {
          if (d.store_name) stores.add(d.store_name);
          if (d.category) categories.add(d.category);
        });
        
        summary.stores_count = stores.size;
        summary.categories = Array.from(categories);
      });

      setWeeklyPlans(Array.from(summaryMap.values()));
    } catch (error) {
      console.error('Error loading weekly plans:', error);
      toast({
        title: 'Error',
        description: 'Failed to load weekly plans',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadWeekDetails = async (reference: string) => {
    try {
      setIsLoadingDetails(true);
      
      const { data, error } = await supabaseAdmin
        .from('weekly_plan')
        .select('*')
        .eq('reference', reference)
        .order('store_name, stock_code');

      if (error) throw error;
      setWeekDetails(data || []);
    } catch (error) {
      console.error('Error loading week details:', error);
      toast({
        title: 'Error',
        description: 'Failed to load week details',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleDeleteWeek = async (reference: string) => {
    if (!confirm(`Are you sure you want to delete all data for ${reference}? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabaseAdmin
        .from('weekly_plan')
        .delete()
        .eq('reference', reference);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Deleted all data for ${reference}`,
      });

      // Reload the list
      loadWeeklyPlans();
      
      // Clear details if the deleted week was selected
      if (selectedWeek === reference) {
        setSelectedWeek(null);
        setWeekDetails([]);
      }
    } catch (error) {
      console.error('Error deleting week:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete weekly plan data',
        variant: 'destructive'
      });
    }
  };

  const exportWeekToExcel = async (reference: string) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('weekly_plan')
        .select('*')
        .eq('reference', reference)
        .order('store_name, stock_code');

      if (error) throw error;

      // Import XLSX dynamically
      const XLSX = await import('xlsx');
      
      // Convert data to Excel format
      const worksheet = XLSX.utils.json_to_sheet(data || []);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, reference);
      
      // Download file
      XLSX.writeFile(workbook, `${reference}_weekly_plan.xlsx`);
      
      toast({
        title: 'Success',
        description: `Exported ${reference} to Excel`,
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        title: 'Error',
        description: 'Failed to export to Excel',
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    loadWeeklyPlans();
  }, []);

  const filteredPlans = weeklyPlans.filter(plan =>
    plan.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plan.categories.some(cat => cat.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Weekly Plan Management</h1>
      </div>

      {/* Upload Section */}
      <WeeklyPlanUpload />

      {/* Weekly Plans List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Uploaded Weekly Plans
          </CardTitle>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <Input
              placeholder="Search by week reference or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week Reference</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Stores</TableHead>
                  <TableHead>Categories</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No weekly plans uploaded yet
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPlans.map((plan) => (
                    <TableRow key={plan.reference}>
                      <TableCell className="font-medium">{plan.reference}</TableCell>
                      <TableCell>{formatDate(plan.start_date)}</TableCell>
                      <TableCell>{plan.total_records.toLocaleString()}</TableCell>
                      <TableCell>{plan.stores_count}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {plan.categories.slice(0, 3).map((category) => (
                            <Badge key={category} variant="secondary" className="text-xs">
                              {category}
                            </Badge>
                          ))}
                          {plan.categories.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{plan.categories.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(plan.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedWeek(plan.reference);
                              loadWeekDetails(plan.reference);
                            }}
                          >
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => exportWeekToExcel(plan.reference)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteWeek(plan.reference)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Week Details */}
      {selectedWeek && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              {selectedWeek} - Detailed View
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingDetails ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store</TableHead>
                      <TableHead>Stock Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>On Hand</TableHead>
                      <TableHead>In Transit</TableHead>
                      <TableHead>Order Qty</TableHead>
                      <TableHead>Act Order Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weekDetails.slice(0, 50).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.store_name}</TableCell>
                        <TableCell className="font-mono">{item.stock_code}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>{item.qty_on_hand}</TableCell>
                        <TableCell>{item.qty_in_transit}</TableCell>
                        <TableCell>{item.order_qty}</TableCell>
                        <TableCell>{item.act_order_qty}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {weekDetails.length > 50 && (
                  <div className="text-center py-4 text-muted-foreground">
                    Showing first 50 of {weekDetails.length} records. Export to Excel to see all data.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WeeklyPlanManagement;