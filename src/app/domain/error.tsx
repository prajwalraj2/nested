'use client';

import { useEffect } from 'react';
import { ErrorContent } from '@/components/ErrorContent';

/**
 * Error boundary for everything under `/domain`.
 * ============================================================================
 *
 * WHAT THIS CATCHES, AND WHY IT IS NOT `not-found.tsx`
 * ---------------------------------------------------
 * `not-found.tsx` handles a DELIBERATE outcome: `notFound()` is called because a domain
 * or page genuinely does not exist. This file handles the UNPLANNED — a Neon cold start
 * timing out mid-render, a dropped connection, malformed data crashing a `.map()`. The
 * two are unrelated despite both being "the page didn't render".
 *
 * Placed at this level so the fallback keeps its NAVIGATION. Next.js wraps each
 * `error.tsx` in the layouts above it, so this renders inside `src/app/domain/layout.tsx`
 * and therefore still has the sidebar and breadcrumb. A root-level boundary alone would
 * have dropped the entire navigation on the most likely failure case — the same reasoning
 * that put a `not-found.tsx` in this directory.
 *
 * ⚠️ THIS DOES **NOT** CATCH ERRORS IN `domain/layout.tsx` ITSELF.
 * A boundary covers its segment's page and children, not the layout that wraps it — an
 * error thrown while rendering the layout has no working shell to render a fallback
 * inside, so React bubbles it to the PARENT boundary. That is why `src/app/error.tsx`
 * also exists. Concretely: a failure inside `PageContextProvider` or `AppSidebar` lands
 * there, not here.
 *
 * ⚠️ MUST BE A CLIENT COMPONENT. Error boundaries are a React client feature — they need
 * `useEffect` and an `onClick` handler. A Server Component cannot be one.
 */
export default function DomainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  /**
   * ⚠️ THIS LOGS TO THE BROWSER CONSOLE, NOT TO THE VERCEL LOGS.
   *
   * `useEffect` only ever runs on the client, and this is a Client Component, so there
   * is no server-side execution of this line at all. It is worth being precise because
   * the natural assumption is the opposite.
   *
   * The server side is already covered — and not by us. Next.js logs the real error
   * itself when a Server Component throws, which is where the digest comes from:
   *
   *     ⨯ Error: <the real message>
   *       digest: '3344484879'
   *
   * (Confirmed by reading the server log during a deliberately triggered throw.) So the
   * server has the stack trace and the client has this entry, and `error.digest` — shown
   * on screen as "Reference" — is what ties a user's report to that log line.
   *
   * This is therefore useful mainly for errors thrown in CLIENT components, where Next
   * logs nothing server-side and the browser console is the only record.
   *
   * In an effect rather than inline in the render body because a render can run more than
   * once (React strict mode, concurrent rendering) and logging from the body would
   * duplicate entries, making one failure look like several.
   */
  useEffect(() => {
    console.error('[domain] render error:', error);
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
