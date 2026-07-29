'use client';

import Link from 'next/link';

/**
 * Shared body for every error boundary.
 * ============================================================================
 *
 * Deliberately mirrors `NotFoundContent.tsx`: two 404 pages already share one body
 * component, and four error boundaries have the same reason to. Without this, the copy
 * and styling would drift apart across four files and nobody would notice, because these
 * pages are by definition rarely seen.
 *
 * ⚠️ NO SHADCN `ui/` IMPORTS, ON PURPOSE.
 * `global-error.tsx` renders OUTSIDE the root layout — it replaces the whole document —
 * so anything relying on a provider, context or the layout's font variables is a
 * liability there. Raw elements plus theme tokens (`bg-background`, `text-foreground`,
 * `text-muted-foreground`) work identically in all four boundaries, and inherit
 * light/dark handling from `globals.css` instead of hardcoding colours.
 *
 * ⚠️ `'use client'` is required: this renders an `onClick`. It would be pulled into the
 * client bundle anyway by its callers (every `error.tsx` is a Client Component), but
 * saying so explicitly stops someone later importing it from a Server Component and
 * getting a confusing build error.
 */

type ErrorContentProps = {
  /**
   * `error.digest` from the boundary.
   *
   * ⚠️ WHY WE SHOW A HASH INSTEAD OF THE ERROR MESSAGE.
   *
   * In production Next.js **strips the message** from any error thrown in a Server
   * Component before it reaches the browser, replacing it with a generic string. That
   * is a deliberate security measure — a raw message can carry table names, file paths
   * or connection details. What survives is `digest`, a hash that matches the full
   * stack trace in the Vercel logs.
   *
   * So printing `error.message` would show visitors nothing useful in production while
   * looking informative in development — the worst combination. The digest is the one
   * piece that actually lets a real failure be traced: read it off the screen, search
   * the logs for it, get the stack.
   *
   * Optional because errors thrown in a Client Component have no digest (they were
   * never serialised across the boundary), in which case there is nothing to show.
   */
  digest?: string;

  /**
   * Re-renders the failed segment. Provided by Next.js to every `error.tsx`.
   *
   * Worth being realistic about what this fixes: it retries the SAME render. For a
   * transient cause — a Neon cold-start timing out, a dropped connection — that
   * genuinely works. For a deterministic bug it will fail again immediately, which is
   * why there is always a navigation escape next to it rather than this alone.
   */
  reset: () => void;

  /** Where the escape link goes. `/domain` for public pages, `/admin` for admin. */
  homeHref: string;

  /** Label for that link — "Browse all domains" reads wrong inside the admin panel. */
  homeLabel: string;
};

export function ErrorContent({ digest, reset, homeHref, homeLabel }: ErrorContentProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background px-6 py-16">
      <div className="max-w-md text-center">
        {/*
          Large but muted, matching the `404` treatment in NotFoundContent — this is
          context, not the message. "500" is accurate enough: these boundaries catch
          render-time failures, which Next.js serves as a 500.
        */}
        <p className="text-6xl font-bold tracking-tight text-muted-foreground/40">500</p>

        <h1 className="mt-4 text-2xl font-semibold text-foreground">
          Something went wrong
        </h1>

        <p className="mt-3 text-muted-foreground">
          This page failed to load. It may be a temporary problem — trying again often
          fixes it.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {/*
            A plain <button>, not a <Link>: this re-runs the render in place rather than
            navigating. `type="button"` because an error page could in principle be
            rendered inside a form, where the default `submit` would do something wildly
            unexpected.
          */}
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Try again
          </button>

          {/*
            The escape hatch. Present because `reset()` cannot help with a deterministic
            failure — without this, a visitor on a permanently-broken page has no way out
            except editing the URL.
          */}
          <Link
            href={homeHref}
            className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {homeLabel}
          </Link>
        </div>

        {/*
          Shown only when there is a digest. Small and muted because it is for us, not
          the visitor — but it is on the page rather than hidden in a comment so that
          someone reporting a problem can quote it, which turns "a page broke" into an
          exact log lookup.
        */}
        {digest && (
          <p className="mt-8 font-mono text-xs text-muted-foreground/70">
            Reference: {digest}
          </p>
        )}
      </div>
    </div>
  );
}
