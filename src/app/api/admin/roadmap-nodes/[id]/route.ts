// src/app/api/admin/roadmap-nodes/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { invalidatePages } from '@/lib/cache-invalidation';
import { isValidIconId } from '@/lib/icon-manifest';
import { htmlToPlainText } from '@/lib/html-text';
import { renumber, slugifyTopic, touchRoadmap, uniqueSlug } from '@/lib/roadmap-tree';
import { NODE_SELECT } from '../../roadmaps/[pageId]/route';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/roadmap-nodes/[id] — update one topic.
 * ============================================================================
 *
 * Body may contain any of: `title`, `slug`, `icon`, `recommended`, `badges`, `htmlContent`.
 * **Absent keys are left untouched.**
 *
 * ⚠️ THE UPDATE IS BUILT BY CHECKING WHICH KEYS ARE PRESENT, NOT BY LISTING FIELDS TO COPY.
 * A handler that always wrote `{ title, slug, icon, recommended, badges, htmlContent }` would
 * blank every field the caller happened not to send. That is the rebuild-by-explicit-field-list
 * bug — **seven occurrences in this project** — in its most destructive form, because here it
 * deletes an author's content rather than merely dropping a value from a form.
 *
 * `'key' in body` rather than a truthiness test, so `recommended: false`, `badges: []` and
 * `htmlContent: ''` are all honoured as deliberate values. Using `||` here is exactly finding
 * #28, which made a page its own parent and detached 74 others.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const body = await request.json();

    const node = await prisma.roadmapNode.findUnique({
      where: { id },
      select: {
        id: true,
        roadmapId: true,
        slug: true,
        roadmap: { select: { nodes: { select: { id: true, slug: true } } } },
      },
    });
    if (!node) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if ('title' in body) {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!title) {
        return NextResponse.json({ error: 'Topic title cannot be empty' }, { status: 400 });
      }
      data.title = title;
    }

    if ('slug' in body) {
      const requested = slugifyTopic(String(body.slug ?? ''));
      if (!requested) {
        return NextResponse.json(
          { error: 'Slug must contain at least one letter or number' },
          { status: 400 }
        );
      }
      /*
        ⚠️ Uniqueness is scoped to the roadmap (@@unique([roadmapId, slug])), and the node's OWN
        current slug is excluded — otherwise re-saving a topic without changing its slug would
        collide with itself and silently become "kubernetes-2".
      */
      const taken = new Set(
        node.roadmap.nodes.filter((n) => n.id !== node.id).map((n) => n.slug)
      );
      if (taken.has(requested)) {
        return NextResponse.json(
          { error: `Another topic in this roadmap already uses the slug "${requested}"` },
          { status: 409 }
        );
      }
      data.slug = uniqueSlug(requested, taken);
    }

    if ('icon' in body) {
      const icon = body.icon ? String(body.icon) : null;
      /*
        ⚠️ Validate against the manifest. The value reaches an `src` attribute, and an
        unrecognised id renders a broken image with NO error anywhere — the same trap the
        `Domain.icon` and `Page.icon` comments warn about.
      */
      if (icon && !isValidIconId(icon)) {
        return NextResponse.json({ error: `Unknown icon id "${icon}"` }, { status: 400 });
      }
      data.icon = icon;
    }

    if ('recommended' in body) data.recommended = Boolean(body.recommended);

    /*
      L-13 connector geometry. ⚠️ Validated against the known set rather than stored as given:
      these are plain `String` columns, so the database accepts anything, and a typo would reach
      the CSS, match no rule, and silently draw a node with no connectors at all.
    */
    if ('branchFrom' in body) {
      const v = String(body.branchFrom);
      if (v !== 'bottom' && v !== 'right') {
        return NextResponse.json(
          { error: 'branchFrom must be "bottom" or "right"' },
          { status: 400 }
        );
      }
      data.branchFrom = v;
    }
    if ('connector' in body) {
      const v = String(body.connector);
      if (v !== 'branch' && v !== 'group') {
        return NextResponse.json(
          { error: 'connector must be "branch" or "group"' },
          { status: 400 }
        );
      }
      data.connector = v;
    }

    if ('badges' in body) {
      if (!Array.isArray(body.badges)) {
        return NextResponse.json({ error: 'badges must be an array' }, { status: 400 });
      }
      // Trim, drop blanks, de-duplicate. A duplicate label would take a second colour slot in
      // `assignBadgeColors`, shifting every later badge's colour for no visible reason.
      data.badges = [...new Set(
        body.badges.map((b: unknown) => String(b).trim()).filter(Boolean)
      )];
    }

    if ('htmlContent' in body) {
      const html = typeof body.htmlContent === 'string' ? body.htmlContent.trim() : '';
      /*
        ⚠️ STORED VERBATIM — NOT SANITISED (#35). Sanitisation was removed site-wide; whatever
        is saved here is rendered to every public visitor with `dangerouslySetInnerHTML`.
        `ROADMAP-CONTENT-GUIDE.md` (L-12) is the control that replaced it.

        Empty string is stored as NULL, because "" and null must not be two different ways of
        saying "no sheet" — the renderer decides clickability on this field, and two falsy
        representations is how that check ends up wrong in one of them.
      */
      data.htmlContent = html || null;
      data.plainText = html ? htmlToPlainText(html) : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.roadmapNode.update({
        where: { id },
        data,
        // ⚠️ The shared list — see its note in ../../roadmaps/[pageId]/route.ts.
        select: NODE_SELECT,
      });
      await touchRoadmap(tx, node.roadmapId);
      return result;
    });

    invalidatePages();

    return NextResponse.json({ success: true, node: updated });
  } catch (error) {
    console.error('Error updating roadmap node:', error);
    return NextResponse.json({ error: 'Failed to update topic' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/roadmap-nodes/[id] — remove a topic and everything under it.
 *
 * ⚠️ THE DELETE CASCADES TO DESCENDANTS, by the self-relation's `onDelete: Cascade`. That is
 * deliberate (33.3) — the alternative is orphan rows that belong to the roadmap but to no
 * visible parent — but it means **deleting a step removes every topic beneath it**. The UI must
 * say how many, not just "are you sure?".
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { id } = await params;

    const node = await prisma.roadmapNode.findUnique({
      where: { id },
      select: { id: true, roadmapId: true, parentId: true },
    });
    if (!node) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.roadmapNode.delete({ where: { id } });

      /*
        ⚠️ CLOSE THE GAP IN THE SIBLING ORDER.

        Deleting order 2 from [0,1,2,3] leaves [0,1,3]. Nothing renders wrong — the list is still
        sorted — but the sequence now has a hole, and any reorder written as "swap two rows'
        order values" starts producing results that look random. Renumbering here keeps the
        invariant that a sibling list is always 0..n-1, which is what makes the move handler
        simple enough to be correct.
      */
      const siblings = await tx.roadmapNode.findMany({
        where: { roadmapId: node.roadmapId, parentId: node.parentId },
        select: { id: true, order: true },
        orderBy: { order: 'asc' },
      });
      for (const write of renumber(siblings)) {
        await tx.roadmapNode.update({ where: { id: write.id }, data: { order: write.order } });
      }

      await touchRoadmap(tx, node.roadmapId);
    });

    invalidatePages();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting roadmap node:', error);
    return NextResponse.json({ error: 'Failed to delete topic' }, { status: 500 });
  }
}
