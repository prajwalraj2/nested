import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SUPPORTED_COUNTRIES, ALL_COUNTRIES } from '@/lib/countries';

/**
 * Individual Page API Routes
 * 
 * Handles operations on specific pages:
 * - GET: Fetch single page with full context
 * - PUT: Update page with validation
 * - DELETE: Delete page and all descendants
 * - PATCH: Quick updates (parent changes, etc.) - not yet implemented
 */

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/admin/pages/[id]
 * Fetch single page with full context
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const page = await prisma.page.findUnique({
      where: { id },
      include: {
        domain: {
          select: {
            id: true,
            name: true,
            slug: true,
            pageType: true
          }
        },
        parent: {
          select: {
            id: true,
            title: true,
            slug: true
          }
        }
      }
    });

    if (!page) {
      return NextResponse.json(
        { success: false, message: 'Page not found' },
        { status: 404 }
      );
    }

    // Get children and siblings
    const children = await prisma.page.findMany({
      where: { parentId: id },
      select: {
        id: true,
        title: true,
        slug: true,
        contentType: true,
        createdAt: true
      },
      orderBy: { order: 'asc' }
    });

    const siblings = await prisma.page.findMany({
      where: {
        domainId: page.domainId,
        parentId: page.parentId,
        id: { not: id }
      },
      select: {
        id: true,
        title: true,
        slug: true
      },
      orderBy: { order: 'asc' }
    });

    // Get all pages for URL building
    const allPages = await prisma.page.findMany({
      where: { domainId: page.domainId },
      select: { id: true, slug: true, parentId: true }
    });

    return NextResponse.json({
      success: true,
      page: {
        id: page.id,
        title: page.title,
        slug: page.slug,
        contentType: page.contentType,
        parentId: page.parentId,
        domainId: page.domainId,
        targetCountries: page.targetCountries,
        createdAt: page.createdAt,
        order: page.order,
        
        // Related data
        domain: page.domain,
        parent: page.parent,
        children,
        siblings,
        
        // Statistics
        childrenCount: children.length,
        siblingsCount: siblings.length,
        
        // URLs
        previewUrl: generatePagePreviewUrl(page, page.domain, allPages)
      }
    });

  } catch (error) {
    console.error('Error fetching page:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch page' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/pages/[id]
 * Update an existing page
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if page exists
    const existingPage = await prisma.page.findUnique({
      where: { id },
      include: {
        domain: {
          select: { id: true, pageType: true }
        }
      }
    });

    if (!existingPage) {
      return NextResponse.json(
        { success: false, message: 'Page not found' },
        { status: 404 }
      );
    }

    // Validate request data
    const validationError = validatePageUpdateData(body);
    if (validationError) {
      return NextResponse.json(
        { success: false, message: validationError },
        { status: 400 }
      );
    }

    const { title, slug, contentType, parentId, targetCountries } = body;

    // Verify parent exists and prevent circular references
    if (parentId && parentId !== existingPage.parentId) {
      const parent = await prisma.page.findUnique({
        where: { id: parentId }
      });

      if (!parent || parent.domainId !== existingPage.domainId) {
        return NextResponse.json(
          { success: false, message: 'Invalid parent page' },
          { status: 400 }
        );
      }

      // Check for circular reference (parent cannot be a descendant)
      const isCircular = await isDescendantOf(parentId, id);
      if (isCircular) {
        return NextResponse.json(
          { success: false, message: 'Cannot set parent: this would create a circular reference' },
          { status: 400 }
        );
      }
    }

    // Check for slug conflicts (excluding current page)
    if (slug !== existingPage.slug || parentId !== existingPage.parentId) {
      const conflictingPage = await prisma.page.findFirst({
        where: {
          domainId: existingPage.domainId,
          slug: slug.toLowerCase(),
          parentId: parentId || null,
          id: { not: id }
        }
      });

      if (conflictingPage) {
        const context = parentId ? 'under the same parent' : 'at the root level';
        return NextResponse.json(
          { success: false, message: `A page with slug "${slug}" already exists ${context}` },
          { status: 409 }
        );
      }
    }

    // Process targetCountries
    const validTargetCountries = validateAndProcessTargetCountries(
      targetCountries, 
      existingPage.targetCountries
    );

    // Update the page
    const updatedPage = await prisma.page.update({
      where: { id },
      data: {
        title: title.trim(),
        slug: slug.trim().toLowerCase(),
        contentType,
        parentId: parentId || null,
        targetCountries: validTargetCountries
      },
      include: {
        domain: {
          select: {
            id: true,
            name: true,
            slug: true,
            pageType: true
          }
        },
        parent: {
          select: {
            id: true,
            title: true,
            slug: true
          }
        }
      }
    });

    // Get all pages for URL building
    const allPages = await prisma.page.findMany({
      where: { domainId: updatedPage.domainId },
      select: { id: true, slug: true, parentId: true }
    });

    return NextResponse.json({
      success: true,
      message: 'Page updated successfully',
      page: {
        id: updatedPage.id,
        title: updatedPage.title,
        slug: updatedPage.slug,
        contentType: updatedPage.contentType,
        parentId: updatedPage.parentId,
        domainId: updatedPage.domainId,
        targetCountries: updatedPage.targetCountries,
        createdAt: updatedPage.createdAt,
        order: updatedPage.order,
        
        // Related data
        domain: updatedPage.domain,
        parent: updatedPage.parent,
        
        // URLs
        previewUrl: generatePagePreviewUrl(updatedPage, updatedPage.domain, allPages)
      }
    });

  } catch (error) {
    console.error('Error updating page:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update page' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/pages/[id]
 * Delete a page and all its descendants
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check if page exists
    const page = await prisma.page.findUnique({
      where: { id },
      select: { 
        id: true, 
        title: true, 
        slug: true, 
        domainId: true 
      }
    });

    if (!page) {
      return NextResponse.json(
        { success: false, message: 'Page not found' },
        { status: 404 }
      );
    }

    // Prevent deletion of __main__ page
    if (page.slug === '__main__') {
      return NextResponse.json(
        { success: false, message: 'Cannot delete the main page' },
        { status: 400 }
      );
    }

    // Get all descendants for deletion count
    const descendants = await getAllDescendants(id);
    const totalPagesToDelete = descendants.length + 1; // +1 for the page itself

    // Use transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // Get all page IDs that will be deleted (including descendants)
      const allPageIds = [id, ...descendants.map(d => d.id)];

      // First delete all content blocks for all pages
      await tx.contentBlock.deleteMany({
        where: {
          pageId: { in: allPageIds }
        }
      });

      // Then delete all descendant pages (in reverse order of depth)
      if (descendants.length > 0) {
        // Sort by depth (deepest first) to avoid foreign key constraints
        const sortedDescendants = descendants.sort((a, b) => b.depth - a.depth);
        
        for (const descendant of sortedDescendants) {
          await tx.page.delete({
            where: { id: descendant.id }
          });
        }
      }

      // Finally delete the main page
      await tx.page.delete({
        where: { id }
      });
    });

    return NextResponse.json({
      success: true,
      message: `Page "${page.title}" and ${descendants.length} descendant page${descendants.length !== 1 ? 's' : ''} deleted successfully`,
      deletedPages: totalPagesToDelete
    });

  } catch (error) {
    console.error('Error deleting page:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete page' },
      { status: 500 }
    );
  }
}

/**
 * Helper Functions
 */

/**
 * Check if pageId is a descendant of ancestorId (circular reference detection)
 */
async function isDescendantOf(pageId: string, ancestorId: string): Promise<boolean> {
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { parentId: true }
  });

  if (!page || !page.parentId) return false;
  if (page.parentId === ancestorId) return true;
  
  return isDescendantOf(page.parentId, ancestorId);
}

/**
 * Get all descendants of a page recursively
 */
async function getAllDescendants(pageId: string, depth = 0): Promise<Array<{id: string, depth: number}>> {
  const children = await prisma.page.findMany({
    where: { parentId: pageId },
    select: { id: true }
  });

  let descendants: Array<{id: string, depth: number}> = [];

  for (const child of children) {
    descendants.push({ id: child.id, depth });
    const childDescendants = await getAllDescendants(child.id, depth + 1);
    descendants = descendants.concat(childDescendants);
  }

  return descendants;
}

/**
 * Validate page data for updates
 */
function validatePageUpdateData(data: any): string | null {
  if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
    return 'Page title is required';
  }

  if (!data.slug || typeof data.slug !== 'string' || !data.slug.trim()) {
    return 'Page slug is required';
  }

  // Validate content type
  const validContentTypes = [
    'narrative', 
    'section_based', 
    'subcategory_list', 
    'table', 
    'rich_text', 
    'mixed_content'
  ];
  
  if (!data.contentType || !validContentTypes.includes(data.contentType)) {
    return `Content type must be one of: ${validContentTypes.join(', ')}`;
  }

  // Validate slug format
  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(data.slug.trim())) {
    return 'Slug must contain only lowercase letters, numbers, and hyphens';
  }

  // Validate targetCountries if provided
  if (data.targetCountries !== undefined) {
    const tcError = validateTargetCountriesFormat(data.targetCountries);
    if (tcError) return tcError;
  }

  return null;
}

/**
 * Validate targetCountries format
 */
function validateTargetCountriesFormat(targetCountries: any): string | null {
  if (!Array.isArray(targetCountries)) {
    return 'Target countries must be an array';
  }

  if (targetCountries.length === 0) {
    return 'Target countries cannot be empty';
  }

  const validCountries = [ALL_COUNTRIES, ...SUPPORTED_COUNTRIES];
  
  for (const country of targetCountries) {
    if (typeof country !== 'string') {
      return 'Each target country must be a string';
    }
    if (!validCountries.includes(country)) {
      return `Invalid country code: ${country}. Valid codes are: ${validCountries.join(', ')}`;
    }
  }

  return null;
}

/**
 * Validate and process targetCountries - returns valid array or existing value
 */
function validateAndProcessTargetCountries(targetCountries: any, existingValue: string[]): string[] {
  // If not provided, keep existing value
  if (targetCountries === undefined) {
    return existingValue;
  }

  // Default to ["ALL"] if null or empty array
  if (!targetCountries || !Array.isArray(targetCountries) || targetCountries.length === 0) {
    return [ALL_COUNTRIES];
  }

  const validCountries = [ALL_COUNTRIES, ...SUPPORTED_COUNTRIES];
  
  // Filter to only valid country codes
  const validatedCountries = targetCountries.filter(
    (c: any) => typeof c === 'string' && validCountries.includes(c)
  );

  // Return existing if no valid countries after filtering
  return validatedCountries.length > 0 ? validatedCountries : existingValue;
}

/**
 * Generate preview URL for a page based on domain type and hierarchy
 */
function generatePagePreviewUrl(page: any, domain: any, allPages: any[]): string {
  if (!domain) return '#';
  
  // Skip __main__ pages - they represent the domain root
  if (page.slug === '__main__') {
    return `/domain/${domain.slug}`;
  }
  
  // Build full path considering parent hierarchy
  const buildPath = (pageId: string): string => {
    const currentPage = allPages.find(p => p.id === pageId);
    if (!currentPage) return '';
    
    // If this page's parent is __main__, don't include __main__ in path
    if (currentPage.parentId) {
      const parent = allPages.find(p => p.id === currentPage.parentId);
      if (parent && parent.slug === '__main__') {
        return currentPage.slug;
      } else if (parent) {
        const parentPath = buildPath(parent.id);
        return parentPath ? `${parentPath}/${currentPage.slug}` : currentPage.slug;
      }
    }
    
    return currentPage.slug;
  };
  
  const fullPath = buildPath(page.id);
  return `/domain/${domain.slug}/${fullPath}`;
}
