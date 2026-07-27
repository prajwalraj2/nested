import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppHeader from "@/components/header/AppHeader";
// Single source of truth for the brand name and canonical origin — shared with the
// per-page generateMetadata functions and (later) sitemap.ts, so they can't drift.
import { SITE_NAME, SITE_URL, TITLE_SEPARATOR, buildOpenGraph, buildTwitter } from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Site-wide metadata defaults.
 * ============================================================================
 * Next.js merges metadata down the route tree: anything a page does not define
 * itself is inherited from here. So this file holds the things that are true
 * everywhere, and each page overrides only its own title/description/canonical.
 */
export const metadata: Metadata = {
  /**
   * The origin that every relative URL in any page's metadata resolves against.
   *
   * WHY THIS ONE LINE MATTERS: production is served on TWO hostnames — `atno.io`
   * and `nested-two.vercel.app`. Without a fixed base, a canonical URL written as
   * `/domain/genai` would resolve against whichever host answered the request, so
   * Google would see two complete, independent copies of the site, treat them as
   * duplicate content, and split the ranking signals between them.
   *
   * Pinning it here means both hostnames emit `https://atno.io/...` as the
   * canonical, so Google consolidates everything onto the real domain.
   *
   * ⚠️ `metadataBase` on its own does NOT emit a `<link rel="canonical">` tag — it
   * only decides what relative URLs expand to. The tag itself comes from
   * `alternates.canonical`, which each page sets. Both halves are required.
   */
  metadataBase: new URL(SITE_URL),

  /**
   * `default` is used by any route that doesn't set its own title (e.g. /login,
   * /unauthorized). `template` wraps the titles that pages DO set: a page
   * returning `title: 'YouTube Channels · Graphic Designing'` is rendered as
   * `YouTube Channels · Graphic Designing · ATNO`.
   *
   * A page can bypass the template with `title: { absolute: '…' }` if needed.
   *
   * ⚠️ The separator is `·`, NOT the conventional `|` — several domain names and
   * page titles contain pipes as content ("AI | ML | DL", "Cybersecurity |
   * Hacking"). See TITLE_SEPARATOR in src/lib/seo.ts.
   */
  title: {
    default: `${SITE_NAME} - Domain Explorer`,
    template: `%s${TITLE_SEPARATOR}${SITE_NAME}`,
  },

  description: 'Explore specialized domains and discover unique opportunities',

  /**
   * Open Graph — what appears when a link is pasted into WhatsApp, LinkedIn,
   * Slack, X, iMessage or Discord.
   *
   * Until now the site had none, so sharing an atno.io link rendered a bare URL
   * with no title, no description and no image. For a directory that grows by
   * being shared, that was a direct and ongoing cost.
   *
   * These are the fallbacks for routes with no metadata of their own (/login,
   * /unauthorized). Public pages build their own via the same helper.
   *
   * ⚠️ Built through `buildOpenGraph` rather than written inline because Next.js
   * merges metadata SHALLOWLY — a page defining `openGraph` replaces this object
   * entirely rather than merging into it. Going through one builder guarantees
   * every page emits the full set. See the comment on the helper.
   */
  openGraph: buildOpenGraph({
    title: `${SITE_NAME} - Domain Explorer`,
    description: 'Explore specialized domains and discover unique opportunities',
    url: '/',
  }),

  twitter: buildTwitter({
    title: `${SITE_NAME} - Domain Explorer`,
    description: 'Explore specialized domains and discover unique opportunities',
  }),

  /**
   * Browser / device icons.
   * ==========================================================================
   *
   * Two of these come from Next.js FILE CONVENTIONS and need no code at all —
   * Next detects the filename and emits the tag with a content hash for caching:
   *
   *   src/app/favicon.ico      → <link rel="icon">            (the Chrome tab)
   *   src/app/apple-icon.png   → <link rel="apple-touch-icon"> (iOS home screen)
   *
   * ⚠️ Those replaced the stock Next.js favicon — a black circle with a white
   * triangle — which had been shipping as atno.io's tab icon since day one.
   *
   * WHY THE EXTRA `icons` BLOCK BELOW
   * ---------------------------------
   * The `.ico` is a single fixed image, but a favicon is displayed against two
   * very different backgrounds:
   *
   *   Chrome light theme → tab strip is near-white (#f1f3f4)
   *   Chrome dark theme  → tab strip is dark grey  (#35363a)
   *
   * The `black-glyph` icon (a bare black mark on transparency) is crisp on light
   * and effectively invisible on dark. So we declare both variants with a `media`
   * query and let the browser choose — the same mechanism CSS uses.
   *
   * These point at `public/`, not `src/app/`, deliberately: file-convention icons
   * get hashed filenames, and we need stable URLs to reference here.
   *
   * The `.ico` above remains the fallback for anything that ignores `media` —
   * and it is the `black-disc` variant (white mark inside a solid black circle),
   * chosen precisely because it is self-contained and legible on either
   * background.
   */
  icons: {
    icon: [
      { url: '/icon-light.png', type: 'image/png', sizes: '192x192', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark.png',  type: 'image/png', sizes: '192x192', media: '(prefers-color-scheme: dark)'  },
    ],

    /**
     * ⚠️ This line is REQUIRED even though `src/app/apple-icon.png` exists.
     *
     * Declaring an `icons` object here SUPPRESSES the file-convention
     * `<link rel="apple-touch-icon">` tag — while, inconsistently, leaving the
     * `favicon.ico` tag in place. Without this entry the file is still built and
     * still served at /apple-icon.png, but nothing in the HTML points at it, so
     * iOS silently falls back to a screenshot of the page when you "Add to Home
     * Screen".
     *
     * Found by diffing the rendered <head> against the build output, not from the
     * docs. The lesson from the openGraph shallow-merge trap applies again: once
     * you take manual control of a metadata field, you own ALL of it.
     */
    apple: [{ url: '/apple-icon.png', type: 'image/png', sizes: '180x180' }],
  },

  /**
   * ⚠️ DELIBERATELY NOT SET HERE: `alternates.canonical`.
   *
   * Because metadata is inherited, a canonical URL declared in this layout would
   * be adopted by every page that doesn't set its own — so dozens of distinct
   * URLs would all tell Google "the real version of me is https://atno.io/".
   * Google would then drop them from the index as duplicates of the home page.
   * That is a genuinely common way to accidentally deindex a whole site.
   *
   * Canonicals must be per-page. See `generateMetadata` in
   * src/app/domain/[...slug]/page.tsx.
   */
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* <AppHeader /> */}
        {children}
      </body>
    </html>
  );
}
