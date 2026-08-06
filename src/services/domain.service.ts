/**
 * Domain Service
 * 
 * All database operations related to domains.
 * Uses:
 * - React's cache() for request-level deduplication
 * - unstable_cache for cross-request caching (persists across requests)
 */

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { buildCountryFilter } from '@/lib/server-country';
import { CACHE_DURATIONS, CACHE_TAGS } from '@/lib/cache';
import type { DomainWithCategory, DomainWithPages, DomainBasic } from './types';

// ============================================
// Cached Database Functions
// ============================================

/**
 * Get all published domains - CACHED across requests
 *
 * ⚠️ `status: 'PUBLISHED'` replaces `isPublished: true` here and in every other read below.
 * With three states, "not draft" is no longer the same question as "published" — an UPCOMING
 * domain must be excluded from this list, because it is rendered in its own section at the
 * foot of the page rather than inside the category grid.
 */
const getAllDomainsFromDB = unstable_cache(
  async (userCountry: string): Promise<DomainWithCategory[]> => {
    const domains = await prisma.domain.findMany({
      where: {
        status: 'PUBLISHED',
        ...buildCountryFilter(userCountry),
      },
      include: {
        category: true,
      },
      orderBy: [
        { category: { columnPosition: 'asc' } },
        { category: { categoryOrder: 'asc' } },
        { orderInCategory: 'asc' },
      ],
    });

    return domains as DomainWithCategory[];
  },
  ['domains-all'],
  { 
    revalidate: CACHE_DURATIONS.MEDIUM,
    tags: [CACHE_TAGS.DOMAINS],
  }
);

/**
 * Get domain by slug - CACHED across requests
 */
const getDomainBySlugFromDB = unstable_cache(
  async (slug: string): Promise<DomainBasic | null> => {
    const domain = await prisma.domain.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        pageType: true,
        // Both, because `DomainBasic` still declares `isPublished` for this release. A `select`
        // that omitted it would not satisfy the type.
        status: true,
        isPublished: true,
        targetCountries: true,
        orderInCategory: true,
        categoryId: true,
      },
    });

    return domain as DomainBasic | null;
  },
  ['domain-by-slug'],
  {
    revalidate: CACHE_DURATIONS.MEDIUM,
    tags: [CACHE_TAGS.DOMAINS],
  }
);

/**
 * Get domain with pages - CACHED across requests
 */
const getDomainWithPagesFromDB = unstable_cache(
  async (slug: string): Promise<DomainWithPages | null> => {
    const domain = await prisma.domain.findUnique({
      where: { slug },
      include: {
        category: true,
        pages: {
          where: { parentId: null },
          include: {
            content: { orderBy: { order: 'asc' } },
            subPages: { orderBy: { order: 'asc' } },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    return domain as DomainWithPages | null;
  },
  ['domain-with-pages'],
  {
    revalidate: CACHE_DURATIONS.MEDIUM,
    tags: [CACHE_TAGS.DOMAINS, CACHE_TAGS.PAGES],
  }
);

/**
 * Get domains for navigation - CACHED across requests
 */
const getDomainsForNavigationFromDB = unstable_cache(
  async (userCountry: string) => {
    const domains = await prisma.domain.findMany({
      where: {
        /*
          ⚠️ PUBLISHED only — UPCOMING domains are deliberately absent from the sidebar.

          The sidebar is navigation, and an upcoming domain has nowhere to navigate to: its
          page 404s by design. An entry that looks like a link and goes nowhere is the
          dead-control pattern removed four times in Phase G.
        */
        status: 'PUBLISHED',
        ...buildCountryFilter(userCountry),
      },
      include: {
        category: true,
        pages: {
          where: buildCountryFilter(userCountry),
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
        },
      },
      orderBy: [
        { category: { columnPosition: 'asc' } },
        { category: { categoryOrder: 'asc' } },
        { orderInCategory: 'asc' },
      ],
    });

    return domains;
  },
  ['domains-navigation'],
  {
    revalidate: CACHE_DURATIONS.MEDIUM,
    tags: [CACHE_TAGS.DOMAINS, CACHE_TAGS.NAVIGATION],
  }
);

/**
 * Get all UPCOMING domains - CACHED across requests
 *
 * Mirrors `getAllDomainsFromDB` in every respect except the status, deliberately: same country
 * filter, same ordering keys. The two lists are two slices of one shelf, and they should not
 * drift apart in how they sort or who can see them.
 *
 * ⚠️ Shares the `DOMAINS` cache tag, so publishing a domain — which moves it out of this list
 * and into the other — invalidates both at once. A separate tag would let the two lists
 * disagree for up to the cache duration, briefly showing a domain in both places or neither.
 */
const getUpcomingDomainsFromDB = unstable_cache(
  async (userCountry: string): Promise<DomainWithCategory[]> => {
    const domains = await prisma.domain.findMany({
      where: {
        status: 'UPCOMING',
        ...buildCountryFilter(userCountry),
      },
      include: {
        category: true,
      },
      orderBy: [
        { category: { columnPosition: 'asc' } },
        { category: { categoryOrder: 'asc' } },
        { orderInCategory: 'asc' },
      ],
    });

    return domains as DomainWithCategory[];
  },
  ['domains-upcoming'],
  {
    revalidate: CACHE_DURATIONS.MEDIUM,
    tags: [CACHE_TAGS.DOMAINS],
  }
);

// ============================================
// Service API (with request-level deduplication)
// ============================================

export const DomainService = {
  /**
   * Get all published domains with their categories
   * Filtered by user's country for geo-targeting
   */
  getAll: cache(async (userCountry: string): Promise<DomainWithCategory[]> => {
    return getAllDomainsFromDB(userCountry);
  }),

  /**
   * Get a single domain by slug (without pages)
   */
  getBySlug: cache(async (slug: string): Promise<DomainBasic | null> => {
    return getDomainBySlugFromDB(slug);
  }),

  /**
   * Get a domain with its top-level pages
   */
  getWithPages: cache(async (slug: string): Promise<DomainWithPages | null> => {
    return getDomainWithPagesFromDB(slug);
  }),

  /**
   * Get domain with pages filtered by user's country
   */
  getWithPagesFiltered: cache(async (slug: string, userCountry: string): Promise<DomainWithPages | null> => {
    // This one doesn't use unstable_cache because country filter changes the query significantly
    const domain = await prisma.domain.findUnique({
      where: { slug },
      include: {
        category: true,
        pages: {
          where: {
            parentId: null,
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
          orderBy: { order: 'asc' },
        },
      },
    });

    return domain as DomainWithPages | null;
  }),

  /**
   * Is there a domain at this slug that the public may actually reach?
   *
   * ⚠️ THIS FUNCTION IS NOT CALLED BY ANYTHING. Verified by grep across `src/`. It is the only
   * place in the codebase that ever asked "is this domain publicly visible?", and the public
   * route never used it — which is exactly why unpublished domains were never gated (see
   * NEW-IMPROVEMENTS.md §24.2). The gate now lives in `domain/[...slug]/page.tsx` where the
   * decision is actually made.
   *
   * Updated to `status` rather than deleted: leaving it reading the superseded boolean would
   * mean an unused function that is also *wrong*, waiting to be picked up by someone who
   * reasonably assumes it works.
   */
  exists: cache(async (slug: string): Promise<boolean> => {
    const domain = await getDomainBySlugFromDB(slug);
    return domain?.status === 'PUBLISHED';
  }),

  /**
   * Domains marked UPCOMING, for the section at the foot of `/domain`.
   *
   * ⚠️ Country-filtered exactly like the published list. A domain hidden from a visitor's
   * country must not reappear here — otherwise "upcoming" would become a way to leak the
   * existence of geo-restricted content.
   *
   * Ordered by the same category column/row/position keys as the main index, so the ordering
   * you set in the admin governs this section too rather than it coming out arbitrary.
   */
  getUpcoming: cache(async (userCountry: string): Promise<DomainWithCategory[]> => {
    return getUpcomingDomainsFromDB(userCountry);
  }),

  /**
   * Get all domains for sidebar/navigation (minimal data)
   */
  getAllForNavigation: cache(async (userCountry: string) => {
    return getDomainsForNavigationFromDB(userCountry);
  }),
};
