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
