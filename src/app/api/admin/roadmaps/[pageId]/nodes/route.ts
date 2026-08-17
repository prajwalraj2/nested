// src/app/api/admin/roadmaps/[pageId]/nodes/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { invalidatePages } from '@/lib/cache-invalidation';
import { slugifyTopic, touchRoadmap, uniqueSlug } from '@/lib/roadmap-tree';
import { NODE_SELECT } from '../route';

interface RouteParams {
  params: Promise<{ pageId: string }>;
}

/**
 * POST /api/admin/roadmaps/[pageId]/nodes — add a topic.
 * ============================================================================
 *
 * Body: `{ title, parentId? }`. Everything else takes its schema default and is filled in
 * afterwards from the editor's right-hand pane.
 *
 * ⚠️ CREATION IS DELIBERATELY MINIMAL. The alternative — a dialog collecting title, slug, icon,
 * badges and content before the node exists — puts a form between the author and the tree they
 * are trying to think about. Typing a title and getting a node is the whole interaction; the
 * detail pane is where the rest happens.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { pageId } = await params;
    const body = await request.json();
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const parentId = typeof body?.parentId === 'string' && body.parentId ? body.parentId : null;

    if (!title) {
      return NextResponse.json({ error: 'Topic title is required' }, { status: 400 });
    }

    const roadmap = await prisma.roadmap.findUnique({
      where: { pageId },
      select: { id: true, nodes: { select: { id: true, slug: true, parentId: true, order: true } } },
    });
    if (!roadmap) {
      return NextResponse.json({ error: 'Roadmap not found' }, { status: 404 });
    }

    /*
      ⚠️ A parent must belong to THIS roadmap. Without the check, a `parentId` from another
      roadmap would be accepted by the foreign key — it is a valid RoadmapNode id — and produce
      a node that belongs to roadmap A while hanging off a parent in roadmap B. It would render
      in neither tree and could only be found by SQL.
    */
    if (parentId && !roadmap.nodes.some((n) => n.id === parentId)) {
      return NextResponse.json(
        { error: 'Parent topic does not belong to this roadmap' },
        { status: 400 }
      );
    }

    // Append: one past the highest order among its future siblings. `-1` so an empty sibling
    // list yields 0.
    const siblings = roadmap.nodes.filter((n) => n.parentId === parentId);
    const order = siblings.reduce((max, n) => Math.max(max, n.order), -1) + 1;

    // Scoped to the roadmap, matching @@unique([roadmapId, slug]) — see uniqueSlug's note.
    const taken = new Set(roadmap.nodes.map((n) => n.slug));
    const slug = uniqueSlug(slugifyTopic(title), taken);

    const node = await prisma.$transaction(async (tx) => {
      const created = await tx.roadmapNode.create({
        data: { roadmapId: roadmap.id, parentId, title, slug, order },
        // ⚠️ The shared list, not another hand-written copy — see its note.
        select: NODE_SELECT,
      });
      // ⚠️ Required — see touchRoadmap. Without it the sitemap reports a stale date for this URL.
      await touchRoadmap(tx, roadmap.id);
      return created;
    });

    invalidatePages();

    return NextResponse.json({ success: true, node }, { status: 201 });
  } catch (error) {
    console.error('Error creating roadmap node:', error);
    return NextResponse.json({ error: 'Failed to create topic' }, { status: 500 });
  }
}
