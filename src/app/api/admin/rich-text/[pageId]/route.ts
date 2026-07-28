// src/app/api/admin/rich-text/[pageId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
// Shared singleton — see the note in ../route.ts. Constructing a client per module
// leaked a connection pool on every dev hot reload and opened a redundant pool per
// serverless instance in production.
import { prisma } from '@/lib/prisma';
// Finding #2: this endpoint's output is rendered with dangerouslySetInnerHTML to every
// public visitor, so the HTML is cleaned before it reaches the database.
import { sanitizeRichTextHtml, htmlToPlainText } from '@/lib/sanitize-html';

interface RouteParams {
  params: Promise<{
    pageId: string;
  }>;
}

/**
 * GET /api/admin/rich-text/[pageId]
 * 
 * Fetch rich text content for a specific page
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Layer 2 of defence in depth — see src/lib/api-auth.ts.
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { pageId } = await params;

    // Fetch page with rich text content
    const page = await prisma.page.findUnique({
      where: { id: pageId },
      include: {
        domain: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        richTextContent: true
      }
    });

    if (!page) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    if (page.contentType !== 'rich_text') {
      return NextResponse.json(
        { error: 'Page is not a rich text page' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      page: {
        id: page.id,
        title: page.title,
        slug: page.slug,
        contentType: page.contentType,
        domain: page.domain,
        richTextContent: page.richTextContent || null
      }
    });

  } catch (error) {
    console.error('Error fetching rich text page:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch rich text page',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/rich-text/[pageId]
 * 
 * Update rich text content for a specific page
 * Body: { htmlContent: string, title?: string }
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // ⚠️ THE MOST IMPORTANT GUARD IN THIS COMMIT.
    // This endpoint stores raw `htmlContent` that RichTextLayout.tsx renders with
    // dangerouslySetInnerHTML to every public visitor. Unauthenticated, it was a
    // stored-XSS → full-site-takeover chain (finding #2): an anonymous request could
    // plant <script> on any page, which would then execute in an admin's browser on
    // our own origin, with access to every other (then-unguarded) admin API.
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { pageId } = await params;
    const body = await request.json();
    const { htmlContent, title } = body;

    if (!htmlContent) {
      return NextResponse.json(
        { error: 'htmlContent is required' },
        { status: 400 }
      );
    }

    // Check if page exists and has correct contentType
    const page = await prisma.page.findUnique({
      where: { id: pageId },
      select: { id: true, contentType: true, title: true }
    });

    if (!page) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    if (page.contentType !== 'rich_text') {
      return NextResponse.json(
        { error: 'Page is not a rich text page' },
        { status: 400 }
      );
    }

    /**
     * ⚠️ SANITISE BEFORE STORING — finding #2.
     *
     * Everything stored here is rendered to every public visitor through
     * `dangerouslySetInnerHTML` in RichTextLayout.tsx:45. Cleaning on WRITE rather
     * than on read matters because read paths are cached (`unstable_cache`, the CDN):
     * one bad write cleaned only at render time would be re-served from cache
     * indefinitely, and every future cache layer would have to remember to sanitise.
     * Doing it once at the boundary means the database only ever holds safe HTML.
     *
     * The allow-list was derived from the 415 rows already stored, so real formatting
     * survives — see src/lib/sanitize-html.ts. It does strip `on*` handlers, which
     * removes the 398 benign hover effects in existing content; the CSS equivalent is
     * in globals.css under `.rich-text-content a:hover`.
     */
    const safeHtml = sanitizeRichTextHtml(htmlContent).trim();

    if (!safeHtml) {
      return NextResponse.json(
        { error: 'htmlContent contained no safe content after sanitisation' },
        { status: 400 }
      );
    }

    // Derived from the SANITISED html, so anything stripped cannot leak into the
    // searchable text layer — e.g. the body of a removed <script>.
    const plainText = htmlToPlainText(safeHtml);
    const wordCount = plainText ? plainText.split(/\s+/).length : 0;

    // Update or create rich text content
    const richTextContent = await prisma.richTextContent.upsert({
      where: { pageId: pageId },
      update: {
        htmlContent: safeHtml,
        title: title || null,
        wordCount,
        plainText
      },
      create: {
        pageId,
        htmlContent: safeHtml,
        title: title || null,
        wordCount,
        plainText
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Rich text content updated successfully',
      richTextContent: {
        id: richTextContent.id,
        htmlContent: richTextContent.htmlContent,
        title: richTextContent.title,
        wordCount: richTextContent.wordCount,
        updatedAt: richTextContent.updatedAt
      }
    });

  } catch (error) {
    console.error('Error updating rich text content:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update rich text content',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/rich-text/[pageId]
 * 
 * Delete rich text content for a specific page
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Destructive: removes the page's rich text content entirely.
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { pageId } = await params;

    // Check if rich text content exists
    const existingContent = await prisma.richTextContent.findUnique({
      where: { pageId: pageId }
    });

    if (!existingContent) {
      return NextResponse.json(
        { error: 'Rich text content not found' },
        { status: 404 }
      );
    }

    // Delete the rich text content
    await prisma.richTextContent.delete({
      where: { pageId: pageId }
    });

    return NextResponse.json({
      success: true,
      message: 'Rich text content deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting rich text content:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete rich text content',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}
