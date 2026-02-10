'use client';

/**
 * Unified Page Context Hook
 * 
 * Single hook that provides ALL navigation data:
 * - Header data (for navigation dropdown)
 * - Sidebar data (for domain navigation)
 * - Page sidebar data (for page navigation)
 * - Breadcrumb data (for navigation trail)
 * 
 * This REPLACES 4 separate hooks:
 * - useHeaderData
 * - useSidebarData
 * - usePageSidebarData
 * - useBreadcrumbData
 * 
 * SMART FETCHING:
 * - Static data (header, sidebar) → Fetched ONCE on mount
 * - Page sidebar → Fetched only when mode changes OR domain/parent changes
 * - Breadcrumb → Derived from URL (no fetch needed)
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';

// ============================================
// Types (consolidated from all old hooks)
// ============================================

export type HeaderDomain = {
  id: string;
  name: string;
  slug: string;
  url: string;
};

export type HeaderCategory = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
};

export type HeaderCategoryGroup = {
  category: HeaderCategory;
  domains: HeaderDomain[];
};

export type HeaderData = {
  columnData: { [key: number]: HeaderCategoryGroup[] };
  totalDomains: number;
  totalCategories: number;
};

export type SidebarPage = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  parentId: string | null;
  order: number;
  url: string;
};

export type SidebarDomain = {
  id: string;
  name: string;
  slug: string;
  pageType: string;
  url: string;
  pages: SidebarPage[];
  categoryId: string | null;
  categoryOrder: number;
  columnPosition: number;
};

export type SidebarCategory = {
  id: string;
  name: string;
  slug: string;
  columnPosition: number;
  categoryOrder: number;
  isActive: boolean;
};

export type SidebarData = {
  domains: SidebarDomain[];
  categories: SidebarCategory[];
};

export type PageSidebarSection = {
  title: string;
  column: number;
  order: number;
  pages: PageSidebarPage[];
};

export type PageSidebarPage = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  parentId: string | null;
  order: number;
  url: string;
  hasChildren: boolean;
  children: PageSidebarPage[];
};

export type PageSidebarData = {
  type: 'direct_domain' | 'hierarchical_page';
  domain: {
    name: string;
    slug: string;
  };
  page?: {
    name: string;
    slug: string;
  };
  sections: PageSidebarSection[];
};

export type BreadcrumbItem = {
  label: string;
  url: string;
  type: 'root' | 'domain' | 'page';
  contentType?: string;
};

export type BreadcrumbData = {
  items: BreadcrumbItem[];
  shouldCollapse: boolean;
  visibleItems: {
    first: BreadcrumbItem;
    collapsed: BreadcrumbItem[];
    last: BreadcrumbItem;
  } | null;
};

export type PageContextData = {
  header: HeaderData;
  sidebar: SidebarData;
  pageSidebar: PageSidebarData | null;
  breadcrumb: BreadcrumbData;
  currentPage?: {
    id: string;
    title: string;
    contentType: string;
  };
};

export type SidebarMode = 'domain' | 'page';

// ============================================
// Helper Functions
// ============================================

/**
 * Process breadcrumbs to determine collapse behavior
 */
function processBreadcrumbs(items: BreadcrumbItem[]): BreadcrumbData {
  const shouldCollapse = items.length > 3;

  if (!shouldCollapse) {
    return {
      items,
      shouldCollapse: false,
      visibleItems: null
    };
  }

  const first = items[0];
  const last = items[items.length - 1];
  const collapsed = items.slice(1, -1);

  return {
    items,
    shouldCollapse: true,
    visibleItems: { first, collapsed, last }
  };
}

/**
 * Create fallback breadcrumbs when API fails
 */
function createFallbackBreadcrumbs(pathname: string): BreadcrumbData {
  const segments = pathname.split('/').filter(Boolean);
  const items: BreadcrumbItem[] = [];

  items.push({
    label: 'Domains',
    url: '/domain',
    type: 'root'
  });

  if (segments.length >= 2) {
    const domainSlug = segments[1];
    items.push({
      label: formatSlugToTitle(domainSlug),
      url: `/domain/${domainSlug}`,
      type: 'domain'
    });

    let currentPath = `/domain/${domainSlug}`;
    for (let i = 2; i < segments.length; i++) {
      const pageSlug = segments[i];
      currentPath += `/${pageSlug}`;
      
      items.push({
        label: formatSlugToTitle(pageSlug),
        url: currentPath,
        type: 'page'
      });
    }
  }

  return processBreadcrumbs(items);
}

function formatSlugToTitle(slug: string): string {
  return slug
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================
// Helper: Extract domain and parent page from path
// Accounts for pageType (direct vs hierarchical)
// ============================================

interface PathInfo {
  domainSlug: string | null;
  segments: string[];
}

function getPathSegments(pathname: string): PathInfo {
  const segments = pathname.split('/').filter(Boolean);
  // /domain/gdesign/ytube → ['domain', 'gdesign', 'ytube']
  
  if (segments.length < 2 || segments[0] !== 'domain') {
    return { domainSlug: null, segments };
  }
  
  return { domainSlug: segments[1], segments };
}

/**
 * Determine sidebar mode based on domain's pageType
 * 
 * Direct domains:
 *   - /domain/gdesign (2 segments) → domain mode
 *   - /domain/gdesign/ytube (3+ segments) → page mode
 * 
 * Hierarchical domains:
 *   - /domain/webdev (2 segments) → domain mode
 *   - /domain/webdev/withcode (3 segments) → STILL domain mode (viewing subcategory)
 *   - /domain/webdev/withcode/ytube (4+ segments) → page mode
 */
function calculateSidebarMode(
  segments: string[],
  pageType: 'direct' | 'hierarchical' | null
): SidebarMode {
  if (segments.length < 2 || segments[0] !== 'domain') {
    return 'domain';
  }

  if (pageType === 'direct') {
    // For direct domains: page mode at 3+ segments
    return segments.length >= 3 ? 'page' : 'domain';
  } else if (pageType === 'hierarchical') {
    // For hierarchical domains: page mode at 4+ segments
    return segments.length >= 4 ? 'page' : 'domain';
  }
  
  // Default: use direct logic if pageType unknown
  return segments.length >= 3 ? 'page' : 'domain';
}

/**
 * Get the "parent context" for determining if we need to refetch page sidebar
 * 
 * Direct domains: parent = domainSlug (same domain = same pages)
 * Hierarchical domains: parent = first-level page slug (same subcategory = same pages)
 */
function getParentContext(
  segments: string[],
  pageType: 'direct' | 'hierarchical' | null
): string | null {
  if (segments.length < 2 || segments[0] !== 'domain') {
    return null;
  }

  const domainSlug = segments[1];

  if (pageType === 'direct') {
    // For direct domains: parent context is the domain itself
    return domainSlug;
  } else if (pageType === 'hierarchical') {
    // For hierarchical domains: parent context is the first-level page
    return segments.length >= 3 ? `${domainSlug}/${segments[2]}` : domainSlug;
  }
  
  return domainSlug;
}

// ============================================
// Main Hook
// ============================================

export function usePageContext() {
  const pathname = usePathname();
  
  // ============================================
  // STATIC DATA - Fetched ONCE on mount
  // ============================================
  const [staticData, setStaticData] = useState<{
    header: HeaderData;
    sidebar: SidebarData;
  } | null>(null);
  const [staticLoading, setStaticLoading] = useState(true);
  const [staticError, setStaticError] = useState<string | null>(null);
  
  // ============================================
  // DYNAMIC DATA - Fetched when needed
  // ============================================
  const [pageSidebar, setPageSidebar] = useState<PageSidebarData | null>(null);
  const [pageSidebarLoading, setPageSidebarLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState<{
    id: string;
    title: string;
    contentType: string;
  } | undefined>(undefined);

  // ============================================
  // TRACKING REFS - To detect real changes
  // ============================================
  const prevModeRef = useRef<SidebarMode>('domain');
  const prevParentContextRef = useRef<string | null>(null);
  const staticDataFetchedRef = useRef(false);

  // UI state for sidebars (preserved from old hooks)
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());

  // ============================================
  // Get current domain's pageType from cached sidebar data
  // ============================================
  
  // Memoize path segments to prevent infinite re-renders
  // (arrays are compared by reference, so we need stable references)
  const pathInfo = useMemo(() => getPathSegments(pathname), [pathname]);
  const { domainSlug, segments } = pathInfo;
  
  // Also memoize segments as a string for dependency tracking
  const segmentsKey = useMemo(() => segments.join('/'), [segments]);
  
  const currentDomainPageType = useMemo<'direct' | 'hierarchical' | null>(() => {
    if (!staticData || !domainSlug) return null;
    
    const domain = staticData.sidebar.domains.find(d => d.slug === domainSlug);
    return (domain?.pageType as 'direct' | 'hierarchical') || null;
  }, [staticData, domainSlug]);

  // ============================================
  // Derived sidebar mode - NOW accounts for pageType!
  // ============================================
  const sidebarMode = useMemo<SidebarMode>(() => {
    return calculateSidebarMode(segments, currentDomainPageType);
  }, [segments, currentDomainPageType]);

  // ============================================
  // FETCH STATIC DATA (header + sidebar) - ONCE
  // ============================================
  useEffect(() => {
    // Only fetch once
    if (staticDataFetchedRef.current) return;
    
    // Skip for non-domain paths
    if (!pathname.startsWith('/domain') && pathname !== '/') {
      setStaticLoading(false);
      return;
    }

    async function fetchStaticData() {
      setStaticLoading(true);
      setStaticError(null);

      try {
        // Fetch with a simple path to get static data
        const response = await fetch(`/api/page-context?path=/domain`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Failed to fetch static context');
        }

        setStaticData({
          header: result.header || { columnData: { 1: [], 2: [], 3: [] }, totalDomains: 0, totalCategories: 0 },
          sidebar: result.sidebar || { domains: [], categories: [] },
        });
        
        staticDataFetchedRef.current = true;
      } catch (err) {
        console.error('Error fetching static context:', err);
        setStaticError(err instanceof Error ? err.message : 'Unknown error');
        
        // Set fallback data
        setStaticData({
          header: { columnData: { 1: [], 2: [], 3: [] }, totalDomains: 0, totalCategories: 0 },
          sidebar: { domains: [], categories: [] },
        });
      } finally {
        setStaticLoading(false);
      }
    }

    fetchStaticData();
  }, []); // Empty dependency - fetch ONCE on mount

  // ============================================
  // FETCH PAGE SIDEBAR - Only when needed
  // ============================================
  useEffect(() => {
    // Wait for static data to be loaded (we need pageType info)
    if (!staticData) return;
    
    // Get current parent context based on domain type
    const currentParentContext = getParentContext(segments, currentDomainPageType);
    
    // Detect what changed
    const modeChanged = sidebarMode !== prevModeRef.current;
    const parentContextChanged = currentParentContext !== prevParentContextRef.current;
    
    // Update refs for next comparison
    prevModeRef.current = sidebarMode;
    prevParentContextRef.current = currentParentContext;

    // If in domain mode, clear page sidebar
    if (sidebarMode === 'domain') {
      if (pageSidebar !== null) {
        setPageSidebar(null);
        setCurrentPage(undefined);
      }
      return;
    }

    // If in page mode, check if we need to fetch
    if (sidebarMode === 'page') {
      // Only fetch if:
      // 1. Mode just changed to 'page' (entering page mode)
      // 2. OR parent context changed (different domain for direct, different subcategory for hierarchical)
      const needsFetch = modeChanged || parentContextChanged;
      
      if (needsFetch && domainSlug) {
        // For hierarchical domains, we need to pass the first-level page slug
        const pageSlugForApi = currentDomainPageType === 'hierarchical' && segments.length >= 3
          ? segments[2] // e.g., 'withcode' from /domain/webdev/withcode/ytube
          : null;
        
        fetchPageSidebarData(domainSlug, pageSlugForApi);
      }
    }
  }, [pathname, sidebarMode, staticData, currentDomainPageType, segmentsKey, domainSlug]);

  // ============================================
  // Page Sidebar Fetch Function
  // ============================================
  const fetchPageSidebarData = async (domainSlug: string, firstLevelPageSlug: string | null) => {
    setPageSidebarLoading(true);

    try {
      // Build API URL
      // For direct domains: /api/page-context?path=/domain/gdesign/ytube
      // For hierarchical domains: /api/page-context?path=/domain/webdev/withcode
      let apiUrl = `/api/page-context?path=/domain/${domainSlug}`;
      if (firstLevelPageSlug) {
        apiUrl += `/${firstLevelPageSlug}`;
      } else if (currentDomainPageType === 'direct' && segments.length >= 3) {
        // For direct domains, include any page slug to trigger pageSidebar
        apiUrl += `/${segments[2]}`;
      }

      const response = await fetch(apiUrl);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch page sidebar');
      }

      setPageSidebar(result.pageSidebar || null);
      setCurrentPage(result.currentPage);
    } catch (err) {
      console.error('Error fetching page sidebar:', err);
      setPageSidebar(null);
    } finally {
      setPageSidebarLoading(false);
    }
  };

  // ============================================
  // UPDATE CURRENT PAGE INFO - When switching pages within same parent
  // (For updating breadcrumb data without refetching sidebar)
  // ============================================
  useEffect(() => {
    // Only update current page info if we're in page mode, have static data, and pageSidebar
    if (sidebarMode !== 'page' || !staticData || !pageSidebar) return;
    
    // Find current page in pageSidebar sections
    const lastSlug = segments[segments.length - 1];
    
    for (const section of pageSidebar.sections) {
      for (const page of section.pages) {
        if (page.slug === lastSlug) {
          setCurrentPage({
            id: page.id,
            title: page.title,
            contentType: page.contentType,
          });
          return;
        }
        // Check children too
        for (const child of page.children || []) {
          if (child.slug === lastSlug) {
            setCurrentPage({
              id: child.id,
              title: child.title,
              contentType: child.contentType,
            });
            return;
          }
        }
      }
    }
  }, [pathname, sidebarMode, staticData, pageSidebar, segmentsKey]);

  // ============================================
  // Combined loading state
  // ============================================
  const loading = staticLoading || pageSidebarLoading;
  const error = staticError;

  // ============================================
  // Refetch function (for manual refresh)
  // ============================================
  const refetch = useCallback(async () => {
    staticDataFetchedRef.current = false;
    setStaticLoading(true);
    
    try {
      const response = await fetch(`/api/page-context?path=${encodeURIComponent(pathname)}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch page context');
      }

      setStaticData({
        header: result.header || { columnData: { 1: [], 2: [], 3: [] }, totalDomains: 0, totalCategories: 0 },
        sidebar: result.sidebar || { domains: [], categories: [] },
      });
      setPageSidebar(result.pageSidebar || null);
      setCurrentPage(result.currentPage);
      
      staticDataFetchedRef.current = true;
    } catch (err) {
      console.error('Error refetching page context:', err);
    } finally {
      setStaticLoading(false);
    }
  }, [pathname]);

  // ============================================
  // Sidebar State Helpers (preserved from useSidebarData)
  // ============================================

  const toggleDomain = useCallback((domainId: string) => {
    setExpandedDomains(prev => {
      const newSet = new Set(prev);
      if (newSet.has(domainId)) {
        newSet.delete(domainId);
      } else {
        newSet.add(domainId);
      }
      return newSet;
    });
  }, []);

  const togglePage = useCallback((pageId: string) => {
    setExpandedPages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pageId)) {
        newSet.delete(pageId);
      } else {
        newSet.add(pageId);
      }
      return newSet;
    });
  }, []);

  const isDomainExpanded = useCallback((domainId: string) => {
    return expandedDomains.has(domainId);
  }, [expandedDomains]);

  const isPageExpanded = useCallback((pageId: string) => {
    return expandedPages.has(pageId);
  }, [expandedPages]);

  const isCurrentPage = useCallback((url: string) => {
    return pathname === url;
  }, [pathname]);

  const isDomainCurrent = useCallback((domain: SidebarDomain): boolean => {
    if (isCurrentPage(domain.url)) return true;
    return domain.pages.some(page => isCurrentPage(page.url));
  }, [isCurrentPage]);

  // ============================================
  // Get current domain info from sidebar data
  // ============================================
  const currentDomain = useMemo(() => {
    if (!staticData || !domainSlug) return null;
    const domain = staticData.sidebar.domains.find(d => d.slug === domainSlug);
    if (!domain) return null;
    return {
      id: domain.id,
      name: domain.name,
      slug: domain.slug,
      pageType: domain.pageType,
    };
  }, [staticData, domainSlug]);

  // ============================================
  // Construct combined data for backwards compatibility
  // ============================================
  const data: PageContextData | null = staticData ? {
    header: staticData.header,
    sidebar: staticData.sidebar,
    pageSidebar: pageSidebar,
    breadcrumb: { items: [], shouldCollapse: false, visibleItems: null }, // Breadcrumb is now client-derived
    currentPage: currentPage,
  } : null;

  // ============================================
  // Return Values
  // ============================================

  return {
    // Data
    data,
    loading,
    error,
    pathname,
    sidebarMode,

    // Individual data sections (for backwards compatibility)
    header: staticData?.header || { columnData: { 1: [], 2: [], 3: [] }, totalDomains: 0, totalCategories: 0 },
    sidebar: staticData?.sidebar || { domains: [], categories: [] },
    pageSidebar: pageSidebar,
    breadcrumb: { items: [], shouldCollapse: false, visibleItems: null }, // Breadcrumb is now client-derived
    currentPage: currentPage,
    currentDomain: currentDomain, // For breadcrumb and other components

    // Sidebar UI state
    expandedDomains,
    expandedPages,
    
    // Sidebar actions
    toggleDomain,
    togglePage,
    
    // Sidebar helpers
    isDomainExpanded,
    isPageExpanded,
    isCurrentPage,
    isDomainCurrent,
    
    // Refresh function
    refetch,
  };
}

// ============================================
// OLD HOOKS THIS REPLACES
// ============================================
//
// 1. useHeaderData
//    - Fetched from /api/header-domains
//    - Returned: columnData, totalDomains, totalCategories
//
// 2. useSidebarData
//    - Fetched from /api/sidebar
//    - Returned: domains, categories, expandedDomains, toggleDomain, etc.
//
// 3. usePageSidebarData
//    - Fetched from /api/page-sidebar
//    - Returned: sidebarMode, pageData, expandedPages, togglePageExpansion, etc.
//
// 4. useBreadcrumbData
//    - Fetched from /api/breadcrumb
//    - Returned: breadcrumbs, shouldCollapse, visibleItems
//
// All these are now combined into a single usePageContext() hook
// that makes ONE API call instead of FOUR.

