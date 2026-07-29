'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ThemeProviderProps } from 'next-themes';

/**
 * Theme provider — puts `.dark` on `<html>` so Tailwind's dark variant activates.
 * ============================================================================
 *
 * HOW DARK MODE IS WIRED IN THIS PROJECT
 * --------------------------------------
 * `src/app/globals.css:4` declares:
 *
 *     @custom-variant dark (&:is(.dark *));
 *
 * That is CLASS-based, not media-query based. Every `dark:` utility therefore applies
 * only when an ancestor element carries the class `dark` — which means the operating
 * system's dark setting did **nothing at all** before this component existed, and could
 * not have. The tokens were all sitting in `globals.css` (`:root` for light, `.dark` for
 * dark, all 31 at full parity) with nothing ever adding the class.
 *
 * `next-themes` was already in `package.json` at 0.4.6 but had never been imported
 * anywhere. This file is the missing wire.
 *
 * WHY A WRAPPER FILE INSTEAD OF USING NextThemesProvider DIRECTLY IN THE LAYOUT
 * ---------------------------------------------------------------------------
 * `next-themes` is a client-only library, and `src/app/layout.tsx` is a Server
 * Component. A Server Component cannot render a client component's provider without a
 * `'use client'` boundary somewhere. Putting `'use client'` in the root layout itself
 * would drag the ENTIRE app into the client bundle — every page would lose server
 * rendering. This one-file boundary keeps that contained: the provider is a client
 * component, `children` passed through it stay server-rendered.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      /**
       * Toggle a CLASS, not a data attribute — it must match the `&:is(.dark *)`
       * selector in globals.css. Using the default (`data-theme`) here would leave every
       * `dark:` utility permanently inactive, and the failure is silent: the toggle would
       * appear to work, `localStorage` would update, and nothing on screen would change.
       */
      attribute="class"
      /**
       * Follow the operating system by default. A visitor who has chosen dark mode
       * system-wide gets it on the first paint without touching anything; the toggle then
       * overrides that choice and persists it.
       */
      defaultTheme="system"
      enableSystem
      /**
       * Suppress CSS transitions for the instant the theme flips.
       *
       * WHY: several components animate `background-color` and `color` on hover. Without
       * this, switching theme animates every one of those properties simultaneously across
       * the whole page — a visible, sluggish colour-smear rather than an instant switch.
       * next-themes injects a temporary `* { transition: none }` rule for one frame.
       */
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
