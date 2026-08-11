// src/components/table/DataTableColumnsPanel.tsx

'use client';

import * as React from 'react';
import type { Table } from '@tanstack/react-table';
import { Columns3, GripVertical } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import type { TableSchema } from '@/types/table';

/**
 * The Columns panel (K-4d).
 * ============================================================================
 *
 * Replaces `DataTableViewOptions`, which had three problems beyond missing reorder:
 *
 * ⚠️ **It closed on every toggle.** Radix's `DropdownMenuCheckboxItem` dismisses the menu on
 * select unless `onSelect` calls `preventDefault()`, which it did not — so hiding three
 * columns meant opening the menu three times. A `Popover` has no such behaviour; it stays
 * open until dismissed, which is what a list of toggles needs.
 *
 * ⚠️ **It was `hidden lg:flex`.** Below 1024px there was no column control at all — on the
 * screens where hiding a column matters *most*, because horizontal space is scarce.
 *
 * ⚠️ **Nothing could reorder.** Column order was one of the original requests and had no
 * home. Putting it in the same panel as visibility means one control to learn rather than
 * two, and the two questions are asked together anyway: "which columns, in what order".
 *
 * ── Order is the visitor's, and resets on reload ───────────────────────────────
 * Consistent with column widths (K-3) and density (K-4a). `columnOrder` is component state;
 * the schema's own order is the default and is what everyone else sees.
 */

type DataTableColumnsPanelProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: Table<any>;
  schema: TableSchema;
};

export function DataTableColumnsPanel({ table, schema }: DataTableColumnsPanelProps) {
  /*
    `getAllLeafColumns()` already reflects `columnOrder`, so this list is the on-screen
    order — no separate model to keep in step. Columns that cannot be hidden are still
    listed, because they can still be REORDERED; their checkbox is simply disabled.
  */
  const columns = table.getAllLeafColumns().filter((c) => typeof c.accessorFn !== 'undefined');

  const nameOf = React.useCallback(
    (id: string) => schema.columns.find((c) => c.id === id)?.name ?? id,
    [schema.columns],
  );

  const hiddenCount = columns.filter((c) => !c.getIsVisible()).length;
  const isReordered = table.getState().columnOrder.length > 0;

  const dragIndex = React.useRef<number | null>(null);

  const handleDrop = (targetIndex: number) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null || from === targetIndex) return;

    /*
      ⚠️ `columnOrder` must list EVERY column, not just the moved one. TanStack treats a
      partial array as the complete order and drops whatever is missing — the columns simply
      vanish. Building it from the current on-screen order avoids that by construction.
    */
    const order = columns.map((c) => c.id);
    const [moved] = order.splice(from, 1);
    order.splice(targetIndex, 0, moved);
    table.setColumnOrder(order);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 bg-background border-border text-foreground hover:bg-accent data-[state=open]:bg-accent"
          aria-label={hiddenCount ? `Columns — ${hiddenCount} hidden` : 'Columns'}
        >
          <Columns3 className="h-4 w-4" />
          <span className="ml-2 hidden sm:inline">Columns</span>
          {hiddenCount > 0 && (
            <span className="ml-2 rounded-full bg-primary px-1.5 text-[10px] font-medium leading-4 text-primary-foreground">
              {hiddenCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[16rem] p-3">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          Columns
        </p>
        <p className="mb-3 text-xs text-muted-foreground">Drag to reorder</p>

        <div className="space-y-1">
          {columns.map((column, index) => {
            const canHide = column.getCanHide();
            return (
              <div
                key={column.id}
                draggable
                onDragStart={() => (dragIndex.current = index)}
                // ⚠️ Without `preventDefault` the row is not a valid drop target and the
                // drop event never fires — the usual reason HTML5 dragging does nothing.
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(index)}
                className="grid grid-cols-[1.25rem_1.25rem_minmax(0,1fr)] items-center gap-2 rounded-md px-1 py-1.5 hover:bg-accent"
              >
                <span
                  className="cursor-grab text-muted-foreground active:cursor-grabbing"
                  aria-hidden="true"
                >
                  <GripVertical className="h-4 w-4" />
                </span>

                <Checkbox
                  id={`col-${column.id}`}
                  checked={column.getIsVisible()}
                  disabled={!canHide}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  aria-label={`Show ${nameOf(column.id)}`}
                />

                {/*
                  The label is the click target for the checkbox, so the whole row is
                  usable rather than a 16px square. `truncate` because a long column name
                  must not widen the panel.
                */}
                <label
                  htmlFor={`col-${column.id}`}
                  className={`cursor-pointer truncate text-sm ${
                    column.getIsVisible() ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                  title={nameOf(column.id)}
                >
                  {nameOf(column.id)}
                </label>
              </div>
            );
          })}
        </div>

        {(hiddenCount > 0 || isReordered) && (
          <>
            <Separator className="my-2" />
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
                onClick={() => table.setColumnOrder([])}
                // Disabled rather than hidden, so the row does not jump as you use it.
                disabled={!isReordered}
              >
                Reset order
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
                onClick={() => table.toggleAllColumnsVisible(true)}
                disabled={hiddenCount === 0}
              >
                Show all
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
