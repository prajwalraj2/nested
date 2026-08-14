/**
 * Cache Test API Endpoint
 * 
 * GET /api/debug/cache-test
 * 
 * Tests the caching system by measuring response times.
 * Use this to verify caching is working correctly.
 * 
 * ⚠️ Remove this in production or protect with authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { DomainService, CategoryService, NavigationService } from '@/services';
import { getCacheHeaders, CACHE_DURATIONS } from '@/lib/cache';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testType = searchParams.get('test') || 'all';
  const userCountry = searchParams.get('country') || 'ALL';
  
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    testType,
    userCountry,
    tests: {},
  };

  // Test 1: Domain Service (cached)
  if (testType === 'all' || testType === 'domains') {
    const start = performance.now();
    const domains = await DomainService.getAll(userCountry);
    const duration = Math.round(performance.now() - start);
    
    results.tests.domains = {
      duration: `${duration}ms`,
      count: domains.length,
      cached: duration < 50 ? 'likely cached ✅' : 'likely fresh query',
    };
  }

  // Test 2: Category Service (cached with longer duration)
  if (testType === 'all' || testType === 'categories') {
    const start = performance.now();
    const categories = await CategoryService.getActive();
    const duration = Math.round(performance.now() - start);
    
    results.tests.categories = {
      duration: `${duration}ms`,
      count: categories.length,
      cached: duration < 30 ? 'likely cached ✅' : 'likely fresh query',
    };
  }

  // Test 3: Full Page Context (tests all services together)
  if (testType === 'all' || testType === 'context') {
    const start = performance.now();
    const context = await NavigationService.getPageContext('/domain/webdev', userCountry);
    const duration = Math.round(performance.now() - start);
    
    results.tests.pageContext = {
      duration: `${duration}ms`,
      hasSidebar: context.sidebar?.domains?.length > 0,
      hasHeader: context.header?.totalDomains > 0,
      cached: duration < 100 ? 'likely cached ✅' : 'likely fresh query',
    };
  }

  // Test 4: Run same query twice to show caching effect
  if (testType === 'compare') {
    // First call (may or may not be cached)
    const start1 = performance.now();
    await DomainService.getAll(userCountry);
    const duration1 = Math.round(performance.now() - start1);

    // Second call (should be faster due to React cache())
    const start2 = performance.now();
    await DomainService.getAll(userCountry);
    const duration2 = Math.round(performance.now() - start2);

    results.tests.comparison = {
      firstCall: `${duration1}ms`,
      secondCall: `${duration2}ms`,
      improvement: duration1 > 0 ? `${Math.round((1 - duration2/duration1) * 100)}% faster` : 'N/A',
      explanation: 'Second call uses React cache() for request-level deduplication',
    };
  }

  // Add cache configuration info
  results.cacheConfig = {
    shortDuration: `${CACHE_DURATIONS.SHORT}s`,
    mediumDuration: `${CACHE_DURATIONS.MEDIUM}s`,
    longDuration: `${CACHE_DURATIONS.LONG}s`,
    staticDuration: `${CACHE_DURATIONS.STATIC}s`,
  };

  results.tips = [
    '⚡ Response times < 50ms usually indicate cached data',
    '🔄 unstable_cache persists across requests (production)',
    '🔧 React cache() deduplicates within single request',
    '🌐 HTTP headers enable CDN/browser caching',
    '📊 For accurate results, run in production mode: npm run build && npm start',
  ];

  return NextResponse.json(results, {
    headers: getCacheHeaders(0, CACHE_DURATIONS.SHORT, CACHE_DURATIONS.MEDIUM),
  });
}


