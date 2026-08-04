import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import AppSidebar from "@/components/sidebar/app-sidebar"
import BreadcrumbDemo from "@/components/bread/bread"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/ThemeToggle";
import { ShareButton } from "@/components/domain/ShareButton";
import { PageContextProvider } from "@/contexts/PageContextProvider";
import { ClarityAnalytics } from "@/components/analytics/ClarityAnalytics";

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
              <div className="flex items-center gap-2 p-4 m-4 border rounded-lg bg-background z-10 sticky top-0">
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
                <div className="ml-auto flex items-center gap-2">
                  {/* <ShareButton /> */}
                  <ThemeToggle />
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
