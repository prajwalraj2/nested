'use client';

import { toast } from 'sonner';
import { ItemIcon } from './ItemIcon';

/**
 * The clickable list behind every "Upcoming …" block on the public site.
 * ============================================================================
 *
 * Used twice, for two different kinds of thing:
 *
 *   • `/domain` — "Upcoming Domains", from `Domain.status === 'UPCOMING'` (#24)
 *   • a section-based page — "Upcoming Resources", from `Page.status === 'UPCOMING'` (#25)
 *
 * ⚠️ GENERALISED FROM `UpcomingDomainList`, WHICH THIS REPLACES. The page version needed
 * byte-identical markup, layout and toast behaviour; the only differences were the word used in
 * the toast and where the data came from. Copying it would have meant two files drifting apart
 * on spacing, colour and wording the moment either was touched.
 *
 * ⚠️ THESE ARE BUTTONS, NOT LINKS — the central decision, and it holds for both callers.
 *
 * An upcoming domain or page has no reachable URL: `domain/[...slug]/page.tsx` 404s a
 * non-published domain (§24.2) and `PageService.getByPath` filters out a non-published page
 * (§25). So an `<a href>` here would be a link to a 404, which is worse than it sounds —
 *
 *   • Google would crawl it, find a 404, and count it against the site, the same soft-404
 *     problem `sitemap.ts` already avoids for geo-restricted pages;
 *   • the URL would silently change meaning the day the thing goes live, so anyone who shared
 *     it would have been sharing a broken link in the meantime.
 *
 * A `<button>` has no href, so there is nothing to crawl and nothing to share. It is also the
 * honest element: it performs an action rather than navigating.
 *
 * ⚠️ NOT a styled `<div onClick>`. A div is not focusable, is skipped by Tab, is not announced
 * as interactive, and does not fire on Enter or Space. The button gives all of that for free.
 *
 * ⚠️ WHY THIS FILE IS A CLIENT COMPONENT AT ALL. `domain/page.tsx` and `SectionBasedLayout` are
 * Server Components — they await the database — so neither can hold an `onClick` or call
 * `toast()`. Only the list is split out; the headings and section wrappers stay server-rendered,
 * so the client bundle for this feature is one small component rather than a whole section.
 */

type UpcomingItem = {
  id: string;
  /** What the visitor sees, and what the toast names. */
  name: string;
  /** Icon id, or null to fall back to the emoji already in the name. */
  icon?: string | null;
};

type UpcomingListProps = {
  items: UpcomingItem[];
  /**
   * The noun used in the toast — "Domain" or "Resource".
   *
   * ⚠️ A word, not a whole sentence. Callers passing full copy is how two call sites end up
   * phrasing the same idea differently; passing the one word that genuinely differs keeps the
   * sentence itself in one place.
   */
  noun: string;
};

export function UpcomingList({ items, noun }: UpcomingListProps) {
  return (
    /*
      ⚠️ FILLS DOWNWARDS, FIVE PER COLUMN — not left-to-right across three columns.

      `grid-flow-col` + `grid-rows-5` changes the fill order: items go down column one until
      five are placed, then start column two. The first version flowed left-to-right, so four
      items spread themselves across all three columns and left a single orphan beginning a
      second row.

      Filling down matches the grids these sit under — a category block on `/domain`, a section
      on a section-based page — where each column is a vertical list of roughly five entries. So
      with five or fewer items this reads as one tidy column under the heading.

      `lg:` only. Below that the page is a single column anyway, and `grid-flow-col` there would
      push items sideways off a narrow screen. Mobile keeps the default row flow, which is a
      plain vertical stack.

      ⚠️ Beyond 15 items the grid creates implicit fourth and fifth columns rather than
      overflowing — wider than the three tracks above it, but nothing is clipped or hidden.
    */
    /*
      ⚠️ THE `md:` STEP MUST REPEAT `grid-flow-col` AND `grid-rows-5`, not just the column count.

      This list fills DOWNWARDS (see above). `grid-flow-col` needs an explicit row count to know
      when to start the next column - without `md:grid-rows-5` the browser would fall back to a
      single row and lay every item out sideways off the screen. So the two-column step is three
      classes, not one.
    */
    <div className="grid grid-cols-1 gap-x-6 md:grid-flow-col md:grid-cols-2 md:grid-rows-5 lg:grid-cols-3 lg:grid-rows-5">
      {items.map((item) => (
        <button
          key={item.id}
          // `type="button"` because a bare <button> inside any future <form> would default to
          // `submit` and reload the page.
          type="button"
          onClick={() =>
            toast('Coming soon', {
              // Names the item. A generic "this is upcoming" cannot tell you WHICH one you
              // clicked, which matters when several sit next to each other.
              description: `${item.name} ${noun} is still in progress. Check back soon.`,
            })
          }
          /*
            Matched to `DomainItem` in `domain/page.tsx` so the published and upcoming lists read
            as one family — same padding, same radius, same hover. `text-left` because a button
            centres its text by default and every neighbouring item is left-aligned.

            The text is very slightly dimmed rather than fully muted — see the note on the span.
          */
          className="hover:bg-accent mb-1 block w-full cursor-pointer rounded-md px-3 py-1 text-left transition-colors"
          title={item.name}
        >
          {/*
            ⚠️ `text-foreground/80`, NOT `text-muted-foreground`.

            `muted-foreground` is the token for genuinely secondary text — slugs, counts, help
            lines — and against the published entries directly above it read as greyed out,
            almost disabled. These are real things the visitor is meant to notice; they are
            simply not ready yet.

            80% of the foreground colour keeps them a touch lighter than a live entry, so the
            distinction is still there without the "switched off" look. Expressed as an alpha on
            the same token rather than a fixed grey, so it tracks both themes automatically — a
            hardcoded value would have been wrong in one of them.

            ⚠️ Checking this in the compiled CSS is misleading: Tailwind v4 emits a plain
            `color:var(--foreground)` fallback FIRST and the real value inside an
            `@supports (color:color-mix(...))` block after it. Reading only the first match looks
            like the alpha was dropped.
          */}
          {/*
            `flex items-center gap-2` sits on this inner span rather than the button, so the
            button keeps its own padding and hover area unchanged.

            `ItemIcon` renders nothing at all when there is no icon — not a placeholder — so a
            row without one lays out exactly as it did before. That is the common case.
          */}
          <span className="text-foreground/80 flex items-center gap-2 text-sm font-medium">
            <ItemIcon icon={item.icon} size={16} />
            <span className="block truncate">{item.name}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
