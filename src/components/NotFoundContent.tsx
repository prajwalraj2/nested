import Link from 'next/link';

/**
 * Shared body for both 404 pages.
 * ============================================================================
 *
 * WHY TWO not-found FILES SHARE THIS
 * ----------------------------------
 * Next.js renders the NEAREST `not-found.tsx` in the route tree, and each one is
 * wrapped by that segment's layout. That matters here because `src/app/domain/layout.tsx`
 * provides the sidebar and breadcrumb:
 *
 *   src/app/not-found.tsx         -> root layout only. Unknown URLs like /foo.
 *   src/app/domain/not-found.tsx  -> keeps the sidebar and breadcrumb, so a visitor
 *                                    who mistypes /domain/gdesignn can still navigate.
 *
 * A root-only 404 would have dropped the entire navigation on the most common failure
 * case — a bad `/domain/...` path, which is also what `notFound()` in
 * `src/app/domain/[...slug]/page.tsx` triggers.
 *
 * ⚠️ DELIBERATELY NO DATABASE QUERY.
 * It would be friendlier to list the available domains here, but 404s are exactly the
 * URLs that bots and broken crawlers hammer. Querying on every one turns a stream of
 * bad requests into database load, which is a cheap way to make a scraper expensive for
 * you rather than for them. Static markup costs nothing to serve.
 *
 * Uses the same shadcn tokens as the rest of the site (`bg-background`,
 * `text-foreground`, `text-muted-foreground`) so it inherits light/dark handling
 * instead of hardcoding colours.
 */
export function NotFoundContent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background px-6 py-16">
      <div className="max-w-md text-center">
        {/* Large but muted — this is context, not the message itself. */}
        <p className="text-6xl font-bold tracking-tight text-muted-foreground/40">404</p>

        <h1 className="mt-4 text-2xl font-semibold text-foreground">
          This page doesn&apos;t exist
        </h1>

        <p className="mt-3 text-muted-foreground">
          The link may be out of date, or the address might have a typo in it.
        </p>

        {/*
          One action, not several. `/` only 308-redirects to `/domain`, so offering
          both "Home" and "Browse domains" would be two links to the same place.

          Rendered as a real <Link> so client-side navigation applies and the sidebar
          state survives on the domain-scoped variant.
        */}
        <Link
          href="/domain"
          className="mt-8 inline-flex items-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Browse all domains
        </Link>
      </div>
    </div>
  );
}
