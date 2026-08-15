// src/app/api/admin/roadmap-nodes/[id]/move/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { invalidatePages } from '@/lib/cache-invalidation';
import { renumber, touchRoadmap } from '@/lib/roadmap-tree';

interface RouteParams {
  params: Promise<{ id: string }>;
}

type Direction = 'up' | 'down' | 'in' | 'out';
const DIRECTIONS: Direction[] = ['up', 'down', 'in', 'out'];

/**
 * POST /api/admin/roadmap-nodes/[id]/move — reorder or re-nest one topic.
 * ============================================================================
 *
 * Body: `{ direction: 'up' | 'down' | 'in' | 'out' }`.
 *
 * ⚠️ BUTTONS, NOT DRAG-AND-DROP — a deliberate choice (33.2e), not a shortcut. Drag-to-*nest* a
 * tree is where most of the bugs in an editor like this live, it needs a separate touch
 * implementation, and it is the hardest part to make keyboard-accessible. Four verbs are exact,
 * keyboard-native, and can be replaced by dragging later **without touching the schema** —
 * which is the whole reason for choosing them first.
 *
 * ⚠️ EVERY BRANCH RUNS IN ONE TRANSACTION AND RENUMBERS WHOLE SIBLING LISTS.
 *
 * The tempting implementation is "swap the two affected rows' `order` values". It works until
 * the sequence has a gap or a duplicate — and gaps appear the first time a node is deleted,
 * duplicates the first time a write is interrupted halfway. From then on, moves produce
 * results that look arbitrary and there is no error to follow. Renumbering the affected lists
 * to 0..n-1 is self-healing: whatever state the data was in, it comes out correct.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const body = await request.json();
    const direction: Direction = body?.direction;

    if (!DIRECTIONS.includes(direction)) {
      return NextResponse.json(
        { error: `direction must be one of: ${DIRECTIONS.join(', ')}` },
        { status: 400 }
      );
    }

    const node = await prisma.roadmapNode.findUnique({
      where: { id },
      select: { id: true, roadmapId: true, parentId: true, order: true },
    });
    if (!node) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    // Every node in the roadmap, once. The tree is small, and having the whole thing in memory
    // is what lets each branch below be a few lines of list arithmetic instead of more queries.
    const all = await prisma.roadmapNode.findMany({
      where: { roadmapId: node.roadmapId },
      select: { id: true, parentId: true, order: true },
      orderBy: [{ parentId: 'asc' }, { order: 'asc' }],
    });

    const siblingsOf = (parentId: string | null) =>
      all.filter((n) => n.parentId === parentId).sort((a, b) => a.order - b.order);

    const siblings = siblingsOf(node.parentId);
    const index = siblings.findIndex((n) => n.id === node.id);

    /** Collected then applied inside the transaction, so a rejected move writes nothing. */
    let writes: { id: string; parentId?: string | null; order: number }[] = [];

    if (direction === 'up' || direction === 'down') {
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= siblings.length) {
        // ⚠️ 409, not 400. The request was well-formed; the move is simply not available from
        // here. The UI disables these buttons at the ends, so this is the belt to that braces.
        return NextResponse.json(
          { error: `Cannot move ${direction} — already at the ${direction === 'up' ? 'top' : 'bottom'}` },
          { status: 409 }
        );
      }
      const reordered = [...siblings];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      writes = renumber(reordered);
    }

    if (direction === 'in') {
      /*
        ⚠️ INDENT HAS EXACTLY ONE LEGAL TARGET: THE SIBLING IMMEDIATELY ABOVE.

        Anything else is ambiguous — "make this a child" of what? The node above is the only
        answer that matches what the tree looks like on screen. A node at position 0 therefore
        cannot be indented at all, and the UI disables the control rather than letting the click
        do nothing, which reads as a bug.
      */
      if (index <= 0) {
        return NextResponse.json(
          { error: 'Cannot indent — there is no topic above this one to nest it under' },
          { status: 409 }
        );
      }
      const newParent = siblings[index - 1];
      const newSiblings = siblingsOf(newParent.id);

      // Appended last among its new siblings — it was directly below the parent, so the bottom
      // of that parent's children is where the eye expects it.
      writes = [
        ...renumber(siblings.filter((n) => n.id !== node.id)),
        { id: node.id, parentId: newParent.id, order: newSiblings.length },
      ];
    }

    if (direction === 'out') {
      // ⚠️ A top-level node has nowhere to go. Disabled in the UI; refused here too.
      if (!node.parentId) {
        return NextResponse.json(
          { error: 'Cannot outdent — this topic is already at the top level' },
          { status: 409 }
        );
      }
      const parent = all.find((n) => n.id === node.parentId)!;
      const uncles = siblingsOf(parent.parentId);

      /*
        Placed immediately AFTER its former parent, not appended to the end of the list. Sending
        it to the bottom would be a second, unasked-for move — the node would leave the position
        the author was looking at and reappear somewhere off screen.
      */
      const parentIndex = uncles.findIndex((n) => n.id === parent.id);
      const rebuilt = [...uncles];
      rebuilt.splice(parentIndex + 1, 0, { ...node, parentId: parent.parentId });

      writes = [
        ...renumber(siblings.filter((n) => n.id !== node.id)),
        ...rebuilt.map((n, i) => ({
          id: n.id,
          ...(n.id === node.id ? { parentId: parent.parentId } : {}),
          order: i,
        })),
      ];
    }

    await prisma.$transaction(async (tx) => {
      for (const write of writes) {
        const { id: writeId, ...data } = write;
        await tx.roadmapNode.update({ where: { id: writeId }, data });
      }
      // ⚠️ Required — see touchRoadmap. Reordering changes what the page renders, so the
      // sitemap's lastmod for this URL must move with it.
      await touchRoadmap(tx, node.roadmapId);
    });

    invalidatePages();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error moving roadmap node:', error);
    return NextResponse.json({ error: 'Failed to move topic' }, { status: 500 });
  }
}
