'use client';

/**
 * Page Context Provider
 * 
 * Provides page context data to all components via React Context.
 * This eliminates the need for each component to fetch its own data.
 * 
 * Usage:
 * 1. Wrap your app/layout with <PageContextProvider>
 * 2. Use usePageContextValue() in any component to access the data
 * 
 * Example:
 * ```tsx
 * // In layout.tsx
 * <PageContextProvider>
 *   {children}
 * </PageContextProvider>
 * 
 * // In any component
 * const { header, sidebar, breadcrumb } = usePageContextValue();
 * ```
 */

import { createContext, useContext, ReactNode } from 'react';
import { 
  usePageContext, 
  type PageContextData,
  type HeaderData,
  type SidebarData,
  type PageSidebarData,
  type BreadcrumbData,
  type SidebarDomain,
  type SidebarMode,
} from '@/hooks/usePageContext';

// ============================================
// Context Types
// ============================================

type PageContextValue = {
  // Data
  data: PageContextData | null;
  loading: boolean;
  error: string | null;
  pathname: string;
  sidebarMode: SidebarMode;

  // Individual data sections
  header: HeaderData;
  sidebar: SidebarData;
  pageSidebar: PageSidebarData | null;
  breadcrumb: BreadcrumbData;
  currentPage?: {
    id: string;
    title: string;
    contentType: string;
  };
  currentDomain?: {
    id: string;
    name: string;
    slug: string;
    pageType: string;
  } | null;

  // Sidebar UI state
  expandedDomains: Set<string>;
  expandedPages: Set<string>;
  
  // Sidebar actions
  toggleDomain: (domainId: string) => void;
  togglePage: (pageId: string) => void;
  
  // Sidebar helpers
  isDomainExpanded: (domainId: string) => boolean;
  isPageExpanded: (pageId: string) => boolean;
  isCurrentPage: (url: string) => boolean;
  isDomainCurrent: (domain: SidebarDomain) => boolean;
  
  // Refresh function
  refetch: () => Promise<void>;
};

// ============================================
// Context
// ============================================

const PageContext = createContext<PageContextValue | null>(null);

// ============================================
// Provider Component
// ============================================

type PageContextProviderProps = {
  children: ReactNode;
};

export function PageContextProvider({ children }: PageContextProviderProps) {
  const contextValue = usePageContext();

  // Ensure pageSidebar is null instead of undefined for type safety
  const safeContextValue: PageContextValue = {
    ...contextValue,
    pageSidebar: contextValue.pageSidebar ?? null,
  };

  return (
    <PageContext.Provider value={safeContextValue}>
      {children}
    </PageContext.Provider>
  );
}

// ============================================
// Consumer Hook
// ============================================

/**
 * Hook to access page context data
 * 
 * Must be used within a PageContextProvider
 */
export function usePageContextValue(): PageContextValue {
  const context = useContext(PageContext);
  
  if (!context) {
    throw new Error(
      'usePageContextValue must be used within a PageContextProvider. ' +
      'Make sure to wrap your component tree with <PageContextProvider>.'
    );
  }
  
  return context;
}

// ============================================
// Convenience Hooks (for gradual migration)
// ============================================

/**
 * Hook for header data only (backwards compatible with useHeaderData)
 */
export function useHeaderDataFromContext() {
  const { header, loading, error, refetch } = usePageContextValue();
  return { data: header, loading, error, refetch };
}

/**
 * Hook for sidebar data only (backwards compatible with useSidebarData)
 */
export function useSidebarDataFromContext() {
  const { 
    sidebar, 
    loading, 
    error, 
    expandedDomains,
    expandedPages,
    toggleDomain,
    togglePage,
    isDomainExpanded,
    isPageExpanded,
    isCurrentPage,
    isDomainCurrent,
    pathname,
  } = usePageContextValue();
  
  return {
    data: sidebar,
    loading,
    error,
    sidebarState: {
      expandedDomains,
      expandedPages,
      currentPath: pathname,
    },
    toggleDomain,
    togglePage,
    isDomainExpanded,
    isPageExpanded,
    isCurrentPage,
    isPageOrDescendantCurrent: (page: any) => isCurrentPage(page.url),
    isDomainCurrent,
    refresh: () => window.location.reload(),
  };
}

/**
 * Hook for page sidebar data only (backwards compatible with usePageSidebarData)
 */
export function usePageSidebarDataFromContext() {
  const {
    sidebarMode,
    pageSidebar,
    loading,
    error,
    expandedPages,
    togglePage,
    isCurrentPage,
    isPageExpanded,
    refetch,
    pathname,
  } = usePageContextValue();
  
  return {
    sidebarMode,
    pageData: pageSidebar,
    loading,
    error,
    expandedPages,
    togglePageExpansion: togglePage,
    isCurrentPage,
    isPageExpanded,
    refetch,
  };
}

/**
 * Hook for breadcrumb data only (backwards compatible with useBreadcrumbData)
 */
export function useBreadcrumbDataFromContext() {
  const { breadcrumb, loading, error, refetch } = usePageContextValue();
  return { data: breadcrumb, loading, error, refetch };
}

// ============================================
// OLD HOOKS/CONTEXT THIS REPLACES
// ============================================
//
// Previously, each component had to:
// 1. Import its own hook (useHeaderData, useSidebarData, etc.)
// 2. Each hook made its own API call
// 3. Result: 4 API calls on every page load
//
// Now:
// 1. PageContextProvider wraps the app
// 2. usePageContext makes ONE API call
// 3. All components share the same data
// 4. Result: 1 API call on every page load

