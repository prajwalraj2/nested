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
import { Input } from '@/components/ui/input';
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
import { X } from 'lucide-react';

import { DataTablePagination } from './DataTablePagination';
import { DataTableViewOptions } from './DataTableViewOptions';
import { DataTableFacetedFilter } from './DataTableFacetedFilter';
import type { TableSchema, TableData, ColumnType } from '@/types/table';
import {
  assignBadgeColors,
  badgeClassFor,
  type BadgeColor,
} from '@/lib/badge-colors';
import { DENSITY_ROW_PADDING, resolveTableSettings } from '@/lib/table-utils';
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
      header: ({ column }) => {
        return (
          <div className="flex items-center space-x-2 select-none">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="flex items-center hover:bg-accent text-foreground"
            >
              <span>{col.name}</span>
              {column.getIsSorted() === "desc" ? (
                <span className="ml-2 text-primary"><ArrowDown /></span>
              ) : column.getIsSorted() === "asc" ? (
                <span className="ml-2 text-primary"><ArrowUp /></span>
              ) : (
                <span className="ml-2 opacity-50"><ChevronsUpDown className="text-muted-foreground" size={16} /></span>
              )}
            </Button>
            
            {/* Column Resizer - Basic Implementation - COMMENTED OUT FOR NOW */}
            {/* <div
              className="w-1 h-4 bg-gray-500 cursor-col-resize opacity-0 hover:opacity-100 transition-opacity ml-2"
              title="Drag to resize column"
            /> */}
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
      // COLUMN RESIZING - COMMENTED OUT FOR NOW
      // enableResizing: true,
      // size: col.type === 'description' ? 280 : col.type === 'link' ? 200 : 150,
      // minSize: 120,
      // maxSize: col.type === 'description' ? 350 : 400,
      filterFn: col.type === 'badge' 
        ? (row, id, value) => {
            // Custom filter for badge columns - supports multiple selection
            if (!value || value.length === 0) return true;
            const cellValue = String(row.getValue(id));
            return value.includes(cellValue);
          }
        : col.type === 'text' || col.type === 'description' 
          ? 'includesString' 
          : 'auto',
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

  // Helper function to detect badge columns and generate filter options
  const getBadgeColumnFilters = () => {
    const badgeColumns = schema.columns.filter(col => col.type === 'badge');
    
    return badgeColumns.map(col => {
      // Get unique values from actual data
      const uniqueValues = new Set();
      data.rows.forEach(row => {
        if (row[col.id]) {
          uniqueValues.add(row[col.id]);
        }
      });
      
      // Convert to options format
      const options = Array.from(uniqueValues).map(value => ({
        label: String(value),
        value: String(value)
      }));
      
      return {
        column: table.getColumn(col.id),
        title: col.name,
        options
      };
    }).filter(filter => filter.column); // Only include if column exists
  };

  const badgeFilters = getBadgeColumnFilters();

  return (
    <div className={`space-y-4 ${className}`}>
      

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 sm:space-x-2">
        
        {/*
          Search Input + Badge Filters

          ⚠️ `items-center` IS DELIBERATE — without it this row was TOP-aligned, not centred.
          A flex container defaults to `align-items: stretch`, but stretch does not apply to
          items with a definite height (the spec falls back to `flex-start`), and every child
          here has one. So the 32px buttons hung from the top edge of the 36px Input and their
          bottoms sat 4px high.

          The heights are all 36px now, so this changes nothing today. It is here so that a
          future control with a different height degrades to "vertically centred" rather than
          silently reintroducing the bug.

          `gap-2` rather than `space-x-2`: `space-x-*` works by adding left margin to
          siblings, which breaks on wrap — and this row wraps on a wide table with several
          faceted filters.
        */}
        <div className="flex flex-1 items-center gap-2">
          <Input
            placeholder="Search all columns..."
            value={globalFilter ?? ""}
            onChange={(event) => setGlobalFilter(String(event.target.value))}
            className="max-w-sm bg-background border-border text-foreground placeholder:text-muted-foreground"
          />
          
          {/* Badge Column Filters */}
          {badgeFilters.map((filter) => (
            <DataTableFacetedFilter
              key={filter.title}
              column={filter.column}
              title={filter.title}
              options={filter.options}
            />
          ))}
          
          {/* Reset Filters Button */}
          {(columnFilters.length > 0 || globalFilter) && (
            <Button
              variant="ghost"
              // 36px, matching the Input and the two other toolbar buttons. Was `size="sm"`
              // (32px) — invisible in most screenshots because this button only renders once
              // a filter is active, which is exactly why the misalignment survived here
              // after being fixed on the filter and View buttons.
              size="default"
              onClick={() => {
                table.resetColumnFilters();
                setGlobalFilter('');
              }}
              className="bg-background border-border text-foreground hover:bg-accent"
            >
              Reset <X className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-2">
          {/* Column Visibility */}
          <DataTableViewOptions table={table} schema={schema} />

        </div>
      </div>

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
        <Table>
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
                      /*
                        ⚠️ `bg-muted` and not `bg-muted/50` when sticky. A translucent
                        header lets the rows scrolling underneath show through it, which
                        reads as a rendering fault rather than a design.

                        `z-10` keeps it above the cells; without it the header paints
                        first and rows slide over the top of it.
                      */
                      className={`text-foreground ${
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
                      // Density (#29.5). `p-2` from the vendored TableCell sets the
                      // horizontal padding; only the vertical half varies.
                      className={`text-foreground relative overflow-hidden ${DENSITY_ROW_PADDING[ui.density]}`}
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


