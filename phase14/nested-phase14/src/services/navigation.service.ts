/**
 * Navigation Service
 * 
 * Combines domain, page, and category services to provide
 * all navigation data in a single call.
 * 
 * This service is the key to reducing multiple API calls to one.
 */

import { cache } from 'react';
import { DomainService } from './domain.service';
import { PageService } from './page.service';
import { CategoryService } from './category.service';
import type {
  PageContextData,
  HeaderData,
  SidebarData,
  SidebarDomain,
  PageSidebarData,
  PageSidebarSection,
  BreadcrumbItem,
  CategoryFull,
} from './types';

export const NavigationService = {
  /**
   * Get all navigation data for a page in ONE call
   * 
   * This replaces 4 separate API calls:
   * - /api/header-domains
   * - /api/sidebar
   * - /api/page-sidebar
   * - /api/breadcrumb
   * 
   * @param path - The current URL path (e.g., '/domain/gdesign/ytube')
   * @param userCountry - The user's country code
   */
  getPageContext: cache(async (path: string, userCountry: string): Promise<PageContextData> => {
    // Parse the path
    const segments = path.split('/').filter(Boolean);
    const isDomainPath = segments[0] === 'domain';
    const domainSlug = isDomainPath && segments.length >= 2 ? segments[1] : null;
    const pageSegments = isDomainPath && segments.length >= 3 ? segments.slice(2) : [];

    // Fetch all base data in parallel
    const [domains, categories] = await Promise.all([
      DomainService.getAllForNavigation(userCountry),
      CategoryService.getActive(),
    ]);

    // Build header data
    const header = buildHeaderData(domains, categories);

    // Build sidebar data
    const sidebar = buildSidebarData(domains, categories);

    // Build page sidebar data (if on a specific page)
    let pageSidebar: PageSidebarData | null = null;
    if (domainSlug && pageSegments.length > 0) {
      const domain = domains.find(d => d.slug === domainSlug);
      if (domain) {
        pageSidebar = await buildPageSidebarData(domain, pageSegments[0], userCountry);
      }
    } else if (domainSlug) {
      const domain = domains.find(d => d.slug === domainSlug);
      if (domain && domain.pageType === 'direct') {
        pageSidebar = await buildPageSidebarData(domain, null, userCountry);
      }
    }

    // Build breadcrumb data
    const breadcrumb = await buildBreadcrumbData(segments, userCountry);

    // Get current page info if applicable
    let currentPage;
    if (domainSlug && pageSegments.length > 0) {
      const domain = domains.find(d => d.slug === domainSlug);
      if (domain) {
        const page = await PageService.getByPath(
          domain.id,
          pageSegments,
          domain.pageType as 'direct' | 'hierarchical',
          userCountry
        );
        if (page) {
          currentPage = {
            id: page.id,
            title: page.title,
            contentType: page.contentType,
          };
        }
      }
    }

    return {
      header,
      sidebar,
      pageSidebar,
      breadcrumb,
      currentPage,
    };
  }),

  /**
   * Get header data only
   */
  getHeaderData: cache(async (userCountry: string): Promise<HeaderData> => {
    const [domains, categories] = await Promise.all([
      DomainService.getAll(userCountry),
      CategoryService.getActive(),
    ]);

    return buildHeaderData(domains, categories);
  }),

  /**
   * Get sidebar data only
   */
  getSidebarData: cache(async (userCountry: string): Promise<SidebarData> => {
    const [domains, categories] = await Promise.all([
      DomainService.getAllForNavigation(userCountry),
      CategoryService.getActive(),
    ]);

    return buildSidebarData(domains, categories);
  }),

  /**
   * Get breadcrumb data for a path
   */
  getBreadcrumbData: cache(async (path: string, userCountry: string) => {
    const segments = path.split('/').filter(Boolean);
    return buildBreadcrumbData(segments, userCountry);
  }),
};

// ============================================
// Helper Functions
// ============================================

/**
 * Build header data structure (domains grouped by category in 3 columns)
 */
function buildHeaderData(domains: any[], categories: CategoryFull[]): HeaderData {
  const columnData: HeaderData['columnData'] = { 1: [], 2: [], 3: [] };

  // Add all categories to their respective columns
  categories.forEach(category => {
    const categoryDomains = domains
      .filter(domain => domain.category?.id === category.id)
      .sort((a, b) => a.orderInCategory - b.orderInCategory);

    columnData[category.columnPosition].push({
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        icon: category.icon,
        description: category.description,
        columnPosition: category.columnPosition,
        categoryOrder: category.categoryOrder,
        isActive: category.isActive,
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
        columnPosition: 1,
        categoryOrder: 999,
        isActive: true,
      },
      domains: uncategorizedDomains.map(domain => ({
        id: domain.id,
        name: domain.name,
        slug: domain.slug,
        url: `/domain/${domain.slug}`,
      })),
    });
  }

  return {
    columnData,
    totalDomains: domains.length,
    totalCategories: categories.length,
  };
}

/**
 * Build sidebar data structure
 */
function buildSidebarData(domains: any[], categories: CategoryFull[]): SidebarData {
  const organizedDomains: SidebarDomain[] = [];

  // Add domains organized by category
  categories.forEach(category => {
    const categoryDomains = domains
      .filter(domain => domain.category?.id === category.id)
      .sort((a, b) => a.orderInCategory - b.orderInCategory);

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
        columnPosition: category.columnPosition,
      });
    });
  });

  // Add uncategorized domains
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
      categoryOrder: 999,
      columnPosition: 999,
    });
  });

  return {
    domains: organizedDomains,
    categories,
  };
}

/**
 * Build root-level pages for sidebar
 */
function buildRootPages(pages: any[], domain: any) {
  const rootPages: any[] = [];

  // For hierarchical domains, show only root-level pages
  if (domain.pageType === 'hierarchical') {
    pages.forEach(page => {
      if (!page.parentId) {
        rootPages.push({
          id: page.id,
          title: page.title,
          slug: page.slug,
          contentType: page.contentType,
          parentId: page.parentId,
          order: page.order,
          url: `/domain/${domain.slug}/${page.slug}`,
        });
      }
    });
  }

  return rootPages;
}

/**
 * Build page sidebar data
 */
async function buildPageSidebarData(
  domain: any,
  pageSlug: string | null,
  userCountry: string
): Promise<PageSidebarData | null> {
  const pages = await PageService.getWithSections(domain.id, userCountry);

  if (domain.pageType === 'direct') {
    // For direct domains, find the main page with sections
    const mainPage = pages.find(page =>
      page.sections && Array.isArray(page.sections) && page.sections.length > 0
    );

    if (!mainPage) {
      // Fallback: return all pages as a single section
      return {
        type: 'direct_domain',
        domain: { name: domain.name, slug: domain.slug },
        sections: [{
          title: 'All Pages',
          column: 1,
          order: 1,
          pages: pages
            .filter(p => p.slug !== '__main__')
            .map(page => ({
              id: page.id,
              title: page.title,
              slug: page.slug,
              contentType: page.contentType,
              parentId: page.parentId,
              order: page.order || 0,
              url: `/domain/${domain.slug}/${page.slug}`,
              hasChildren: false,
              children: [],
            })),
        }],
      };
    }

    // Organize pages by sections
    const sections = organizePagesIntoSections(
      mainPage.sections as any[],
      pages,
      domain
    );

    return {
      type: 'direct_domain',
      domain: { name: domain.name, slug: domain.slug },
      sections,
    };
  } else {
    // For hierarchical domains with a specific page
    if (!pageSlug) return null;

    const page = pages.find(p => p.slug === pageSlug && !p.parentId);
    if (!page) return null;

    const childPages = pages.filter(p => p.parentId === page.id);
    const sections = organizePagesIntoSections(
      page.sections as any[] || [],
      childPages,
      domain,
      page
    );

    return {
      type: 'hierarchical_page',
      domain: { name: domain.name, slug: domain.slug },
      page: { name: page.title, slug: page.slug },
      sections,
    };
  }
}

/**
 * Organize pages into sections based on configuration
 */
function organizePagesIntoSections(
  sectionsConfig: any[],
  allPages: any[],
  domain: any,
  parentPage?: any
): PageSidebarSection[] {
  const baseUrl = parentPage
    ? `/domain/${domain.slug}/${parentPage.slug}`
    : `/domain/${domain.slug}`;

  if (!sectionsConfig || sectionsConfig.length === 0) {
    // Default section with all pages
    return [{
      title: 'Pages',
      column: 1,
      order: 1,
      pages: allPages
        .filter(p => p.slug !== '__main__')
        .map(page => ({
          id: page.id,
          title: page.title,
          slug: page.slug,
          contentType: page.contentType,
          parentId: page.parentId,
          order: page.order || 0,
          url: `${baseUrl}/${page.slug}`,
          hasChildren: false,
          children: [],
        })),
    }];
  }

  return sectionsConfig.map(section => ({
    title: section.title,
    column: section.column,
    order: section.order,
    pages: section.pageIds
      .map((pageId: string) => allPages.find(page => page.id === pageId))
      .filter(Boolean)
      .map((page: any) => ({
        id: page.id,
        title: page.title,
        slug: page.slug,
        contentType: page.contentType,
        parentId: page.parentId,
        order: page.order || 0,
        url: `${baseUrl}/${page.slug}`,
        hasChildren: page.contentType === 'subcategory_list',
        children: allPages
          .filter(child => child.parentId === page.id)
          .map(child => ({
            id: child.id,
            title: child.title,
            slug: child.slug,
            contentType: child.contentType,
            parentId: child.parentId,
            order: child.order || 0,
            url: `${baseUrl}/${page.slug}/${child.slug}`,
            hasChildren: false,
            children: [],
          })),
      })),
  }));
}

/**
 * Build breadcrumb data - OPTIMIZED (no N+1)
 */
async function buildBreadcrumbData(
  segments: string[],
  userCountry: string
): Promise<{ items: BreadcrumbItem[] }> {
  const items: BreadcrumbItem[] = [];

  // Always start with Domains
  if (segments[0] === 'domain') {
    items.push({
      label: 'Domains',
      url: '/domain',
      type: 'root',
    });
  }

  if (segments.length < 2) {
    return { items };
  }

  const domainSlug = segments[1];
  const domain = await DomainService.getBySlug(domainSlug);

  if (domain) {
    items.push({
      label: domain.name,
      url: `/domain/${domain.slug}`,
      type: 'domain',
    });

    // If we have page segments, fetch all pages in path with SINGLE query
    if (segments.length >= 3) {
      const pageSegments = segments.slice(2);
      
      // OPTIMIZED: Single query for all pages
      const page = await PageService.getByPath(
        domain.id,
        pageSegments,
        domain.pageType as 'direct' | 'hierarchical',
        userCountry
      );

      // Build breadcrumb path
      let currentPath = `/domain/${domain.slug}`;
      
      // We need to fetch each page's title for the breadcrumb
      // But we do it efficiently by getting all at once
      const { prisma } = await import('@/lib/prisma');
      const allPagesInPath = await prisma.page.findMany({
        where: {
          domainId: domain.id,
          slug: { in: pageSegments },
        },
        select: {
          id: true,
          title: true,
          slug: true,
          contentType: true,
          parentId: true,
        },
      });

      // Build the breadcrumb path by matching slugs
      for (const slug of pageSegments) {
        currentPath += `/${slug}`;
        const pageData = allPagesInPath.find(p => p.slug === slug);
        
        items.push({
          label: pageData?.title || formatSlugToTitle(slug),
          url: currentPath,
          type: 'page',
          contentType: pageData?.contentType,
        });
      }
    }
  }

  return { items };
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

