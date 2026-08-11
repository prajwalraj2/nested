// src/components/table/DataTableSortPanel.tsx

'use client';

import * as React from 'react';
import type { Table } from '@tanstack/react-table';
import { ArrowUpDown, GripVertical, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TableSchema } from '@/types/table';

/**
 * The Sort panel (K-4b).
 * ============================================================================
 *
 * ⚠️ THE HEADER CLICK REMAINS THE FAST PATH, AND IS NOT REPLACED.
 * Clicking a column header still sorts by it, because that is one gesture for the common
 * case. This panel exists for what a header click **cannot express**: an order of
 * precedence — sort by Pricing, then alphabetically by Name *within* each pricing group.
 *
 * Replacing header sorting with a panel would make the common case slower to serve a rarer
 * one.
 *
 * ── Why the list order is the precedence ───────────────────────────────────────
 * TanStack's `sorting` state is already an ordered array of `{ id, desc }`; the first entry
 * is the primary key, the next breaks its ties, and so on. So the panel does not maintain
 * its own model — it edits that array directly and the table follows. There is no second
 * source of truth to fall out of step.
 */

type DataTableSortPanelProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: Table<any>;
  schema: TableSchema;
  /**
   * `settings.sorting.multiSort`. When false the panel holds a single rule — the precedence
   * list, the drag handle and "Add sort" all become meaningless, so they are suppressed
   * rather than shown inert.
   */
  allowMultiple?: boolean;
};

export function DataTableSortPanel({ table, schema, allowMultiple = true }: DataTableSortPanelProps) {
  const sorting = table.getState().sorting;

  /** Columns that may be sorted at all: declared sortable AND currently visible. */
  const sortableColumns = React.useMemo(
    () =>
      schema.columns.filter(
        (col) => col.sortable !== false && table.getColumn(col.id)?.getIsVisible(),
      ),
    // `columnVisibility` is read through `table`, so it must be a dependency or hiding a
    // column would leave it selectable here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schema.columns, table, table.getState().columnVisibility],
  );

  const nameOf = React.useCallback(
    (id: string) => schema.columns.find((c) => c.id === id)?.name ?? id,
    [schema.columns],
  );

  /** Columns not already used by a rule — what "Add sort" may offer. */
  const unusedColumns = sortableColumns.filter((col) => !sorting.some((s) => s.id === col.id));

  const addSort = () => {
    const next = unusedColumns[0];
    if (!next) return;
    table.setSorting([...sorting, { id: next.id, desc: false }]);
  };

  const removeSort = (id: string) => {
    table.setSorting(sorting.filter((s) => s.id !== id));
  };

  const changeColumn = (index: number, newId: string) => {
    const next = [...sorting];
    next[index] = { ...next[index], id: newId };
    table.setSorting(next);
  };

  const changeDirection = (index: number, desc: boolean) => {
    const next = [...sorting];
    next[index] = { ...next[index], desc };
    table.setSorting(next);
  };

  /*
    ── Reordering ──────────────────────────────────────────────────────────────
    Native HTML5 drag and drop, no dependency. The list is two or three items in practice,
    so the cost of a drag library would exceed the problem.

    ⚠️ `dragOver` MUST call `preventDefault()`. Without it the browser treats the row as an
    invalid drop target and the drop event never fires — the single most common reason
    hand-rolled HTML5 dragging silently does nothing.
  */
  const dragIndex = React.useRef<number | null>(null);

  const handleDrop = (targetIndex: number) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null || from === targetIndex) return;
    const next = [...sorting];
    const [moved] = next.splice(from, 1);
    next.splice(targetIndex, 0, moved);
    table.setSorting(next);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 bg-background border-border text-foreground hover:bg-accent data-[state=open]:bg-accent"
          // Active state is legible without opening anything — the point of putting the
          // count on the trigger rather than inside the panel.
          aria-label={sorting.length ? `Sort — ${sorting.length} applied` : 'Sort'}
        >
          <ArrowUpDown className="h-4 w-4" />
          <span className="ml-2 hidden sm:inline">Sort</span>
          {sorting.length > 0 && (
            <span className="ml-2 rounded-full bg-primary px-1.5 text-[10px] font-medium leading-4 text-primary-foreground">
              {sorting.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(30rem,calc(100vw-2rem))] p-3">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          Sort by
        </p>

        {sorting.length === 0 ? (
          <p className="mb-3 text-sm text-muted-foreground">
            Nothing sorted. Rows appear in the order they were added.
          </p>
        ) : (
          <div className="mb-2 space-y-2">
            {sorting.map((rule, index) => (
              <div
                key={rule.id}
                draggable
                onDragStart={() => (dragIndex.current = index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(index)}
                /*
                  Same grid as the Filter panel, so the two read as one system: the column
                  and direction menus line up down the list and the ✕ always sits hard right,
                  regardless of how long a column name is.

                  ⚠️ The grip's track stays in the layout even when `allowMultiple` is false
                  and no grip renders — otherwise a single-rule panel would sit 24px left of
                  where the same panel sits with two rules.
                */
                className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1.25rem_3.5rem_minmax(0,1fr)_minmax(0,8.5rem)_2rem]"
              >
                <span
                  className={`text-muted-foreground ${allowMultiple ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  aria-hidden="true"
                >
                  {allowMultiple && <GripVertical className="h-4 w-4" />}
                </span>

                {/*
                  ⚠️ The FIRST rule reads "Sort by", the rest read "then by". Precedence is
                  the whole point of this panel and a list of identical rows does not
                  convey it — someone would reasonably read them as independent sorts.
                */}
                <span className="text-xs text-muted-foreground">
                  {index === 0 ? 'Sort by' : 'then by'}
                </span>

                <Select value={rule.id} onValueChange={(v) => changeColumn(index, v)}>
                  <SelectTrigger className="h-8 w-full">
                    {/* Radix renders a blank trigger server-side without explicit children
                        — the G-3c trap. The label is passed rather than inferred. */}
                    <SelectValue>{nameOf(rule.id)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {sortableColumns
                      // Every other rule's column is unavailable, so two rules cannot
                      // sort by the same field — which would have no effect anyway.
                      .filter((c) => c.id === rule.id || !sorting.some((s) => s.id === c.id))
                      .map((col) => (
                        <SelectItem key={col.id} value={col.id}>
                          {col.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                <Select
                  value={rule.desc ? 'desc' : 'asc'}
                  onValueChange={(v) => changeDirection(index, v === 'desc')}
                >
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue>{rule.desc ? 'Descending' : 'Ascending'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 justify-self-end text-muted-foreground hover:text-foreground"
                  onClick={() => removeSort(rule.id)}
                  aria-label={`Remove sort on ${nameOf(rule.id)}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-primary hover:text-primary"
            onClick={addSort}
            // Disabled rather than hidden: a control that vanishes leaves the reader
            // wondering whether they imagined it.
            disabled={unusedColumns.length === 0 || (!allowMultiple && sorting.length >= 1)}
          >
            <Plus className="mr-1 h-4 w-4" /> Add sort
          </Button>

          {sorting.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => table.setSorting([])}
            >
              Clear all
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
