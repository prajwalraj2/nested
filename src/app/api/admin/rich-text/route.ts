// src/app/api/admin/rich-text/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
// Shared singleton — NOT `new PrismaClient()`.
//
// This file used to construct its own client at module scope. Two costs:
//   - in dev, Next.js re-evaluates the module on every hot reload, so each save
//     leaked another connection pool until Postgres refused new connections
//   - on Vercel, every serverless instance opened its own pool, multiplying
//     connections against a connection-limited database for no benefit
//
// `src/lib/prisma.ts` stores the client on `globalThis` in non-production so hot
// reloads reuse one pool. The API surface is identical; only the import changes.
// An eslint rule now blocks `new PrismaClient()` outside that file.
import { prisma } from '@/lib/prisma';
/*
  ⚠️ HTML IS STORED VERBATIM. IT IS NOT SANITISED. (#35)

  Sanitisation was removed on 15 Aug 2026 — see `SANITISER-REMOVAL.md`. The import below is
  a plain top-level one again: it used to be a lazy `await import` inside the POST handler,
  purely to keep jsdom out of this file's module graph. `htmlToPlainText` has no
  dependencies at all, so there is nothing left to defer.

  ⚠️ THE COMMENT REMOVED FROM HERE HELD THE ANSWER TO #23, AND WAS NOT READ FOR TWO WEEKS.

  It recorded, verbatim and dated 30 Jul, the exact failure that later cost four deploy
  cycles to rediagnose:

      Failed to load external module jsdom: [ERR_REQUIRE_ESM]
      require() of ES Module @exodus/bytes/encoding-lite.js
      from html-encoding-sniffer/lib/html-encoding-sniffer.js not supported

  Every term needed to solve it — the error code, the ESM-only package, the CommonJS
  package requiring it — was sitting in this repository the whole time. Its stated root
  cause ("a Node version mismatch, fixed by pinning engines.node") was also wrong, which is
  its own lesson: a recorded diagnosis is a lead, not a conclusion.

  **Grep the repository for the error string before investigating an error.** Recorded
  under #23 in NEW-IMPROVEMENTS-2.md.
*/
import { htmlToPlainText } from '@/lib/html-text';
// Finding #22.4 — correct public URLs need the parent chain walked, not two slugs joined.
import { buildPageUrl, toPageMap } from '@/lib/page-path';

/**
 * GET /api/admin/rich-text
 * 
 * Fetch rich text pages by domain
 * Query params: domainId (required)
 * 
 * Returns all pages with contentType="rich_text" from the specified domain,
 * including their rich text content if it exists.
 */
export async function GET(request: NextRequest) {
  try {
    // Layer 2 of defence in depth — see src/lib/api-auth.ts.
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const searchParams = request.nextUrl.searchParams;
    const domainId = searchParams.get('domainId');

    if (!domainId) {
      return NextResponse.json(
        { error: 'domainId query parameter is required' },
        { status: 400 }
      );
    }

    // Fetch pages with contentType="rich_text" from the specified domain
    const pages = await prisma.page.findMany({
      where: {
        domainId: domainId,
        contentType: 'rich_text'
      },
      include: {
        domain: {
          select: {
            name: true,
            slug: true
          }
        },
        richTextContent: {
          select: {
            id: true,
            htmlContent: true,
            wordCount: true,
            updatedAt: true
          }
        }
      },
      orderBy: [
        { title: 'asc' }
      ]
    });

    /**
     * ⚠️ WHY A SECOND QUERY — AND WHY `previewUrl` IS COMPUTED HERE, NOT IN THE CLIENT
     *
     * `RichTextManager` used to build its Preview link as
     * `/domain/${page.domain.slug}/${page.slug}`. That is only correct for a page one
     * level below the domain root. Measured across the database: **323 of 418 rich-text
     * pages (77.3%) got a URL that 404s** (finding #22.4) — e.g.
     *
     *     emitted : /domain/webdev/shopifystore
     *     correct : /domain/webdev/nocode/definingservices/shopifystore
     *
     * The client cannot fix this itself: the response above contains only `rich_text`
     * pages, and the ancestors are usually `section_based` or `subcategory_list`, so the
     * chain simply is not present in the payload. Fetching it here is the only place the
     * data exists.
     *
     * The query is cheap and deliberately narrow — three columns for every page in ONE
     * domain (tens of rows, not the 1,195-row table). Selecting only what
     * `PagePathNode` needs also keeps this from becoming another #22.1-style over-fetch.
     */
    const chainPages = await prisma.page.findMany({
      where: { domainId: domainId },
      select: { id: true, slug: true, parentId: true },
    });
    const pagesById = toPageMap(chainPages);

    const pagesWithUrls = pages.map(page => ({
      ...page,
      /**
       * `null` when the page has no reachable public URL — the client renders a disabled
       * control rather than a link it knows is broken. That is the actual fix: the old
       * code always produced *a* link, which is why 433 of them silently 404'd.
       */
      previewUrl: buildPageUrl(page, page.domain.slug, pagesById),
    }));

    return NextResponse.json({
      success: true,
      pages: pagesWithUrls,
      total: pages.length
    });

  } catch (error) {
    console.error('Error fetching rich text pages:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch rich text pages',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/rich-text
 * 
 * Create new rich text content for a page
 * Body: { pageId: string, htmlContent: string, title?: string }
 */
export async function POST(request: NextRequest) {
  try {
    // ⚠️ This writes raw `htmlContent`, which RichTextLayout.tsx later renders with
    // dangerouslySetInnerHTML on a PUBLIC page. Unauthenticated, that was a stored-XSS
    // hole (finding #2): anyone could inject <script> into any page. This guard closes
    // it. Sanitising the HTML on write is still planned as defence in depth.
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const body = await request.json();
    const { pageId, htmlContent, title } = body;

    if (!pageId || !htmlContent) {
      return NextResponse.json(
        { error: 'pageId and htmlContent are required' },
        { status: 400 }
      );
    }

    // Check if page exists and has contentType="rich_text"
    const page = await prisma.page.findUnique({
      where: { id: pageId },
      select: { id: true, contentType: true }
    });

    if (!page) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    if (page.contentType !== 'rich_text') {
      return NextResponse.json(
        { error: 'Page must have contentType="rich_text"' },
        { status: 400 }
      );
    }

    /*
      ⚠️ Named `html`, not `safeHtml` — same reasoning as the PUT in ./[pageId]/route.ts.
      Nothing cleans this. See #35.
    */
    const html = htmlContent.trim();

    if (!html) {
      return NextResponse.json(
        { error: 'htmlContent cannot be empty' },
        { status: 400 }
      );
    }

    // Tag-stripped text for search and the word count. ⚠️ Runs on RAW author HTML now.
    const plainText = htmlToPlainText(html);
    const wordCount = plainText ? plainText.split(/\s+/).length : 0;

    // Create or update rich text content
    const richTextContent = await prisma.richTextContent.upsert({
      where: { pageId: pageId },
      update: {
        htmlContent: html,
        title: title || null,
        wordCount,
        plainText
      },
      create: {
        pageId,
        htmlContent: html,
        title: title || null,
        wordCount,
        plainText
      }
    });

    return NextResponse.json({
      success: true,
      richTextContent: {
        id: richTextContent.id,
        htmlContent: richTextContent.htmlContent,
        wordCount: richTextContent.wordCount,
        updatedAt: richTextContent.updatedAt
      }
    });

  } catch (error) {
    console.error('Error creating/updating rich text content:', error);
    return NextResponse.json(
      { 
        error: 'Failed to save rich text content',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}
