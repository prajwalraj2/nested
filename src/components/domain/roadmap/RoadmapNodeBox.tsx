// src/components/domain/roadmap/RoadmapNodeBox.tsx

'use client';

import { getIcon } from '@/lib/icon-manifest';
import { BADGE_COLOR_CLASSES, resolveBadgeColor, type BadgeColor } from '@/lib/badge-colors';
import { cn } from '@/lib/utils';
import type { SpineNode } from './types';

/**
 * One topic, drawn as a BOX. Shared by every roadmap layout.
 * ============================================================================
 *
 * ⚠️ THE BOX IS THE POINT.
 *
 * The first version of this page rendered each topic as a line of text on a thin rail, and it
 * read as a **course curriculum** rather than a route — the user's words, and they were right.
 * A bordered box says "a place you go to"; a line of text says "an item in a list". That single
 * change is most of the gap between the reference design and what shipped first.
 *
 * ⚠️ AND THE DASHED VARIANT IS NOT DECORATION. A topic with no content is a label on the spine,
 * not a link (33.3) — several exist in the source design (OSI Model, GCP, AKS). It renders as a
 * `<span>` rather than a disabled `<button>`, because a disabled button is still announced as a
 * button by screen readers and still looks interactive at a glance.
 */

type Props = {
  node: SpineNode;
  badgeColors: Record<string, BadgeColor>;
  /** Steps get a filled ground and heavier weight; topics do not. */
  variant?: 'step' | 'topic';
  isOpen: boolean;
  onOpen: (slug: string) => void;
  className?: string;
};

export function RoadmapNodeBox({
  node,
  badgeColors,
  variant = 'topic',
  isOpen,
  onOpen,
  className,
}: Props) {
  const icon = getIcon(node.icon);
  const hasSheet = Boolean(node.htmlContent && node.htmlContent.trim());

  // The one place clickability is decided, so no layout can get it wrong independently.
  const Tag = hasSheet ? 'button' : 'span';

  return (
    <Tag
      {...(hasSheet
        ? { type: 'button' as const, onClick: () => onOpen(node.slug), 'aria-expanded': isOpen }
        : {})}
      className={cn(
        /* ⚠️ `rm-box` is the hook globals.css uses to strengthen the border inside a roadmap
           tree — `--border` alone was near-invisible as a hairline on the page background in
           both themes. Scoped there rather than set here so the connector lines and the box
           edges are tuned from one place and cannot drift apart. */
        'rm-box relative inline-flex max-w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm leading-tight',
        variant === 'step' && 'bg-muted font-semibold',
        /* ⚠️ The hover COLOURS live in globals.css under `.rm-tree button.rm-box:hover`, beside
           the border and connector values they have to stay consistent with. Only the cursor
           and the transition are here — `hover:border-primary` used to be, and it fought the
           CSS rule for the same property. */
        hasSheet
          ? 'cursor-pointer transition-colors'
          : 'text-muted-foreground cursor-default border-dashed',
        /*
          ⚠️ `node.recommended` IS NOT READ HERE ANY MORE (L-13). Free-text badges replaced it
          on screen — an author wants "Start with this" or "Very Important" as readily as
          "Recommended", and two competing ways to say the same thing is worse than one. The
          column and its editor control survive; nothing public renders them. See the note on
          the field in schema.prisma before giving it styling again.
        */
        isOpen && 'border-primary ring-primary/30 ring-2',
        className
      )}
    >
      {/*
        ⚠️ BADGES SIT OUTSIDE THE BOX, ON ITS TOP-RIGHT CORNER (L-13).

        Inline badges pushed the title around and made a wide box wider — and on a branching
        layout width is the scarce resource. Floating them on the corner keeps every box sized
        by its title alone, and matches the reference design.

        ⚠️ NOT CAPPED. One or two badges fit comfortably; more will overlap the right-hand
        toggle circle. That is the author's discipline by agreement, not something enforced
        here — a silent truncation would be worse than a visible overlap, because the author
        would never learn the badge was dropped.
      */}
      {node.badges.length > 0 && (
        <span className="absolute -top-2.5 right-2 flex gap-1">
          {node.badges.map((badge) => (
            <span
              key={badge}
              className={cn(
                'rounded border px-1.5 py-px text-[9.5px] font-bold tracking-wide whitespace-nowrap',
                BADGE_COLOR_CLASSES[resolveBadgeColor(badge, badgeColors)]
              )}
            >
              {badge}
            </span>
          ))}
        </span>
      )}

      {icon && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={icon.url} alt="" className="size-4 shrink-0" aria-hidden="true" />
      )}

      <span className="truncate">{node.title}</span>
    </Tag>
  );
}
