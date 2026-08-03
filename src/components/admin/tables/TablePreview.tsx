// src/components/admin/tables/TablePreview.tsx

'use client';

import { useMemo } from 'react';
import { CircleCheck, Info } from 'lucide-react';
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
        <h3 className="text-xl font-semibold mb-2">
          Review Your Table Configuration
        </h3>
        <p className="text-muted-foreground">
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
                <h4 className="font-medium mb-2">Domain</h4>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="font-medium">{domain.name}</div>
                  <div className="text-sm text-muted-foreground">/{domain.slug}</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Page</h4>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{page.title}</span>
                    {page.isNew && <Badge variant="secondary">New Page</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">/{page.slug}</div>
                </div>
              </div>
            </div>
            
            <div className="p-3 bg-muted/50 border rounded-lg">
              <div className="flex items-center space-x-2">
                <span className="text-muted-foreground">&nbsp;</span>
                <div>
                  <div className="font-medium">Table URL</div>
                  <div className="text-muted-foreground text-sm font-mono">{tableUrl}</div>
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
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{tableStats.columnCount}</div>
              <div className="text-sm text-muted-foreground">Total Columns</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{tableStats.sortableColumns}</div>
              <div className="text-sm text-muted-foreground">Sortable</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{tableStats.filterableColumns}</div>
              <div className="text-sm text-muted-foreground">Filterable</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{tableStats.requiredColumns}</div>
              <div className="text-sm text-muted-foreground">Required</div>
            </div>
          </div>

          {/* Column Details */}
          <div>
            <h4 className="font-medium mb-3">Column Configuration</h4>
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
            <div className="mb-6 p-4 bg-muted/50 border rounded-lg">
              <div className="flex items-center space-x-2">
                {/* lucide, not ✅: it inherits currentColor so it follows the theme, and at size-4 it
                      does not shout louder than the sentence beside it. */}
                  <CircleCheck className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div>
                  <h4 className="font-medium">Data Ready for Import</h4>
                  <p className="text-muted-foreground text-sm">
                    {tableStats.rowCount} rows will be imported from your CSV file.
                  </p>
                </div>
              </div>
            </div>

            {/* Sample Data Preview */}
            <div>
              <h4 className="font-medium mb-3">
                Sample Data (First 3 rows)
              </h4>
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
                    {data.rows.slice(0, 3).map((row, index) => (
                      <tr key={index}>
                        {schema.columns.map(column => (
                          <td 
                            key={column.id}
                            className="px-4 py-3 text-sm align-top max-w-md break-words whitespace-normal"
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
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Info className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div>
                <h4 className="font-medium">Empty Table</h4>
                <p className="text-muted-foreground text-sm">
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
                <h4 className="font-medium mb-3">Pagination</h4>
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
                <h4 className="font-medium mb-3">Features</h4>
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
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-4xl mb-4">🚀</div>
            <h3 className="text-lg font-semibold mb-2">
              Ready to Create Table!
            </h3>
            <p className="text-muted-foreground mb-4">
              Your table configuration is complete and ready to be saved.
            </p>
            
            <div className="text-sm text-muted-foreground space-y-1">
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
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center space-x-3">
        <Badge variant="outline">#{index + 1}</Badge>
        <div className="text-xl">{getColumnIcon(column.type)}</div>
        <div>
          <h5 className="font-medium">{column.name}</h5>
          <p className="text-sm text-muted-foreground capitalize">{column.type}</p>
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
      /**
       * ⚠️ EXPLICIT LOCALE **AND** TIME ZONE — this was a hydration hazard.
       *
       * This is a client component rendered inside a server-rendered page, so the string is
       * produced twice: once by Node and once by the browser. A bare `toLocaleDateString()`
       * uses whatever default each resolves, and they differ — Node often en-US (`8/3/2026`),
       * this project's user en-IN (`3/8/2026`). React then reports a mismatch, and worse, the
       * day and month silently swap, so one of the two renders a **wrong date**.
       *
       * This is the same class of bug that produced the "1 Issue" dev-overlay badge on
       * `/admin/tables`; `TablesManager` was fixed then and this instance was recorded as
       * outstanding for G-5d. `timeZone: 'UTC'` because the underlying values are UTC.
       */
      return isNaN(date.getTime())
        ? String(value)
        : date.toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
          });
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
