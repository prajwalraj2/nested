import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Categories API Route
 * 
 * Handles CRUD operations for domain categories:
 * - GET: Fetch all categories (with domain counts)
 * - POST: Create new category
 * 
 * Includes proper error handling and validation
 */

/**
 * GET /api/admin/categories
 * Fetch all categories with their domain information
 */
export async function GET() {
  try {
    // Check admin authentication
    const session = await auth()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const categories = await prisma.domainCategory.findMany({
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
      },
      orderBy: [
        { columnPosition: 'asc' },
        { categoryOrder: 'asc' }
      ]
    });

    // Transform data for API response
    const formattedCategories = categories.map(category => ({
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
    }));

    return NextResponse.json({
      success: true,
      categories: formattedCategories
    });

  } catch (error) {
    console.error('Error fetching categories:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch categories' 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/categories  
 * Create a new category
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const session = await auth()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Parse request body
    const body = await request.json();
    
    // Validate required fields
    const validationError = validateCategoryData(body);
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

    // Check if slug is already taken
    const existingCategory = await prisma.domainCategory.findUnique({
      where: { slug }
    });

    if (existingCategory) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'A category with this slug already exists' 
        },
        { status: 409 }
      );
    }

    // Get the next order position for the specified column
    const lastCategoryInColumn = await prisma.domainCategory.findFirst({
      where: { columnPosition },
      orderBy: { categoryOrder: 'desc' }
    });

    const nextOrder = (lastCategoryInColumn?.categoryOrder || 0) + 1;

    // Create the category
    const newCategory = await prisma.domainCategory.create({
      data: {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        icon: icon?.trim() || null,
        description: description?.trim() || null,
        columnPosition,
        categoryOrder: nextOrder,
        isActive: isActive ?? true
      },
      include: {
        _count: {
          select: {
            domains: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Category created successfully',
      category: {
        id: newCategory.id,
        name: newCategory.name,
        slug: newCategory.slug,
        icon: newCategory.icon,
        description: newCategory.description,
        columnPosition: newCategory.columnPosition,
        categoryOrder: newCategory.categoryOrder,
        isActive: newCategory.isActive,
        createdAt: newCategory.createdAt,
        domainCount: newCategory._count.domains,
        publishedDomains: 0 // New category has no domains yet
      }
    });

  } catch (error) {
    console.error('Error creating category:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to create category' 
      },
      { status: 500 }
    );
  }
}

/**
 * Validate category data for creation/updates
 */
function validateCategoryData(data: any): string | null {
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
