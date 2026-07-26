import type { MetadataRoute } from 'next'

/**
 * robots.txt — generated at /robots.txt
 * ============================================================================
 *
 * WHAT THIS FILE IS
 * -----------------
 * Next.js has a convention: a file at `src/app/robots.ts` that default-exports a
 * function returning this shape becomes the live `/robots.txt` URL. We write
 * TypeScript; Next renders the plain-text format crawlers actually expect.
 *
 * Every crawler (Googlebot, Bingbot, ChatGPT's fetcher, scrapers) requests
 * `https://atno.io/robots.txt` BEFORE crawling anything else, to ask "which parts
 * of this site am I allowed to look at?". Until now that returned 404 — which
 * crawlers read as "no restrictions, crawl everything" — hence the repeated
 * `GET /robots.txt → 404` lines in the Vercel logs.
 *
 * WHAT IT IS *NOT*
 * ----------------
 * ⚠️ It is not security. It is a polite request that well-behaved crawlers honour
 * voluntarily. A malicious scraper ignores it completely. Worse, it is a PUBLIC
 * file, so anything listed below is effectively advertised to the world.
 *
 * That is exactly why finding #1 (locking down /api/admin/*) had to ship BEFORE
 * this file. We are about to publish a document saying "the admin panel lives at
 * /admin" — which is fine now that those routes require an authenticated admin,
 * and would have been an invitation a week ago.
 *
 * ⚠️ Disallow also does not reliably mean "keep out of search results". If another
 * site links to a blocked URL, Google may still list the bare URL with no snippet
 * (it can see the link, just not the content). To truly keep something OUT of the
 * index you need `noindex` in the page's metadata — which is a different mechanism
 * and is what finding #14 / SEO-A uses for geo-restricted pages.
 */
export default function robots(): MetadataRoute.Robots {
  // Vercel sets VERCEL_ENV automatically on every deployment:
  //   'production'  → atno.io (and the nested-two.vercel.app alias)
  //   'preview'     → every branch/PR deployment, e.g. nested-two-git-dev-30-*.vercel.app
  //   'development' → `vercel dev`
  //
  // It is undefined when running plain `npm run dev` locally, so the check below
  // treats localhost like a preview: blocked. That is the safe default, and it
  // makes local output honest about what previews will serve.
  const isProduction = process.env.VERCEL_ENV === 'production'

  // ==========================================================================
  // PREVIEW / NON-PRODUCTION — block everything
  // ==========================================================================
  // Every PR you open creates a publicly reachable preview URL serving a full copy
  // of the site. Without this, Google can index those previews, and you end up
  // competing against yourself: atno.io and half a dozen *.vercel.app hostnames all
  // hosting the same pages. Google calls that duplicate content, picks whichever
  // copy it likes, and the ranking signals split across them.
  //
  // This must come FIRST and return early — a preview must never fall through to
  // the production rules below.
  if (!isProduction) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    }
  }

  // ==========================================================================
  // PRODUCTION
  // ==========================================================================
  return {
    rules: [
      {
        // '*' = these rules apply to every crawler. Specific bots can be given
        // their own block later (e.g. slowing down an aggressive scraper), but a
        // single wildcard rule is the right starting point.
        userAgent: '*',

        // --------------------------------------------------------------------
        // ALLOW — must be listed BEFORE the Disallow it overrides
        // --------------------------------------------------------------------
        // Googlebot renders JavaScript, but it checks robots.txt for each
        // subresource it fetches while rendering. Two PUBLIC API routes are
        // fetched client-side and are load-bearing for what Google actually sees:
        //
        //   /api/domain/tables/by-page/[pageId]
        //       src/components/domain/TableLayout.tsx:51
        //       ⚠️ This returns the ENTIRE contents of a table page. Block it and
        //       every `table` page looks like an empty shell to Google — the rows
        //       are the content.
        //
        //   /api/page-context
        //       src/hooks/usePageContext.ts:393 and :553
        //       Builds the sidebar + header navigation. Block it and Googlebot
        //       sees no nav, so it can't follow those internal links to discover
        //       deeper pages.
        //
        // How the conflict with `Disallow: /api/` below resolves: Google uses the
        // MOST SPECIFIC (longest) matching path, not file order. '/api/domain/'
        // is 12 characters, '/api/' is 5 — so Allow wins for those URLs. The
        // ordering here is for the benefit of simpler crawlers that take the
        // first match instead.
        allow: [
          '/api/domain/',
          '/api/page-context',
        ],

        // --------------------------------------------------------------------
        // DISALLOW
        // --------------------------------------------------------------------
        // Matching is a PREFIX match, so '/admin' also covers '/admin/users',
        // '/admin/tables/123', and everything else beneath it. No wildcard needed.
        disallow: [
          // The admin panel. 13 pages of forms and management UI. Zero search
          // value, and no reason to publicise the shape of it.
          '/admin',

          // Everything else under /api. Deliberately a blanket block with the two
          // exceptions whitelisted above, rather than an itemised list — so a new
          // API route added next month is private by default instead of
          // accidentally crawlable because nobody remembered to add it here.
          //
          // This covers: /api/admin/* (now 401-guarded anyway), /api/auth/*
          // (NextAuth's sign-in handlers), /api/debug/cache-test (finding #12,
          // still open), and the four deprecated endpoints from finding #9
          // (/api/sidebar, /api/header-domains, /api/breadcrumb,
          // /api/page-sidebar) which are slated for deletion.
          //
          // Note the trailing slash: '/api/' does not match the bare path '/api',
          // but nothing is served there, so it doesn't matter.
          '/api/',

          // The login form. Nothing to index, and it keeps ?callbackUrl=... query
          // variants — which the middleware appends on every redirect — out of the
          // crawl. Otherwise a crawler could waste budget on dozens of URLs that
          // all render the same form.
          '/login',

          // The "you're not an admin" page. Reachable only via redirect.
          '/unauthorized',

          // ⚠️ src/app/header1/page.tsx — the stock shadcn/Radix NavigationMenu
          // demo, still deployed. It contains placeholder copy ("Alert Dialog",
          // "Hover Card") and dead links to /docs/primitives/*. Indexing boilerplate
          // component-library text under your own domain is a thin-content signal.
          //
          // TODO: delete the page. Blocking it here is a stopgap — the page still
          // ships in the bundle and is still reachable by anyone with the URL.
          '/header1',
        ],
      },
    ],

    // Tells crawlers where the full URL list lives, instead of making them
    // discover every page by following links. Absolute URL is required by spec.
    //
    // ⚠️ /sitemap.xml does not exist yet — it is Phase A commit 4. Until then this
    // line points at a 404. The only consequence is a "Sitemap could not be read"
    // warning in Google Search Console, which clears itself once the sitemap ships.
    // Included now deliberately: crawlers re-read robots.txt roughly daily, and a
    // line that's briefly wrong is better than one we forget to add later.
    sitemap: 'https://atno.io/sitemap.xml',

    // Declares the preferred hostname among several serving the same content —
    // relevant because atno.io and nested-two.vercel.app both serve production
    // (see finding #13). In practice only Yandex still honours `host`; Google
    // ignores it entirely and uses canonical tags instead, which is what
    // `metadataBase` in the next commit sets up. Harmless, and correct if read.
    host: 'https://atno.io',
  }
}
