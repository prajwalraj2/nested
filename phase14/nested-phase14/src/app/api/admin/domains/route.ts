import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SUPPORTED_COUNTRIES, ALL_COUNTRIES } from '@/lib/countries';

/**
 * Domains API Route
 * 
 * Handles CRUD operations for content domains:
 * - GET: Fetch all domains (with category information and filtering)
 * - POST: Create new domain
 * 
 * Includes proper error handling, validation, and ordering management
 */



/**
 * GET /api/admin/domains
 * Fetch all domains with their category information and page counts
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const session = await auth()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url);
    
    // Build filter conditions based on query parameters
    const whereConditions: any = {};
    
    // Search filter
    const search = searchParams.get('search');
    if (search) {
      whereConditions.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Category filter
    const categoryId = searchParams.get('category');
    if (categoryId) {
      whereConditions.categoryId = categoryId;
    }
    
    // Status filter
    const status = searchParams.get('status');
    if (status === 'published') {
      whereConditions.isPublished = true;
    } else if (status === 'draft') {
      whereConditions.isPublished = false;
    }
    
    // Page type filter
    const pageType = searchParams.get('pageType');
    if (pageType) {
      whereConditions.pageType = pageType;
    }

    const domains = await prisma.domain.findMany({
      where: whereConditions,
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
      },
      orderBy: [
        { category: { columnPosition: 'asc' } },
        { orderInCategory: 'asc' },
        { name: 'asc' }
      ]
    });

    // Transform data for API response
    const formattedDomains = domains.map(domain => ({
      id: domain.id,
      name: domain.name,
      slug: domain.slug,
      pageType: domain.pageType,
      isPublished: domain.isPublished,
      orderInCategory: domain.orderInCategory,
      targetCountries: domain.targetCountries,
      createdAt: domain.createdAt,
      category: domain.category,
      pageCount: domain._count.pages,
      previewUrl: `/domain/${domain.slug}`
    }));

    return NextResponse.json({
      success: true,
      domains: formattedDomains
    });

  } catch (error) {
    console.error('Error fetching domains:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch domains' 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/domains  
 * Create a new domain
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
    const validationError = validateDomainData(body);
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

    // Check if slug is already taken
    const existingDomain = await prisma.domain.findUnique({
      where: { slug }
    });

    if (existingDomain) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'A domain with this slug already exists' 
        },
        { status: 409 }
      );
    }

    // Verify category exists
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

    // Get the next order position for the category if not specified
    let finalOrderInCategory = orderInCategory;
    if (finalOrderInCategory === 0 || finalOrderInCategory === null || finalOrderInCategory === undefined) {
      const lastDomainInCategory = await prisma.domain.findFirst({
        where: { categoryId },
        orderBy: { orderInCategory: 'desc' }
      });
      finalOrderInCategory = (lastDomainInCategory?.orderInCategory || 0) + 1;
    }

    // Process targetCountries - default to ["ALL"] if not provided
    const validTargetCountries = validateAndProcessTargetCountries(targetCountries);

    // Create the domain
    const newDomain = await prisma.domain.create({
      data: {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        pageType,
        categoryId,
        orderInCategory: finalOrderInCategory,
        isPublished: isPublished ?? false,
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

    // Create implicit main page for direct domains
    if (pageType === 'direct') {
      await prisma.page.create({
        data: {
          title: name.trim(),
          slug: '__main__',
          domainId: newDomain.id,
          contentType: 'section_based',
          parentId: null
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Domain created successfully',
      domain: {
        id: newDomain.id,
        name: newDomain.name,
        slug: newDomain.slug,
        pageType: newDomain.pageType,
        isPublished: newDomain.isPublished,
        orderInCategory: newDomain.orderInCategory,
        targetCountries: newDomain.targetCountries,
        createdAt: newDomain.createdAt,
        category: newDomain.category,
        pageCount: newDomain._count.pages,
        previewUrl: `/domain/${newDomain.slug}`
      }
    });

  } catch (error) {
    console.error('Error creating domain:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to create domain' 
      },
      { status: 500 }
    );
  }
}

/**
 * Validate domain data for creation/updates
 */
function validateDomainData(data: any): string | null {
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
 * Validate and process targetCountries - returns valid array or default
 */
function validateAndProcessTargetCountries(targetCountries: any): string[] {
  // Default to ["ALL"] if not provided
  if (!targetCountries || !Array.isArray(targetCountries) || targetCountries.length === 0) {
    return [ALL_COUNTRIES];
  }

  const validCountries = [ALL_COUNTRIES, ...SUPPORTED_COUNTRIES];
  
  // Filter to only valid country codes
  const validatedCountries = targetCountries.filter(
    (c: any) => typeof c === 'string' && validCountries.includes(c)
  );

  // Return default if no valid countries after filtering
  return validatedCountries.length > 0 ? validatedCountries : [ALL_COUNTRIES];
}
