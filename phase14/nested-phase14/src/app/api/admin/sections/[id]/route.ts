// src/app/api/admin/sections/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * API Route for Sections Management
 * 
 * Handles updating the sections configuration for a specific page.
 * The sections field stores JSON data about how child pages are organized
 * into the 3-column layout.
 * 
 * PUT /api/admin/sections/[id] - Update sections configuration
 * GET /api/admin/sections/[id] - Get current sections configuration
 */

// Type definitions for better TypeScript support
type Section = {
  title: string;
  column: number;
  order: number;
  pageIds: string[];
};

type UpdateSectionsRequest = {
  sections: Section[];
};

/**
 * GET /api/admin/sections/[id]
 * Retrieve current sections configuration for a page
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const awaitedParams = await params;
    const pageId = awaitedParams.id;

    // Validate page ID
    if (!pageId) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      );
    }

    // Fetch the page with its sections configuration
    const page = await prisma.page.findUnique({
      where: { id: pageId },
      select: {
        id: true,
        title: true,
        slug: true,
        contentType: true,
        sections: true,
        subPages: {
          select: {
            id: true,
            title: true,
            slug: true,
            contentType: true
          },
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!page) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    // Ensure the page is section-based
    if (page.contentType !== 'section_based') {
      return NextResponse.json(
        { error: 'Page is not section-based' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      page,
      sections: page.sections || []
    });

  } catch (error) {
    console.error('Error fetching sections configuration:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/sections/[id]
 * Update sections configuration for a page
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const awaitedParams = await params;
    const pageId = awaitedParams.id;

    // Validate page ID
    if (!pageId) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json() as UpdateSectionsRequest;
    const { sections } = body;

    // Validate sections data
    if (!Array.isArray(sections)) {
      return NextResponse.json(
        { error: 'Sections must be an array' },
        { status: 400 }
      );
    }

    // Validate each section
    for (const section of sections) {
      if (!section.title || typeof section.title !== 'string') {
        return NextResponse.json(
          { error: 'Each section must have a title' },
          { status: 400 }
        );
      }
      
      if (!section.column || ![1, 2, 3].includes(section.column)) {
        return NextResponse.json(
          { error: 'Each section must have a valid column (1, 2, or 3)' },
          { status: 400 }
        );
      }
      
      if (typeof section.order !== 'number') {
        return NextResponse.json(
          { error: 'Each section must have a numeric order' },
          { status: 400 }
        );
      }
      
      if (!Array.isArray(section.pageIds)) {
        return NextResponse.json(
          { error: 'Each section must have a pageIds array' },
          { status: 400 }
        );
      }
    }

    // Verify the page exists and is section-based
    const existingPage = await prisma.page.findUnique({
      where: { id: pageId },
      select: {
        id: true,
        contentType: true,
        subPages: {
          select: { id: true }
        }
      }
    });

    if (!existingPage) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    if (existingPage.contentType !== 'section_based') {
      return NextResponse.json(
        { error: 'Page is not section-based' },
        { status: 400 }
      );
    }

    // Validate that all pageIds in sections exist as child pages
    const childPageIds = existingPage.subPages.map(page => page.id);
    const allSectionPageIds = sections.flatMap(section => section.pageIds);
    
    for (const pageId of allSectionPageIds) {
      if (!childPageIds.includes(pageId)) {
        return NextResponse.json(
          { error: `Page ID ${pageId} is not a child of this page` },
          { status: 400 }
        );
      }
    }

    // Update the page with new sections configuration
    const updatedPage = await prisma.page.update({
      where: { id: pageId },
      data: {
        sections: sections
      },
      select: {
        id: true,
        title: true,
        slug: true,
        contentType: true,
        sections: true,
        subPages: {
          select: {
            id: true,
            title: true,
            slug: true,
            contentType: true
          },
          orderBy: { order: 'asc' }
        }
      }
    });

    return NextResponse.json({
      message: 'Sections configuration updated successfully',
      page: updatedPage
    });

  } catch (error) {
    console.error('Error updating sections configuration:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
