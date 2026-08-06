'use client';

import { toast } from 'sonner';

/**
 * The clickable part of the "Upcoming Domains" section.
 * ============================================================================
 *
 * ⚠️ THESE ARE BUTTONS, NOT LINKS — deliberately, and it is the whole design decision.
 *
 * An upcoming domain has no page. `domain/[...slug]/page.tsx` 404s anything whose status is
 * not `PUBLISHED` (see NEW-IMPROVEMENTS.md §24.2), so an `<a href>` here would be a link to a
 * 404. That is worse than it sounds:
 *
 *   • Google would crawl it, find a 404, and count it against the site — the same soft-404
 *     problem `sitemap.ts` already avoids for geo-restricted pages.
 *   • The URL would silently change meaning the day the domain goes live, so anyone who had
 *     shared it would have been sharing a broken link in the meantime.
 *
 * A `<button>` has no href, so there is nothing to crawl and nothing to share. It is also the
 * honest element: it performs an action rather than navigating.
 *
 * ⚠️ NOT a styled `<div onClick>`. A div is not focusable, is skipped by Tab, is not announced
 * as interactive, and does not fire on Enter or Space. The button gives all of that for free.
 *
 * ⚠️ WHY THIS FILE EXISTS AT ALL. `src/app/domain/page.tsx` is an async Server Component — it
 * awaits the database — so it cannot hold an `onClick` or call `toast()`. Only the list is
 * split out; the heading and the section wrapper stay server-rendered, so the client bundle
 * for this feature is one small component rather than the whole section.
 */

type UpcomingDomain = {
  id: string;
  name: string;
};

type UpcomingDomainListProps = {
  domains: UpcomingDomain[];
};

export function UpcomingDomainList({ domains }: UpcomingDomainListProps) {
  return (
    /*
      ⚠️ FILLS DOWNWARDS, FIVE PER COLUMN — not left-to-right across three columns.

      `grid-flow-col` + `grid-rows-5` changes the fill order: items go down column one until
      five are placed, then start column two. The first version flowed left-to-right, so four
      upcoming domains spread themselves across all three columns and left a single orphan
      beginning a second row.

      Filling down matches the published grid directly above, where each category is a vertical
      list of roughly five domains — so with four or fewer items this reads as one tidy column
      under the heading, exactly like a category block.

      `lg:` only. Below that the page is a single column anyway, and `grid-flow-col` there would
      push items sideways off a narrow screen. Mobile keeps the default row flow, which is a
      plain vertical stack.

      ⚠️ Beyond 15 items the grid creates implicit fourth and fifth columns rather than
      overflowing — wider than the three tracks above it, but nothing is clipped or hidden.
    */
    <div className="grid grid-cols-1 gap-x-6 lg:grid-flow-col lg:grid-cols-3 lg:grid-rows-5">
      {domains.map((domain) => (
        <button
          key={domain.id}
          // `type="button"` because a bare <button> inside any future <form> would default to
          // `submit` and reload the page.
          type="button"
          onClick={() =>
            toast('Coming soon', {
              // Names the domain. A generic "this is upcoming" cannot tell you WHICH one you
              // clicked, which matters when several sit next to each other.
              description: `${domain.name} Domain is still in progress. Check back soon.`,
            })
          }
          /*
            Matched to `DomainItem` in `domain/page.tsx` so the two lists read as one family —
            same padding, same radius, same hover. `text-left` because a button centres its
            text by default and every neighbouring item is left-aligned.

            The text is very slightly dimmed rather than fully muted — see the note on the
            span below.
          */
          className="hover:bg-accent block w-full rounded-md px-3 py-1 text-left transition-colors cursor-pointer mb-1"
          title={domain.name}
        >
          {/*
            ⚠️ `text-foreground/80`, NOT `text-muted-foreground`.

            `muted-foreground` is the token for genuinely secondary text — slugs, counts, help
            lines — and against the published domain names directly above it read as greyed
            out, almost disabled. These are real domains the visitor is meant to notice; they
            are simply not ready yet.

            80% of the foreground colour keeps them a touch lighter than a live domain, so the
            distinction is still there, without the "switched off" look. Expressed as an alpha
            on the same token rather than a fixed grey, so it tracks both themes automatically
            — a hardcoded value would have been wrong in one of them.
          */}
          <span className="text-foreground/80 block truncate text-sm font-medium">
            {domain.name}
          </span>
        </button>
      ))}
    </div>
  );
}
