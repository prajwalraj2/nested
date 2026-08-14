// ============================================
// ⚠️ DEPRECATED - This hook is replaced by usePageContext
// ============================================
// This file is kept for reference during migration.
// The functionality has been moved to usePageContext hook
// which is available via PageContextProvider.
//
// Components should use:
//   import { useBreadcrumbDataFromContext } from '@/contexts/PageContextProvider'
// Or for direct access:
//   import { usePageContext } from '@/hooks/usePageContext'
//   const { breadcrumb } = usePageContext();
// ============================================

'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export type BreadcrumbItem = {
  label: string;
  url: string;
  type: 'root' | 'domain' | 'page';
  contentType?: string;
};

export type BreadcrumbData = {
  breadcrumbs: BreadcrumbItem[];
  shouldCollapse: boolean;
  visibleItems: {
    first: BreadcrumbItem;
    collapsed: BreadcrumbItem[];
    last: BreadcrumbItem;
  } | null;
};

/**
 * Hook to manage breadcrumb data based on current URL path
 */
export function useBreadcrumbData() {
  const pathname = usePathname(); // get the current pathname from the browser
  const [data, setData] = useState<BreadcrumbData>({ // state to store the breadcrumb data
    breadcrumbs: [],
    shouldCollapse: false,
    visibleItems: null
  });
  const [loading, setLoading] = useState(false); // state to store the loading state (true when fetching data, false when done)
  const [error, setError] = useState<string | null>(null); // state to store the error state (null when no error, string when error)

  useEffect(() => {
    // Only fetch breadcrumbs for domain paths
    if (!pathname.startsWith('/domain')) { // if the pathname does not start with /domain, set the data to an empty array
      setData({
        breadcrumbs: [],
        shouldCollapse: false,
        visibleItems: null
      });
      return;
    }

    fetchBreadcrumbData();
  }, [pathname]);

  const fetchBreadcrumbData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/breadcrumb?path=${encodeURIComponent(pathname)}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch breadcrumb data');
      }

      const breadcrumbs = result.breadcrumbs as BreadcrumbItem[];
      const processedData = processBreadcrumbs(breadcrumbs);
      
      setData(processedData);
    } catch (err) {
      console.error('Error fetching breadcrumb data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      
      // Fallback breadcrumbs based on URL parsing
      const fallbackData = createFallbackBreadcrumbs(pathname);
      setData(fallbackData);
    } finally {
      setLoading(false);
    }
  };

  return {
    data,
    loading,
    error,
    refetch: fetchBreadcrumbData
  };
}

/**
 * Process breadcrumbs to determine collapse behavior
 * Always show: Domains > [Domain Name] ... [Current Page]
 */
function processBreadcrumbs(breadcrumbs: BreadcrumbItem[]): BreadcrumbData {
  const shouldCollapse = breadcrumbs.length > 3;

  if (!shouldCollapse) {
    return {
      breadcrumbs,
      shouldCollapse: false,
      visibleItems: null
    };
  }

  // Collapse middle items: Show first (Domains), last (Current Page), collapse middle ones
  const first = breadcrumbs[0]; // Domains
  const last = breadcrumbs[breadcrumbs.length - 1]; // Current Page
  const collapsed = breadcrumbs.slice(1, -1); // Everything in between

  return {
    breadcrumbs,
    shouldCollapse: true,
    visibleItems: {
      first,
      collapsed,
      last
    }
  };
}

/**
 * Create fallback breadcrumbs when API fails
 */
function createFallbackBreadcrumbs(pathname: string): BreadcrumbData {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];

  // Always start with Domains
  breadcrumbs.push({
    label: 'Domains',
    url: '/domain',
    type: 'root'
  });

  if (segments.length >= 2) {
    // Add domain (format slug to readable name)
    const domainSlug = segments[1];
    breadcrumbs.push({
      label: formatSlugToTitle(domainSlug),
      url: `/domain/${domainSlug}`,
      type: 'domain'
    });

    // Add pages
    let currentPath = `/domain/${domainSlug}`;
    for (let i = 2; i < segments.length; i++) {
      const pageSlug = segments[i];
      currentPath += `/${pageSlug}`;
      
      breadcrumbs.push({
        label: formatSlugToTitle(pageSlug),
        url: currentPath,
        type: 'page'
      });
    }
  }

  return processBreadcrumbs(breadcrumbs);
}

/**
 * Convert slug to readable title
 */
function formatSlugToTitle(slug: string): string {
  return slug
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
