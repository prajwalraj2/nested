// src/app/api/domain/tables/by-page/[pageId]/route.ts

/**
 * Public Table Data API
 *
 * GET /api/domain/tables/by-page/[pageId]?country=IN
 *
 * Returns one page's table with its rows filtered to the visitor's country and the
 * internal `targetCountries` column stripped out.
 *
 * ============================================================================
 * WHY THE COUNTRY IS IN THE URL AND NOT READ FROM THE COOKIE
 * ============================================================================
 * `table` is the most common content type on the site — roughly 666 of 1,198 pages —
 * and every one of those pages fetches this route client-side from
 * `TableLayout.tsx`. So this is one of the two hottest endpoints in the app.
 *
 * It used to send **no cache headers at all** and take its country from the cookie.
 * Both halves of that mattered:
 *
 *   - No `Cache-Control` meant Vercel's CDN never stored the response, so every view
 *     of every table page ran this function.
 *   - `TableService.getPublicTable` was wrapped only in React `cache()`, which dedupes
 *     within a single render and dies with the request. Since this route calls it once
 *     per request, it deduplicated nothing — so every view also hit Postgres.
 *
 * The response is only shareable if the URL fully identifies it. A cookie-derived
 * response is personal by definition: put shared cache headers on it and the CDN would
 * store one visitor's rows and hand them to everyone. Moving the country into the query
 * string is what makes a shared cache correct:
 *
 *     ?country=IN   -> one entry, shared by every Indian visitor
 *     ?country=US   -> one entry, shared by every American visitor
 *
 * This is the same fix applied to `/api/page-context` in finding #15.1 — see the long
 * comment at the top of that file for why `Vary: Cookie` is not an alternative (it keys
 * on the entire Cookie header, including session and analytics IDs, so the hit rate is
 * effectively zero).
 *
 * ⚠️ WHY IT IS SAFE FOR THE CLIENT TO NAME ITS OWN COUNTRY
 * `targetCountries` exists for RELEVANCE, not access control (finding #15). Nothing is
 * protected by it. Someone hand-editing `?country=IN` just sees Indian rows — not
 * privilege escalation, and not data they were denied. If that ever stops being true,
 * this approach has to be revisited, because the country would then be a security
 * boundary and a client-supplied value could not define it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserCountryFromRequest } from '@/lib/server-country';
import { SUPPORTED_COUNTRIES, ALL_COUNTRIES, type SupportedCountry } from '@/lib/countries';
import { TableService } from '@/services';
import { getCacheHeaders, CACHE_DURATIONS } from '@/lib/cache';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await params;

    if (!pageId) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      );
    }

    // ------------------------------------------------------------------------
    // Resolve the country, and decide whether the answer is shareable
    // ------------------------------------------------------------------------
    const countryParam = request.nextUrl.searchParams.get('country')?.toUpperCase() ?? null;

    /**
     * Only an EXPLICIT, RECOGNISED country makes this response shareable.
     *
     * Validated against a whitelist rather than trusted, for two reasons:
     *
     *   1. Cache-key explosion. `?country=<random>` would mint a fresh CDN entry every
     *      time, so anyone could evict every useful entry — and each miss costs a
     *      function invocation plus a database round trip.
     *   2. It keeps the key space knowable: at most a handful of countries × page IDs.
     *
     * `ALL_COUNTRIES` is accepted too, since filtering by `'ALL'` is a meaningful
     * request for globally-targeted rows only.
     */
    const isRecognised =
      countryParam !== null &&
      (countryParam === ALL_COUNTRIES ||
        SUPPORTED_COUNTRIES.includes(countryParam as SupportedCountry));

    /**
     * The fallback exists because the query parameter is not guaranteed — a browser
     * running an older cached JS bundle, a hand-typed request, or some future caller
     * might omit it. Those still get CORRECT content; they just don't get cached,
     * because a cookie-derived answer must never enter a shared cache.
     */
    const userCountry = isRecognised
      ? (countryParam as string)
      : getUserCountryFromRequest(request);

    const tableData = await TableService.getPublicTable(pageId, userCountry);

    if (!tableData) {
      return NextResponse.json(
        { error: 'No table found for this page' },
        {
          status: 404,
          // A 404 is cheap but not free, and a page without a table will keep being
          // asked about. Cached briefly so repeated visits don't re-query; short
          // enough that attaching a table shows up quickly even before invalidation.
          headers: { 'Cache-Control': `public, max-age=0, s-maxage=${CACHE_DURATIONS.SHORT}` },
        }
      );
    }

    const cacheHeaders: Record<string, string> = isRecognised
      ? // Shareable: the country is in the URL, so the URL fully identifies the
        // response and no `Vary` header is needed.
        { ...(getCacheHeaders(0, CACHE_DURATIONS.MEDIUM, CACHE_DURATIONS.LONG) as Record<string, string>) }
      : // Cookie-derived, therefore per-person. `private` forbids shared caches from
        // storing it; `no-store` also stops the browser keeping a copy that could
        // outlive a change of country.
        { 'Cache-Control': 'private, no-store' };

    return NextResponse.json(
      {
        table: {
          id: tableData.id,
          name: tableData.name,
          schema: tableData.schema,
          data: tableData.data,
          // Image key -> URL for the keys this table uses (K-5c). Resolved server-side so the
          // browser does not make one request per row to translate names into URLs.
          images: tableData.images,
          settings: tableData.settings,
          updatedAt: tableData.updatedAt,
          page: tableData.page,
        },
        filtering: tableData.filtering,
      },
      {
        headers: {
          ...cacheHeaders,
          // Debug aid, same as /api/page-context: shows at a glance whether a given
          // request was eligible for edge caching, turning "why is my hit rate low?"
          // into a one-line check in devtools instead of a guess.
          'X-Country-Source': isRecognised ? 'url' : 'cookie',
        },
      }
    );

  } catch (error) {
    console.error('Error fetching table data for page:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
