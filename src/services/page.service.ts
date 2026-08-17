/**
 * Page Service
 * 
 * All database operations related to pages.
 * Includes optimized queries to avoid N+1 problems.
 * Uses:
 * - React's cache() for request-level deduplication
 * - unstable_cache for cross-request caching (for frequently accessed data)
 */

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { buildCountryFilter } from '@/lib/server-country';
import { CACHE_DURATIONS, CACHE_TAGS } from '@/lib/cache';
import type { PageWithContent, PageBasic, ChildPage } from './types';

// Standard select for page with content
const pageWithContentSelect = {
  id: true,
  title: true,
  icon: true,
  slug: true,
  contentType: true,
  sections: true,
  parentId: true,
  domainId: true,
  order: true,
  targetCountries: true,
  content: {
    select: { id: true, type: true, content: true, order: true },
    orderBy: { order: 'asc' as const },
  },
  subPages: {
    select: { id: true, title: true, slug: true, contentType: true, parentId: true, icon: true },
    orderBy: { order: 'asc' as const },
  },
  richTextContent: {
    select: {
      id: true,
      htmlContent: true,
      // ⚠️ NO `icon` here — `RichTextContent` has no such column. Only Domain and Page do.
      // A sweep that adds a field everywhere `title` appears will over-reach into models that
      // merely happen to share the field name.
      title: true,
      wordCount: true,
      updatedAt: true,
    },
  },
  /**
   * Roadmap content (Phase L). The whole tree, flat — `RoadmapLayout` nests it.
   *
   * ⚠️ `htmlContent` IS SELECTED FOR EVERY NODE, DELIBERATELY. It is what makes a roadmap the
   * first content type on this site whose body is **server-rendered and therefore indexable** —
   * finding #30 records that ~650 table pages return 200 with no table in the HTML at all,
   * because `TableLayout` fetches client-side. A roadmap ships its content in the first
   * response, and a `?topic=` deep link can render its Sheet already open.
   *
   * The cost is bounded: 30–60 nodes at a few KB each. If a roadmap ever grows past that,
   * dropping this one line and fetching a topic on demand is the fix — **no schema change**,
   * which is exactly why 33.3 kept the content on the node rather than in a fourth table.
   *
   * ⚠️ `parentId` first in the ordering is what lets the layout nest this in a single pass:
   * children of one parent arrive contiguously and already in display order.
   */
  roadmap: {
    select: {
      id: true,
      title: true,
      description: true,
      settings: true,
      updatedAt: true,
      nodes: {
        select: {
          id: true,
          parentId: true,
          title: true,
          slug: true,
          icon: true,
          order: true,
          // L-13 — the connector geometry. Read defensively in the renderer: these are plain
          // String columns, so the database cannot reject an unknown value.
          branchFrom: true,
          connector: true,
          recommended: true,
          badges: true,
          htmlContent: true,
        },
        orderBy: [{ parentId: 'asc' as const }, { order: 'asc' as const }],
      },
    },
  },
};

// ============================================
// Cached Database Functions
// ============================================

/**
 * Get __main__ page for a domain - CACHED across requests
 *
 * ⚠️ DELIBERATELY NOT FILTERED ON `status`, unlike every other read in this file.
 *
 * `__main__` IS the domain root for a direct domain — it is not a page anyone navigates to by
 * name, it is what `/domain/<slug>` renders. Its visibility is already governed one level up by
 * `Domain.status`, which H-1 made the route enforce, so a status on this row would be a second
 * switch for the same door.
 *
 * The asymmetry of harm decides it. `POST`/`PUT /api/admin/pages` refuses to set a non-published
 * status on a `__main__` page and `PageForm` hides the control, so the state is unreachable
 * through any supported path. If one appeared anyway — a direct database write — then:
 *
 *   • filtering here would 404 that domain's entire root, which is finding #11's failure mode;
 *   • not filtering renders a page that could not legitimately have been marked hidden.
 *
 * The second is plainly the better way to be wrong. If this ever changes, change the API guard
 * first, not this query.
 */
const getMainPageFromDB = unstable_cache(
  async (domainId: string): Promise<PageWithContent | null> => {
    const mainPage = await prisma.page.findFirst({
      where: {
        domainId,
        slug: '__main__',
      },
      select: pageWithContentSelect,
    });

    return mainPage as PageWithContent | null;
  },
  ['page-main'],
  {
    revalidate: CACHE_DURATIONS.MEDIUM,
    tags: [CACHE_TAGS.PAGES],
  }
);

/**
 * Get page by ID - CACHED across requests
 */
const getPageByIdFromDB = unstable_cache(
  async (pageId: string): Promise<PageWithContent | null> => {
    const page = await prisma.page.findUnique({
      where: { id: pageId },
      select: pageWithContentSelect,
    });

    return page as PageWithContent | null;
  },
  ['page-by-id'],
  {
    revalidate: CACHE_DURATIONS.MEDIUM,
    tags: [CACHE_TAGS.PAGES],
  }
);

// ============================================
// Service API
// ============================================

export const PageService = {
  /**
   * Get page by path - OPTIMIZED single query approach
   * Replaces the old N+1 loop pattern
   * 
   * Note: Not using unstable_cache here because:
   * 1. Path combinations are too numerous to cache efficiently
   * 2. Country filtering changes results
   * Request-level cache() is sufficient
   */
  getByPath: cache(async (
    domainId: string,
    slugPath: string[],
    domainType: 'direct' | 'hierarchical',
    userCountry: string
  ): Promise<PageWithContent | null> => {
    if (slugPath.length === 0) return null;

    // For direct domains, first find the __main__ page
    let firstParentId: string | null = null;
    
    if (domainType === 'direct') {
      const mainPage = await prisma.page.findFirst({
        where: {
          domainId,
          slug: '__main__',
        },
        select: { id: true },
      });
      
      if (!mainPage) return null;
      firstParentId = mainPage.id;
    }

    // OPTIMIZED: Fetch all pages in the path with a single query
    const allPagesInPath = await prisma.page.findMany({
      where: {
        domainId,
        slug: { in: slugPath },
        /*
          ⚠️ THIS ONE LINE ALSO HIDES THE WHOLE SUBTREE, AND THAT IS INTENDED.

          The traversal below walks segment by segment, each step looking for a child of the
          page found in the previous step. A non-published page is simply absent from this
          result set, so the walk stops there and returns null — which the route turns into a
          404. Every descendant becomes unreachable with it, because its URL runs through the
          missing parent.

          That is the correct behaviour: a child of a hidden page has no reachable address.
        */
        status: 'PUBLISHED',
        ...buildCountryFilter(userCountry),
      },
      select: {
        ...pageWithContentSelect,
      },
    });

    // Build the path from fetched pages
    let currentPage: PageWithContent | null = null;

    // Find the first page in the path
    if (domainType === 'direct') {
      currentPage = allPagesInPath.find(p => 
        p.slug === slugPath[0] && p.parentId === firstParentId
      ) as PageWithContent | null;
    } else {
      currentPage = allPagesInPath.find(p => 
        p.slug === slugPath[0] && p.parentId === null
      ) as PageWithContent | null;
    }

    // For deeper paths, traverse through the fetched pages
    for (let i = 1; i < slugPath.length && currentPage; i++) {
      const nextPage = allPagesInPath.find(p =>
        p.slug === slugPath[i] && p.parentId === currentPage?.id
      );
      currentPage = nextPage as PageWithContent | null;
    }

    // If we couldn't find the complete path in our batch, fall back to individual queries
    if (!currentPage && slugPath.length > 1) {
      return PageService.getByPathFallback(domainId, slugPath, domainType, userCountry, firstParentId);
    }

    return currentPage;
  }),

  /**
   * Fallback method for complex nested paths
   */
  getByPathFallback: async (
    domainId: string,
    slugPath: string[],
    domainType: 'direct' | 'hierarchical',
    userCountry: string,
    mainPageId: string | null
  ): Promise<PageWithContent | null> => {
    let currentPage: PageWithContent | null = null;

    // Same `status` gate as `getByPath` — this is the fallback for the same lookup, so the two
    // must agree. If only one filtered, a deep path would be reachable through whichever
    // branch happened to run.
    const firstPageWhere = domainType === 'direct'
      ? { slug: slugPath[0], domainId, parentId: mainPageId, status: 'PUBLISHED' as const, ...buildCountryFilter(userCountry) }
      : { slug: slugPath[0], domainId, parentId: null, status: 'PUBLISHED' as const, ...buildCountryFilter(userCountry) };

    currentPage = await prisma.page.findFirst({
      where: firstPageWhere,
      select: pageWithContentSelect,
    }) as PageWithContent | null;

    for (let i = 1; i < slugPath.length && currentPage; i++) {
      currentPage = await prisma.page.findFirst({
        where: {
          slug: slugPath[i],
          domainId,
          parentId: currentPage.id,
          // Each step of the walk is gated, not just the first — otherwise a published parent
          // would still hand out a drafted child.
          status: 'PUBLISHED',
          ...buildCountryFilter(userCountry),
        },
        select: pageWithContentSelect,
      }) as PageWithContent | null;
    }

    return currentPage;
  },

  /**
   * Get the `__main__` page for a direct domain. Returns `null` if it does not exist.
   *
   * ⚠️ READ-ONLY BY DESIGN — see finding #11.
   *
   * A sibling `getOrCreateMainPage(domainId, domainName)` used to live right here. It did
   * the same `findFirst`, then CREATED the row when it came back empty. Its only caller
   * was the public page renderer (`src/app/domain/[...slug]/page.tsx`), which means an
   * anonymous `GET` — including every crawl — could insert a row. It was removed rather
   * than kept "just in case", because an unused write helper is exactly the thing someone
   * reaches for later without noticing it mutates on read.
   *
   * `__main__` is now created only by admin write paths (`POST /api/admin/domains`,
   * the `hierarchical → direct` switch in `PUT /api/admin/domains/[id]`, and
   * `POST /api/admin/pages`), each of which checks for an existing row first. If you need
   * to create one, do it there — do not reintroduce a create-on-read path.
   *
   * DOUBLE CACHING IS INTENTIONAL, not an oversight:
   *   - `unstable_cache` (inside `getMainPageFromDB`) caches ACROSS requests and
   *     deployments in the Next.js Data Cache, invalidated by `revalidateTag`.
   *   - React `cache()` here dedupes WITHIN a single render — the layout and the page can
   *     both ask for the same domain's main page and only one lookup happens.
   * `domainId` is a string, so `cache()` keys on it correctly (it compares arguments by
   * identity, which would silently miss for an object or array argument).
   */
  getMainPage: cache(async (domainId: string): Promise<PageWithContent | null> => {
    return getMainPageFromDB(domainId);
  }),

  /**
   * Get child pages of a parent page
   */
  getChildPages: cache(async (
    domainId: string,
    parentId: string,
    userCountry: string
  ): Promise<ChildPage[]> => {
    const pages = await prisma.page.findMany({
      where: {
        domainId,
        parentId,
        /*
          Published children only. `SectionBasedLayout` resolves its `sections` JSON by looking
          each `pageId` up in this list and then calls `.filter(Boolean)` — so a page removed
          here simply disappears from its section rather than rendering a dead link or
          crashing on `undefined`. That `.filter(Boolean)` already existed; this change relies
          on it.

          UPCOMING children are fetched separately by `getUpcomingChildPages` for the
          "Upcoming Resources" block, so excluding them here does not lose them.
        */
        status: 'PUBLISHED',
        ...buildCountryFilter(userCountry),
      },
      select: {
        id: true,
        title: true,
        icon: true,
        slug: true,
        contentType: true,
        parentId: true,
      },
      orderBy: { order: 'asc' },
    });

    return pages as ChildPage[];
  }),

  /**
   * Child pages marked UPCOMING, for the "Upcoming Resources" block.
   *
   * Deliberately mirrors `getChildPages` in every respect except the status: same country
   * filter, same ordering, same select. The two lists are two slices of one shelf and must not
   * drift apart in who can see them or how they sort.
   *
   * ⚠️ The country filter is not optional. An upcoming page restricted to one country must stay
   * hidden from everyone else — otherwise "upcoming" would become a way to reveal the existence
   * of geo-restricted content that the published list takes care to hide.
   */
  getUpcomingChildPages: cache(async (
    domainId: string,
    parentId: string,
    userCountry: string
  ): Promise<ChildPage[]> => {
    const pages = await prisma.page.findMany({
      where: {
        domainId,
        parentId,
        status: 'UPCOMING',
        ...buildCountryFilter(userCountry),
      },
      select: {
        id: true,
        title: true,
        icon: true,
        slug: true,
        contentType: true,
        parentId: true,
      },
      orderBy: { order: 'asc' },
    });

    return pages as ChildPage[];
  }),

  /**
   * Get a single page by ID with full content
   */
  getById: cache(async (pageId: string): Promise<PageWithContent | null> => {
    return getPageByIdFromDB(pageId);
  }),

  /**
   * Get pages for a domain (for sidebar)
   */
  getByDomain: cache(async (domainId: string, userCountry: string): Promise<PageBasic[]> => {
    const pages = await prisma.page.findMany({
      where: {
        domainId,
        // Feeds the sidebar. A non-published page must not appear there — it would be a
        // navigation entry pointing at a 404.
        status: 'PUBLISHED',
        ...buildCountryFilter(userCountry),
      },
      select: {
        id: true,
        title: true,
        icon: true,
        slug: true,
        contentType: true,
        parentId: true,
        order: true,
        targetCountries: true,
      },
      orderBy: [
        { order: 'asc' },
        { title: 'asc' },
      ],
    });

    return pages as PageBasic[];
  }),

  /**
   * Get pages with sections configuration
   */
  getWithSections: cache(async (domainId: string, userCountry: string) => {
    const pages = await prisma.page.findMany({
      where: {
        domainId,
        // Same reasoning as `getByDomain` — this is public read data, not an admin query.
        status: 'PUBLISHED',
        ...buildCountryFilter(userCountry),
      },
      select: {
        id: true,
        title: true,
        icon: true,
        slug: true,
        contentType: true,
        parentId: true,
        order: true,
        sections: true,
        targetCountries: true,
      },
      orderBy: [
        { order: 'asc' },
        { title: 'asc' },
      ],
    });

    return pages;
  }),
};
