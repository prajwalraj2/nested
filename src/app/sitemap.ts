import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { SITE_URL } from '@/lib/seo'
import { ALL_COUNTRIES } from '@/lib/countries'

/**
 * sitemap.xml — generated at /sitemap.xml
 * ============================================================================
 *
 * WHAT A SITEMAP IS FOR
 * ---------------------
 * A machine-readable list of every URL you want crawled. Without one, a crawler
 * can only find pages by following links from pages it already knows — so
 * anything buried four levels deep behind a client-rendered sidebar may take a
 * long time to be discovered, or never be.
 *
 * That is exactly this site's shape: `/domain/webdev/withcode/ytube` is three
 * levels below the entry point, and much of the navigation is fetched
 * client-side. A sitemap short-circuits all of that — here is the list, go.
 *
 * `robots.ts` already advertises this file (`Sitemap: https://atno.io/sitemap.xml`),
 * which until now pointed at a 404.
 *
 * ⚠️ A sitemap is a REQUEST, not a command. It helps discovery; it does not force
 * indexing, and it does not override a `noindex` on the page itself.
 */

/**
 * Regenerate at most once an hour.
 *
 * WHY THIS IS NEEDED: without it, Next would render this once at build time and
 * serve that snapshot forever. Content here is created through the admin panel,
 * NOT by deploying — so a build-time snapshot would silently omit every domain
 * and page added since the last deploy.
 *
 * An hour is a deliberate balance: crawlers re-fetch a sitemap on their own
 * schedule (typically daily), so a shorter window would just add database load
 * for no gain.
 */
export const revalidate = 3600

/**
 * The synthetic root page that `direct`-type domains hang their content from.
 *
 * It is a real row in the database but NOT a real URL — `/domain/gdesign/__main__`
 * does not exist; that content is served at `/domain/gdesign`. So this slug has to
 * be dropped from any path we build.
 *
 * ⚠️ Duplicated from `src/services/page.service.ts` and
 * `src/app/api/admin/pages/route.ts`, where it is also a bare string literal.
 * It should be a single shared constant — deliberately not refactored here to
 * keep this commit to one concern.
 */
const MAIN_PAGE_SLUG = '__main__'

/** The shape we need for path building — a subset of the Page row. */
type PageNode = {
  id: string
  slug: string
  parentId: string | null
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // The domain index is the site's real landing page (`/` 308-redirects to it),
  // so it is listed first and is the one entry that never depends on the database.
  const entries: MetadataRoute.Sitemap = [{ url: `${SITE_URL}/domain` }]

  try {
    const domains = await prisma.domain.findMany({
      where: {
        // Unpublished domains are not publicly reachable.
        isPublished: true,

        // ⚠️ ONLY globally-targeted content. A sitemap is a single global document
        // with no country context, so it cannot express "this URL exists for
        // Indian visitors only". Listing a geo-restricted URL would advertise a
        // page that 404s for most people — Google reads that as a soft 404 and
        // treats it as a quality problem. See finding #15.4.
        targetCountries: { has: ALL_COUNTRIES },
      },
      select: {
        slug: true,
        pages: {
          // Same filter one level down. Note this also removes pages from the set
          // used for path building below, which is intentional — see buildPagePath.
          where: { targetCountries: { has: ALL_COUNTRIES } },
          select: { id: true, slug: true, parentId: true },
        },
      },
      orderBy: { slug: 'asc' },
    })

    for (const domain of domains) {
      // The domain's own root URL, e.g. /domain/gdesign
      entries.push({ url: `${SITE_URL}/domain/${domain.slug}` })

      // Index this domain's pages by id so the parent chain can be walked in
      // memory. One query per domain, zero queries per page — walking parents with
      // a query each would be a classic N+1, and these chains can be 3–4 deep.
      const pagesById = new Map<string, PageNode>(
        domain.pages.map((page) => [page.id, page])
      )

      for (const page of domain.pages) {
        // __main__ is not a URL — its content lives at the domain root, which was
        // already added above.
        if (page.slug === MAIN_PAGE_SLUG) continue

        const path = buildPagePath(page, pagesById)

        // null means the page is not reachable — see buildPagePath.
        if (!path) continue

        entries.push({ url: `${SITE_URL}/domain/${domain.slug}/${path}` })
      }
    }
  } catch (error) {
    // A sitemap is a nice-to-have; a failed deploy is not. `revalidate` above means
    // this runs during `next build`, so an unreachable database would otherwise
    // break the whole build. Degrade to the single static entry instead.
    console.error('[sitemap] database query failed, serving static entries only:', error)
  }

  return entries
}

/**
 * Build a page's URL path by walking UP its parent chain.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT JUST `page.slug`
 * ---------------------------------------------------------------------------
 * A naive `pages.map(p => p.slug)` only produces correct URLs for pages one level
 * deep. This site nests further:
 *
 *   Page "ytube"  parentId → "withcode"
 *   Page "withcode"  parentId → null
 *   → the real URL is /domain/webdev/withcode/ytube, NOT /domain/webdev/ytube
 *
 * Emitting the shallow version would fill the sitemap with URLs that 404 — worse
 * than having no sitemap, because it teaches Google the site is unreliable.
 *
 * We collect slugs from the page upwards, then reverse, mirroring the traversal in
 * `PageService.getByPath` and `generatePagePreviewUrl`.
 *
 * @returns the path with no leading slash (`withcode/ytube`), or `null` if the
 *          page is not reachable at a public URL.
 */
function buildPagePath(
  page: PageNode,
  pagesById: Map<string, PageNode>
): string | null {
  const segments: string[] = []
  let current: PageNode | undefined = page

  // Cycle guard. A page cannot legitimately be its own ancestor, but nothing in
  // the schema prevents it — `parentId` is a plain self-relation with no check.
  // One corrupt row would otherwise spin this loop forever and hang the build.
  const visited = new Set<string>()

  while (current) {
    if (visited.has(current.id)) {
      console.error(`[sitemap] parent cycle detected at page ${current.id}, skipping`)
      return null
    }
    visited.add(current.id)

    // Skip the synthetic root: for a `direct` domain the chain ends
    // page → __main__ → null, and __main__ contributes no path segment.
    if (current.slug !== MAIN_PAGE_SLUG) {
      // unshift, not push — we are walking from the leaf up, but the URL reads
      // from the root down.
      segments.unshift(current.slug)
    }

    // parentId null means we've reached the top of the chain.
    if (current.parentId === null) break

    const parent = pagesById.get(current.parentId)

    // ⚠️ THE IMPORTANT CASE. A missing parent means the parent was filtered out of
    // `domain.pages` — because it is targeted at specific countries.
    //
    // That makes THIS page unreachable too, even if the page itself is `ALL`:
    // `PageService.getByPath` applies the same country filter and then walks the
    // chain segment by segment. If an intermediate page is invisible, traversal
    // stops and the request 404s.
    //
    // So a globally-visible page inside a country-restricted parent must NOT be
    // listed. Only the whole chain being `ALL` makes a URL genuinely public.
    if (!parent) return null

    current = parent
  }

  // Empty means every segment was __main__ — nothing to link to.
  return segments.length > 0 ? segments.join('/') : null
}

/**
 * ---------------------------------------------------------------------------
 * THREE THINGS DELIBERATELY OMITTED
 * ---------------------------------------------------------------------------
 *
 * 1. `lastModified` — because we CANNOT compute it honestly.
 *
 *    `Page` and `Domain` have only `createdAt`; neither has an `updatedAt` column.
 *    Using `createdAt` would assert "this page has not changed since it was
 *    created", which is false for every page that has ever been edited.
 *
 *    That matters more than it sounds: Google's documented behaviour is to ignore
 *    `lastmod` entirely — across the whole sitemap — once it decides the values are
 *    unreliable. A wrong date is strictly worse than no date.
 *
 *    (`ContentBlock`, `Table` and `RichTextContent` DO have `updatedAt`, so a
 *    partial value could be derived for some content types. But `section_based`
 *    pages store their layout in `Page.sections`, a JSON column with no timestamp,
 *    so editing one would leave every available date untouched — the result would
 *    still be wrong, just less obviously.)
 *
 *    TODO(Phase B): add `updatedAt DateTime @updatedAt` to `Page` and `Domain`,
 *    then populate this field. Worth pairing with finding #3, since that work
 *    already involves writing a migration.
 *
 * 2. `changeFrequency` — Google's documentation states it ignores this value.
 *
 * 3. `priority` — likewise ignored. Both were in the original plan for this file;
 *    both are omitted for the same reason meta keywords were rejected. A tag the
 *    major engines ignore is not "harmless extra signal", it is noise that implies
 *    a control you do not actually have.
 *
 * ---------------------------------------------------------------------------
 * SCALE
 * ---------------------------------------------------------------------------
 * The sitemap protocol caps a single file at 50,000 URLs / 50 MB uncompressed.
 * Current output is in the hundreds, so a single file is correct. If the catalogue
 * ever approaches that limit, Next supports splitting via `generateSitemaps()`.
 */
