// ============================================
// ⚠️ DEPRECATED - This API is replaced by /api/page-context
// ============================================
// This file is kept for reference during migration.
// The functionality has been moved to NavigationService.getSidebarData()
// and is now part of the unified /api/page-context endpoint.
//
// Components should use:
//   import { useSidebarDataFromContext } from '@/contexts/PageContextProvider'
// Instead of:
//   import { useSidebarData } from '@/hooks/useSidebarData'
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCountryFromRequest, buildCountryFilter, isContentVisibleToUser } from '@/lib/server-country';

/**
 * @deprecated Use /api/page-context instead
 * 
 * Sidebar Data API Route
 * 
 * GET /api/sidebar - Fetch all published domains with their page hierarchy
 * 
 * Returns a structured tree of:
 * - Published domains only (filtered by user's country)
 * - All pages within each domain (filtered by user's country)
 * - Proper URL generation for navigation
 * 
 * Used by the sidebar to display navigation structure
 */

export async function GET(request: NextRequest) {
  try {
    // Get user's country from cookie
    const userCountry = getUserCountryFromRequest(request);
    
    // Fetch all published domains filtered by user's country
    const domains = await prisma.domain.findMany({
      where: {
        isPublished: true,
        ...buildCountryFilter(userCountry)
      },
      include: {
        category: true,
        pages: {
          where: buildCountryFilter(userCountry),
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
        }
      },
      orderBy: [
        { category: { columnPosition: 'asc' } },
        { category: { categoryOrder: 'asc' } },
        { orderInCategory: 'asc' },
      ]
    });

    // Also fetch categories to maintain structure
    const categories = await prisma.domainCategory.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        { columnPosition: 'asc' },
        { categoryOrder: 'asc' },
      ],
    });

    // Organize domains by category (same logic as domain page)
    const organizedDomains: any[] = [];
    
    // First, add all categories with their domains
    categories.forEach(category => {
      const categoryDomains = domains.filter(domain => 
        domain.category?.id === category.id
      ).sort((a, b) => a.orderInCategory - b.orderInCategory);
      
      if (categoryDomains.length > 0) {
        // Add domains from this category
        categoryDomains.forEach(domain => {
          organizedDomains.push({
            id: domain.id,
            name: domain.name,
            slug: domain.slug,
            pageType: domain.pageType,
            url: `/domain/${domain.slug}`,
            pages: buildRootPages(domain.pages, domain),
            categoryId: category.id,
            categoryOrder: category.categoryOrder,
            columnPosition: category.columnPosition
          });
        });
      }
    });

    // Add uncategorized domains at the end
    const uncategorizedDomains = domains.filter(domain => !domain.category);
    uncategorizedDomains.forEach(domain => {
      organizedDomains.push({
        id: domain.id,
        name: domain.name,
        slug: domain.slug,
        pageType: domain.pageType,
        url: `/domain/${domain.slug}`,
        pages: buildRootPages(domain.pages, domain),
        categoryId: null,
        categoryOrder: 999, // Put uncategorized at the end
        columnPosition: 999
      });
    });

    return NextResponse.json({
      success: true,
      domains: organizedDomains,
      categories: categories // Include categories for spacing logic
    });

  } catch (error) {
    console.error('Error fetching sidebar data:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch sidebar data' 
      },
      { status: 500 }
    );
  }
}

/**
 * Build root-level pages only (no deep nesting for sidebar)
 */
function buildRootPages(pages: any[], domain: any) {
  const rootPages: any[] = [];

  // For hierarchical domains, show only root-level pages
  if (domain.pageType === 'hierarchical') {
    pages.forEach(page => {
      // Root pages have no parent
      if (!page.parentId) {
        rootPages.push({
          ...page,
          url: generatePageUrl(domain, page, pages)
        });
      }
    });
  }
  
  // For direct domains, don't show any pages in sidebar (they navigate directly to domain)
  // This keeps the sidebar clean and simple

  return rootPages;
}

/**
 * Generate URL for a page - simple format for root-level pages
 */
function generatePageUrl(domain: any, page: any, allPages: any[]): string {
  // For root-level pages, use simple format: /domain/domainslug/pageslug
  return `/domain/${domain.slug}/${page.slug}`;
}
