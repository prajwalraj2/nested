// src/components/admin/roadmaps/RoadmapTree.tsx

'use client';

import {
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  MoreHorizontal,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getIcon } from '@/lib/icon-manifest';
import { cn } from '@/lib/utils';
import type { EditorNode, MoveDirection } from './types';

/**
 * The tree pane of the roadmap editor (L-4).
 * ============================================================================
 *
 * Renders the topic tree and the four move verbs. Pure presentation — every action is handed
 * upward, so this file has no idea whether a move succeeded.
 */

type Props = {
  nodes: EditorNode[];
  selectedId: string | null;
  collapsed: Set<string>;
  busyId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onMove: (id: string, direction: MoveDirection) => void;
  onDelete: (node: EditorNode) => void;
};

export function RoadmapTree(props: Props) {
  return (
    <ul className="space-y-0.5">
      {props.nodes.map((node, index) => (
        <TreeRow
          key={node.id}
          node={node}
          index={index}
          siblingCount={props.nodes.length}
          depth={0}
          {...props}
        />
      ))}
    </ul>
  );
}

function TreeRow({
  node,
  index,
  siblingCount,
  depth,
  ...props
}: Props & { node: EditorNode; index: number; siblingCount: number; depth: number }) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = props.collapsed.has(node.id);
  const isSelected = props.selectedId === node.id;
  const icon = getIcon(node.icon);

  /*
    ⚠️ THE DISABLED STATES ARE THE POINT, NOT DECORATION.

    Each of these mirrors a rule the API enforces with a 409 (see the move route):
      • first sibling cannot move up, last cannot move down
      • indent needs a sibling immediately above to nest under — position 0 has none
      • outdent needs a parent — a top-level topic has nowhere to go

    Leaving them enabled would mean a click that appears to do nothing, which reads as a broken
    button rather than an unavailable action.
  */
  const canUp = index > 0;
  const canDown = index < siblingCount - 1;
  const canIndent = index > 0;
  const canOutdent = depth > 0;

  const descendantCount = countDescendants(node);

  return (
    <li>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-md pr-1',
          isSelected ? 'bg-accent' : 'hover:bg-muted/60',
          props.busyId === node.id && 'opacity-50'
        )}
        style={{ paddingLeft: `${depth * 18}px` }}
      >
        {/* Disclosure. A spacer keeps titles aligned when there is nothing to expand. */}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => props.onToggle(node.id)}
            className="text-muted-foreground hover:text-foreground grid size-6 shrink-0 place-items-center rounded"
            aria-label={isCollapsed ? `Expand ${node.title}` : `Collapse ${node.title}`}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? (
              <ChevronRight className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            )}
          </button>
        ) : (
          <span className="size-6 shrink-0" />
        )}

        <button
          type="button"
          onClick={() => props.onSelect(node.id)}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
        >
          {icon && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={icon.url} alt="" className="size-4 shrink-0" aria-hidden="true" />
          )}
          <span className={cn('truncate text-sm', isSelected && 'font-medium')}>
            {node.title}
          </span>

          {node.recommended && (
            <Star
              className="size-3.5 shrink-0 fill-current text-amber-500"
              aria-label="Recommended"
            />
          )}

          {node.badges.slice(0, 2).map((badge) => (
            <Badge key={badge} variant="secondary" className="shrink-0 text-[10px]">
              {badge}
            </Badge>
          ))}

          {/* ⚠️ A topic with no content is a label on the spine, not a link (33.3). Saying so
              here is what stops an author wondering why nothing opens on the public page. */}
          {!node.htmlContent && (
            <span className="text-muted-foreground shrink-0 text-[10px]">no sheet</span>
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
              aria-label={`Actions for ${node.title}`}
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={() => props.onAddChild(node.id)}>
              <Plus className="size-4" aria-hidden="true" />
              Add sub-topic
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!canUp} onSelect={() => props.onMove(node.id, 'up')}>
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canDown} onSelect={() => props.onMove(node.id, 'down')}>
              Move down
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canIndent} onSelect={() => props.onMove(node.id, 'in')}>
              <CornerDownRight className="size-4" aria-hidden="true" />
              Indent
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canOutdent} onSelect={() => props.onMove(node.id, 'out')}>
              Outdent
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => props.onDelete(node)}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {/* ⚠️ Names the blast radius. The self-relation cascades, so deleting a step
                  removes everything beneath it — "Delete" alone would understate that. */}
              Delete{descendantCount > 0 ? ` (+${descendantCount})` : ''}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {hasChildren && !isCollapsed && (
        <ul className="space-y-0.5">
          {node.children.map((child, childIndex) => (
            <TreeRow
              key={child.id}
              node={child}
              index={childIndex}
              siblingCount={node.children.length}
              depth={depth + 1}
              {...props}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** How many topics a delete would take with it, counting the whole subtree. */
function countDescendants(node: EditorNode): number {
  return node.children.reduce((total, child) => total + 1 + countDescendants(child), 0);
}
