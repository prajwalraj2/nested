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
  serverExternalPackages: ['sharp'],

  /**
   * Belt and braces for the same problem, scoped to the two routes that use sharp.
   *
   * ⚠️ The glob names **linux-x64 explicitly**, because that is the deploy target. It is
   * intentionally not the local platform: this include exists to fix a build that happens on
   * Vercel, and a pattern matching whatever the developer's laptop runs would look correct
   * locally while shipping the wrong binary — the precise shape of the bug it is fixing.
   *
   * The path is missing on Windows, where the glob simply matches nothing and costs nothing.
   */
  outputFileTracingIncludes: {
    '/api/admin/table-images': ['./node_modules/@img/sharp-linux-x64/**/*'],
    '/api/admin/table-images/[id]': ['./node_modules/@img/sharp-linux-x64/**/*'],
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
