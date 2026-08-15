// app/domain/[...slug]/page.tsx
// 
// Dynamic Page Routing - Handles nested domain pages
// Supports: direct, hierarchical, section_based, table, rich_text layouts
// Uses Services Layer for data fetching
// Includes ISR for optimal performance

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SubcategorySelector } from '@/components/domain/SubcategorySelector';
import { SectionBasedLayout } from '@/components/domain/SectionBasedLayout';
import { NarrativeLayout } from '@/components/domain/NarrativeLayout';
import { TableLayout } from '@/components/domain/TableLayout';
import { RichTextLayout } from '@/components/domain/RichTextLayout';
import { getUserCountryFromCookies, isContentVisibleToUser } from '@/lib/server-country';
import { DomainService, PageService, NavigationService } from '@/services';
// JSON-LD structured data — see src/lib/structured-data.ts for what it buys us and its
// honest limits (it is a click-through improvement, not a ranking factor).
import { buildBreadcrumbJsonLd } from '@/lib/structured-data';
import { JsonLd } from '@/components/JsonLd';
import {
  stripEmoji,
  truncate,
  htmlToText,
  isGloballyIndexable,
  buildOpenGraph,
  buildTwitter,
  TITLE_SEPARATOR,
} from '@/lib/seo';

// ============================================
// ISR Configuration
// ============================================

/** Revalidate page every 60 seconds */
export const revalidate = 60;

/** Force dynamic rendering due to geo-targeting (cookie-based) */
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string[] }> };

// ============================================
// Metadata
// ============================================

/**
 * Per-page `<title>`, `<meta description>`, canonical URL and Open Graph tags.
 * ============================================================================
 *
 * THE PROBLEM THIS SOLVES
 * -----------------------
 * Before this existed, the site had exactly one `metadata` export (the root layout)
 * and zero `generateMetadata` functions — so EVERY url returned the identical head:
 *
 *     <title>ATNO - Domain Explorer</title>
 *
 * `/domain/genai/videogen`, `/domain/appdev/ios`, `/domain/webdev/withcode` — all the
 * same. The `<title>` is the single strongest on-page ranking factor, and site-wide
 * duplicate titles are a direct quality problem: Google has no way to tell the pages
 * apart, and search results show the same meaningless line for every one of them.
 *
 * WHY THIS COSTS NO EXTRA DATABASE QUERIES
 * ----------------------------------------
 * Next.js runs `generateMetadata` and the page component for the same request, and
 * every service method is wrapped in React's `cache()` — a per-request memo. Calling
 * `DomainService.getWithPages(domainSlug)` here and again in the component below
 * executes ONE query; the second call is served from the memo.
 *
 * ⚠️ That only holds while the ARGUMENTS MATCH EXACTLY. `cache()` keys on the
 * argument list, so `getByPath(domain.id, restSlug, pageType, userCountry)` here must
 * pass the identical values the component passes. Change one call and you silently
 * double the query count for every page view. The calls below are deliberately
 * identical to the ones in `DomainPage`.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const awaitedParams = await params;
  const [domainSlug, ...restSlug] = awaitedParams.slug;
  const userCountry = await getUserCountryFromCookies();

  const domain = await DomainService.getWithPages(domainSlug);

  // No such domain → the component below returns notFound(). Metadata for a 404
  // barely matters (Google won't index a 404 regardless), but `noindex` here costs
  // nothing and is correct if the status ever changes.
  if (!domain) {
    return { title: 'Not Found', robots: { index: false, follow: false } };
  }

  // Domain exists but isn't targeted at this visitor's country → also a 404.
  if (!isContentVisibleToUser(domain.targetCountries, userCountry)) {
    return { title: 'Not Found', robots: { index: false, follow: false } };
  }

  /*
    Not published → 404, so the metadata must say so too. Mirrors the identical guard in the
    page component below; see the long note there for why this gate did not exist before.

    ⚠️ Both places need it. `generateMetadata` and the component run independently, so a
    component-only guard would emit a real title and canonical URL for a page that then 404s —
    telling a crawler the page is genuine while serving it a 404.
  */
  if (domain.status !== 'PUBLISHED') {
    return { title: 'Not Found', robots: { index: false, follow: false } };
  }

  // Titles in the DB carry emoji ('🖌️ Graphic Designing'). Keep them in the UI,
  // strip them here — see the reasoning in src/lib/seo.ts.
  const domainName = stripEmoji(domain.name);

  // --------------------------------------------------------------------------
  // Domain root — /domain/gdesign
  // --------------------------------------------------------------------------
  if (restSlug.length === 0) {
    const path = `/domain/${domain.slug}`;
    const description = truncate(
      `Curated tools, resources and channels for ${domainName}. Hand-picked and organised on ATNO.`
    );

    return {
      // The `template` in src/app/layout.tsx turns this into
      // "Graphic Designing | ATNO".
      title: domainName,
      description,
      alternates: {
        // Relative on purpose — `metadataBase` in the root layout expands this to
        // https://atno.io/..., so BOTH production hostnames emit the same canonical
        // and Google stops treating nested-two.vercel.app as a second site.
        canonical: path,
      },
      // Via the builders so `og:type` / `og:site_name` / `og:locale` are included —
      // Next.js REPLACES the layout's openGraph object rather than merging into it,
      // so anything omitted here would silently disappear from the rendered head.
      openGraph: buildOpenGraph({ title: domainName, description, url: path }),
      twitter: buildTwitter({ title: domainName, description }),
      robots: buildRobots(isGloballyIndexable(domain.targetCountries)),
    };
  }

  // --------------------------------------------------------------------------
  // Nested page — /domain/webdev/courses, /domain/webdev/withcode/ytube
  // --------------------------------------------------------------------------
  // Identical arguments to the component's call → one query, not two.
  const page = await PageService.getByPath(
    domain.id,
    restSlug,
    domain.pageType as 'direct' | 'hierarchical',
    userCountry
  );

  if (!page) {
    return { title: 'Not Found', robots: { index: false, follow: false } };
  }

  const pageTitle = stripEmoji(page.title);
  const path = `/domain/${domain.slug}/${restSlug.join('/')}`;

  // "YouTube Channels · Graphic Designing" → rendered by the layout's template as
  // "YouTube Channels · Graphic Designing · ATNO". Only the page and its own domain
  // are included, not every intermediate path segment, so deep paths don't produce
  // unreadably long titles.
  //
  // ⚠️ Separator is `·` not `|` — see TITLE_SEPARATOR in src/lib/seo.ts. Several
  // domain names contain literal pipes ("AI | ML | DL [ Traditional ]").
  const title = `${pageTitle}${TITLE_SEPARATOR}${domainName}`;
  const description = buildPageDescription(page, pageTitle, domainName);

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: buildOpenGraph({ title, description, url: path }),
    twitter: buildTwitter({ title, description }),
    // BOTH the domain and the page must be globally targeted for this URL to be
    // indexable. See isGloballyIndexable() in src/lib/seo.ts for why — it prevents
    // the soft-404 chain described in finding #15.4.
    robots: buildRobots(isGloballyIndexable(domain.targetCountries, page.targetCountries)),
  };
}

/**
 * Turn "is this indexable?" into the `robots` metadata field.
 *
 * Returning `undefined` when indexable is deliberate: Next.js then emits no robots
 * meta tag at all, and the absence of a tag already means "index, follow" — that's
 * the default. Emitting `<meta name="robots" content="index, follow">` would be
 * redundant noise on every page.
 *
 * When NOT indexable we use `index: false, follow: true` — "keep this page out of
 * search results, but still crawl its links". We still want Google discovering
 * deeper pages through it; we just don't want this URL itself in the index, because
 * it 404s for most of the world.
 */
function buildRobots(indexable: boolean): Metadata['robots'] {
  return indexable ? undefined : { index: false, follow: true };
}

/**
 * Build a meta description for a page.
 *
 * Preference order:
 *   1. The page's ACTUAL rich-text prose, if it has any. This is the only place on
 *      the site with real written content, so it makes a genuinely useful search
 *      snippet instead of a generated sentence.
 *   2. A template shaped by `contentType`, so a table page and a listing page don't
 *      describe themselves identically.
 *
 * `page.richTextContent.htmlContent` is already loaded — `pageWithContentSelect` in
 * src/services/page.service.ts selects it — so reading it here costs nothing.
 *
 * ⚠️ Honest limitation: templated descriptions are near-duplicates across pages,
 * varying only by title. Google largely ignores meta description for RANKING (it's a
 * snippet hint, and Google often writes its own from page content anyway), so this is
 * acceptable. It is not a substitute for real written intros on category pages —
 * that's product work, noted at the end of finding #14.
 */
function buildPageDescription(
  page: { contentType: string; richTextContent?: { htmlContent: string } | null },
  pageTitle: string,
  domainName: string
): string {
  // 1. Real prose, if this page has any.
  const html = page.richTextContent?.htmlContent;
  if (html) {
    const text = htmlToText(html);
    // Guard against a page that exists but is effectively empty ('<p></p>', or a
    // couple of stray words) — a two-word description is worse than a template.
    if (text.length >= 40) {
      return truncate(text);
    }
  }

  // 2. Fall back to a contentType-aware template.
  switch (page.contentType) {
    case 'table':
      return truncate(
        `${pageTitle} in ${domainName} - a curated, comparable list of options on ATNO.`
      );
    /*
      ⚠️ A ROADMAP'S OWN `description` IS BETTER THAN THIS TEMPLATE AND IS NOT READ HERE YET.
      `Roadmap.description` is a one-line intro written by the author — real prose, exactly the
      kind of thing branch 1 above prefers over a template. Wiring it up needs the relation
      added to `pageWithContentSelect` in page.service.ts, which is L-8's job. Until then a
      roadmap gets this template, which is correct but generic.
    */
    case 'roadmap':
      return truncate(
        `A step-by-step ${pageTitle} roadmap for ${domainName} - what to learn, in order, on ATNO.`
      );
    case 'section_based':
    case 'subcategory_list':
      return truncate(
        `Browse ${pageTitle} in ${domainName}. Hand-picked tools, resources and channels, organised by category on ATNO.`
      );
    default:
      return truncate(
        `${pageTitle} in ${domainName}. Hand-picked resources and recommendations on ATNO.`
      );
  }
}

// ============================================
// Main Page Component
// ============================================

export default async function DomainPage({ params }: Props) {
  const awaitedParams = await params;
  const [domainSlug, ...restSlug] = awaitedParams.slug;

  // Get user's country from cookies
  const userCountry = await getUserCountryFromCookies();

  // Find domain with its top-level pages
  const domain = await DomainService.getWithPages(domainSlug);

  if (!domain) return notFound();

  // Check if domain is visible to user's country
  if (!isContentVisibleToUser(domain.targetCountries, userCountry)) {
    return notFound();
  }

  /**
   * ⚠️ THIS GATE DID NOT EXIST. It is a real fix, not a refactor of the status change.
   * ==========================================================================
   *
   * Until now this route checked exactly two things — does the domain exist, and is it
   * targeted at the visitor's country. It never looked at publication at all, and
   * `DomainService.exists()`, the one function that would have, is called by nothing.
   *
   * So publication controlled **listing, not access**: a domain absent from `/domain` was
   * still fully readable by anyone who knew its slug.
   *
   * Confirmed by experiment rather than by reading, since a code path alone could not
   * distinguish "gated" from "happened to fail". Two throwaway domains, identical but for
   * publication, both with no pages: **both returned 404** — the 404 came from having no
   * pages, not from the status. The unpublished one's full record (id, name, slug) also
   * appeared in the RSC flight payload of that 404 response.
   *
   * Nothing was exposed in practice, because all 37 domains were published. But DRAFT and
   * UPCOMING domains are the first records that will ever depend on this, and adding the gate
   * while nothing is unpublished means it can be verified to change nothing today.
   *
   * ⚠️ `!== 'PUBLISHED'` rather than listing the two hidden states. A future `ARCHIVED` then
   * defaults to hidden, which is the safe direction to be wrong in.
   */
  if (domain.status !== 'PUBLISHED') {
    return notFound();
  }

  // Transform domain for component compatibility
  // Components expect pages with content/subPages, but service returns PageBasic
  const domainForComponents = {
    ...domain,
    pages: domain.pages.map(p => ({
      ...p,
      content: [],
      subPages: [],
    })),
  };

  /**
   * The URL path this render corresponds to. Rebuilt from `params` rather than read
   * from `headers()`, because reading headers would be a second reason for this route
   * to be dynamic — and `cookies()` is already one too many (see #8-DR).
   */
  const contextPath = `/domain/${awaitedParams.slug.join('/')}`;

  /**
   * BreadcrumbList structured data.
   * ==========================================================================
   * Puts a readable hierarchy into search results in place of the raw URL:
   *
   *   before:  https://atno.io/domain/webdev/nocode/websitebuilders
   *   after:   ATNO › Domains › Web Development › Website Builders (CMS)
   *
   * ⚠️ THIS RE-ENABLES THE BREADCRUMB QUERIES #7 JUST TURNED OFF — but deliberately,
   * and in a different place. #7 removed them from `/api/page-context`, which the
   * client hits on EVERY page load and which discarded the result. Here the data is
   * actually used, and it runs on the page render instead. `getBreadcrumbData` is
   * `cache()`-wrapped, so it executes once per request no matter how many times it is
   * called.
   *
   * ⚠️ Correct labels depend on the parent-chain fix in `buildBreadcrumbData`. Before
   * it, 20 of 1,163 paths resolved to a DIFFERENT page's title — `websitebuilders`
   * reported "AI Website Builders" for a page actually called
   * "Website Builders (CMS)". Feeding that to Google would have been worse than
   * emitting nothing, which is why the fix landed first.
   */
  const breadcrumb = await NavigationService.getBreadcrumbData(contextPath, userCountry);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(breadcrumb.items);

  /**
   * The page body is assigned to a variable rather than returned from each branch.
   *
   * WHY: this component previously had six separate `return` statements. Wrapping every
   * one of them in a fragment alongside `<JsonLd>` would mean six chances to forget
   * one — and a missing block is invisible, since nothing renders and no error occurs.
   * One assignment plus one return makes it structural.
   */
  let content: React.ReactNode;

  // Top-level domain access (e.g., /domain/gdesign)
  if (restSlug.length === 0) {
    if (domain.pageType === 'direct') {
      /**
       * Direct domains: show the `__main__` page with its sections.
       *
       * ⚠️ THIS IS A READ. IT MUST STAY A READ. (finding #11)
       *
       * This line used to call `PageService.getOrCreateMainPage(...)`, which did a
       * `findFirst` and then CREATED the `__main__` row if it was missing. That meant a
       * plain `GET` from an anonymous visitor could write to the database. Three problems
       * with that:
       *
       *   1. This route is `force-dynamic`, so it ran on EVERY visit to a direct
       *      domain's root — including every Googlebot crawl. A read request must never
       *      mutate data.
       *
       *   2. `findFirst`-then-`create` is not atomic, and there is no unique constraint
       *      on `Page` for this (only a NON-unique `Page_domainId_parentId_slug_idx`).
       *      Two concurrent first-hits could both pass the check and both insert, leaving
       *      the domain with two competing root pages.
       *
       *   3. It hid a broken invariant. If `__main__` ever went missing the public site
       *      silently repaired itself and nobody found out.
       *
       * SO WHO CREATES `__main__` NOW? The two admin write paths that can produce a
       * `direct` domain, both of which check before inserting:
       *   - `POST /api/admin/domains`           — domain created as `direct`
       *   - `PUT  /api/admin/domains/[id]`      — `hierarchical → direct` switch (:196)
       * plus `POST /api/admin/pages` (:171), which self-heals a missing `__main__` — and
       * that one is fine, because it is already a write request.
       *
       * WAS IT SAFE TO REMOVE THE SAFETY NET? Checked against real data first: all 32
       * `direct` domains have a `__main__` row, 0 have duplicates, and 0 `hierarchical`
       * domains have a stray one. The create branch had never fired.
       *
       * BONUS: `getOrCreateMainPage` was a plain `async` function — deliberately
       * uncached, because it could write. `getMainPage` wraps `unstable_cache`, so these
       * 32 domain roots now hit the Data Cache instead of the database on every view.
       */
      const mainPage = await PageService.getMainPage(domain.id);

      /**
       * A `direct` domain with no `__main__` page has no root content to render, so 404
       * is the honest answer — there is genuinely nothing there.
       *
       * The `console.error` is the point of this branch: it turns a silent
       * self-repairing write into a visible signal in the Vercel logs, naming the exact
       * domain so it can be fixed in the admin UI. Per the audit above this should never
       * fire; if it does, the invariant broke and we want to know.
       */
      if (!mainPage) {
        console.error(
          `[#11] direct domain "${domain.slug}" (${domain.id}) has no __main__ page — ` +
            `its root will 404. Re-save the domain in admin to recreate it.`
        );
        return notFound();
      }

      /*
        Two queries in parallel: the published children that fill the sections, and the upcoming
        ones that fill the block beneath them. They are separate queries rather than one filtered
        two ways because `getChildPages` is PUBLISHED-only by design — the upcoming rows are not
        in its result and could not be recovered from it.
      */
      const [childPages, upcomingChildPages] = await Promise.all([
        PageService.getChildPages(domain.id, mainPage.id, userCountry),
        PageService.getUpcomingChildPages(domain.id, mainPage.id, userCountry),
      ]);

      content = (
        <SectionBasedLayout
          domain={domain}
          page={mainPage}
          childPages={childPages}
          upcomingChildPages={upcomingChildPages}
          currentPath={`/domain/${domain.slug}`}
        />
      );
    } else {
      // Hierarchical domains: show subcategory selection
      content = <SubcategorySelector domain={domainForComponents} />;
    }
  } else {
    // Nested page access (e.g., /domain/webdev/courses)
    const page = await PageService.getByPath(
      domain.id,
      restSlug,
      domain.pageType as 'direct' | 'hierarchical',
      userCountry
    );

    if (!page) return notFound();

    // Transform page for component compatibility
    const pageForComponents = {
      ...page,
      subPages: page.subPages.map(sp => ({
        ...sp,
        content: [],
        subPages: [],
      })),
    };

    // Render based on content type
    switch (page.contentType) {
      case 'section_based': {
        // Same pair as the domain-root branch above — a section-based page nested deeper gets
        // the identical treatment, so the block appears wherever sections do.
        const [childPages, upcomingChildPages] = await Promise.all([
          PageService.getChildPages(domain.id, page.id, userCountry),
          PageService.getUpcomingChildPages(domain.id, page.id, userCountry),
        ]);
        content = (
          <SectionBasedLayout
            page={page}
            domain={domain}
            childPages={childPages}
            upcomingChildPages={upcomingChildPages}
            currentPath={`/domain/${domain.slug}/${restSlug.join('/')}`}
          />
        );
        break;
      }
      case 'subcategory_list':
        content = <SubcategorySelector domain={domainForComponents} page={pageForComponents} />;
        break;
      case 'table':
        content = <TableLayout page={page} domain={domain} />;
        break;
      case 'rich_text':
        content = <RichTextLayout page={page} domain={domain} />;
        break;
      default:
        content = <NarrativeLayout page={page} domain={domain} />;
        break;
    }
  }

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      {content}
    </>
  );
}
