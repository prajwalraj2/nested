'use client';

import { useEffect } from 'react';
import { ErrorContent } from '@/components/ErrorContent';

/**
 * Root error boundary — the catch-all beneath `global-error.tsx`.
 * ============================================================================
 *
 * THIS FILE EXISTS FOR A SPECIFIC, EASY-TO-MISS REASON
 * ---------------------------------------------------
 * An `error.tsx` catches failures in its segment's page and children — but NOT in the
 * layout that wraps it. When a layout throws there is no rendered shell to put a fallback
 * inside, so React bubbles the error to the parent boundary instead.
 *
 * Which means without this file, a failure in `domain/layout.tsx` or `admin/layout.tsx`
 * would skip straight past their sibling `error.tsx` files to `global-error.tsx` — a
 * full-page takeover with no navigation at all. Those layouts are not trivial:
 * `PageContextProvider`, `AppSidebar` and `bread.tsx` on the public side;
 * `SessionProvider`, `AdminSidebar` and `AdminHeader` on the admin side. A throw in any
 * of them arrives HERE.
 *
 * It also covers the routes that have no closer boundary of their own:
 *
 *   /login          — the sign-in form
 *   /unauthorized   — the access-denied page
 *   /               — the 308 redirect to /domain
 *
 * ⚠️ WHY THE `/` REDIRECT DOES NOT BREAK
 * `src/app/page.tsx` calls `redirect('/domain')`, and `redirect()` works by THROWING a
 * special internal error (`NEXT_REDIRECT`) that Next.js catches further up. The same is
 * true of `notFound()`, which `domain/[...slug]/page.tsx` calls in five places. If a
 * boundary swallowed those, every 404 would become a 500 and the site's entry point would
 * stop working — a spectacular regression from adding what looks like a harmless fallback.
 *
 * React re-throws these control-flow errors rather than treating them as failures, so
 * `not-found.tsx` and the redirect still win. **That was verified rather than taken from
 * the documentation**: `/` still returns 308, `/nonexistent` still returns 404, and
 * `/domain/does-not-exist` still returns 404 with its sidebar intact.
 *
 * The fallback here renders inside the ROOT layout only, so it has the fonts and global
 * styles but no sidebar — correct, since the thing that would have drawn the sidebar is
 * very likely what just failed.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // ⚠️ Browser console, NOT the Vercel logs — see the note in src/app/domain/error.tsx.
    //
    // `[root]` is a meaningful signal, not just a label: reaching this boundary means a
    // LAYOUT or a top-level route failed, which is a broader outage than one page
    // erroring. Worth being able to spot immediately.
    console.error('[root] render error:', error);
  }, [error]);

  return (
    <ErrorContent
      digest={error.digest}
      reset={reset}
      homeHref="/domain"
      homeLabel="Browse all domains"
    />
  );
}
