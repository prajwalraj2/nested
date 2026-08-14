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
  /**
   * ⚠️ AND `isomorphic-dompurify` / `jsdom` — THIS IS #23, FIXED BY #31'S PATTERN (L-1).
   * ==========================================================================
   *
   * Same error, same Turbopack frame, different package:
   *
   *     POST /api/admin/rich-text -> 500
   *     Failed to load external module jsdom
   *       at Context.externalImport (.next/server/chunks/[turbopack]_runtime.js)
   *
   * …which the browser sees as `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`,
   * because the 500 comes back as Vercel's HTML error page and the client calls `.json()` on it.
   *
   * ── WHY ALL THREE PACKAGES ARE NAMED ──────────────────────────────────────
   * `src/lib/sanitize-html.ts` imports `isomorphic-dompurify`, which requires `dompurify` for
   * the sanitiser itself and `jsdom` to give it a DOM to work on (there is no `window` on the
   * server). Naming only the entry package would leave the other two to be bundled, which is
   * the thing that fails.
   *
   * ⚠️ THE FIRST ATTEMPT AT #31 NAMED ONE PACKAGE AND GOT HALFWAY, costing a second deploy
   * cycle. Listing the whole chain here is that lesson applied rather than relearned.
   *
   * ⚠️ UNLIKE sharp, NOTHING HERE IS NATIVE — jsdom is 3.2 MB of plain JavaScript. So the
   * cause is not un-traceable `.node` binaries; it is jsdom's runtime `require` calls, which
   * static analysis cannot follow either. Same remedy, different reason.
   *
   * ⚠️ **This cannot be verified locally**, exactly as #31 could not. `npm run build`
   * succeeding proves only that nothing was broken. Treat it as unverified until a deploy
   * proves it — and check the NEW deployment URL, not a refresh of the old one.
   */
  serverExternalPackages: ['sharp', 'isomorphic-dompurify', 'dompurify', 'jsdom'],

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
      The two routes that sanitise HTML, and the only two that import
      `src/lib/sanitize-html.ts` — verified by grep, not assumed:

        src/app/api/admin/rich-text/route.ts          (a lazy `await import`, see below)
        src/app/api/admin/rich-text/[pageId]/route.ts (a top-level import)

      ⚠️ THE LAZY IMPORT IS WHY BOTH MUST BE LISTED. `route.ts` defers the import into its POST
      handler, which was an earlier attempt to keep jsdom out of the module graph. A dynamic
      import is *harder* for the tracer to follow, not easier — so that route needs the include
      at least as much as the static one does. Leave the lazy import alone for now; unpicking it
      is a separate change, and two changes at once make a failed deploy ambiguous.

      ⚠️ Keys are ROUTE paths, not file paths — `[pageId]` stays in brackets, matching the
      `[id]` entry above. A key that matches no route is silently ignored: no warning, no
      error, and the deploy fails exactly as if the line were absent.
    */
    '/api/admin/rich-text': ['./node_modules/jsdom/**/*', './node_modules/dompurify/**/*'],
    '/api/admin/rich-text/[pageId]': ['./node_modules/jsdom/**/*', './node_modules/dompurify/**/*'],
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
