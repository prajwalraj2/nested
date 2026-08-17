// src/components/admin/roadmaps/types.ts

/** One topic as the editor holds it: the API's node shape, nested. */
export type EditorNode = {
  id: string;
  parentId: string | null;
  title: string;
  slug: string;
  icon: string | null;
  order: number;
  /** `'bottom' | 'right'` — where children go, and where the expand circle sits (L-13). */
  branchFrom: string;
  /** `'branch' | 'group'` — one arm per child, or a shared rail (L-13). */
  connector: string;
  /** ⚠️ Stored and editable, but NOT rendered publicly — badges replaced it. See L-13. */
  recommended: boolean;
  badges: string[];
  /** `null` or empty means the topic has no Sheet — a label on the spine, not a link (33.3). */
  htmlContent: string | null;
  updatedAt: string;
  children: EditorNode[];
};

export type MoveDirection = 'up' | 'down' | 'in' | 'out';

export type RoadmapMeta = {
  id: string;
  title: string;
  description: string | null;
  /** Arbitrary JSON from the database — always read it through `resolveRoadmapSettings`. */
  settings: unknown;
  updatedAt: string;
};

export type RoadmapPageMeta = {
  id: string;
  title: string;
  slug: string;
  status: string;
  domain: { id: string; name: string; slug: string };
};

/** Depth-first walk, used for "find this node" and "count everything". */
export function findNode(nodes: EditorNode[], id: string): EditorNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = findNode(node.children, id);
    if (hit) return hit;
  }
  return null;
}

/** Every id in the tree — used to seed and prune collapse state. */
export function allIds(nodes: EditorNode[], into: string[] = []): string[] {
  for (const node of nodes) {
    into.push(node.id);
    allIds(node.children, into);
  }
  return into;
}
