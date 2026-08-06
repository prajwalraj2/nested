import type { PageStatus } from '@/generated/prisma';

/**
 * Page lifecycle status — shared helpers.
 * ============================================================================
 *
 * The `Page` twin of `src/lib/domain-status.ts`. See NEW-IMPROVEMENTS.md §25.
 *
 * ⚠️ WHY THIS IS A SEPARATE FILE RATHER THAN A GENERIC ONE SHARED WITH DOMAINS.
 *
 * The two enums hold the same three values, but the surrounding logic genuinely differs:
 * `resolveDomainStatus` has to accept the legacy `isPublished` boolean that `Domain` still
 * carries for one release, and `Page` has no such history — it never had a publication flag at
 * all. Folding both into one parameterised helper would mean a function whose main job is
 * explaining which model it is being called for.
 *
 * What *is* worth not repeating is the reasoning, so this file points at its twin rather than
 * restating it.
 */

/** Every valid status, for runtime validation of untrusted request bodies. */
export const PAGE_STATUSES = ['DRAFT', 'PUBLISHED', 'UPCOMING'] as const;

/**
 * The lowercase vocabulary for admin URLs (`?status=upcoming`), kept separate from the enum so
 * a junk query string cannot become a value Prisma rejects at runtime.
 *
 * ⚠️ Insertion order is meaningful: any UI that iterates this renders in this order.
 */
export const PAGE_STATUS_BY_URL_PARAM: Record<string, PageStatus> = {
  published: 'PUBLISHED',
  draft: 'DRAFT',
  upcoming: 'UPCOMING',
};

export function isPageStatus(value: unknown): value is PageStatus {
  return typeof value === 'string' && (PAGE_STATUSES as readonly string[]).includes(value);
}

/**
 * The status a write should apply.
 *
 * @param fallback what to keep when the body omits `status` — pass the existing row's status on
 *        an update, so a PUT that only renames a page cannot silently unpublish it. Defaults to
 *        `PUBLISHED`, matching the column default.
 *
 * ⚠️ The default is PUBLISHED, NOT DRAFT — the opposite of the domain helper. Two of the five
 * page-creation call sites are side effects of domain operations (creating a direct domain
 * creates its `__main__`; changing a domain's pageType recreates it), and a DRAFT default there
 * would produce an invisible `__main__` and 404 the whole domain root. See schema.prisma.
 */
export function resolvePageStatus(
  body: { status?: unknown },
  fallback: PageStatus = 'PUBLISHED'
): PageStatus {
  return isPageStatus(body.status) ? body.status : fallback;
}

/**
 * The synthetic root page of a `direct` domain.
 *
 * ⚠️ A `__main__` page must never leave PUBLISHED. It is not a page anyone navigates to by
 * name — it IS `/domain/<slug>`. Hiding it would 404 the domain root, which is finding #11's
 * failure mode. Its visibility is already governed by `Domain.status` one level up, so a status
 * of its own would be a second switch on the same door.
 *
 * `PageService.getMainPage` therefore does NOT filter on status (see the note there); this guard
 * is what makes that safe, by keeping the bad state unreachable through the API.
 */
export const MAIN_PAGE_SLUG = '__main__';

export function isMainPage(page: { slug: string }): boolean {
  return page.slug === MAIN_PAGE_SLUG;
}

/** Human-readable labels, shared by the form, the tree badge and any filter chips. */
export const PAGE_STATUS_LABELS: Record<PageStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Live',
  UPCOMING: 'Upcoming',
};

/** What each status means to a visitor — help text under the form's picker. */
export const PAGE_STATUS_DESCRIPTIONS: Record<PageStatus, string> = {
  DRAFT: 'Hidden everywhere. The page — and anything nested under it — returns 404.',
  PUBLISHED: 'Listed in its section and in the sidebar. The page is live.',
  UPCOMING: 'Listed under “Upcoming Resources” only. Not a link, and the page returns 404.',
};
