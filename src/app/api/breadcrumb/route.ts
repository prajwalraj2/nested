// ============================================
// ⚠️ DEPRECATED - This API is replaced by /api/page-context
// ============================================
// This file is kept for reference during migration.
// The functionality has been moved to NavigationService.getBreadcrumbData()
// and is now part of the unified /api/page-context endpoint.
//
// NOTE: This API had an N+1 query problem (loop of Prisma calls).
// The new NavigationService uses optimized batch queries instead.
//
// Components should use:
//   import { useBreadcrumbDataFromContext } from '@/contexts/PageContextProvider'
// Instead of:
//   import { useBreadcrumbData } from '@/hooks/useBreadcrumbData'
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * @deprecated Use /api/page-context instead
 * 
 * Breadcrumb Data API Route
 * 
 * GET /api/breadcrumb?path=/domain/webdev/withcode/ytube
 * 
 * Returns breadcrumb data for the given path:
 * - Domain names and slugs
 * - Page names and slugs
 * - Proper URLs for navigation
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json(
        { success: false, message: 'path parameter is required' },
        { status: 400 }
      );
    }

    // Parse the path to extract segments
    const segments = path.split('/').filter(Boolean); // Split the path into segments and filter out empty segments
    
    if (segments.length === 0 || segments[0] !== 'domain') {
      return NextResponse.json(
        { success: false, message: 'Invalid path format' },
        { status: 400 }
      );
    }

    const breadcrumbs = [];

    // Always start with "Domains"
    breadcrumbs.push({
      label: 'Domains',
      url: '/domain',
      type: 'root'
    });

    // If we have a domain slug
    if (segments.length >= 2) {
      const domainSlug = segments[1];
      
      // Fetch domain data
      const domain = await prisma.domain.findUnique({
        where: { slug: domainSlug },
        select: {
          id: true,
          name: true,
          slug: true,
          pageType: true
        }
      });

      if (domain) {
        breadcrumbs.push({
          label: domain.name,
          url: `/domain/${domain.slug}`,
          type: 'domain'
        });

        // If we have page segments
        if (segments.length >= 3) {
          const pageSegments = segments.slice(2); // Everything after domain
          
          // For hierarchical domains, we need to build the page hierarchy
          if (domain.pageType === 'hierarchical') {
            await buildHierarchicalBreadcrumbs(breadcrumbs, domain, pageSegments);
          } else {
            // For direct domains, just add the pages in sequence
            await buildDirectBreadcrumbs(breadcrumbs, domain, pageSegments);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      breadcrumbs
    });

  } catch (error) {
    console.error('Error fetching breadcrumb data:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch breadcrumb data' 
      },
      { status: 500 }
    );
  }
}

/**
 * Build breadcrumbs for hierarchical domains
 */
async function buildHierarchicalBreadcrumbs(breadcrumbs: any[], domain: any, pageSegments: string[]) {
  let currentPath = `/domain/${domain.slug}`;
  
  for (let i = 0; i < pageSegments.length; i++) {
    const pageSlug = pageSegments[i];
    currentPath += `/${pageSlug}`;
    
    // Find the page by slug within this domain
    const page = await prisma.page.findFirst({
      where: {
        slug: pageSlug,
        domainId: domain.id
      },
      select: {
        id: true,
        title: true,
        slug: true,
        contentType: true
      }
    });

    if (page) {
      breadcrumbs.push({
        label: page.title,
        url: currentPath,
        type: 'page',
        contentType: page.contentType
      });
    } else {
      // Fallback to slug if page not found
      breadcrumbs.push({
        label: formatSlugToTitle(pageSlug),
        url: currentPath,
        type: 'page',
        contentType: 'unknown'
      });
    }
  }
}

/**
 * Build breadcrumbs for direct domains
 */
async function buildDirectBreadcrumbs(breadcrumbs: any[], domain: any, pageSegments: string[]) {
  let currentPath = `/domain/${domain.slug}`;
  
  for (let i = 0; i < pageSegments.length; i++) {
    const pageSlug = pageSegments[i];
    currentPath += `/${pageSlug}`;
    
    // Find the page by slug within this domain
    const page = await prisma.page.findFirst({
      where: {
        slug: pageSlug,
        domainId: domain.id
      },
      select: {
        id: true,
        title: true,
        slug: true,
        contentType: true
      }
    });

    if (page) {
      breadcrumbs.push({
        label: page.title,
        url: currentPath,
        type: 'page',
        contentType: page.contentType
      });
    } else {
      // Fallback to formatted slug if page not found
      breadcrumbs.push({
        label: formatSlugToTitle(pageSlug),
        url: currentPath,
        type: 'page',
        contentType: 'unknown'
      });
    }
  }
}

/**
 * Convert slug to readable title as fallback
 */
function formatSlugToTitle(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
