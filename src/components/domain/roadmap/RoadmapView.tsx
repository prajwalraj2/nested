// src/components/domain/roadmap/RoadmapView.tsx

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RoadmapSpine, type SpineNode } from './RoadmapSpine';
import { getIcon } from '@/lib/icon-manifest';

/**
 * The interactive shell around the roadmap spine (L-6 + L-7).
 * ============================================================================
 *
 * Owns three things the server cannot: which topic's Sheet is open, the role dropdown's
 * navigation, and keeping the URL in step with both.
 *
 * ⚠️ THE TREE ITSELF IS SERVER-RENDERED AND PASSED IN AS PROPS. Nothing here fetches. That is
 * what makes a roadmap the first content type on this site whose body is in the initial HTML —
 * see finding #30 for what happens when a layout fetches its own content instead.
 */

export type RoleLink = { id: string; title: string; icon: string | null; href: string };

type Props = {
  tree: SpineNode[];
  allBadges: string[];
  /** How many top-level steps start open on a first visit. See `roadmap-settings.ts`. */
  expandFirst: number;
  /** Stable per roadmap, so two roadmaps never share collapse state. */
  storageKey: string;
  /** Sibling roadmap pages. ⚠️ Fewer than two and the dropdown is not rendered at all. */
  roles: RoleLink[];
  currentRoleHref: string;
  /** From `?topic=` on the server, so a deep link arrives with the Sheet already open. */
  initialTopic: string | null;
};

export function RoadmapView({
  tree,
  allBadges,
  expandFirst,
  storageKey,
  roles,
  currentRoleHref,
  initialTopic,
}: Props) {
  const router = useRouter();
  const [openTopic, setOpenTopic] = useState<string | null>(initialTopic);

  /** Flat index, so opening a topic by slug is a lookup rather than a walk. */
  const bySlug = useMemo(() => {
    const map = new Map<string, SpineNode>();
    const walk = (nodes: SpineNode[]) => {
      for (const node of nodes) {
        map.set(node.slug, node);
        walk(node.children);
      }
    };
    walk(tree);
    return map;
  }, [tree]);

  /*
    ⚠️ THE URL IS UPDATED WITH `history.replaceState`, NOT `router.push`.

    Pushing would add a history entry per topic opened, so a visitor who looked at eight topics
    would need nine Back presses to leave the page — the classic modal-in-the-history-stack
    trap. Replacing keeps the URL shareable (which is the whole point of `?topic=`) while Back
    still means "leave this page".

    ⚠️ And it is `history.replaceState` rather than `router.replace` because the latter re-runs
    the server render. Nothing on the server depends on `?topic=` after first load — the content
    is already here — so a round trip would buy a flicker and nothing else.
  */
  const syncUrl = useCallback((slug: string | null) => {
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set('topic', slug);
    else url.searchParams.delete('topic');
    window.history.replaceState(null, '', url.toString());
  }, []);

  const open = useCallback(
    (slug: string) => {
      if (!bySlug.has(slug)) return;
      setOpenTopic(slug);
      syncUrl(slug);
    },
    [bySlug, syncUrl]
  );

  const close = useCallback(() => {
    setOpenTopic(null);
    syncUrl(null);
  }, [syncUrl]);

  /*
    ⚠️ An unknown `?topic=` value must NOT 404 or throw — the topic may simply have been renamed
    since the link was shared. The page renders normally with the Sheet shut, which is the
    graceful version of a broken link.
  */
  useEffect(() => {
    if (initialTopic && !bySlug.has(initialTopic)) {
      setOpenTopic(null);
      syncUrl(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = openTopic ? bySlug.get(openTopic) ?? null : null;

  return (
    <>
      <div className="flex flex-wrap items-end justify-end gap-4">
        {/*
          ⚠️ THE TITLE IS NOT RENDERED HERE ANY MORE. It moved to `PageHeading` in
          RoadmapLayout — see the note there. This component owns only what needs the client:
          the role dropdown, the spine's collapse state, and the Sheet.
        */}
        {/*
          ⚠️ RENDERED ONLY WHEN THERE IS SOMETHING TO CHOOSE.

          The dropdown is DERIVED from sibling pages, not configured (33.2a) — so a domain with
          one plain roadmap has exactly one entry, and a control offering a single option is
          noise that implies alternatives exist.
        */}
        {roles.length > 1 && (
          <div className="w-full sm:w-auto">
            <label
              htmlFor="roadmap-role"
              className="text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase"
            >
              Choose your role
            </label>
            <Select value={currentRoleHref} onValueChange={(href) => router.push(href)}>
              <SelectTrigger id="roadmap-role" className="w-full sm:w-56">
                {/* Radix renders nothing here without explicit children once a value is set. */}
                <SelectValue>
                  {roles.find((r) => r.href === currentRoleHref)?.title}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => {
                  const icon = getIcon(role.icon);
                  return (
                    <SelectItem key={role.id} value={role.href}>
                      <span className="flex items-center gap-2">
                        {icon && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={icon.url} alt="" className="size-4" aria-hidden="true" />
                        )}
                        {role.title}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <RoadmapSpine
        nodes={tree}
        allBadges={allBadges}
        expandFirst={expandFirst}
        storageKey={storageKey}
        openTopic={openTopic}
        onOpenTopic={open}
      />

      <Sheet open={Boolean(active)} onOpenChange={(next) => !next && close()}>
        {/*
          ⚠️ Right on desktop, and full width below `sm`. A 560px side panel on a 375px phone is
          a panel with no page left beside it, so it becomes the page (33.5).
        */}
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-2xl">
          {active && (
            <>
              <SheetHeader className="border-border border-b">
                <SheetTitle className="flex items-center gap-2 text-xl">
                  {(() => {
                    const icon = getIcon(active.icon);
                    return icon ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={icon.url} alt="" className="size-5" aria-hidden="true" />
                    ) : null;
                  })()}
                  {active.title}
                </SheetTitle>
                {active.badges.length > 0 || active.recommended ? (
                  <SheetDescription asChild>
                    <div className="flex flex-wrap gap-1.5">
                      {active.recommended && (
                        <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[11px] font-semibold">
                          Recommended
                        </span>
                      )}
                      {active.badges.map((b) => (
                        <span
                          key={b}
                          className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[11px] font-semibold"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  </SheetDescription>
                ) : (
                  // Radix warns loudly when a Dialog has no description. An empty, hidden one
                  // satisfies the a11y contract without inventing text.
                  <SheetDescription className="sr-only">
                    Details for {active.title}
                  </SheetDescription>
                )}
              </SheetHeader>

              <div className="px-4 py-5">
                {/*
                  ⚠️ NOT SANITISED — stored verbatim (#35). `ROADMAP-CONTENT-GUIDE.md` is the
                  control. `.roadmap-sheet` is the same class the admin preview uses, so the two
                  cannot drift apart.
                */}
                <div
                  className="roadmap-sheet"
                  dangerouslySetInnerHTML={{ __html: active.htmlContent ?? '' }}
                />

                {active.children.length > 0 && (
                  <div className="border-border mt-8 border-t pt-5">
                    <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                      Next
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {active.children.map((child) => {
                        const childHasSheet = Boolean(child.htmlContent?.trim());
                        return (
                          <button
                            key={child.id}
                            type="button"
                            disabled={!childHasSheet}
                            /*
                              ⚠️ SWAPS THE CONTENT IN PLACE — the Sheet never closes. It reads as
                              moving THROUGH a topic rather than bouncing out and back in, and it
                              keeps the spine's scroll position (33.5).
                            */
                            onClick={() => open(child.slug)}
                            className="border-border bg-muted/50 hover:border-primary hover:text-primary rounded-full border px-3.5 py-1.5 text-sm disabled:cursor-default disabled:opacity-50 disabled:hover:border-inherit disabled:hover:text-inherit"
                          >
                            {child.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
