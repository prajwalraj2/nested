// src/lib/roadmap-tree.ts

import type { Prisma } from '@/generated/prisma';

/**
 * Shared helpers for roadmap writes and tree shaping (L-4).
 * ============================================================================
 *
 * Everything in this file exists because the same mistake is easy to make in five different
 * route handlers. Putting it here means it is made once, or not at all.
 */

/* ══════════════════════════════════════════════════════════════════════════════
   THE BUMP
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * Touch the parent `Roadmap` row so its `updatedAt` moves.
 * ============================================================================
 *
 * ⚠️ CALL THIS INSIDE EVERY TRANSACTION THAT WRITES A `RoadmapNode`. IT IS NOT OPTIONAL.
 *
 * `sitemap.ts` computes each URL's `<lastmod>` from the newest of the page and its content
 * rows, and for a roadmap it reads `Roadmap.updatedAt`. But the visible content lives in
 * `RoadmapNode`, and editing a topic writes only to that node — leaving `Roadmap.updatedAt`
 * exactly where it was. Without this bump, **every roadmap URL reports a stale date for every
 * edit that is not a change of the roadmap's own title, description or settings**, which is
 * nearly all of them.
 *
 * That matters more than it sounds: systematically wrong `lastmod` values are precisely what
 * makes Google discard the field for an entire sitemap — the failure `Domain.updatedAt` was
 * added to avoid in the first place.
 *
 * ⚠️ WHY NOT AGGREGATE `MAX(RoadmapNode.updatedAt)` IN THE SITEMAP INSTEAD? Two reasons: it
 * costs an extra query per domain, and **it cannot see deletions** — removing a topic changes
 * what the page renders while leaving no timestamp behind at all.
 *
 * `data: {}` is not a no-op. Prisma still issues an UPDATE, and `@updatedAt` fires on it.
 */
export async function touchRoadmap(
  tx: Prisma.TransactionClient,
  roadmapId: string
): Promise<void> {
  await tx.roadmap.update({ where: { id: roadmapId }, data: {} });
}

/* ══════════════════════════════════════════════════════════════════════════════
   SLUGS
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * Turn a topic title into a URL-safe slug: "Container Orchestration" -> "container-orchestration".
 *
 * ⚠️ STRIPS EMOJI AND EVERY OTHER NON-ASCII CHARACTER. Titles here follow the same house style
 * as page titles, which carry emoji inline ("🔍 Facebook Ads"), and an emoji in a `?topic=`
 * value would be percent-encoded into something unreadable and unshareable.
 */
export function slugifyTopic(title: string): string {
  return title
    .normalize('NFKD')
    // Drop combining marks left behind by the decomposition above (é -> e).
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * A slug that is free within this roadmap, by appending `-2`, `-3`… if needed.
 *
 * ⚠️ THE CONSTRAINT IS `@@unique([roadmapId, slug])`, NOT A GLOBAL ONE. "docker" may exist in
 * the Frontend roadmap and the DevOps roadmap simultaneously — that duplication is the agreed
 * design (33.2), since a shared node would need two different positions at once.
 *
 * ⚠️ This is a check-then-write, so it is not atomic. Two admins creating "Docker" in the same
 * roadmap in the same second could both resolve to "docker" and the second insert would fail on
 * the unique index. That is the correct failure — a clear error rather than silent data loss —
 * and with one admin it cannot happen. Do not "fix" it with a loop that swallows P2002.
 */
export function uniqueSlug(base: string, taken: Set<string>): string {
  const root = base || 'topic';
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}

/* ══════════════════════════════════════════════════════════════════════════════
   TREE SHAPING
   ══════════════════════════════════════════════════════════════════════════════ */

export type FlatNode = {
  id: string;
  parentId: string | null;
  order: number;
  [key: string]: unknown;
};

export type TreeNode<T> = T & { children: TreeNode<T>[] };

/**
 * Nest a flat, ordered node list into a tree.
 *
 * One pass to index, one pass to link — O(n), not the O(n²) a recursive filter would give.
 *
 * ⚠️ ORPHANS ARE PROMOTED TO THE ROOT, NOT DROPPED. A node whose `parentId` points at
 * something absent from the input should be impossible — the self-relation cascades on delete —
 * but if it ever happens, silently discarding it would hide real content from the admin with no
 * error anywhere. Surfacing it at the top level is visible and recoverable.
 */
export function buildTree<T extends FlatNode>(nodes: T[]): TreeNode<T>[] {
  const byId = new Map<string, TreeNode<T>>();
  for (const node of nodes) byId.set(node.id, { ...node, children: [] });

  const roots: TreeNode<T>[] = [];
  for (const node of nodes) {
    const built = byId.get(node.id)!;
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(built);
    else roots.push(built);
  }

  // The query orders by `order`, and both passes above preserve input order, so children are
  // already correct. Sorting again here would be dead code that looks load-bearing.
  return roots;
}

/**
 * Renumber a sibling list to 0..n-1 and return the writes needed.
 *
 * ⚠️ USE THIS RATHER THAN NUDGING TWO ROWS' `order` VALUES. Reordering by swapping the two
 * affected rows works until any gap or duplicate exists in the sequence — and gaps appear the
 * first time a node is deleted, duplicates the first time a write is interrupted. Renumbering
 * the whole sibling list is self-healing: it cannot leave the list in a state it cannot repair
 * on the next move.
 *
 * ⚠️ Returns only the rows whose value actually changes, so a no-op move issues no writes.
 */
export function renumber(
  siblings: { id: string; order: number }[]
): { id: string; order: number }[] {
  const writes: { id: string; order: number }[] = [];
  siblings.forEach((node, index) => {
    if (node.order !== index) writes.push({ id: node.id, order: index });
  });
  return writes;
}
