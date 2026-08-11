// src/lib/table-filters.ts

import type { ColumnType } from '@/types/table';

/**
 * Filter conditions for the table (K-4c).
 * ============================================================================
 *
 * ⚠️ WHY THIS IS A SEPARATE MODULE AND NOT INLINE IN THE PANEL.
 *
 * The panel is a React component, the table is fetched client-side (#30), and no headless
 * browser is installed — so anything living inside the component cannot be tested here at
 * all. The predicate is the part that can actually be wrong in a way nobody notices ("does
 * not contain" quietly matching empty cells, say), so it lives out here where a test can
 * reach it. The component is left with layout only.
 *
 * ⚠️ CONDITIONS COMBINE WITH **AND**, NOT AND/OR.
 *
 * The design note sketched an And/Or selector. It is not built, deliberately:
 *
 *   • TanStack applies `columnFilters` with AND and offers no hook to change that. OR would
 *     mean bypassing `columnFilters` entirely and reimplementing the filter engine on top of
 *     `globalFilter` — a large change to the one part of the table that currently works.
 *   • **OR within a column already exists**, and is where it is actually wanted: `is any of`
 *     on a badge column matches several values at once. Across *different* columns, OR is
 *     rare — "Pricing is Free OR Name contains adobe" is not a question people ask of a
 *     40-row table.
 *
 * The panel therefore prints "Where" then "And" as fixed labels rather than a selector, so
 * the UI never promises a choice that does not exist.
 */

/** The operators a condition may use. Not every type offers every one — see `OPERATORS`. */
export type FilterOperator =
  | 'contains'
  | 'notContains'
  | 'is'
  | 'isNot'
  | 'startsWith'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'isAnyOf'
  | 'isNoneOf';

/**
 * What a `columnFilters` entry holds.
 *
 * ⚠️ This replaces two different shapes. Previously a badge filter stored a bare
 * `string[]` (set by the faceted chips) and a text filter stored a bare `string` (handled by
 * TanStack's built-in `includesString`). One envelope for both means a single predicate can
 * read every filter, and the operator survives a page of state changes instead of being
 * implied by the column's type.
 */
export type FilterCondition = {
  op: FilterOperator;
  /** `string` for the text operators, `string[]` for `isAnyOf` / `isNoneOf`, unused for the empty checks. */
  value: string | string[];
};

type OperatorDef = { value: FilterOperator; label: string; /** false when the operator needs no input */ takesValue: boolean };

const TEXT_OPERATORS: OperatorDef[] = [
  { value: 'contains', label: 'contains', takesValue: true },
  { value: 'notContains', label: 'does not contain', takesValue: true },
  { value: 'is', label: 'is', takesValue: true },
  { value: 'isNot', label: 'is not', takesValue: true },
  { value: 'startsWith', label: 'starts with', takesValue: true },
  { value: 'isEmpty', label: 'is empty', takesValue: false },
  { value: 'isNotEmpty', label: 'is not empty', takesValue: false },
];

const BADGE_OPERATORS: OperatorDef[] = [
  { value: 'isAnyOf', label: 'is any of', takesValue: true },
  { value: 'isNoneOf', label: 'is none of', takesValue: true },
  { value: 'isEmpty', label: 'is empty', takesValue: false },
  { value: 'isNotEmpty', label: 'is not empty', takesValue: false },
];

/**
 * Which operators each column type offers.
 *
 * ⚠️ Driven by the column TYPE, which is the reason the type system in `types/table.ts`
 * matters beyond rendering. A `link` column gets a narrower set than `text`: "starts with"
 * on a URL is a question about the protocol, not about the content, and reads as noise.
 *
 * Only four types are in use (text 1,165 · link 642 · description 572 · badge 296). The
 * others are mapped anyway so the panel does not break the day one is used.
 */
export const OPERATORS: Record<ColumnType, OperatorDef[]> = {
  text: TEXT_OPERATORS,
  description: TEXT_OPERATORS,
  link: [
    { value: 'contains', label: 'contains', takesValue: true },
    { value: 'notContains', label: 'does not contain', takesValue: true },
    { value: 'isEmpty', label: 'is empty', takesValue: false },
    { value: 'isNotEmpty', label: 'is not empty', takesValue: false },
  ],
  badge: BADGE_OPERATORS,
  boolean: BADGE_OPERATORS,
  email: TEXT_OPERATORS,
  phone: TEXT_OPERATORS,
  image: TEXT_OPERATORS,
  number: TEXT_OPERATORS,
  currency: TEXT_OPERATORS,
  rating: TEXT_OPERATORS,
  date: TEXT_OPERATORS,
};

export function operatorsFor(type: ColumnType): OperatorDef[] {
  return OPERATORS[type] ?? TEXT_OPERATORS;
}

export function operatorLabel(type: ColumnType, op: FilterOperator): string {
  return operatorsFor(type).find((o) => o.value === op)?.label ?? op;
}

export function operatorTakesValue(op: FilterOperator): boolean {
  return op !== 'isEmpty' && op !== 'isNotEmpty';
}

/** The default operator when a condition is first added for a column of this type. */
export function defaultOperatorFor(type: ColumnType): FilterOperator {
  return operatorsFor(type)[0].value;
}

/**
 * Does one cell satisfy one condition?
 *
 * ⚠️ Case-insensitive for every text operator. Someone typing "adobe" into a filter is not
 * asking about capitalisation, and a filter that returns nothing because the data says
 * "Adobe" reads as broken rather than as precise.
 *
 * ⚠️ A condition with no value entered yet matches EVERYTHING rather than nothing. Adding a
 * condition is a two-step act — pick the column, then type — and emptying the table between
 * those steps would look like a bug. `isEmpty` / `isNotEmpty` are exempt because they are
 * complete the moment they are chosen.
 */
export function matchesCondition(cellValue: unknown, condition: FilterCondition): boolean {
  const cell = cellValue === null || cellValue === undefined ? '' : String(cellValue).trim();
  const { op } = condition;

  if (op === 'isEmpty') return cell === '';
  if (op === 'isNotEmpty') return cell !== '';

  if (op === 'isAnyOf' || op === 'isNoneOf') {
    const list = Array.isArray(condition.value) ? condition.value : [];
    // Nothing selected yet — the condition is incomplete, so it does not filter.
    if (list.length === 0) return true;
    const hit = list.some((v) => String(v).trim() === cell);
    return op === 'isAnyOf' ? hit : !hit;
  }

  const needle = (Array.isArray(condition.value) ? condition.value.join(' ') : condition.value ?? '')
    .trim()
    .toLowerCase();
  if (needle === '') return true; // incomplete condition
  const haystack = cell.toLowerCase();

  switch (op) {
    case 'contains':
      return haystack.includes(needle);
    case 'notContains':
      /*
        ⚠️ An EMPTY cell counts as "does not contain". The alternative reading — that a blank
        cell contains nothing and so cannot be judged — quietly drops every row with a gap in
        that column, which is the opposite of what someone excluding a term expects.
      */
      return !haystack.includes(needle);
    case 'is':
      return haystack === needle;
    case 'isNot':
      return haystack !== needle;
    case 'startsWith':
      return haystack.startsWith(needle);
    default:
      return true;
  }
}

/**
 * The `filterFn` every column is given.
 *
 * ⚠️ It tolerates the OLD shapes as well as the new envelope. A bare `string[]` was what the
 * faceted chips stored and a bare `string` was what TanStack's `includesString` used; both
 * still work, so a filter carried over from a previous render — or any caller not yet updated
 * — degrades to sensible behaviour instead of throwing on `condition.op` being undefined.
 */
export function tableFilterFn(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: { getValue: (id: string) => any },
  columnId: string,
  filterValue: unknown,
): boolean {
  if (filterValue === null || filterValue === undefined || filterValue === '') return true;

  if (Array.isArray(filterValue)) {
    return matchesCondition(row.getValue(columnId), { op: 'isAnyOf', value: filterValue });
  }
  if (typeof filterValue === 'string') {
    return matchesCondition(row.getValue(columnId), { op: 'contains', value: filterValue });
  }
  const condition = filterValue as FilterCondition;
  if (!condition.op) return true;
  return matchesCondition(row.getValue(columnId), condition);
}

/** A short human summary of a condition, for the panel's collapsed state and the trigger. */
export function describeCondition(
  columnName: string,
  type: ColumnType,
  condition: FilterCondition,
): string {
  const label = operatorLabel(type, condition.op);
  if (!operatorTakesValue(condition.op)) return `${columnName} ${label}`;
  const value = Array.isArray(condition.value)
    ? condition.value.join(', ')
    : String(condition.value ?? '');
  return `${columnName} ${label} ${value}`.trim();
}
