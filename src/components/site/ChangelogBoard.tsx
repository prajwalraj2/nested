// src/components/site/ChangelogBoard.tsx

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { assignBadgeColors, badgeClassFor } from '@/lib/badge-colors';
import {
  CHANGELOG_STATUSES,
  CHANGELOG_TYPES,
  changelogTypeLabel,
  groupByStatus,
  type ChangelogCard,
} from '@/lib/changelog-types';

/**
 * The public product board (M-7).
 * ============================================================================
 *
 * ⚠️ RECEIVES EVERY CARD AS A PROP AND FETCHES NOTHING. The page component queries on the server,
 * so the full board is in the HTML before this file runs — the same arrangement as `SiteHeader`,
 * and for the same reason: a page that needs JavaScript to show its text does not rank.
 *
 * The filter therefore narrows cards that are ALREADY RENDERED. It is not a query.
 *
 * ⚠️ FOUR INDEPENDENT COLUMNS, NOT A PIPELINE. Nothing here draws an arrow between them or shows
 * progress along them. See the note on `CHANGELOG_STATUSES`.
 */

type Props = { cards: ChangelogCard[] };

const ALL = '__all__';

export function ChangelogBoard({ cards }: Props) {
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [open, setOpen] = useState<ChangelogCard | null>(null);

  /*
    ⚠️ COLOURS ARE COMPUTED OVER THE WHOLE BOARD, ONCE — not per column and not per filtered view.

    `assignBadgeColors` allocates by sorted position among the DISTINCT values it is handed. Give
    it one column's types and "bug" gets a different colour in each column; give it the filtered
    set and the colour changes as the filter changes. Both would be obviously wrong on screen and
    both are easy to write by accident, which is why this sits outside the filtering below.

    ✅ It sorts with plain `<` rather than `localeCompare` (badge-colors.ts:196) — the two disagree
    between server and client and would produce a hydration mismatch on every visit.
  */
  const badgeColors = useMemo(() => assignBadgeColors(cards.map((c) => c.type)), [cards]);

  const columns = useMemo(() => {
    const visible = typeFilter === ALL ? cards : cards.filter((c) => c.type === typeFilter);
    return groupByStatus(visible);
  }, [cards, typeFilter]);

  /*
    ⚠️ ONLY THE TYPES ACTUALLY PRESENT GET A FILTER BUTTON. Offering all five when two of them
    match nothing gives the visitor two buttons whose only outcome is an empty board — a filter
    that can return nothing is a filter that looks broken.
  */
  const presentTypes = useMemo(() => {
    const present = new Set(cards.map((c) => c.type));
    return CHANGELOG_TYPES.filter((t) => present.has(t.value));
  }, [cards]);

  return (
    <div className="space-y-6">
      {/* ── Filter ───────────────────────────────────────────────────────── */}
      {presentTypes.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={typeFilter === ALL ? 'default' : 'outline'}
            onClick={() => setTypeFilter(ALL)}
          >
            Everything
          </Button>
          {presentTypes.map((type) => (
            <Button
              key={type.value}
              size="sm"
              variant={typeFilter === type.value ? 'default' : 'outline'}
              onClick={() => setTypeFilter(type.value)}
            >
              {type.label}
            </Button>
          ))}
        </div>
      )}

      {/* ── The board ────────────────────────────────────────────────────── */}
      {/*
        ⚠️ 1 -> 2 -> 4 COLUMNS. Four columns need roughly 1024px to be readable; two is the honest
        middle step rather than dropping straight to a single stack, which is the same mistake the
        domain grids had.
      */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CHANGELOG_STATUSES.map((status) => {
          const items = columns[status.value] ?? [];

          return (
            <section key={status.value} className="min-w-0">
              <div className="border-border mb-3 border-b pb-2">
                <h2 className="text-sm font-semibold">{status.label}</h2>
                {/*
                  ⚠️ THE ONE-LINE DESCRIPTION IS LOAD-BEARING, not decoration. "Done" and
                  "Tested & Released" side by side otherwise invite the reader to assume a
                  sequence. Saying what each column means is what prevents that without drawing a
                  relationship that does not exist.
                */}
                <p className="text-muted-foreground mt-0.5 text-xs">{status.description}</p>
              </div>

              {items.length === 0 ? (
                /*
                  ⚠️ AN EMPTY STATE, NOT A COLLAPSED COLUMN. A four-column board that renders three
                  columns reads as a layout fault; an explicitly empty one reads as information.
                */
                <p className="border-border text-muted-foreground rounded-lg border border-dashed p-4 text-center text-xs">
                  Nothing here
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((card) => (
                    <li key={card.id}>
                      {/*
                        ⚠️ A `<button>`, NOT AN `<a>`. Deep-linking a card is deliberately NOT
                        supported, and an anchor promises things this cannot deliver: middle-click
                        to open in a tab, copy link address, a working back button. A control that
                        looks like a link and behaves like a button is worse than one that looks
                        like what it is.

                        `text-left` because a button centres its text by default, which would make
                        a two-line title look like a heading rather than a list entry.
                      */}
                      <button
                        type="button"
                        onClick={() => setOpen(card)}
                        className="border-border bg-card hover:border-foreground/30 w-full rounded-lg border p-3 text-left transition-colors"
                      >
                        <span className="block text-sm font-medium break-words">{card.title}</span>
                        <span
                          className={`mt-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${badgeClassFor(
                            card.type,
                            badgeColors
                          )}`}
                        >
                          {changelogTypeLabel(card.type)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {/* ── Feedback prompt ──────────────────────────────────────────────── */}
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        <p className="text-muted-foreground text-sm">
          Something missing from this board, or wrong on the site?
        </p>
        {/*
          `?from=/changelog` so the report records where it came from, exactly as the header's
          Feedback link does. See `resolveHref` in SiteNav.tsx.
        */}
        <Button asChild variant="outline" size="sm">
          <Link href="/feedback?from=%2Fchangelog">
            <MessageSquare className="size-4" aria-hidden="true" />
            Send feedback
          </Link>
        </Button>
      </div>

      {/*
        ⚠️ CONTROLLED BY THE CARD OBJECT, NOT BY AN ID. Holding an id would mean looking the card
        back up to render the dialog, and the lookup has to handle "not found" for a case that
        cannot happen — state that carries the thing itself has no such branch.
      */}
      <Dialog open={open !== null} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="max-w-lg">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="break-words">{open.title}</DialogTitle>
                <DialogDescription asChild>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${badgeClassFor(
                        open.type,
                        badgeColors
                      )}`}
                    >
                      {changelogTypeLabel(open.type)}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {CHANGELOG_STATUSES.find((s) => s.value === open.status)?.label ?? open.status}
                    </span>
                    {/*
                      ⚠️ THE DATE LIVES HERE AND NOT ON THE CARD. The spec keeps cards to title
                      plus badge, but a changelog that never says WHEN is a slightly strange
                      artefact — "Released" tells you it happened and not when, which is the first
                      thing anyone checks.

                      ⚠️ `updatedAt`, so editing a typo moves the date. That is the honest reading
                      of "last changed" and it is why the label says "Updated" rather than
                      "Released on", which would be a claim this column cannot support.
                    */}
                    <span className="text-muted-foreground text-xs">
                      · Updated {new Date(open.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </DialogDescription>
              </DialogHeader>

              {/*
                ⚠️ `whitespace-pre-wrap` so paragraph breaks written in the admin survive, WITHOUT
                interpreting any markup. The description is plain text by design — this board is
                not another rich-text surface, and making it one would mean another editor, another
                sanitisation question and another thing to keep in step.
              */}
              <p className="text-sm break-words whitespace-pre-wrap">{open.description}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
