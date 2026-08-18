// src/lib/feedback-categories.ts

/**
 * The feedback categories, in one place (M-5).
 * ============================================================================
 *
 * ⚠️ THIS FILE EXISTS BECAUSE A ROUTE HANDLER CANNOT EXPORT ANYTHING ELSE. The first version put
 * this list in `api/feedback/route.ts` and re-exported it for the form. Next's App Router type-checks
 * route files against a fixed set of allowed exports — the HTTP verbs plus a few config values —
 * so an extra named export is a BUILD FAILURE, not a style problem.
 *
 * That constraint turns out to be the right shape anyway: three consumers need this list — the
 * `<select>`, the zod enum that validates the POST, and the admin filter — and a category added in
 * only two of them is a value that submits and then cannot be found again.
 *
 * ⚠️ THE VALUE IS STORED, THE LABEL IS NOT. `Feedback.category` holds `"ui-bug"`; the wording
 * beside it can be rewritten freely without a migration or a data backfill.
 */

export const FEEDBACK_CATEGORIES = [
  { value: 'ui-bug', label: 'Something is broken' },
  { value: 'feature-request', label: 'I have an idea' },
  { value: 'content-issue', label: 'A link or listing is wrong' },
  { value: 'other', label: 'Something else' },
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]['value'];

/** The bare values, for `z.enum()` — which needs a tuple of strings, not objects. */
export const FEEDBACK_CATEGORY_VALUES = FEEDBACK_CATEGORIES.map((c) => c.value) as unknown as [
  FeedbackCategory,
  ...FeedbackCategory[],
];

/**
 * A stored value rendered for a human.
 *
 * ⚠️ FALLS BACK TO THE RAW VALUE RATHER THAN THROWING OR SHOWING NOTHING. Rows written before a
 * category was renamed still exist, and an admin queue that renders a blank cell for them is worse
 * at its job than one that shows `ui-bug`.
 */
export function feedbackCategoryLabel(value: string): string {
  return FEEDBACK_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

/** Queue states. `new` is the default in the schema; the others are set from the admin. */
export const FEEDBACK_STATUSES = ['new', 'reviewed', 'done'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
