'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
// Only real UI icons come from lucide. Every BRAND mark is inline — see BrandIcon below.
import { Check, Copy, Share2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
// SITE_URL, not window.location.origin — see the block on canonical URLs below. This is
// the single source of truth for the canonical origin, shared with every page's metadata.
import { SITE_URL } from '@/lib/seo'

/**
 * Share control for public pages.
 * ============================================================================
 *
 * Mounted ONCE, in the sticky breadcrumb bar in `src/app/domain/layout.tsx`, beside
 * `ThemeToggle`.
 *
 * ⚠️ WHY IT LIVES IN THE LAYOUT AND NOT NEXT TO EACH PAGE'S <h1>
 * Every public content type renders its own heading — `SectionBasedLayout`,
 * `TableLayout`, `RichTextLayout`, `NarrativeLayout`, `SubcategorySelector`. Putting a
 * share button beside the heading would mean FIVE implementations, and five things to
 * keep in step. That is the same duplication G-1 had to unpick when the sidebar's
 * `NAVIGATION_ITEMS` and the header's `PAGE_INFO` drifted apart.
 *
 * The breadcrumb bar is the one piece of chrome every public page shares, it is `sticky`
 * so it is reachable without scrolling, and it already covers domain roots, nested pages
 * and the `/domain` index. One mount point, no drift.
 */

/**
 * Brand marks for X and WhatsApp, as inline SVG.
 * ============================================================================
 *
 * ⚠️ WHY NO BRAND MARK HERE COMES FROM lucide — two separate problems, both found late.
 *
 * **1. lucide's `X` is the wrong glyph.** The first version of this file imported `X` from
 * lucide-react for the X share item. It compiles, because `X` is a genuine lucide export —
 * but lucide's `X` is
 *
 *     M18 6 6 18   +   m6 6 12 12
 *
 * i.e. two crossing diagonal lines: the **close / dismiss cross**, not the X brand logo. A
 * share menu whose X item renders what every UI on earth uses for "close" is worse than no
 * icon at all. A type checker cannot catch this — the name is valid, the meaning is not.
 *
 * **2. lucide is REMOVING brand marks.** `Linkedin` does exist and is genuinely the right
 * glyph, but it is marked `@deprecated`. Depending on it would mean a build that breaks on
 * some future `lucide-react` bump, for an icon that was never really lucide's job — it is
 * an interface-icon set, not a brand-logo set.
 *
 * So all three are inline and consistent, and lucide supplies only real UI icons here
 * (`Copy`, `Check`, `Share2`). The alternatives considered:
 *   - lucide's `Twitter` (the bird) — recognisable, but three years out of date
 *   - text-only menu items — clear, but harder to scan
 *   - the real paths, inline — accurate, ~2 lines each, no dependency, no deprecation
 *
 * Brand recognition is the entire point of these icons, so accuracy wins. Paths are the
 * standard 24×24 official marks.
 *
 * `currentColor` on `fill` is what lets them inherit the menu item's text colour and so
 * follow light/dark mode — the same reason #21 replaced the admin nav's emoji with lucide.
 */
function BrandIcon({ path, label }: { path: string; label: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="currentColor"
      // The adjacent <span> already names the platform, so the icon is decorative.
      // Labelling it too makes screen readers announce "WhatsApp WhatsApp".
      aria-hidden="true"
      role="img"
      data-brand={label}
    >
      <path d={path} />
    </svg>
  )
}

/** Official X mark, 24×24. */
const X_PATH =
  'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z'

/** Official WhatsApp mark, 24×24. */
const WHATSAPP_PATH =
  'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.795-1.48-1.77-1.653-2.068-.173-.297-.018-.458.13-.606.134-.133.347-.347.52-.52.174-.174.232-.297.347-.495.115-.198.057-.372-.015-.52-.072-.149-.669-1.611-.916-2.207-.24-.578-.487-.5-.669-.51-.172-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413'

/**
 * Official LinkedIn mark, 24×24.
 *
 * ⚠️ Replaces lucide's `Linkedin`, which is the correct glyph but carries an
 * `@deprecated` marker — see problem 2 in the block above.
 */
const LINKEDIN_PATH =
  'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z'

/**
 * The canonical, shareable URL for the current page.
 * ============================================================================
 *
 * ⚠️ BUILT FROM `SITE_URL`, **NOT** FROM `window.location.href`. THIS IS THE WHOLE POINT.
 *
 * Production is served on TWO hostnames — `atno.io` and `nested-two.vercel.app`. The
 * `metadataBase` block in `src/app/layout.tsx` exists precisely because of that: without
 * a pinned origin, Google sees two complete copies of the site and splits the ranking
 * signals between them.
 *
 * `window.location.href` would hand out whichever hostname the sharer happened to be
 * browsing. So anyone who reached the site via `nested-two.vercel.app` would spread links
 * to the non-canonical host — and shared links are exactly how backlinks form. That would
 * actively recreate the duplicate-content problem `metadataBase` was added to prevent,
 * using the site's own share button as the vector.
 *
 * Building from `SITE_URL` makes it correct by construction: every shared link points at
 * `https://atno.io/...` no matter where it was shared from.
 *
 * ⚠️ It also means a link shared from LOCALHOST points at production, not at
 * `localhost:3000`. That is deliberate and is the desirable behaviour — a localhost URL is
 * useless to a recipient — but it will look wrong the first time you test it in dev.
 */
function useCanonicalUrl(): string {
  const pathname = usePathname()
  return `${SITE_URL}${pathname}`
}

/**
 * How long the "Copied!" confirmation stays visible.
 *
 * There is no toast library in this project (no sonner, no react-hot-toast), so feedback
 * is an in-place icon and label swap. That is not a workaround — for a single binary
 * "it worked" signal it is less intrusive than a toast, and it avoids a dependency.
 */
const COPIED_FEEDBACK_MS = 2000

type CopyState = 'idle' | 'copied' | 'error'

type ShareButtonProps = {
  /**
   * How the trigger renders.
   *
   *   'icon'      36px square, icon only — for the sticky breadcrumb bar
   *   'labelled'  `⧉ Share` with text  — for `PageHeading`, beside the <h1>
   *
   * ⚠️ BOTH ARE MOUNTED AT ONCE, AND THAT IS THE DESIGN — not a duplicate to clean up.
   * They cover different moments:
   *
   *   labelled (heading)    DISCOVERY. The eye lands on the <h1> first, and a labelled
   *                         control there is actually noticed. An icon buried in a
   *                         breadcrumb bar is not — and a share button nobody sees
   *                         generates no shares, which matters for a directory that grows
   *                         by being shared.
   *   icon (breadcrumb bar) AVAILABILITY. That bar is `sticky`, so it is still reachable
   *                         80 rows into a table — which is exactly when someone decides a
   *                         page is worth sending. The heading button has scrolled away.
   *
   * They are visually differentiated (label vs icon) specifically so that seeing both at
   * the top of a page reads as primary + utility rather than as the same button twice.
   */
  variant?: 'icon' | 'labelled'
}

export function ShareButton({ variant = 'icon' }: ShareButtonProps = {}) {
  const url = useCanonicalUrl()
  const [copyState, setCopyState] = useState<CopyState>('idle')

  /**
   * Holds the pending feedback-reset timer so it can be cancelled on unmount.
   *
   * Without this, navigating away within the feedback window leaves a `setState` queued
   * against an unmounted component — harmless in React 19, but it is a real leak of a
   * timer and the cleanup costs two lines.
   */
  const resetTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
    }
  }, [])

  const flashState = useCallback((state: CopyState) => {
    setCopyState(state)
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
    resetTimer.current = window.setTimeout(() => setCopyState('idle'), COPIED_FEEDBACK_MS)
  }, [])

  const copyLink = useCallback(async () => {
    /**
     * ⚠️ `navigator.clipboard` requires a SECURE CONTEXT — https, or localhost. It is
     * therefore absent over plain http, which is why the failure is handled visibly
     * rather than swallowed. Production is https so this should never fire; a silent
     * no-op would be indistinguishable from a broken button if it ever did.
     */
    try {
      await navigator.clipboard.writeText(url)
      flashState('copied')
    } catch (error) {
      console.error('[share] clipboard write failed:', error)
      flashState('error')
    }
  }, [url, flashState])

  /**
   * The share text for platforms that accept one.
   *
   * ⚠️ Read from `document.title` at CLICK time, not from React state or the page
   * context. Two reasons:
   *
   *   1. `usePageContextValue().currentPage?.title` is only populated in 'page' mode,
   *      AFTER the page-sidebar fetch resolves — so it is `undefined` on domain roots and
   *      briefly undefined everywhere else. `document.title` is always present.
   *   2. Reading it in a handler rather than during render means it cannot cause a
   *      hydration mismatch.
   *
   * The value already reads well for sharing, because the metadata template built it that
   * way: "YouTube Playlists · Graphic Designing · ATNO".
   */
  const getShareText = () => (typeof document === 'undefined' ? '' : document.title)

  /**
   * Platform share endpoints.
   *
   * Each opens in a new tab with `rel="noopener noreferrer"` — `noopener` stops the
   * opened page reaching back through `window.opener` and navigating the original tab.
   *
   * ⚠️ THIS USED TO SAY "the same protection `sanitize-html.ts` adds to every
   * `target="_blank"` link in rich text". THAT IS NO LONGER TRUE — sanitisation was removed
   * on 15 Aug 2026 (#35), and with it the hook that added `rel` automatically. Rich-text
   * links now carry only whatever `rel` the author typed, which for existing content is
   * none. See `RICH-TEXT-GUIDE.md`; adding it by hand is now the author's job.
   *
   * These buttons are unaffected — the `rel` here is written into this file.
   *
   * ⚠️ LINKEDIN TAKES NO TEXT PARAMETER. It deliberately ignores any it is given and
   * builds the preview from the page's Open Graph tags instead. That works here only
   * because #14/SEO-A shipped `og:title`, `og:description` and `og:image` — before that,
   * a LinkedIn share of this site rendered a bare URL. It is worth knowing that this one
   * menu item depends on server-side metadata rather than on anything in this file.
   */
  const shareTargets = [
    {
      label: 'WhatsApp',
      icon: <BrandIcon path={WHATSAPP_PATH} label="WhatsApp" />,
      // wa.me with no phone number opens the contact picker rather than a fixed recipient.
      href: () => `https://wa.me/?text=${encodeURIComponent(`${getShareText()} ${url}`)}`,
    },
    {
      label: 'X',
      icon: <BrandIcon path={X_PATH} label="X" />,
      // `x.com/intent/post` is the current endpoint; `twitter.com/intent/tweet` still
      // works but 301s here, so using it directly saves a redirect hop.
      href: () =>
        `https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(getShareText())}`,
    },
    {
      label: 'LinkedIn',
      icon: <BrandIcon path={LINKEDIN_PATH} label="LinkedIn" />,
      // No text param — see the note above. LinkedIn reads the OG tags.
      href: () =>
        `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    },
  ]

  /**
   * Matches `ThemeToggle`'s classes exactly so the two controls are the same size and
   * share hover/focus behaviour. Copied rather than extracted: two consumers is not
   * enough to justify a shared module, and they sit side by side where a divergence
   * would be immediately visible.
   *
   * ⚠️ NOTE THERE IS NO `mounted` GUARD, unlike `ThemeToggle`. That component needs one
   * because its APPEARANCE depends on `localStorage`, which does not exist on the server,
   * so the server cannot know which icon to draw. Nothing here is server-unknowable: the
   * icon is fixed, and the URL comes from `usePathname()` plus a constant. Capability and
   * `document.title` are only consulted inside click handlers, never during render — so
   * there is no mismatch to guard against. Do not add one by analogy.
   */
  const sharedTriggerClasses =
    'inline-flex h-9 items-center rounded-md border border-border ' +
    'text-foreground transition-colors hover:bg-accent hover:text-accent-foreground ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer'

  const triggerClasses =
    variant === 'labelled'
      ? // `h-9` matches the icon variant exactly, so the two are the same height wherever
        // they appear together. `text-sm font-medium` matches the app's other buttons.
        `${sharedTriggerClasses} gap-2 px-3 text-sm font-medium`
      : // Square. `w-9` with `h-9` from the shared string gives the same 36px box as
        // ThemeToggle, which sits immediately beside it in the breadcrumb bar.
        `${sharedTriggerClasses} w-9 justify-center`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={triggerClasses}
        /**
         * ⚠️ `aria-label` is "Share this page" in BOTH variants, even though the labelled
         * one already shows the word "Share".
         *
         * The visible label can afford to be terse because its POSITION supplies the
         * context — it sits beside the page's own <h1>, so "this page" is self-evident.
         * A screen reader user gets no such spatial cue; they hear a list of controls out
         * of context, where a bare "Share" is ambiguous. The fuller label costs sighted
         * users nothing and tells everyone else what is actually being shared.
         *
         * `title` is set only on the icon variant — on the labelled one it would produce a
         * browser tooltip that merely repeats the text already on screen.
         */
        aria-label="Share this page"
        title={variant === 'icon' ? 'Share this page' : undefined}
      >
        <Share2 className="h-4 w-4" aria-hidden="true" />
        {/*
          Kept short deliberately. "Share this page" would be 15 characters sitting beside
          headings like "Defining Services | Pricing | Offers", and the position already
          says which page it means — that is the whole advantage of heading placement over
          the breadcrumb bar.
        */}
        {variant === 'labelled' && <span>Share</span>}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        {/*
          Copy sits first and above the separator: it is the only option that works
          regardless of which apps or accounts the visitor has, so it is the safe default
          rather than one platform among four.

          `onSelect` with `preventDefault` keeps the menu OPEN after clicking, so the
          "Copied!" confirmation is actually visible. Radix closes the menu on select by
          default, which would dismiss the feedback in the same frame it appeared.
        */}
        <DropdownMenuItem
          /**
           * `cursor-pointer` because Radix's `DropdownMenuItem` ships no cursor of its own,
           * so it inherits `default` — an arrow, not a hand. The three brand items below
           * already read as clickable only because they render as real `<a>` elements with
           * this same class; this one is a plain item with an `onSelect`, so it was the odd
           * one out and looked unclickable.
           *
           * ⚠️ Set HERE rather than in `src/components/ui/dropdown-menu.tsx`. That is a
           * vendored shadcn primitive, and `shadcn add dropdown-menu` would silently revert
           * an edit made there — the same trap noted on `min-w-0` in
           * `src/components/admin/layout/AdminLayout.tsx`. If every dropdown in the app
           * ever needs this, the right move is a wrapper component, not editing the vendored
           * file.
           */
          className="cursor-pointer"
          onSelect={(event) => {
            event.preventDefault()
            void copyLink()
          }}
        >
          {copyState === 'copied' ? (
            <Check className="h-4 w-4 text-green-600 dark:text-green-500" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
          {/*
            `aria-live="polite"` so a screen reader announces the result of the copy. The
            label text itself changes, which sighted users see; without the live region
            that change is silent to assistive tech.
          */}
          <span aria-live="polite">
            {copyState === 'copied'
              ? 'Copied!'
              : copyState === 'error'
                ? 'Copy failed'
                : 'Copy link'}
          </span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {shareTargets.map(({ label, icon, href }) => (
          <DropdownMenuItem key={label} asChild>
            {/*
              `asChild` makes the menu item render AS the anchor rather than wrapping one.
              That matters for more than markup tidiness: a real `<a href>` can be
              middle-clicked, copied, and opened in a new tab by the browser's own means,
              none of which work on a div with an onClick.

              `href` is a function so the URL is built at RENDER of the open menu, picking
              up the current `document.title`. Building it at module scope would capture
              whatever the title was on first load and share the wrong page name after any
              client-side navigation.
            */}
            <a
              href={href()}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer"
            >
              {icon}
              <span>{label}</span>
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * ---------------------------------------------------------------------------
 * ⚠️ NOT IMPLEMENTED, AND DELIBERATELY SO: hiding this on geo-restricted pages
 * ---------------------------------------------------------------------------
 * A page with `targetCountries: ["IN"]` shared to someone in the US renders `notFound()`.
 * So on geo-restricted content this button is a mechanism for spreading dead links — the
 * same failure the sitemap avoids by listing only `ALL`-targeted URLs (finding #15.4).
 *
 * It is not handled yet because **there is currently no geo-restricted content** — every
 * Domain and Page row is `["ALL"]`, so the check would be a no-op today, and an untested
 * no-op is worse than a documented gap.
 *
 * When geo-targeted content does land, the predicate already exists:
 * `isGloballyIndexable(domain.targetCountries, page.targetCountries)` in `src/lib/seo.ts`.
 * The awkward part is that it needs the row data, which this component does not have —
 * the breadcrumb bar knows the path, not the record. Options at that point:
 *
 *   1. Pass a `shareable` boolean down from the page (accurate, but threads a prop
 *      through the layout, which is why it was not done pre-emptively).
 *   2. Read `currentPage` from `usePageContextValue()` — but that is only populated in
 *      'page' mode after a fetch, so it would be wrong on domain roots.
 *
 * Option 1 is the right answer. Doing it now would mean designing around data that does
 * not exist yet.
 */
