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
    select: { id: true, title: true, slug: true, contentType: true, parentId: true },
    orderBy: { order: 'asc' as const },
  },
  richTextContent: {
    select: {
      id: true,
      htmlContent: true,
      title: true,
      wordCount: true,
      updatedAt: true,
    },
  },
};

// ============================================
// Cached Database Functions
// ============================================

/**
 * Get __main__ page for a domain - CACHED across requests
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

    const firstPageWhere = domainType === 'direct'
      ? { slug: slugPath[0], domainId, parentId: mainPageId, ...buildCountryFilter(userCountry) }
      : { slug: slugPath[0], domainId, parentId: null, ...buildCountryFilter(userCountry) };

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
        ...buildCountryFilter(userCountry),
      },
      select: {
        id: true,
        title: true,
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
        ...buildCountryFilter(userCountry),
      },
      select: {
        id: true,
        title: true,
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
        ...buildCountryFilter(userCountry),
      },
      select: {
        id: true,
        title: true,
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
