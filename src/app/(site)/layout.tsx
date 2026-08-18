// src/app/(site)/layout.tsx

import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/header/SiteHeader';

/**
 * Layout for the standalone public pages — About, Contact, Privacy, Terms, and later the blog,
 * changelog, careers and forms (M-3).
 * ============================================================================
 *
 * ⚠️ `(site)` IS A ROUTE GROUP — THE PARENTHESES MEAN IT DOES NOT APPEAR IN ANY URL.
 * `src/app/(site)/about/page.tsx` serves `/about`, not `/site/about`. It exists purely so these
 * pages can share a layout without the domain tree inheriting it, and without moving the domain
 * tree into a group of its own.
 *
 * ⚠️ THE HEADER IS RENDERED IN TWO LAYOUTS — here and in `domain/layout.tsx` — RATHER THAN IN THE
 * ROOT LAYOUT.
 *
 * The root layout also wraps `/admin`, `/login` and `/unauthorized`. A public marketing header
 * above the admin panel would be wrong, and a server component cannot read the pathname to
 * exclude itself. Two layouts rendering one shared component is the honest version of that: the
 * duplication is a single line, and it is explicit about which areas are "the public site".
 *
 * ⚠️ NO FOOTER YET. The design has one (Domains, Company, Social, Resources), and it is the
 * natural home for links that do not earn header space. Deliberately not folded into M-3 — it is
 * its own piece of work, and these pages read fine without it in the meantime.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      {/*
        ⚠️ `min-w-0` for the same reason `domain/layout.tsx` documents at length: a flex child
        defaults to `min-width: auto`, so one wide element inside would push the whole document
        sideways rather than scrolling itself.
      */}
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
