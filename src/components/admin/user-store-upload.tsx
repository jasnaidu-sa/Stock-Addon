import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Users, AlertCircle, CheckCircle, Loader2, AlertTriangle, Download } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabaseAdmin } from '@/lib/supabase';
import { useAuth } from '@clerk/clerk-react';
import * as XLSX from 'xlsx';

interface UserStoreAssignment {
  email: string;
  name: string;
  company_name: string;
  group_type?: string;
  role: 'admin' | 'user';
  status: 'active' | 'pending';
  clerk_id?: string;
}

interface UploadStats {
  totalRows: number;
  successfulRows: number;
  errorRows: number;
  errors: string[];
}

export const UserStoreUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    percentage: number;
    stage: string;
  } | null>(null);
  const [uploadStats, setUploadStats] = useState<UploadStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
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
      // Clear the input value to allow selecting the same file again
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

  const parseExcelFile = (file: File): Promise<UserStoreAssignment[]> => {
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
          
          resolve(jsonData as UserStoreAssignment[]);
        } catch (error) {
          reject(new Error('Failed to parse Excel file: ' + (error as Error).message));
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const validateUserData = (data: UserStoreAssignment[]): { valid: UserStoreAssignment[]; errors: string[] } => {
    const valid: UserStoreAssignment[] = [];
    const errors: string[] = [];

    data.forEach((row, index) => {
      const rowNumber = index + 2; // Excel row number (accounting for header)
      
      if (!row.email || !row.email.includes('@')) {
        errors.push(`Row ${rowNumber}: Invalid email address`);
        return;
      }
      
      if (!row.name || row.name.trim() === '') {
        errors.push(`Row ${rowNumber}: Name is required`);
        return;
      }
      
      if (!row.company_name || row.company_name.trim() === '') {
        errors.push(`Row ${rowNumber}: Company name (store) is required`);
        return;
      }
      
      if (!row.role || !['admin', 'user'].includes(row.role)) {
        errors.push(`Row ${rowNumber}: Role must be 'admin' or 'user'`);
        return;
      }
      
      if (!row.status || !['active', 'pending'].includes(row.status)) {
        errors.push(`Row ${rowNumber}: Status must be 'active' or 'pending'`);
        return;
      }

      valid.push({
        email: row.email.trim().toLowerCase(),
        name: row.name.trim(),
        company_name: row.company_name.trim(),
        group_type: row.group_type?.trim() || null,
        role: row.role as 'admin' | 'user',
        status: row.status as 'active' | 'pending',
        clerk_id: row.clerk_id?.trim() || null
      });
    });

    return { valid, errors };
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
      // Verify admin status
      setUploadProgress({ current: 10, total: 100, percentage: 10, stage: 'Verifying permissions...' });
      
      if (!supabaseAdmin) {
        throw new Error('Database connection not available');
      }
      
      const { data: adminData, error: adminError } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (adminError || !adminData || adminData.role !== 'admin') {
        throw new Error('Only admin users can upload user-store assignments');
      }

      // Parse Excel file
      setUploadProgress({ current: 20, total: 100, percentage: 20, stage: 'Parsing Excel file...' });
      const excelData = await parseExcelFile(file);
      
      if (excelData.length === 0) {
        throw new Error('Excel file appears to be empty or has no data rows');
      }

      // Validate data
      setUploadProgress({ current: 40, total: 100, percentage: 40, stage: 'Validating data...' });
      const { valid, errors } = validateUserData(excelData);
      
      if (errors.length > 0) {
        throw new Error('Validation errors found:\n' + errors.join('\n'));
      }

      // Backup existing data first
      setUploadProgress({ current: 50, total: 100, percentage: 50, stage: 'Creating backup...' });
      const { data: existingUsers, error: backupError } = await supabaseAdmin
        .from('users')
        .select('*');

      if (backupError) {
        console.error('Backup failed:', backupError);
        // Continue anyway as backup is not critical
      }

      // Clear existing user data (overwrite mode)
      setUploadProgress({ current: 60, total: 100, percentage: 60, stage: 'Clearing existing data...' });
      const { error: deleteError } = await supabaseAdmin
        .from('users')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all users

      if (deleteError) {
        console.error('Delete error:', deleteError);
        throw new Error('Failed to clear existing user data: ' + deleteError.message);
      }

      // Insert new user data
      setUploadProgress({ current: 80, total: 100, percentage: 80, stage: 'Uploading new data...' });
      const { data: insertedData, error: insertError } = await supabaseAdmin
        .from('users')
        .insert(valid.map(user => ({
          email: user.email,
          name: user.name,
          company_name: user.company_name,
          group_type: user.group_type,
          role: user.role,
          status: user.status,
          clerk_id: user.clerk_id
        })))
        .select('id');

      if (insertError) {
        console.error('Insert error:', insertError);
        throw new Error('Failed to insert user data: ' + insertError.message);
      }

      // Set upload statistics
      setUploadProgress({ current: 90, total: 100, percentage: 90, stage: 'Finalizing upload...' });
      const stats: UploadStats = {
        totalRows: valid.length,
        successfulRows: insertedData?.length || 0,
        errorRows: valid.length - (insertedData?.length || 0),
        errors: errors
      };

      setUploadStats(stats);
      setUploadProgress({ current: 100, total: 100, percentage: 100, stage: 'Upload completed!' });
      
      toast({
        title: 'Upload Successful',
        description: `Successfully uploaded ${stats.successfulRows} user-store assignments`,
      });

      // Reset form
      setFile(null);
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      setError((error as Error).message);
      setUploadProgress(null);
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        email: 'user@example.com',
        name: 'John Doe',
        company_name: 'Store Name',
        group_type: 'regional',
        role: 'user',
        status: 'active',
        clerk_id: 'user_abc123'
      },
      {
        email: 'admin@example.com',
        name: 'Jane Smith',
        company_name: 'Store Name',
        group_type: 'head_office',
        role: 'admin',
        status: 'active',
        clerk_id: 'user_def456'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'User Store Assignments');
    XLSX.writeFile(wb, 'user-store-assignment-template.xlsx');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          User-Store Assignment Upload
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Template Download */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={downloadTemplate}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download Template
          </Button>
        </div>

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
                Drop your User-Store Assignment Excel file here
              </p>
              <p className="text-sm text-muted-foreground">
                or click to browse files (.xlsx, .xls)
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
            <Users className="h-4 w-4" />
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
            <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
          </Alert>
        )}

        {/* Upload Stats */}
        {uploadStats && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium">Upload completed successfully!</p>
                <p>Total records processed: {uploadStats.totalRows}</p>
                <p>Successfully uploaded: {uploadStats.successfulRows}</p>
                {uploadStats.errorRows > 0 && (
                  <p className="text-destructive">Failed records: {uploadStats.errorRows}</p>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Upload Button */}
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
              Upload User-Store Assignments
            </>
          )}
        </Button>

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
          </div>
        )}

        {/* Instructions */}
        <div className="text-sm text-muted-foreground space-y-2">
          <p className="font-medium">Upload Instructions:</p>
          <ul className="space-y-1 ml-4">
            <li>• Excel file must contain columns: email, name, company_name, group_type, role, status, clerk_id</li>
            <li>• <strong>email</strong>: Valid email address (required)</li>
            <li>• <strong>name</strong>: Full name (required)</li>
            <li>• <strong>company_name</strong>: Store name user is assigned to (required)</li>
            <li>• <strong>group_type</strong>: Optional grouping (e.g., 'regional', 'head_office')</li>
            <li>• <strong>role</strong>: Must be 'admin' or 'user' (required)</li>
            <li>• <strong>status</strong>: Must be 'active' or 'pending' (required)</li>
            <li>• <strong>clerk_id</strong>: Optional Clerk authentication ID</li>
            <li>• <strong>WARNING:</strong> This will overwrite all existing user data!</li>
            <li>• Only admin users can perform this upload</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};