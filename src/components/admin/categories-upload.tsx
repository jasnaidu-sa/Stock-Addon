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
  Tag,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CategoryUploadRow, UploadResult } from '@/types/amendment-system';
import * as XLSX from 'xlsx';

interface CategoryUploadProps {
  onUploadComplete?: (result: UploadResult) => void;
}

export const CategoriesUpload: React.FC<CategoryUploadProps> = ({ onUploadComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [previewData, setPreviewData] = useState<CategoryUploadRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  const expectedColumns = [
    'Category Code',
    'Category Name',
    'Description',
    'Sort Order'
  ];

  const requiredColumns = ['Category Code', 'Category Name'];

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
      const data = XLSX.utils.sheet_to_json<CategoryUploadRow>(worksheet, { header: 1 });

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
      const parsedData: CategoryUploadRow[] = rows.map(row => {
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
        description: `Found ${parsedData.length} categories to process`,
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
      const response = await fetch('/api/admin/categories-upload', {
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
            description: `${result.successfulRows} categories uploaded successfully`,
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
        description: error instanceof Error ? error.message : 'Failed to upload categories',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      expectedColumns,
      ['MATT', 'Mattresses', 'All mattress products and related items', '1'],
      ['FURN', 'Furniture', 'Bedroom furniture including headboards', '2'],
      ['ACC', 'Accessories', 'Pillows, sheets, and bedroom accessories', '3'],
      ['FOAM', 'Foam Products', 'Foam mattresses and mattress toppers', '4'],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Categories Template');
    XLSX.writeFile(workbook, 'categories_template.xlsx');

    toast({
      title: 'Template Downloaded',
      description: 'Categories upload template has been downloaded',
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
          <Tag className="h-5 w-5" />
          Category Master Upload
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
            <Label htmlFor="categories-file">Select Excel File</Label>
            <Input
              id="categories-file"
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
              Upload Categories
            </Button>
          )}

          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Uploading categories...</span>
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
                    <TableHead>Category Code</TableHead>
                    <TableHead>Category Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Sort Order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono">{row['Category Code']}</TableCell>
                      <TableCell>{row['Category Name']}</TableCell>
                      <TableCell className="max-w-xs truncate">{row['Description']}</TableCell>
                      <TableCell>{row['Sort Order']}</TableCell>
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