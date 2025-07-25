import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Loader2 } from 'lucide-react';
import { supabaseAdmin } from '@/lib/supabase';
import * as XLSX from 'xlsx';

interface WeekOption {
  id: string;
  week_number: number;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

interface WeeklyPlanItem {
  store_id: string;
  store_name: string;
  stock_code: string;
  warehouse_code: string;
}

interface AmendmentData {
  store_id: string;
  store_name: string;
  stock_code: string;
  warehouse_code: string;
  final_qty: number;
  all_reasons: string;
}

export const AmendmentExport: React.FC = () => {
  const [weeks, setWeeks] = useState<WeekOption[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('📅 [AmendmentExport] useEffect triggered');
    loadWeeks();
  }, []);

  const loadWeeks = async () => {
    try {
      console.log('📅 [AmendmentExport] Loading weeks...');
      const { data: weekData, error } = await supabaseAdmin
        .from('week_selections')
        .select(`
          id,
          week_number,
          week_start_date,
          week_end_date,
          is_current
        `)
        .eq('is_active', true)
        .order('week_start_date', { ascending: false });

      if (error) {
        console.error('❌ [AmendmentExport] Error loading weeks:', error);
        throw error;
      }

      console.log('📅 [AmendmentExport] Raw week data:', weekData);

      const mappedWeeks = weekData?.map((week: any) => ({
        id: week.id,
        week_number: week.week_number,
        start_date: week.week_start_date,
        end_date: week.week_end_date,
        is_current: week.is_current
      })) || [];

      console.log('📅 [AmendmentExport] Mapped weeks:', mappedWeeks);
      setWeeks(mappedWeeks);
      
      // Auto-select current week if available
      const currentWeek = mappedWeeks.find((w: WeekOption) => w.is_current);
      if (currentWeek) {
        console.log('📅 [AmendmentExport] Auto-selecting current week:', currentWeek);
        setSelectedWeek(currentWeek.id);
      } else {
        console.log('📅 [AmendmentExport] No current week found');
      }
    } catch (error) {
      console.error('❌ [AmendmentExport] Error loading weeks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const consolidateReasons = (amendments: any[]): string => {
    const reasonParts: string[] = [];
    
    amendments.forEach(amendment => {
      if (amendment.justification) {
        let userRole = '';
        switch (amendment.created_by_role) {
          case 'store_manager':
            userRole = 'Store Manager';
            break;
          case 'area_manager':
            userRole = 'Area Manager';
            break;
          case 'regional_manager':
            userRole = 'Regional Manager';
            break;
          case 'admin':
            userRole = 'Admin';
            break;
          default:
            userRole = amendment.created_by_role;
        }
        reasonParts.push(`${userRole}: ${amendment.justification}`);
      }
      
      if (amendment.admin_notes) {
        reasonParts.push(`Admin Notes: ${amendment.admin_notes}`);
      }
    });

    return reasonParts.join('\n');
  };

  const getWeeklyPlanTemplate = async (weekId: string): Promise<WeeklyPlanItem[]> => {
    // First get the week reference from the selected week ID
    const { data: weekInfo, error: weekError } = await supabaseAdmin
      .from('week_selections')
      .select('week_reference')
      .eq('id', weekId)
      .single();

    if (weekError) throw weekError;
    if (!weekInfo) throw new Error('Week not found');

    // Get all unique store/stock_code combinations from weekly_plan for the selected week
    const { data: weeklyPlanData, error } = await supabaseAdmin
      .from('weekly_plan')
      .select(`
        store_name,
        stock_code,
        warehouse
      `)
      .eq('reference', weekInfo.week_reference);

    if (error) throw error;

    // Create unique combinations
    const uniqueCombinations = new Map<string, WeeklyPlanItem>();
    
    weeklyPlanData?.forEach((item: any) => {
      const key = `${item.store_name}_${item.stock_code}`;
      if (!uniqueCombinations.has(key)) {
        uniqueCombinations.set(key, {
          store_id: '', // Not needed for export
          store_name: item.store_name,
          stock_code: item.stock_code,
          warehouse_code: item.warehouse || ''
        });
      }
    });

    return Array.from(uniqueCombinations.values());
  };

  const getApprovedAmendments = async (weekId: string): Promise<AmendmentData[]> => {
    // First get the week reference from the selected week ID
    const { data: weekInfo, error: weekError } = await supabaseAdmin
      .from('week_selections')
      .select('week_reference')
      .eq('id', weekId)
      .single();

    if (weekError) throw weekError;
    if (!weekInfo) throw new Error('Week not found');

    // Get all approved amendments with store information
    const { data: amendmentData, error } = await supabaseAdmin
      .from('weekly_plan_amendments')
      .select(`
        store_id,
        stock_code,
        amended_qty,
        approved_qty,
        justification,
        admin_notes,
        created_by_role,
        stores!inner(store_name, store_code)
      `)
      .eq('week_reference', weekInfo.week_reference)
      .eq('status', 'approved')
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Group amendments by store_id + stock_code
    const groupedAmendments = new Map<string, any[]>();
    
    amendmentData?.forEach((amendment: any) => {
      const key = `${amendment.store_id}_${amendment.stock_code}`;
      if (!groupedAmendments.has(key)) {
        groupedAmendments.set(key, []);
      }
      groupedAmendments.get(key)!.push(amendment);
    });

    // Convert to AmendmentData format
    const result: AmendmentData[] = [];
    
    groupedAmendments.forEach((amendments) => {
      const firstAmendment = amendments[0];
      
      // Use approved_qty if admin modified it, otherwise use amended_qty
      const latestAmendment = amendments[amendments.length - 1];
      const finalQty = latestAmendment.approved_qty !== null && latestAmendment.approved_qty !== undefined 
        ? latestAmendment.approved_qty 
        : latestAmendment.amended_qty;

      result.push({
        store_id: firstAmendment.store_id,
        store_name: firstAmendment.stores?.store_name || 'Unknown Store',
        stock_code: firstAmendment.stock_code,
        warehouse_code: firstAmendment.stores?.store_code || '', // Store code goes in warehouse column
        final_qty: finalQty || 0,
        all_reasons: consolidateReasons(amendments)
      });
    });

    return result;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const exportAmendments = async () => {
    if (!selectedWeek) return;

    setIsExporting(true);
    
    try {
      const selectedWeekData = weeks.find(w => w.id === selectedWeek);
      if (!selectedWeekData) throw new Error('Selected week not found');

      // Get only approved amendments
      const approvedAmendments = await getApprovedAmendments(selectedWeek);

      // Format date for file
      const weekStartDate = formatDate(selectedWeekData.start_date);
      const dateColumn = `Week${selectedWeekData.week_number} - ${weekStartDate}`;
      const fileName = `AddonWeek${selectedWeekData.week_number} - ${weekStartDate}.xlsx`;

      // Build Excel data
      const excelData = [
        ['YOU CAN FILTER HERE TO VIEW A SUMMARY OF ALL YOUR ADDITIONS'], // Row 1
        ['Store Name', '', 'Warehouse', 'Stock Code', 'RegionalAddQty', 'Reason for addition', 'Date'] // Row 2 - Headers
      ];

      // Add data rows - only approved amendments
      approvedAmendments.forEach(amendment => {
        excelData.push([
          amendment.store_name,
          '', // Empty column
          amendment.warehouse_code, // Store code
          amendment.stock_code,
          amendment.final_qty, // Keep as number, not string
          amendment.all_reasons,
          dateColumn
        ]);
      });

      // Create workbook
      const ws = XLSX.utils.aoa_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Summary Additions');

      // Set column widths
      ws['!cols'] = [
        { width: 20 }, // Store Name
        { width: 5 },  // Empty
        { width: 12 }, // Warehouse
        { width: 20 }, // Stock Code
        { width: 15 }, // RegionalAddQty
        { width: 40 }, // Reason
        { width: 20 }  // Date
      ];

      // Download file
      XLSX.writeFile(wb, fileName);

    } catch (error) {
      console.error('Error exporting amendments:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading weeks...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Approved Amendments</CardTitle>
        <CardDescription>
          Export approved amendments in Excel format for upload template
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Select Week</label>
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger>
                <SelectValue placeholder="Select a week to export" />
              </SelectTrigger>
              <SelectContent>
                {weeks.map((week) => (
                  <SelectItem key={week.id} value={week.id}>
                    Week {week.week_number} ({formatDate(week.start_date)} - {formatDate(week.end_date)})
                    {week.is_current && ' (Current)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            onClick={exportAmendments}
            disabled={!selectedWeek || isExporting}
            className="min-w-[120px]"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </div>

        <div className="text-sm text-muted-foreground space-y-1">
          <p>• File will include only approved amendments</p>
          <p>• Store Name: Store name</p>
          <p>• Warehouse: Store code</p>
          <p>• RegionalAddQty: Final approved quantity</p>
          <p>• File name format: AddonWeekXX - DD-MM-YYYY.xlsx</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default AmendmentExport;