import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SUPPORTED_COUNTRIES, ALL_COUNTRIES } from '@/lib/countries';

/**
 * Individual Domain API Routes
 * 
 * Handles operations on specific domains:
 * - GET: Fetch single domain details
 * - PUT: Update domain
 * - DELETE: Delete domain (with safety checks)
 * - PATCH: Toggle publication status
 */

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/admin/domains/[id]
 * Fetch details for a specific domain
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const domain = await prisma.domain.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
            columnPosition: true
          }
        },
        pages: {
          select: {
            id: true,
            title: true,
            slug: true,
            contentType: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            pages: true
          }
        }
      }
    });

    if (!domain) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Domain not found' 
        },
        { status: 404 }
      );
    }

    // Format response data
    const formattedDomain = {
      id: domain.id,
      name: domain.name,
      slug: domain.slug,
      pageType: domain.pageType,
      isPublished: domain.isPublished,
      orderInCategory: domain.orderInCategory,
      targetCountries: domain.targetCountries,
      createdAt: domain.createdAt,
      category: domain.category,
      pages: domain.pages,
      pageCount: domain._count.pages,
      previewUrl: `/domain/${domain.slug}`
    };

    return NextResponse.json({
      success: true,
      domain: formattedDomain
    });

  } catch (error) {
    console.error('Error fetching domain:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch domain' 
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/domains/[id]
 * Update an existing domain
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if domain exists
    const existingDomain = await prisma.domain.findUnique({
      where: { id }
    });

    if (!existingDomain) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Domain not found' 
        },
        { status: 404 }
      );
    }

    // Validate request data
    const validationError = validateDomainData(body, id);
    if (validationError) {
      return NextResponse.json(
        { 
          success: false, 
          message: validationError 
        },
        { status: 400 }
      );
    }

    const { name, slug, pageType, categoryId, orderInCategory, isPublished, targetCountries } = body;

    // Check if slug is taken by another domain
    if (slug !== existingDomain.slug) {
      const slugConflict = await prisma.domain.findFirst({
        where: { 
          slug,
          id: { not: id } // Exclude current domain
        }
      });

      if (slugConflict) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'A domain with this slug already exists' 
          },
          { status: 409 }
        );
      }
    }

    // Verify category exists if changing
    if (categoryId !== existingDomain.categoryId) {
      const category = await prisma.domainCategory.findUnique({
        where: { id: categoryId }
      });

      if (!category) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Selected category does not exist' 
          },
          { status: 400 }
        );
      }
    }

    // Handle page type change from direct to hierarchical or vice versa
    if (pageType !== existingDomain.pageType) {
      if (pageType === 'direct' && existingDomain.pageType === 'hierarchical') {
        // Create __main__ page if switching to direct
        const mainPageExists = await prisma.page.findFirst({
          where: {
            domainId: id,
            slug: '__main__'
          }
        });

        if (!mainPageExists) {
          await prisma.page.create({
            data: {
              title: name.trim(),
              slug: '__main__',
              domainId: id,
              contentType: 'section_based',
              parentId: null
            }
          });
        }
      }
      // Note: When switching from direct to hierarchical, we keep the __main__ page
      // but it won't be used in the hierarchical structure
    }

    // Process targetCountries
    const validTargetCountries = validateAndProcessTargetCountries(
      targetCountries, 
      existingDomain.targetCountries
    );

    // Update the domain
    const updatedDomain = await prisma.domain.update({
      where: { id },
      data: {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        pageType,
        categoryId,
        orderInCategory: parseInt(orderInCategory.toString()),
        isPublished: isPublished ?? existingDomain.isPublished,
        targetCountries: validTargetCountries
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
            columnPosition: true
          }
        },
        _count: {
          select: {
            pages: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Domain updated successfully',
      domain: {
        id: updatedDomain.id,
        name: updatedDomain.name,
        slug: updatedDomain.slug,
        pageType: updatedDomain.pageType,
        isPublished: updatedDomain.isPublished,
        orderInCategory: updatedDomain.orderInCategory,
        targetCountries: updatedDomain.targetCountries,
        createdAt: updatedDomain.createdAt,
        category: updatedDomain.category,
        pageCount: updatedDomain._count.pages,
        previewUrl: `/domain/${updatedDomain.slug}`
      }
    });

  } catch (error) {
    console.error('Error updating domain:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to update domain' 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/domains/[id]
 * Delete a domain (with safety checks)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check if domain exists and get page count
    const domain = await prisma.domain.findUnique({
      where: { id },
      include: {
        pages: {
          select: {
            id: true,
            title: true
          }
        },
        _count: {
          select: {
            pages: true
          }
        }
      }
    });

    if (!domain) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Domain not found' 
        },
        { status: 404 }
      );
    }

    // Use transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // First delete all content blocks associated with pages
      if (domain._count.pages > 0) {
        const pageIds = domain.pages.map(p => p.id);
        
        await tx.contentBlock.deleteMany({
          where: {
            pageId: { in: pageIds }
          }
        });
      }

      // Then delete all pages
      await tx.page.deleteMany({
        where: { domainId: id }
      });

      // Finally delete the domain
      await tx.domain.delete({
        where: { id }
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Domain deleted successfully',
      deletedPages: domain._count.pages
    });

  } catch (error) {
    console.error('Error deleting domain:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to delete domain' 
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/domains/[id]
 * Toggle publication status or update specific fields
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if domain exists
    const existingDomain = await prisma.domain.findUnique({
      where: { id }
    });

    if (!existingDomain) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Domain not found' 
        },
        { status: 404 }
      );
    }

    // Handle publication status toggle
    if ('isPublished' in body) {
      const updatedDomain = await prisma.domain.update({
        where: { id },
        data: { isPublished: body.isPublished },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              icon: true,
              columnPosition: true
            }
          }
        }
      });

      return NextResponse.json({
        success: true,
        message: `Domain ${body.isPublished ? 'published' : 'unpublished'} successfully`,
        domain: {
          id: updatedDomain.id,
          name: updatedDomain.name,
          slug: updatedDomain.slug,
          pageType: updatedDomain.pageType,
          isPublished: updatedDomain.isPublished,
          orderInCategory: updatedDomain.orderInCategory,
          category: updatedDomain.category
        }
      });
    }

    // Handle order change
    if ('orderInCategory' in body) {
      const updatedDomain = await prisma.domain.update({
        where: { id },
        data: { orderInCategory: parseInt(body.orderInCategory) }
      });

      return NextResponse.json({
        success: true,
        message: 'Domain order updated successfully',
        domain: {
          id: updatedDomain.id,
          orderInCategory: updatedDomain.orderInCategory
        }
      });
    }

    // Handle targetCountries change
    if ('targetCountries' in body) {
      const validTargetCountries = validateAndProcessTargetCountries(
        body.targetCountries, 
        existingDomain.targetCountries
      );

      const updatedDomain = await prisma.domain.update({
        where: { id },
        data: { targetCountries: validTargetCountries }
      });

      return NextResponse.json({
        success: true,
        message: 'Domain target countries updated successfully',
        domain: {
          id: updatedDomain.id,
          targetCountries: updatedDomain.targetCountries
        }
      });
    }

    return NextResponse.json(
      { 
        success: false, 
        message: 'No valid fields provided for update' 
      },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error updating domain:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to update domain' 
      },
      { status: 500 }
    );
  }
}

/**
 * Validate domain data for updates
 * Similar to create validation but allows checking against existing domain
 */
function validateDomainData(data: any, excludeId?: string): string | null {
  // Required fields
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    return 'Domain name is required';
  }

  if (!data.slug || typeof data.slug !== 'string' || !data.slug.trim()) {
    return 'Domain slug is required';
  }

  if (!data.categoryId || typeof data.categoryId !== 'string') {
    return 'Category selection is required';
  }

  // Validate page type
  if (!data.pageType || !['direct', 'hierarchical'].includes(data.pageType)) {
    return 'Page type must be either "direct" or "hierarchical"';
  }

  // Validate slug format
  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(data.slug.trim())) {
    return 'Slug must contain only lowercase letters, numbers, and hyphens';
  }

  // Validate order if provided
  if (data.orderInCategory !== undefined && data.orderInCategory !== null) {
    const order = parseInt(data.orderInCategory);
    if (isNaN(order) || order < 0) {
      return 'Order in category must be a non-negative number';
    }
  }

  // Validate publication status
  if (data.isPublished !== undefined && typeof data.isPublished !== 'boolean') {
    return 'Publication status must be a boolean value';
  }

  // Validate targetCountries if provided
  if (data.targetCountries !== undefined) {
    const tcError = validateTargetCountriesFormat(data.targetCountries);
    if (tcError) return tcError;
  }

  return null; // No validation errors
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
