import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import AppSidebar from "@/components/sidebar/app-sidebar"
import BreadcrumbDemo from "@/components/bread/bread"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/ThemeToggle";
import { PageContextProvider } from "@/contexts/PageContextProvider";

export default function DomainLayout({ children }: { children: ReactNode }) {
  return (
    // ============================================
    // NEW: PageContextProvider wraps everything
    // This provides unified data to all navigation components
    // (header, sidebar, breadcrumb) from a SINGLE API call
    // ============================================
    <PageContextProvider>
      <div className="flex flex-col min-h-screen">
        {/* Main content area with sidebar */}
        <div className="flex-1">
          <SidebarProvider>
            <AppSidebar />
            <main className="flex-1">
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
                <div className="ml-auto">
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
