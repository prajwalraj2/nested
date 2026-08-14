// src/app/api/admin/rich-text/[pageId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

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

    // Calculate word count and plain text for search
    const plainText = htmlContent.replace(/<[^>]*>/g, '').trim();
    const wordCount = plainText ? plainText.split(/\s+/).length : 0;

    // Update or create rich text content
    const richTextContent = await prisma.richTextContent.upsert({
      where: { pageId: pageId },
      update: {
        htmlContent: htmlContent.trim(),
        title: title || null,
        wordCount,
        plainText
      },
      create: {
        pageId,
        htmlContent: htmlContent.trim(),
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
