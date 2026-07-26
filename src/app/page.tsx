import { permanentRedirect } from "next/navigation";

/**
 * `/` — the site root. Sends every visitor to `/domain`, the real entry point.
 * ============================================================================
 *
 * WHY `permanentRedirect` AND NOT `redirect`
 * ------------------------------------------
 * Both send the visitor to the same place. The difference is the HTTP status code,
 * and search engines treat the two very differently:
 *
 *   redirect()           → 307 Temporary Redirect
 *   permanentRedirect()  → 308 Permanent Redirect
 *
 * A 307 tells Google: "`/` is still the real URL, it's just borrowing `/domain` for
 * now — keep checking back." So Google keeps `/` in its index, keeps re-crawling it,
 * and any ranking value earned by links pointing at `atno.io` stays attached to a URL
 * that shows nothing.
 *
 * A 308 tells Google: "`/` has moved to `/domain` for good." Google then treats
 * `/domain` as the canonical URL and consolidates the accumulated ranking signals
 * onto it. Since `atno.io` is the URL people naturally type and link to, that
 * consolidation is worth having — otherwise the site's strongest inbound links point
 * at a URL Google is told not to commit to.
 *
 * ⚠️ THE TRADE-OFF — READ THIS BEFORE ADDING A REAL HOMEPAGE
 * ----------------------------------------------------------
 * Browsers cache a 308 (and 301) **indefinitely and aggressively** — that is the
 * whole point of "permanent". A 307 is not cached this way.
 *
 * The practical consequence: if you later build an actual landing page at `/`, every
 * returning visitor who hit this redirect even once will *still* be bounced to
 * `/domain`. Their browser never asks the server again. They won't see the new
 * homepage until they hard-refresh or clear their cache — and you cannot fix that
 * from the server side.
 *
 * That's an acceptable price today, because `/` genuinely has no content of its own
 * and no plan to. But it makes this a decision rather than a detail. If a marketing
 * homepage at `/` is on the roadmap, change this back to `redirect()` first and
 * accept the weaker SEO signal in exchange for staying reversible.
 *
 * BETTER LONG-TERM OPTION
 * -----------------------
 * The strongest setup is no redirect at all: serve the domain listing directly at
 * `/`, so the root URL is itself the indexed page. Every redirect costs an extra
 * round trip before a visitor sees anything, and it hands your best URL's authority
 * to a different one instead of just keeping it. That means either moving the
 * `src/app/domain/page.tsx` content up to this file, or adding a rewrite (a rewrite
 * serves other content at the same URL — the address bar and the indexed URL both
 * stay `/`, unlike a redirect which changes them). Both are larger changes than this
 * one, and both touch how the whole `/domain/...` tree is addressed, so they are not
 * folded in here.
 */
export default function Home() {
  // Note there is no `return` and nothing rendered below. `permanentRedirect()`
  // works by throwing a special error that Next.js catches, so execution stops
  // here — any code after this line would be unreachable.
  permanentRedirect("/domain");
}
