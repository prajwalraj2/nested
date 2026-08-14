// src/app/api/page-context/route.ts

/**
 * Unified Page Context API
 * 
 * GET /api/page-context?path=/domain/gdesign/ytube
 * 
 * Returns ALL navigation data in a single request:
 * - Header data (domains grouped by category for dropdown)
 * - Sidebar data (domains with pages for navigation)
 * - Page sidebar data (pages organized by sections)
 * - Breadcrumb data (navigation trail)
 * 
 * Includes HTTP caching for optimal performance:
 * - CDN caches for 60 seconds (s-maxage)
 * - Stale content served while revalidating for up to 5 minutes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserCountryFromRequest } from '@/lib/server-country';
import { NavigationService } from '@/services';
import { getCacheHeaders, CACHE_DURATIONS } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path') || '/';

    // Get user's country from cookie
    const userCountry = getUserCountryFromRequest(request);

    // Use NavigationService to get ALL context data in ONE call
    const pageContext = await NavigationService.getPageContext(path, userCountry);

    // Return with cache headers for CDN/browser caching
    // Note: Content varies by country, so we include Vary header
    return NextResponse.json(
      {
        success: true,
        ...pageContext,
      },
      {
        headers: {
          ...getCacheHeaders(0, CACHE_DURATIONS.MEDIUM, CACHE_DURATIONS.LONG),
          'Vary': 'Cookie', // Cache varies by user-country cookie
        },
      }
    );

  } catch (error) {
    console.error('Error fetching page context:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch page context' 
      },
      { status: 500 }
    );
  }
}
