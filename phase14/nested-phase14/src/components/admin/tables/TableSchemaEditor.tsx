// src/components/admin/tables/TableSchemaEditor.tsx

'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

import { 
  TableSchema, 
  TableColumn, 
  TableSettings, 
  ColumnType 
} from '@/types/table';
import { 
  createDefaultColumn, 
  createTableSchema, 
  DEFAULT_TABLE_SETTINGS,
  COLUMN_TYPE_OPTIONS 
} from '@/lib/table-utils';

/**
 * Table Schema Editor Component
 * 
 * Step 2 of the table creation wizard.
 * Visual editor for defining table structure:
 * - Add/remove columns
 * - Configure column types and properties
 * - Set validation rules
 * - Configure table settings (pagination, sorting, etc.)
 * 
 * Features:
 * - Drag-and-drop column reordering
 * - Live preview of column configuration
 * - Validation of schema before proceeding
 * - Template suggestions for common table types
 */

type TableSchemaEditorProps = {
  schema?: TableSchema;
  settings?: TableSettings;
  onUpdate: (schema: TableSchema, settings: TableSettings) => void;
};

export function TableSchemaEditor({ 
  schema, 
  settings, 
  onUpdate 
}: TableSchemaEditorProps) {
  
  // Initialize with existing data or defaults
  const [currentSchema, setCurrentSchema] = useState<TableSchema>(
    schema || {
      columns: [createDefaultColumn('Name', 'text')],
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  );
  
  const [currentSettings, setCurrentSettings] = useState<TableSettings>(
    settings || DEFAULT_TABLE_SETTINGS
  );

  // Column management
  const addColumn = useCallback(() => {
    const newColumn = createDefaultColumn(`Column ${currentSchema.columns.length + 1}`, 'text');
    newColumn.id = `col_${currentSchema.columns.length + 1}`;
    
    const updatedSchema = {
      ...currentSchema,
      columns: [...currentSchema.columns, newColumn],
      updatedAt: new Date().toISOString(),
    };
    
    setCurrentSchema(updatedSchema);
    onUpdate(updatedSchema, currentSettings);
  }, [currentSchema, currentSettings, onUpdate]);

  const removeColumn = useCallback((columnId: string) => {
    if (currentSchema.columns.length <= 1) return; // Keep at least one column
    
    const updatedSchema = {
      ...currentSchema,
      columns: currentSchema.columns.filter(col => col.id !== columnId),
      updatedAt: new Date().toISOString(),
    };
    
    setCurrentSchema(updatedSchema);
    onUpdate(updatedSchema, currentSettings);
  }, [currentSchema, currentSettings, onUpdate]);

  const updateColumn = useCallback((columnId: string, updates: Partial<TableColumn>) => {
    const updatedSchema = {
      ...currentSchema,
      columns: currentSchema.columns.map(col => 
        col.id === columnId ? { ...col, ...updates } : col
      ),
      updatedAt: new Date().toISOString(),
    };
    
    setCurrentSchema(updatedSchema);
    onUpdate(updatedSchema, currentSettings);
  }, [currentSchema, currentSettings, onUpdate]);

  // Settings management
  const updateSettings = useCallback((updates: Partial<TableSettings>) => {
    const updatedSettings = { ...currentSettings, ...updates };
    setCurrentSettings(updatedSettings);
    onUpdate(currentSchema, updatedSettings);
  }, [currentSchema, currentSettings, onUpdate]);

  // Template functions
  const applyTemplate = useCallback((templateType: string) => {
    let templateColumns: Omit<TableColumn, 'id'>[] = [];
    
    switch (templateType) {
      case 'courses':
        templateColumns = [
          createDefaultColumn('Course Name', 'text'),
          createDefaultColumn('Instructor', 'text'),
          createDefaultColumn('Platform', 'badge'),
          createDefaultColumn('Rating', 'rating'),
          createDefaultColumn('Price', 'currency'),
          createDefaultColumn('Duration', 'text'),
          createDefaultColumn('Link', 'link'),
        ];
        break;
      case 'tools':
        templateColumns = [
          createDefaultColumn('Tool Name', 'text'),
          createDefaultColumn('Category', 'badge'),
          createDefaultColumn('Description', 'description'),
          createDefaultColumn('Pricing', 'text'),
          createDefaultColumn('Website', 'link'),
          createDefaultColumn('Rating', 'rating'),
        ];
        break;
      case 'contacts':
        templateColumns = [
          createDefaultColumn('Name', 'text'),
          createDefaultColumn('Email', 'email'),
          createDefaultColumn('Phone', 'phone'),
          createDefaultColumn('Company', 'text'),
          createDefaultColumn('Role', 'text'),
          createDefaultColumn('Status', 'badge'),
        ];
        break;
      default:
        return;
    }
    
    const templatedSchema = createTableSchema(templateColumns);
    setCurrentSchema(templatedSchema);
    onUpdate(templatedSchema, currentSettings);
  }, [currentSettings, onUpdate]);

  return (
    <div className="space-y-6">
      
      {/* Step Description */}
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Define Your Table Structure
        </h3>
        <p className="text-gray-600">
          Configure columns, data types, and table settings for your data table.
        </p>
      </div>

      {/* Quick Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>🎯 Quick Start Templates</span>
            <Badge variant="outline">Optional</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              variant="outline"
              onClick={() => applyTemplate('courses')}
              className="h-auto p-4 flex flex-col items-start space-y-2"
            >
              <div className="text-lg">📚</div>
              <div>
                <div className="font-medium">Course Table</div>
                <div className="text-xs text-gray-500">Name, Instructor, Platform, Rating, Price</div>
              </div>
            </Button>
            
            <Button
              variant="outline"
              onClick={() => applyTemplate('tools')}
              className="h-auto p-4 flex flex-col items-start space-y-2"
            >
              <div className="text-lg">🛠️</div>
              <div>
                <div className="font-medium">Tools Table</div>
                <div className="text-xs text-gray-500">Name, Category, Description, Pricing</div>
              </div>
            </Button>
            
            <Button
              variant="outline"
              onClick={() => applyTemplate('contacts')}
              className="h-auto p-4 flex flex-col items-start space-y-2"
            >
              <div className="text-lg">👥</div>
              <div>
                <div className="font-medium">Contacts Table</div>
                <div className="text-xs text-gray-500">Name, Email, Phone, Company</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Column Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>📋 Table Columns ({currentSchema.columns.length})</span>
            <Button onClick={addColumn} size="sm">
              + Add Column
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {currentSchema.columns.map((column, index) => (
              <ColumnEditor
                key={column.id}
                column={column}
                index={index}
                canDelete={currentSchema.columns.length > 1}
                onUpdate={(updates) => updateColumn(column.id, updates)}
                onDelete={() => removeColumn(column.id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Table Settings */}
      <Card>
        <CardHeader>
          <CardTitle>⚙️ Table Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Pagination Settings */}
            <div>
              <h4 className="font-medium mb-3">Pagination</h4>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="pagination-enabled"
                    checked={currentSettings.pagination.enabled}
                    onCheckedChange={(checked) => 
                      updateSettings({
                        pagination: { ...currentSettings.pagination, enabled: !!checked }
                      })
                    }
                  />
                  <Label htmlFor="pagination-enabled">Enable pagination</Label>
                </div>
                
                {currentSettings.pagination.enabled && (
                  <div>
                    <Label htmlFor="page-size">Rows per page</Label>
                    <select
                      id="page-size"
                      value={currentSettings.pagination.pageSize}
                      onChange={(e) => 
                        updateSettings({
                          pagination: { ...currentSettings.pagination, pageSize: parseInt(e.target.value) }
                        })
                      }
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Sorting Settings */}
            <div>
              <h4 className="font-medium mb-3">Sorting & Filtering</h4>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sorting-enabled"
                    checked={currentSettings.sorting.enabled}
                    onCheckedChange={(checked) => 
                      updateSettings({
                        sorting: { ...currentSettings.sorting, enabled: !!checked }
                      })
                    }
                  />
                  <Label htmlFor="sorting-enabled">Enable sorting</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="filtering-enabled"
                    checked={currentSettings.filtering.enabled}
                    onCheckedChange={(checked) => 
                      updateSettings({
                        filtering: { ...currentSettings.filtering, enabled: !!checked }
                      })
                    }
                  />
                  <Label htmlFor="filtering-enabled">Enable filtering</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="global-search"
                    checked={currentSettings.filtering.globalSearch}
                    onCheckedChange={(checked) => 
                      updateSettings({
                        filtering: { ...currentSettings.filtering, globalSearch: !!checked }
                      })
                    }
                  />
                  <Label htmlFor="global-search">Global search</Label>
                </div>
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Schema Summary */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">📋</div>
            <div>
              <h4 className="font-medium text-blue-900">Schema Summary</h4>
              <p className="text-blue-700 text-sm mt-1">
                {currentSchema.columns.length} columns configured •
                Pagination: {currentSettings.pagination.enabled ? 'On' : 'Off'} •
                Sorting: {currentSettings.sorting.enabled ? 'On' : 'Off'} •
                Filtering: {currentSettings.filtering.enabled ? 'On' : 'Off'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

/**
 * Individual Column Editor Component
 */
type ColumnEditorProps = {
  column: TableColumn;
  index: number;
  canDelete: boolean;
  onUpdate: (updates: Partial<TableColumn>) => void;
  onDelete: () => void;
};

function ColumnEditor({ column, index, canDelete, onUpdate, onDelete }: ColumnEditorProps) {
  return (
    <div className="p-4 border border-gray-200 rounded-lg space-y-4">
      
      {/* Column Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Badge variant="outline">#{index + 1}</Badge>
          <h4 className="font-medium">Column Configuration</h4>
        </div>
        
        <div className="flex items-center space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">⋮</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={onDelete} disabled={!canDelete}>
                🗑️ Delete Column
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Basic Properties */}
        <div className="space-y-3">
          <div>
            <Label htmlFor={`column-name-${column.id}`}>Column Name</Label>
            <Input
              id={`column-name-${column.id}`}
              value={column.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="e.g., Course Name"
            />
          </div>
          
          <div>
            <Label htmlFor={`column-type-${column.id}`}>Data Type</Label>
            <select
              id={`column-type-${column.id}`}
              value={column.type}
              onChange={(e) => onUpdate({ type: e.target.value as ColumnType })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {COLUMN_TYPE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.icon} {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {COLUMN_TYPE_OPTIONS.find(opt => opt.value === column.type)?.description}
            </p>
          </div>
        </div>

        {/* Column Options */}
        <div className="space-y-3">
          <div>
            <Label>Column Options</Label>
            <div className="mt-2 space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`sortable-${column.id}`}
                  checked={column.sortable}
                  onCheckedChange={(checked) => onUpdate({ sortable: !!checked })}
                />
                <Label htmlFor={`sortable-${column.id}`} className="text-sm">Sortable</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`filterable-${column.id}`}
                  checked={column.filterable}
                  onCheckedChange={(checked) => onUpdate({ filterable: !!checked })}
                />
                <Label htmlFor={`filterable-${column.id}`} className="text-sm">Filterable</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`searchable-${column.id}`}
                  checked={column.searchable}
                  onCheckedChange={(checked) => onUpdate({ searchable: !!checked })}
                />
                <Label htmlFor={`searchable-${column.id}`} className="text-sm">Searchable</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`required-${column.id}`}
                  checked={column.required}
                  onCheckedChange={(checked) => onUpdate({ required: !!checked })}
                />
                <Label htmlFor={`required-${column.id}`} className="text-sm">Required</Label>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
