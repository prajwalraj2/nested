import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ShareButton } from './ShareButton'

/**
 * The heading block every public page shares: title, actions, divider.
 * ============================================================================
 *
 * WHY THIS EXISTS — it is not "componentising for its own sake"
 * ------------------------------------------------------------
 * This exact markup was hand-written in **six** places, and had already drifted in four
 * separate ways. Audited before extraction:
 *
 *   file                              h1 colour          divider bottom margin
 *   --------------------------------  -----------------  ---------------------
 *   SectionBasedLayout                text-foreground    mb-6
 *   TableLayout (loading/error/empty)  text-foreground    mb-6
 *   TableLayout (loaded)               text-foreground    mb-15   ← different!
 *   RichTextLayout                     text-foreground    mb-10
 *   SubcategorySelector                text-foreground    mb-6
 *   app/domain/page.tsx                text-foreground    mb-8
 *   NarrativeLayout                    text-slate-800     none    ← see note below
 *
 * Three real defects came out of that:
 *
 *   1. **TableLayout jumped on load.** Its loading, error and empty states used `mb-6`
 *      while the loaded state used `mb-15`, so every one of the ~666 table pages shifted
 *      its content down by 2.25rem the moment data arrived. That is a layout shift on the
 *      most common content type on the site.
 *   2. **Four different divider margins** (6 / 8 / 10 / 15), so heading spacing visibly
 *      depended on which page type you happened to be on.
 *   3. `NarrativeLayout` hardcodes `text-slate-800` — near-black text on a dark
 *      background, effectively invisible in dark mode.
 *
 * ⚠️ NarrativeLayout IS DELIBERATELY NOT CONVERTED, on request. It still hand-rolls its
 * heading and still carries the `text-slate-800` bug. Tracked in `OPEN-ITEMS.md` — it is
 * a known live issue, not an oversight of this refactor. If you convert it later, deleting
 * its hardcoded colour is the entire fix.
 *
 * ⚠️ THE SPACING WAS NORMALISED, WHICH IS A VISIBLE CHANGE — read this before assuming a
 * regression. `mb-8` is now the default and `loose` (`mb-10`) is the one exception, for
 * prose. So table pages sit slightly tighter above their toolbar than before (`mb-15` →
 * `mb-8`). That was judged to be drift rather than design: nothing else in the codebase
 * uses a 15 step, and the same file contradicted itself with `mb-6` four lines earlier —
 * there was no single "current appearance" to preserve. If the tighter spacing reads
 * wrong, it is one prop on one line to change.
 *
 * ⚠️ The originals all carried `style={{ borderBottomWidth: '1px' }}` alongside `border-b`.
 * That is redundant — Tailwind v4's preflight zeroes border widths and `border-b` sets the
 * bottom to 1px on its own — so it is dropped here. Worth a glance that the divider still
 * renders; if it ever vanishes, that inline style is why it was there.
 */

type PageHeadingProps = {
  /** Rendered as the page's `<h1>`. Emoji are kept — see the note below. */
  title: string

  /**
   * Divider bottom margin.
   *
   *   default  mb-8   — everything
   *   loose    mb-10  — prose, where the first paragraph wants more air (RichTextLayout)
   *
   * Deliberately a two-value enum rather than a free-form className. A `dividerClassName`
   * escape hatch is exactly how the six-way drift above happened in the first place; if a
   * third genuinely distinct spacing is ever needed, add a named option here so it is a
   * decision recorded in one file rather than a value buried in a layout.
   */
  spacing?: 'default' | 'loose'

  /**
   * Extra controls placed to the LEFT of the share button — an export action on a table
   * page, say. Optional; nothing passes it yet, and it exists so the next page-level
   * action does not have to re-open this component's layout.
   */
  actions?: ReactNode

  /**
   * Set `false` to omit the share button.
   *
   * ⚠️ The share button is rendered by DEFAULT, on purpose. Making each of the six callers
   * pass it would mean six chances to forget, and a missing share button is invisible —
   * nothing renders and nothing errors. Same reasoning as `withCountry()` in
   * `src/middleware.ts`: make the easy-to-forget thing structural instead of remembered.
   *
   * The escape hatch exists for a page that genuinely should not be shared (a future
   * geo-restricted page — see the note at the bottom of `ShareButton.tsx`).
   */
  share?: boolean
}

const SPACING_CLASS = {
  default: 'mb-8',
  loose: 'mb-10',
} as const

export function PageHeading({
  title,
  spacing = 'default',
  actions,
  share = true,
}: PageHeadingProps) {
  return (
    <div>
      {/*
        `items-start` not `items-center`: titles wrap to two lines on narrow screens
        ("Defining Services | Pricing | Offers"), and centring would drag the button to
        the vertical middle of a two-line block, leaving it floating oddly low.

        `gap-4` guarantees clearance even when the title runs long, and `min-w-0` on the
        title lets it shrink — the same flex `min-width: auto` trap that caused the
        document-level horizontal scroll fixed in `src/app/domain/layout.tsx`. Without it,
        a long unbroken title would push the button off the edge instead of wrapping.
      */}
      <div className="flex items-start justify-between gap-4">
        {/*
          Emoji in titles are KEPT here. They are stripped only for `<title>` and meta
          description (see `stripEmoji` in `src/lib/seo.ts`) because search results should
          not lead with them — but on the page itself they are the visual identity of each
          domain and page, and the sidebar shows them too.
        */}
        <h1 className="min-w-0 text-3xl font-bold text-foreground">{title}</h1>

        {/*
          `shrink-0` so the action group keeps its full width and the title wraps instead.
          `pt-1.5` optically aligns the 36px control with the cap-height of a `text-3xl`
          line rather than its box, which otherwise sits noticeably high.
        */}
        {(actions || share) && (
          <div className="flex shrink-0 items-center gap-2 pt-1.5">
            {actions}
            {share && <ShareButton variant="labelled" />}
          </div>
        )}
      </div>

      <div className={cn('mt-1 border-b border-border', SPACING_CLASS[spacing])} />
    </div>
  )
}
