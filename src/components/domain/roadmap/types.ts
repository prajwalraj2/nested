// src/components/domain/roadmap/types.ts

import type { RoadmapNodeBasic } from '@/services/types';

/** A roadmap node with its children nested — what every layout renders. */
export type SpineNode = RoadmapNodeBasic & { children: SpineNode[] };

/** Ids of every node that can be collapsed, i.e. every node that has children. */
export function collapsibleIds(nodes: SpineNode[], into: string[] = []): string[] {
  for (const node of nodes) {
    if (node.children.length > 0) {
      into.push(node.id);
      collapsibleIds(node.children, into);
    }
  }
  return into;
}
