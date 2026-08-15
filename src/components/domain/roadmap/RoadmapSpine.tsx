// src/components/domain/roadmap/RoadmapSpine.tsx

'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Star } from 'lucide-react';
import { getIcon } from '@/lib/icon-manifest';
import {
  assignBadgeColors,
  resolveBadgeColor,
  BADGE_COLOR_CLASSES,
  type BadgeColor,
} from '@/lib/badge-colors';
import { cn } from '@/lib/utils';
import type { RoadmapNodeBasic } from '@/services/types';

/**
 * The public roadmap tree — the "spine" (L-6).
 * ============================================================================
 *
 * ⚠️ A VERTICAL TRUNK WITH TOPICS BRANCHING RIGHT, NOT A 2D FLOWCHART.
 *
 * roadmap.sh-style diagrams look impressive on a desktop and become unusable on a phone: a wide
 * graph either scrolls sideways or shrinks past legibility. A vertical trunk just gets narrower.
 * Given that most traffic to this site is mobile, that decided it (33.5).
 *
 * ⚠️ CLIENT COMPONENT, BUT THE CONTENT IS ALREADY IN THE HTML. The server renders
 * `RoadmapLayout`, which passes the whole tree here as props — so the topics are in the initial
 * response and a crawler sees them without executing anything. The interactivity (collapse,
 * opening a Sheet) is layered on top. This is deliberately the opposite of `TableLayout`, whose
 * client-side fetch leaves ~650 pages with no content in their HTML at all (finding #30).
 */

export type SpineNode = RoadmapNodeBasic & { children: SpineNode[] };

type Props = {
  nodes: SpineNode[];
  /** All badge labels in the roadmap, so colours are stable across the whole page. */
  allBadges: string[];
  defaultExpanded: boolean;
  /** localStorage key — per roadmap, so two roadmaps do not share collapse state. */
  storageKey: string;
  openTopic: string | null;
  onOpenTopic: (slug: string) => void;
};

export function RoadmapSpine({
  nodes,
  allBadges,
  defaultExpanded,
  storageKey,
  openTopic,
  onOpenTopic,
}: Props) {
  /*
    ⚠️ STARTS FROM THE SERVER'S VALUE, THEN READS localStorage IN AN EFFECT.

    Reading localStorage during the initial render would produce different markup on the server
    (no storage) and the client (storage), which React reports as a hydration mismatch and
    resolves by throwing away the server's output — losing the very SEO benefit this page exists
    for. Applying the stored preference one tick later costs a single repaint and keeps the
    server render authoritative.
  */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setCollapsed(new Set(JSON.parse(raw) as string[]));
      else if (!defaultExpanded) setCollapsed(new Set(collapsibleIds(nodes)));
    } catch {
      // A corrupt or blocked storage entry must not take the page down — the roadmap simply
      // opens in its default state.
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...collapsed]));
    } catch {
      // Private mode, or storage full. Collapsing still works for this visit.
    }
  }, [collapsed, hydrated, storageKey]);

  const badgeColors = assignBadgeColors(allBadges);

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="mt-8">
      {/* One control, not two checkboxes. "Collapse all" and "Expand all" are a single state
          with two values — as separate checkboxes the UI can display a combination (both
          ticked) that means nothing (33.5). */}
      {nodes.some((n) => n.children.length > 0) && (
        <button
          type="button"
          onClick={() =>
            setCollapsed((prev) => (prev.size > 0 ? new Set() : new Set(collapsibleIds(nodes))))
          }
          className="text-muted-foreground hover:text-foreground mb-4 text-sm underline-offset-4 hover:underline"
        >
          {collapsed.size > 0 ? 'Expand all' : 'Collapse all'}
        </button>
      )}

      <ol className="border-border/80 ml-1.5 space-y-1 border-l-2 pl-7">
        {nodes.map((node, index) => (
          <SpineRow
            key={node.id}
            node={node}
            index={index}
            depth={0}
            collapsed={collapsed}
            badgeColors={badgeColors}
            openTopic={openTopic}
            onToggle={toggle}
            onOpenTopic={onOpenTopic}
          />
        ))}
      </ol>
    </div>
  );
}

function SpineRow({
  node,
  index,
  depth,
  collapsed,
  badgeColors,
  openTopic,
  onToggle,
  onOpenTopic,
}: {
  node: SpineNode;
  index: number;
  depth: number;
  collapsed: Set<string>;
  badgeColors: Record<string, BadgeColor>;
  openTopic: string | null;
  onToggle: (id: string) => void;
  onOpenTopic: (slug: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.id);
  const icon = getIcon(node.icon);
  /** ⚠️ The whole clickability rule, in one place. Empty content = a label, not a link. */
  const hasSheet = Boolean(node.htmlContent && node.htmlContent.trim());
  const isOpen = openTopic === node.slug;

  const Label = hasSheet ? 'button' : 'span';

  return (
    <li className="relative">
      {/* The connector from the trunk to this row. */}
      <span
        className="bg-border/80 absolute top-[1.15rem] -left-7 h-0.5 w-4"
        aria-hidden="true"
      />
      {/* The station marker. Filled for a step or a recommended topic; hollow otherwise. */}
      <span
        className={cn(
          'ring-background absolute -left-[2.1rem] top-[0.85rem] size-2.5 ring-4',
          depth === 0
            ? 'bg-primary rounded-sm'
            : node.recommended
              ? 'bg-primary rounded-full'
              : 'bg-background border-border rounded-full border-2'
        )}
        aria-hidden="true"
      />

      <div className="flex flex-wrap items-center gap-2 py-1.5">
        {hasChildren && (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            className="text-muted-foreground hover:text-foreground -ml-1 grid size-5 shrink-0 place-items-center rounded"
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? `Expand ${node.title}` : `Collapse ${node.title}`}
          >
            {isCollapsed ? (
              <ChevronRight className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            )}
          </button>
        )}

        {/*
          ⚠️ NO `01 / 02 / 03` STEP NUMBERS. Removed 15 Aug 2026 at the user's request, and the
          reasoning is worth keeping: numbering made the page read as a **course curriculum**
          rather than a route. A roadmap's order is already carried by the vertical spine — the
          numbers restated it while adding an air of formal syllabus that the design is trying to
          avoid. Do not reintroduce them without a reason the spine cannot already express.
        */}
        {icon && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={icon.url} alt="" className="size-4 shrink-0" aria-hidden="true" />
        )}

        {/*
          ⚠️ A TOPIC WITH NO SHEET RENDERS AS A <span>, NOT A DISABLED BUTTON.

          A disabled button is still announced as a button by screen readers and still looks
          interactive at a glance. These are labels — several exist in the source design (OSI
          Model, GCP, AKS) — so they get no cursor, no hover, and no button semantics at all.
        */}
        <Label
          {...(hasSheet
            ? {
                onClick: () => onOpenTopic(node.slug),
                type: 'button' as const,
                'aria-expanded': isOpen,
              }
            : {})}
          className={cn(
            'rounded text-left',
            depth === 0 ? 'font-semibold' : 'text-sm',
            hasSheet
              ? 'hover:text-primary cursor-pointer underline-offset-4 hover:underline'
              : 'text-muted-foreground cursor-default',
            isOpen && 'text-primary underline'
          )}
        >
          {node.title}
        </Label>

        {node.recommended && (
          <span className="bg-primary/10 text-primary inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold">
            <Star className="size-2.5 fill-current" aria-hidden="true" />
            Recommended
          </span>
        )}

        {node.badges.map((badge) => (
          <span
            key={badge}
            className={cn(
              'shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold',
              /* `resolveBadgeColor` returns a colour NAME; the classes come from the shared
                 map, so roadmap badges and table badges are literally the same styling. */
              BADGE_COLOR_CLASSES[resolveBadgeColor(badge, badgeColors)]
            )}
          >
            {badge}
          </span>
        ))}
      </div>

      {hasChildren && !isCollapsed && (
        <ol className="border-border/60 mt-1 mb-2 ml-1 space-y-0.5 border-l-2 pl-6">
          {node.children.map((child, childIndex) => (
            <SpineRow
              key={child.id}
              node={child}
              index={childIndex}
              depth={depth + 1}
              collapsed={collapsed}
              badgeColors={badgeColors}
              openTopic={openTopic}
              onToggle={onToggle}
              onOpenTopic={onOpenTopic}
            />
          ))}
        </ol>
      )}
    </li>
  );
}

/** Ids of every node that can be collapsed, i.e. every node with children. */
function collapsibleIds(nodes: SpineNode[], into: string[] = []): string[] {
  for (const node of nodes) {
    if (node.children.length > 0) {
      into.push(node.id);
      collapsibleIds(node.children, into);
    }
  }
  return into;
}
