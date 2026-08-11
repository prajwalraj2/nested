// src/components/table/DataTableFilterPanel.tsx

'use client';

import * as React from 'react';
import type { Table } from '@tanstack/react-table';
import { Check, ChevronsUpDown, Filter, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  defaultOperatorFor,
  operatorTakesValue,
  operatorsFor,
  type FilterCondition,
  type FilterOperator,
} from '@/lib/table-filters';
import type { TableColumn, TableData, TableSchema } from '@/types/table';

/**
 * The Filter panel (K-4c).
 * ============================================================================
 *
 * Replaces the faceted badge chips that sat beside the search box. Those could only filter
 * **badge** columns — 296 of 2,675 — so nothing else on the table was filterable at all.
 * With this, every column is, using operators chosen for its type.
 *
 * ⚠️ Conditions combine with **AND**. The reasoning, and why the And/Or selector in the
 * design note is not built, is in `src/lib/table-filters.ts`. The panel prints fixed
 * "Where" / "And" labels rather than a dropdown, so it never offers a choice that does not
 * exist.
 *
 * ⚠️ This component holds **no filter state of its own** — it reads and writes
 * `table.getState().columnFilters` directly. A local copy would have to be synchronised with
 * the table's, and the two would eventually disagree; TanStack's array is the single source
 * of truth, exactly as in the Sort panel.
 *
 * One consequence worth knowing: **one condition per column**. `columnFilters` is keyed by
 * column id, so "Name contains a AND Name contains b" cannot be expressed. That has not come
 * up, and supporting it would mean keeping filter state outside the table — the same cost as
 * OR, for a rarer case.
 */

type DataTableFilterPanelProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: Table<any>;
  schema: TableSchema;
  data: TableData;
};

export function DataTableFilterPanel({ table, schema, data }: DataTableFilterPanelProps) {
  const columnFilters = table.getState().columnFilters;

  /** Columns that may be filtered: declared filterable AND currently visible. */
  const filterableColumns = React.useMemo(
    () =>
      schema.columns.filter(
        (col) => col.filterable !== false && table.getColumn(col.id)?.getIsVisible(),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schema.columns, table, table.getState().columnVisibility],
  );

  const columnById = React.useCallback(
    (id: string): TableColumn | undefined => schema.columns.find((c) => c.id === id),
    [schema.columns],
  );

  /**
   * Distinct values per badge column, for the `is any of` picker. Built from the rows so a
   * value that exists can always be chosen and one that does not is never offered.
   */
  const valuesByColumn = React.useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const col of schema.columns) {
      if (col.type !== 'badge' && col.type !== 'boolean') continue;
      const set = new Set<string>();
      for (const row of data.rows) {
        const v = row[col.id];
        if (v !== null && v !== undefined && v !== '') set.add(String(v));
      }
      out[col.id] = [...set].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    }
    return out;
  }, [schema.columns, data.rows]);

  const unusedColumns = filterableColumns.filter(
    (col) => !columnFilters.some((f) => f.id === col.id),
  );

  const setCondition = (columnId: string, condition: FilterCondition) => {
    table.setColumnFilters(
      columnFilters.map((f) => (f.id === columnId ? { id: columnId, value: condition } : f)),
    );
  };

  const addCondition = () => {
    const col = unusedColumns[0];
    if (!col) return;
    const op = defaultOperatorFor(col.type);
    table.setColumnFilters([
      ...columnFilters,
      { id: col.id, value: { op, value: op === 'isAnyOf' || op === 'isNoneOf' ? [] : '' } },
    ]);
  };

  const removeCondition = (columnId: string) => {
    table.setColumnFilters(columnFilters.filter((f) => f.id !== columnId));
  };

  /** Swapping the column resets the operator — the old one may not exist for the new type. */
  const changeColumn = (oldId: string, newId: string) => {
    const col = columnById(newId);
    if (!col) return;
    const op = defaultOperatorFor(col.type);
    table.setColumnFilters(
      columnFilters.map((f) =>
        f.id === oldId
          ? { id: newId, value: { op, value: op === 'isAnyOf' || op === 'isNoneOf' ? [] : '' } }
          : f,
      ),
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 bg-background border-border text-foreground hover:bg-accent data-[state=open]:bg-accent"
          aria-label={columnFilters.length ? `Filter — ${columnFilters.length} applied` : 'Filter'}
        >
          <Filter className="h-4 w-4" />
          <span className="ml-2 hidden sm:inline">Filter</span>
          {columnFilters.length > 0 && (
            <span className="ml-2 rounded-full bg-primary px-1.5 text-[10px] font-medium leading-4 text-primary-foreground">
              {columnFilters.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(38rem,calc(100vw-2rem))] p-3">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          Filter
        </p>

        {columnFilters.length === 0 ? (
          <p className="mb-3 text-sm text-muted-foreground">
            No filters. Every row is shown.
          </p>
        ) : (
          <div className="mb-2 space-y-2">
            {columnFilters.map((filter, index) => {
              const col = columnById(filter.id);
              if (!col) return null;
              const condition = (filter.value ?? {}) as FilterCondition;
              const op = (condition.op ?? defaultOperatorFor(col.type)) as FilterOperator;

              return (
                /*
                  ⚠️ A GRID, NOT `flex flex-wrap`.

                  Wrapping was the alignment bug: the row's natural width is about 552px and
                  the panel was 544px, so the value input and the ✕ dropped to a second line
                  — and because the ✕ is last, it landed at the LEFT of that new line, which
                  is where it looked most obviously wrong.

                  Fixed tracks make the four controls line up down the whole panel no matter
                  what each row contains: an operator that takes no value leaves an empty
                  cell rather than letting the ✕ slide left into the gap.

                  `minmax(0, …)` on every track lets them shrink instead of overflowing, and
                  the grid only applies from `sm` up — below that the controls stack, which
                  is the only readable option at that width.
                */
                <div
                  key={filter.id}
                  className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[3.25rem_minmax(0,8.5rem)_minmax(0,10rem)_minmax(0,1fr)_2rem]"
                >
                  {/*
                    Fixed labels, not a selector — conditions are ANDed and the panel must
                    not imply otherwise. "Where" then "And" reads as a sentence.
                  */}
                  <span className="text-xs text-muted-foreground">
                    {index === 0 ? 'Where' : 'And'}
                  </span>

                  <Select value={filter.id} onValueChange={(v) => changeColumn(filter.id, v)}>
                    <SelectTrigger className="h-8 w-full">
                      {/* Explicit children — Radix renders a blank trigger otherwise (G-3c). */}
                      <SelectValue>{col.name}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {filterableColumns
                        .filter((c) => c.id === filter.id || !columnFilters.some((f) => f.id === c.id))
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={op}
                    onValueChange={(v) => {
                      const nextOp = v as FilterOperator;
                      setCondition(filter.id, {
                        op: nextOp,
                        // Switching between a list operator and a text one must not carry
                        // the wrong value shape across.
                        value:
                          nextOp === 'isAnyOf' || nextOp === 'isNoneOf'
                            ? Array.isArray(condition.value)
                              ? condition.value
                              : []
                            : Array.isArray(condition.value)
                              ? ''
                              : (condition.value ?? ''),
                      });
                    }}
                  >
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue>
                        {operatorsFor(col.type).find((o) => o.value === op)?.label ?? op}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {operatorsFor(col.type).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/*
                    The value control, or an empty cell holding the track open. Rendering
                    nothing here would let the ✕ move up into this column and break the
                    alignment on exactly the rows that need no value.
                  */}
                  {!operatorTakesValue(op) ? (
                    <div aria-hidden="true" className="hidden sm:block" />
                  ) : (
                    (op === 'isAnyOf' || op === 'isNoneOf' ? (
                      <ValuePicker
                        options={valuesByColumn[filter.id] ?? []}
                        selected={Array.isArray(condition.value) ? condition.value : []}
                        onChange={(next) => setCondition(filter.id, { op, value: next })}
                      />
                    ) : (
                      <Input
                        value={Array.isArray(condition.value) ? '' : (condition.value ?? '')}
                        onChange={(e) => setCondition(filter.id, { op, value: e.target.value })}
                        placeholder="Value…"
                        className="h-8 w-full"
                        aria-label={`Value for ${col.name}`}
                      />
                    ))
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 justify-self-end text-muted-foreground hover:text-foreground"
                    onClick={() => removeCondition(filter.id)}
                    aria-label={`Remove filter on ${col.name}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-primary hover:text-primary"
            onClick={addCondition}
            disabled={unusedColumns.length === 0}
          >
            <Plus className="mr-1 h-4 w-4" /> Add condition
          </Button>

          {columnFilters.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => table.setColumnFilters([])}
            >
              Clear all
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Multi-select for `is any of` / `is none of`.
 *
 * A `Command` list rather than a stack of checkboxes: a badge column has up to five values
 * today, but the same control is used for any list-valued column, and search costs nothing
 * when the list is short.
 */
function ValuePicker({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-full justify-between font-normal"
        >
          <span className="truncate">
            {selected.length === 0
              ? 'Select…'
              : selected.length === 1
                ? selected[0]
                : `${selected.length} selected`}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[14rem] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search values…" className="h-9" />
          <CommandList>
            <CommandEmpty>No values.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem key={option} value={option} onSelect={() => toggle(option)}>
                  <Check
                    className={`mr-2 h-4 w-4 ${selected.includes(option) ? 'opacity-100' : 'opacity-0'}`}
                  />
                  <span className="truncate">{option}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
