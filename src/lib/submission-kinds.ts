// src/lib/submission-kinds.ts

/**
 * The submission vocabulary, in one place (M-6).
 * ============================================================================
 *
 * ⚠️ SAME REASON `feedback-categories.ts` EXISTS: a Next route handler may only export the HTTP
 * verbs and a few config values, so a list shared between a route and a form cannot live in the
 * route. Four consumers need these — the form's controls, the zod union that validates the POST,
 * the admin filter, and the admin's status buttons.
 *
 * ⚠️ VALUES ARE STORED, LABELS ARE NOT. `Submission.kind` holds `"tool"`; the wording can be
 * rewritten without a migration or a backfill.
 */

export const SUBMISSION_KINDS = [
  {
    value: 'tool',
    label: 'Suggest a tool or resource',
    hint: 'Something that belongs on a page we already have',
  },
  {
    value: 'domain-request',
    label: 'Request a new domain',
    hint: 'A whole field ATNO does not cover yet',
  },
] as const;

export type SubmissionKind = (typeof SUBMISSION_KINDS)[number]['value'];

/** For `z.discriminatedUnion` and `z.enum`, which need string tuples rather than objects. */
export const SUBMISSION_KIND_VALUES = SUBMISSION_KINDS.map((k) => k.value) as unknown as [
  SubmissionKind,
  ...SubmissionKind[],
];

export function submissionKindLabel(value: string): string {
  return SUBMISSION_KINDS.find((k) => k.value === value)?.label ?? value;
}

/**
 * ⚠️ FOUR STATES, NOT THREE — this queue differs from feedback's deliberately.
 *
 * Feedback is `new → reviewed → done`: a report is acted on or it is not. A submission has an
 * OUTCOME that matters months later ("did we ever add this?"), so `accepted` and `rejected` are
 * distinct terminal states rather than one `done`. Collapsing them would lose the only fact worth
 * looking up when the same tool is suggested a second time.
 */
export const SUBMISSION_STATUSES = ['new', 'reviewed', 'accepted', 'rejected'] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const SUBMISSION_STATUS_LABEL: Record<string, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

/**
 * ⚠️ THE ONLY PLACE A SUBMITTED URL IS ALLOWED TO BECOME A LINK.
 *
 * `z.string().url()` is NOT enough on its own — it validates URL *shape*, and `javascript:alert(1)`
 * and `data:text/html,…` are both perfectly well-formed URLs. Putting one of those in an `href`
 * that an admin clicks runs it in a logged-in session on the admin's own origin: the same
 * stored-XSS outcome the whole of M-4 exists to prevent, reached without ever touching
 * `dangerouslySetInnerHTML`, so the lint rule would not catch it.
 *
 * Used by the POST route to reject on the way in, AND by the admin queue before rendering an
 * anchor — belt and braces, because the check that matters is the one nearest the danger, and rows
 * written before this function existed would otherwise be trusted.
 */
export function isSafeHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    // Not parseable as an absolute URL at all — so certainly not a safe one.
    return false;
  }
}
