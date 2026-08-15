// src/app/api/admin/roadmaps/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
// Shared singleton — see the note in ../rich-text/route.ts. Constructing a client per module
// leaks a connection pool on every dev hot reload and opens a redundant pool per serverless
// instance in production.
import { prisma } from '@/lib/prisma';
// Finding #22.4 — a correct public URL needs the parent chain walked, not two slugs joined.
import { buildPageUrl, toPageMap } from '@/lib/page-path';

/**
 * GET /api/admin/roadmaps?domainId=…
 * ============================================================================
 *
 * Every page in the domain whose `contentType` is `roadmap`, with its `Roadmap` row if one
 * exists yet and a count of its nodes.
 *
 * ⚠️ PAGES WITH NO `Roadmap` ROW MUST BE INCLUDED, NOT FILTERED OUT.
 *
 * That is the normal state immediately after a page is created — L-2 adds the page type but
 * nothing creates the `Roadmap` row automatically. A screen that listed only pages which
 * already have one would show an empty list and offer no way to create the first roadmap,
 * which is the same class of dead end as `/admin/images` hiding unused images. The `Create`
 * / `Edit` split in the UI is driven entirely by whether `roadmap` is null here.
 */
export async function GET(request: NextRequest) {
  try {
    // Layer 2 of defence in depth — see src/lib/api-auth.ts.
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const domainId = request.nextUrl.searchParams.get('domainId');
    if (!domainId) {
      return NextResponse.json(
        { error: 'domainId query parameter is required' },
        { status: 400 }
      );
    }

    const pages = await prisma.page.findMany({
      where: { domainId, contentType: 'roadmap' },
      select: {
        id: true,
        title: true,
        slug: true,
        parentId: true,
        status: true,
        icon: true,
        domain: { select: { name: true, slug: true } },
        roadmap: {
          select: {
            id: true,
            title: true,
            description: true,
            updatedAt: true,
            // ⚠️ A COUNT, NOT THE NODES. This screen only reports "how many topics"; loading
            // the nodes would pull every `htmlContent` blob in the domain to render a number.
            _count: { select: { nodes: true } },
          },
        },
      },
      orderBy: [{ title: 'asc' }],
    });

    /**
     * ⚠️ WHY A SECOND QUERY — AND WHY `previewUrl` IS RESOLVED HERE, NOT IN THE CLIENT.
     *
     * The obvious client-side construction is `/domain/${domain.slug}/${page.slug}`. That is
     * only correct for a page exactly one level below the domain root. Measured for rich text
     * under finding #22.4, the same mistake produced a URL that 404s for **323 of 418 pages
     * (77.3%)**.
     *
     * ⚠️ AND ROADMAPS WILL BE WORSE, BY DESIGN. 33.4 puts each role UNDER a `subcategory_list`
     * chooser — `/domain/webdev/roadmap/frontend` — so a multi-role domain has roadmap pages
     * that are *always* two levels down. The naive form is wrong for every one of them.
     *
     * The client genuinely cannot fix this: the response above contains only roadmap pages,
     * and the ancestors are the `subcategory_list` parents, which are not in the payload.
     *
     * Cheap and narrow: three columns for the pages of ONE domain, not the whole table.
     */
    const chainPages = await prisma.page.findMany({
      where: { domainId },
      select: { id: true, slug: true, parentId: true },
    });
    const pagesById = toPageMap(chainPages);

    const withUrls = pages.map((page) => ({
      ...page,
      nodeCount: page.roadmap?._count.nodes ?? 0,
      // `null` when there is no reachable public URL — the client disables the control rather
      // than linking somewhere it already knows is broken.
      previewUrl: buildPageUrl(page, page.domain.slug, pagesById),
    }));

    return NextResponse.json({ success: true, pages: withUrls, total: withUrls.length });
  } catch (error) {
    console.error('Error fetching roadmaps:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch roadmaps',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/roadmaps
 * ============================================================================
 *
 * Create the `Roadmap` row for a page that does not have one. Body: `{ pageId, title? }`.
 *
 * The node tree is built afterwards in the editor (L-4); this only brings the roadmap into
 * existence so there is something to edit.
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const body = await request.json();
    const { pageId, title, description } = body ?? {};

    if (!pageId || typeof pageId !== 'string') {
      return NextResponse.json({ error: 'pageId is required' }, { status: 400 });
    }

    const page = await prisma.page.findUnique({
      where: { id: pageId },
      select: { id: true, title: true, contentType: true, roadmap: { select: { id: true } } },
    });

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    /*
      ⚠️ Refuse a page of the wrong type rather than quietly creating an orphan.

      A `Roadmap` attached to a `table` page would never render — the switch in
      `domain/[...slug]` dispatches on `contentType`, not on which relations exist — so the row
      would sit in the database invisible, and the only symptom would be a roadmap that the
      admin can edit and nobody can see.
    */
    if (page.contentType !== 'roadmap') {
      return NextResponse.json(
        { error: `Page must have contentType="roadmap" (this page is "${page.contentType}")` },
        { status: 400 }
      );
    }

    // `pageId` is @unique, so a second create would throw P2002. Answering plainly is friendlier
    // than surfacing a Prisma error code, and it makes a double-click idempotent-ish.
    if (page.roadmap) {
      return NextResponse.json(
        { error: 'This page already has a roadmap', roadmapId: page.roadmap.id },
        { status: 409 }
      );
    }

    const roadmap = await prisma.roadmap.create({
      data: {
        pageId,
        /*
          Defaults to the page's own title, which is almost always what is wanted and means the
          create button needs no form.

          ⚠️ `??`, NOT `||` — an author who deliberately passes an empty string should get the
          fallback, but `||` would also swallow any other falsy value if this field ever changes
          shape. This is the #28 discipline applied by default rather than after a bug.
        */
        title: (typeof title === 'string' && title.trim()) || page.title,
        description: typeof description === 'string' && description.trim() ? description.trim() : null,
      },
      select: { id: true, title: true, description: true, updatedAt: true },
    });

    return NextResponse.json({ success: true, roadmap }, { status: 201 });
  } catch (error) {
    console.error('Error creating roadmap:', error);
    return NextResponse.json(
      {
        error: 'Failed to create roadmap',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}
