// src/lib/changelog-types.ts

/**
 * The changelog board's vocabulary, in one place (M-7).
 * ============================================================================
 *
 * ⚠️ SAME REASON AS `feedback-categories.ts` AND `submission-kinds.ts`: a Next route handler may
 * only export the HTTP verbs and a few config values, so a list shared between a route and a
 * component cannot live in the route. Five consumers need these — the public board's columns, its
 * filter, the admin form, the zod schemas, and the badge colouring.
 *
 * ⚠️ VALUES ARE STORED, LABELS ARE NOT. `ChangelogEntry.status` holds `"not-started"`; the column
 * heading above it can be rewritten without a migration.
 */

export const CHANGELOG_TYPES = [
  { value: 'bug', label: 'Bug fix' },
  { value: 'ui-enhancement', label: 'UI enhancement' },
  { value: 'new-feature', label: 'New feature' },
  { value: 'new-column', label: 'New column' },
  { value: 'new-data', label: 'New data' },
] as const;

export type ChangelogType = (typeof CHANGELOG_TYPES)[number]['value'];

export const CHANGELOG_TYPE_VALUES = CHANGELOG_TYPES.map((t) => t.value) as unknown as [
  ChangelogType,
  ...ChangelogType[],
];

export function changelogTypeLabel(value: string): string {
  return CHANGELOG_TYPES.find((t) => t.value === value)?.label ?? value;
}

/**
 * ⚠️ FOUR INDEPENDENT COLUMNS, NOT A PIPELINE.
 *
 * The array order is the LEFT-TO-RIGHT READING ORDER on the board and nothing more. "Done" and
 * "Released" have no defined relationship beyond being different — the user was explicit — so the
 * UI must not draw arrows between columns, show a progress indicator, or otherwise imply that a
 * card travels along this list. A card is moved into a column; it does not advance through them.
 *
 * `description` is the one-line explanation under each column heading. It exists because "Done"
 * and "Tested & Released" sitting side by side otherwise invite exactly the assumption above.
 */
export const CHANGELOG_STATUSES = [
  {
    value: 'not-started',
    label: 'Not started',
    description: 'Planned, not begun',
  },
  {
    value: 'in-progress',
    label: 'In progress',
    description: 'Being built now',
  },
  {
    value: 'done',
    label: 'Done',
    description: 'Built, not yet through testing',
  },
  {
    value: 'released',
    label: 'Tested & Released',
    description: 'Live on the site',
  },
] as const;

export type ChangelogStatus = (typeof CHANGELOG_STATUSES)[number]['value'];

export const CHANGELOG_STATUS_VALUES = CHANGELOG_STATUSES.map((s) => s.value) as unknown as [
  ChangelogStatus,
  ...ChangelogStatus[],
];

export function changelogStatusLabel(value: string): string {
  return CHANGELOG_STATUSES.find((s) => s.value === value)?.label ?? value;
}

/** The shape both the public board and the admin editor work with. */
export type ChangelogCard = {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  order: number;
  updatedAt: string;
};

/**
 * Split a flat, already-ordered list into the four columns.
 *
 * ⚠️ EVERY COLUMN IS PRESENT IN THE RESULT EVEN WHEN EMPTY. Building the object by grouping over
 * the rows would omit a status nothing currently uses, and the board would silently render three
 * columns instead of four — which reads as a broken layout rather than as "nothing here yet".
 * Seeding from `CHANGELOG_STATUSES` makes that impossible.
 *
 * ⚠️ RELIES ON THE CALLER'S SORT, and does not re-sort. The query orders by `(status, order)`,
 * which the model is indexed for; sorting again here would be a second place for the ordering rule
 * to live and drift from the first.
 */
export function groupByStatus<T extends { status: string }>(cards: T[]): Record<string, T[]> {
  const columns: Record<string, T[]> = {};
  for (const status of CHANGELOG_STATUSES) columns[status.value] = [];

  for (const card of cards) {
    // A row with a status no longer in the list would otherwise throw. Dropping it is deliberate:
    // the public board shows the four columns it declares, and nothing else.
    if (columns[card.status]) columns[card.status].push(card);
  }

  return columns;
}
