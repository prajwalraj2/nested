// src/app/api/page-context/route.ts

/**
 * Unified Page Context API
 *
 * GET /api/page-context?path=/domain/gdesign/ytube&country=IN
 *
 * Returns ALL navigation data in a single request:
 * - Header data (domains grouped by category for dropdown)
 * - Sidebar data (domains with pages for navigation)
 * - Page sidebar data (pages organized by sections)
 * - Breadcrumb data (navigation trail)
 *
 * ============================================================================
 * WHY THE COUNTRY IS IN THE URL AND NOT READ FROM THE COOKIE
 * ============================================================================
 * This route is the hottest endpoint on the site — every public page load fetches
 * it client-side to build the sidebar and header (src/hooks/usePageContext.ts).
 *
 * It was already asking Vercel's CDN to cache it for 60 seconds, but it also sent:
 *
 *     'Vary': 'Cookie'
 *
 * `Vary: Cookie` keys the cache on the ENTIRE Cookie header, not on the one cookie
 * we care about. A real visitor's header looks like:
 *
 *     Cookie: user-country=IN; authjs.session-token=eyJhbGciOiJkaXIi…; _ga=GA1.1.882471.17
 *
 * Session tokens and analytics IDs are unique per person, so every single visitor
 * produced a unique cache key. The CDN dutifully stored a private copy for each one
 * and **never reused a single entry** — the cache was correct and hit 0% of the time.
 * Every request still executed the function and queried Postgres.
 *
 * Moving the only meaningful variable into the URL fixes it:
 *
 *     /api/page-context?path=/domain&country=IN   <- one copy, shared by all IN visitors
 *     /api/page-context?path=/domain&country=US   <- one copy, shared by all US visitors
 *
 * Cache key space becomes (supported countries) × (paths) instead of one key per
 * human being.
 *
 * ⚠️ WHY IT IS SAFE FOR THE CLIENT TO NAME ITS OWN COUNTRY
 * `targetCountries` exists for RELEVANCE, not access control — see finding #15.
 * Nothing is protected by it. Someone hand-editing `?country=IN` just sees Indian
 * rows, which is not privilege escalation and not data they shouldn't have. If that
 * ever stops being true, this approach has to be revisited.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserCountryFromRequest } from '@/lib/server-country';
import { SUPPORTED_COUNTRIES, ALL_COUNTRIES, type SupportedCountry } from '@/lib/countries';
import { NavigationService } from '@/services';
import { getCacheHeaders, CACHE_DURATIONS } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path') || '/';

    // ------------------------------------------------------------------------
    // Resolve the country, and decide whether the answer is shareable
    // ------------------------------------------------------------------------
    const countryParam = searchParams.get('country')?.toUpperCase() ?? null;

    /**
     * Only an EXPLICIT, RECOGNISED country makes this response shareable.
     *
     * Two reasons the value is validated rather than trusted:
     *
     *   1. Cache-key explosion. Without a whitelist, `?country=<random>` mints a new
     *      CDN entry every time — an attacker could evict everything useful, and
     *      each miss costs a function invocation plus a database round trip.
     *   2. It keeps the key space knowable: at most 6 values × N paths.
     *
     * `ALL_COUNTRIES` is accepted too, since `buildCountryFilter('ALL')` is a valid
     * query meaning "globally-targeted content only".
     */
    const isRecognised =
      countryParam !== null &&
      (countryParam === ALL_COUNTRIES ||
        SUPPORTED_COUNTRIES.includes(countryParam as SupportedCountry));

    /**
     * ⚠️ THE IMPORTANT PART. `Vary: Cookie` is gone, so this response is no longer
     * keyed on the cookie in any way. If we let the country come from the cookie
     * while still sending shared-cache headers, the CDN would store ONE visitor's
     * answer and serve it to everyone — an Indian visitor's sidebar handed to
     * Americans. That is exactly the bug `Vary: Cookie` was protecting against.
     *
     * So the two things are tied together deliberately:
     *
     *   country in the URL   -> shareable, cache it at the edge
     *   country from cookie  -> personal, must never enter a shared cache
     *
     * The fallback exists because the URL is not guaranteed: an old cached JS
     * bundle, a hand-typed request, or a future caller might omit the param. Those
     * still get correct content — just not cached.
     */
    const userCountry = isRecognised
      ? (countryParam as string)
      : getUserCountryFromRequest(request);

    // Use NavigationService to get ALL context data in ONE call
    const pageContext = await NavigationService.getPageContext(path, userCountry);

    const cacheHeaders: Record<string, string> = isRecognised
      ? // Shared-cacheable. The country is in the URL, so the URL fully identifies
        // the response and no `Vary` is needed.
        { ...(getCacheHeaders(0, CACHE_DURATIONS.MEDIUM, CACHE_DURATIONS.LONG) as Record<string, string>) }
      : // Cookie-derived, therefore per-person. `private` forbids shared caches from
        // storing it at all; `no-store` also stops the browser keeping a copy that
        // could outlive a country change.
        { 'Cache-Control': 'private, no-store' };

    return NextResponse.json(
      {
        success: true,
        ...pageContext,
      },
      {
        headers: {
          ...cacheHeaders,
          // Debug aid: shows at a glance whether a given request was eligible for
          // edge caching. Cheap, and it turns "why is my hit rate low?" into a
          // one-line check in devtools rather than a guess.
          'X-Country-Source': isRecognised ? 'url' : 'cookie',
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
