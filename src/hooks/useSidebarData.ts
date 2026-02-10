// ============================================
// ⚠️ DEPRECATED - This hook is replaced by usePageContext
// ============================================
// This file is kept for reference during migration.
// The functionality has been moved to usePageContext hook
// which is available via PageContextProvider.
//
// Components should use:
//   import { useSidebarDataFromContext } from '@/contexts/PageContextProvider'
// Or for direct access:
//   import { usePageContext } from '@/hooks/usePageContext'
//   const { sidebar, toggleDomain, isDomainExpanded, ... } = usePageContext();
// ============================================

'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

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
};

export type SidebarData = {
  domains: SidebarDomain[];
  categories: SidebarCategory[];
};

export type SidebarState = {
  expandedDomains: Set<string>;
  expandedPages: Set<string>;
  currentPath: string;
};

export function useSidebarData() {
  const [data, setData] = useState<SidebarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  // State for expand/collapse
  const [sidebarState, setSidebarState] = useState<SidebarState>({
    expandedDomains: new Set(),
    expandedPages: new Set(),
    currentPath: pathname
  });

  // Fetch sidebar data
  useEffect(() => {
    async function fetchSidebarData() {
      try {
        setLoading(true);
        const response = await fetch('/api/sidebar'); // response is the response from the API in JSON format
        
        if (!response.ok) {
          throw new Error('Failed to fetch sidebar data');
        }

        const result = await response.json(); // result is the response from the API in JSON format | Ex: { success: true, domains: [...], categories: [...], message: 'Success' }
        
        if (!result.success) {
          throw new Error(result.message || 'Failed to load sidebar data');
        }

        setData(result);
        setError(null);
      } catch (err) {
        // console.error('Error fetching sidebar data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setData(null);
      } finally { // finally block is executed regardless of whether the try or catch block is executed
        setLoading(false);
      }
    }

    fetchSidebarData();
  }, []);

  // Update current path when pathname changes
  useEffect(() => {
    setSidebarState(prev => ({
      ...prev,
      currentPath: pathname
    }));
  }, [pathname]);

  // Helper functions for state management
  const toggleDomain = (domainId: string) => {
    setSidebarState(prev => {
      const newExpanded = new Set(prev.expandedDomains);
      if (newExpanded.has(domainId)) {
        newExpanded.delete(domainId);
      } else {
        newExpanded.add(domainId);
      }
      return {
        ...prev,
        expandedDomains: newExpanded
      };
    });
  };

  const togglePage = (pageId: string) => {
    setSidebarState(prev => {
      const newExpanded = new Set(prev.expandedPages);
      if (newExpanded.has(pageId)) {
        newExpanded.delete(pageId);
      } else {
        newExpanded.add(pageId);
      }
      return {
        ...prev,
        expandedPages: newExpanded
      };
    });
  };

  const isDomainExpanded = (domainId: string) => {
    return sidebarState.expandedDomains.has(domainId);
  };

  const isPageExpanded = (pageId: string) => {
    return sidebarState.expandedPages.has(pageId);
  };

  const isCurrentPage = (url: string) => {
    return sidebarState.currentPath === url;
  };

  // Helper to check if a page is current (simplified since no nesting)
  const isPageOrDescendantCurrent = (page: SidebarPage): boolean => {
    return isCurrentPage(page.url);
  };

  // Helper to check if a domain contains the current page
  const isDomainCurrent = (domain: SidebarDomain): boolean => {
    if (isCurrentPage(domain.url)) return true;
    return domain.pages.some(page => isPageOrDescendantCurrent(page));
  };

  return {
    // Data
    data,
    loading,
    error,
    
    // State
    sidebarState,
    
    // Actions
    toggleDomain,
    togglePage,
    
    // Helpers
    isDomainExpanded,
    isPageExpanded,
    isCurrentPage,
    isPageOrDescendantCurrent,
    isDomainCurrent,
    
    // Refresh function
    refresh: () => {
      setLoading(true);
      setError(null);
      // Re-trigger the effect
      window.location.reload();
    }
  };
}
