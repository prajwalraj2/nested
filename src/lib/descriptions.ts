// src/lib/descriptions.ts

/**
 * The rules for `description` and `metaDescription` (#38, Phase O-2).
 * ============================================================================
 *
 * ⚠️ ONE FILE BECAUSE FOUR ENDPOINTS AND TWO MODELS WRITE THESE FIELDS. `POST`/`PUT` on pages and
 * `POST`/`PUT` on domains all accept the same two fields, and the admin forms cap them client-side.
 * Five copies of "trim it, empty means null, 300 is the limit" would drift the first time one of
 * those numbers was tuned — and drift here is invisible: a value accepted by one endpoint and
 * rejected by another looks like an intermittent bug, not a disagreement.
 *
 * The whole feature is described in NEW-IMPROVEMENTS-4.md #38, Phase O.
 */

/**
 * The hard server-side limit, in characters.
 *
 * ⚠️ NOT A DISPLAY LIMIT — the UI has its own softer guidance (see below). This is the "somebody
 * pasted three paragraphs into the box" guard. Postgres `TEXT` is unbounded, so without this a
 * single row could carry a megabyte and the page would render it.
 *
 * 300 is deliberately well above both useful lengths: an on-page line wants ~120, a search snippet
 * ~160. Anything past 300 is not a long description, it is the wrong content in the wrong field.
 */
export const DESCRIPTION_MAX = 300;

/**
 * Where a `metaDescription` stops being worth writing over the generated template.
 *
 * ⚠️ THIS FLOOR APPLIES TO `description` WHEN IT IS BORROWED FOR SEARCH, **NOT** TO
 * `metaDescription` ITSELF. The asymmetry is the point and it is easy to "fix" by mistake:
 *
 *   • `metaDescription` is somebody deliberately writing a search snippet. If they chose 25
 *     characters, that is the choice — silently overriding it would make the field untrustworthy.
 *   • `description` was written to sit under a heading and is only *borrowed* for search. The floor
 *     protects against borrowing something unsuitable, e.g. the real 20-character value
 *     "Data analyst roadmpa" that exists in the data today.
 *
 * Kept here rather than in `seo.ts` so the number sits beside the fields it judges.
 */
export const META_BORROW_FLOOR = 40;

/**
 * Soft guidance for the admin editors — no enforcement, just the counter's colour.
 *
 * `description` has no upper bound in the UI beyond `DESCRIPTION_MAX`, because a line that wraps to
 * two rows under a heading is a choice, not an error. `metaDescription`'s upper bound is where
 * Google starts truncating.
 */
export const DESCRIPTION_HINT = 120;
export const META_DESCRIPTION_HINT_MIN = META_BORROW_FLOOR;
export const META_DESCRIPTION_HINT_MAX = 160;

/**
 * Turn whatever arrived in a JSON body into what should be written to the column.
 *
 * ⚠️ THREE OUTCOMES, AND THE DIFFERENCE BETWEEN TWO OF THEM IS LOAD-BEARING:
 *
 *   • `undefined` — the key was ABSENT. Means "do not touch this column". A `PUT` that always
 *     wrote every field would blank a description whenever a caller sent only `{ title }`, which
 *     is exactly the shape of bug the roadmap PATCH route documents at length.
 *   • `null` — the key was present and empty. Means "clear it". This is how the admin deletes a
 *     description: submitting an empty input.
 *   • a string — trimmed.
 *
 * ⚠️ `'   '` BECOMES `null`, NOT `'   '`. A whitespace-only value is not a description, and an
 * empty non-null string renders as an empty `<p>` — visible as a gap under the heading, with
 * nothing to click on and nothing to explain it. The O-1 migration applied the same `btrim` guard
 * when copying the roadmap values, for the same reason.
 */
export function normaliseDescription(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Validate a description-shaped field from a request body.
 *
 * Returns an error message, or `null` when the value is acceptable.
 *
 * ⚠️ IT REJECTS RATHER THAN TRUNCATING. Silently cutting a value at 300 characters means the author
 * saves, sees a sentence end mid-word, and has no idea why — whereas a 400 with the actual length
 * says what happened. The same reasoning as the slug conflict returning 409 instead of renaming.
 *
 * ⚠️ A NON-STRING, NON-NULL VALUE IS AN ERROR, not something to coerce. `{ description: 42 }` is a
 * caller bug; `String(42)` would write "42" into a page and hide it.
 */
export function validateDescription(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) return null;

  if (typeof value !== 'string') {
    return `${fieldName} must be a string or null.`;
  }

  const trimmed = value.trim();
  if (trimmed.length > DESCRIPTION_MAX) {
    return `${fieldName} must be ${DESCRIPTION_MAX} characters or fewer (received ${trimmed.length}).`;
  }

  /*
    ⚠️ HTML IS REJECTED, NOT STRIPPED. Both fields are plain text by contract, because
    `metaDescription` reaches a `<meta>` tag where markup renders as literal characters in search
    results — `&lt;p&gt;Best books&lt;/p&gt;` is what a searcher would see.

    Stripping would be worse than rejecting: it silently changes what the author typed, and a
    stripper is exactly the kind of thing that gets removed later for being redundant (see
    SANITISER-REMOVAL.md). Refusing tells them to fix it themselves.

    ⚠️ Deliberately a NARROW check — `<` immediately followed by a letter or a slash. A legitimate
    "Tools for < $10/month" must still be allowed, and it is.
  */
  if (/<[a-zA-Z/]/.test(trimmed)) {
    return `${fieldName} must be plain text — HTML tags are not allowed here.`;
  }

  return null;
}
