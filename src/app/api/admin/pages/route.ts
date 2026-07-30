import { NextRequest, NextResponse } from 'next/server';
// Shared admin guard — replaces the old inline `auth()` check.
// See src/lib/api-auth.ts for the 401-vs-403 and isActive reasoning.
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { invalidatePages } from '@/lib/cache-invalidation';
import { SUPPORTED_COUNTRIES, ALL_COUNTRIES } from '@/lib/countries';
// Finding #22.4 — one shared parent-chain traversal, replacing the local copy that had
// no cycle guard. See src/lib/page-path.ts.
import { buildPageUrl, toPageMap, type PagePathNode } from '@/lib/page-path';

/**
 * Pages API Route - Main CRUD operations
 * 
 * Handles page management with correct parent logic:
 * 
 * DIRECT DOMAINS:
 * - Pages created with __main__ as parent automatically
 * - URLs: /domain/slug/page-slug
 * 
 * HIERARCHICAL DOMAINS:
 * - Pages can be root level or nested under other pages
 * - URLs: /domain/slug/page-slug or /domain/slug/parent/page-slug
 * 
 * Key Features:
 * - Domain-based filtering
 * - Hierarchical parent-child relationships
 * - Proper URL generation
 * - Slug uniqueness validation within domain/parent scope
 */

/**
 * GET /api/admin/pages
 * Fetch pages for a specific domain with hierarchy information
 */
export async function GET(request: NextRequest) {
  try {
    // Admin-only. See src/lib/api-auth.ts for why this is duplicated in the middleware.
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(request.url);
    const domainId = searchParams.get('domain');
    
    if (!domainId) {
      return NextResponse.json(
        { success: false, message: 'Domain ID is required' },
        { status: 400 }
      );
    }

    // Verify domain exists
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
      select: { id: true, name: true, slug: true, pageType: true }
    });

    if (!domain) {
      return NextResponse.json(
        { success: false, message: 'Domain not found' },
        { status: 404 }
      );
    }

    // Fetch all pages for the domain
    const pages = await prisma.page.findMany({
      where: { domainId },
      select: {
        id: true,
        title: true,
        slug: true,
        contentType: true,
        parentId: true,
        domainId: true,
        targetCountries: true,
        createdAt: true,
        order: true
      },
      orderBy: [
        { order: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    // Transform pages with hierarchy information
    const transformedPages = pages.map(page => ({
      id: page.id,
      title: page.title,
      slug: page.slug,
      contentType: page.contentType,
      parentId: page.parentId,
      domainId: page.domainId,
      targetCountries: page.targetCountries,
      createdAt: page.createdAt,
      order: page.order,
      
      // Calculate additional info
      hasChildren: pages.some(p => p.parentId === page.id),
      childrenCount: pages.filter(p => p.parentId === page.id).length,
      
      // Generate preview URL
      previewUrl: generatePagePreviewUrl(page, domain, pages)
    }));

    return NextResponse.json({
      success: true,
      pages: transformedPages,
      domain,
      total: transformedPages.length
    });

  } catch (error) {
    console.error('Error fetching pages:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch pages' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/pages
 * Create a new page with proper parent logic
 */
export async function POST(request: NextRequest) {
  try {
    // Admin-only. See src/lib/api-auth.ts for why this is duplicated in the middleware.
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const body = await request.json();
    
    // Validate required fields
    const validationError = validatePageData(body);
    if (validationError) {
      return NextResponse.json(
        { success: false, message: validationError },
        { status: 400 }
      );
    }

    const { title, slug, contentType, domainId, parentId, targetCountries } = body;

    // Verify domain exists and get its info
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
      select: { id: true, name: true, slug: true, pageType: true }
    });

    if (!domain) {
      return NextResponse.json(
        { success: false, message: 'Domain not found' },
        { status: 404 }
      );
    }

    // Handle parent logic based on domain type
    let finalParentId = parentId;

    if (domain.pageType === 'direct' && !parentId) {
      // For direct domains, if no parent specified, use __main__ page
      const mainPage = await prisma.page.findFirst({
        where: { 
          domainId,
          slug: '__main__'
        },
        select: { id: true }
      });

      if (mainPage) {
        finalParentId = mainPage.id;
      } else {
        // If __main__ doesn't exist, create it first
        const createdMainPage = await prisma.page.create({
          data: {
            title: domain.name,
            slug: '__main__',
            contentType: 'section_based',
            domainId,
            parentId: null,
            order: 0
          }
        });
        finalParentId = createdMainPage.id;
      }
    }

    // Verify parent exists (if specified)
    if (finalParentId) {
      const parent = await prisma.page.findUnique({
        where: { id: finalParentId }
      });

      if (!parent || parent.domainId !== domainId) {
        return NextResponse.json(
          { success: false, message: 'Invalid parent page' },
          { status: 400 }
        );
      }
    }

    // Check for slug conflicts within same domain and parent
    const existingPage = await prisma.page.findFirst({
      where: {
        domainId,
        slug: slug.toLowerCase(),
        parentId: finalParentId
      }
    });

    if (existingPage) {
      const context = finalParentId ? 'under the same parent' : 'at the root level';
      return NextResponse.json(
        { success: false, message: `A page with slug "${slug}" already exists ${context}` },
        { status: 409 }
      );
    }

    // Get next order value
    const maxOrder = await prisma.page.findFirst({
      where: { domainId, parentId: finalParentId },
      select: { order: true },
      orderBy: { order: 'desc' }
    });

    // Process targetCountries - default to ["ALL"] if not provided
    const validTargetCountries = validateAndProcessTargetCountries(targetCountries);

    // Create the page
    const newPage = await prisma.page.create({
      data: {
        title: title.trim(),
        slug: slug.trim().toLowerCase(),
        contentType,
        domainId,
        parentId: finalParentId,
        order: (maxOrder?.order || 0) + 1,
        targetCountries: validTargetCountries
      },
      select: {
        id: true,
        title: true,
        slug: true,
        contentType: true,
        parentId: true,
        domainId: true,
        targetCountries: true,
        createdAt: true,
        order: true
      }
    });

    // Calculate preview URL
    const allPages = await prisma.page.findMany({
      where: { domainId },
      select: { id: true, slug: true, parentId: true }
    });

    // The new page has to show up in the sidebar and in its parent's section
    // layout. invalidatePages() also clears DOMAINS, because the navigation payload
    // embeds page lists inside each domain object.
    invalidatePages();

    return NextResponse.json({
      success: true,
      message: 'Page created successfully',
      page: {
        ...newPage,
        previewUrl: generatePagePreviewUrl(newPage, domain, allPages),
        hasChildren: false,
        childrenCount: 0
      }
    });

  } catch (error) {
    console.error('Error creating page:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create page' },
      { status: 500 }
    );
  }
}

/**
 * Validate page data for creation
 */
function validatePageData(data: any): string | null {
  if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
    return 'Page title is required';
  }

  if (!data.slug || typeof data.slug !== 'string' || !data.slug.trim()) {
    return 'Page slug is required';
  }

  if (!data.domainId || typeof data.domainId !== 'string') {
    return 'Domain ID is required';
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

/**
 * Generate preview URL for a page based on domain type and hierarchy
 */
/**
 * Build a page's public preview URL.
 *
 * ⚠️ THIS WAS A 30-LINE LOCAL COPY, DUPLICATED BYTE-FOR-BYTE IN
 * `api/admin/pages/[id]/route.ts`, AND IT HAD TWO DEFECTS (finding #22.4):
 *
 *   1. **No cycle guard.** It recursed on `parentId` with nothing tracking visited
 *      nodes. `parentId` is an unconstrained self-relation, so one corrupt row would
 *      have overflowed the stack and returned a 500 with no useful message.
 *   2. **O(n²).** It called `allPages.find(...)` inside the recursion. The shared
 *      helper uses a `Map`, so lookups are O(1).
 *
 * Both copies are now this wrapper around `src/lib/page-path.ts`. The behaviour is
 * otherwise identical, including returning the domain root for `__main__`.
 *
 * `'#'` is kept as the no-domain / unreachable fallback so the response shape does not
 * change for existing clients — but note that a `'#'` href renders as a link that does
 * nothing, which is why the UI should prefer to disable the control. See 22.4.
 */
function generatePagePreviewUrl(
  page: PagePathNode,
  domain: { slug: string } | null | undefined,
  allPages: PagePathNode[]
): string {
  if (!domain) return '#';
  return buildPageUrl(page, domain.slug, toPageMap(allPages)) ?? '#';
}
