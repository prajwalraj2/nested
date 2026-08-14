// src/app/api/admin/rich-text/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

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

    return NextResponse.json({
      success: true,
      pages: pages,
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

    // Calculate word count and plain text for search
    const plainText = htmlContent.replace(/<[^>]*>/g, '').trim();
    const wordCount = plainText ? plainText.split(/\s+/).length : 0;

    // Create or update rich text content
    const richTextContent = await prisma.richTextContent.upsert({
      where: { pageId: pageId },
      update: {
        htmlContent,
        title: title || null,
        wordCount,
        plainText
      },
      create: {
        pageId,
        htmlContent,
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
