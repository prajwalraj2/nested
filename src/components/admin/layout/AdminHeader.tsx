'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { buildAdminBreadcrumb } from './admin-nav';

/**
 * Admin header — reduced to a breadcrumb bar (Phase G-1).
 * ============================================================================
 *
 * WHAT THIS REPLACES, AND WHY IT SHRANK
 * -------------------------------------
 * The old header carried a page title, a description, quick-action buttons, and a user
 * dropdown, on `bg-white border-gray-200`. Four things were wrong with that:
 *
 *   1. **It duplicated every page's own `<h1>`.** Each admin page already renders its
 *      title and description; the header printed them again from a hand-maintained
 *      `PAGE_INFO` map.
 *   2. **That map had drifted.** It described `/admin/editor` — a route that does not
 *      exist — and its breadcrumbs inserted the sidebar's *group* name as a crumb
 *      ("Admin › Content › Tables"), implying a `/admin/content` page that has never
 *      existed. Both are gone; see `admin-nav.ts`.
 *   3. **The user menu belonged with the user**, not above the content. It now lives in
 *      the sidebar footer with the theme toggle.
 *   4. **Hardcoded light** (`bg-white`), so it could not follow the theme.
 *
 * What remains is what a header is actually for: where am I, and what can I do here.
 *
 * `pageActions` is the slot for the second half. It is deliberately a prop rather than
 * another route map — the page that owns the action should own the button, so a new
 * screen cannot forget to register itself somewhere else.
 */
type AdminHeaderProps = {
  /**
   * Resolved name for the final breadcrumb crumb on a detail route, so the table editor
   * reads `Admin › Tables › Logo Makers` rather than exposing an id. Passed down by the
   * page that has already loaded the record.
   */
  recordName?: string | null;
  /** Page-level actions, rendered right-aligned. e.g. a "New table" button. */
  pageActions?: React.ReactNode;
};

export function AdminHeader({ recordName, pageActions }: AdminHeaderProps) {
  const pathname = usePathname();
  const crumbs = buildAdminBreadcrumb(pathname, recordName);

  return (
    /**
     * `sticky top-0` so the breadcrumb stays visible while scrolling a long table — the
     * old header scrolled away, which on the tables screen meant losing your place with no
     * indication of where you were.
     *
     * `h-12` fixed, so page content can rely on a stable offset. Shadcn's dashboard
     * convention is `h-16`, but this bar holds a single line of breadcrumb text — 64px
     * made it a band of empty space above every screen, and was part of why the panel
     * read as oversized at 100% zoom.
     *
     * (original note) matching the shadcn dashboard convention, so page content can rely on
     * a stable offset.
     */
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
      {/* The collapse control. `-ml-1` optically aligns it with the content below. */}
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />

      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <React.Fragment key={`${crumb.label}-${i}`}>
                <BreadcrumbItem>
                  {/*
                    The last crumb is the page you are on, so it is rendered as text rather
                    than a link — a self-link is noise, and `BreadcrumbPage` also carries
                    `aria-current="page"` for screen readers.

                    A crumb with `href: null` that is NOT last can still occur (a section
                    root), so both conditions are checked rather than assuming.
                  */}
                  {isLast || !crumb.href ? (
                    <BreadcrumbPage className="truncate max-w-[40ch]">
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </React.Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      {/* `ml-auto` so actions sit right regardless of how long the trail is. */}
      {pageActions && <div className="ml-auto flex items-center gap-2">{pageActions}</div>}
    </header>
  );
}
