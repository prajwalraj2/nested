/**
 * Page URL construction — the single implementation.
 * ============================================================================
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Turning a `Page` row into its public URL requires walking UP the `parentId` chain,
 * because a page's slug alone only produces a correct URL when it sits one level below
 * the domain root:
 *
 *     Page "ytube"     parentId -> "withcode"
 *     Page "withcode"  parentId -> null
 *     real URL:  /domain/webdev/withcode/ytube
 *     NOT:       /domain/webdev/ytube
 *
 * Before this file, that logic existed **four times** in three states of correctness
 * (finding #22.4):
 *
 *   1. `sitemap.ts`                        — correct, cycle-guarded  (the source for this file)
 *   2. `api/admin/pages/route.ts`          — a copy with NO cycle guard, O(n^2) lookups
 *   3. `api/admin/pages/[id]/route.ts`     — a byte-identical copy of (2)
 *   4. `RichTextManager` + `admin/tables/[id]` — no traversal at all, just
 *                                            `/domain/${domain.slug}/${page.slug}`
 *
 * Case 4 was measured across the whole database: **323 of 418 rich-text pages (77.3%)**
 * and **110 of 668 table pages (16.5%)** produced a URL that 404s — 433 broken links in
 * the admin panel. The fix is not new logic; it is deleting three copies and importing
 * the one that was already right.
 */

/** The synthetic root page of a `direct` domain. Contributes no URL segment. */
export const MAIN_PAGE_SLUG = '__main__'

/**
 * The minimum a page needs for path building.
 *
 * Deliberately narrow: callers select only these three columns rather than passing whole
 * Prisma rows. That keeps `/admin/tables`-style over-fetching (#22.1) from creeping in
 * here, and means a caller cannot accidentally satisfy the type by loading a 2 MB `data`
 * column it does not need.
 */
export type PagePathNode = {
  id: string
  slug: string
  parentId: string | null
}

/**
 * Build a page's path **relative to its domain**, by walking up the parent chain.
 *
 * @param page       the page to resolve
 * @param pagesById  every page that could appear in the chain, keyed by id. A `Map` and
 *                   not an array on purpose — the two admin copies used
 *                   `allPages.find(...)` inside a recursive walk, making the whole
 *                   operation O(n^2). Lookup here is O(1).
 * @returns e.g. `withcode/ytube`, with **no leading slash and no domain**; or `null` when
 *          the page is not reachable at a public URL (see the two cases below).
 */
export function buildPagePath(
  page: PagePathNode,
  pagesById: Map<string, PagePathNode>
): string | null {
  const segments: string[] = []
  let current: PagePathNode | undefined = page

  /**
   * Cycle guard.
   *
   * ⚠️ NOT theoretical, and this is the main thing the two admin copies were missing.
   * A page cannot legitimately be its own ancestor, but nothing in the schema prevents
   * it — `parentId` is a plain self-relation with no constraint. One corrupt row would
   * spin this loop forever. In the admin copies, which recursed instead of looping, it
   * would have overflowed the stack and returned a 500 with no useful message.
   */
  const visited = new Set<string>()

  while (current) {
    if (visited.has(current.id)) {
      console.error(`[page-path] parent cycle detected at page ${current.id}, skipping`)
      return null
    }
    visited.add(current.id)

    // Skip the synthetic root: for a `direct` domain the chain ends
    // page -> __main__ -> null, and __main__ contributes no path segment.
    if (current.slug !== MAIN_PAGE_SLUG) {
      // unshift, not push — we walk leaf-upward, but a URL reads root-downward.
      segments.unshift(current.slug)
    }

    // parentId null means the top of the chain.
    if (current.parentId === null) break

    const parent = pagesById.get(current.parentId)

    /**
     * ⚠️ A MISSING PARENT MEANS THIS PAGE IS UNREACHABLE — return null, do not return a
     * partial path.
     *
     * In `sitemap.ts` this is load-bearing: `domain.pages` there is country-filtered, so
     * an absent parent means the parent is targeted at other countries.
     * `PageService.getByPath` applies the same filter and walks segment by segment, so if
     * an intermediate page is invisible the request 404s — even when the leaf itself is
     * `ALL`-targeted. Listing such a URL in the sitemap would advertise a 404 to Google.
     *
     * For an ADMIN caller nothing is country-filtered, so this should not happen; if it
     * does, the data is inconsistent and `null` is still the right answer. Callers should
     * render a disabled control rather than a link they know is broken — which is exactly
     * what the old code got wrong by emitting a shallow URL anyway.
     */
    if (!parent) return null

    current = parent
  }

  // Empty means every segment was __main__ — there is no sub-path to link to.
  return segments.length > 0 ? segments.join('/') : null
}

/**
 * Build a page's **full public URL**.
 *
 * Handles the `__main__` case that `buildPagePath` deliberately does not: a `direct`
 * domain's synthetic root has no path segments of its own, but it *is* reachable — at the
 * domain root. `buildPagePath` returns `null` there (correctly, there is no sub-path),
 * so without this wrapper every caller would have to special-case it. The two admin
 * copies each did, separately.
 *
 * @returns e.g. `/domain/webdev/withcode/ytube`, or `null` if the page has no public URL.
 */
export function buildPageUrl(
  page: PagePathNode,
  domainSlug: string,
  pagesById: Map<string, PagePathNode>
): string | null {
  // The domain root itself.
  if (page.slug === MAIN_PAGE_SLUG) return `/domain/${domainSlug}`

  const path = buildPagePath(page, pagesById)
  if (path === null) return null

  return `/domain/${domainSlug}/${path}`
}

/**
 * Convenience: build the `pagesById` map from a list.
 *
 * Exists so callers do not each write the same `new Map(pages.map(p => [p.id, p]))` line,
 * and so the map is always keyed consistently.
 */
export function toPageMap<T extends PagePathNode>(pages: T[]): Map<string, T> {
  return new Map(pages.map(p => [p.id, p]))
}
