// src/lib/review-dates.ts

/**
 * The rules for "Reviewed <month> <year>" (N-5).
 * ============================================================================
 *
 * ⚠️ ONE FILE BECAUSE THE PUBLIC BADGE AND THE ADMIN'S "NEEDS REVIEW" FILTER MUST AGREE. If the
 * badge disappeared at 90 days and the filter flagged at 60, a domain could show no badge while the
 * admin insisted it was fine — and the two would drift the first time either number was tuned.
 *
 * ⚠️ WHY THIS FEATURE EXISTS IN THIS SHAPE. The original request was a date that walks forward every
 * 24 hours so pages always read as freshly reviewed, with nobody reviewing anything. That was
 * declined, and the reason is worth keeping next to the code: `pageLastModified()` already feeds
 * real timestamps into `sitemap.xml`, so a page claiming "reviewed 2 days ago" against a sitemap
 * saying nothing changed in three weeks is a contradiction a crawler can see. Fabricated freshness
 * is treated as a spam signal, not a neutral one — it spends trust to buy the appearance of it.
 *
 * See NEW-IMPROVEMENTS-4.md 37.3(a)–(c) for the full decision.
 */

/**
 * How long a review stays worth showing.
 *
 * ⚠️ A STALE BADGE IS WORSE THAN NO BADGE. "Reviewed February 2026" in November advertises neglect
 * more loudly than silence does, so past this point the badge simply does not render.
 *
 * 90 days suits a directory: long enough that a quarterly pass keeps every domain badged, short
 * enough that a genuinely abandoned domain stops claiming otherwise.
 */
export const REVIEW_STALE_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Is this review too old to show?
 *
 * ⚠️ `null` IS STALE, not an error. A domain nobody has reviewed and one reviewed two years ago are
 * the same thing to a visitor: no claim is being made. Both return `true` and render nothing.
 */
export function isReviewStale(reviewedAt: Date | string | null | undefined): boolean {
  if (!reviewedAt) return true;

  const time = new Date(reviewedAt).getTime();
  // An unparseable value is treated as stale rather than thrown on — a bad date must not 500 a page.
  if (!Number.isFinite(time)) return true;

  return Date.now() - time > REVIEW_STALE_DAYS * DAY_MS;
}

/**
 * "Aug 2026".
 *
 * ⚠️ SHORT MONTH, NOT LONG. It was `'long'` first ("August 2026"); the badge then moved from under
 * the title to the right-hand side of the heading row, beside Share, where it shares a line with a
 * button and a wrapping `<h1>`. "September" is four characters longer than "Sep" and it is the
 * horizontal space that is scarce there, not the vertical. The abbreviation loses nothing: month
 * precision is the whole claim either way.
 *
 * ⚠️ MONTH PRECISION, DELIBERATELY, AND THIS IS NOT LAZINESS. The review cadence is a monthly pass
 * over a domain, so a month is exactly as precise as the work actually is. A day-level date would
 * imply someone looked on the 20th specifically — a claim the process does not support — and it
 * would visibly drift for no gain.
 *
 * ⚠️ `en-GB` PINNED RATHER THAN THE VISITOR'S LOCALE. This string is rendered on the server and
 * hydrated on the client; letting it follow the browser's locale would produce different text in the
 * two passes and a hydration mismatch on every content page.
 */
export function formatReviewMonth(reviewedAt: Date | string): string {
  return new Date(reviewedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

/**
 * The label for the public badge, or `null` when nothing should render.
 *
 * ⚠️ RETURNS `null` RATHER THAN AN EMPTY STRING, so a caller cannot accidentally render an empty
 * pill by truthiness-checking the wrong thing.
 *
 * ⚠️ THE WORD IS "REVIEWED", NEVER "UPDATED". "Updated" claims something changed — but reviewing
 * and finding nothing to fix is a real and common outcome, and the most valuable one to report.
 * Saying "Updated" when nothing was would be untrue in exactly the small way this whole feature was
 * redesigned to avoid.
 */
export function reviewBadgeLabel(reviewedAt: Date | string | null | undefined): string | null {
  if (!reviewedAt || isReviewStale(reviewedAt)) return null;
  return `Reviewed ${formatReviewMonth(reviewedAt)}`;
}

/** Whole days since the review, for the admin's ordering. `null` sorts as never reviewed. */
export function daysSinceReview(reviewedAt: Date | string | null | undefined): number | null {
  if (!reviewedAt) return null;
  const time = new Date(reviewedAt).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.floor((Date.now() - time) / DAY_MS);
}
