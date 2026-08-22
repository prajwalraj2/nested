import type { ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { ItemIcon } from './ItemIcon'
import { cn } from '@/lib/utils'
import { ShareButton } from './ShareButton'
import { reviewBadgeLabel } from '@/lib/review-dates'

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
   * Icon id from `public/icons/`, shown before the title. Null renders nothing.
   *
   * ⚠️ THIS WAS THE GAP THAT MADE J-3 LOOK BROKEN. Every content page's `<h1>` comes through
   * this component — the section layout, subcategory list, table, rich text and narrative
   * layouts all use it — and it had no icon parameter at all, so an icon set in the admin
   * appeared in lists and the sidebar but never on the page it belonged to.
   */
  icon?: string | null

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

  /**
   * The DOMAIN's last review date (N-5). Renders a quiet "⟳ Reviewed Aug 2026" beside Share.
   *
   * ⚠️ OPT-IN, AND FOUR OF THE SIX CALLERS PASS IT: `TableLayout`, `RichTextLayout`,
   * `RoadmapLayout` and `SectionBasedLayout`. The two that do not are the domain LISTING
   * (`app/domain/page.tsx`, a grid of every domain — there is no single domain to date) and
   * `SubcategorySelector` (one section's children as a chooser, a step inside navigation rather
   * than a page anyone reviews). A review is a claim that content was checked, so a badge over a
   * list of links would claim something that was never reviewed.
   *
   * ⚠️ Absent, null, or older than `REVIEW_STALE_DAYS` renders NOTHING. See `reviewBadgeLabel`.
   */
  reviewedAt?: Date | string | null
}

const SPACING_CLASS = {
  default: 'mb-8',
  loose: 'mb-10',
} as const

export function PageHeading({
  title,
  icon,
  spacing = 'default',
  actions,
  share = true,
  reviewedAt,
}: PageHeadingProps) {
  /*
    ⚠️ `null` MEANS RENDER NOTHING, and one check covers three situations: never reviewed,
    reviewed too long ago, and an unparseable value. All three are cases where no claim should be
    made, so collapsing them is correct rather than lossy. See `reviewBadgeLabel`.
  */
  const reviewLabel = reviewBadgeLabel(reviewedAt)

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
        {/*
          `flex items-center gap-3` on the h1 so the icon sits on the text baseline block and
          wraps with it. `ItemIcon` renders nothing when there is no icon, so a heading without
          one is laid out exactly as before — which is almost every page.

          Size 32 against `text-3xl`: matched to the cap height rather than the full line box,
          so it reads as part of the title rather than a badge stuck beside it.
        */}
        <h1 className="flex min-w-0 items-center gap-3 text-3xl font-bold text-foreground">
          <ItemIcon icon={icon} size={32} />
          <span className="min-w-0">{title}</span>
        </h1>

        {/*
          `shrink-0` so the action group keeps its full width and the title wraps instead.
          `pt-1.5` optically aligns the 36px control with the cap-height of a `text-3xl`
          line rather than its box, which otherwise sits noticeably high.
        */}
        {/*
          ⚠️ MOVED HERE FROM UNDER THE TITLE — this is the second placement, and the reason for the
          change is worth keeping. The first version was a `<p>` between the `<h1>` and the divider,
          which pushed the rule down by the height of a line on every content page. The rule sits
          directly under the title by design (the Share button rides just above it), so the badge
          was displacing a piece of the page's structure to say something minor.

          On the right, beside Share, it costs no vertical space at all and the divider is back
          exactly where it was. It also leaves the space under the `<h1>` free for the one-line page
          description that is coming next.

          ⚠️ `reviewLabel` HAS TO BE PART OF THIS CONDITION. The group used to render only for
          `actions || share`, so on a page with `share={false}` and no actions the badge would have
          had no container and silently vanished — the failure mode being nothing at all, which is
          the hardest kind to notice.
        */}
        {(actions || share || reviewLabel) && (
          <div className="flex shrink-0 items-center gap-3 pt-1.5">
            {/*
              ⚠️ NOT A `Badge`. A pill would read as a status chip competing with the Share button;
              this is a quiet caption that happens to sit on the right. `whitespace-nowrap` because
              "Reviewed Aug 2026" breaking across two lines beside a button looks like a bug.

              `text-sm` rather than `text-xs`, on request — at `text-xs` it was legible but read as
              fine print, which undersells the one thing it is there to say.
            */}
            {reviewLabel && (
              <span className="text-muted-foreground hidden items-center gap-1.5 text-sm whitespace-nowrap sm:flex">
                {/*
                  ⚠️ HIDDEN BELOW `sm`. On a phone the title already wraps to two or three lines;
                  adding this beside Share would squeeze both. The date is reassurance, not
                  information the page depends on, so dropping it on the narrowest screens costs
                  nothing — whereas a cramped heading costs something on every page.

                  ⚠️ ICON NOTE: this is the refresh glyph from the mockup. It is worth knowing that
                  a refresh icon conventionally means *updated*, and this feature deliberately says
                  *reviewed* — reviewing and changing nothing is a real outcome (see the header of
                  `review-dates.ts`). If it ever reads as "updated", `CalendarCheck` is a one-word
                  swap and is already the icon used for this action in the admin row menu.
                */}
                <RefreshCw className="size-3.5" aria-hidden="true" />
                {reviewLabel}
              </span>
            )}
            {actions}
            {share && <ShareButton variant="labelled" />}
          </div>
        )}
      </div>

      <div className={cn('mt-1 border-b border-border', SPACING_CLASS[spacing])} />
    </div>
  )
}
