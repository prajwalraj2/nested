// ============================================
// ⚠️ DEPRECATED - This API is replaced by /api/page-context
// ============================================
// This file is kept for reference during migration.
// The functionality has been moved to NavigationService.getHeaderData()
// and is now part of the unified /api/page-context endpoint.
//
// Components should use:
//   import { useHeaderDataFromContext } from '@/contexts/PageContextProvider'
// Instead of:
//   import { useHeaderData } from '@/hooks/useHeaderData'
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCountryFromRequest, buildCountryFilter } from '@/lib/server-country';

/**
 * @deprecated Use /api/page-context instead
 * 
 * Header Domains API Route
 * 
 * GET /api/header-domains
 * 
 * Returns organized domain data for the header dropdown:
 * - Domains grouped by categories (filtered by user's country)
 * - 3-column layout structure
 * - Optimized for navigation menu
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
      },
      orderBy: [
        { category: { columnPosition: 'asc' } },
        { category: { categoryOrder: 'asc' } },
        { orderInCategory: 'asc' },
      ],
    });

    // Fetch categories to show empty ones
    const categories = await prisma.domainCategory.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        { columnPosition: 'asc' },
        { categoryOrder: 'asc' },
      ],
    });

    // Organize domains by category and column (same logic as domain page)
    const columnData: { [key: number]: any[] } = { 1: [], 2: [], 3: [] };
    
    // Add all categories to their respective columns
    categories.forEach(category => {
      const categoryDomains = domains.filter(domain => 
        domain.category?.id === category.id
      ).sort((a, b) => a.orderInCategory - b.orderInCategory);
      
      columnData[category.columnPosition].push({
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          icon: category.icon,
          description: category.description,
        },
        domains: categoryDomains.map(domain => ({
          id: domain.id,
          name: domain.name,
          slug: domain.slug,
          url: `/domain/${domain.slug}`,
        })),
      });
    });

    // Add uncategorized domains to column 1
    const uncategorizedDomains = domains.filter(domain => !domain.category);
    if (uncategorizedDomains.length > 0) {
      columnData[1].push({
        category: {
          id: 'uncategorized',
          name: 'Other Domains',
          slug: 'other',
          icon: '📂',
          description: 'Miscellaneous domains',
        },
        domains: uncategorizedDomains.map(domain => ({
          id: domain.id,
          name: domain.name,
          slug: domain.slug,
          url: `/domain/${domain.slug}`,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      columnData,
      totalDomains: domains.length,
      totalCategories: categories.length,
    });

  } catch (error) {
    console.error('Error fetching header domains:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch header domains data' 
      },
      { status: 500 }
    );
  }
}
