// src/components/table/DataTableViewOptions.tsx

'use client';

import { DropdownMenuTrigger } from '@radix-ui/react-dropdown-menu';
import { Table } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import type { TableSchema, ColumnType } from '@/types/table';
import { Settings2 } from 'lucide-react';

/**
 * DataTable View Options Component
 * 
 * Column visibility toggle with:
 * - Individual column show/hide
 * - Professional dropdown interface
 * - Dark theme styling
 * - Accessible controls
 */

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>;
  schema: TableSchema;
}

export function DataTableViewOptions<TData>({
  table,
  schema,
}: DataTableViewOptionsProps<TData>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          // `size="default"` (36px), not `size="sm"` (32px). The search Input beside this
          // uses `ui/input.tsx`'s default `h-9`, and 36px is this app's control height
          // everywhere else — `ui/button.tsx`'s own default, ThemeToggle, and the Share
          // button directly above this toolbar.
          //
          // The `h-8` removed from the className below was redundant anyway: `size="sm"`
          // already sets `h-8`. It came from shadcn's data-table example, which puts `h-8`
          // on the Input too — that example is consistent at 32px, but only its buttons were
          // copied here. 32px was never a decision for this project.
          size="default"
          className="ml-auto hidden lg:flex bg-background border-border text-foreground hover:bg-accent"
        >
          <Settings2 /> View
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="min-w-[200px] bg-popover border-border"
      >
        {table
          .getAllColumns()
          .filter(
            (column) =>
              typeof column.accessorFn !== "undefined" && column.getCanHide()
          )
          .map((column) => {
            // Find the column in schema to get the proper name
            const schemaColumn = schema.columns.find(col => col.id === column.id);
            const displayName = schemaColumn?.name || column.id;
            
            return (
              <DropdownMenuCheckboxItem
                key={column.id}
                className="text-foreground hover:bg-accent focus:bg-accent"
                checked={column.getIsVisible()}
                onCheckedChange={(value) => column.toggleVisibility(!!value)}
              >
                <span className="flex items-center space-x-2">
                  <span className="whitespace-nowrap">{displayName}</span>
                </span>
              </DropdownMenuCheckboxItem>
            );
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

