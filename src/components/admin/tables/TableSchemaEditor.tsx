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
  COLUMN_TYPE_OPTIONS,
  // The system geo-targeting column's id — used to make it non-deletable below.
  TARGET_COUNTRIES_COLUMN_ID
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
  /**
   * ⚠️ Column ids that must NEVER be handed to a new column, even though no current column
   * uses them — pass every key present in the table's existing rows.
   *
   * Rows are keyed by column **id** (`TableRow = { id: string; [columnId: string]: unknown }`),
   * and deleting a column deliberately leaves its values in the row JSON. Without this list a
   * newly added column can be given an id that rows still carry, and it would render the
   * deleted column's data. See `nextColumnId` below.
   *
   * Optional because the creation wizard has no rows yet; the table editor must pass it.
   */
  reservedColumnIds?: string[];
  /**
   * ⚠️ Whether the "Quick Start Templates" buttons are offered.
   *
   * Applying a template REPLACES the whole schema and re-ids every column from scratch,
   * which is correct while creating a table and destructive once rows exist. Defaults to
   * `true` for the creation wizard; the table editor must pass `false`.
   */
  showTemplates?: boolean;
};

export function TableSchemaEditor({
  schema,
  settings,
  onUpdate,
  reservedColumnIds = [],
  showTemplates = true,
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
    // The id is computed by the module-level helper below rather than from the array
    // length — see its comment for the corruption that caused.
    newColumn.id = nextColumnId(currentSchema.columns, reservedColumnIds);

    const updatedSchema = {
      ...currentSchema,
      columns: [...currentSchema.columns, newColumn],
      updatedAt: new Date().toISOString(),
    };

    setCurrentSchema(updatedSchema);
    onUpdate(updatedSchema, currentSettings);
  }, [currentSchema, currentSettings, onUpdate, reservedColumnIds]);

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
        <h3 className="text-xl font-semibold mb-2">
          Define Your Table Structure
        </h3>
        <p className="text-muted-foreground">
          Configure columns, data types, and table settings for your data table.
        </p>
      </div>

      {/*
        ⚠️ TEMPLATES ARE HIDDEN WHEN EDITING A TABLE THAT ALREADY HAS DATA.
        ==========================================================================
        `applyTemplate` calls `createTableSchema`, which re-ids EVERY column from scratch as
        `col_1 … col_N` (`generateColumnId(index)` in table-utils.ts:164-169). Rows are keyed
        by column id, so on a table with existing rows that silently remaps old values onto
        new columns with entirely different meanings — apply the "Courses" template to a
        4-column tools table and "Figma" starts rendering under "Course Name",
        "figma.com" under "Instructor".

        Harmless in the creation wizard, where there are no rows yet and replacing the whole
        schema is the point. Destructive in the table editor, so that caller passes
        `showTemplates={false}`.
      */}
      {showTemplates && (
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
                <div className="text-xs text-muted-foreground">Name, Instructor, Platform, Rating, Price</div>
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
                <div className="text-xs text-muted-foreground">Name, Category, Description, Pricing</div>
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
                <div className="text-xs text-muted-foreground">Name, Email, Phone, Company</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

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
                /*
                  ⚠️ THE SYSTEM `targetCountries` COLUMN CANNOT BE DELETED.
                  ====================================================================
                  It is tagged `isSystem: true`, but nothing in the codebase ever read that
                  flag — so until now the editor offered "Delete Column" on it like any
                  other. Removing it does not break geo-filtering (that reads the row, not
                  the schema) but it removes the only UI for editing per-row targeting,
                  leaving rows hidden from most of the world with no control to un-hide them.

                  Matched on the id rather than the flag, because the flag is absent from the
                  4-in-25 older tables whose schemas predate it — `id` is the same check the
                  public read path uses (`getPublicSchema`).
                */
                canDelete={
                  currentSchema.columns.length > 1 &&
                  column.id !== TARGET_COUNTRIES_COLUMN_ID
                }
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
                      className="mt-1 block w-full px-3 py-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-ring focus:border-ring"
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
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">📋</div>
            <div>
              <h4 className="font-medium">Schema Summary</h4>
              <p className="text-muted-foreground text-sm mt-1">
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
    <div className="p-4 border rounded-lg space-y-4">
      
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
              className="mt-1 block w-full px-3 py-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-ring focus:border-ring"
            >
              {COLUMN_TYPE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.icon} {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
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

/**
 * The next free column id.
 *
 * ⚠️ THIS REPLACES `col_${columns.length + 1}`, WHICH CORRUPTED DATA.
 * ============================================================================
 * Rows are keyed by column **id** — `TableRow = { id: string; [columnId: string]: unknown }`
 * — and verified against a real table: 4 of 4 row keys matched column ids, 0 matched names.
 * Deriving a new id from the array LENGTH therefore reuses a number as soon as any column is
 * removed, while the removed column's values are still sitting in every row:
 *
 *     start        : col_1, col_2, col_3, col_4
 *     remove col_4 : col_1, col_2, col_3       <- every row still holds col_4's value
 *     add a column : col_1, col_2, col_3, col_4
 *     -> the "new, empty" column IS col_4, so it immediately renders the DELETED
 *        column's data in all 11 rows.
 *
 * Removing from the MIDDLE was worse — it produced duplicate ids outright:
 *
 *     remove col_2 then add -> col_1, col_3, col_4, col_4
 *
 * It went unnoticed because this editor was only ever reachable from the creation wizard,
 * where no rows exist yet. Wiring it into the table editor (#22.2c) is exactly what would
 * have turned it into live data corruption — which is why it is fixed before that wiring.
 *
 * ⚠️ `reserved` must carry every key present in the existing rows, not just the live column
 * ids, so a new column can never land on an id some row still holds. Orphaned values are
 * left untouched in the JSON — they become unreachable rather than resurfacing, which keeps
 * a mistaken removal recoverable by re-adding a column with that id.
 *
 * Module-level and pure, so it needs no `useCallback` and cannot go stale in a closure.
 */
function nextColumnId(columns: TableColumn[], reserved: string[]): string {
  const used = new Set<string>([...columns.map((col) => col.id), ...reserved]);

  // Counts from 1 rather than `length + 1`, so a genuinely free gap left by an earlier
  // deletion is reused. The loop is what makes "genuinely" true.
  let n = 1;
  while (used.has(`col_${n}`)) n += 1;
  return `col_${n}`;
}
