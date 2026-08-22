'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow as TableRowUI,
} from '@/components/ui/table';
import { generateRowId, TARGET_COUNTRIES_COLUMN_ID,
  sortRowsByDisplayOrder,
  renumberDisplayOrder
} from '@/lib/table-utils';
import { RowImagePicker } from './RowImagePicker';
import type { TableColumn, TableData, TableRow, TableSchema } from '@/types/table';

/**
 * Editable table rows — finding #22.2(b), Phase G-5c.
 * ============================================================================
 *
 * WHAT DID NOT EXIST BEFORE THIS
 * ------------------------------
 * The editor's Data tab rendered `DataTable` — the component the PUBLIC site uses. It has
 * no inputs, no `onCellChange`, no edit affordance of any kind, because it was never meant
 * to have one. So the only way to correct a single typo in a table was:
 *
 *     Export CSV → edit the file → Import with "replace"
 *
 * That round-trip is the "Manage data doesn't work" complaint from #20, and it is what this
 * component removes.
 *
 * ⚠️ WHY A DIALOG RATHER THAN EDIT-IN-PLACE
 * -----------------------------------------
 * Columns are typed — `link`, `rating`, `currency`, `boolean`, `date`, `description` — and a
 * single contenteditable cell would reduce all of them to free text, which is how bad data
 * gets in. A dialog gives each column the control its type deserves and shows the column's
 * name and type while you fill it in. Inline editing for plain `text` columns is a
 * reasonable later addition; typed columns should keep the dialog either way.
 *
 * ⚠️ WHY EDITS ARE STAGED AND SAVED EXPLICITLY
 * --------------------------------------------
 * `PUT /api/admin/tables/[id]/data` replaces the WHOLE rows array — there is no per-row
 * endpoint. Saving on every blur would therefore rewrite every row of the table on each
 * keystroke-group, and a failed request mid-edit would leave the stored table in a state
 * nobody chose. Instead edits accumulate locally, the header shows what is unsaved, and one
 * Save writes the array once.
 *
 * ⚠️ `targetCountries` — MEASURED, NOT ASSUMED
 * --------------------------------------------
 * Every row carries a `targetCountries` key that drives geo-filtering on the public site
 * (#15.3): `isRowVisibleToCountry` reads `row.targetCountries` directly, **not** the schema,
 * so filtering works whether or not the schema declares the column.
 *
 * Whether it ALSO appears as a schema column varies by table. `ensureTargetCountriesColumn`
 * appends it on create (`POST /api/admin/tables`), so most tables have it — measured at
 * **21 of 25 sampled tables**, with 4 older ones carrying the row key only.
 *
 * Consequence for this component: it iterates `schema.columns`, so on those 21 tables
 * "Target Countries" **does** render here as an ordinary editable text column. That is a net
 * gain — per-row geo-targeting was not editable anywhere before.
 *
 * ⚠️ IT IS ADMIN-ONLY, AND THAT IS ENFORCED — BUT NOT BY THE FLAG IT LOOKS LIKE.
 * The column is tagged `isSystem: true, isHidden: true`, and **neither flag is read anywhere
 * in the codebase** — the only occurrences are where they are written. The actual enforcement
 * is an explicit id comparison on the public read path:
 *
 *   `getPublicSchema()`  drops the column   (table-utils.ts:599)
 *   `getPublicRows()`    drops the row key  (table-utils.ts:612)
 *
 * both called by `TableService.getPublicTable`. So showing it here does NOT expose it to
 * visitors. Do not "tidy" those two functions into an `isHidden` check without also making
 * something set that flag on the 4-in-25 tables whose schema predates it.
 *
 * Either way, values are preserved through every edit — see the spread order in `RowDialog` —
 * and new rows inherit the server's "ALL" default via `ensureRowsHaveTargetCountries`.
 */

/**
 * One row's image in the admin list (N-1).
 *
 * ⚠️ THREE STATES, NOT TWO — and the third is the reason this component exists rather than an
 * inline `<img>`:
 *
 *   no key            -> nothing. The row simply has no picture.
 *   key, resolved     -> the thumbnail, framed like the public table's square shape.
 *   ⚠️ key, UNRESOLVED -> a visible marker. The row names an image that is not in the library.
 *
 * That last case is invisible on the public site by design: a missing image renders as nothing, so
 * a dangling reference and "no image" look identical out there. `getPublicTable`'s own comment says
 * the admin is where it gets surfaced — this is the code that makes that true rather than aspirational.
 */
function RowThumbnail({ imageKey, images }: { imageKey: string; images: Record<string, string> }) {
  if (!imageKey) return null;

  const url = images[imageKey];

  if (!url) {
    return (
      <span
        className="border-destructive/50 text-destructive flex size-8 shrink-0 items-center justify-center rounded-[4px] border border-dashed text-[9px] font-semibold"
        title={`No image found for key "${imageKey}"`}
      >
        ?
      </span>
    );
  }

  return (
    /*
      ⚠️ MATCHED TO THE PUBLIC TABLE'S `square` FRAME, AND THAT MATCHING IS THE POINT — the reason
      `resolveTableImages` is shared is so this screen cannot show a different picture from the live
      page, and showing the same picture differently framed defeats half of it.

      Both dropped the 3px inset they started with: on real logos it made a 32px image read like a
      24px one. ⚠️ IF `IMAGE_SHAPE_CLASS.square` IN `table/DataTable.tsx` CHANGES, CHANGE THIS TOO.

      Plain `<img>` for the same reason the public table uses one: the object is already a 64px WebP
      from the upload endpoint, so `next/image` would re-encode a finished image and bill a
      transformation for nothing.
    */
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={url}
      alt=""
      width={32}
      height={32}
      loading="lazy"
      decoding="async"
      title={imageKey}
      className="border-border bg-muted/40 size-8 shrink-0 rounded-[4px] border object-contain"
    />
  );
}

type TableRowsEditorProps = {
  schema: TableSchema;
  data: TableData | null;
  /**
   * Image key -> URL, resolved server-side for the keys this table references (N-1).
   *
   * ⚠️ A KEY ABSENT FROM THIS MAP IS A DANGLING REFERENCE, AND THIS SCREEN IS THE ONLY PLACE IT
   * CAN SURFACE. The public renderer deliberately shows nothing for a missing image — a broken
   * picture must never become visible damage — which means a row pointing at a deleted image looks
   * identical to a row with no image at all out there. Here they are distinguished.
   */
  images: Record<string, string>;
  /** Persists the full rows array. Resolves to an error message, or `null` on success. */
  onSave: (rows: TableRow[]) => Promise<string | null>;
};

export function TableRowsEditor({ schema, data, images, onSave }: TableRowsEditorProps) {
  const columns = schema?.columns ?? [];

  /**
   * The working copy of the rows.
   *
   * Seeded from props once. It deliberately does NOT re-sync when `data` changes, because
   * the only thing that changes it is our own save — and re-syncing mid-edit would discard
   * whatever the user had typed. After a successful save the parent calls `router.refresh()`
   * and this component is re-mounted with the stored rows.
   */
  /*
    ⚠️ SEEDED IN DISPLAY ORDER, NOT STORED ORDER (N-2). The array as stored is whatever the CSV
    import or the last edit left behind; `displayOrder` is what the public page sorts by. Showing
    the raw array here would mean the admin list and the live page disagreed about row one — and
    the move buttons below operate on positions, so they would move the wrong rows.
  */
  const [rows, setRows] = useState<TableRow[]>(() =>
    sortRowsByDisplayOrder(Array.isArray(data?.rows) ? data.rows : [])
  );

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingRow, setEditingRow] = useState<TableRow | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingRow, setDeletingRow] = useState<TableRow | null>(null);

  const [search, setSearch] = useState('');

  /**
   * Client-side filter across every column's value.
   *
   * Filtering here rather than server-side because the whole table is already in memory —
   * it arrived with the page. `String(...)` because cell values are `unknown`: numbers,
   * booleans and nulls all have to be searchable without throwing.
   */
  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;

    return rows.filter((row) =>
      columns.some((col) => String(row[col.id] ?? '').toLowerCase().includes(term))
    );
  }, [rows, columns, search]);

  /** Moving by visible position is wrong while the list is filtered — see the menu items. */
  const isSearching = search.trim().length > 0;

  /**
   * Move one row up or down, and renumber the whole table (N-2).
   *
   * ⚠️ REORDERS THE ARRAY AND THEN RENUMBERS EVERY ROW — it does not swap two numbers. Swapping
   * assumes the values are contiguous, and they are not: a CSV can arrive as 1, 5, 9 and deleting a
   * row leaves a gap. See `renumberDisplayOrder` for the full argument; it is the same conclusion
   * the roadmap tree and the changelog board reached.
   *
   * ⚠️ REFUSED WHILE A SEARCH IS ACTIVE. `visibleRows` is a FILTERED view, so "down" would mean
   * "past the next row you can see" while the array moves it past a hidden one — the row would
   * appear to jump several places, or not move at all. Rather than silently do the wrong thing, the
   * items are disabled and the reason is on screen.
   */
  function moveRow(rowId: string, direction: 'up' | 'down') {
    setRows((prev) => {
      const index = prev.findIndex((row) => row.id === rowId);
      if (index === -1) return prev;

      const target = direction === 'up' ? index - 1 : index + 1;
      // Already at the end it is being pushed towards — nothing to do, and not an error.
      if (target < 0 || target >= prev.length) return prev;

      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return renumberDisplayOrder(next);
    });
    setIsDirty(true);
  }

  function applyRowChange(next: TableRow) {
    setRows((prev) => {
      const index = prev.findIndex((row) => row.id === next.id);
      // Not found means this is a new row — append rather than silently dropping it.
      if (index === -1) return [...prev, next];

      const copy = [...prev];
      copy[index] = next;
      return copy;
    });

    setIsDirty(true);
    setError(null);
  }

  function deleteRow(row: TableRow) {
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    setDeletingRow(null);
    setIsDirty(true);
    setError(null);
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);

    const failure = await onSave(rows);

    if (failure) {
      setError(failure);
      setIsSaving(false);
      return;
    }

    // Left dirty=false but NOT unmounted — the parent's `router.refresh()` re-mounts this
    // with the stored rows, so there is no need to reconcile local state by hand.
    setIsDirty(false);
    setIsSaving(false);
  }

  if (columns.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        This table has no columns yet. Define them in the Schema &amp; Settings tab first.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter rows…"
            className="pl-9"
            aria-label="Filter rows"
          />
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setIsCreating(true);
            setEditingRow(null);
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add row
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ── Rows ── */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRowUI className="bg-muted/50">
              {columns.map((column) => (
                <TableHead key={column.id}>
                  {column.name}
                  {column.required && (
                    <span className="text-destructive ml-0.5" aria-hidden="true">
                      *
                    </span>
                  )}
                </TableHead>
              ))}
              <TableHead className="w-0" />
            </TableRowUI>
          </TableHeader>

          <TableBody>
            {visibleRows.length > 0 ? (
              visibleRows.map((row) => {
                const rowIndex = rows.findIndex((r) => r.id === row.id);
                return (
                /*
                  ⚠️ `rowIndex` IS THE POSITION IN THE FULL ARRAY, NOT IN `visibleRows`. The move
                  handler works on the array, so an index from the filtered view would disable the
                  wrong items — the first visible row is not necessarily the first row.
                */
                <TableRowUI key={row.id}>
                  {columns.map((column) => (
                    <TableCell key={column.id} className="max-w-[24rem] truncate">
                      {/*
                        ⚠️ THE THUMBNAIL RENDERS IN THE COLUMN THAT *DECLARES* THE IMAGE, matching
                        the public table exactly — an image is a companion to a column, not a
                        column of its own (§29.6(d)). Putting it in a fixed first column would
                        show it somewhere different from where the live page shows it.
                      */}
                      <span className="flex min-w-0 items-center gap-2">
                        {column.meta?.imageColumn && (
                          <RowThumbnail
                            imageKey={String(row[column.meta.imageColumn] ?? '').trim()}
                            images={images}
                          />
                        )}
                        <span className="min-w-0 flex-1 truncate">
                          <CellValue value={row[column.id]} column={column} />
                        </span>
                      </span>
                    </TableCell>
                  ))}

                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label="Row actions"
                        >
                          <MoreHorizontal className="size-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingRow(row)}>
                          <Pencil className="size-4" aria-hidden="true" />
                          Edit row
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {/*
                          ⚠️ DISABLED AT THE ENDS AND WHILE SEARCHING, RATHER THAN HIDDEN. A menu
                          whose items appear and disappear is hard to aim at, and a greyed row says
                          why nothing happened. `isSearching` is the important one: the list is
                          filtered, so moving by visible position would move the row past a row the
                          admin cannot see.
                        */}
                        <DropdownMenuItem
                          disabled={isSearching || rowIndex <= 0}
                          onClick={() => moveRow(row.id, 'up')}
                        >
                          <ChevronUp className="size-4" aria-hidden="true" />
                          Move up
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={isSearching || rowIndex >= rows.length - 1}
                          onClick={() => moveRow(row.id, 'down')}
                        >
                          <ChevronDown className="size-4" aria-hidden="true" />
                          Move down
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeletingRow(row)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                          Delete row
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRowUI>
                );
              })
            ) : (
              <TableRowUI>
                {/* +1 for the actions column, so the message spans the full width. */}
                <TableCell colSpan={columns.length + 1} className="h-24 text-center">
                  <p className="text-muted-foreground text-sm">
                    {rows.length === 0 ? 'No rows yet.' : 'No rows match that filter.'}
                  </p>
                </TableCell>
              </TableRowUI>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Save bar ── */}
      <div className="flex items-center justify-end gap-3 border-t pt-3">
        <p className="text-muted-foreground mr-auto text-xs">
          {isDirty
            ? 'Unsaved changes.'
            : `${rows.length} row${rows.length === 1 ? '' : 's'}${
                search.trim() ? ` · ${visibleRows.length} shown` : ''
              }`}
        </p>

        <Button onClick={handleSave} disabled={!isDirty || isSaving}>
          {isSaving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isSaving ? 'Saving…' : 'Save rows'}
        </Button>
      </div>

      {/*
        One dialog serves add and edit. Keyed so switching between rows resets the form —
        without it React reuses the instance and the previous row's values persist.
      */}
      {(editingRow || isCreating) && (
        <RowDialog
          key={editingRow?.id ?? 'new-row'}
          columns={columns}
          row={editingRow}
          onSubmit={(row) => {
            applyRowChange(row);
            setEditingRow(null);
            setIsCreating(false);
          }}
          onCancel={() => {
            setEditingRow(null);
            setIsCreating(false);
          }}
        />
      )}

      {deletingRow && (
        <AlertDialog open onOpenChange={(open) => !open && setDeletingRow(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this row?</AlertDialogTitle>
              <AlertDialogDescription>
                {/*
                  Naming the first column's value identifies WHICH row, since rows have no
                  title of their own — `row_1754…` would mean nothing to anyone.
                */}
                {String(deletingRow[columns[0].id] ?? '').trim()
                  ? `"${String(deletingRow[columns[0].id])}" will be removed from the table.`
                  : 'This row will be removed from the table.'}{' '}
                Nothing is written until you press <strong>Save rows</strong>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => deleteRow(deletingRow)}>
                Remove row
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

/**
 * Read-only rendering of one cell in the admin grid.
 *
 * Deliberately plainer than the public `DataTable`: this view is for finding the row you
 * want to change, so a rating renders as "4.5" rather than five stars. Rendering it twice,
 * two ways, is the point — the public table is the presentation, this is the data.
 */
function CellValue({ value, column }: { value: unknown; column: TableColumn }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  if (column.type === 'boolean') {
    return <Badge variant={value ? 'default' : 'secondary'}>{value ? 'Yes' : 'No'}</Badge>;
  }

  if (column.type === 'badge') {
    return <Badge variant="outline">{String(value)}</Badge>;
  }

  // Links are shown as text, not anchors — a grid full of live links makes it easy to
  // navigate away by mistake while scanning for a row to edit.
  return <span className="text-sm">{String(value)}</span>;
}

/**
 * Add / edit one row.
 *
 * Every column gets an input chosen by its `type`, so a `number` column produces a numeric
 * field and a `boolean` a checkbox rather than the free text a single grid cell would give.
 */
type RowDialogProps = {
  columns: TableColumn[];
  /** `null` creates a new row. */
  row: TableRow | null;
  onSubmit: (row: TableRow) => void;
  onCancel: () => void;
};

function RowDialog({ columns, row, onSubmit, onCancel }: RowDialogProps) {
  const isEditMode = row !== null;

  /**
   * ⚠️ SEEDED FROM THE WHOLE ROW, NOT FROM THE COLUMN LIST.
   * ==========================================================================
   *
   * This used to build `values` by walking `columns`:
   *
   *     columns.forEach((column) => {
   *       initial[column.id] = row?.[column.id] ?? column.defaultValue ?? '';
   *     });
   *
   * — which silently drops every row field that is not a declared column. The row image
   * lives in exactly such a field (`<columnId>__image`, named by `meta.imageColumn`), so
   * reopening a row that HAD an image showed "No image": the value was in the database, in
   * the payload, and on the public page, but never in this form's state.
   *
   * ⚠️ **The sixth occurrence of this bug class in this project**, and the second where it
   * cost a user a testing round. `icon` slipped through five explicit field lists in Phase J
   * (#27, J-2, J-3), `status` through `buildPageHierarchy` in I-1, and now this. Every time
   * the shape is identical: a rebuild-by-field-list cannot complain about a field it was
   * never told about, and TypeScript cannot help because the field is dynamic.
   *
   * Starting from the row and only filling GAPS makes the class impossible here — a new
   * field needs no change to this function, ever.
   *
   * ⚠️ Not a data-loss bug, only a display one: `handleSubmit` spreads the existing row
   * before `values`, so the image survived a save even while invisible here. That is the
   * same defensive spread, applied on the way out; this is the missing half on the way in.
   */
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = { ...(row ?? {}) };
    columns.forEach((column) => {
      // `?? ''` so a null in the data still renders as an empty input rather than "null".
      initial[column.id] = initial[column.id] ?? column.defaultValue ?? '';
    });
    return initial;
  });

  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // `required` is a schema flag the columns already carry; honouring it here is what makes
    // it mean anything, since nothing else enforces it on the admin side.
    const missing = columns.find(
      (column) => column.required && String(values[column.id] ?? '').trim() === ''
    );

    if (missing) {
      setValidationError(`"${missing.name}" is required.`);
      return;
    }

    /**
     * ⚠️ The spread order matters. Starting from the EXISTING row preserves keys this form
     * never shows — `targetCountries` (geo-filtering, #15.3) and any orphaned values left
     * by a removed column, which the non-destructive policy in G-5b(i) says to keep.
     * Building the row from `values` alone would silently drop both.
     */
    onSubmit({
      ...(row ?? { id: generateRowId() }),
      ...values,
    } as TableRow);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit row' : 'Add row'}</DialogTitle>
          <DialogDescription>
            Changes are staged here and written when you save the table.
          </DialogDescription>
        </DialogHeader>

        {/* `id` on the form + `form=` on the button, so the footer button can submit it
            while living outside the <form> element. */}
        <form id="row-form" onSubmit={handleSubmit} className="space-y-4">
          {columns.map((column) => (
            <div key={column.id} className="space-y-1.5">
              <Label htmlFor={`field-${column.id}`}>
                {column.name}
                {column.required && (
                  <span className="text-destructive ml-0.5" aria-hidden="true">
                    *
                  </span>
                )}
                {/* The type is shown so it is obvious why a field behaves as it does. */}
                <span className="text-muted-foreground ml-2 text-xs font-normal">
                  {column.type}
                </span>
              </Label>

              <RowField
                column={column}
                value={values[column.id]}
                onChange={(next) => {
                  setValues((prev) => ({ ...prev, [column.id]: next }));
                  if (validationError) setValidationError(null);
                }}
              />

              {/*
                ── Row image (K-5c) ────────────────────────────────────────────────
                Rendered only when this column declares `meta.imageColumn`, which the schema
                editor sets. It writes into a SEPARATE row field named by that metadata — not
                into the column's own value — so the picture and the text stay independent.
              */}
              {column.meta?.imageColumn && (
                <div className="mt-2 space-y-1.5">
                  <Label htmlFor={`image-${column.id}`} className="text-xs text-muted-foreground">
                    Image beside {column.name}
                  </Label>
                  <RowImagePicker
                    id={`image-${column.id}`}
                    value={String(values[column.meta.imageColumn] ?? '')}
                    onChange={(key) =>
                      setValues((prev) => ({
                        ...prev,
                        /*
                          ⚠️ Empty string, not `undefined`. The row is a JSON object written
                          wholesale; `undefined` disappears on serialisation, so clearing an
                          image would leave the previous key in the stored row.
                        */
                        [column.meta!.imageColumn!]: key,
                      }))
                    }
                  />
                </div>
              )}
            </div>
          ))}
        </form>

        {validationError && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" aria-hidden="true" />
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" form="row-form">
            {isEditMode ? 'Apply changes' : 'Add row'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The right input for a column's type. */
function RowField({
  column,
  value,
  onChange,
}: {
  column: TableColumn;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const id = `field-${column.id}`;

  if (column.type === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <Checkbox
          id={id}
          checked={value === true || value === 'true'}
          // Radix reports `boolean | 'indeterminate'`; this is never indeterminate, and
          // coercing keeps a strict boolean in the stored JSON.
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        <Label htmlFor={id} className="font-normal">
          {value === true || value === 'true' ? 'Yes' : 'No'}
        </Label>
      </div>
    );
  }

  if (column.type === 'description') {
    return (
      <Textarea
        id={id}
        value={String(value ?? '')}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
      />
    );
  }

  /**
   * `type` maps a column onto a native input type, which brings the right mobile keyboard
   * and the browser's own validation for free.
   *
   * ⚠️ Numeric fields store a NUMBER, not the input's string — `Number('')` is 0, which
   * would turn a cleared field into a real zero, so an empty string is kept as `null`.
   */
  const inputType =
    column.type === 'number' || column.type === 'currency' || column.type === 'rating'
      ? 'number'
      : column.type === 'date'
        ? 'date'
        : column.type === 'email'
          ? 'email'
          : column.type === 'link' || column.type === 'image'
            ? 'url'
            : column.type === 'phone'
              ? 'tel'
              : 'text';

  return (
    <Input
      id={id}
      type={inputType}
      value={String(value ?? '')}
      onChange={(event) => {
        const raw = event.target.value;

        if (inputType === 'number') {
          onChange(raw === '' ? null : Number(raw));
          return;
        }

        onChange(raw);
      }}
      placeholder={column.type === 'link' ? 'https://…' : undefined}
    />
  );
}

// Re-exported for the note in `TableEditor` about which row keys are never edited here.
export { TARGET_COUNTRIES_COLUMN_ID };
