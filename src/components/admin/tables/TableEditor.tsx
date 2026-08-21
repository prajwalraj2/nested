// src/components/admin/tables/TableEditor.tsx

'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
// ⚠️ `DataTable` (the public, read-only table) is no longer imported — the Data tab now
// renders `TableRowsEditor` instead. See the note on that tab.
import { TableRowsEditor } from '@/components/admin/tables/TableRowsEditor';
// Finding #22.5 — one export implementation, shared with the tables list.
import { downloadTableExport, type TableExportFormat } from '@/lib/export-table';
// Finding #22.2a — the CSV uploader the creation wizard already uses, reused here for
// re-import. It handles header auto-mapping and per-row schema validation itself.
import { CSVUploadInterface } from '@/components/admin/tables/CSVUploadInterface';
// Finding #22.2c — 493 lines of working schema + settings editing that, until now, only the
// creation wizard could reach. See the note on the Schema tab below.
import { TableSchemaEditor } from '@/components/admin/tables/TableSchemaEditor';
import type { TableData, TableRow, TableSchema, TableSettings } from '@/types/table';

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
  /**
   * Image key -> URL for the keys this table references (N-1).
   *
   * ⚠️ Resolved by the SERVER PAGE, not here. See the note at its `<TableEditor>` call site for
   * why this is a prop rather than a fetch — and note it is the same `resolveTableImages` the
   * public table uses, so the admin cannot show a different picture from the live page.
   */
  images: Record<string, string>;
};

export function TableEditor({ table, images }: TableEditorProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('data');
  const [isLoading, setIsLoading] = useState(false);

  // ---- CSV re-import (finding #22.2a) ----------------------------------------------

  /**
   * Rows parsed and validated by `CSVUploadInterface`, held here **before** being saved.
   *
   * The staging step is what makes `replace` safe to offer: the user sees the resulting
   * row count and picks the operation deliberately, rather than an upload immediately
   * overwriting the table. `null` means nothing is staged and the uploader is showing.
   */
  const [pendingImport, setPendingImport] = useState<TableData | null>(null);

  /** `append` first — see the note by the radio buttons on why the default matters. */
  const [importOperation, setImportOperation] = useState<'replace' | 'append'>('append');

  /** Rows currently stored, for the before/after comparison. */
  const currentRowCount = Array.isArray((table.data as TableData | null)?.rows)
    ? (table.data as TableData).rows.length
    : 0;

  // ---- Schema + settings editing (finding #22.2c) ----------------------------------

  /**
   * The edited schema/settings, held here until saved. `null` means "untouched", which is
   * also what drives the Save button's disabled state — so the button cannot be pressed on
   * a table nobody has edited.
   */
  const [draftSchema, setDraftSchema] = useState<TableSchema | null>(null);
  const [draftSettings, setDraftSettings] = useState<TableSettings | null>(null);
  const [isSavingSchema, setIsSavingSchema] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  /**
   * ⚠️ EVERY KEY PRESENT IN EVERY ROW — the guard that stops a new column resurrecting a
   * deleted one's data.
   *
   * Rows are keyed by column id, and removing a column deliberately leaves its values in
   * the row JSON. `TableSchemaEditor` uses this list to refuse those ids when minting a new
   * column. Without it, "remove the last column, add a column" hands the new column the old
   * one's id and it renders the old data. See `nextColumnId` in that file.
   *
   * Scanning every row rather than just the first, because rows are plain JSON and there is
   * no constraint forcing them to share a key set — an older import can leave one row
   * carrying a key the others lost.
   */
  const reservedColumnIds = useMemo(() => {
    const rows = Array.isArray((table.data as TableData | null)?.rows)
      ? (table.data as TableData).rows
      : [];

    const keys = new Set<string>();
    for (const row of rows) {
      for (const key of Object.keys(row)) keys.add(key);
    }
    return Array.from(keys);
  }, [table.data]);

  /**
   * Columns that this edit would remove — used to warn before saving.
   *
   * Their data is NOT deleted (the chosen policy is non-destructive), it just stops being
   * displayed. Saying so explicitly matters: "removed" normally implies "gone".
   */
  const removedColumns = useMemo(() => {
    if (!draftSchema) return [];

    const draftIds = new Set(draftSchema.columns.map((col) => col.id));
    const original: TableSchema['columns'] = table.schema?.columns ?? [];

    return original.filter((col) => !draftIds.has(col.id));
  }, [draftSchema, table.schema]);

  const hasSchemaChanges = draftSchema !== null || draftSettings !== null;

  /**
   * Persist the schema and settings.
   *
   * ⚠️ Both go in ONE request. `PUT /api/admin/tables/[id]` accepts them together and
   * validates the schema (rejects a missing or empty `columns` array) before writing — and
   * it is the same handler that invalidates the table cache from #18, so the public page
   * reflects the change without waiting for a revalidation window.
   */
  const handleSaveSchema = async () => {
    if (!hasSchemaChanges) return;

    setIsSavingSchema(true);
    setSchemaError(null);

    try {
      const response = await fetch(`/api/admin/tables/${table.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Falling back to the stored value means saving after changing ONLY settings does
          // not blank the schema, and vice versa.
          schema: draftSchema ?? table.schema,
          settings: draftSettings ?? table.settings,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? body?.error ?? `Save failed (HTTP ${response.status})`);
      }

      // Clearing the drafts marks the form clean again; `router.refresh()` re-runs the
      // server component so `table.schema` comes back as the newly saved value.
      setDraftSchema(null);
      setDraftSettings(null);
      router.refresh();
    } catch (error) {
      // Shown inline rather than via `alert()` — the remaining alerts on this screen are
      // #22.6's job, but a new code path should not add another one.
      setSchemaError(error instanceof Error ? error.message : 'Save failed. Please try again.');
    } finally {
      setIsSavingSchema(false);
    }
  };

  /**
   * Persist edited rows (finding #22.2b).
   *
   * ⚠️ Uses `operation: 'replace'` — and must. The endpoint's only other mode is `append`,
   * which would duplicate every existing row rather than update them. `replace` is exactly
   * right here because `TableRowsEditor` hands back the COMPLETE array, edits included: it
   * is not a delta.
   *
   * Returns the error message instead of setting state, so the editor can show it beside
   * the Save button and keep the user's unsaved edits on screen — losing them to a failed
   * request would be worse than the failure.
   */
  const handleSaveRows = async (rows: TableRow[]): Promise<string | null> => {
    try {
      const response = await fetch(`/api/admin/tables/${table.id}/data`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // `metadata` is recomputed server-side from the rows, so it is not sent.
          data: { rows },
          operation: 'replace',
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        return body?.error ?? body?.message ?? `Save failed (HTTP ${response.status})`;
      }

      // Re-runs the server component so the saved rows come back as props. The same PUT
      // calls `invalidatePages()`, so the public page reflects the edit too (#18).
      router.refresh();
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Network error.';
    }
  };

  const handleImport = async () => {
    if (!pendingImport) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/tables/${table.id}/data`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: pendingImport, operation: importOperation }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Import failed (HTTP ${response.status})`);
      }

      setPendingImport(null);

      /**
       * `router.refresh()`, not `window.location.reload()`.
       *
       * This re-runs the server component so the Data tab shows the new rows, while
       * keeping React state — so the user stays on the Import tab and does not get
       * bounced back to Data with the page scrolled to the top. It is also the pattern
       * #22.6 exists to apply to the six `location.reload()` calls elsewhere in admin;
       * no reason to add a seventh here.
       *
       * The server data really is fresh: `PUT …/data` calls `invalidatePages()`, which
       * clears the `table-by-page` cache entry added in #18.
       */
      router.refresh();
    } catch (error) {
      console.error('Import failed:', error);
      // Matches the rest of this screen; replacing the alerts is #22.6 (Phase G).
      alert(error instanceof Error ? error.message : 'Import failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

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
        
        {/*
          ⚠️ FOUR TABS BECAME THREE — the Settings tab was removed, not left empty.

          It held a raw `JSON.stringify(table.settings)` dump plus a dashed box reading
          "Settings Editor Coming Soon". The settings it promised — pagination, sorting,
          filtering — are all edited by `TableSchemaEditor` already, in a "⚙️ Table Settings"
          card it renders itself.

          Since that one component owns schema and settings in a SINGLE piece of state,
          splitting it across two tabs would mean mounting it twice with two independent
          drafts that could disagree about what to save. So the Schema tab holds both, and
          its label says so.
        */}
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="data">
            📊 Data View
          </TabsTrigger>
          <TabsTrigger value="schema">
            📋 Schema &amp; Settings
          </TabsTrigger>
          <TabsTrigger value="import">
            📤 Import/Export
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
            {/*
              ⚠️ THIS TAB RENDERED THE PUBLIC, READ-ONLY `DataTable` (#22.2b, G-5c).
              ======================================================================
              `DataTable` is the component the public site uses. It has no inputs, no
              `onCellChange`, no edit affordance of any kind — it was never meant to have
              one. So correcting a single typo meant Export CSV → edit → Import with
              "replace": the "Manage data doesn't work" complaint from #20.

              `TableRowsEditor` replaces it with an editable grid. It also drops the old
              `className="bg-white"` that was passed here, which forced a white panel inside
              a themed card and made this tab glare in dark mode.
            */}
            <CardContent>
              {table.schema ? (
                <TableRowsEditor
                  images={images}
                  schema={table.schema}
                  data={table.data}
                  onSave={handleSaveRows}
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
        {/*
          ⚠️ THE SCHEMA TAB WAS READ-ONLY, AND THE EDITOR ALREADY EXISTED (#22.2c).
          ========================================================================
          This tab used to render a static list: each column's name, type and flags, with
          nothing editable and no way to add, remove or reorder. So once a table was
          created, its structure was frozen — which is the "Manage data doesn't work"
          complaint from #20.

          Meanwhile `TableSchemaEditor` is 493 lines of *working* schema-and-settings
          editing, wired only into the creation wizard, and
          `PUT /api/admin/tables/[id]` already accepted and validated `schema` and
          `settings`. Both halves were finished; nothing joined them. Same shape as the
          publish button in G-3b.

          ⚠️ Two props make it safe to use here, where rows exist — see G-5b(i):
          • `reservedColumnIds` stops a new column being handed an id that rows still
            carry, which would make it render a deleted column's data.
          • `showTemplates={false}` hides the template buttons, which replace the whole
            schema and re-id every column — harmless on an empty table, destructive here.
        */}
        <TabsContent value="schema" className="space-y-4">
          {removedColumns.length > 0 && (
            <Alert>
              <AlertTriangle className="size-4" aria-hidden="true" />
              <AlertDescription>
                {/*
                  Stating what "remove" actually means, because it does NOT mean deleted.
                  The values stay in the stored JSON and simply stop being displayed, so a
                  mistaken removal is recoverable — worth knowing before you hesitate over
                  the Save button.
                */}
                Saving will remove{' '}
                <strong>
                  {removedColumns.map((col) => col.name).join(', ')}
                </strong>{' '}
                from this table. The existing values stay in storage and are not deleted —
                they simply stop being shown.
              </AlertDescription>
            </Alert>
          )}

          {schemaError && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" aria-hidden="true" />
              <AlertDescription>{schemaError}</AlertDescription>
            </Alert>
          )}

          <TableSchemaEditor
            schema={table.schema}
            settings={table.settings}
            onUpdate={(schema, settings) => {
              setDraftSchema(schema);
              setDraftSettings(settings);
              // Clear a previous failure as soon as the schema changes again, so a stale
              // error cannot sit above a form the user has already corrected.
              if (schemaError) setSchemaError(null);
            }}
            reservedColumnIds={reservedColumnIds}
            showTemplates={false}
          />

          {/*
            The editor calls `onUpdate` on every keystroke but has no Save of its own — in
            the wizard the next step commits it. Here nothing else will, so the save lives
            with the caller that owns the API call.
          */}
          <div className="flex items-center justify-end gap-3 border-t pt-4">
            <p className="text-muted-foreground mr-auto text-xs">
              {hasSchemaChanges
                ? 'Unsaved changes.'
                : `${table.schema?.columns?.length ?? 0} columns · ${currentRowCount} rows`}
            </p>

            {hasSchemaChanges && (
              <Button
                variant="outline"
                disabled={isSavingSchema}
                /*
                  `router.refresh()` re-runs the server component, which re-mounts
                  `TableSchemaEditor` with the stored schema — so discarding really does
                  restore the saved state rather than just clearing our drafts while the
                  editor keeps showing the edited version.
                */
                onClick={() => {
                  setDraftSchema(null);
                  setDraftSettings(null);
                  setSchemaError(null);
                  router.refresh();
                }}
              >
                Discard changes
              </Button>
            )}

            <Button onClick={handleSaveSchema} disabled={!hasSchemaChanges || isSavingSchema}>
              {isSavingSchema && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {isSavingSchema ? 'Saving…' : 'Save schema'}
            </Button>
          </div>
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

                {/*
                  Import Section — finding #22.2(a).

                  This was a placeholder reading "CSV Import Coming Soon". Combined with
                  there being no row editor anywhere in the admin panel, that made table
                  data effectively WRITE-ONCE: the only way to change a cell was to delete
                  the table and rebuild it from a fresh CSV.

                  Nothing new had to be built. `CSVUploadInterface` already existed (the
                  creation wizard uses it) and already does header auto-mapping plus
                  per-row validation against the schema, and
                  `PUT /api/admin/tables/[id]/data` already supported both `replace` and
                  `append`. The placeholder simply sat between them.
                */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Import Data</h4>

                  {!pendingImport ? (
                    <CSVUploadInterface
                      schema={table.schema}
                      existingData={table.data}
                      // Staged, NOT saved. The confirmation step below is the point —
                      // see the note on `replace` there.
                      onDataUpload={(data) => setPendingImport(data)}
                    />
                  ) : (
                    <div className="border border-gray-300 rounded-lg p-6 space-y-4">
                      <h5 className="font-semibold text-gray-900">Confirm import</h5>

                      {/*
                        ⚠️ THE BEFORE/AFTER COUNTS ARE THE SAFETY FEATURE.

                        `replace` deletes every existing row. Uploading a truncated or
                        wrongly-mapped CSV would silently destroy content with no undo —
                        there are no table backups, and the original file is never stored
                        server-side (it is parsed in the browser; see #22.8). Showing the
                        resulting row count *before* committing is what makes an accidental
                        wipe visible rather than discovered later.
                      */}
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500">Current rows</div>
                          <div className="text-2xl font-semibold text-gray-900">{currentRowCount}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Rows in file</div>
                          <div className="text-2xl font-semibold text-gray-900">{pendingImport.rows.length}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">After import</div>
                          <div className="text-2xl font-semibold text-blue-700">
                            {importOperation === 'replace'
                              ? pendingImport.rows.length
                              : currentRowCount + pendingImport.rows.length}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="import-operation"
                            checked={importOperation === 'append'}
                            onChange={() => setImportOperation('append')}
                            className="mt-1"
                          />
                          <span className="text-sm">
                            <span className="font-medium">Append</span>
                            <span className="text-gray-600"> — add these rows, keep the existing {currentRowCount}.</span>
                          </span>
                        </label>
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="import-operation"
                            checked={importOperation === 'replace'}
                            onChange={() => setImportOperation('replace')}
                            className="mt-1"
                          />
                          <span className="text-sm">
                            <span className="font-medium text-red-700">Replace</span>
                            <span className="text-gray-600"> — delete all {currentRowCount} existing rows first.</span>
                          </span>
                        </label>
                      </div>

                      {/*
                        `append` is the DEFAULT, deliberately. If the destructive option
                        were pre-selected, the safe path would require noticing and
                        changing it — the wrong way round for an action with no undo.
                      */}
                      {importOperation === 'replace' && (
                        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                          ⚠️ This permanently deletes the current {currentRowCount} rows. There is
                          no undo and no backup — export first if you may need them.
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Button onClick={handleImport} disabled={isLoading}>
                          {isLoading ? 'Importing…' : `Import ${pendingImport.rows.length} rows`}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setPendingImport(null)}
                          disabled={isLoading}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


      </Tabs>
    </div>
  );
}
