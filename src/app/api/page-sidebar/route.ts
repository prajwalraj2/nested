// ============================================
// ⚠️ DEPRECATED - This API is replaced by /api/page-context
// ============================================
// This file is kept for reference during migration.
// The functionality has been moved to NavigationService.getPageContext()
// and is now part of the unified /api/page-context endpoint.
//
// Components should use:
//   import { usePageSidebarDataFromContext } from '@/contexts/PageContextProvider'
// Instead of:
//   import { usePageSidebarData } from '@/hooks/usePageSidebarData'
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCountryFromRequest, buildCountryFilter, isContentVisibleToUser } from '@/lib/server-country';

/**
 * @deprecated Use /api/page-context instead
 * 
 * Page Sidebar Data API Route
 * 
 * GET /api/page-sidebar?domainSlug=gdesign - Fetch pages for direct domain
 * GET /api/page-sidebar?domainSlug=webdev&pageSlug=withcode - Fetch pages for hierarchical page
 * 
 * Returns structured data for page sidebar:
 * - Sections with their pages (filtered by user's country)
 * - Page hierarchy for subcategory_list pages
 * - Proper URL generation for navigation
 */

export async function GET(request: NextRequest) {
  try {
    // Get user's country from cookie
    const userCountry = getUserCountryFromRequest(request);
    
    const { searchParams } = new URL(request.url);
    const domainSlug = searchParams.get('domainSlug');
    const pageSlug = searchParams.get('pageSlug');

    if (!domainSlug) {
      return NextResponse.json(
        { success: false, message: 'domainSlug is required' },
        { status: 400 }
      );
    }

    // First, find the domain and check if it's visible to the user
    const domain = await prisma.domain.findUnique({
      where: { slug: domainSlug },
      select: {
        id: true,
        name: true,
        slug: true,
        pageType: true,
        isPublished: true,
        targetCountries: true
      }
    });

    if (!domain || !domain.isPublished) {
      return NextResponse.json(
        { success: false, message: 'Domain not found or not published' },
        { status: 404 }
      );
    }

    // Check if domain is visible to user's country
    if (!isContentVisibleToUser(domain.targetCountries, userCountry)) {
      return NextResponse.json(
        { success: false, message: 'Domain not available in your region' },
        { status: 404 }
      );
    }

    let sidebarData;

    if (pageSlug) {
      // Check domain type first to determine the correct approach
      if (domain.pageType === 'hierarchical') {
        // Hierarchical domain - try to find the specific page
        sidebarData = await getHierarchicalPageSidebar(domainSlug, pageSlug, userCountry);
      } else {
        // Direct domain - always show all domain pages regardless of current page
        sidebarData = await getDirectDomainSidebar(domainSlug, userCountry);
      }
    } else {
      // No page slug - always show domain's sidebar data
      sidebarData = await getDirectDomainSidebar(domainSlug, userCountry);
    }

    if (!sidebarData) {
      return NextResponse.json(
        { success: false, message: 'Page or domain not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      ...sidebarData
    });

  } catch (error) {
    // console.error('Error fetching page sidebar data:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch page sidebar data' 
      },
      { status: 500 }
    );
  }
}

/**
 * Get sidebar data for direct domain pages
 * Shows all pages of the domain organized by sections (filtered by user's country)
 */
async function getDirectDomainSidebar(domainSlug: string, userCountry: string) {
  const domain = await prisma.domain.findUnique({
    where: { slug: domainSlug },
    include: {
      pages: {
        where: buildCountryFilter(userCountry),
        select: {
          id: true,
          title: true,
          slug: true,
          contentType: true,
          parentId: true,
          order: true,
          sections: true, // JSON field with section configuration
          targetCountries: true
        },
        orderBy: [
          { order: 'asc' },
          { title: 'asc' }
        ]
      }
    }
  });

  if (!domain) return null;

  // console.log(`[DEBUG] Domain found: ${domain.name}, pages count: ${domain.pages.length}`);
  // console.log(`[DEBUG] Pages:`, domain.pages.map(p => ({ title: p.title, slug: p.slug, contentType: p.contentType, sections: p.sections })));

  // For direct domains, we need to find the main page that has sections
  // Usually this would be the domain's main page or a section_based page
  const mainPage = domain.pages.find(page => 
    page.sections && Array.isArray(page.sections) && page.sections.length > 0
  );

  // console.log(`[DEBUG] Main page with sections:`, mainPage ? mainPage.title : 'None found');

  if (!mainPage) {
    // If no sections defined, return all pages as a single section
    // console.log(`[DEBUG] Creating fallback section with ${domain.pages.length} pages`);
    const fallbackData = {
      type: 'direct_domain' as const,
      domain: {
        name: domain.name,
        slug: domain.slug
      },
      sections: [{
        title: 'All Pages',
        column: 1,
        order: 1,
        pages: domain.pages.map(page => ({
          ...page,
          url: `/domain/${domain.slug}/${page.slug}`,
          hasChildren: false,
          children: []
        }))
      }]
    };
    // console.log(`[DEBUG] Fallback data:`, JSON.stringify(fallbackData, null, 2));
    return fallbackData;
  }

  // Organize pages by sections
  const sections = organizePagesIntoSections(mainPage.sections as any[], domain.pages, domain);

  return {
    type: 'direct_domain',
    domain: {
      name: domain.name,
      slug: domain.slug
    },
    sections: sections
  };
}

/**
 * Get sidebar data for hierarchical domain pages
 * Shows all pages of the specific page organized by sections (filtered by user's country)
 */
async function getHierarchicalPageSidebar(domainSlug: string, pageSlug: string, userCountry: string) {
  const page = await prisma.page.findFirst({
    where: {
      slug: pageSlug,
      domain: { slug: domainSlug },
      ...buildCountryFilter(userCountry)
    },
    include: {
      domain: {
        select: {
          id: true,
          name: true,
          slug: true,
          pageType: true
        }
      }
    }
  });

  if (!page) return null;

  // Get all child pages for building hierarchy (filtered by user's country)
  const allChildPages = await prisma.page.findMany({
    where: {
      domain: { slug: domainSlug },
      parentId: page.id,
      ...buildCountryFilter(userCountry)
    },
    select: {
      id: true,
      title: true,
      slug: true,
      contentType: true,
      parentId: true,
      order: true,
      targetCountries: true
    },
    orderBy: [
      { order: 'asc' },
      { title: 'asc' }
    ]
  });

  // Get deeper nested children (filtered by user's country)
  const deeperChildren = await prisma.page.findMany({
    where: {
      domain: { slug: domainSlug },
      parentId: { in: allChildPages.map(child => child.id) },
      ...buildCountryFilter(userCountry)
    },
    select: {
      id: true,
      title: true,
      slug: true,
      contentType: true,
      parentId: true,
      order: true,
      targetCountries: true
    },
    orderBy: [
      { order: 'asc' },
      { title: 'asc' }
    ]
  });

  // Combine all pages
  const allPages = [...allChildPages, ...deeperChildren];

  // Organize pages by sections (from the page's sections field)
  const sections = organizePagesIntoSections(page.sections as any[] || [], allPages, page.domain, page);

  return {
    type: 'hierarchical_page',
    domain: {
      name: page.domain.name,
      slug: page.domain.slug
    },
    page: {
      name: page.title,
      slug: page.slug
    },
    sections: sections
  };
}

/**
 * Organize pages into sections based on the sections configuration
 */
function organizePagesIntoSections(
  sectionsConfig: any[], 
  allPages: any[], 
  domain: any, 
  parentPage?: any
) {
  if (!sectionsConfig || sectionsConfig.length === 0) {
    // If no sections defined, create a default section with all pages
    return [{
      title: 'Pages',
      column: 1,
      order: 1,
      pages: allPages.map(page => buildPageWithChildren(page, allPages, domain, parentPage))
    }];
  }

  return sectionsConfig.map(section => ({
    title: section.title,
    column: section.column,
    order: section.order,
    pages: section.pageIds
      .map((pageId: string) => allPages.find(page => page.id === pageId))
      .filter(Boolean)
      .map((page: any) => buildPageWithChildren(page, allPages, domain, parentPage))
  }));
}

/**
 * Build page object with children for subcategory_list pages
 */
function buildPageWithChildren(page: any, allPages: any[], domain: any, parentPage?: any) {
  const baseUrl = parentPage 
    ? `/domain/${domain.slug}/${parentPage.slug}`
    : `/domain/${domain.slug}`;
  
  const pageUrl = `${baseUrl}/${page.slug}`;
  
  // Find children for this page
  const children = allPages
    .filter(child => child.parentId === page.id)
    .map(child => ({
      ...child,
      url: `${pageUrl}/${child.slug}`,
      hasChildren: false,
      children: []
    }));

  return {
    ...page,
    url: pageUrl,
    hasChildren: page.contentType === 'subcategory_list' && children.length > 0,
    children: children
  };
}
