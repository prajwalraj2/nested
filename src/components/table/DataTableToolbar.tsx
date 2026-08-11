// src/components/table/DataTableToolbar.tsx

'use client';

import * as React from 'react';
import type { Table } from '@tanstack/react-table';
import { Rows2, Rows3, Rows4, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { DataTableFacetedFilter } from './DataTableFacetedFilter';
import { DataTableSortPanel } from './DataTableSortPanel';
import { DataTableViewOptions } from './DataTableViewOptions';
import type { TableData, TableSchema, TableSettings } from '@/types/table';

type Density = TableSettings['ui']['density'];

/**
 * The table toolbar (K-4a).
 * ============================================================================
 *
 * Extracted from `DataTable.tsx`, which had reached 892 lines with the toolbar inlined in
 * the middle of it. Nothing about the search or the badge filters changes here — this step
 * moves them, gives the row a stable shape, and adds the density control.
 *
 * ── The layout rule ────────────────────────────────────────────────────────────
 * **Search on the left, every control on the right.** That is the pattern the user pointed
 * at on demo.port.io, and it holds as controls are added in K-4b…K-4d: the left side stays
 * one input no matter how many panels exist, so the row never becomes a jumble.
 *
 * ⚠️ The badge chips are still on the left, beside the search, and that is deliberate for
 * one step only — **K-4c replaces them with the Filter panel** and the left side becomes
 * search alone. Moving them right now would mean building the right-hand group twice.
 *
 * ── Why `gap-2` and not `space-x-2` ────────────────────────────────────────────
 * `space-x-*` adds a left margin to siblings, which breaks the moment the row wraps — and
 * this row wraps on a narrow window with several faceted filters. `gap` is applied by the
 * flex container itself and survives wrapping. (Same reasoning recorded when the search row
 * was first built; kept here so the extraction does not lose it.)
 */

type DataTableToolbarProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: Table<any>;
  schema: TableSchema;
  data: TableData;
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  /** Current row height. Starts from the stored setting; the visitor may override it. */
  density: Density;
  onDensityChange: (density: Density) => void;
  /** `settings.filtering.globalSearch` — hides the search box when false. */
  showSearch?: boolean;
  /** `settings.filtering.columnFilters` — hides the badge chips when false. */
  showColumnFilters?: boolean;
  /** `settings.sorting.enabled` — hides the Sort panel when false. */
  showSort?: boolean;
  /** `settings.sorting.multiSort` — restricts the Sort panel to one rule when false. */
  allowMultiSort?: boolean;
};

/**
 * Density options. The icon carries the meaning faster than the word does — four bars,
 * three, two — so the menu reads at a glance without explanatory sub-text.
 */
const DENSITY_OPTIONS: Array<{ value: Density; label: string; Icon: typeof Rows2 }> = [
  { value: 'compact', label: 'Compact', Icon: Rows4 },
  { value: 'normal', label: 'Normal', Icon: Rows3 },
  { value: 'comfortable', label: 'Comfortable', Icon: Rows2 },
];

export function DataTableToolbar({
  table,
  schema,
  data,
  globalFilter,
  onGlobalFilterChange,
  density,
  onDensityChange,
  showSearch = true,
  showColumnFilters = true,
  showSort = true,
  allowMultiSort = true,
}: DataTableToolbarProps) {
  /**
   * Faceted filter options for every badge column, built from the data rather than from a
   * configured list — so a value that exists in a row can always be filtered on, and one
   * that does not is never offered.
   *
   * ⚠️ `col.filterable` is honoured here. It was not before: `getBadgeColumnFilters` offered
   * a chip for every badge column regardless, so a column explicitly marked unfilterable
   * still got one.
   */
  const badgeFilters = React.useMemo(() => {
    return schema.columns
      .filter((col) => col.type === 'badge' && col.filterable !== false)
      .map((col) => {
        const values = new Set<string>();
        for (const row of data.rows) {
          const v = row[col.id];
          if (v !== null && v !== undefined && v !== '') values.add(String(v));
        }
        return {
          id: col.id,
          title: col.name,
          // Sorted so the chip's list does not depend on row order — the same reasoning as
          // the badge colour assignment in `badge-colors.ts`.
          options: [...values]
            .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
            .map((value) => ({ label: value, value })),
        };
      })
      .filter((f) => f.options.length > 0 && table.getColumn(f.id));
  }, [schema.columns, data.rows, table]);

  const activeColumnFilters = table.getState().columnFilters.length;
  const hasAnyFilter = activeColumnFilters > 0 || globalFilter.length > 0;

  const activeDensity = DENSITY_OPTIONS.find((d) => d.value === density) ?? DENSITY_OPTIONS[1];
  const DensityIcon = activeDensity.Icon;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* ── Left: search, and (until K-4c) the badge chips ─────────────────── */}
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {showSearch && (
          <Input
            placeholder="Search all columns…"
            value={globalFilter ?? ''}
            onChange={(event) => onGlobalFilterChange(String(event.target.value))}
            className="h-9 max-w-sm bg-background border-border text-foreground placeholder:text-muted-foreground"
            aria-label="Search all columns"
          />
        )}

        {showColumnFilters &&
          badgeFilters.map((filter) => (
            <DataTableFacetedFilter
              key={filter.id}
              column={table.getColumn(filter.id)}
              title={filter.title}
              options={filter.options}
            />
          ))}

        {/*
          Only rendered once something is actually filtered, which is why its height was
          wrong for so long — a control that appears conditionally is one nobody sees in a
          screenshot. `h-9` matches the Input and the right-hand buttons explicitly.
        */}
        {hasAnyFilter && (
          <Button
            variant="ghost"
            className="h-9 bg-background border-border text-foreground hover:bg-accent"
            onClick={() => {
              table.resetColumnFilters();
              onGlobalFilterChange('');
            }}
          >
            Reset <X className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>

      {/* ── Right: the controls ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {/* Sort (K-4b). The header click is still the fast path — see the panel's header. */}
        {showSort && <DataTableSortPanel table={table} schema={schema} allowMultiple={allowMultiSort} />}

        {/*
          ⚠️ DENSITY IS THE VISITOR'S, NOT THE TABLE'S.

          It starts from `settings.ui.density` and overrides it for this visit only —
          exactly like the column widths in K-3, and for the same reason: one reader
          preferring tighter rows must not change the page for everyone else.

          A menu rather than a cycling button: three states are one click away instead of
          up to three, and the current one is legible without pressing anything.
        */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 bg-background border-border text-foreground hover:bg-accent"
            >
              <DensityIcon className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">{activeDensity.label}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Row height</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={density}
              onValueChange={(value) => onDensityChange(value as Density)}
            >
              {DENSITY_OPTIONS.map(({ value, label, Icon }) => (
                <DropdownMenuRadioItem key={value} value={value} className="gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DataTableViewOptions table={table} schema={schema} />
      </div>
    </div>
  );
}
