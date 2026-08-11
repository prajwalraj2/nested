// src/components/table/DataTable.tsx

'use client';

import React, { useState } from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { DataTablePagination } from './DataTablePagination';
import { DataTableToolbar } from './DataTableToolbar';
import type { TableSchema, TableData, ColumnType } from '@/types/table';
import {
  assignBadgeColors,
  badgeClassFor,
  type BadgeColor,
} from '@/lib/badge-colors';
import { DENSITY_ROW_PADDING, resolveTableSettings } from '@/lib/table-utils';
import { tableFilterFn } from '@/lib/table-filters';
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from "lucide-react"

/**
 * Professional DataTable Component
 * 
 * Features:
 * - Advanced sorting (single/multi-column)
 * - Global search functionality
 * - Column-specific filtering
 * - Column visibility toggle
 * - Responsive pagination
 * - Professional shadcn/ui styling
 * - Type-specific cell rendering
 * - Export capabilities
 * - Mobile-responsive design
 */

/**
 * `col.align` -> a Tailwind class (K-3).
 *
 * ⚠️ Full literals, for the same reason as `BADGE_COLOR_CLASSES`: Tailwind scans source for
 * class strings and never evaluates code, so `text-${align}` would emit no CSS at all.
 *
 * Every one of the 2,675 stored columns currently says `left`, so wiring this changes
 * nothing visible today. It exists so the K-6 editor has somewhere to write.
 */
const ALIGN_CLASS: Record<'left' | 'center' | 'right', string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

type DataTableProps = {
  schema: TableSchema;
  data: TableData;
  title?: string;
  description?: string;
  className?: string;
  /**
   * Stored per-table settings (K-2). Typed `unknown` because it arrives from a Prisma
   * `Json` column and nothing has validated it — `resolveTableSettings` narrows it and
   * fills every gap from the defaults.
   */
  settings?: unknown;
};

export function DataTable({
  schema,
  data,
  title,
  description,
  className,
  settings,
}: DataTableProps) {
  /**
   * ⚠️ SETTINGS WERE STORED ON ALL 654 TABLES AND READ BY NOTHING (K-2, #29.2).
   *
   * `TableLayout` typed this prop `settings?: any` and never passed it on, so density,
   * sticky header and page size sat in the database being ignored while the page size was
   * hardcoded to 25 a few lines below.
   *
   * ⚠️ Every stored blob is identical — all 20 fields hold exactly one distinct value
   * across 654 tables, because no screen writes them. **That makes this change impossible
   * to verify by eye**: reading a setting whose value equals the old hardcoded constant
   * looks the same as ignoring it. The test therefore writes a NON-DEFAULT value and
   * asserts the page changes.
   */
  const resolved = React.useMemo(() => resolveTableSettings(settings), [settings]);
  const { ui, pagination } = resolved;

  /**
   * COLUMN RESIZING (K-3).
   * ============================================================================
   *
   * ⚠️ WHY THIS IS HAND-WRITTEN INSTEAD OF `columnResizeMode: 'onChange'`.
   *
   * TanStack's resizing needs every column to carry an explicit `size`, which forces the
   * table into a fixed layout. Today **no column has a width** — `col.width` is `undefined`
   * on all 2,675 of them — so the browser auto-sizes to content, and that is why the tables
   * currently look right: a long "Course Name" gets the room it needs without anyone
   * configuring anything.
   *
   * Switching all 654 tables to fixed widths, to enable an interaction nobody sees until
   * they drag, is a bad trade. **This is also the trap the original attempt fell into** —
   * the commented-out code inferred widths from column type
   * (`description ? 280 : link ? 200 : 150`), which would have re-laid-out every table.
   *
   * So: nothing is sized until someone actually drags.
   *
   * ⚠️ THE FIRST DRAG MEASURES EVERY COLUMN, NOT JUST THE ONE BEING DRAGGED.
   * Setting a width on one column of an auto-laid-out table makes the browser
   * redistribute all the others, so the neighbours would visibly jump while you drag. The
   * mousedown handler therefore snapshots what the browser has already chosen for every
   * column and pins all of them at once, at their current widths — invisible at the moment
   * it happens, and it makes the drag behave.
   *
   * Per the decision in #29.6(c) this is component state only: **a drag is one visitor's,
   * for one visit, and resets on reload.** No schema write, no permission question.
   */
  /**
   * ⚠️ DENSITY IS SEEDED FROM THE SETTING, THEN OWNED BY THE VISITOR (K-4a).
   *
   * `ui.density` is the table's stored default; the toolbar control overrides it for this
   * visit only. Same shape as the column widths in K-3, and the same reason — one reader
   * preferring tighter rows must not change the page for everyone else.
   *
   * ⚠️ `useState(ui.density)` seeds ONCE. If a different table were rendered into the same
   * component instance the seed would be stale — it is not, because `TableLayout` mounts one
   * table per page, but that is why the initialiser is worth a note rather than a shrug.
   */
  const [density, setDensity] = React.useState(ui.density);

  const [columnWidths, setColumnWidths] = React.useState<Record<string, number>>({});
  const dragRef = React.useRef<{ id: string; startX: number; startWidth: number } | null>(null);

  /** Bounds, per column, falling back to sane defaults when the schema says nothing. */
  const widthBounds = React.useMemo(() => {
    const out: Record<string, { min: number; max: number }> = {};
    for (const col of schema.columns) {
      out[col.id] = { min: col.minWidth ?? 80, max: col.maxWidth ?? 800 };
    }
    return out;
  }, [schema.columns]);

  const handleResizeStart = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>, columnId: string) => {
      // Stop the header's sort button from firing, and stop the browser starting a
      // text selection that would fight the drag.
      event.preventDefault();
      event.stopPropagation();

      const th = (event.currentTarget as HTMLElement).closest('th');
      const tableEl = th?.closest('table');
      if (!th || !tableEl) return;

      /*
        Read the CURRENT rendered widths straight from the DOM rather than from state.
        This is what makes the first drag race-free: the starting width is a measurement,
        not a value that a `setState` earlier in this same handler has not applied yet.
      */
      const measured: Record<string, number> = {};
      tableEl.querySelectorAll('thead th').forEach((el) => {
        const id = (el as HTMLElement).dataset.columnId;
        if (id) measured[id] = Math.round(el.getBoundingClientRect().width);
      });

      dragRef.current = { id: columnId, startX: event.clientX, startWidth: measured[columnId] ?? 150 };
      setColumnWidths((prev) => ({ ...measured, ...prev }));

      const onMove = (e: MouseEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        const { min, max } = widthBounds[drag.id] ?? { min: 80, max: 800 };
        const next = Math.min(max, Math.max(min, drag.startWidth + (e.clientX - drag.startX)));
        setColumnWidths((prev) => ({ ...prev, [drag.id]: next }));
      };
      const onUp = () => {
        dragRef.current = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        // Restore the page's normal cursor and text selection.
        document.body.style.removeProperty('cursor');
        document.body.style.removeProperty('user-select');
      };

      // Listeners go on `document`, not the handle: the pointer routinely leaves a 6px
      // strip during a drag, and a handler bound to the handle would stop tracking.
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      // Keep the resize cursor while dragging even when the pointer is over other content.
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [widthBounds],
  );

  /**
   * Only once a drag has happened does the table need authoritative widths. Until then it
   * stays on the browser's automatic layout — identical to how it renders today, and still
   * responsive to the window.
   */
  const hasResized = Object.keys(columnWidths).length > 0;
  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  // const [columnResizeMode] = useState<ColumnResizeMode>('onChange');

  /**
   * ⚠️ BADGE COLOURS ARE ASSIGNED PER COLUMN, ONCE — NOT PER CELL (K-1).
   * ===================================================================
   *
   * The old rule could be computed inside the cell renderer because it only looked at the
   * one value in front of it: `charCodeAt(0) % 5`. That is precisely why it was broken — a
   * cell cannot know what the *other* values in its column are, so it cannot avoid
   * colliding with them.
   *
   * Assigning by position needs the whole column at once. Doing that here rather than in
   * the renderer also means it runs once per column instead of once per cell: a 40-row
   * table with two badge columns goes from 80 computations to 2, on every sort, filter and
   * page change.
   *
   * Keyed by column id, so a table with several badge columns keeps their palettes
   * independent — each column starts again at `emerald`.
   */
  const badgeAssignments: Record<string, Record<string, BadgeColor>> = React.useMemo(() => {
    const out: Record<string, Record<string, BadgeColor>> = {};
    for (const col of schema.columns) {
      if (col.type !== 'badge') continue;
      out[col.id] = assignBadgeColors(data.rows.map((row) => row[col.id]));
    }
    return out;
  }, [schema.columns, data.rows]);

  // Generate TanStack Table columns from schema
  const columns: ColumnDef<any>[] = React.useMemo(() => {
    return schema.columns.map((col) => ({
      accessorKey: col.id,
      id: col.id,
      header: ({ column, table }) => {
        /*
          ⚠️ Derived, not `column.getIsLastColumn()` — that helper belongs to the column
          pinning feature, which is not enabled here. `getVisibleLeafColumns` is core API
          and also respects the View menu, so hiding the last column moves the omitted
          handle to whichever column is now last.
        */
        const isLastColumn = table.getVisibleLeafColumns().at(-1)?.id === column.id;
        return (
          <div className="flex items-center select-none">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              // `min-w-0` + truncate: a narrow column must clip its own title rather
              // than force the header wider than the column the visitor just dragged.
              className="flex min-w-0 items-center hover:bg-accent text-foreground"
              disabled={!col.sortable}
            >
              <span className="truncate">{col.name}</span>
              {col.sortable && (column.getIsSorted() === "desc" ? (
                <span className="ml-2 text-primary"><ArrowDown /></span>
              ) : column.getIsSorted() === "asc" ? (
                <span className="ml-2 text-primary"><ArrowUp /></span>
              ) : (
                <span className="ml-2 opacity-50"><ChevronsUpDown className="text-muted-foreground" size={16} /></span>
              ))}
            </Button>

            {/*
              ⚠️ THE DRAG HANDLE IS THE LAST COLUMN'S TOO, DELIBERATELY OMITTED.
              Resizing the final column of a `w-full` table has nowhere to give the space
              back to, so it either does nothing or fights the table width. The handle is
              rendered for every column except the last — see the `isLast` check below.

              Absolutely positioned so it does not occupy layout space: a 6px strip
              straddling the column edge, with a 1px line drawn inside it. `opacity-0` until
              hover keeps the header clean, and `group-hover` is not used because the group
              would be the whole header row, lighting up every handle at once.
            */}
            {!isLastColumn && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label={`Resize ${col.name}`}
                onMouseDown={(e) => handleResizeStart(e, col.id)}
                onDoubleClick={(e) => {
                  // Double-click clears this column's width and hands it back to the
                  // browser's automatic sizing — the quickest way out of a bad drag.
                  e.stopPropagation();
                  setColumnWidths((prev) => {
                    const next = { ...prev };
                    delete next[col.id];
                    return next;
                  });
                }}
                className="absolute right-0 top-0 h-full w-2.5 translate-x-1/2 cursor-col-resize opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100"
                title="Drag to resize · double-click to reset"
              >
                <div className="mx-auto h-full w-0.5 rounded-full bg-primary" />
              </div>
            )}
          </div>
        );
      },
      cell: ({ getValue, row }) => {
        const value = getValue();
        // Removed a debug `console.log` that lived here (its own comment said "remove
        // after testing"). This is the CELL RENDERER, so it fired once per cell on
        // every render, sort, filter and pagination — 25 rows with a description
        // column meant 25 console writes per interaction, and console output is
        // genuinely slow in browsers with devtools open.
        return formatCellValue(value, col.type, row.original, col.name, {
          // Only badge cells use these; passing them unconditionally keeps the call
          // site uniform and costs nothing — both are already-computed references.
          badgeAssignment: badgeAssignments[col.id],
          storedBadgeColors: col.meta?.badgeColors,
        });
      },
      enableSorting: col.sortable,
      enableColumnFilter: col.filterable,
      /*
        ⚠️ `col.searchable` was declared, stored on all 2,675 columns, and ignored — the
        global filter matched every column regardless. Found during the K-3 survey.

        Nearly a no-op in practice: 468 of the 469 columns marked `false` are the hidden
        `Target Countries` system column, which the service strips before the payload
        leaves the server. One real column is affected. Wired anyway, because a flag that
        does nothing is worse than one that does something small.
      */
      enableGlobalFilter: col.searchable !== false,
      // COLUMN RESIZING - COMMENTED OUT FOR NOW
      // enableResizing: true,
      // size: col.type === 'description' ? 280 : col.type === 'link' ? 200 : 150,
      // minSize: 120,
      // maxSize: col.type === 'description' ? 350 : 400,
      /*
        ⚠️ ONE PREDICATE FOR EVERY COLUMN (K-4c).

        This used to be three branches: a hand-rolled array check for badges, TanStack's
        built-in `includesString` for text and description, and `'auto'` for the rest — so
        a `link` column's filter behaviour was whatever `auto` inferred, which is why only
        badge columns were ever filterable in practice.

        `tableFilterFn` reads the `{ op, value }` envelope the Filter panel writes, and
        still tolerates the two older shapes so nothing breaks mid-render. The operator
        logic lives in `src/lib/table-filters.ts` where it can be tested without a browser.
      */
      filterFn: tableFilterFn,
    }));
  }, [schema.columns]);

  // Initialize table
  const table = useReactTable({
    data: data.rows,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    /*
      ⚠️ Governs SHIFT-CLICK on a header, not the Sort panel. The panel writes the `sorting`
      array directly, which TanStack honours regardless — so this flag exists to keep the two
      routes consistent: a table that may not be multi-sorted must not become multi-sorted by
      an accidental shift-click either.
    */
    enableMultiSort: resolved.sorting.multiSort,
    // COLUMN RESIZING - COMMENTED OUT FOR NOW
    // columnResizeMode,
    // enableColumnResizing: true,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    initialState: {
      pagination: {
        /*
          ⚠️ WAS HARDCODED `25` while `settings.pagination.pageSize` sat unread in every
          stored blob — and happened to also be 25, which is why nobody noticed.

          `pagination.enabled: false` means "show every row": TanStack has no off switch,
          so the page size becomes the row count. `|| 1` guards an empty table, since a
          page size of 0 makes it divide by zero and render nothing.
        */
        pageSize: pagination.enabled ? pagination.pageSize : (data.rows.length || 1),
      },
    },
  });

  return (
    <div className={`space-y-4 ${className}`}>
      {/*
        Toolbar extracted to `DataTableToolbar` in K-4a. It also owns the badge-chip
        options, which used to be built here by `getBadgeColumnFilters` — that helper
        offered a chip for EVERY badge column, ignoring `col.filterable`; the replacement
        honours it.
      */}
      <DataTableToolbar
        table={table}
        schema={schema}
        data={data}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        density={density}
        onDensityChange={setDensity}
        showSearch={resolved.filtering.globalSearch}
        showColumnFilters={resolved.filtering.columnFilters}
        showSort={resolved.sorting.enabled}
        allowMultiSort={resolved.sorting.multiSort}
      />

      {/* Table */}
      {/*
        ⚠️ THE HEIGHT CAP GOES ON SHADCN'S CONTAINER, NOT ON THIS DIV.
        ==============================================================

        First attempt put `max-h-[70vh] overflow-auto` here and the header did not stick —
        it scrolled away on `/tools`, was sliced in half on `/newsletters`, and looked
        correct only on tables short enough not to scroll at all.

        The vendored `Table` renders its own wrapper:

            <div data-slot="table-container" class="relative w-full overflow-x-auto">
              <table>…</table>
            </div>

        `position: sticky` anchors to its **nearest scrolling ancestor**, and that div is
        one. ⚠️ `overflow-x: auto` makes an element a scroll box on BOTH axes — the spec
        forces the other axis away from `visible` — so it qualifies, while nothing
        constrains its height, so it never actually scrolls vertically. The header dutifully
        stuck to the top of a box that never moved, while the real scrolling happened out
        here, one level further out.

        `components/ui/*` is vendored and must not be edited, so the cap is applied to that
        div through its `data-slot` attribute instead. Now the element that scrolls and the
        element the header sticks inside are the same one.

        `overflow-hidden` here is safe: it sits OUTSIDE the scroll container, not between it
        and the sticky element, so it cannot break sticky — and it keeps content off the
        rounded corners.
      */}
      <div
        className={`rounded-md bg-card overflow-hidden ${
          ui.showBorders ? 'border border-border' : ''
        } ${
          ui.stickyHeader
            ? '[&_[data-slot=table-container]]:max-h-[70vh] [&_[data-slot=table-container]]:overflow-y-auto'
            : ''
        }`}
      >
        {/*
          ⚠️ `table-fixed` ONLY AFTER A DRAG. While `columnWidths` is empty the browser's
          automatic layout runs, which is what makes every table look as it does today and
          keeps it responsive to the window. Once widths are pinned they must be obeyed
          exactly, and only `table-fixed` does that — under auto layout a `width` is a hint
          the browser may overrule when content demands more, so the drag would feel like it
          was fighting back.
        */}
        <Table className={hasResized ? 'table-fixed' : undefined}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-border hover:bg-accent"
              >
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      // Read back by the resize handler to measure every column at once.
                      data-column-id={header.column.id}
                      style={
                        columnWidths[header.column.id]
                          ? { width: columnWidths[header.column.id] }
                          : undefined
                      }
                      /*
                        ⚠️ `bg-muted` and not `bg-muted/50` when sticky. A translucent
                        header lets the rows scrolling underneath show through it, which
                        reads as a rendering fault rather than a design.

                        `z-10` keeps it above the cells; without it the header paints
                        first and rows slide over the top of it.
                      */
                      className={`text-foreground ${ALIGN_CLASS[schema.columns.find((c) => c.id === header.column.id)?.align ?? 'left']} ${
                        ui.stickyHeader
                          ? /*
                              ⚠️ NO `relative` HERE WHEN STICKY. Both are `position`
                              utilities, so having them in one class string leaves the
                              outcome to tailwind-merge and CSS source order rather than to
                              intent. `relative` is only needed for the K-3 resize handle,
                              and a sticky element is already a positioning context.

                              ⚠️ The shadow replaces the bottom border. Tailwind's preflight
                              sets `border-collapse: collapse`, which hands cell borders to
                              the table's grid rather than the cell — so a sticky `th` scrolls
                              away from its own border and the header floats over the rows
                              with nothing separating them. A shadow belongs to the element
                              and travels with it.
                            */
                            'sticky top-0 z-10 bg-muted shadow-[inset_0_-1px_0_0_var(--border)]'
                          : 'relative bg-muted/50'
                      }`}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  /*
                    ⚠️ The stripe uses the ROW INDEX, not `:nth-child`. After a sort or a
                    filter the DOM order changes but `index` is the position in the
                    *rendered* page, so the stripes stay alternating instead of doubling up
                    wherever a hidden row used to be.

                    `alternatingRows` defaults to false (see `table-utils.ts`) — this is
                    implemented and off, not unimplemented.
                  */
                  className={`text-foreground hover:bg-accent/50 ${
                    ui.showBorders ? 'border-border' : 'border-transparent'
                  } ${
                    ui.alternatingRows && row.index % 2 === 1 ? 'bg-muted/30' : ''
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      /*
                        Density (#29.5) — `p-2` from the vendored TableCell sets the
                        horizontal padding; only the vertical half varies.

                        `col.align` (K-3) is stored on all 2,675 columns and was ignored.
                        Every one currently says `left`, so this changes nothing visible
                        today — it exists so the K-6 editor has something to write to.
                      */
                      className={`text-foreground relative overflow-hidden ${DENSITY_ROW_PADDING[density]} ${ALIGN_CLASS[schema.columns.find((c) => c.id === cell.column.id)?.align ?? 'left']}`}
                    >
                      <div className="overflow-hidden">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/*
        Pagination — hidden entirely when `pagination.enabled` is false, since the page size
        was already set to the row count above and the controls would all be inert.
      */}
      {pagination.enabled && (
        <DataTablePagination
          table={table}
          showSizeSelector={pagination.showSizeSelector}
          showInfo={pagination.showInfo}
        />
      )}

    </div>
  );
}


/**
 * Per-cell rendering options.
 *
 * Badge colouring cannot be derived from the cell alone — it needs the whole column — so the
 * decision is made in the component and handed down. See `src/lib/badge-colors.ts`.
 */
type CellOptions = {
  /** value -> colour for this column, computed once from every row (K-1). */
  badgeAssignment?: Record<string, BadgeColor>;
  /** Admin overrides from `col.meta.badgeColors`. Wins over the computed assignment. */
  storedBadgeColors?: Record<string, string> | null;
};

// Enhanced cell value formatting with interactive elements
function formatCellValue(
  value: any,
  type: ColumnType,
  rowData: any,
  columnName?: string,
  options: CellOptions = {},
): React.JSX.Element {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground">-</span>;
  }

  switch (type) {
    case 'link':
      const linkText = String(value);
      const displayLink = linkText
        .replace(/^https?:\/\//, '')  // Remove protocol
        .replace(/^www\./, '')        // Remove www
        .substring(0, 20) + (linkText.length > 20 ? '...' : ''); // Truncate if too long
      
      return (
        <a 
          href={String(value)} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary hover:text-primary/80 underline hover:underline-offset-4 transition-all duration-200 max-w-xs block"
          title={linkText}
        >
          {displayLink}
        </a>
      );
    
    case 'email':
      return (
        <a 
          href={`mailto:${value}`}
          className="text-primary hover:text-primary/80 underline hover:underline-offset-4 transition-all duration-200"
        >
          {String(value)}
        </a>
      );
    
    case 'badge':
      /*
        ⚠️ THIS USED TO BE `charCodeAt(0) % 5` — the FIRST LETTER of the text picked the
        colour, so "Free Course" and "Paid Course" were both yellow. 75 columns rendered
        entirely in one colour. Full explanation and the measurements in
        `src/lib/badge-colors.ts`.

        The colour now comes from the column-wide assignment computed in the component,
        because a cell cannot see its siblings and therefore cannot avoid colliding with
        them. `options.badgeAssignment` is missing only if a caller renders a badge cell
        without going through `DataTable`; `resolveBadgeColor` degrades to neutral rather
        than rendering an unstyled badge.
      */
      return (
        <Badge
          // `variant="outline"` so the vendored Badge contributes a border and NOT its
          // default `bg-primary`. tailwind-merge would strip the background anyway, but
          // asking for the right variant is clearer than relying on merge order.
          variant="outline"
          /*
            Only the DELTAS from the vendored Badge's base are listed here — it already
            supplies `border`, `font-medium` and `inline-flex`, and `cn()` runs the result
            through tailwind-merge, so each of these replaces its counterpart cleanly rather
            than fighting it.

              rounded-md  -> rounded-sm    6px to 4px: squarer, closer to Notion's chips
              px-2 py-0.5 -> px-2.5 py-1   a touch more room around the text
              text-xs     -> text-[13px]   12px to 13px; text-sm (14px) read too large
                                           beside the 14px cell text it sits next to
          */
          className={`${badgeClassFor(value, options.badgeAssignment ?? {}, options.storedBadgeColors)} rounded-sm px-2.5 py-1 text-[13px]`}
        >
          {String(value)}
        </Badge>
      );
    
    case 'currency':
      const num = parseFloat(value);
      return (
        <span className="font-medium text-green-600 dark:text-green-400 font-mono">
          {isNaN(num) ? String(value) : `$${num.toFixed(2)}`}
        </span>
      );
    
    case 'date':
      const date = new Date(value);
      return (
        <span className="text-foreground font-mono">
          {isNaN(date.getTime()) ? String(value) : date.toLocaleDateString()}
        </span>
      );
    
    case 'boolean':
      return (
        <div className="flex items-center">
          <span className={`w-2 h-2 rounded-full mr-2 ${value ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span className={`font-medium ${value ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {value ? 'Yes' : 'No'}
          </span>
        </div>
      );
    
    case 'rating':
      const rating = parseFloat(value);
      if (!isNaN(rating)) {
        const stars = Math.round(rating);
        return (
          <div className="flex items-center">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((star) => (
                <span 
                  key={star}
                  className={`text-sm ${star <= stars ? 'text-yellow-500' : 'text-muted-foreground/30'}`}
                >
                  ⭐
                </span>
              ))}
            </div>
            <span className="ml-2 text-foreground text-sm font-mono">{rating.toFixed(1)}</span>
          </div>
        );
      }
      return <span className="text-foreground">{String(value)}</span>;
    
    case 'description':
      const text = String(value);
      const shortText = text.length > 50 ? text.substring(0, 50) + '...' : text;

      // Always show popover for consistency
      return (
        <div className="max-w-[250px]">
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-left text-foreground hover:text-foreground transition-colors cursor-pointer w-full">
                <div className="truncate text-sm leading-5 py-1">{shortText}</div>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-popover border-border text-popover-foreground">
              <div>
                <p className="text-sm leading-relaxed">{text}</p>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      );
    
    case 'number':
      const number = parseFloat(value);
      return (
        <span className="font-medium text-foreground font-mono">
          {isNaN(number) ? String(value) : number.toLocaleString()}
        </span>
      );
    
    case 'phone':
      return (
        <a 
          href={`tel:${value}`}
          className="text-primary hover:text-primary/80 underline hover:underline-offset-4 transition-all duration-200 font-mono"
        >
          {String(value)}
        </a>
      );
    
    default:
      const textValue = String(value);
      // Fallback truncation for any long text content
      if (textValue.length > 100) {
        return (
          <div className="max-w-[200px]">
            <span 
              className="text-foreground text-sm block truncate cursor-help" 
              title={textValue}
            >
              {textValue}
            </span>
          </div>
        );
      }
      
      return (
        <span className="text-foreground max-w-xs truncate block" title={textValue}>
          {textValue}
        </span>
      );
  }
}


