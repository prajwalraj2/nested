import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Individual Category API Routes
 * 
 * Handles operations on specific categories:
 * - GET: Fetch single category details
 * - PUT: Update category
 * - DELETE: Delete category (with safety checks)
 */

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/admin/categories/[id]
 * Fetch details for a specific category
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const category = await prisma.domainCategory.findUnique({
      where: { id },
      include: {
        domains: {
          select: {
            id: true,
            name: true,
            slug: true,
            isPublished: true
          }
        },
        _count: {
          select: {
            domains: true
          }
        }
      }
    });

    if (!category) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Category not found' 
        },
        { status: 404 }
      );
    }

    // Format response data
    const formattedCategory = {
      id: category.id,
      name: category.name,
      slug: category.slug,
      icon: category.icon,
      description: category.description,
      columnPosition: category.columnPosition,
      categoryOrder: category.categoryOrder,
      isActive: category.isActive,
      createdAt: category.createdAt,
      domainCount: category._count.domains,
      publishedDomains: category.domains.filter(d => d.isPublished).length,
      domains: category.domains
    };

    return NextResponse.json({
      success: true,
      category: formattedCategory
    });

  } catch (error) {
    console.error('Error fetching category:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch category' 
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/categories/[id]
 * Update an existing category
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if category exists
    const existingCategory = await prisma.domainCategory.findUnique({
      where: { id }
    });

    if (!existingCategory) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Category not found' 
        },
        { status: 404 }
      );
    }

    // Validate request data
    const validationError = validateCategoryData(body, id);
    if (validationError) {
      return NextResponse.json(
        { 
          success: false, 
          message: validationError 
        },
        { status: 400 }
      );
    }

    const { name, slug, icon, description, columnPosition, isActive } = body;

    // Check if slug is taken by another category
    if (slug !== existingCategory.slug) {
      const slugConflict = await prisma.domainCategory.findFirst({
        where: { 
          slug,
          id: { not: id } // Exclude current category
        }
      });

      if (slugConflict) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'A category with this slug already exists' 
          },
          { status: 409 }
        );
      }
    }

    // Handle column position change (reorder if necessary)
    let updateData: any = {
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      icon: icon?.trim() || null,
      description: description?.trim() || null,
      isActive: isActive ?? true
    };

    // If column position is changing, calculate new order
    if (columnPosition !== existingCategory.columnPosition) {
      const lastCategoryInNewColumn = await prisma.domainCategory.findFirst({
        where: { columnPosition },
        orderBy: { categoryOrder: 'desc' }
      });

      updateData.columnPosition = columnPosition;
      updateData.categoryOrder = (lastCategoryInNewColumn?.categoryOrder || 0) + 1;
    }

    // Update the category
    const updatedCategory = await prisma.domainCategory.update({
      where: { id },
      data: updateData,
      include: {
        domains: {
          select: {
            id: true,
            name: true,
            isPublished: true
          }
        },
        _count: {
          select: {
            domains: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Category updated successfully',
      category: {
        id: updatedCategory.id,
        name: updatedCategory.name,
        slug: updatedCategory.slug,
        icon: updatedCategory.icon,
        description: updatedCategory.description,
        columnPosition: updatedCategory.columnPosition,
        categoryOrder: updatedCategory.categoryOrder,
        isActive: updatedCategory.isActive,
        createdAt: updatedCategory.createdAt,
        domainCount: updatedCategory._count.domains,
        publishedDomains: updatedCategory.domains.filter(d => d.isPublished).length
      }
    });

  } catch (error) {
    console.error('Error updating category:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to update category' 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/categories/[id]
 * Delete a category (with safety checks)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check if category exists
    const category = await prisma.domainCategory.findUnique({
      where: { id },
      include: {
        domains: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            domains: true
          }
        }
      }
    });

    if (!category) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Category not found' 
        },
        { status: 404 }
      );
    }

    // Check if category has domains
    if (category._count.domains > 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Cannot delete category. It contains ${category._count.domains} domain(s). Please reassign or remove the domains first.`,
          domains: category.domains
        },
        { status: 409 }
      );
    }

    // Safe to delete - no domains assigned
    await prisma.domainCategory.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: 'Category deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting category:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to delete category' 
      },
      { status: 500 }
    );
  }
}

/**
 * Validate category data for updates
 * Similar to create validation but allows checking against existing category
 */
function validateCategoryData(data: any, excludeId?: string): string | null {
  // Required fields
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    return 'Category name is required';
  }

  if (!data.slug || typeof data.slug !== 'string' || !data.slug.trim()) {
    return 'Category slug is required';
  }

  // Validate slug format
  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(data.slug.trim())) {
    return 'Slug must contain only lowercase letters, numbers, and hyphens';
  }

  // Validate column position
  if (!data.columnPosition || ![1, 2, 3].includes(data.columnPosition)) {
    return 'Column position must be 1, 2, or 3';
  }

  // Validate optional fields
  if (data.icon && (typeof data.icon !== 'string' || data.icon.length > 10)) {
    return 'Icon must be a string with maximum 10 characters';
  }

  if (data.description && (typeof data.description !== 'string' || data.description.length > 500)) {
    return 'Description must be a string with maximum 500 characters';
  }

  if (data.isActive !== undefined && typeof data.isActive !== 'boolean') {
    return 'isActive must be a boolean value';
  }

  return null; // No validation errors
}
