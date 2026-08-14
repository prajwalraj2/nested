// src/components/admin/tables/CSVUploadInterface.tsx

'use client';

import { useState, useCallback, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

import { 
  TableSchema, 
  TableData, 
  CSVParseResult, 
  CSVValidationResult,
  CSVImportPreview 
} from '@/types/table';
import { transformCsvToTableData, validateColumnValue,
  getImportTargets,
} from '@/lib/table-utils';

/**
 * CSV Upload Interface Component
 * 
 * Step 3 of the table creation wizard (optional).
 * Handles CSV file upload and data import:
 * - Drag and drop file upload
 * - CSV parsing and validation
 * - Column mapping to table schema
 * - Data preview and error handling
 * - Bulk data import
 * 
 * Features:
 * - File format validation
 * - Real-time parsing feedback
 * - Column header mapping
 * - Data validation against schema
 * - Error reporting and correction
 */

type CSVUploadInterfaceProps = {
  schema: TableSchema;
  existingData?: TableData;
  onDataUpload: (data: TableData, file?: File) => void;
};

export function CSVUploadInterface({ 
  schema, 
  existingData, 
  onDataUpload 
}: CSVUploadInterfaceProps) {
  
  // State management
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'parsing' | 'previewing' | 'complete'>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [validationResult, setValidationResult] = useState<CSVValidationResult | null>(null);
  const [previewData, setPreviewData] = useState<TableData | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  // File upload handling
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const csvFile = acceptedFiles[0];
    if (!csvFile) return;

    // Validate file type
    if (!csvFile.name.toLowerCase().endsWith('.csv')) {
      setErrors(['Please upload a CSV file (.csv extension)']);
      return;
    }

    // Validate file size (max 10MB)
    if (csvFile.size > 10 * 1024 * 1024) {
      setErrors(['File size must be less than 10MB']);
      return;
    }

    setFile(csvFile);
    setUploadState('uploading');
    setErrors([]);
    
    // Parse CSV file
    parseCSVFile(csvFile);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv']
    },
    multiple: false
  });

  // CSV parsing
  const parseCSVFile = useCallback((file: File) => {
    setUploadState('parsing');
    
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length > 0) {
          setErrors(result.errors.map(err => err.message));
          setUploadState('idle');
          return;
        }

        const data = result.data as string[][];
        if (data.length === 0) {
          setErrors(['CSV file is empty']);
          setUploadState('idle');
          return;
        }

        const parseResult: CSVParseResult = {
          success: true,
          data: data,
          headers: data[0] || [],
          rowCount: data.length - 1,
        };

        setParseResult(parseResult);
        
        // Auto-map columns based on similarity
        const autoMapping = autoMapColumns(parseResult.headers!, schema.columns);
        setColumnMapping(autoMapping);
        
        setUploadState('previewing');
      },
      error: (error) => {
        setErrors([error.message]);
        setUploadState('idle');
      }
    });
  }, [schema]);

  // Auto-map CSV columns to table columns
  const autoMapColumns = useCallback((csvHeaders: string[], schemaColumns: any[]) => {
    const mapping: Record<string, string> = {};

    /*
      ⚠️ IMAGE FIELDS ARE MATCHED FIRST, AND ONLY ON AN EXPLICIT WORD.

      Auto-mapping matches loosely — "Course" finds "Course Name" — which is right for
      columns and wrong for image fields: a CSV header of "Course Name" would otherwise
      match the image field for that same column as readily as the column itself.

      So an image field is only auto-mapped when the header actually says so, and it is
      tried before the column pass so the explicit signal wins.
    */
    const imageFields = schemaColumns
      .filter(col => col.meta?.imageColumn)
      .map(col => ({ id: col.meta.imageColumn as string, columnName: String(col.name) }));

    csvHeaders.forEach(csvHeader => {
      const header = csvHeader.toLowerCase();
      const saysImage = /(image|logo|icon|picture|photo|thumbnail)/.test(header);

      if (saysImage && imageFields.length > 0) {
        // With several image fields, prefer the one whose column is also named in the header
        // ("Course Name Image"); otherwise the only one, if there is only one.
        const named = imageFields.find(f => header.includes(f.columnName.toLowerCase()));
        const target = named ?? (imageFields.length === 1 ? imageFields[0] : undefined);
        if (target) {
          mapping[csvHeader] = target.id;
          return;
        }
      }

      // Find best match based on name similarity
      const bestMatch = schemaColumns.find(col =>
        col.name.toLowerCase().includes(header) ||
        header.includes(col.name.toLowerCase())
      );

      if (bestMatch) {
        mapping[csvHeader] = bestMatch.id;
      }
    });

    return mapping;
  }, []);

  // Column mapping update
  const updateColumnMapping = useCallback((csvHeader: string, columnId: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [csvHeader]: columnId
    }));
  }, []);

  // Generate preview data
  const generatePreview = useCallback(() => {
    if (!parseResult || !parseResult.data) return;

    setUploadState('parsing');
    
    try {
      // Transform CSV data to table data
      const tableData = transformCsvToTableData(
        parseResult.data,
        schema,
        columnMapping
      );

      // Validate data
      const validation = validateTableData(tableData, schema);
      
      setPreviewData(tableData);
      setValidationResult(validation);
      setUploadState('complete');
    } catch (error) {
      setErrors([`Failed to process data: ${error}`]);
      setUploadState('previewing');
    }
  }, [parseResult, schema, columnMapping]);

  // Data validation
  const validateTableData = useCallback((data: TableData, schema: TableSchema): CSVValidationResult => {
    const errors: any[] = [];
    const warnings: any[] = [];
    let validRows = 0;
    let invalidRows = 0;

    data.rows.forEach((row, rowIndex) => {
      let rowHasErrors = false;

      schema.columns.forEach(column => {
        const value = row[column.id];
        const columnErrors = validateColumnValue(value, column);
        
        if (columnErrors.length > 0) {
          rowHasErrors = true;
          columnErrors.forEach(errorMsg => {
            errors.push({
              row: rowIndex + 1,
              column: column.name,
              message: errorMsg,
              value: value
            });
          });
        }
      });

      if (rowHasErrors) {
        invalidRows++;
      } else {
        validRows++;
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary: {
        totalRows: data.rows.length,
        validRows,
        invalidRows,
        emptyRows: 0
      }
    };
  }, []);

  // Import data
  const handleImport = useCallback(() => {
    if (previewData) {
      onDataUpload(previewData, file || undefined);
    }
  }, [previewData, file, onDataUpload]);

  // Reset upload
  const resetUpload = useCallback(() => {
    setUploadState('idle');
    setFile(null);
    setParseResult(null);
    setColumnMapping({});
    setValidationResult(null);
    setPreviewData(null);
    setErrors([]);
  }, []);

  // Computed values
  const mappedColumnsCount = Object.values(columnMapping).filter(Boolean).length;
  const canGeneratePreview = parseResult && mappedColumnsCount > 0;
  const canImport = previewData && validationResult?.isValid;

  return (
    <div className="space-y-6">
      
      {/* Step Description */}
      <div className="text-center">
        <h3 className="text-xl font-semibold mb-2">
          Import Data from CSV
        </h3>
        <p className="text-muted-foreground">
          Upload a CSV file to populate your table with data. This step is optional.
        </p>
      </div>

      {/* File Upload */}
      {uploadState === 'idle' && (
        <Card>
          <CardHeader>
            <CardTitle>📤 Upload CSV File</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive 
                  ? 'border-primary bg-accent' 
                  : 'hover:border-muted-foreground/40'
              }`}
            >
              <input {...getInputProps()} />
              <div className="text-4xl mb-4">📄</div>
              {isDragActive ? (
                <p className="text-primary font-medium">Drop your CSV file here...</p>
              ) : (
                <div>
                  <p className="font-medium mb-2">
                    Drag & drop your CSV file here, or click to browse
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Supports .csv files up to 10MB
                  </p>
                </div>
              )}
            </div>
            
            {/* CSV Format Help */}
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">CSV Format Requirements:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• First row should contain column headers</li>
                <li>• Use commas to separate values</li>
                <li>• Enclose text with commas in quotes</li>
                <li>• Date format: YYYY-MM-DD or MM/DD/YYYY</li>
                <li>• Boolean values: true/false, yes/no, 1/0</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parsing Progress */}
      {(uploadState === 'uploading' || uploadState === 'parsing') && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-4xl mb-4">⏳</div>
              <h4 className="font-medium mb-2">
                {uploadState === 'uploading' ? 'Uploading file...' : 'Parsing CSV data...'}
              </h4>
              <Progress value={uploadState === 'uploading' ? 50 : 75} className="w-full max-w-sm mx-auto" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Column Mapping */}
      {uploadState === 'previewing' && parseResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>🔗 Map CSV Columns to Table Columns</span>
              <Badge variant="outline">
                {mappedColumnsCount} of {parseResult.headers?.length || 0} mapped
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {parseResult.headers?.map(csvHeader => (
                <div key={csvHeader} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{csvHeader}</h4>
                    <p className="text-sm text-muted-foreground">CSV Column</p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className="text-muted-foreground" aria-hidden="true">&rarr;</span>
                    <select
                      value={columnMapping[csvHeader] || ''}
                      onChange={(e) => updateColumnMapping(csvHeader, e.target.value)}
                      className="px-3 py-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-ring focus:border-ring"
                    >
                      <option value="">Skip this column</option>
                      {/*
                        ⚠️ `getImportTargets`, not `schema.columns`. A row image lives in a
                        field named by `meta.imageColumn`, which is deliberately not a column —
                        so a list of columns cannot offer it as a destination, and the
                        transform would drop anything mapped there. One shared list means this
                        dropdown and `transformCsvToTableData` cannot disagree about what
                        exists.
                      */}
                      {getImportTargets(schema).map(target => (
                        <option key={target.id} value={target.id}>
                          {target.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
            
            <Separator className="my-6" />
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={resetUpload}>
                Cancel Upload
              </Button>
              
              <Button 
                onClick={generatePreview}
                disabled={!canGeneratePreview}
              >
                Generate Preview
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Preview */}
      {uploadState === 'complete' && previewData && validationResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>👁️ Data Preview</span>
              <Badge 
                variant={validationResult.isValid ? 'default' : 'destructive'}
              >
                {validationResult.summary.validRows} valid, {validationResult.summary.invalidRows} invalid
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            
            {/* Validation Summary */}
            <div className="mb-6 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">Import Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Rows:</span>
                  <span className="ml-2 font-medium">{validationResult.summary.totalRows}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Valid:</span>
                  <span className="ml-2 font-medium">{validationResult.summary.validRows}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Invalid:</span>
                  <span className="ml-2 font-medium text-destructive">{validationResult.summary.invalidRows}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Mapped Columns:</span>
                  <span className="ml-2 font-medium">{mappedColumnsCount}</span>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {validationResult.errors.length > 0 && (
              <div className="mb-6 p-4 border rounded-lg">
                <h4 className="font-medium text-destructive mb-2">
                  ⚠️ Data Validation Errors ({validationResult.errors.length})
                </h4>
                <div className="max-h-40 overflow-y-auto">
                  <div className="space-y-1 text-sm">
                    {validationResult.errors.slice(0, 10).map((error, index) => (
                      <div key={index} className="text-destructive">
                        Row {error.row}, Column "{error.column}": {error.message}
                      </div>
                    ))}
                    {validationResult.errors.length > 10 && (
                      <div className="text-destructive font-medium">
                        ... and {validationResult.errors.length - 10} more errors
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Data Preview Table */}
            <div className="mb-6">
              <h4 className="font-medium mb-3">Data Preview (First 5 rows)</h4>
              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y">
                  <thead className="bg-muted/50">
                    <tr>
                      {schema.columns.map(column => (
                        <th 
                          key={column.id}
                          className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                        >
                          {column.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {previewData.rows.slice(0, 5).map((row, index) => (
                      <tr key={index}>
                        {schema.columns.map(column => (
                          <td 
                            key={column.id}
                            className="px-4 py-3 text-sm align-top max-w-md break-words whitespace-normal"
                          >
                            {String(row[column.id] || '-')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={resetUpload}>
                Upload Different File
              </Button>
              
              <div className="flex space-x-2">
                <Button 
                  variant="outline"
                  onClick={() => onDataUpload(existingData || { rows: [], metadata: { totalRows: 0, lastUpdated: new Date().toISOString() } })}
                >
                  Skip Import
                </Button>
                <Button 
                  onClick={handleImport}
                  disabled={!canImport}
                  
                >
                  {validationResult.isValid ? 'Import Data' : 'Import Valid Rows Only'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/*
        Errors. Was a `Card` with `border-red-200 bg-red-50` and a ⚠️ emoji.

        ⚠️ A destructive `Alert`, not a `Card` — `Card` has **no `variant` prop**, which the
        typechecker caught when a mechanical find-and-replace tried to give it one. `Alert`
        is the primitive that actually carries the destructive treatment, and it brings the
        right ARIA role for a message the user needs to notice.
      */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertDescription>
            <p className="font-medium">Upload errors</p>
            <ul className="mt-1 space-y-1">
              {/* Keyed on the message: this list is rebuilt on every parse, so an index key
                  would let React reuse nodes across unrelated errors. */}
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Skip Option */}
      {uploadState === 'idle' && (
        <div className="text-center">
          <Button 
            variant="outline"
            onClick={() => onDataUpload(existingData || { rows: [], metadata: { totalRows: 0, lastUpdated: new Date().toISOString() } })}
          >
            Skip Data Import - Create Empty Table
          </Button>
        </div>
      )}

    </div>
  );
}
