import { ReactNode } from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';

/**
 * Admin shell (Phase G-1).
 * ============================================================================
 *
 * Replaces a hand-rolled `flex h-screen` with `bg-gray-50` / `bg-white` — a hardcoded
 * light theme that could not follow #21's dark mode, and with no mobile treatment at all.
 *
 * `SidebarProvider` owns the open/collapsed state and persists it to a cookie, so the
 * choice survives navigation and reloads. It also supplies the mobile breakpoint at which
 * the sidebar becomes a `Sheet` drawer — behaviour the old fixed `w-64` had none of.
 *
 * `SidebarInset` is the content region. It is not a plain `<div>`: it knows the sidebar's
 * width and animates its own margin as the rail collapses, which is what stops the layout
 * jumping on toggle.
 *
 * ⚠️ This stays a SERVER component. `AdminSidebar` and `AdminHeader` carry their own
 * `'use client'`, so marking this file client-side would pull every admin page into the
 * client bundle for nothing — the same boundary discipline as `ThemeProvider` in #21.
 */
type AdminLayoutProps = {
  children: ReactNode;
};

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <SidebarProvider>
      <AdminSidebar />
      {/*
        ⚠️ `min-w-0` IS LOAD-BEARING — without it the whole page scrolls sideways.
        ==========================================================================
        `SidebarInset` renders as `flex w-full flex-1 flex-col`. It is a flex ITEM sitting
        next to the sidebar, and a flex item's default `min-width: auto` refuses to shrink
        below its content's intrinsic width. So any wide child — `DomainFilters` has a
        `min-w-48` column plus two `min-w-32` ones — pushes this container wider than the
        viewport and produces a horizontal scrollbar on the document, dragging the header
        and sidebar out of view with it.

        `min-w-0` lets it shrink, so overflow is handled by whichever child owns it
        (`DomainsTable` already wraps itself in `overflow-x-auto`) instead of by the page.

        Passed as a `className` rather than edited into `components/ui/sidebar.tsx` — that
        is a vendored shadcn primitive and `shadcn add sidebar` would silently revert it.

        ⚠️ The inner `div` below ALSO has `min-w-0`. Both are needed: this one stops the
        inset growing inside the sidebar row, that one stops the content column growing
        inside the inset. Removing either brings the scrollbar back.
      */}
      <SidebarInset className="min-w-0">
        <AdminHeader />
        {/*
          `min-w-0` matters more than it looks: without it a wide child — the tables grid,
          a long code block — forces the flex item to grow, so the whole page scrolls
          horizontally instead of just that child.

          Padding lives here rather than in each page, so every screen is aligned by
          default and a new page cannot forget it.
        */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
