// ============================================
// ⚠️ DEPRECATED - This hook is replaced by usePageContext
// ============================================
// This file is kept for reference during migration.
// The functionality has been moved to usePageContext hook
// which is available via PageContextProvider.
//
// Components should use:
//   import { usePageSidebarDataFromContext } from '@/contexts/PageContextProvider'
// Or for direct access:
//   import { usePageContext } from '@/hooks/usePageContext'
//   const { pageSidebar, sidebarMode, ... } = usePageContext();
// ============================================

'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Types for page sidebar data
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

export type SidebarMode = 'domain' | 'page';

/**
 * Hook to manage page sidebar data and detect when to show page sidebar
 */
export function usePageSidebarData() {
  const pathname = usePathname();
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('domain'); // state to store the sidebar mode (domain or page) default is 'domain'
  const [pageData, setPageData] = useState<PageSidebarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());

  // Detect sidebar mode based on current path
  useEffect(() => {
    const pathSegments = pathname.split('/').filter(Boolean); // Eg: /domain/gdesign/ytube -> ['domain', 'gdesign', 'ytube'] -> Explation: split the pathname into an array of segments and filter out any empty segments 
    
    // Determine if we should show page sidebar or domain sidebar -> if the path segments length is greater than 3 and the first segment is 'domain', set the sidebar mode to 'page' else set it to 'domain'
    if (pathSegments.length >= 3 && pathSegments[0] === 'domain') {
      // We're on a specific page: /domain/[slug]/[...pages]
      setSidebarMode('page');
    } else {
      // We're on domain index or root: /domain or /domain/[slug]
      setSidebarMode('domain');
    }
  }, [pathname]); // re-run the effect when the pathname changes

  // Fetch page sidebar data when in page mode
  useEffect(() => {
    if (sidebarMode === 'page') {
      fetchPageSidebarData();
    } else {
      setPageData(null);
      setError(null);
    }
  }, [sidebarMode, pathname]);

  const fetchPageSidebarData = async () => {
    setLoading(true);
    setError(null);

    try {
      const pathSegments = pathname.split('/').filter(Boolean);
      
      if (pathSegments.length < 2 || pathSegments[0] !== 'domain') {
        throw new Error('Invalid path for page sidebar');
      }

      const domainSlug = pathSegments[1];
      const pageSlug = pathSegments.length >= 3 ? pathSegments[2] : undefined;
      
      // Build API URL - always include domainSlug
      let apiUrl = `/api/page-sidebar?domainSlug=${domainSlug}`;
      
      // If we have a page slug, this could be either:
      // 1. Direct domain page: /domain/gdesign/ytube
      // 2. Hierarchical page: /domain/webdev/withcode
      // We'll try with pageSlug first, and if it fails, try without it
      if (pageSlug) {
        apiUrl += `&pageSlug=${pageSlug}`;
      }

      // console.log('[DEBUG Hook] Fetching from API:', apiUrl);

      const response = await fetch(apiUrl);
      const data = await response.json();

      if (!response.ok || !data.success) {
        // If hierarchical page request fails, try as direct domain
        if (pageSlug) {
          const directApiUrl = `/api/page-sidebar?domainSlug=${domainSlug}`;
          const directResponse = await fetch(directApiUrl);
          const directData = await directResponse.json();
          
          if (directResponse.ok && directData.success) {
            setPageData(directData);
          } else {
            throw new Error(directData.message || data.message || 'Failed to fetch page sidebar data');
          }
        } else {
          throw new Error(data.message || 'Failed to fetch page sidebar data');
        }
      } else {
        // console.log('[DEBUG Hook] Successfully received data:', data);
        setPageData(data);
      }
    } catch (err) {
      // console.error('Error fetching page sidebar data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPageData(null);
    } finally {
      setLoading(false);
    }
  };

  // Toggle page expansion for subcategory_list pages
  const togglePageExpansion = (pageId: string) => {
    setExpandedPages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pageId)) {
        newSet.delete(pageId);
      } else {
        newSet.add(pageId);
      }
      return newSet;
    });
  };

  // Check if current page/path is active
  const isCurrentPage = (url: string): boolean => {
    return pathname === url;
  };

  // Check if a page is expanded
  const isPageExpanded = (pageId: string): boolean => {
    return expandedPages.has(pageId);
  };

  return {
    sidebarMode,
    pageData,
    loading,
    error,
    expandedPages,
    togglePageExpansion,
    isCurrentPage,
    isPageExpanded,
    refetch: fetchPageSidebarData
  };
}
