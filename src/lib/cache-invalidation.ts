import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from './cache'

/**
 * Drop the cached `/sitemap.xml`.
 * ============================================================================
 *
 * ⚠️ `revalidateTag` CANNOT REACH THE SITEMAP, and this is easy to miss.
 *
 * Every note in this file is about the Data Cache — `unstable_cache` entries, addressed by
 * tag. `src/app/sitemap.ts` is not one of them: it queries `prisma` **directly**, so there is
 * no tag on it and `revalidateTag(DOMAINS)` is a no-op for it. What governs it instead is
 * `export const revalidate = 3600` at the top of that file, which makes `/sitemap.xml` a
 * statically generated route regenerated at most **once an hour** — and the first request
 * after expiry serves the STALE copy while regenerating behind it, so the real lag is longer
 * than an hour.
 *
 * ⚠️ THIS IS INVISIBLE IN LOCAL DEVELOPMENT. `next dev` does not apply the static cache, so
 * the sitemap regenerates on every request and appears to work perfectly. The gap only shows
 * up on the deployed site — which is how it was found: a domain was set to Draft on
 * production, correctly vanished from `/domain` and correctly 404'd, and was still listed in
 * `/sitemap.xml` along with all 70 of its child pages.
 *
 * It was harmless until now only because no domain had ever been unpublished. With
 * DRAFT/UPCOMING (#24) that is a routine action, and a sitemap advertising URLs that 404 is
 * exactly the soft-404 problem `sitemap.ts` already goes out of its way to avoid for
 * geo-restricted pages.
 *
 * The hourly `revalidate` stays as a backstop; this just means an admin action takes effect
 * immediately instead of eventually.
 */
function invalidateSitemap(): void {
  revalidatePath('/sitemap.xml')
}

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
 * Worth knowing before adding calls, because a `revalidateTag` for a tag nothing
 * subscribes to looks like it does something and does not. There are ten
 * `unstable_cache()` wrappers in the whole app, and between them they subscribe to
 * five tags:
 *
 *   DOMAINS      -> domains-all, domain-by-slug, domain-with-pages, domains-navigation
 *   PAGES        -> page-main, page-by-id, domain-with-pages, table-by-page
 *   CATEGORIES   -> categories-active, category-by-slug, category-by-id
 *   NAVIGATION   -> domains-navigation
 *   TABLES       -> table-by-page
 *
 * The remaining seven definitions in CACHE_TAGS — DOMAIN(slug), PAGE(id), HEADER,
 * SIDEBAR, BREADCRUMB, TABLE(id), COUNTRY(code) — have NO subscribers. Calling
 * `revalidateTag` with any of them is a silent no-op. They are kept in cache.ts for
 * future use; just don't mistake them for working invalidation.
 *
 * ---------------------------------------------------------------------------
 * TABLE CONTENT **IS** NOW CACHED — RICH TEXT IS NOT
 * ---------------------------------------------------------------------------
 * ⚠️ This section previously said table content was never held in `unstable_cache`.
 * That changed: `table-by-page` in src/services/table.service.ts now caches the raw
 * table across requests, and `/api/domain/tables/by-page/[pageId]` sends shared cache
 * headers. So **table row edits now depend on invalidation to become visible** — they
 * are no longer automatically fresh on the next load.
 *
 * That is why `invalidatePages()` below fires TABLES, and why the cache entry carries
 * the PAGES tag as well: the two admin table routes already call `invalidatePages()`,
 * so they cover the new entry without needing new call sites.
 *
 * The cached value is deliberately the **unfiltered** table. Country filtering happens
 * after the cache, per request, so no country-specific value is ever stored where the
 * wrong visitor could receive it. Do not "optimise" that by moving the filter inside.
 *
 * Rich text is still uncached — it arrives via `PageService.getByPath`, React `cache()`
 * only — so both rich-text routes still need no invalidation.
 *
 * ⚠️ Two table routes need it for a second, easier-to-miss reason:
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
  // A domain's slug and its STATUS both decide whether it belongs in the sitemap, and the
  // sitemap is not tag-addressable — see `invalidateSitemap` above.
  invalidateSitemap()
}

/**
 * Call after creating, updating, reordering or deleting a **page**, including
 * changes to a `section_based` page's layout (`Page.sections`).
 *
 * Clears DOMAINS and NAVIGATION too: the sidebar and header payloads embed page
 * lists inside their domain objects, so a page rename leaves a stale label in the
 * navigation unless those are dropped as well.
 *
 * Also clears TABLES, which is what the two admin **table** routes rely on — they call
 * this function, and `table-by-page` is now a real cached entry. Before that entry
 * existed, TABLES had no subscriber and this call would have been a no-op.
 */
export function invalidatePages(): void {
  revalidateTag(CACHE_TAGS.PAGES)
  revalidateTag(CACHE_TAGS.DOMAINS)
  revalidateTag(CACHE_TAGS.NAVIGATION)
  revalidateTag(CACHE_TAGS.TABLES)
  /*
    Pages are sitemap entries in their own right — every URL below a domain root comes from
    this table — so creating, renaming or deleting one changes the document. Its geo targeting
    matters too: `sitemap.ts` lists only `targetCountries: ["ALL"]` pages, so narrowing a page
    to one country must remove it from the sitemap.

    Table and rich-text writes reach here as well, which is right: `pageLastModified()` takes
    the newest of the page and its content rows, so editing a table changes that page's
    `<lastmod>`.
  */
  invalidateSitemap()
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
