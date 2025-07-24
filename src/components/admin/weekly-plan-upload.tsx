import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabaseAdmin } from '@/lib/supabase';
import { useAuth } from '@clerk/clerk-react';
import * as XLSX from 'xlsx';
import { WeeklyPlan, WeeklyPlanExcelRow, WeeklyPlanUploadStats } from '@/types/weekly-plan';

export const WeeklyPlanUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    percentage: number;
    stage: string;
  } | null>(null);
  const [uploadStats, setUploadStats] = useState<WeeklyPlanUploadStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [duplicateWeekData, setDuplicateWeekData] = useState<{
    weekReference: string;
    existingRecords: number;
    newData: any[];
    userUUID: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { userId } = useAuth();

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.xlsx') && !selectedFile.name.toLowerCase().endsWith('.xls')) {
      setError('Please select an Excel file (.xlsx or .xls)');
      return;
    }
    
    setFile(selectedFile);
    setError(null);
    setUploadStats(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
      // Clear the input value after processing the file to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const parseExcelFile = (file: File): Promise<WeeklyPlanExcelRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Get the first sheet
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Convert to JSON with headers
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });
          
          resolve(jsonData as WeeklyPlanExcelRow[]);
        } catch (error) {
          reject(new Error('Failed to parse Excel file: ' + (error as Error).message));
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const checkForDuplicateWeek = async (reference: string): Promise<{ isDuplicate: boolean; count: number }> => {
    try {
      // Only check for duplicates if reference is not null/undefined
      if (!reference || reference.trim() === '') {
        return { isDuplicate: false, count: 0 };
      }

      console.log('🔍 Checking for duplicate week reference:', reference);
      
      // Check for duplicates with the same reference only
      const { data, error, count } = await supabaseAdmin
        .from('weekly_plan')
        .select('id, plan_id, reference', { count: 'exact' })
        .eq('reference', reference.trim())
        .limit(10);

      if (error) {
        console.error('❌ Error checking for duplicate week:', error);
        throw error;
      }

      const isDuplicate = (count ?? 0) > 0;
      console.log(`📊 Duplicate check result: ${isDuplicate ? 'FOUND' : 'NOT FOUND'} (count: ${count})`);
      
      if (isDuplicate && data) {
        console.log('📋 Existing records with same reference:', data);
      }
      
      return { 
        isDuplicate, 
        count: count || 0 
      };
    } catch (error) {
      console.error('❌ Error checking for duplicate week:', error);
      throw error;
    }
  };

  const deleteExistingWeekData = async (reference: string): Promise<void> => {
    try {
      console.log('🗑️ Attempting to delete existing data for reference:', reference);
      
      const { data, error, count } = await supabaseAdmin
        .from('weekly_plan')
        .delete({ count: 'exact' })
        .eq('reference', reference);

      if (error) {
        console.error('❌ Delete error:', error);
        throw error;
      }
      
      console.log('✅ Successfully deleted', count, 'existing records for reference:', reference);
    } catch (error) {
      console.error('❌ Error deleting existing week data:', error);
      throw error;
    }
  };

  const convertToWeeklyPlan = (row: WeeklyPlanExcelRow, basePlanId: number): Omit<WeeklyPlan, 'id' | 'created_at' | 'updated_at'> => {
    return {
      plan_id: row.PlanID || basePlanId,
      source_warehouse: row.SourceWarehouse,
      start_date: row.StartDate ? new Date(row.StartDate).toISOString().split('T')[0] : undefined,
      reference: row.Reference || '',
      operator: row.Operator,
      warehouse: row.Warehouse,
      target_name: row.TargetName,
      item_type: row.ItemType,
      category: row.Category,
      sub_category: row.SubCategory,
      size: row.Size,
      stock_code: row.StockCode,
      description: row.Description,
      volume: row.Volume,
      qty_on_hand: row.QtyOnHand || 0,
      qty_in_transit: row.QtyInTransit || 0,
      qty_pending_orders: row.QtyPendingOrders || 0,
      model_stock_qty: row.ModelStockQty || 0,
      order_qty: row.OrderQty || 0,
      regional_add_qty: row.RegionalAddQty || 0,
      supply_chain_add_qty: row.SupplyChainAddQty || 0,
      add_ons_qty: row.AddOnsQty || 0,
      act_order_qty: row.ActOrderQty || 0,
      comment: row.Comment,
      store_name: row['Store Name'],
      sku_type: row['SKU Type'],
      draw: row.Draw
    };
  };

  const handleUpload = async () => {
    if (!file || !userId) {
      setError('Please select a file and ensure you are logged in');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress({ current: 0, total: 100, percentage: 0, stage: 'Initializing...' });

    try {
      // Get user UUID from users table using Clerk ID
      setUploadProgress({ current: 10, total: 100, percentage: 10, stage: 'Verifying user...' });
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('clerk_id', userId)
        .single();

      if (userError || !userData) {
        throw new Error('User not found in database. Please ensure you are properly registered.');
      }

      const userUUID = userData.id;

      // Parse Excel file
      setUploadProgress({ current: 20, total: 100, percentage: 20, stage: 'Parsing Excel file...' });
      const excelData = await parseExcelFile(file);
      
      if (excelData.length === 0) {
        throw new Error('Excel file appears to be empty or has no data rows');
      }

      // Get week reference from first row to check for duplicates
      const firstRow = excelData[0];
      const weekReference = firstRow.Reference;
      
      console.log('📋 First row data:', firstRow);
      console.log('🔤 Week reference found:', weekReference);
      
      // Check if all records have the same plan_id (this would cause constraint issues)
      const planIds = excelData.map(row => row.PlanID).filter(Boolean);
      const uniquePlanIds = [...new Set(planIds)];
      console.log('🔢 Plan IDs in Excel:', {
        total: planIds.length,
        unique: uniquePlanIds.length,
        sample: uniquePlanIds.slice(0, 10)
      });
      
      // Check for duplicate week upload (only if reference exists)
      setUploadProgress({ current: 30, total: 100, percentage: 30, stage: 'Checking for duplicates...' });
      const duplicateCheck = await checkForDuplicateWeek(weekReference);
      
      // Generate unique plan_id for this upload batch to avoid conflicts
      // Use current seconds + random component to ensure uniqueness within PostgreSQL integer range
      const currentSeconds = Math.floor(Date.now() / 1000); // Current time in seconds (much smaller)
      const randomComponent = Math.floor(Math.random() * 1000); // 0-999
      const planId = -(currentSeconds % 1000000 + randomComponent); // Negative, within range
      
      console.log('🔢 Generated plan_id:', planId, 'for upload batch');
      
      // Convert Excel data to database format with proper user UUID
      // Keep original plan_ids from Excel data as-is
      setUploadProgress({ current: 40, total: 100, percentage: 40, stage: 'Processing records...' });
      
      console.log('🔄 Converting Excel data with constraint-safe plan_ids...');
      const weeklyPlanData = excelData.map((row, index) => {
        const originalPlanId = row.PlanID || planId;
        // Create unique plan_id by combining original with index, but store original in comment
        const uniquePlanId = originalPlanId * 100000 + index;
        
        return {
          ...convertToWeeklyPlan(row, planId),
          plan_id: uniquePlanId,
          // Store original plan_id in comment field for future reference
          comment: `Original Plan ID: ${originalPlanId}${row.Comment ? ` | ${row.Comment}` : ''}`,
          uploaded_by: userUUID
        };
      });
      
      console.log('📊 Will insert', weeklyPlanData.length, 'records with plan_ids from', weeklyPlanData[0]?.plan_id, 'to', weeklyPlanData[weeklyPlanData.length - 1]?.plan_id);

      if (duplicateCheck.isDuplicate) {
        // Store data for confirmation dialog
        setDuplicateWeekData({
          weekReference,
          existingRecords: duplicateCheck.count,
          newData: weeklyPlanData,
          userUUID
        });
        setIsUploading(false);
        return;
      }

      // Perform the upload
      await performUpload(weeklyPlanData, weekReference, excelData[0]);
    } catch (error) {
      setError((error as Error).message);
      setUploadProgress(null);
    } finally {
      setIsUploading(false);
    }
  };

  const performUpload = async (weeklyPlanData: any[], weekReference: string, firstRow: any) => {
    console.log('🚀 Starting performUpload with:', { 
      recordCount: weeklyPlanData.length, 
      weekReference,
      sampleRecord: weeklyPlanData[0] 
    });

    // Validate that all rows have the same week reference
    const differentReferences = weeklyPlanData.filter(row => row.reference !== weekReference);
    if (differentReferences.length > 0) {
      console.log('❌ Different references found:', differentReferences.map(r => r.reference));
      throw new Error('All rows in the Excel file must have the same week reference');
    }

    // Final duplicate check before insert
    console.log('🔍 Final duplicate check before insert...');
    const finalDuplicateCheck = await checkForDuplicateWeek(weekReference);
    if (finalDuplicateCheck.isDuplicate) {
      throw new Error(`Database already contains data for week "${weekReference}". This should have been caught earlier.`);
    }

    // Insert data into database using upsert to handle constraint conflicts
    setUploadProgress({ current: 70, total: 100, percentage: 70, stage: `Uploading ${weeklyPlanData.length} records...` });
    console.log('💾 Inserting data into database using upsert...');
    
    let insertedData;
    
    try {
      // Use upsert to handle constraint conflicts
      const { data, error } = await supabaseAdmin
        .from('weekly_plan')
        .upsert(weeklyPlanData, { 
          onConflict: 'reference,plan_id',
          ignoreDuplicates: false 
        })
        .select('id');

      if (error) {
        console.error('❌ Database upsert error:', error);
        throw new Error('Database error: ' + error.message);
      }

      insertedData = data;
      console.log('✅ Database upsert successful:', data?.length, 'records processed');
    } catch (upsertError) {
      console.log('⚠️ Upsert failed, trying batch insert approach...');
      
      // Fallback: Delete existing records first, then insert in smaller batches
      console.log('🗑️ Deleting existing records for reference:', weekReference);
      await deleteExistingWeekData(weekReference);
      
      // Wait a moment to ensure delete operation is complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('💾 Inserting new records in batches...');
      const batchSize = 1000;
      const batches = [];
      
      for (let i = 0; i < weeklyPlanData.length; i += batchSize) {
        batches.push(weeklyPlanData.slice(i, i + batchSize));
      }
      
      console.log(`📦 Split ${weeklyPlanData.length} records into ${batches.length} batches of ${batchSize} each`);
      
      let allInsertedData = [];
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`⏳ Inserting batch ${i + 1}/${batches.length} (${batch.length} records)...`);
        
        // Simple insert - we'll handle constraint violations differently
        const { data, error } = await supabaseAdmin
          .from('weekly_plan')
          .insert(batch)
          .select('id');

        if (error) {
          console.error(`❌ Database insert error for batch ${i + 1}:`, error);
          throw new Error(`Database error on batch ${i + 1}: ${error.message}`);
        }

        allInsertedData.push(...(data || []));
        console.log(`✅ Batch ${i + 1} inserted successfully (${data?.length} records)`);
        
        // Small delay between batches to avoid overwhelming the database
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      insertedData = allInsertedData;
      console.log('✅ All batches inserted successfully:', allInsertedData.length, 'total records');
    }

    // Set upload statistics
    setUploadProgress({ current: 90, total: 100, percentage: 90, stage: 'Finalizing upload...' });
    const stats: WeeklyPlanUploadStats = {
      totalRows: weeklyPlanData.length,
      successfulRows: insertedData?.length || 0,
      errorRows: weeklyPlanData.length - (insertedData?.length || 0),
      weekReference: weekReference,
      startDate: firstRow.StartDate ? new Date(firstRow.StartDate).toISOString().split('T')[0] : ''
    };

    setUploadStats(stats);
    setUploadProgress({ current: 100, total: 100, percentage: 100, stage: 'Upload completed!' });
      
    toast({
      title: 'Upload Successful',
      description: `Successfully uploaded ${stats.successfulRows} records for ${weekReference}`,
    });

    // Reset form
    setFile(null);
    setUploadProgress(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmReplace = async () => {
    if (!duplicateWeekData) return;

    setIsUploading(true);
    setError(null);
    setDuplicateWeekData(null);
    setUploadProgress({ current: 0, total: 100, percentage: 0, stage: 'Preparing to replace data...' });

    try {
      // Delete existing data for the week
      setUploadProgress({ current: 30, total: 100, percentage: 30, stage: 'Deleting existing data...' });
      await deleteExistingWeekData(duplicateWeekData.weekReference);
      
      // Upload new data
      setUploadProgress({ current: 60, total: 100, percentage: 60, stage: 'Uploading new data...' });
      const firstRow = duplicateWeekData.newData[0];
      await performUpload(duplicateWeekData.newData, duplicateWeekData.weekReference, {
        StartDate: firstRow.start_date,
        Reference: duplicateWeekData.weekReference
      });
      
    } catch (error) {
      setError((error as Error).message);
      setUploadProgress(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelReplace = () => {
    setDuplicateWeekData(null);
    setError(null);
    setUploadProgress(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Weekly Plan Upload
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragOver ? 'border-primary bg-primary/10' : 'border-muted-foreground/25'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="space-y-4">
            <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <p className="text-lg font-medium">
                Drop your Weekly Plan Excel file here
              </p>
              <p className="text-sm text-muted-foreground">
                or click anywhere here to browse files (.xlsx, .xls)
              </p>
            </div>
            <div>
              <Input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                ref={fileInputRef}
                className="sr-only"
              />
              <Button 
                variant="outline" 
                className="cursor-pointer"
                onClick={handleBrowseClick}
                type="button"
              >
                Browse Files
              </Button>
            </div>
          </div>
        </div>

        {/* Selected File Info */}
        {file && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="text-sm font-medium">{file.name}</span>
            <span className="text-xs text-muted-foreground">
              ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </span>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Upload Stats */}
        {uploadStats && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium">Upload completed successfully!</p>
                <p>Week: {uploadStats.weekReference}</p>
                <p>Start Date: {uploadStats.startDate}</p>
                <p>Records uploaded: {uploadStats.successfulRows} of {uploadStats.totalRows}</p>
                {uploadStats.errorRows > 0 && (
                  <p className="text-destructive">Failed records: {uploadStats.errorRows}</p>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Duplicate Week Confirmation */}
        {duplicateWeekData && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-3">
                <div>
                  <p className="font-medium">Weekly Plan Already Exists</p>
                  <p>A weekly plan for "{duplicateWeekData.weekReference}" already exists with {duplicateWeekData.existingRecords} records.</p>
                  <p>Do you want to replace the existing data with the new upload?</p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={handleConfirmReplace}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Replacing...
                      </>
                    ) : (
                      'Yes, Replace Existing Data'
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleCancelReplace}
                    disabled={isUploading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Upload Button */}
        {!duplicateWeekData && (
          <Button 
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="w-full"
          >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {uploadProgress?.stage || 'Uploading...'}
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload Weekly Plan
            </>
          )}
        </Button>
        )}

        {/* Upload Progress */}
        {uploadProgress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{uploadProgress.stage}</span>
              <span>{uploadProgress.percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out"
                style={{ width: `${uploadProgress.percentage}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground text-center">
              {uploadProgress.current > 0 && uploadProgress.total > 0 && (
                `Step ${uploadProgress.current} of ${uploadProgress.total}`
              )}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-sm text-muted-foreground space-y-2">
          <p className="font-medium">Upload Instructions:</p>
          <ul className="space-y-1 ml-4">
            <li>• Excel file must contain the weekly plan data with proper column headers</li>
            <li>• Week reference (e.g., "Week 28") is used to prevent duplicate uploads</li>
            <li>• All rows must have the same week reference</li>
            <li>• Supported formats: .xlsx, .xls</li>
            <li>• Only admin users can upload weekly plans</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};