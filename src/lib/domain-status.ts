import type { DomainStatus } from '@/generated/prisma';

/**
 * Domain lifecycle status — shared helpers.
 * ============================================================================
 *
 * `Domain.status` (DRAFT | PUBLISHED | UPCOMING) replaces the old `isPublished` boolean, which
 * could only say "listed" or "not listed" and had no way to express "coming soon".
 * See NEW-IMPROVEMENTS.md §24.
 *
 * ⚠️ These live in one place on purpose. The two domain route files already carry a duplicated
 * `validateDomainData`, and the categories routes carry a duplicated `validateCategoryData` —
 * a pattern worth not extending. Both routes import from here.
 */

/** Every valid status, for runtime validation of untrusted request bodies. */
export const DOMAIN_STATUSES = ['DRAFT', 'PUBLISHED', 'UPCOMING'] as const;

/**
 * The lowercase vocabulary used in admin URLs (`?status=published`).
 *
 * Kept separate from the enum rather than lower-casing it on the fly, so that a junk query
 * string cannot become an enum value Prisma rejects at runtime.
 */
/**
 * ⚠️ INSERTION ORDER IS MEANINGFUL. `DomainFilters` iterates this to build its dropdown, so
 * these appear in the admin in exactly this order — most-used first, matching the order the
 * two-way filter used before `UPCOMING` existed.
 */
export const STATUS_BY_URL_PARAM: Record<string, DomainStatus> = {
  published: 'PUBLISHED',
  draft: 'DRAFT',
  upcoming: 'UPCOMING',
};

export function isDomainStatus(value: unknown): value is DomainStatus {
  return typeof value === 'string' && (DOMAIN_STATUSES as readonly string[]).includes(value);
}

/**
 * Work out the status a write should apply, from a request body that may use either the new
 * field or the old boolean.
 *
 * ⚠️ `status` WINS over `isPublished` when both are present. The new field is what the admin
 * UI now sends; a stale client sending only the boolean still behaves exactly as it used to.
 * Resolving it the other way round would let an old field silently override a deliberate
 * choice of UPCOMING.
 *
 * @param fallback the status to keep when the body specifies neither — pass the existing row's
 *        status on an update, so that a PATCH touching only (say) the name cannot reset it.
 *        Defaults to DRAFT, matching the column default: invisible is the safe direction.
 */
export function resolveStatus(
  body: { status?: unknown; isPublished?: unknown },
  fallback: DomainStatus = 'DRAFT'
): DomainStatus {
  if (isDomainStatus(body.status)) return body.status;
  if (typeof body.isPublished === 'boolean') {
    return body.isPublished ? 'PUBLISHED' : 'DRAFT';
  }
  return fallback;
}

/**
 * Human-readable labels, shared by the admin table badge, the form and the filter chips.
 *
 * ⚠️ "Live" rather than "Published" for the badge kept the wording the table already used, so
 * the status change does not silently re-label a column admins are used to reading.
 */
export const DOMAIN_STATUS_LABELS: Record<DomainStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Live',
  UPCOMING: 'Upcoming',
};

/** What each status means to a visitor — used as help text under the form's picker. */
export const DOMAIN_STATUS_DESCRIPTIONS: Record<DomainStatus, string> = {
  DRAFT: 'Hidden everywhere. The page returns 404.',
  PUBLISHED: 'Listed on the homepage and in the sidebar. The page is live.',
  UPCOMING: 'Listed under “Upcoming Domains” only. Not a link, and the page returns 404.',
};
