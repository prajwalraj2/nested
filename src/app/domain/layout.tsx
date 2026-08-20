import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import AppSidebar from "@/components/sidebar/app-sidebar"
import BreadcrumbDemo from "@/components/bread/bread"
import { Separator } from "@/components/ui/separator"
import { ShareButton } from "@/components/domain/ShareButton";
import { PageContextProvider } from "@/contexts/PageContextProvider";
import { ClarityAnalytics } from "@/components/analytics/ClarityAnalytics";
import { SiteHeader } from "@/components/header/SiteHeader";

export default function DomainLayout({ children }: { children: ReactNode }) {
  return (
    // ============================================
    // NEW: PageContextProvider wraps everything
    // This provides unified data to all navigation components
    // (header, sidebar, breadcrumb) from a SINGLE API call
    // ============================================
    <PageContextProvider>
      {/*
        Microsoft Clarity.
        ======================================================================
        ⚠️ MOUNTED HERE, NOT IN THE ROOT LAYOUT — and it is the ONLY collector of the four
        that is. GA4, Vercel Web Analytics and Vercel Speed Insights all sit in
        `src/app/layout.tsx`. The divergence is deliberate, so that nobody "tidies it up"
        by moving this line up to join them.

        WHY CLARITY IS DIFFERENT: it records the SCREEN, not just events. Mounted at the
        root it would capture the admin panel — content being authored, tables being
        edited, and the `/login` form. Clarity masks input values by default, but the
        right answer is not to send it at all: there is no analytical value in watching
        recordings of the one person who runs the site, and it is a privacy surface the
        other three simply do not have.

        WHAT THIS MOUNT POINT COSTS: the unknown-URL 404s from `src/app/not-found.tsx`
        (e.g. `/foo`) are outside this layout, so Clarity does not see them. Acceptable —
        `src/app/domain/not-found.tsx` IS inside it, and that is the 404 that matters here,
        since renaming a slug 404s every page beneath it. GA covers both regardless.

        ⚠️ PRODUCTION ONLY, for the same reason as GA and NOT for the same reason as the
        Vercel pair. Clarity has ONE project with no environment filter, so a `npm run dev`
        session or a PR preview would land in the same recordings list as real visitors.
        Vercel separates environments server-side, which is why those two need no gate;
        Clarity does not, so it gets one. `VERCEL_ENV` is undefined under plain
        `npm run dev`, so localhost is excluded for free.
      */}
      {process.env.VERCEL_ENV === 'production' && <ClarityAnalytics />}

      <div className="flex flex-col min-h-screen">
        {/*
          The site header (M-2).

          ⚠️ IT SITS HERE, ABOVE THE SIDEBAR, RATHER THAN INSIDE `SidebarProvider`. This wrapper
          was already `flex flex-col` with the sidebar area as `flex-1`, so there was a slot for
          it — no restructuring, and the sidebar keeps the full remaining height.

          ⚠️ WHY THE DOMAIN TREE GETS A HEADER AT ALL, when it already has a sidebar and a
          breadcrumb: since M-1, `/` serves this section, so the domain listing IS the homepage —
          and a homepage with no way to reach About, the blog or the changelog would be odd. The
          three layers do different jobs: the header is site-wide navigation, the sidebar is
          within-domain, the breadcrumb is where-am-I. That is the standard documentation-site
          arrangement, not an accident.

          ⚠️ A server component inside a client-provider tree is fine — `PageContextProvider`
          receives it as `children`, already rendered. It does NOT become a client component by
          being nested here, which is what keeps its ~25 domain links in the HTML.
        */}
        <SiteHeader />

        {/* Main content area with sidebar */}
        <div className="flex-1">
          <SidebarProvider>
            <AppSidebar />
            {/*
              ⚠️ `min-w-0` IS LOAD-BEARING — without it a wide table scrolls the WHOLE PAGE.
              ========================================================================
              This is the same bug, and the same fix, as `SidebarInset className="min-w-0"`
              in `src/components/admin/layout/AdminLayout.tsx`. That one landed in G-3a; the
              public layout never got it, so the public side kept the bug the admin side had
              already fixed.

              WHY IT HAPPENS
              `SidebarProvider` renders `<div class="flex min-h-svh w-full">` — a flex ROW.
              So this `<main>` is a row flex item, and a flex item's default
              `min-width: auto` refuses to shrink below its content's intrinsic min-content
              width. Every table cell carries `whitespace-nowrap` (`ui/table.tsx:73,86`), so
              a 5+ column table has a large min-content width and drags this container past
              the viewport. The document then scrolls sideways, taking the sticky breadcrumb
              bar with it while the `fixed` sidebar stays put.

              ⚠️ WHY THE TABLE'S OWN `overflow-x-auto` DID NOT ALREADY HANDLE IT — this is
              the counter-intuitive part. There are already TWO correct overflow containers
              below this point:

                  src/components/table/DataTable.tsx:261   `overflow-auto`
                  src/components/ui/table.tsx:11            `w-full overflow-x-auto`

              Neither could ever fire. `overflow-x-auto` only clips content wider than its
              OWN box, and their width is `w-full` of an ancestor that this missing class
              allowed to grow to fit the table. The container was never narrower than its
              content, so there was nothing to scroll and the overflow escaped upward.

              This class does not add scrolling. It removes the thing that disabled it.

              ⚠️ ONE `min-w-0` IS ENOUGH HERE, unlike AdminLayout which needs two. There,
              `SidebarInset` is itself `flex flex-col`, so its child is another flex item
              needing the same treatment. Here `<main>` is a plain BLOCK — `flex-1` governs
              how it sizes within its parent, it does not make `<main>` a flex container —
              so everything below is ordinary block layout, already width-constrained by
              this box.

              ✅ MEASURED, not just reasoned — AdminLayout's own comment ("Removing either
              brings the scrollbar back") is a warning that flex min-content behaviour does
              not reliably match expectation, so this was checked rather than assumed.
              On /domain/gdesign/ytubeplaylist (5 columns plus more off-screen),
              `document.documentElement.scrollWidth > document.documentElement.clientWidth`
              returns **false** with the sidebar both expanded AND collapsed, and the
              scrollbar appears on the table card instead of the window.

              If a document-level sideways scroll ever does reappear on a public page, a
              second `min-w-0` on an inner wrapper is the first thing to try.
            */}
            <main className="flex-1 min-w-0">
              {/* Breadcrumb bar */}
              {/*
                  ⚠️ `top-16`, NOT `top-0` — the site header (M-2) occupies the first 64px, so a
                  bar sticking to `top-0` slides UNDERNEATH it on scroll and reads as a faded
                  half-visible strip rather than a broken layout, which is why it is easy to miss.

                  ⚠️ `z-20`, AND THE EXACT VALUE MATTERS IN BOTH DIRECTIONS.

                  BELOW the header's `z-50` — raising it past that would put the breadcrumb over
                  the header, which is the same bug pointing the other way.

                  ABOVE `z-10`, because `z-10` was a TIE and a tie is decided by DOM order. The
                  sticky table header in `DataTable.tsx:602` is also `z-10`, it lives inside
                  `{children}` so it comes LATER in the document, and later wins — which is why the
                  table header painted ON TOP of this bar while everything else slid politely
                  underneath. Nothing was "in front" by design; the two simply drew at the same
                  level and the table happened to be second.

                  ⚠️ That also explains the half-symptom that made it confusing: the table's own
                  search and filter row has no `z-index` at all, so it stays at level 0 and goes
                  behind this bar correctly. Only the one element that shared `z-10` misbehaved.

                  ⚠️ CONSEQUENCE FOR NEW CODE: page content must stay at `z-10` or below. The
                  chrome (header 50, this bar 20) outranks it deliberately.
                */}
                <div className="flex items-center gap-2 p-4 m-4 border rounded-lg bg-background z-20 sticky top-16">
                {/*
                  `text-gray-500 hover:text-gray-700` was hardcoded here: fixed greys that
                  ignore the theme entirely, so on a dark background the trigger became a
                  dark grey icon on a dark surface and got *darker* on hover. The token
                  pair reverses correctly in both themes.
                */}
                <SidebarTrigger className="text-4xl text-muted-foreground hover:text-foreground cursor-pointer"/>
                <Separator
                    orientation="vertical"
                    className="mr-2 data-[orientation=vertical]:h-4"
                  />
                <BreadcrumbDemo />

                {/*
                  `ml-auto` pushes the toggle to the far right of the bar, so it does not
                  shift position as breadcrumb trails change length between pages — this
                  bar is `sticky`, so a control that moved around while scrolling different
                  pages would be genuinely annoying to hit.

                  Mounted inside SidebarProvider deliberately: it is a sibling of the
                  trigger and breadcrumb, so switching theme re-renders only this button
                  and does not remount the provider or reset the sidebar's open/closed
                  state.
                */}
                {/*
                  `gap-2` so Share and the theme toggle do not touch. Both are 36px
                  squares with matching borders, so they read as one control group rather
                  than two unrelated buttons.

                  ⚠️ Share is mounted HERE, once, rather than beside each page's <h1>.
                  Five layout components render their own heading (`SectionBasedLayout`,
                  `TableLayout`, `RichTextLayout`, `NarrativeLayout`,
                  `SubcategorySelector`) — putting it there would be five copies to keep
                  in step. See the block comment at the top of ShareButton.tsx.
                */}
                {/*
                  ⚠️ THE THEME TOGGLE USED TO BE HERE AND MOVED TO THE SITE HEADER (20 Aug 2026).

                  This bar renders only under `/domain/*`, so a control living here was absent from
                  every page in the `(site)` group. The header is on every public page; this is not.
                  ⚠️ Do not add it back — two toggles on one screen is what that would produce.

                  The wrapper and the commented `ShareButton` are KEPT deliberately. Share is
                  mounted once, here, rather than beside each of the five layout components that
                  render their own heading — see the note above and the block comment in
                  `ShareButton.tsx`. Removing this container would lose that placement.
                */}
                <div className="ml-auto flex items-center gap-2">
                  {/* <ShareButton /> */}
                </div>
              </div>
              {children}
            </main>
          </SidebarProvider>
        </div>
      </div>
    </PageContextProvider>
  );
}

// ============================================
// OLD LAYOUT (before API consolidation)
// ============================================
// Previously, each component made its own API call:
// - AppHeader → /api/header-domains
// - AppSidebar → /api/sidebar + /api/page-sidebar
// - BreadcrumbDemo → /api/breadcrumb
//
// Total: 4 API calls per page load
//
// Now with PageContextProvider:
// - All components share data from ONE /api/page-context call
// - Total: 1 API call per page load
