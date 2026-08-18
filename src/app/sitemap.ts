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
 * ✅ Now a single shared constant, re-exported from `src/lib/page-path.ts` alongside
 * the traversal that uses it (finding #22.4). It is still a bare string literal in
 * `src/services/page.service.ts`, which is a separate concern.
 */
import { MAIN_PAGE_SLUG, buildPagePath, toPageMap } from '@/lib/page-path'

/**
 * The shape we need per page: enough to build the URL, plus every timestamp that
 * could represent "this URL's content changed".
 */
type PageNode = {
  id: string
  slug: string
  parentId: string | null
  updatedAt: Date
  table: { updatedAt: Date } | null
  richTextContent: { updatedAt: Date } | null
  roadmap: { updatedAt: Date } | null
}

/**
 * The honest `lastmod` for a page URL.
 * ============================================================================
 *
 * WHY THIS IS NOT JUST `page.updatedAt`
 * -------------------------------------
 * A URL, from a crawler's point of view, is simply *what it renders*.
 * `/domain/gdesign/ytube` renders a table of YouTube channels — so if those rows
 * change, that URL changed, no matter which database table the bytes came from.
 *
 * Our schema splits one page across several rows, which is good normalisation but
 * means `Page.updatedAt` alone answers the wrong question. Measured against real
 * data, 91.7% of pages keep their content in a CHILD row:
 *
 *   contentType         count    content lives in
 *   ------------------  -----    ----------------------------------------
 *   table                 666    Table.data          (own row, own updatedAt)
 *   rich_text             418    RichTextContent     (own row, own updatedAt)
 *   subcategory_list       74    the child Page rows themselves
 *   section_based           5    Page.sections       (SAME row - fine)
 *
 * ⚠️ And it was already wrong, not merely wrong in theory: every one of the 651
 * table pages and 415 rich-text pages had a child timestamp NEWER than its page
 * timestamp — by up to 147 days. Emitting `Page.updatedAt` would have told Google
 * that 1066 URLs last changed up to five months before they actually did.
 *
 * That is not "understating freshness in the safe direction". Systematically wrong
 * `lastmod` values are precisely what makes Google discard the field for an entire
 * sitemap — the failure this column was added to avoid.
 *
 * So: take the newest of every timestamp that contributes to what the URL renders.
 */
function pageLastModified(page: PageNode): Date {
  const candidates: Date[] = [page.updatedAt]

  // Table pages: the rows ARE the content. TableEditor writes to Table.data, which
  // never touches the Page row.
  if (page.table) candidates.push(page.table.updatedAt)

  // Rich-text pages: same story via HtmlEditor -> RichTextContent.htmlContent.
  if (page.richTextContent) candidates.push(page.richTextContent.updatedAt)

  /*
    Roadmap pages (Phase L) — the third content table, added because the note at the foot of
    this file says to.

    ⚠️ AND IT IS THE FIRST ONE WHERE THIS RELATION ALONE IS NOT ENOUGH.

    `Table` and `RichTextContent` hold their content IN the row we read here, so their
    `updatedAt` genuinely moves whenever the content changes. A roadmap does not: the visible
    content lives in `RoadmapNode` rows, and editing a topic writes to a node, leaving
    `Roadmap.updatedAt` untouched. Reading only this would understate freshness for every edit
    that is not a change of roadmap title/description/settings — which is almost all of them.

    ⚠️ SO THE NODE WRITE ENDPOINTS MUST TOUCH THE PARENT `Roadmap` ROW (L-4):

        await tx.roadmap.update({ where: { id: roadmapId }, data: {} })   // bumps @updatedAt

    That is deliberately the "more durable alternative" described at the foot of this file,
    applied one level down. The alternative — aggregating `MAX(RoadmapNode.updatedAt)` here —
    means a second query per domain and still misses deletions, since a deleted node leaves no
    timestamp behind at all.

    ⚠️ If roadmap `lastmod` ever looks stale, check that L-4's endpoints still do that bump
    before suspecting this function.
  */
  if (page.roadmap) candidates.push(page.roadmap.updatedAt)

  // `section_based` needs nothing extra — its layout lives in Page.sections, on the
  // Page row itself, so Page.updatedAt already moves when it is edited.

  return new Date(Math.max(...candidates.map((d) => d.getTime())))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  /*
    The domain index is the site's real landing page — since M-1 it is served at `/` by a rewrite
    rather than reached by a 308 — so it is listed first and is the one entry that never depends
    on the database.

    ⚠️ `/` ITSELF IS DELIBERATELY NOT LISTED. Both URLs serve the same document and
    `domain/page.tsx` canonicals to `/domain`, so listing both would offer Google two URLs for one
    page and contradict the canonical.

    ⚠️ THE STATIC PAGES MUST BE ADDED HERE BY HAND (M-3). Everything below this line is generated
    from the database, so a hand-written route is invisible to the sitemap unless it is named — a
    page that exists, renders and is linked from the header, but that no crawler is told about.
    Add to this list whenever a route is added under `src/app/(site)/`.
  */
  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/domain` },
    { url: `${SITE_URL}/about` },
    { url: `${SITE_URL}/contact` },
    { url: `${SITE_URL}/privacy` },
    { url: `${SITE_URL}/terms` },
    /*
      ⚠️ INCLUDED EVEN THOUGH IT IS A FORM. A feedback page is a real destination someone may
      search for ("atno report broken link"), and it carries no query parameters or duplicate
      variants — the two things that make a page a poor sitemap entry. Its `force-dynamic` render
      is about the signed token, not about the content, which is identical for every visitor.
    */
    { url: `${SITE_URL}/feedback` },
  ]

  try {
    const domains = await prisma.domain.findMany({
      where: {
        /*
          Only PUBLISHED domains have a page to visit.

          ⚠️ This deliberately excludes UPCOMING as well as DRAFT. An upcoming domain is named
          on `/domain` but has no route of its own — its detail page 404s by design — so
          listing it here would advertise a URL that returns 404 to every crawler. Google reads
          that as a soft 404 and lets it colour its judgement of the whole sitemap, which is
          the same reasoning as the geo filter immediately below (finding #15.4).
        */
        status: 'PUBLISHED',

        // ⚠️ ONLY globally-targeted content. A sitemap is a single global document
        // with no country context, so it cannot express "this URL exists for
        // Indian visitors only". Listing a geo-restricted URL would advertise a
        // page that 404s for most people — Google reads that as a soft 404 and
        // treats it as a quality problem. See finding #15.4.
        targetCountries: { has: ALL_COUNTRIES },
      },
      select: {
        slug: true,
        updatedAt: true,
        pages: {
          /*
            Same filter one level down. Note this also removes pages from the set
            used for path building below, which is intentional — see buildPagePath.

            ⚠️ `status` IS NOT COVERED BY THE DOMAIN FILTER ABOVE. Domain status is —
            these pages are nested inside the domain query, so an unpublished domain
            takes its pages with it. But a DRAFT or UPCOMING page under a LIVE domain
            would still be listed here, advertising a URL that 404s. Same soft-404
            reasoning as the geo filter it sits beside (#15.4).
          */
          where: { status: 'PUBLISHED', targetCountries: { has: ALL_COUNTRIES } },
          select: {
            id: true,
            slug: true,
            parentId: true,
            updatedAt: true,
            // Both one-to-one relations, fetched so pageLastModified() can take the
            // newest timestamp. Still one query per domain — Prisma resolves these
            // as joins, not as a query per page, so this is not an N+1.
            table: { select: { updatedAt: true } },
            richTextContent: { select: { updatedAt: true } },
            // ⚠️ Only meaningful while L-4's node endpoints touch the Roadmap row —
            // see the long note in pageLastModified().
            roadmap: { select: { updatedAt: true } },
          },
        },
      },
      orderBy: { slug: 'asc' },
    })

    for (const domain of domains) {
      // ----------------------------------------------------------------------
      // The domain's own root URL, e.g. /domain/gdesign
      // ----------------------------------------------------------------------
      // What this URL renders depends on the domain's type (see
      // src/app/domain/[...slug]/page.tsx):
      //
      //   pageType 'direct'       -> SectionBasedLayout for the __main__ page
      //   pageType 'hierarchical' -> SubcategorySelector, a list of child pages
      //
      // Either way the domain row alone is not the full picture. For a direct
      // domain the visible content is __main__'s, so include its timestamps.
      const mainPage = domain.pages.find((p) => p.slug === MAIN_PAGE_SLUG)

      const domainLastModified = mainPage
        ? new Date(Math.max(domain.updatedAt.getTime(), pageLastModified(mainPage).getTime()))
        : domain.updatedAt

      // ⚠️ Deliberately NOT the newest of every descendant page. For a hierarchical
      // domain the root lists its children, so a child's TITLE changing does alter
      // this page — but a child's table CONTENTS changing does not, and rolling all
      // of that up would inflate this date on almost every edit anywhere in the
      // domain. Overstating freshness is the failure mode Google penalises; the
      // child page has its own accurate entry a few lines below.
      entries.push({
        url: `${SITE_URL}/domain/${domain.slug}`,
        lastModified: domainLastModified,
      })

      // Index this domain's pages by id so the parent chain can be walked in
      // memory. One query per domain, zero queries per page — walking parents with
      // a query each would be a classic N+1, and these chains can be 3–4 deep.
      const pagesById = toPageMap(domain.pages)

      for (const page of domain.pages) {
        // __main__ is not a URL — its content lives at the domain root, which was
        // already added above.
        if (page.slug === MAIN_PAGE_SLUG) continue

        const path = buildPagePath(page, pagesById)

        // null means the page is not reachable — see buildPagePath.
        if (!path) continue

        entries.push({
          url: `${SITE_URL}/domain/${domain.slug}/${path}`,
          lastModified: pageLastModified(page),
        })
      }
    }

    // Give /domain a date too. It has no row of its own — it renders the LIST of
    // every domain — so the newest domain timestamp is the honest answer: adding,
    // renaming or unpublishing a domain genuinely changes what that page shows.
    //
    // Set here rather than at the declaration above because the static entry has to
    // survive the database being unreachable (see the catch below). If the query
    // fails we simply ship /domain with no date, which is correct.
    if (domains.length > 0) {
      entries[0].lastModified = domains.reduce<Date>(
        (newest, d) => (d.updatedAt > newest ? d.updatedAt : newest),
        domains[0].updatedAt
      )
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
 * ---------------------------------------------------------------------------
 * `buildPagePath` NOW LIVES IN `src/lib/page-path.ts`
 * ---------------------------------------------------------------------------
 * It was moved there verbatim — cycle guard, `__main__` skipping, and the
 * return-null-on-missing-parent rule all unchanged — because three other places
 * needed the same traversal and had either a copy without the cycle guard or no
 * traversal at all (finding #22.4).
 *
 * ⚠️ The country-filter semantics documented on that function are load-bearing HERE
 * specifically: `domain.pages` below is country-filtered, so a missing parent means an
 * ancestor is targeted at other countries, which makes this page unreachable too.
 * Returning a shallow path instead would advertise a 404 to Google. Read the comment on
 * `buildPagePath` before changing it — the sitemap depends on that `null`.
 */

/**
 * ---------------------------------------------------------------------------
 * ON `lastModified` — now emitted, but it took a schema change
 * ---------------------------------------------------------------------------
 * This field was originally omitted, because it could not be computed honestly:
 * `Page` and `Domain` had only `createdAt`. Using that would assert "unchanged
 * since creation", false for any edited row — and Google's documented behaviour is
 * to ignore `lastmod` across an ENTIRE sitemap once it judges the values
 * unreliable. A wrong date is strictly worse than no date.
 *
 * Migration `20260727140000_add_updated_at` added the column. One detail there
 * matters here: `ADD COLUMN ... DEFAULT CURRENT_TIMESTAMP` would have stamped all
 * 1229 existing rows with the same instant, telling Google the whole site changed
 * at once — the very unreliability we were avoiding. The migration therefore
 * backfills from `createdAt`, which for an unedited row genuinely IS its
 * last-modified time. The result is a real spread of dates (Sep 2025 – Mar 2026)
 * instead of one artificial spike.
 *
 * `Page.updatedAt` alone is NOT sufficient — see `pageLastModified()` above, which
 * takes the newest of the page and its content rows. 91.7% of pages keep their
 * content in a child row, so this is the common case, not an edge case.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ READ THIS WHEN ADDING A NEW CONTENT TYPE
 * ---------------------------------------------------------------------------
 * If a future `contentType` stores its content in a NEW table (the way `table` and
 * `rich_text` do), you must add that relation to the `select` above and to
 * `pageLastModified()`. Otherwise pages of that type silently report a stale
 * `lastmod` — which is how this file was wrong the first time.
 *
 * A more durable alternative, worth doing if a third or fourth content table
 * appears: make `Page.updatedAt` mean "this page's content changed" by touching the
 * parent row whenever a child is written. Either explicitly —
 *
 *     await prisma.page.update({ where: { id: pageId }, data: {} })   // bumps @updatedAt
 *
 * — from every mutation route, or automatically via a Prisma Client extension that
 * intercepts writes to any model with a `pageId`. Then this file reads one field
 * again, and nothing here needs touching when a content type is added.
 *
 * That is the better data model (a meaningful `Page.updatedAt` also serves the admin
 * UI and cache invalidation), but it requires either discipline at every write site
 * or non-obvious client magic. With exactly two content tables, reading both here is
 * simpler and cannot be forgotten at write time. Revisit at three.
 *
 * ---------------------------------------------------------------------------
 * TWO THINGS STILL DELIBERATELY OMITTED
 * ---------------------------------------------------------------------------
 *
 * 1. `changeFrequency` — Google's documentation states it ignores this value.
 *
 * 2. `priority` — likewise ignored. Both were in the original plan for this file;
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
