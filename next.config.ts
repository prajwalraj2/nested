import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production-ready configuration
  eslint: {
    ignoreDuringBuilds: false, // Re-enabled for production
  },
  typescript: {
    ignoreBuildErrors: false,
  },

  /**
   * ⚠️ `sharp` MUST NOT BE BUNDLED — IT BROKE PRODUCTION AND NOT LOCAL (K-5b).
   * ==========================================================================
   *
   * Symptom on `atno.io`, with `/admin/images` and the upload endpoint working perfectly on
   * localhost:
   *
   *     GET /api/admin/table-images -> 500
   *     Failed to load external module sharp:
   *       Could not load the "sharp" module using the linux-x64 runtime
   *       at Context.externalImport (.next/server/chunks/[turbopack]_runtime.js)
   *
   * ⚠️ **This is #23 recurring.** The same Vercel log showed `jsdom` failing identically for
   * the rich-text editor — same message, same Turbopack frame. #23 was diagnosed, fixed, and
   * the fix reverted (23.4) because it cost 2.2 minutes of build time to repair a feature that
   * was being replaced. `sharp` is not that: it is load-bearing for Phase K.
   *
   * ── What is actually wrong ─────────────────────────────────────────────────
   * NOT a missing binary. `@img/sharp-linux-x64` is in `package-lock.json`, so Vercel installs
   * it. The problem is **file tracing**: sharp resolves its native library through a runtime
   * lookup that static analysis cannot follow, so the tracer records sharp's 29 JavaScript
   * files and **none of its `.node` binaries** — verified in the local trace, where the only
   * `@img/*` entries were the pure-JS `@img/colour`. Vercel uploads what was traced, so the
   * function ships sharp's JavaScript and nothing for it to load.
   *
   * `serverExternalPackages` tells Next to leave the package alone and take it from
   * `node_modules` at runtime, which is the documented remedy for exactly this class of
   * native dependency.
   *
   * ⚠️ **This cannot be verified locally.** Windows loads `@img/sharp-win32-x64` and works
   * regardless; the failure only exists on the linux runtime. The same was true of #23, whose
   * record notes "the only meaningful test is deploying". **Treat this as unverified until a
   * deploy proves it.**
   *
   * If it is still not enough, the remaining lever is dropping `--turbopack` from the build
   * script — the other half of #23.2's fix, at the same 2.2-minute cost.
   */
  /*
    ⚠️ `isomorphic-dompurify`, `dompurify` and `jsdom` WERE ALSO LISTED HERE, FOR #23.
    They were removed on 15 Aug 2026 along with rich-text sanitisation itself — see
    `SANITISER-REMOVAL.md` step 5, and NEW-IMPROVEMENTS-2.md #35 for what to restore.

    ⚠️ If sanitisation ever comes back, BOTH halves are required: these entries AND
    `outputFileTracingIncludes` for the two rich-text routes. Each was necessary and
    neither was sufficient — fixing only the tracing moved the failure from "module not
    found" to `ERR_REQUIRE_ESM`, which read like a new bug and cost another cycle.
  */
  serverExternalPackages: ['sharp'],

  /**
   * Remote hosts `next/image` is allowed to load and optimise (M-9).
   * ==========================================================================
   *
   * ⚠️ THIS SITE HAD NO `images` CONFIG AT ALL UNTIL BLOG COVERS, and the reason is worth knowing:
   * every other remote image here — table thumbnails, `ItemIcon`, the admin grid — uses a plain
   * `<img>`. `DataTable`'s own comment explains why: those objects are ALREADY 64px WebP
   * thumbnails produced by our upload pipeline, so putting them through the optimiser a second
   * time would cost a request and save nothing.
   *
   * ⚠️ A BLOG COVER IS THE OPPOSITE CASE, which is why it does not follow that precedent. It is a
   * 1200x630 JPEG rendered at anything from a phone's 360px to a full-width article, so serving
   * one size to everybody wastes most of the bytes on most of the visits.
   *
   * ⚠️ A SINGLE `*`, NOT `**`. The Vercel Blob store id is exactly one subdomain segment
   * (`<store>.public.blob.vercel-storage.com`), and `*` matches exactly one — so this permits our
   * store and any future one, while `**` would additionally permit arbitrarily nested hosts for no
   * benefit. Narrower is free here.
   *
   * ⚠️ THE SAME RULE IS ENFORCED WHEN A COVER IS SAVED — see `isSupportedCoverUrl` in
   * `lib/blog-types.ts`, used by both blog API routes. That is not belt-and-braces: an unmatched
   * host makes `next/image` THROW, which 500s the entire listing page rather than dropping one
   * image. Rejecting the URL at write time is what keeps an unrenderable cover from ever existing.
   */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },

  /**
   * Force sharp's native packages into the two routes that use it.
   *
   * ⚠️ THE FIRST ATTEMPT NAMED ONLY `@img/sharp-linux-x64` AND GOT HALFWAY:
   *
   *     ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.3: cannot open shared object file
   *
   * The binary was found and the *shared library it depends on* was not — because sharp
   * splits its native code across **two** packages on linux: `@img/sharp-linux-x64` holds the
   * `.node` addon and `@img/sharp-libvips-linux-x64` holds `libvips-cpp.so`.
   *
   * ⚠️ **On Windows there is no such split** — `@img/sharp-win32-x64` contains both, which is
   * precisely why no amount of local testing could have surfaced this. Confirmed by listing
   * `node_modules/@img/`: three entries here, and no libvips package at all.
   *
   * So the glob names the whole `@img` scope rather than individual packages. It is not
   * laziness: the split has moved between sharp releases, and a list of package names is a
   * thing that silently stops matching after an upgrade. **npm only installs the optional
   * packages for the running platform**, so on Vercel this resolves to the linux set and
   * nothing else — the scope is self-limiting.
   */
  outputFileTracingIncludes: {
    '/api/admin/table-images': ['./node_modules/@img/**/*'],
    '/api/admin/table-images/[id]': ['./node_modules/@img/**/*'],

    /*
      ⚠️ THE TWO `/api/admin/rich-text` ENTRIES WERE REMOVED HERE (15 Aug 2026, #35).
      Nothing in those routes has a dependency the tracer cannot follow any more —
      `htmlToPlainText` is pure string work with no imports at all.

      ⚠️ If they are ever restored, note that keys are ROUTE paths, not file paths:
      `[pageId]` stays in brackets, matching the `[id]` entry above. A key matching no
      route is silently ignored — no warning, no error, and the deploy fails exactly as
      if the line were absent.
    */
  },

  /**
   * `/` SERVES THE DOMAIN LISTING DIRECTLY — no redirect (M-1).
   * ==========================================================================
   *
   * ⚠️ `src/app/page.tsx` WAS DELETED FOR THIS AND MUST NOT COME BACK.
   *
   * A plain `rewrites()` array runs in the `afterFiles` phase — *after* filesystem routes. So a
   * `page.tsx` at the app root would win and this rule would never fire, silently. If a real
   * homepage is ever wanted, delete this rule; do not add a file beside it.
   *
   * ── WHAT THIS REPLACED, AND WHY ───────────────────────────────────────────
   * `/` used to `permanentRedirect('/domain')` — a 308. The reasoning for choosing 308 over 307
   * was sound and is worth keeping:
   *
   *   307 (temporary) tells Google "`/` is still the real URL, it is just borrowing `/domain`" —
   *   so Google keeps `/` indexed and re-crawled, and any authority earned by links to
   *   `atno.io` stays attached to a URL that shows nothing. A 308 says "moved for good", and
   *   Google consolidates onto `/domain`.
   *
   * ⚠️ BUT A 308 IS CACHED BY BROWSERS INDEFINITELY — that is what "permanent" means. The
   * consequence, spelled out in the file this replaces: build a real homepage later and every
   * visitor who hit the redirect even once is *still* bounced to `/domain`, forever, and **it
   * cannot be fixed from the server side.**
   *
   * ── WHY NOT JUST SWITCH TO 307 ────────────────────────────────────────────
   * That was the obvious fix and it is worse. The delay a visitor notices on `atno.io` is caused
   * by **having a redirect at all** — a full round trip before anything renders. The 308 cache is
   * precisely why *repeat* visits feel instant. Switching to 307 would remove that cache and make
   * the delay happen on **every** visit, trading a future trap for a permanent tax.
   *
   *                        first visit          repeat visit
   *     308 (before)       round trip           instant — browser remembers
   *     307                round trip           round trip, every time
   *     rewrite (this)     no redirect at all   no redirect at all
   *
   * A rewrite serves other content at the same URL: the address bar and the indexed URL both stay
   * `/`, unlike a redirect which changes them. No round trip, no cached 308, and a real homepage
   * later is one deleted line rather than an unfixable cache.
   *
   * ⚠️ ANYONE WHO ALREADY VISITED `atno.io` STILL HAS THE OLD 308 CACHED and will keep being sent
   * to `/domain` until their browser cache clears. That is the trap, already sprung — new
   * visitors get the fast path immediately, existing ones eventually. Nothing here can hurry it.
   *
   * ── ONE OPEN QUESTION THIS CREATES ────────────────────────────────────────
   * ⚠️ `src/app/domain/page.tsx` sets `canonical: '/domain'`, so `/` now serves content while
   * pointing search engines at `/domain`. That is unchanged behaviour and not a regression — but
   * "which URL is canonical" is a live decision now that both serve. Making `/` canonical would
   * also mean deciding what `/domain` becomes. Deliberately NOT folded into this change.
   *
   * ⚠️ Middleware still runs on `/`: it executes before `afterFiles` rewrites, and the matcher
   * excludes only `api/auth`, `_next` and static files. Geo detection is unaffected.
   */
  async rewrites() {
    return [{ source: '/', destination: '/domain' }];
  },

  /**
   * Cache headers for the domain/page icons in `public/icons/`.
   * ==========================================================================
   *
   * ⚠️ WITHOUT THIS, EVERY ICON COSTS A ROUND TRIP ON EVERY PAGE LOAD.
   *
   * Vercel serves `public/` with `Cache-Control: public, max-age=0, must-revalidate` —
   * confirmed against production:
   *
   *     GET https://atno.io/favicon.ico
   *     → Cache-Control: public, max-age=0, must-revalidate
   *
   * That tells the browser to re-check the file every single time. The response is a cheap
   * `304 Not Modified` with no body, but it is still a network round trip *per icon, per page
   * load*. Fifteen icons on a page is fifteen conditional requests every visit — which would
   * have quietly undone the main reason for choosing same-origin files over a storage service
   * (see NEW-IMPROVEMENTS.md §27.5.2).
   *
   * `immutable` means the browser will not even ask again for a year.
   *
   * ⚠️ THE CONSEQUENCE: AN ICON CAN NEVER BE EDITED IN PLACE. A visitor who has fetched
   * `youtube.svg` keeps their copy for a year and will never see a replacement at the same
   * filename. To change an icon, add a NEW file (`youtube-v2.svg`) and re-point the rows that
   * use it. This is stated in public/icons/README.md too, because it is the kind of rule that
   * only bites months later.
   *
   * Scoped to `/icons/` alone — deliberately not all of `public/`, where `og-image.png` and the
   * favicons are things we may well want to replace in place.
   */
  async headers() {
    return [
      {
        source: '/icons/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
