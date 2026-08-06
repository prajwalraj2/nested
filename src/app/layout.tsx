import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
// Single source of truth for the brand name and canonical origin — shared with the
// per-page generateMetadata functions and (later) sitemap.ts, so they can't drift.
import { SITE_NAME, SITE_URL, TITLE_SEPARATOR, GA_MEASUREMENT_ID, buildOpenGraph, buildTwitter } from "@/lib/seo";

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
    /**
     * ⚠️ `suppressHydrationWarning` IS REQUIRED HERE — it is not papering over a bug.
     *
     * `next-themes` injects a small BLOCKING script into `<head>` that reads the stored
     * preference and sets `class="dark"` on this element *before the first paint*. That
     * script is the entire reason there is no flash of the wrong theme on load.
     *
     * But it also means the HTML the server sent (`<html lang="en">`) and the HTML the
     * browser holds at hydration (`<html lang="en" class="dark" style="color-scheme:dark">`)
     * differ on this one element. React sees that and logs a hydration mismatch error on
     * every single page load.
     *
     * The server cannot avoid it: the preference lives in `localStorage`, which does not
     * exist on the server, so there is no correct value to render. This attribute tells
     * React to skip the check for THIS ELEMENT ONLY — it does not disable hydration
     * checking for the app, and it is the documented approach.
     */
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/*
          Wraps everything so the theme reaches BOTH React trees — the public pages under
          `domain/layout.tsx` and the admin panel under `admin/layout.tsx`, which sits
          inside its own `SessionProvider`. Being here rather than in either subtree also
          means `/login`, `/unauthorized` and both error boundaries are themed.

          `children` stays server-rendered: only the provider itself is a client
          component (see the note in src/components/ThemeProvider.tsx).
        */}
        {/*
          ⚠️ `Toaster` sits INSIDE `ThemeProvider`, not beside it.

          `components/ui/sonner.tsx` calls `useTheme()` from next-themes to decide whether to
          render light or dark. Outside the provider that hook returns the default rather than
          the user's actual choice, so toasts would render light-on-light for anyone in dark
          mode — the exact class of bug #21 existed to remove.

          Mounted once at the root so both React trees can raise a toast: the public pages and
          the admin panel, which lives inside its own `SessionProvider`.

          `position="top-right"` was the user's choice. `sonner` replaces shadcn's deprecated
          `toast` component, and is the library this document already earmarked for the
          remaining `alert()` calls (#22.6) — so this is one mechanism, not a second.

          `closeButton` puts an × on every toast so it can be dismissed immediately rather than
          only by waiting out the timer or swiping. Set HERE rather than per `toast()` call, so
          every toast in the app behaves the same way — including the ones that will replace
          the remaining `alert()` calls. A per-call option would guarantee they drift apart.

          ⚠️ Checked in `node_modules/sonner/dist/index.js` rather than assumed: in 2.0.7 the
          close button carries no `opacity: 0`, so it is visible at rest, not only on hover.
          Some earlier releases revealed it on hover, which would have been a silent difference
          from what was asked for.
        */}
        <ThemeProvider>
          {children}
          <Toaster position="top-right" closeButton />
        </ThemeProvider>

        {/*
          Google Analytics 4.
          ====================================================================
          Via `@next/third-parties/google` rather than the copy-paste `<script>` snippet
          the GA setup wizard offers. That snippet is written for hand-authored static
          HTML; this component loads the same tag with Next's own script strategy, so it
          does not block the first paint and does not fight the framework.

          ⚠️ MOUNTED IN THE ROOT LAYOUT ON PURPOSE, which means the admin panel is tracked
          too. That is a real trade-off and it was taken deliberately:

            + it captures BOTH 404 routes (`app/not-found.tsx` and
              `app/domain/not-found.tsx`). For this site that is not a nice-to-have —
              renaming a domain or page slug 404s every page beneath it and there is NO
              redirect table, so GA's Pages report is the only place a botched rename
              becomes visible. Mounting under `domain/layout.tsx` instead would track the
              public site but lose the unknown-URL 404s entirely.
            - admin sessions count as traffic. Acceptable: the audience is one person, and
              GA's internal-traffic filter can exclude it later if the noise ever matters.

          ⚠️ PRODUCTION ONLY — and this gate is the important line, not the ID.

          `VERCEL_ENV` is set automatically by Vercel: 'production' on atno.io, 'preview'
          on every branch/PR deployment, 'development' under `vercel dev`. It is
          UNDEFINED under a plain `npm run dev`, so localhost is excluded for free.

          Without this, every dev session and every PR preview — which serve a full copy
          of the site — would pump traffic into the live property. The result is not merely
          noisy: it is unfixable, because GA cannot retroactively delete events, so a few
          weeks of polluted data stays polluted forever.

          This mirrors `src/app/robots.ts` exactly, which gates on the same variable for
          the same class of reason (don't let previews leak into production). Keeping the
          two checks identical is deliberate — if one ever needs changing, the other
          almost certainly does too.
        */}
        {process.env.VERCEL_ENV === "production" && (
          <GoogleAnalytics gaId={GA_MEASUREMENT_ID} />
        )}

        {/*
          Vercel Web Analytics + Speed Insights.
          ====================================================================
          Imported from `/next` rather than `/react`. Both packages ship several entry
          points; the `/next` one hooks Next's router so a client-side navigation is
          recorded as a new page. With `/react` the SPA route changes this app makes on
          every `<Link>` click would go unrecorded, exactly as they would in GA without
          its "page changes based on browser history events" setting.

          ⚠️ WHY THESE TWO ARE **NOT** WRAPPED IN THE PRODUCTION GATE ABOVE — the
          difference from GA is real, not an oversight.

          Vercel separates environments SERVER-SIDE. Events carry the deployment they came
          from, and the dashboard filters production / preview / development itself (the
          "All environments" dropdown). Preview traffic therefore cannot contaminate the
          production numbers, so there is nothing for a gate to protect.

          GA4 has no equivalent: one property, one bucket, and events cannot be deleted
          retroactively — which is why that one is gated and these are not. Wrapping these
          in the same condition would only cost the ability to check a preview deployment
          before merging it.

          WHY BOTH LIVE HERE RATHER THAN JUST ON THE PUBLIC PAGES
          Same reasoning as the GA mount above (see the note on 404 coverage). For Speed
          Insights specifically there is an extra reason: the admin panel is the heaviest
          part of the app — `/admin/tables` still carries a ~539 KB RSC payload after
          G-5a(ii) took it down from 8.19 MB — and it is the one screen whose real-world
          cost is worth watching as the catalogue grows (G-5a(iii) is deferred on exactly
          that trigger).

          ⚠️ HOBBY PLAN: both meter separately against monthly caps. Check Usage in the
          Vercel dashboard before assuming headroom.
        */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
