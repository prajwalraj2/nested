/**
 * Cache Configuration and Utilities
 * 
 * Centralized caching configuration for the application.
 * Uses Next.js unstable_cache for cross-request caching.
 */

import { unstable_cache } from 'next/cache';

// ============================================
// Cache Duration Constants (in seconds)
// ============================================

export const CACHE_DURATIONS = {
  /** Short-lived cache for frequently changing data */
  SHORT: 30,
  
  /** Medium cache for semi-static data */
  MEDIUM: 60,
  
  /** Long cache for rarely changing data */
  LONG: 300,
  
  /** Very long cache for static reference data */
  STATIC: 3600,
} as const;

// ============================================
// Cache Tags
// ============================================

export const CACHE_TAGS = {
  // Domain-related
  DOMAINS: 'domains',
  DOMAIN: (slug: string) => `domain:${slug}`,
  
  // Page-related
  PAGES: 'pages',
  PAGE: (id: string) => `page:${id}`,
  
  // Category-related
  CATEGORIES: 'categories',
  
  // Navigation-related
  NAVIGATION: 'navigation',
  HEADER: 'header',
  SIDEBAR: 'sidebar',
  BREADCRUMB: 'breadcrumb',
  
  // Table-related
  TABLES: 'tables',
  TABLE: (id: string) => `table:${id}`,
  
  // Country-specific
  COUNTRY: (code: string) => `country:${code}`,
} as const;

// ============================================
// Cache Key Generators
// ============================================

/**
 * Generate a cache key that includes country for geo-targeted content
 */
export function getCountryCacheKey(base: string, country: string): string {
  return `${base}:${country}`;
}

/**
 * Generate cache tags that include country
 */
export function getCountryTags(baseTags: string[], country: string): string[] {
  return [...baseTags, CACHE_TAGS.COUNTRY(country)];
}

// ============================================
// HTTP Cache Headers
// ============================================

/**
 * Get HTTP cache headers for API responses
 * 
 * @param maxAge - Browser cache duration (seconds)
 * @param sMaxAge - CDN cache duration (seconds)
 * @param staleWhileRevalidate - Serve stale while fetching fresh (seconds)
 */
export function getCacheHeaders(
  maxAge: number = 0,
  sMaxAge: number = CACHE_DURATIONS.MEDIUM,
  staleWhileRevalidate: number = CACHE_DURATIONS.LONG
): HeadersInit {
  return {
    'Cache-Control': `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
  };
}

/**
 * Get no-cache headers for dynamic/personalized content
 */
export function getNoCacheHeaders(): HeadersInit {
  return {
    'Cache-Control': 'private, no-cache, no-store, must-revalidate',
  };
}

// ============================================
// Typed Cache Wrapper
// ============================================

/**
 * Create a cached version of an async function with proper typing
 * 
 * @example
 * const getCachedDomains = createCachedFunction(
 *   async (country: string) => prisma.domain.findMany({...}),
 *   ['domains'],
 *   { revalidate: 60 }
 * );
 */
export function createCachedFunction<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyParts: string[],
  options: {
    revalidate?: number | false;
    tags?: string[];
  } = {}
): T {
  const { revalidate = CACHE_DURATIONS.MEDIUM, tags = [] } = options;
  
  return unstable_cache(
    fn,
    keyParts,
    { revalidate, tags }
  ) as T;
}


