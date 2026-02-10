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
 */
const getAllDomainsFromDB = unstable_cache(
  async (userCountry: string): Promise<DomainWithCategory[]> => {
    const domains = await prisma.domain.findMany({
      where: {
        isPublished: true,
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
        isPublished: true,
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
   * Check if a domain exists and is published
   */
  exists: cache(async (slug: string): Promise<boolean> => {
    const domain = await getDomainBySlugFromDB(slug);
    return domain?.isPublished ?? false;
  }),

  /**
   * Get all domains for sidebar/navigation (minimal data)
   */
  getAllForNavigation: cache(async (userCountry: string) => {
    return getDomainsForNavigationFromDB(userCountry);
  }),
};
