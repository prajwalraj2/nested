// src/app/api/admin/rich-text/[pageId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
// Shared singleton — see the note in ../route.ts. Constructing a client per module
// leaked a connection pool on every dev hot reload and opened a redundant pool per
// serverless instance in production.
import { prisma } from '@/lib/prisma';
/*
  ⚠️ HTML IS STORED VERBATIM. IT IS NOT SANITISED. (#35)

  This used to import `sanitizeRichTextHtml` alongside `htmlToPlainText`. Sanitisation was
  removed on 15 Aug 2026 — see `SANITISER-REMOVAL.md` for the reasoning and the accepted
  risk, and NEW-IMPROVEMENTS-2.md #35 for how to put it back.

  Short version: finding #2 rated this **Medium once #1 was fixed**, because #1 — the
  endpoint being unauthenticated — was the part that let strangers write. The remaining
  exposure is a single trusted admin pasting something they did not read.

  ⚠️ Whatever this endpoint stores is rendered to every public visitor through
  `dangerouslySetInnerHTML` in RichTextLayout.tsx. There is nothing between the author's
  paste and that render. `RICH-TEXT-GUIDE.md` is the control.
*/
import { htmlToPlainText } from '@/lib/html-text';

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

    /*
      ⚠️ Named `html`, not `safeHtml`. The old name asserted a guarantee this code no
      longer provides, and a variable called `safeHtml` is exactly the kind of thing a
      future reader trusts without checking. See #35.
    */
    const html = htmlContent.trim();

    if (!html) {
      return NextResponse.json(
        { error: 'htmlContent cannot be empty' },
        { status: 400 }
      );
    }

    // Tag-stripped text for search and the word count. ⚠️ This now runs on RAW author
    // HTML rather than sanitised output — see the note in src/lib/html-text.ts.
    const plainText = htmlToPlainText(html);
    const wordCount = plainText ? plainText.split(/\s+/).length : 0;

    // Update or create rich text content
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
