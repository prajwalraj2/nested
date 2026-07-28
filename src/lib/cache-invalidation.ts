import { revalidateTag } from 'next/cache'
import { CACHE_TAGS } from './cache'

/**
 * Cache invalidation for admin mutations.
 * ============================================================================
 *
 * THE PROBLEM THIS SOLVES
 * -----------------------
 * `src/lib/cache.ts` defines a full tag taxonomy, and every `unstable_cache()`
 * call in the services layer passes the right tags. But nothing ever invalidated
 * them — `revalidateTag` appeared **zero** times in the codebase. So caches only
 * expired on their timer, and an admin who edited something had no way to make the
 * change appear. That reads as "my edit didn't save", and it invites people to
 * disable caching entirely.
 *
 * ---------------------------------------------------------------------------
 * WHICH TAGS ACTUALLY HAVE SUBSCRIBERS
 * ---------------------------------------------------------------------------
 * Worth knowing before adding calls, because `revalidateTag('tables')` looks like
 * it does something and does not. There are exactly nine `unstable_cache()` wrappers
 * in the whole app, and between them they subscribe to only FOUR tags:
 *
 *   DOMAINS      -> domains-all, domain-by-slug, domain-with-pages, domains-navigation
 *   PAGES        -> page-main, page-by-id, domain-with-pages
 *   CATEGORIES   -> categories-active, category-by-slug, category-by-id
 *   NAVIGATION   -> domains-navigation
 *
 * The other eight definitions in CACHE_TAGS — DOMAIN(slug), PAGE(id), HEADER,
 * SIDEBAR, BREADCRUMB, TABLES, TABLE(id), COUNTRY(code) — have NO subscribers.
 * Calling `revalidateTag` with any of them is a silent no-op. They are kept in
 * cache.ts for future use; just don't mistake them for working invalidation.
 *
 * ---------------------------------------------------------------------------
 * TABLE AND RICH-TEXT CONTENT: MOSTLY NOT CACHED — BUT WATCH FOR contentType
 * ---------------------------------------------------------------------------
 * The *content* of those pages is never held in `unstable_cache`:
 *
 *   - `TableService.getPublicTable` uses React `cache()` only, which is
 *     request-scoped and dies with the request.
 *   - `/api/domain/tables/by-page/[pageId]` sets no cache headers at all.
 *   - Rich text arrives via `PageService.getByPath`, also React `cache()` only.
 *
 * So editing a table's rows or a page's HTML is visible on the very next load, and
 * `tables/[id]/data` and both rich-text routes need no invalidation.
 *
 * ⚠️ BUT two table routes DO need it, and the reason is easy to miss:
 *
 *     tables/route.ts        POST   -> tx.page.update({ contentType: 'table' })
 *     tables/[id]/route.ts   DELETE -> tx.page.update({ contentType: 'narrative' })
 *
 * `contentType` decides WHICH layout component renders the page (TableLayout vs
 * NarrativeLayout), and it is part of `pageWithContentSelect` — so it lives inside
 * the cached `page-main` / `page-by-id` / `domain-with-pages` entries. Attach a table
 * to a page without invalidating and the page keeps rendering its old layout for up
 * to 60 seconds.
 *
 * Those two writes use `tx.page.update` inside a `$transaction`, not
 * `prisma.page.update` — which is exactly why a grep for `prisma.page.update` missed
 * them. **When auditing which routes mutate what, search for the transaction client
 * too.**
 *
 * ⚠️ The "content isn't cached" half also stops being true the day `Page.updatedAt`
 * starts being touched on child writes (see the note in src/app/sitemap.ts), or if
 * table data is ever wrapped in `unstable_cache`.
 *
 * ---------------------------------------------------------------------------
 * WHY THESE FUNCTIONS DELIBERATELY OVER-INVALIDATE
 * ---------------------------------------------------------------------------
 * The tag graph is small and highly interconnected — `domain-with-pages` carries
 * both DOMAINS and PAGES, `domains-navigation` carries both DOMAINS and NAVIGATION.
 * Trying to be surgical buys almost nothing and risks missing a dependency.
 *
 * The asymmetry decides it: over-invalidating costs one extra database query on the
 * next request. Under-invalidating shows a user stale data with no way to fix it.
 * So each function clears everything plausibly affected.
 *
 * ⚠️ `revalidateTag` clears Next's **Data Cache** (`unstable_cache`). It does NOT
 * clear HTTP/CDN caches. `/api/page-context` sends
 * `s-maxage=60, stale-while-revalidate=300`, so in principle Vercel's edge could
 * serve stale navigation for up to five minutes after an edit regardless of what we
 * do here. Today that never happens, because that route also sends `Vary: Cookie`,
 * which keys the cache on the whole Cookie header and makes it never hit (finding
 * #15.1). **Fixing #15.1 without this file in place would have turned a dormant
 * problem into a live one** — which is why invalidation came first.
 */

/**
 * Call after creating, updating, publishing or deleting a **domain**.
 *
 * Clears PAGES as well, for two reasons: `domain-with-pages` is tagged with both,
 * and `POST /api/admin/domains` creates the domain's `__main__` page as part of the
 * same operation, so a page really did change.
 *
 * @example
 * const domain = await prisma.domain.create({ ... })
 * invalidateDomains()          // <- after the write succeeds, before responding
 * return NextResponse.json({ success: true, domain })
 */
export function invalidateDomains(): void {
  revalidateTag(CACHE_TAGS.DOMAINS)
  revalidateTag(CACHE_TAGS.PAGES)
  revalidateTag(CACHE_TAGS.NAVIGATION)
}

/**
 * Call after creating, updating, reordering or deleting a **page**, including
 * changes to a `section_based` page's layout (`Page.sections`).
 *
 * Clears DOMAINS and NAVIGATION too: the sidebar and header payloads embed page
 * lists inside their domain objects, so a page rename leaves a stale label in the
 * navigation unless those are dropped as well.
 */
export function invalidatePages(): void {
  revalidateTag(CACHE_TAGS.PAGES)
  revalidateTag(CACHE_TAGS.DOMAINS)
  revalidateTag(CACHE_TAGS.NAVIGATION)
}

/**
 * Call after creating, updating or deleting a **category**.
 *
 * The worst staleness in the app before this existed: categories cache for
 * `CACHE_DURATIONS.LONG` = **300 seconds**, five times longer than anything else,
 * so a renamed category persisted for up to five minutes.
 *
 * Clears DOMAINS and NAVIGATION because the domain index and the header dropdown
 * group domains *by* category — `getAllDomainsFromDB` orders by
 * `category.columnPosition` and `category.categoryOrder`, so moving a category
 * reorders the whole page.
 */
export function invalidateCategories(): void {
  revalidateTag(CACHE_TAGS.CATEGORIES)
  revalidateTag(CACHE_TAGS.DOMAINS)
  revalidateTag(CACHE_TAGS.NAVIGATION)
}
