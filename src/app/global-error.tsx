'use client';

/**
 * ⚠️ REQUIRED. `global-error.tsx` REPLACES the root layout rather than rendering inside
 * it, so nothing else pulls in the stylesheet on this path — `src/app/layout.tsx` is the
 * only other importer of it in the whole app. Without this line the page still works but
 * renders as unstyled black-on-white HTML with every Tailwind class inert, because the
 * theme tokens (`--background`, `--foreground`, …) live in this file.
 *
 * Importing it twice across the app is harmless; the bundler deduplicates it.
 */
import './globals.css';

import { useEffect } from 'react';
import { ErrorContent } from '@/components/ErrorContent';

/**
 * Last-resort error boundary — for when the ROOT LAYOUT itself fails.
 * ============================================================================
 *
 * WHY THIS IS DIFFERENT FROM EVERY OTHER `error.tsx`
 * -------------------------------------------------
 * Every other boundary renders *inside* the layouts above it, so it inherits a working
 * `<html>` and `<body>`. This one cannot: the thing that renders those tags is precisely
 * what failed. So Next.js discards the entire root layout and hands the whole document to
 * this file — which means **it must render `<html>` and `<body>` itself.**
 *
 * Omitting them is the classic mistake here. The page does not error; it renders
 * *nothing*, because React has no document to mount into. That failure looks identical to
 * a blank white screen, which is exactly what you were trying to avoid.
 *
 * WHAT ACTUALLY REACHES THIS FILE
 * -------------------------------
 * Very little, and that is the point. `src/app/layout.tsx` is deliberately thin — fonts,
 * metadata, `<html>`/`<body>`. Realistically only a font-loading failure or a bad
 * `metadataBase` would land here. Everything with real logic in it (the providers, the
 * sidebars, the header) lives in `domain/layout.tsx` and `admin/layout.tsx`, whose
 * failures are caught one level up by `src/app/error.tsx`.
 *
 * So this is genuinely a last resort, not a common path. It exists because the
 * alternative — a completely blank page with no explanation — is the single worst thing
 * the site can show, and it costs one file to rule out.
 *
 * ⚠️ NO `next/font` IMPORT HERE, ON PURPOSE.
 * The root layout loads Geist, so this page falls back to the system sans-serif and looks
 * slightly different from the rest of the site. That is intentional: this is the boundary
 * for "the root layout failed", and a font is one of the few things in that layout that
 * *can* fail. Depending on it here would risk the fallback failing for the same reason as
 * the thing it is meant to replace. A different typeface on a page almost nobody will ever
 * see is a good trade for a fallback that cannot fail the same way.
 *
 * ⚠️ IN DEVELOPMENT THIS DOES NOT SHOW. `next dev` intercepts errors with its own overlay,
 * so a dev test proves nothing about this file. It was verified against a production
 * build.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // ⚠️ Browser console, NOT the Vercel logs — see the note in src/app/domain/error.tsx.
    //
    // `[global]` means the document shell itself failed, the most severe category there
    // is, and worth being able to filter for on its own.
    console.error('[global] root layout error:', error);
  }, [error]);

  return (
    // `lang="en"` repeated from the root layout: that file is not rendering, so nothing
    // else sets it, and a missing lang attribute is an accessibility failure screen
    // readers act on.
    <html lang="en">
      <body className="antialiased">
        <ErrorContent
          digest={error.digest}
          reset={reset}
          homeHref="/domain"
          homeLabel="Browse all domains"
        />
      </body>
    </html>
  );
}
