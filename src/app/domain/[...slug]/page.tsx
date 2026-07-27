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
import { DomainService, PageService } from '@/services';
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
        `${pageTitle} in ${domainName} — a curated, comparable list of options on ATNO.`
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

  // Top-level domain access (e.g., /domain/gdesign)
  if (restSlug.length === 0) {
    if (domain.pageType === 'direct') {
      // Direct domains: show main page with sections
      const mainPage = await PageService.getOrCreateMainPage(domain.id, domain.name);
      const childPages = await PageService.getChildPages(domain.id, mainPage.id, userCountry);
      
      return (
        <SectionBasedLayout 
          domain={domain} 
          page={mainPage} 
          childPages={childPages} 
          currentPath={`/domain/${domain.slug}`} 
        />
      );
    } else {
      // Hierarchical domains: show subcategory selection
      return <SubcategorySelector domain={domainForComponents} />;
    }
  }

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
      const childPages = await PageService.getChildPages(domain.id, page.id, userCountry);
      return (
        <SectionBasedLayout 
          page={page} 
          domain={domain} 
          childPages={childPages} 
          currentPath={`/domain/${domain.slug}/${restSlug.join('/')}`} 
        />
      );
    }
    case 'subcategory_list':
      return <SubcategorySelector domain={domainForComponents} page={pageForComponents} />;
    case 'table':
      return <TableLayout page={page} domain={domain} />;
    case 'rich_text':
      return <RichTextLayout page={page} domain={domain} />;
    default:
      return <NarrativeLayout page={page} domain={domain} />;
  }
}
