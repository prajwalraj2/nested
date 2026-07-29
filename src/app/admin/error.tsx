'use client';

import { useEffect } from 'react';
import { ErrorContent } from '@/components/ErrorContent';

/**
 * Error boundary for the admin panel — all 13 pages under `/admin`.
 * ============================================================================
 *
 * WHY THE ADMIN SIDE MATTERS MORE THAN THE PUBLIC SIDE HERE
 * --------------------------------------------------------
 * A public page that fails is annoying; the visitor reloads. An admin page that fails
 * during editing loses UNSAVED WORK, and until now did so with a bare unstyled 500 that
 * offered no explanation and no route back — the person could not even tell whether their
 * last save had gone through.
 *
 * Rendering inside `src/app/admin/layout.tsx` keeps the admin sidebar and header, so the
 * failure is contained to the content area and every other admin page stays one click
 * away. Note that layout wraps `SessionProvider` too, and `AdminLayout` needs no session
 * data to render its shell — so the fallback works even if the failure was session
 * related.
 *
 * ⚠️ Does NOT catch errors thrown in `admin/layout.tsx` itself (that means
 * `SessionProvider`, `AdminSidebar`, `AdminHeader`) — those bubble to
 * `src/app/error.tsx`. See the note in `domain/error.tsx` for why.
 *
 * ⚠️ This is a fallback, NOT an access control. Unauthorised admin access is handled by
 * `src/middleware.ts` and `requireAdmin()` in the route handlers. If a permissions bug
 * ever surfaced as a thrown error, this page would show "something went wrong" — which
 * is the right thing for a boundary to do, but it must never be mistaken for the guard.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // ⚠️ Browser console, NOT the Vercel logs — `useEffect` only runs on the client. Next
    // logs the server-side error and its digest by itself. See the fuller note in
    // src/app/domain/error.tsx.
    //
    // Tagged `[admin]` so admin failures are distinguishable from public ones at a glance.
    console.error('[admin] render error:', error);
  }, [error]);

  return (
    <ErrorContent
      digest={error.digest}
      reset={reset}
      homeHref="/admin"
      // "Browse all domains" would be wrong here — this is the CMS, not the public site.
      homeLabel="Back to dashboard"
    />
  );
}
