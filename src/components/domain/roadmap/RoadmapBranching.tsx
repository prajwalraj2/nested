// src/components/domain/roadmap/RoadmapBranching.tsx

'use client';

import { ChevronDown, ChevronRight, ChevronUp, ChevronLeft } from 'lucide-react';
import { RoadmapNodeBox } from './RoadmapNodeBox';
import type { SpineNode } from './types';
import type { BadgeColor } from '@/lib/badge-colors';

/**
 * The branching roadmap tree (L-6, redesigned in L-13).
 * ============================================================================
 *
 * ⚠️ THE GEOMETRY LIVES IN `globals.css` UNDER "Roadmap tree connectors", NOT HERE.
 *
 * Two per-node attributes crossed with two breakpoints is a four-by-two matrix, and a matrix is
 * far easier to read as one CSS block than as arbitrary-variant class strings scattered across
 * three components. This file's whole job is to emit the right `data-` attributes and recurse.
 *
 *   data-branch    bottom | right    where children go, and where the circle sits
 *   data-connector branch | group    one arm per child, or a shared rail
 *
 * ⚠️ NO PLAIN CHEVRONS. The first version used a bare chevron per row and the page read as a
 * course curriculum — the user's words, and the reason for this redesign. The control is now a
 * circle sitting ON the box edge, at the point the branch actually comes out of, so it reads as
 * part of the diagram rather than as a list disclosure.
 */

type RowProps = {
  badgeColors: Record<string, BadgeColor>;
  collapsed: Set<string>;
  openTopic: string | null;
  onToggle: (id: string) => void;
  onOpenTopic: (slug: string) => void;
};

type Props = RowProps & { nodes: SpineNode[] };

export function RoadmapBranching({ nodes, ...rest }: Props) {
  return (
    <ul className="rm-tree">
      {nodes.map((node) => (
        <BranchRow key={node.id} node={node} depth={0} {...rest} />
      ))}
    </ul>
  );
}

function BranchRow({
  node,
  depth,
  badgeColors,
  collapsed,
  openTopic,
  onToggle,
  onOpenTopic,
}: RowProps & { node: SpineNode; depth: number }) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.id);

  /*
    ⚠️ Read defensively. `branchFrom` and `connector` are plain `String` columns with defaults,
    so the database cannot reject a bad value — a typo or a value left over from a rename would
    otherwise reach the CSS, match no rule, and silently draw nothing.
  */
  const branch = node.branchFrom === 'right' ? 'right' : 'bottom';
  const connector = node.connector === 'group' ? 'group' : 'branch';

  /* Which way the chevron points: toward where the children WILL appear when collapsed, and
     back toward the box when expanded. */
  const Chevron =
    branch === 'right'
      ? isCollapsed
        ? ChevronRight
        : ChevronLeft
      : isCollapsed
        ? ChevronDown
        : ChevronUp;

  return (
    <li className="rm-node" data-branch={branch} data-connector={connector}>
      <div className="rm-head">
        <RoadmapNodeBox
          node={node}
          badgeColors={badgeColors}
          variant={depth === 0 ? 'step' : 'topic'}
          isOpen={openTopic === node.slug}
          onOpen={onOpenTopic}
        />

        {hasChildren && (
          <button
            type="button"
            className="rm-toggle"
            data-at={branch}
            onClick={() => onToggle(node.id)}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? `Expand ${node.title}` : `Collapse ${node.title}`}
          >
            <Chevron className="size-2.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {hasChildren && !isCollapsed && (
        <ul className="rm-kids">
          {node.children.map((child) => (
            <BranchRow
              key={child.id}
              node={child}
              depth={depth + 1}
              badgeColors={badgeColors}
              collapsed={collapsed}
              openTopic={openTopic}
              onToggle={onToggle}
              onOpenTopic={onOpenTopic}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
