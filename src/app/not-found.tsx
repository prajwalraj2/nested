import type { Metadata } from 'next';
import { NotFoundContent } from '@/components/NotFoundContent';

/**
 * Root 404 — replaces Next.js's built-in black-and-white default.
 * ============================================================================
 *
 * Catches any URL that matches no route at all (e.g. `/foo`, `/admin/typo`), and is
 * the fallback for any `notFound()` call in a segment that has no closer
 * `not-found.tsx`. Bad `/domain/...` paths are handled by
 * `src/app/domain/not-found.tsx` instead, which keeps the sidebar.
 *
 * Next.js returns a real **HTTP 404** for this page automatically — no status code to
 * set by hand. That matters more than the visuals: a "not found" page served with 200
 * is a soft 404, which Google treats as a quality problem because it cannot tell the
 * difference between a missing page and a real one.
 */
export const metadata: Metadata = {
  title: 'Page not found',
  // Belt-and-braces. The 404 status alone already keeps this out of the index —
  // Google does not index pages that return 404 — but if the status were ever to
  // change, this would still hold the line.
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return <NotFoundContent />;
}
