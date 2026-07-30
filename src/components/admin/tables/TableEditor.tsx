// src/components/admin/tables/TableEditor.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/table/DataTable';
// Finding #22.5 — one export implementation, shared with the tables list.
import { downloadTableExport, type TableExportFormat } from '@/lib/export-table';

/**
 * Table Editor Component
 * 
 * Comprehensive table management interface with tabs for:
 * - Data View: Interactive table with all data
 * - Schema: Column configuration and settings
 * - Import/Export: Data management operations
 * - Settings: Table behavior configuration
 * 
 * Features:
 * - Live data editing
 * - Schema modification
 * - CSV import/export
 * - Table settings management
 * - Real-time preview
 */

type TableWithPage = {
  id: string;
  name: string;
  schema: any;
  data: any;
  settings?: any;
  updatedAt: Date;
  page: {
    id: string;
    title: string;
    slug: string;
    domain: {
      id: string;
      name: string;
      slug: string;
    };
  };
};

type TableEditorProps = {
  table: TableWithPage;
};

export function TableEditor({ table }: TableEditorProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('data');
  const [isLoading, setIsLoading] = useState(false);

  // Handle export functionality
  /**
   * Export now delegates to `src/lib/export-table.ts` (finding #22.5).
   *
   * The implementation is unchanged — it was moved out so the tables LIST could use the
   * same code. Its two "📤 Export" menu items had no handler at all and did nothing when
   * clicked; copying this function there would have created the third divergent copy of a
   * behaviour, which is exactly what #22.4 had to undo.
   */
  const handleExport = async (format: TableExportFormat) => {
    setIsLoading(true);
    const result = await downloadTableExport(table.id, table.page.slug, format);
    if (!result.ok) {
      // Kept as `alert()` to match the rest of this screen. Replacing the 8 alerts and
      // 3 confirms with real dialogs is #22.6, folded into the Phase G rebuild.
      alert(result.message);
    }
    setIsLoading(false);
  };

  // Handle table deletion
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this table? This action cannot be undone.')) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/tables/${table.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      alert('Table deleted successfully');
      router.push('/admin/tables');
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Delete failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Badge variant="outline">
            {table.data?.rows?.length || 0} rows
          </Badge>
          <Badge variant="outline">
            {table.schema?.columns?.length || 0} columns
          </Badge>
          <Badge variant="secondary">
            v{table.schema?.version || 1}
          </Badge>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => handleExport('csv')}
            disabled={isLoading}
          >
            📄 Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport('json')}
            disabled={isLoading}
          >
            📋 Export JSON
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading}
          >
            🗑️ Delete Table
          </Button>
        </div>
      </div>

      {/* Main Editor Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="data">
            📊 Data View
          </TabsTrigger>
          <TabsTrigger value="schema">
            📋 Schema
          </TabsTrigger>
          <TabsTrigger value="import">
            📤 Import/Export
          </TabsTrigger>
          <TabsTrigger value="settings">
            ⚙️ Settings
          </TabsTrigger>
        </TabsList>

        {/* Data View Tab */}
        <TabsContent value="data" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>📊 Table Data</span>
                <Badge variant="outline">
                  {table.data?.rows?.length || 0} rows
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {table.schema && table.data ? (
                <DataTable
                  schema={table.schema}
                  data={table.data}
                  className="bg-white"
                />
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">📊</div>
                  <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
                  <p className="text-gray-600">This table appears to be empty or misconfigured.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schema Tab */}
        <TabsContent value="schema" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>📋 Table Schema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                
                {/* Schema Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Schema Information</h4>
                    <div className="text-sm space-y-1">
                      <p><strong>Version:</strong> {table.schema?.version || 1}</p>
                      <p><strong>Columns:</strong> {table.schema?.columns?.length || 0}</p>
                      <p><strong>Created:</strong> {table.schema?.createdAt ? new Date(table.schema.createdAt).toLocaleDateString() : 'Unknown'}</p>
                      <p><strong>Updated:</strong> {table.schema?.updatedAt ? new Date(table.schema.updatedAt).toLocaleDateString() : 'Unknown'}</p>
                    </div>
                  </div>
                </div>

                {/* Columns List */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Column Configuration</h4>
                  <div className="space-y-2">
                    {table.schema?.columns?.map((column: any, index: number) => (
                      <div key={column.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Badge variant="outline">#{index + 1}</Badge>
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
                    )) || (
                      <p className="text-gray-500 text-center py-4">No columns defined</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Import/Export Tab */}
        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>📤 Import & Export</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                
                {/* Export Section */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Export Data</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      onClick={() => handleExport('csv')}
                      disabled={isLoading}
                      className="h-auto p-4 flex flex-col items-center space-y-2"
                    >
                      <div className="text-2xl">📄</div>
                      <div>
                        <div className="font-medium">Export as CSV</div>
                        <div className="text-xs text-gray-500">Comma-separated values</div>
                      </div>
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => handleExport('json')}
                      disabled={isLoading}
                      className="h-auto p-4 flex flex-col items-center space-y-2"
                    >
                      <div className="text-2xl">📋</div>
                      <div>
                        <div className="font-medium">Export as JSON</div>
                        <div className="text-xs text-gray-500">JavaScript Object Notation</div>
                      </div>
                    </Button>
                  </div>
                </div>

                {/* Import Section */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Import Data</h4>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <div className="text-4xl mb-4">📤</div>
                    <h3 className="text-lg font-semibold mb-2">CSV Import Coming Soon</h3>
                    <p className="text-gray-600">
                      Advanced CSV import functionality with column mapping and validation will be available in the next update.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>⚙️ Table Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                
                {/* Current Settings Display */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Current Configuration</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <pre className="text-sm text-gray-700">
                      {JSON.stringify(table.settings || {}, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Settings Editor Placeholder */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <div className="text-4xl mb-4">⚙️</div>
                  <h3 className="text-lg font-semibold mb-2">Settings Editor Coming Soon</h3>
                  <p className="text-gray-600">
                    Advanced settings editor for pagination, sorting, filtering, and display options will be available in the next update.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
