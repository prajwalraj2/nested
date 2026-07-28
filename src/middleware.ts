import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { SUPPORTED_COUNTRIES, DEFAULT_COUNTRY } from '@/lib/countries'

/**
 * Edge Middleware — runs BEFORE every matching request reaches a page or API route.
 * ============================================================================
 *
 * This file has two responsibilities:
 *
 *   1. GEO-TARGETING  — detect the visitor's country and store it in a cookie, so
 *                       Server Components and API routes can filter content by it.
 *   2. ADMIN SECURITY — block non-admins from /admin pages AND /api/admin endpoints.
 *
 * ---------------------------------------------------------------------------
 * IMPORTANT STRUCTURAL RULE
 * ---------------------------------------------------------------------------
 * Middleware works by RETURNING a response. There are several different things we
 * might return (continue / redirect / 401 JSON), and the country cookie must be
 * attached to whichever one we actually send back.
 *
 * The previous version got this wrong:
 *
 *     let response = NextResponse.next()
 *     response.cookies.set('user-country', 'IN')     // attached to THIS object
 *     ...
 *     return NextResponse.redirect(loginUrl)         // a DIFFERENT object — cookie lost!
 *
 * A first-time visitor landing directly on /admin got redirected to /login with NO
 * country cookie. It self-healed on the next request, but it was still a bug — and
 * adding the new 401 responses below would have created even more paths that drop it.
 *
 * The fix is the `withCountry()` helper: we decide the cookie ONCE at the top, then
 * every single `return` goes through `withCountry(...)`. Adding a new branch later
 * cannot silently reintroduce the bug.
 */

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ==========================================================================
  // STEP 1 — Decide the country cookie (but don't send it yet)
  // ==========================================================================
  // `resolveCountryCookie` returns either a country code to write, or `null`
  // meaning "the cookie is already correct, don't touch it".
  const countryToSet = resolveCountryCookie(request)

  /**
   * Attach the country cookie to any response before we return it.
   *
   * Every `return` in this function is wrapped in this. That is the whole point:
   * it makes "don't forget the cookie" structural instead of something you have to
   * remember at each exit.
   */
  const withCountry = (response: NextResponse): NextResponse => {
    if (countryToSet) {
      response.cookies.set('user-country', countryToSet, {
        // httpOnly: false — the browser's JS needs to read this.
        // src/hooks/useUserCountry.ts parses it from document.cookie.
        // It is NOT a secret: it holds "IN", not a session token.
        httpOnly: false,

        // Only send over HTTPS in production. In local dev we're on plain http,
        // so a `secure` cookie would never be stored at all.
        secure: process.env.NODE_ENV === 'production',

        // 'lax' — sent on normal navigation to our site, but not on cross-site
        // POSTs. Safe default; nothing here is sensitive anyway.
        sameSite: 'lax',

        /**
         * 30 days, reduced from 1 year (#15.2).
         *
         * With per-request re-detection below, `maxAge` is only a BACKSTOP — the
         * value self-corrects on the next request after the visitor's IP country
         * changes, so it never needs to wait for expiry. 30 days simply bounds how
         * long a stale value could persist if the geo header were ever missing.
         *
         * The old 1-year value was the real problem: whatever country a visitor was
         * assigned on their very first request was frozen for a year, and because
         * there is deliberately no country switcher in the UI, they had no way at all
         * to correct a bad detection (VPN, corporate proxy, carrier routing).
         */
        maxAge: 60 * 60 * 24 * 30,
        path: '/',                  // available on every route, not just the current one
      })
    }
    return response
  }

  // ==========================================================================
  // STEP 2 — Work out whether this request needs an admin check
  // ==========================================================================
  // These two are deliberately kept separate because they FAIL DIFFERENTLY:
  //   - a page route gets an HTML redirect a human can follow
  //   - an API route gets a JSON status code that `fetch()` can act on
  const isAdminPage = pathname.startsWith('/admin')
  const isAdminApi = pathname.startsWith('/api/admin')

  // ⚠️ THE ORIGINAL BUG WAS HERE.
  // The old code only checked `pathname.startsWith('/admin')`. The string
  // "/api/admin/domains/123" starts with "/api/admin", NOT "/admin" — so every
  // admin API route fell straight through this block with no check at all.
  //
  // Note the middleware was ALREADY running on those requests: the `matcher` at
  // the bottom only excludes `api/auth`, not `api/admin`. The routes were reachable
  // by the middleware the whole time; we simply never inspected them.

  if (isAdminPage || isAdminApi) {
    // Read and verify the session cookie's JWT. No database query — our session
    // strategy is "jwt", so isAdmin/isActive live inside the signed token.
    // Returns null if there's no cookie, or it's expired or tampered with.
    const session = await auth()

    // ---- Not logged in ----------------------------------------------------
    if (!session) {
      if (isAdminApi) {
        // 401 = "I don't know who you are." JSON, never a redirect — see the long
        // explanation at the bottom of src/lib/api-auth.ts for why redirecting an
        // API call actively hides the real error from the caller.
        return withCountry(
          NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
        )
      }

      // For pages, send them to the login form and remember where they were
      // heading, so LoginForm can bounce them back after a successful sign-in.
      // (src/components/auth/LoginForm.tsx reads this via useSearchParams.)
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return withCountry(NextResponse.redirect(loginUrl))
    }

    // ---- Logged in, but not an admin --------------------------------------
    if (!session.user?.isAdmin) {
      if (isAdminApi) {
        // 403 = "I know who you are, and you still can't do this."
        // Deliberately not a 401: logging in again would change nothing.
        return withCountry(
          NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
        )
      }
      return withCountry(NextResponse.redirect(new URL('/unauthorized', request.url)))
    }

    // ---- Admin, but the account was deactivated ---------------------------
    // DELETE /api/admin/users/[id] does a "soft delete" — it sets isActive = false
    // rather than deleting the row. Without this check, a deactivated admin would
    // keep working access until their existing JWT expired (up to 24 hours).
    if (!session.user?.isActive) {
      if (isAdminApi) {
        return withCountry(
          NextResponse.json({ success: false, error: 'Account is inactive' }, { status: 403 })
        )
      }
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('error', 'Account is inactive')
      return withCountry(NextResponse.redirect(loginUrl))
    }

    // Fall through — this caller is a genuine, active admin.
  }

  // ==========================================================================
  // STEP 3 — Keep signed-in admins off the login page
  // ==========================================================================
  // Small UX touch: if you're already logged in and you hit /login, go to the
  // dashboard instead of staring at a form you don't need.
  if (pathname === '/login') {
    const session = await auth()
    if (session?.user?.isAdmin) {
      return withCountry(NextResponse.redirect(new URL('/admin', request.url)))
    }
  }

  // ==========================================================================
  // STEP 4 — Nothing to block: let the request through
  // ==========================================================================
  // `NextResponse.next()` means "carry on to the page or API route as normal".
  return withCountry(NextResponse.next())
}

/**
 * Work out what the `user-country` cookie should be set to for this request.
 * ============================================================================
 *
 * @returns a country code to write, or `null` if the cookie is already correct and
 *          should be left alone.
 *
 * ---------------------------------------------------------------------------
 * RE-DETECTS ON EVERY REQUEST (#15.2). It used to be set-once-for-a-year.
 * ---------------------------------------------------------------------------
 * The old behaviour: if a cookie existed, return `null` and never look again — so
 * whatever country a visitor was assigned on their very first request was frozen for
 * a year.
 *
 * That was a genuine dead end. There is **deliberately no country switcher** in the
 * UI (a recorded product decision: each visitor should feel the site was built for
 * their market). So when detection was wrong — VPN, corporate proxy, mobile carrier
 * routing — the visitor had **no mechanism at all** to correct it. Re-detection is
 * not an optimisation here; it is the only correction the design permits.
 *
 * **And it is free.** Two reasons, both already true before this change:
 *   1. `x-vercel-ip-country` is derived from the IP at Vercel's edge and is already
 *      present on every request — no API call, no lookup, no added latency.
 *   2. This middleware already runs on every request (the matcher covers everything
 *      except `/api/auth`, static assets and images).
 * The old `if (existingCountry) return null` was never a performance measure.
 *
 * ⚠️ WHY IT RETURNS `null` WHEN THE VALUE IS UNCHANGED — this is the important part.
 * `Set-Cookie` on a response can stop shared caches from storing it. After #15.1 we
 * care about that: `/api/page-context` is CDN-cached, and the public pages may become
 * cacheable later (#8). Writing the cookie unconditionally on every request would
 * work against both. Returning `null` when nothing changed means a settled visitor
 * gets **zero** cookie writes after their first request, and the header only appears
 * on the rare request where their country genuinely changed.
 */
function resolveCountryCookie(request: NextRequest): string | null {
  const existingCountry = request.cookies.get('user-country')?.value

  // `x-vercel-ip-country` is added by Vercel's edge network, derived from the
  // visitor's IP address. It is a 2-letter ISO 3166-1 code, e.g. "IN", "US", "DE".
  //
  // It is only present on real Vercel deployments — locally it is always null.
  const headerCountry = request.headers.get('x-vercel-ip-country')

  if (!headerCountry) {
    /**
     * No geo header: local dev, or `vercel dev`.
     *
     * ⚠️ The `existingCountry` check here is deliberate and must stay. Without a
     * header we have nothing better than the default, so if a cookie already exists we
     * LEAVE IT ALONE — which is what makes it possible to hand-set
     * `user-country=IN` in DevTools (Application → Cookies) to test the Indian view on
     * localhost. Overwriting it with DEFAULT_COUNTRY on every request would make local
     * geo testing impossible.
     */
    return existingCountry ? null : DEFAULT_COUNTRY
  }

  // We only support a handful of countries so far: IN, US, GB, AU, CA.
  // Anyone else (say Germany → "DE") falls back to 'US', which by design means they
  // see ALL + US content:
  //     buildCountryFilter('US') → OR: [ has 'ALL', has 'US' ]
  // This is intentional, not an oversight — see #15 in NEW-IMPROVEMENTS.md.
  const detectedCountry =
    SUPPORTED_COUNTRIES.includes(headerCountry as (typeof SUPPORTED_COUNTRIES)[number])
      ? headerCountry
      : DEFAULT_COUNTRY

  // Only write when the value actually changed — see the ⚠️ note above about
  // Set-Cookie and cacheability.
  return existingCountry === detectedCountry ? null : detectedCountry
}

export const config = {
  /**
   * Which requests run this middleware.
   *
   * This is a negative-lookahead regex: `(?!...)` means "match any path EXCEPT one
   * starting with these". Reading it piece by piece:
   *
   *   api/auth        — NextAuth's own sign-in/sign-out handlers. Must be excluded,
   *                     or checking the session would recurse into itself.
   *   _next/static    — compiled JS/CSS bundles
   *   _next/image     — the built-in image optimizer
   *   favicon.ico     — the tab icon
   *   *.svg|png|...   — static image files
   *
   * ⚠️ Note what is NOT excluded: `api/admin`. Those requests have always passed
   * through this middleware — the old code simply never checked them. The matcher
   * was never the bug; the `startsWith('/admin')` condition was.
   *
   * Everything matched here also gets geo-detection, which is why the country cookie
   * is set on ordinary page visits too.
   */
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
