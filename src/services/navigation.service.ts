/**
 * Navigation Service
 * 
 * Combines domain, page, and category services to provide
 * all navigation data in a single call.
 * 
 * This service is the key to reducing multiple API calls to one.
 */

import { cache } from 'react';
import { DomainService } from './domain.service';
import { PageService } from './page.service';
import { CategoryService } from './category.service';
import type {
  PageContextData,
  HeaderData,
  SidebarData,
  SidebarDomain,
  PageSidebarData,
  PageSidebarSection,
  BreadcrumbItem,
  CategoryFull,
} from './types';

export const NavigationService = {
  /**
   * Get all navigation data for a page in ONE call
   * 
   * This replaces 4 separate API calls:
   * - /api/header-domains
   * - /api/sidebar
   * - /api/page-sidebar
   * - /api/breadcrumb
   * 
   * @param path - The current URL path (e.g., '/domain/gdesign/ytube')
   * @param userCountry - The user's country code
   */
  /**
   * @param includeBreadcrumb Defaults to **false** — see the block below.
   *
   * ⚠️ WHY THE BREADCRUMB IS OPT-IN AND OFF BY DEFAULT (#7)
   * ------------------------------------------------------
   * This function used to compute breadcrumb data unconditionally, and **every
   * consumer threw it away**:
   *
   *   - `src/hooks/usePageContext.ts` hardcodes
   *     `breadcrumb: { items: [], shouldCollapse: false, visibleItems: null }`
   *     in two places, with the comment "Breadcrumb is now client-derived"
   *   - `src/components/bread/bread.tsx` destructures
   *     `{ sidebar, pageSidebar, currentPage, loading }` — it never reads `breadcrumb`
   *
   * `bread.tsx` builds the trail from `usePathname()` plus sidebar data instead, which
   * is a genuine improvement: it renders instantly with no API round-trip. **That is
   * the breadcrumb you see on the site, and this change does not touch it.**
   *
   * The server-side version was therefore being queried, serialised, transmitted and
   * discarded on every single request to this endpoint — the hottest one on the site,
   * since every public page load fetches it to build the sidebar.
   *
   * Three database round-trips went with it (see `buildBreadcrumbData`), one of them
   * an uncached raw query. `includeBreadcrumb: false` removes all three.
   *
   * Kept as an option rather than deleted because `buildBreadcrumbData` is correct and
   * is the natural source for JSON-LD `BreadcrumbList` markup (#14 / SEO-B), which
   * would put breadcrumb trails into search results.
   */
  getPageContext: cache(async (
    path: string,
    userCountry: string,
    includeBreadcrumb = false
  ): Promise<PageContextData> => {
    // Parse the path
    const segments = path.split('/').filter(Boolean);
    const isDomainPath = segments[0] === 'domain';
    const domainSlug = isDomainPath && segments.length >= 2 ? segments[1] : null;
    const pageSegments = isDomainPath && segments.length >= 3 ? segments.slice(2) : [];

    // Fetch all base data in parallel
    const [domains, categories] = await Promise.all([
      DomainService.getAllForNavigation(userCountry),
      CategoryService.getActive(),
    ]);

    // Build header data
    const header = buildHeaderData(domains, categories);

    // Build sidebar data
    const sidebar = buildSidebarData(domains, categories);

    // Build page sidebar data (if on a specific page)
    let pageSidebar: PageSidebarData | null = null;
    if (domainSlug && pageSegments.length > 0) {
      const domain = domains.find(d => d.slug === domainSlug);
      if (domain) {
        pageSidebar = await buildPageSidebarData(domain, pageSegments[0], userCountry);
      }
    } else if (domainSlug) {
      const domain = domains.find(d => d.slug === domainSlug);
      if (domain && domain.pageType === 'direct') {
        pageSidebar = await buildPageSidebarData(domain, null, userCountry);
      }
    }

    /**
     * Build breadcrumb data — only when explicitly asked for.
     *
     * ⚠️ `pageSegments` is passed in rather than letting `buildBreadcrumbData` slice
     * `segments` itself, and that is not cosmetic. React's `cache()` keys on argument
     * **identity**, comparing object arguments by reference. Two `segments.slice(2)`
     * calls produce arrays with identical contents but different references, so
     * `PageService.getByPath(domainId, ['ytube'], …)` called from both places was
     * MISSING the cache and executing the same query twice — `['ytube'] !== ['ytube']`.
     *
     * Sharing the one array means that when the breadcrumb IS requested, its
     * `getByPath` call hits the memo from the `currentPage` lookup below instead of
     * re-querying.
     */
    const breadcrumb = includeBreadcrumb
      ? await buildBreadcrumbData(segments, userCountry, pageSegments)
      : { items: [] };

    // Get current page info if applicable
    let currentPage;
    if (domainSlug && pageSegments.length > 0) {
      const domain = domains.find(d => d.slug === domainSlug);
      if (domain) {
        const page = await PageService.getByPath(
          domain.id,
          pageSegments,
          domain.pageType as 'direct' | 'hierarchical',
          userCountry
        );
        if (page) {
          currentPage = {
            id: page.id,
            title: page.title,
            contentType: page.contentType,
          };
        }
      }
    }

    return {
      header,
      sidebar,
      pageSidebar,
      breadcrumb,
      currentPage,
    };
  }),

  /**
   * Get header data only
   */
  getHeaderData: cache(async (userCountry: string): Promise<HeaderData> => {
    const [domains, categories] = await Promise.all([
      DomainService.getAll(userCountry),
      CategoryService.getActive(),
    ]);

    return buildHeaderData(domains, categories);
  }),

  /**
   * Get sidebar data only
   */
  getSidebarData: cache(async (userCountry: string): Promise<SidebarData> => {
    const [domains, categories] = await Promise.all([
      DomainService.getAllForNavigation(userCountry),
      CategoryService.getActive(),
    ]);

    return buildSidebarData(domains, categories);
  }),

  /**
   * Get breadcrumb data for a path.
   *
   * ⚠️ CURRENTLY HAS NO CALLERS. It existed to serve `GET /api/breadcrumb`, which was
   * deleted in Phase C (#9) along with the other three deprecated navigation endpoints.
   *
   * Retained rather than deleted because it is the ready-made entry point for JSON-LD
   * `BreadcrumbList` markup (#14 / SEO-B) — a realistic win for a site this deeply
   * nested, since it can put the trail into search results instead of a bare URL.
   * Deleting it would just mean writing it again.
   *
   * Labels are resolved by walking the parent chain and are country-filtered, so they
   * are safe for user-facing and search-facing use — see the block comment inside
   * `buildBreadcrumbData` for why that mattered.
   */
  getBreadcrumbData: cache(async (path: string, userCountry: string) => {
    const segments = path.split('/').filter(Boolean);
    return buildBreadcrumbData(segments, userCountry);
  }),
};

// ============================================
// Helper Functions
// ============================================

/**
 * Build header data structure (domains grouped by category in 3 columns)
 */
function buildHeaderData(domains: any[], categories: CategoryFull[]): HeaderData {
  const columnData: HeaderData['columnData'] = { 1: [], 2: [], 3: [] };

  // Add all categories to their respective columns
  categories.forEach(category => {
    const categoryDomains = domains
      .filter(domain => domain.category?.id === category.id)
      .sort((a, b) => a.orderInCategory - b.orderInCategory);

    columnData[category.columnPosition].push({
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        icon: category.icon,
        description: category.description,
        columnPosition: category.columnPosition,
        categoryOrder: category.categoryOrder,
        isActive: category.isActive,
      },
      domains: categoryDomains.map(domain => ({
        id: domain.id,
        name: domain.name,
        slug: domain.slug,
        url: `/domain/${domain.slug}`,
      })),
    });
  });

  // Add uncategorized domains to column 1
  const uncategorizedDomains = domains.filter(domain => !domain.category);
  if (uncategorizedDomains.length > 0) {
    columnData[1].push({
      category: {
        id: 'uncategorized',
        name: 'Other Domains',
        slug: 'other',
        icon: '📂',
        description: 'Miscellaneous domains',
        columnPosition: 1,
        categoryOrder: 999,
        isActive: true,
      },
      domains: uncategorizedDomains.map(domain => ({
        id: domain.id,
        name: domain.name,
        slug: domain.slug,
        url: `/domain/${domain.slug}`,
      })),
    });
  }

  return {
    columnData,
    totalDomains: domains.length,
    totalCategories: categories.length,
  };
}

/**
 * Build sidebar data structure
 */
function buildSidebarData(domains: any[], categories: CategoryFull[]): SidebarData {
  const organizedDomains: SidebarDomain[] = [];

  // Add domains organized by category
  categories.forEach(category => {
    const categoryDomains = domains
      .filter(domain => domain.category?.id === category.id)
      .sort((a, b) => a.orderInCategory - b.orderInCategory);

    categoryDomains.forEach(domain => {
      organizedDomains.push({
        id: domain.id,
        name: domain.name,
        slug: domain.slug,
        pageType: domain.pageType,
        url: `/domain/${domain.slug}`,
        pages: buildRootPages(domain.pages, domain),
        categoryId: category.id,
        categoryOrder: category.categoryOrder,
        columnPosition: category.columnPosition,
      });
    });
  });

  // Add uncategorized domains
  const uncategorizedDomains = domains.filter(domain => !domain.category);
  uncategorizedDomains.forEach(domain => {
    organizedDomains.push({
      id: domain.id,
      name: domain.name,
      slug: domain.slug,
      pageType: domain.pageType,
      url: `/domain/${domain.slug}`,
      pages: buildRootPages(domain.pages, domain),
      categoryId: null,
      categoryOrder: 999,
      columnPosition: 999,
    });
  });

  return {
    domains: organizedDomains,
    categories,
  };
}

/**
 * Build root-level pages for sidebar
 */
function buildRootPages(pages: any[], domain: any) {
  const rootPages: any[] = [];

  // For hierarchical domains, show only root-level pages
  if (domain.pageType === 'hierarchical') {
    pages.forEach(page => {
      if (!page.parentId) {
        rootPages.push({
          id: page.id,
          title: page.title,
          slug: page.slug,
          contentType: page.contentType,
          parentId: page.parentId,
          order: page.order,
          url: `/domain/${domain.slug}/${page.slug}`,
        });
      }
    });
  }

  return rootPages;
}

/**
 * Build page sidebar data
 */
async function buildPageSidebarData(
  domain: any,
  pageSlug: string | null,
  userCountry: string
): Promise<PageSidebarData | null> {
  const pages = await PageService.getWithSections(domain.id, userCountry);

  if (domain.pageType === 'direct') {
    // For direct domains, find the main page with sections
    const mainPage = pages.find(page =>
      page.sections && Array.isArray(page.sections) && page.sections.length > 0
    );

    if (!mainPage) {
      // Fallback: return all pages as a single section
      return {
        type: 'direct_domain',
        domain: { name: domain.name, slug: domain.slug },
        sections: [{
          title: 'All Pages',
          column: 1,
          order: 1,
          pages: pages
            .filter(p => p.slug !== '__main__')
            .map(page => ({
              id: page.id,
              title: page.title,
              slug: page.slug,
              contentType: page.contentType,
              parentId: page.parentId,
              order: page.order || 0,
              url: `/domain/${domain.slug}/${page.slug}`,
              hasChildren: false,
              children: [],
            })),
        }],
      };
    }

    // Organize pages by sections
    const sections = organizePagesIntoSections(
      mainPage.sections as any[],
      pages,
      domain
    );

    return {
      type: 'direct_domain',
      domain: { name: domain.name, slug: domain.slug },
      sections,
    };
  } else {
    // For hierarchical domains with a specific page
    if (!pageSlug) return null;

    const page = pages.find(p => p.slug === pageSlug && !p.parentId);
    if (!page) return null;

    const childPages = pages.filter(p => p.parentId === page.id);
    const sections = organizePagesIntoSections(
      page.sections as any[] || [],
      childPages,
      domain,
      page
    );

    return {
      type: 'hierarchical_page',
      domain: { name: domain.name, slug: domain.slug },
      page: { name: page.title, slug: page.slug },
      sections,
    };
  }
}

/**
 * Organize pages into sections based on configuration
 */
function organizePagesIntoSections(
  sectionsConfig: any[],
  allPages: any[],
  domain: any,
  parentPage?: any
): PageSidebarSection[] {
  const baseUrl = parentPage
    ? `/domain/${domain.slug}/${parentPage.slug}`
    : `/domain/${domain.slug}`;

  if (!sectionsConfig || sectionsConfig.length === 0) {
    // Default section with all pages
    return [{
      title: 'Pages',
      column: 1,
      order: 1,
      pages: allPages
        .filter(p => p.slug !== '__main__')
        .map(page => ({
          id: page.id,
          title: page.title,
          slug: page.slug,
          contentType: page.contentType,
          parentId: page.parentId,
          order: page.order || 0,
          url: `${baseUrl}/${page.slug}`,
          hasChildren: false,
          children: [],
        })),
    }];
  }

  return sectionsConfig.map(section => ({
    title: section.title,
    column: section.column,
    order: section.order,
    pages: section.pageIds
      .map((pageId: string) => allPages.find(page => page.id === pageId))
      .filter(Boolean)
      .map((page: any) => ({
        id: page.id,
        title: page.title,
        slug: page.slug,
        contentType: page.contentType,
        parentId: page.parentId,
        order: page.order || 0,
        url: `${baseUrl}/${page.slug}`,
        hasChildren: page.contentType === 'subcategory_list',
        children: allPages
          .filter(child => child.parentId === page.id)
          .map(child => ({
            id: child.id,
            title: child.title,
            slug: child.slug,
            contentType: child.contentType,
            parentId: child.parentId,
            order: child.order || 0,
            url: `${baseUrl}/${page.slug}/${child.slug}`,
            hasChildren: false,
            children: [],
          })),
      })),
  }));
}

/**
 * Build breadcrumb data - OPTIMIZED (no N+1)
 */
async function buildBreadcrumbData(
  segments: string[],
  userCountry: string,
  /**
   * The already-sliced page segments, when the caller has them.
   *
   * ⚠️ Exists purely so the SAME array reference can be shared with the caller.
   * React `cache()` compares object arguments by reference, so slicing here as well
   * would create a second array with identical contents and cause
   * `PageService.getByPath` to miss the memo and re-run the query. Falls back to
   * slicing when not supplied, so `getBreadcrumbData` still works standalone.
   */
  sharedPageSegments?: string[]
): Promise<{ items: BreadcrumbItem[] }> {
  const items: BreadcrumbItem[] = [];

  // Always start with Domains
  if (segments[0] === 'domain') {
    items.push({
      label: 'Domains',
      url: '/domain',
      type: 'root',
    });
  }

  if (segments.length < 2) {
    return { items };
  }

  const domainSlug = segments[1];
  const domain = await DomainService.getBySlug(domainSlug);

  if (domain) {
    items.push({
      label: domain.name,
      url: `/domain/${domain.slug}`,
      type: 'domain',
    });

    // If we have page segments, fetch all pages in path with SINGLE query
    if (segments.length >= 3) {
      // Reuse the caller's array where possible — see `sharedPageSegments` above.
      const pageSegments = sharedPageSegments ?? segments.slice(2);

      // Build breadcrumb path
      let currentPath = `/domain/${domain.slug}`;

      /**
       * Resolve each segment's label by WALKING THE PARENT CHAIN.
       * ====================================================================
       *
       * ⚠️ THE BUG THIS REPLACES
       * The previous version fetched every page whose slug appeared anywhere in the
       * path and then matched by slug alone:
       *
       *     const pageData = allPagesInPath.find(p => p.slug === slug);
       *
       * Slugs are only unique *within a parent*, not within a domain. Measured against
       * real data: **83 (domain, slug) pairs have more than one page, covering 192
       * pages — 16.5% of the catalogue.** `/domain/appdev` alone has `ytube`,
       * `courses`, `podcasts`, `fonts`, `colors` and `networking` each appearing THREE
       * times under different parents.
       *
       * So `.find()` returned whichever row Postgres happened to hand back first, and
       * the label (and `contentType`) could come from a different branch of the tree.
       * In 20 of those 83 cases the titles genuinely differ — e.g. `facebookgroups`
       * exists as both "🐼 Facebook Groups" and "🍀 Facebook Groups" — so the wrong
       * one was a coin flip.
       *
       * It also ignored `targetCountries`, meaning a page invisible to this visitor
       * could still supply a label.
       *
       * ⚠️ HOW THE FIX WORKS — same query count, correct answer
       * Rather than trusting slugs, we reproduce the traversal that
       * `PageService.getByPath` performs: start at the domain's root and step down one
       * segment at a time, requiring each page to be a CHILD of the previous one.
       *
       * Two details make it a single query rather than one per level:
       *
       *   1. `__main__` is added to the slug list. For a `direct` domain, top-level
       *      pages have `parentId = <the __main__ page's id>` rather than null, so the
       *      walk needs that id — and fetching it in the same query avoids a second
       *      round-trip.
       *   2. The whole chain is resolved in memory from that one result set, exactly
       *      as `sitemap.ts` does for URL building. Walking with a query per level
       *      would be a textbook N+1 on paths up to 4 deep.
       *
       * `buildCountryFilter` is applied so a page the visitor cannot see never
       * contributes a label.
       */
      const { prisma } = await import('@/lib/prisma');
      const { buildCountryFilter } = await import('@/lib/server-country');

      const candidates = await prisma.page.findMany({
        where: {
          domainId: domain.id,
          // '__main__' is the synthetic root of a `direct` domain — see detail 1 above.
          slug: { in: [...pageSegments, '__main__'] },
          // Published only. These become breadcrumb labels, and a hidden page has no URL to
          // label — its own route 404s. `__main__` is unaffected: it is always PUBLISHED.
          status: 'PUBLISHED',
          ...buildCountryFilter(userCountry),
        },
        select: {
          id: true,
          title: true,
          slug: true,
          contentType: true,
          parentId: true,
        },
      });

      /**
       * Where the walk starts.
       *
       *   hierarchical → top-level pages have `parentId = null`
       *   direct       → top-level pages hang off the `__main__` page
       *
       * If a `direct` domain is missing its `__main__` row (finding #11 — the render
       * path used to create it lazily), `expectedParentId` stays undefined, the first
       * lookup fails, and every label degrades to the formatted slug. Ugly but not
       * broken, which is the right failure mode for a breadcrumb.
       */
      let expectedParentId: string | null | undefined =
        domain.pageType === 'direct'
          ? candidates.find(p => p.slug === '__main__')?.id
          : null;

      for (const slug of pageSegments) {
        currentPath += `/${slug}`;

        // The ONLY acceptable match: right slug AND correct parent. This is the line
        // that fixes the ambiguity — three pages named `ytube` in one domain now
        // resolve to exactly one.
        const pageData = expectedParentId === undefined
          ? undefined
          : candidates.find(p => p.slug === slug && p.parentId === expectedParentId);

        items.push({
          label: pageData?.title || formatSlugToTitle(slug),
          url: currentPath,
          type: 'page',
          contentType: pageData?.contentType,
        });

        // Step down. Once the chain breaks, `undefined` propagates and the remaining
        // segments fall back to formatted slugs rather than silently matching pages
        // from an unrelated branch.
        expectedParentId = pageData?.id;
      }
    }
  }

  return { items };
}

/**
 * Convert slug to readable title as fallback
 */
function formatSlugToTitle(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

