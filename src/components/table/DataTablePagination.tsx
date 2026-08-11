// src/components/table/DataTablePagination.tsx

'use client';

import { Table } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"

/**
 * DataTable Pagination Component
 * 
 * Professional pagination controls with:
 * - Page size selector
 * - Navigation buttons
 * - Page info display
 * - Responsive design
 * - Dark theme styling
 */

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  /** `settings.pagination.showSizeSelector` (K-2). */
  showSizeSelector?: boolean;
  /** `settings.pagination.showInfo` (K-2) — the "1–10 of 100 rows" line. */
  showInfo?: boolean;
}

export function DataTablePagination<TData>({
  table,
  // Default true so any caller that has not been updated behaves exactly as before.
  showSizeSelector = true,
  showInfo = true,
}: DataTablePaginationProps<TData>) {
  /*
    ⚠️ `getFilteredRowModel()`, NOT the raw data length.

    The count has to describe what the visitor is actually looking at. With a filter
    applied, "1–10 of 412 rows" beside a 12-row result is worse than showing nothing —
    it claims the filter did not work.
  */
  const filteredRows = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const firstRow = filteredRows === 0 ? 0 : pageIndex * pageSize + 1;
  const lastRow = Math.min((pageIndex + 1) * pageSize, filteredRows);
  const totalRows = table.getCoreRowModel().rows.length;

  /*
    A stored `pageSize` that is not one of the presets would leave the Select with nothing
    matching and render an empty trigger. Fold the current value in so it is always
    selectable — the same class of trap as the Radix `SelectValue` issue in G-3c.
  */
  const sizeOptions = Array.from(new Set([10, 25, 50, 100, pageSize])).sort((a, b) => a - b);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-2">

      {/* Left side - Page Size Selector */}
      <div className="flex items-center gap-4">
      {showSizeSelector && (
      <div className="flex items-center space-x-2">
        <p className="text-sm font-medium text-muted-foreground">Rows per page</p>
        <Select
          value={`${table.getState().pagination.pageSize}`}
          onValueChange={(value) => {
            table.setPageSize(Number(value));
          }}
        >
          <SelectTrigger className="h-8 w-[70px] bg-background border-border text-foreground">
            <SelectValue placeholder={table.getState().pagination.pageSize} />
          </SelectTrigger>
          <SelectContent 
            side="top" 
            className="bg-popover border-border"
          >
            {sizeOptions.map((size) => (
              <SelectItem
                key={size}
                value={`${size}`}
                className="text-foreground hover:bg-accent focus:bg-accent"
              >
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      )}

      {/*
        `showInfo` — the type has always documented this as "Show '1-10 of 100 rows'", and
        it rendered "Page 1 of 2" instead. A page number tells you where you are in the
        pagination; a row count tells you how much there is, which is the question someone
        landing on a table actually has.

        The filtered total is called out separately so a filter is legible from the count
        alone, without opening the filter panel.
      */}
      {showInfo && (
        <p className="text-sm text-muted-foreground tabular-nums">
          {filteredRows === 0 ? (
            'No rows'
          ) : (
            <>
              {firstRow}–{lastRow} of {filteredRows} rows
              {filteredRows !== totalRows && (
                <span className="text-muted-foreground/70"> (filtered from {totalRows})</span>
              )}
            </>
          )}
        </p>
      )}
      </div>

      {/* Right side - Page Info + Navigation */}
      <div className="flex items-center space-x-6">
        {/* Page Info */}
        <div className="flex w-[100px] items-center justify-center text-sm font-medium text-muted-foreground tabular-nums">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {Math.max(1, table.getPageCount())}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center space-x-2">
          {/* First Page */}
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex bg-background border-border text-foreground hover:bg-accent"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Go to first page</span>
            <ChevronsLeft />
          </Button>
          
          {/* Previous Page */}
          <Button
            variant="outline"
            className="h-8 w-8 p-0 bg-background border-border text-foreground hover:bg-accent"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Go to previous page</span>
            <ChevronLeft />
          </Button>
          
          {/* Next Page */}
          <Button
            variant="outline"
            className="h-8 w-8 p-0 bg-background border-border text-foreground hover:bg-accent"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Go to next page</span>
            <ChevronRight />
          </Button>
          
          {/* Last Page */}
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex bg-background border-border text-foreground hover:bg-accent"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Go to last page</span>
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
