// src/app/api/admin/roadmaps/[pageId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { invalidatePages } from '@/lib/cache-invalidation';
import { buildTree } from '@/lib/roadmap-tree';

/**
 * The roadmap resource, addressed by its PAGE id.
 * ============================================================================
 *
 * ⚠️ `[pageId]`, NOT `[roadmapId]` — deliberately, and matching `/api/admin/rich-text/[pageId]`.
 * A roadmap is 1:1 with a page, and every route into this screen comes from a page: the admin
 * list, the page tree, the public URL. Keying on the roadmap's own id would mean the caller
 * needs a lookup before it can navigate, and `/admin/roadmaps/<pageId>` would then disagree with
 * the API path for the same thing.
 *
 * The NODE routes are keyed by node id instead — they are addressed from within an already
 * loaded tree, where the id is in hand.
 */

interface RouteParams {
  params: Promise<{ pageId: string }>;
}

/**
 * Every field the editor needs for one node. ⚠️ Includes `htmlContent` — see the GET note.
 *
 * ⚠️ EXPORTED AND SHARED. There were three hand-written copies of this list across the roadmap
 * routes, and adding `branchFrom` / `connector` in L-13 meant finding all three — the
 * rebuild-by-explicit-field-list bug that has now been caught **ten times** in this project. A
 * field missing from one copy does not fail to compile: it simply never reaches the client, and
 * the editor renders a control bound to `undefined`.
 *
 * Import this rather than writing another list.
 */
export const NODE_SELECT = {
  id: true,
  parentId: true,
  title: true,
  slug: true,
  icon: true,
  order: true,
  branchFrom: true,
  connector: true,
  recommended: true,
  badges: true,
  htmlContent: true,
  updatedAt: true,
} as const;

/**
 * GET /api/admin/roadmaps/[pageId] — the roadmap and its whole tree.
 *
 * ⚠️ `htmlContent` IS INCLUDED FOR EVERY NODE, IN ONE REQUEST. The alternative — fetching a
 * topic's body when it is selected — would mean a spinner on every click in an editor whose
 * whole job is clicking between topics. A roadmap is 30–60 nodes; at a few KB each that is well
 * under a tenth of a megabyte.
 *
 * If a roadmap ever grows large enough for this to hurt, drop `htmlContent` from this select and
 * add a per-node fetch. **No schema change is required** — 33.3 kept the content on the node
 * precisely so this stays a one-line decision.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { pageId } = await params;

    const page = await prisma.page.findUnique({
      where: { id: pageId },
      select: {
        id: true,
        title: true,
        slug: true,
        contentType: true,
        status: true,
        domain: { select: { id: true, name: true, slug: true } },
        roadmap: {
          select: {
            id: true,
            title: true,
            description: true,
            settings: true,
            updatedAt: true,
            nodes: {
              select: NODE_SELECT,
              // ⚠️ `parentId` first is what makes `buildTree` a single ordered pass — children
              // of one parent arrive contiguously and already in display order.
              orderBy: [{ parentId: 'asc' }, { order: 'asc' }],
            },
          },
        },
      },
    });

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    if (!page.roadmap) {
      // Not an error — it is the state of every roadmap page before someone clicks Create.
      // The editor renders a "set this up" prompt rather than an error.
      return NextResponse.json({ success: true, page, roadmap: null, tree: [] });
    }

    const { nodes, ...roadmap } = page.roadmap;
    return NextResponse.json({
      success: true,
      page: { ...page, roadmap: undefined },
      roadmap,
      tree: buildTree(nodes),
    });
  } catch (error) {
    console.error('Error fetching roadmap:', error);
    return NextResponse.json({ error: 'Failed to fetch roadmap' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/roadmaps/[pageId] — the roadmap's own fields.
 *
 * Body may contain any of `title`, `description`, `settings`. Absent keys are left alone.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { pageId } = await params;
    const body = await request.json();

    const existing = await prisma.roadmap.findUnique({
      where: { pageId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Roadmap not found' }, { status: 404 });
    }

    /*
      ⚠️ BUILT BY CHECKING WHICH KEYS ARE PRESENT, NOT BY LISTING THE FIELDS TO COPY.

      A PATCH that always writes `{ title, description, settings }` would blank every field the
      caller did not send — which is the rebuild-by-explicit-field-list bug (seven occurrences,
      see NEW-IMPROVEMENTS.md) in its most damaging form, since here it destroys data rather
      than merely dropping it from a form.

      `in` rather than a truthiness test, so an explicit `null` or `""` is honoured.
    */
    const data: { title?: string; description?: string | null; settings?: unknown } = {};

    if ('title' in body) {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!title) {
        return NextResponse.json({ error: 'Roadmap title cannot be empty' }, { status: 400 });
      }
      data.title = title;
    }
    if ('description' in body) {
      const d = typeof body.description === 'string' ? body.description.trim() : '';
      data.description = d || null;
    }
    if ('settings' in body) {
      data.settings = body.settings ?? undefined;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const roadmap = await prisma.roadmap.update({
      where: { id: existing.id },
      data: data as never,
      select: { id: true, title: true, description: true, settings: true, updatedAt: true },
    });

    // The roadmap's title and description reach the public page and its meta description, both
    // of which sit behind cached reads. See the header note in src/lib/cache-invalidation.ts.
    invalidatePages();

    return NextResponse.json({ success: true, roadmap });
  } catch (error) {
    console.error('Error updating roadmap:', error);
    return NextResponse.json({ error: 'Failed to update roadmap' }, { status: 500 });
  }
}
