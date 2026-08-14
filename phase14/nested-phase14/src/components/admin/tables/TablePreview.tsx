// src/components/admin/tables/TablePreview.tsx

'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

import type { 
  TableSchema, 
  TableData, 
  TableSettings,
  ColumnType 
} from '@/types/table';

/**
 * Table Preview Component
 * 
 * Step 4 of the table creation wizard (final step).
 * Shows a comprehensive preview of the table before creation:
 * - Domain and page information
 * - Table schema summary
 * - Data preview (if available)
 * - Settings configuration
 * - Final confirmation details
 * 
 * Features:
 * - Complete table configuration summary
 * - Sample data preview
 * - Schema validation status
 * - Settings overview
 * - Ready-to-create confirmation
 */

type Domain = {
  id: string;
  name: string;
  slug: string;
};

type Page = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  isNew?: boolean;
};

type TablePreviewProps = {
  domain: Domain;
  page: Page;
  schema: TableSchema;
  data?: TableData;
  settings?: TableSettings;
};

export function TablePreview({ 
  domain, 
  page, 
  schema, 
  data, 
  settings 
}: TablePreviewProps) {
  
  // Computed values
  const tableStats = useMemo(() => {
    const columnCount = schema.columns.length;
    const rowCount = data?.rows.length || 0;
    const sortableColumns = schema.columns.filter(col => col.sortable).length;
    const filterableColumns = schema.columns.filter(col => col.filterable).length;
    const requiredColumns = schema.columns.filter(col => col.required).length;
    
    return {
      columnCount,
      rowCount,
      sortableColumns,
      filterableColumns,
      requiredColumns
    };
  }, [schema, data]);

  const tableUrl = useMemo(() => {
    return `/domain/${domain.slug}/${page.slug}`;
  }, [domain, page]);

  return (
    <div className="space-y-6">
      
      {/* Step Description */}
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Review Your Table Configuration
        </h3>
        <p className="text-gray-600">
          Please review all settings below before creating your table.
        </p>
      </div>

      {/* Page Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            🎯 Table Destination
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Domain</h4>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium">{domain.name}</div>
                  <div className="text-sm text-gray-600">/{domain.slug}</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Page</h4>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{page.title}</span>
                    {page.isNew && <Badge variant="secondary">New Page</Badge>}
                  </div>
                  <div className="text-sm text-gray-600">/{page.slug}</div>
                </div>
              </div>
            </div>
            
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <span className="text-blue-700">🔗</span>
                <div>
                  <div className="font-medium text-blue-900">Table URL</div>
                  <div className="text-blue-700 text-sm">{tableUrl}</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schema Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>📋 Table Schema</span>
            <Badge variant="outline">{tableStats.columnCount} columns</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          
          {/* Schema Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{tableStats.columnCount}</div>
              <div className="text-sm text-gray-600">Total Columns</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{tableStats.sortableColumns}</div>
              <div className="text-sm text-gray-600">Sortable</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{tableStats.filterableColumns}</div>
              <div className="text-sm text-gray-600">Filterable</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{tableStats.requiredColumns}</div>
              <div className="text-sm text-gray-600">Required</div>
            </div>
          </div>

          {/* Column Details */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Column Configuration</h4>
            <div className="space-y-2">
              {schema.columns.map((column, index) => (
                <ColumnPreview key={column.id} column={column} index={index} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Summary */}
      {data && data.rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>📊 Data Preview</span>
              <Badge variant="outline">{tableStats.rowCount} rows</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            
            {/* Data Statistics */}
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <span className="text-green-700 text-xl">✅</span>
                <div>
                  <h4 className="font-medium text-green-900">Data Ready for Import</h4>
                  <p className="text-green-700 text-sm">
                    {tableStats.rowCount} rows will be imported from your CSV file.
                  </p>
                </div>
              </div>
            </div>

            {/* Sample Data Preview */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">
                Sample Data (First 3 rows)
              </h4>
              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {schema.columns.map(column => (
                        <th 
                          key={column.id}
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {column.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.rows.slice(0, 3).map((row, index) => (
                      <tr key={index}>
                        {schema.columns.map(column => (
                          <td 
                            key={column.id}
                            className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate"
                          >
                            {formatCellValue(row[column.id], column.type)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty Table Notice */}
      {(!data || data.rows.length === 0) && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <span className="text-yellow-600 text-xl">ℹ️</span>
              <div>
                <h4 className="font-medium text-yellow-900">Empty Table</h4>
                <p className="text-yellow-700 text-sm">
                  Your table will be created without any data. You can add data later through the admin interface.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settings Summary */}
      {settings && (
        <Card>
          <CardHeader>
            <CardTitle>⚙️ Table Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Pagination Settings */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Pagination</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Enabled:</span>
                    <Badge variant={settings.pagination.enabled ? 'default' : 'secondary'}>
                      {settings.pagination.enabled ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  {settings.pagination.enabled && (
                    <div className="flex justify-between">
                      <span>Page Size:</span>
                      <span className="font-medium">{settings.pagination.pageSize} rows</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Functionality Settings */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Features</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Sorting:</span>
                    <Badge variant={settings.sorting.enabled ? 'default' : 'secondary'}>
                      {settings.sorting.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Filtering:</span>
                    <Badge variant={settings.filtering.enabled ? 'default' : 'secondary'}>
                      {settings.filtering.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Global Search:</span>
                    <Badge variant={settings.filtering.globalSearch ? 'default' : 'secondary'}>
                      {settings.filtering.globalSearch ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Export:</span>
                    <Badge variant={settings.export.enabled ? 'default' : 'secondary'}>
                      {settings.export.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>
      )}

      {/* Final Confirmation */}
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-4xl mb-4">🚀</div>
            <h3 className="text-lg font-semibold text-green-900 mb-2">
              Ready to Create Table!
            </h3>
            <p className="text-green-700 mb-4">
              Your table configuration is complete and ready to be saved.
            </p>
            
            <div className="text-sm text-green-600 space-y-1">
              <div>✅ Domain and page selected</div>
              <div>✅ {tableStats.columnCount} columns configured</div>
              {data && data.rows.length > 0 && (
                <div>✅ {tableStats.rowCount} rows ready for import</div>
              )}
              <div>✅ Table settings configured</div>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

/**
 * Individual Column Preview Component
 */
type ColumnPreviewProps = {
  column: any;
  index: number;
};

function ColumnPreview({ column, index }: ColumnPreviewProps) {
  const getColumnIcon = (type: ColumnType): string => {
    const icons: Record<ColumnType, string> = {
      text: '📝',
      badge: '🏷️',
      link: '🔗',
      description: '📄',
      image: '🖼️',
      number: '🔢',
      date: '📅',
      email: '📧',
      phone: '📞',
      currency: '💰',
      rating: '⭐',
      boolean: '☑️',
    };
    return icons[type] || '📝';
  };

  return (
    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
      <div className="flex items-center space-x-3">
        <Badge variant="outline">#{index + 1}</Badge>
        <div className="text-xl">{getColumnIcon(column.type)}</div>
        <div>
          <h5 className="font-medium text-gray-900">{column.name}</h5>
          <p className="text-sm text-gray-600 capitalize">{column.type}</p>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        {column.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
        {column.sortable && <Badge variant="secondary" className="text-xs">Sortable</Badge>}
        {column.filterable && <Badge variant="secondary" className="text-xs">Filterable</Badge>}
      </div>
    </div>
  );
}

/**
 * Format cell value for preview display
 */
function formatCellValue(value: any, type: ColumnType): string {
  if (value === null || value === undefined) return '-';
  
  switch (type) {
    case 'currency':
      const num = parseFloat(value);
      return isNaN(num) ? String(value) : `$${num.toFixed(2)}`;
    case 'date':
      const date = new Date(value);
      return isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'email':
    case 'phone':
    case 'link':
      return String(value);
    case 'description':
      return String(value).length > 50 ? String(value).substring(0, 50) + '...' : String(value);
    default:
      return String(value);
  }
}
