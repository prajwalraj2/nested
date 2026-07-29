'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

/**
 * Light/dark toggle button.
 * ============================================================================
 *
 * ⚠️ THE `mounted` GUARD IS NOT OPTIONAL — WITHOUT IT THIS COMPONENT IS BROKEN
 *
 * The active theme lives in `localStorage`, which does not exist on the server. So during
 * server rendering `resolvedTheme` is `undefined`, and the server has no way to know
 * whether to draw a sun or a moon. Whatever it guesses, the client will often disagree
 * once it reads storage — and React reports that as a hydration mismatch.
 *
 * The fix is to render a placeholder of the SAME SIZE until the component has mounted on
 * the client, then swap in the real icon. Same size matters: returning `null` would make
 * the surrounding flex row reflow the moment hydration completes, so the breadcrumb bar
 * would visibly jump on every page load.
 *
 * `useEffect` runs only after mount, which is exactly the signal we need.
 *
 * WHY `resolvedTheme` AND NOT `theme`
 * -----------------------------------
 * `theme` can be the literal string `"system"`, which is not an icon we can draw — there
 * is no way to render "follow the OS". `resolvedTheme` is always concretely `"light"` or
 * `"dark"`, having already resolved the system preference. Reading `theme` here would
 * leave the button showing the wrong icon for anyone on the default setting, which is
 * everyone until they first click it.
 *
 * WHY THIS IS A TWO-STATE TOGGLE AND NOT A THREE-WAY MENU
 * ------------------------------------------------------
 * A light/dark/system dropdown is more capable but needs a popover, and this sits in the
 * breadcrumb bar where space is tight. Defaulting to `system` in ThemeProvider already
 * gives the OS-following behaviour for free; clicking simply takes over from it. If a
 * "reset to system" option is ever wanted, `setTheme('system')` is all it needs.
 */
export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === 'dark';

  // Shared so the placeholder and the real button occupy identical space.
  const buttonClasses =
    'inline-flex h-9 w-9 items-center justify-center rounded-md border border-border ' +
    'text-foreground transition-colors hover:bg-accent hover:text-accent-foreground ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer';

  if (!mounted) {
    return (
      <div
        className={buttonClasses}
        // Hidden from assistive tech: it is a spacer, not a control. Announcing an
        // unlabelled button that does nothing would be worse than announcing nothing.
        aria-hidden="true"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={buttonClasses}
      /**
       * The label describes the ACTION, not the current state — a screen-reader user
       * needs to know what pressing it does. `title` gives sighted users the same on
       * hover, since the icon alone is ambiguous (does a moon mean "is dark" or
       * "switch to dark"?).
       */
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {/*
        Show the icon for the theme you would GET by clicking, which is the convention
        users expect: a sun while dark (click for light), a moon while light.
        `aria-hidden` because the button's own label already carries the meaning —
        without it, some screen readers announce the icon as extra noise.
      */}
      {isDark ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
