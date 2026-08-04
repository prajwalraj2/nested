'use client'

import { useEffect } from 'react'
import Clarity from '@microsoft/clarity'

/**
 * Microsoft Clarity — session recordings, heatmaps and frustration signals.
 * ============================================================================
 *
 * WHAT THIS ADDS THAT THE OTHER THREE COLLECTORS DO NOT
 * ----------------------------------------------------
 * GA4, Vercel Web Analytics and Bing all answer "what happened" numerically. Clarity
 * answers "why": it replays real sessions, draws click/scroll heatmaps, and flags rage
 * clicks, dead clicks and excessive scrolling.
 *
 * That is genuinely useful for THIS site rather than generically nice. The public
 * layouts lean heavily on `truncate` with a `title=` tooltip as the only fallback —
 * domain names in `app/domain/page.tsx`, section headings and page titles in
 * `SectionBasedLayout.tsx`. Whether visitors can actually find the right link in a
 * three-column grid of clipped labels is a behavioural question that no pageview count
 * can answer, and dead-click data answers it directly (e.g. people clicking a section
 * heading that is not a link).
 *
 * ============================================================================
 * ⚠️ WHY THIS IS A SEPARATE CLIENT COMPONENT AND NOT AN INLINE <Script>
 * ============================================================================
 * Clarity's own setup page offers a minified IIFE to paste into `<head>`. We use the
 * official `@microsoft/clarity` package instead (7.6 KB, zero dependencies, typed).
 *
 * The deciding factor is `consentV2()`. If a consent banner is ever added — the EEA
 * question is real, because the site is publicly reachable worldwide even though
 * `targetCountries` only names IN/US/GB/AU/CA — that call is the mechanism for it.
 * With the raw snippet you would be hand-rolling calls against an untyped
 * `window.clarity` global. The package also exposes `setTag`, `event` and `identify`
 * for later, all type-checked.
 *
 * `init` touches `window` and `document`, so it cannot run during SSR. Hence
 * `'use client'` plus an effect.
 *
 * ============================================================================
 * ⚠️ WHY `init` IS DEFERRED TO BROWSER IDLE RATHER THAN CALLED IMMEDIATELY
 * ============================================================================
 * This is deliberate, and the reasoning is specific — not cargo-culted "defer
 * analytics" advice.
 *
 * Measured on production (Vercel Speed Insights, 4 Aug 2026):
 *
 *     TTFB 1.36s · FCP 3.15s · LCP 3.15s · INP 8ms · CLS 0 · RES 85 "Needs Improvement"
 *
 * ⚠️ Note what this deferral is NOT protecting. FCP is dominated by TTFB — 1.36s of
 * 3.15s is spent before a single byte arrives — which is server time caused by
 * `force-dynamic` (finding #8), not by scripts. Clarity's script is `async` anyway, so
 * it was never going to move FCP much. Claiming otherwise would be a bad justification
 * for a real precaution.
 *
 * What it protects is **INP and main-thread time**, which are currently *excellent*
 * (8ms, and CLS is a clean 0). Session recording works by continuously observing DOM
 * mutations, which is exactly the kind of sustained main-thread work that degrades
 * interaction responsiveness. Those two green metrics are the only part of the
 * performance picture that is unambiguously healthy right now, and they are worth
 * keeping that way while #8 remains open.
 *
 * ⚠️ THE TRADE-OFF, stated plainly: deferring means the first moments of a session are
 * not recorded. `timeout: 5000` bounds that at five seconds worst case. For heatmaps and
 * aggregate behaviour it is immaterial; if you ever specifically need to see the instant
 * a visitor lands (diagnosing immediate bounces, say), lower or remove the deferral —
 * it is one call, and this comment is the reason it exists.
 */

/**
 * The Clarity project ID.
 *
 * Public by the same logic as the GA Measurement ID: it is shipped to the browser and
 * visible in the network tab as `clarity.ms/tag/<id>`. Nothing to protect.
 *
 * Kept HERE rather than in `src/lib/seo.ts` (where `GA_MEASUREMENT_ID` lives) for the
 * plain reason that this file is its only consumer. `GA_MEASUREMENT_ID` sits in `seo.ts`
 * because the root layout already imports that module for `SITE_NAME`, `SITE_URL` and
 * `TITLE_SEPARATOR` — adding one more constant there cost nothing. Introducing a shared
 * module for a single-use value would be indirection with no payoff, and Clarity is not
 * SEO, so `seo.ts` is the wrong home for it on naming grounds too.
 */
const CLARITY_PROJECT_ID = 'xwzc7k67px'

/**
 * How long to wait for an idle moment before giving up and initialising anyway.
 *
 * Without a timeout, `requestIdleCallback` can be postponed indefinitely on a page that
 * never goes idle — which would mean no recording at all on exactly the busy pages worth
 * recording.
 */
const IDLE_TIMEOUT_MS = 5000

/** Fallback delay for browsers with no `requestIdleCallback` (notably older Safari). */
const FALLBACK_DELAY_MS = 2000

export function ClarityAnalytics() {
  useEffect(() => {
    // Guard against double-initialisation. In development React's Strict Mode runs
    // effects twice, and `init` is not idempotent — it would inject a second tag.
    let cancelled = false

    const start = () => {
      if (!cancelled) Clarity.init(CLARITY_PROJECT_ID)
    }

    /**
     * ⚠️ FEATURE-DETECTED WITH `typeof`, NOT WITH `'requestIdleCallback' in window`.
     *
     * The `in` form does not compile here, and the reason is worth knowing. lib.dom
     * declares `requestIdleCallback` as a NON-OPTIONAL member of `Window`, so TypeScript
     * treats the negative branch of an `in` check as impossible — it narrows `window` to
     * `never`, and the `window.setTimeout` fallback below then fails with
     * "Property 'setTimeout' does not exist on type 'never'".
     *
     * The types are wrong about reality (older Safari genuinely lacks it), but arguing
     * with them is not the fix. A `typeof` check on the property narrows the PROPERTY,
     * not the object, so `window` stays `Window` in both branches.
     *
     * No `typeof window !== 'undefined'` guard: this is inside `useEffect`, which never
     * runs on the server. Adding it was what dragged `window` into the narrowing in the
     * first place.
     */
    if (typeof window.requestIdleCallback === 'function') {
      const idleHandle = window.requestIdleCallback(start, { timeout: IDLE_TIMEOUT_MS })
      return () => {
        cancelled = true
        window.cancelIdleCallback(idleHandle)
      }
    }

    const handle = window.setTimeout(start, FALLBACK_DELAY_MS)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [])

  // Renders nothing — this component exists only for its effect.
  return null
}
