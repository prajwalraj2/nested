/**
 * Category Service
 * 
 * All database operations related to domain categories.
 * Uses:
 * - React's cache() for request-level deduplication
 * - unstable_cache for cross-request caching (persists across requests)
 */

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { CACHE_DURATIONS, CACHE_TAGS } from '@/lib/cache';
import type { CategoryFull } from './types';

// ============================================
// Cached Database Functions
// ============================================

/**
 * Get all active categories - CACHED across requests
 * Categories rarely change, so we use a longer cache duration
 */
const getActiveCategoriesFromDB = unstable_cache(
  async (): Promise<CategoryFull[]> => {
    const categories = await prisma.domainCategory.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        { columnPosition: 'asc' },
        { categoryOrder: 'asc' },
      ],
    });

    return categories as CategoryFull[];
  },
  ['categories-active'],
  {
    revalidate: CACHE_DURATIONS.LONG, // 5 minutes - categories rarely change
    tags: [CACHE_TAGS.CATEGORIES],
  }
);

/**
 * Get category by slug - CACHED across requests
 */
const getCategoryBySlugFromDB = unstable_cache(
  async (slug: string): Promise<CategoryFull | null> => {
    const category = await prisma.domainCategory.findUnique({
      where: { slug },
    });

    return category as CategoryFull | null;
  },
  ['category-by-slug'],
  {
    revalidate: CACHE_DURATIONS.LONG,
    tags: [CACHE_TAGS.CATEGORIES],
  }
);

/**
 * Get category by ID - CACHED across requests
 */
const getCategoryByIdFromDB = unstable_cache(
  async (id: string): Promise<CategoryFull | null> => {
    const category = await prisma.domainCategory.findUnique({
      where: { id },
    });

    return category as CategoryFull | null;
  },
  ['category-by-id'],
  {
    revalidate: CACHE_DURATIONS.LONG,
    tags: [CACHE_TAGS.CATEGORIES],
  }
);

// ============================================
// Service API (with request-level deduplication)
// ============================================

export const CategoryService = {
  /**
   * Get all active categories ordered by column and position
   */
  getActive: cache(async (): Promise<CategoryFull[]> => {
    return getActiveCategoriesFromDB();
  }),

  /**
   * Get a single category by slug
   */
  getBySlug: cache(async (slug: string): Promise<CategoryFull | null> => {
    return getCategoryBySlugFromDB(slug);
  }),

  /**
   * Get a single category by ID
   */
  getById: cache(async (id: string): Promise<CategoryFull | null> => {
    return getCategoryByIdFromDB(id);
  }),
};
