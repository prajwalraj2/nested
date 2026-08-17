// src/components/domain/roadmap/RoadmapSpine.tsx

'use client';

import { useEffect, useState } from 'react';
import { assignBadgeColors } from '@/lib/badge-colors';
import { RoadmapBranching } from './RoadmapBranching';
import { collapsibleIds, type SpineNode } from './types';

/**
 * The public roadmap tree (L-6).
 * ============================================================================
 *
 * Owns collapse state and badge colours; delegates the drawing to one of two layouts.
 *
 * ⚠️ TWO LAYOUTS ARE A TEMPORARY STATE, NOT A FEATURE. They exist so `clustered` and
 * `branching` can be compared against real content instead of a mockup. **Once one is chosen,
 * delete the other** — two renderers for one data shape means every future change to the node
 * chrome must be made twice, and the copies drift apart. `RoadmapNodeBox` is shared precisely
 * to keep that drift small in the meantime.
 *
 * ⚠️ CLIENT COMPONENT, BUT NOTHING HERE FETCHES. The server renders `RoadmapLayout` and passes
 * the whole tree down as props, so every topic is in the initial HTML and a crawler sees it
 * without executing anything. The interactivity is layered on top — the opposite of
 * `TableLayout`, whose `useEffect` fetch leaves ~650 pages with no content in the document
 * (finding #30).
 */

type Props = {
  nodes: SpineNode[];
  /** Every badge label in the roadmap, so one word keeps one colour down the whole page. */
  allBadges: string[];
  /** How many top-level steps start open on a first visit. See `roadmap-settings.ts`. */
  expandFirst: number;
  /** localStorage key — per roadmap, so two roadmaps never share collapse state. */
  storageKey: string;
  openTopic: string | null;
  onOpenTopic: (slug: string) => void;
};

export function RoadmapSpine({
  nodes,
  allBadges,
  expandFirst,
  storageKey,
  openTopic,
  onOpenTopic,
}: Props) {
  /*
    ⚠️ STARTS EMPTY, THEN READS localStorage IN AN EFFECT.

    Reading storage during render produces different markup on the server (no storage) and the
    client (storage), which React reports as a hydration mismatch and resolves by DISCARDING the
    server's output — losing the indexability this page exists for. One extra repaint is the
    correct price.
  */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        // ⚠️ A returning visitor's own choice always wins. Re-imposing the default here would
        // silently undo whatever they collapsed last time.
        setCollapsed(new Set(JSON.parse(raw) as string[]));
      } else {
        /*
          First visit: collapse everything EXCEPT the first `expandFirst` top-level steps.

          Those steps' direct children become visible; their grandchildren stay collapsed,
          because those ids remain in the set. That is the "one level deep" rule, and it falls
          out of the arithmetic rather than needing a depth parameter.
        */
        const open = new Set(nodes.slice(0, expandFirst).map((n) => n.id));
        setCollapsed(new Set(collapsibleIds(nodes).filter((id) => !open.has(id))));
      }
    } catch {
      // Corrupt JSON, or storage blocked in private mode. The roadmap opens fully expanded
      // rather than taking the page down.
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...collapsed]));
    } catch {
      // Storage full or unavailable. Collapsing still works for this visit.
    }
  }, [collapsed, hydrated, storageKey]);

  const badgeColors = assignBadgeColors(allBadges);
  const anyCollapsible = collapsibleIds(nodes).length > 0;

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
      {/* ⚠️ ONE control, not two checkboxes. "Collapse all" and "Expand all" are a single state
          with two values; as separate checkboxes the UI can show a combination (both ticked)
          that means nothing. */}
      {anyCollapsible && (
        <button
          type="button"
          onClick={() =>
            setCollapsed((prev) => (prev.size > 0 ? new Set() : new Set(collapsibleIds(nodes))))
          }
          className="text-muted-foreground hover:text-foreground mb-5 text-sm underline-offset-4 hover:underline"
        >
          {collapsed.size > 0 ? 'Expand all' : 'Collapse all'}
        </button>
      )}

      <RoadmapBranching
        nodes={nodes}
        badgeColors={badgeColors}
        collapsed={collapsed}
        openTopic={openTopic}
        onToggle={toggle}
        onOpenTopic={onOpenTopic}
      />
    </div>
  );
}

export type { SpineNode };
