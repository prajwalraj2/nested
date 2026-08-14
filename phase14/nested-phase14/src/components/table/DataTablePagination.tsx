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
}

export function DataTablePagination<TData>({
  table,
}: DataTablePaginationProps<TData>) {
  return (
    <div className="flex items-center justify-between px-2">
      
      {/* Left side - Page Size Selector */}
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
            {[10, 25, 50, 100].map((pageSize) => (
              <SelectItem 
                key={pageSize} 
                value={`${pageSize}`}
                className="text-foreground hover:bg-accent focus:bg-accent"
              >
                {pageSize}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Right side - Page Info + Navigation */}
      <div className="flex items-center space-x-6">
        {/* Page Info */}
        <div className="flex w-[100px] items-center justify-center text-sm font-medium text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
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
