// ============================================
// ⚠️ DEPRECATED - This hook is replaced by usePageContext
// ============================================
// This file is kept for reference during migration.
// The functionality has been moved to usePageContext hook
// which is available via PageContextProvider.
//
// Components should use:
//   import { useHeaderDataFromContext } from '@/contexts/PageContextProvider'
// Or for direct access:
//   import { usePageContext } from '@/hooks/usePageContext'
//   const { header } = usePageContext();
// ============================================

'use client';

import { useState, useEffect } from 'react';

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

/**
 * Hook to manage header domains data for navigation dropdown
 */
export function useHeaderData() {
  const [data, setData] = useState<HeaderData>({
    columnData: { 1: [], 2: [], 3: [] },
    totalDomains: 0,
    totalCategories: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHeaderData();
  }, []);

  const fetchHeaderData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/header-domains');
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch header data');
      }

      setData({
        columnData: result.columnData,
        totalDomains: result.totalDomains,
        totalCategories: result.totalCategories,
      });
    } catch (err) {
      console.error('Error fetching header data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return {
    data,
    loading,
    error,
    refetch: fetchHeaderData,
  };
}
