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
      <SidebarInset>
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
