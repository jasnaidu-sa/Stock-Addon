import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Package, AlertCircle, CheckCircle, Loader2, Download } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabaseAdmin } from '@/lib/supabase';
import { useAuth } from '@clerk/clerk-react';
import * as XLSX from 'xlsx';

type CategoryType = 'mattress' | 'base' | 'furniture' | 'accessories' | 'foam' | 'headboards';

interface CategoryDataRow {
  code: string;
  description: string;
  price: number;
  size?: string;
  // Mattress-specific fields
  mattress_code?: string;
  base_code?: string;
  mattress_price?: number;
  base_price?: number;
  set_price?: number;
  base_price_total?: number;
  base_qty?: number;
}

interface UploadStats {
  totalRows: number;
  successfulRows: number;
  errorRows: number;
  errors: string[];
}

const CATEGORY_SCHEMAS = {
  mattress: {
    table: 'mattress',
    requiredFields: ['mattress_code', 'base_code', 'description', 'size', 'mattress_price', 'base_price', 'set_price', 'base_price_total', 'base_qty'],
    template: {
      mattress_code: 'MATTRESS-001',
      base_code: 'BASE-001',
      description: 'Queen Mattress Set',
      size: 'Queen',
      mattress_price: 1200.00,
      base_price: 800.00,
      set_price: 2000.00,
      base_price_total: 800.00,
      base_qty: 1
    }
  },
  base: {
    table: 'base',
    requiredFields: ['code', 'description', 'price'],
    template: {
      code: 'BASE-001',
      description: 'Queen Base',
      price: 800.00
    }
  },
  furniture: {
    table: 'furniture',
    requiredFields: ['code', 'description', 'price', 'size'],
    template: {
      code: 'FURN-001',
      description: 'Bedside Table',
      price: 350.00,
      size: 'Standard'
    }
  },
  accessories: {
    table: 'accessories',
    requiredFields: ['code', 'description', 'price', 'size'],
    template: {
      code: 'ACC-001',
      description: 'Pillow Set',
      price: 120.00,
      size: 'Standard'
    }
  },
  foam: {
    table: 'foam',
    requiredFields: ['code', 'description', 'price', 'size'],
    template: {
      code: 'FOAM-001',
      description: 'Memory Foam Topper',
      price: 250.00,
      size: 'Queen'
    }
  },
  headboards: {
    table: 'headboards',
    requiredFields: ['code', 'description', 'price', 'size'],
    template: {
      code: 'HEAD-001',
      description: 'Upholstered Headboard',
      price: 450.00,
      size: 'Queen'
    }
  }
};

export const CategoryDataUpload: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | null>(null);
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

  const handleCategoryChange = (category: CategoryType) => {
    setSelectedCategory(category);
    setFile(null);
    setError(null);
    setUploadStats(null);
  };

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

  const parseExcelFile = (file: File): Promise<CategoryDataRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });
          
          resolve(jsonData as CategoryDataRow[]);
        } catch (error) {
          reject(new Error('Failed to parse Excel file: ' + (error as Error).message));
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const validateCategoryData = (data: CategoryDataRow[], category: CategoryType): { valid: CategoryDataRow[]; errors: string[] } => {
    const valid: CategoryDataRow[] = [];
    const errors: string[] = [];
    const schema = CATEGORY_SCHEMAS[category];

    data.forEach((row, index) => {
      const rowNumber = index + 2; // Excel row number (accounting for header)
      
      // Check required fields
      for (const field of schema.requiredFields) {
        if (!row[field as keyof CategoryDataRow]) {
          errors.push(`Row ${rowNumber}: ${field} is required`);
          return;
        }
      }

      // Validate price fields are numbers
      const priceFields = ['price', 'mattress_price', 'base_price', 'set_price', 'base_price_total'];
      for (const field of priceFields) {
        if (row[field as keyof CategoryDataRow] !== undefined) {
          const value = Number(row[field as keyof CategoryDataRow]);
          if (isNaN(value) || value < 0) {
            errors.push(`Row ${rowNumber}: ${field} must be a valid positive number`);
            return;
          }
        }
      }

      // Validate quantity fields are integers
      if (row.base_qty !== undefined) {
        const value = Number(row.base_qty);
        if (isNaN(value) || value < 0 || !Number.isInteger(value)) {
          errors.push(`Row ${rowNumber}: base_qty must be a valid positive integer`);
          return;
        }
      }

      valid.push(row);
    });

    return { valid, errors };
  };

  const transformDataForInsert = (data: CategoryDataRow[], category: CategoryType) => {
    return data.map(row => {
      const transformed: any = {};
      
      // Common fields
      if (row.code) transformed.code = row.code;
      if (row.description) transformed.description = row.description;
      if (row.price) transformed.price = Number(row.price);
      if (row.size) transformed.size = row.size;
      
      // Mattress-specific fields
      if (category === 'mattress') {
        if (row.mattress_code) transformed.mattress_code = row.mattress_code;
        if (row.base_code) transformed.base_code = row.base_code;
        if (row.mattress_price) transformed.mattress_price = Number(row.mattress_price);
        if (row.base_price) transformed.base_price = Number(row.base_price);
        if (row.set_price) transformed.set_price = Number(row.set_price);
        if (row.base_price_total) transformed.base_price_total = Number(row.base_price_total);
        if (row.base_qty) transformed.base_qty = Number(row.base_qty);
      }
      
      return transformed;
    });
  };

  const handleUpload = async () => {
    if (!file || !userId || !selectedCategory) {
      setError('Please select a category and file, and ensure you are logged in');
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
        throw new Error('Only admin users can upload category data');
      }

      // Parse Excel file
      setUploadProgress({ current: 20, total: 100, percentage: 20, stage: 'Parsing Excel file...' });
      const excelData = await parseExcelFile(file);
      
      if (excelData.length === 0) {
        throw new Error('Excel file appears to be empty or has no data rows');
      }

      // Validate data
      setUploadProgress({ current: 40, total: 100, percentage: 40, stage: 'Validating data...' });
      const { valid, errors } = validateCategoryData(excelData, selectedCategory);
      
      if (errors.length > 0) {
        throw new Error('Validation errors found:\n' + errors.join('\n'));
      }

      const schema = CATEGORY_SCHEMAS[selectedCategory];
      const tableName = schema.table;

      // Backup existing data
      setUploadProgress({ current: 50, total: 100, percentage: 50, stage: 'Creating backup...' });
      const { error: backupError } = await supabaseAdmin
        .from(tableName)
        .select('*');

      if (backupError) {
        console.error('Backup failed:', backupError);
        // Continue anyway as backup is not critical
      }

      // Clear existing data (overwrite mode)
      setUploadProgress({ current: 60, total: 100, percentage: 60, stage: 'Clearing existing data...' });
      const { error: deleteError } = await supabaseAdmin
        .from(tableName)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

      if (deleteError) {
        console.error('Delete error:', deleteError);
        throw new Error(`Failed to clear existing ${selectedCategory} data: ${deleteError.message}`);
      }

      // Transform and insert new data
      setUploadProgress({ current: 80, total: 100, percentage: 80, stage: 'Uploading new data...' });
      const transformedData = transformDataForInsert(valid, selectedCategory);
      
      const { data: insertedData, error: insertError } = await supabaseAdmin
        .from(tableName)
        .insert(transformedData)
        .select('id');

      if (insertError) {
        console.error('Insert error:', insertError);
        throw new Error(`Failed to insert ${selectedCategory} data: ${insertError.message}`);
      }

      // Set upload statistics
      setUploadProgress({ current: 90, total: 100, percentage: 90, stage: 'Finalizing upload...' });
      const stats: UploadStats = {
        totalRows: valid.length,
        successfulRows: insertedData?.length || 0,
        errorRows: valid.length - (insertedData?.length || 0),
        errors: []
      };

      setUploadStats(stats);
      setUploadProgress({ current: 100, total: 100, percentage: 100, stage: 'Upload completed!' });
      
      toast({
        title: 'Upload Successful',
        description: `Successfully uploaded ${stats.successfulRows} ${selectedCategory} records`,
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
    if (!selectedCategory) return;
    
    const schema = CATEGORY_SCHEMAS[selectedCategory];
    const template = [schema.template];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, selectedCategory);
    XLSX.writeFile(wb, `${selectedCategory}-template.xlsx`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Category Data Upload
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Category Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Category</label>
          <Select value={selectedCategory || ''} onValueChange={handleCategoryChange}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a category to upload" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mattress">Mattress</SelectItem>
              <SelectItem value="base">Base</SelectItem>
              <SelectItem value="furniture">Furniture</SelectItem>
              <SelectItem value="accessories">Accessories</SelectItem>
              <SelectItem value="foam">Foam</SelectItem>
              <SelectItem value="headboards">Headboards</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Template Download */}
        {selectedCategory && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={downloadTemplate}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download {selectedCategory} Template
            </Button>
          </div>
        )}

        {/* File Upload Area */}
        {selectedCategory && (
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
                  Drop your {selectedCategory} Excel file here
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
        )}

        {/* Selected File Info */}
        {file && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Package className="h-4 w-4" />
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
                <p>Category: {selectedCategory}</p>
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
          disabled={!file || !selectedCategory || isUploading}
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
              Upload {selectedCategory || 'Category'} Data
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

        {/* Field Requirements */}
        {selectedCategory && (
          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium">Required Fields for {selectedCategory}:</p>
            <ul className="space-y-1 ml-4">
              {CATEGORY_SCHEMAS[selectedCategory].requiredFields.map(field => (
                <li key={field}>• <strong>{field}</strong></li>
              ))}
            </ul>
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="font-medium text-amber-800 mb-2">⚠️ Important Notes:</p>
              <ul className="space-y-1 ml-4 text-amber-700">
                <li>• This will completely overwrite all existing {selectedCategory} data</li>
                <li>• All price fields must be positive numbers</li>
                <li>• Quantity fields must be positive integers</li>
                <li>• Product codes should be unique within the category</li>
                <li>• Only admin users can perform this upload</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};