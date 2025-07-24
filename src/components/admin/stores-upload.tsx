import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle,
  Loader2,
  Trash2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StoreUploadRow, UploadResult } from '@/types/amendment-system';
import * as XLSX from 'xlsx';

interface StoreUploadProps {
  onUploadComplete?: (result: UploadResult) => void;
}

export const StoresUpload: React.FC<StoreUploadProps> = ({ onUploadComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [previewData, setPreviewData] = useState<StoreUploadRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  const expectedColumns = [
    'Store Code',
    'Store Name', 
    'Region',
    'Address',
    'Contact Person',
    'Phone',
    'Email'
  ];

  const requiredColumns = ['Store Code', 'Store Name'];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        toast({
          title: 'Invalid File Type',
          description: 'Please select an Excel file (.xlsx or .xls)',
          variant: 'destructive',
        });
        return;
      }
      setFile(selectedFile);
      setUploadResult(null);
      parseExcelFile(selectedFile);
    }
  };

  const parseExcelFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json<StoreUploadRow>(worksheet, { header: 1 });

      if (data.length < 2) {
        toast({
          title: 'Invalid File',
          description: 'Excel file must contain at least a header row and one data row',
          variant: 'destructive',
        });
        return;
      }

      // Parse header and data rows
      const headers = data[0] as unknown as string[];
      const rows = data.slice(1) as unknown as any[][];

      // Validate headers
      const missingRequired = requiredColumns.filter(col => !headers.includes(col));
      if (missingRequired.length > 0) {
        toast({
          title: 'Missing Required Columns',
          description: `Missing columns: ${missingRequired.join(', ')}`,
          variant: 'destructive',
        });
        return;
      }

      // Convert to objects
      const parsedData: StoreUploadRow[] = rows.map(row => {
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || '';
        });
        return obj;
      });

      setPreviewData(parsedData.slice(0, 10)); // Show first 10 rows for preview
      setShowPreview(true);

      toast({
        title: 'File Parsed Successfully',
        description: `Found ${parsedData.length} stores to process`,
      });
    } catch (error) {
      console.error('Error parsing Excel file:', error);
      toast({
        title: 'Parse Error',
        description: 'Failed to parse Excel file. Please check the format.',
        variant: 'destructive',
      });
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/admin/stores-upload', {
        method: 'POST',
        body: formData,
      });

      const result: UploadResult = await response.json();

      if (response.ok) {
        setUploadResult(result);
        onUploadComplete?.(result);
        
        if (result.success) {
          toast({
            title: 'Upload Successful',
            description: `${result.successfulRows} stores uploaded successfully`,
          });
        } else {
          toast({
            title: 'Upload Completed with Errors',
            description: `${result.successfulRows} successful, ${result.errorRows} errors`,
            variant: 'destructive',
          });
        }
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload stores',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      expectedColumns,
      ['BED001', 'Cape Town Main', 'Western Cape', '123 Main Road, Cape Town', 'John Smith', '021-123-4567', 'ct@bedshop.co.za'],
      ['BED002', 'Durban Central', 'KwaZulu-Natal', '456 Smith Street, Durban', 'Jane Doe', '031-987-6543', 'durban@bedshop.co.za'],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stores Template');
    XLSX.writeFile(workbook, 'stores_template.xlsx');

    toast({
      title: 'Template Downloaded',
      description: 'Stores upload template has been downloaded',
    });
  };

  const clearUpload = () => {
    setFile(null);
    setUploadResult(null);
    setPreviewData([]);
    setShowPreview(false);
    // Reset file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Store Master Upload
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Controls */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={downloadTemplate}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download Template
            </Button>
            <div className="text-sm text-muted-foreground">
              Required columns: {requiredColumns.join(', ')}
            </div>
          </div>

          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="stores-file">Select Excel File</Label>
            <Input
              id="stores-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              disabled={isUploading}
            />
          </div>

          {file && (
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="text-sm">{file.name}</span>
              <Badge variant="secondary">{(file.size / 1024).toFixed(1)} KB</Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearUpload}
                disabled={isUploading}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}

          {file && !isUploading && (
            <Button 
              onClick={handleUpload}
              className="flex items-center gap-2"
              disabled={!showPreview}
            >
              <Upload className="h-4 w-4" />
              Upload Stores
            </Button>
          )}

          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Uploading stores...</span>
              </div>
              <Progress value={undefined} className="w-full" />
            </div>
          )}
        </div>

        {/* Preview Data */}
        {showPreview && previewData.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Preview (First 10 rows)</h4>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store Code</TableHead>
                    <TableHead>Store Name</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono">{row['Store Code']}</TableCell>
                      <TableCell>{row['Store Name']}</TableCell>
                      <TableCell>{row['Region']}</TableCell>
                      <TableCell>{row['Contact Person']}</TableCell>
                      <TableCell>{row['Phone']}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Upload Results */}
        {uploadResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {uploadResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              <h4 className="text-sm font-medium">Upload Results</h4>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Total Rows</div>
                <div className="font-medium">{uploadResult.totalRows}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Successful</div>
                <div className="font-medium text-green-600">{uploadResult.successfulRows}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Errors</div>
                <div className="font-medium text-red-600">{uploadResult.errorRows}</div>
              </div>
            </div>

            {uploadResult.errors && uploadResult.errors.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-red-600">Errors:</h5>
                <div className="rounded-md border border-red-200 bg-red-50 p-3 max-h-40 overflow-y-auto">
                  {uploadResult.errors.map((error, index) => (
                    <div key={index} className="text-sm text-red-700">
                      Row {error.row}: {error.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};