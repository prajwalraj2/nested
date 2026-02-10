'use client';

import { useMemo } from "react";
import Link from "next/link"
import { usePathname } from "next/navigation"
import { usePageContextValue } from "@/contexts/PageContextProvider"
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"

// ============================================
// Types
// ============================================

type BreadcrumbItemData = {
  label: string;
  url: string;
  isLoading?: boolean; // true if label is still loading (skeleton fallback mode)
};

// ============================================
// Helper Functions
// ============================================

/**
 * Convert slug to readable title (fallback when data not available)
 * e.g., "digital-marketing" → "Digital Marketing"
 */
function formatSlugToTitle(slug: string): string {
  return slug
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================
// FALLBACK MODE SWITCH
// ============================================
// Toggle between skeleton fallback and slug fallback
// Set to true to use skeletons, false to use formatted slugs
const USE_SKELETON_FALLBACK = true;

// ============================================
// Main Component - CLIENT-SIDE DERIVED BREADCRUMB
// ============================================

/**
 * Breadcrumb component that derives its structure from the URL path.
 * 
 * This is a CLIENT-SIDE ONLY implementation:
 * - Parses the URL path to determine breadcrumb structure
 * - Uses PageContext data for display names (when available)
 * - Falls back to formatted slugs if data not yet loaded
 * - Renders IMMEDIATELY without waiting for API
 * 
 * Pattern:
 * /domain → ["Domains"]
 * /domain/digitalmarketing → ["Domains", "Digital Marketing"]
 * /domain/digitalmarketing/ytube → ["Domains", "Digital Marketing", "YouTube Channels"]
 */
export default function BreadcrumbDemo() {
  const pathname = usePathname();
  
  // Get context data for proper names (may not be loaded yet)
  const { sidebar, pageSidebar, currentPage, loading } = usePageContextValue();

  // ============================================
  // Derive breadcrumb items from URL path
  // ============================================
  const breadcrumbItems = useMemo<BreadcrumbItemData[]>(() => {
    const segments = pathname.split('/').filter(Boolean);
    const items: BreadcrumbItemData[] = [];

    // Not a domain path - no breadcrumb
    if (segments.length === 0 || segments[0] !== 'domain') {
      return [];
    }

    // First item: "Domains" (static)
    items.push({
      label: 'Domains',
      url: '/domain'
    });

    // If just /domain, we're done
    if (segments.length === 1) {
      return items;
    }

    // Second item: Domain name
    const domainSlug = segments[1];
    const domainUrl = `/domain/${domainSlug}`;
    
    // Try to get domain name from sidebar data
    // Domain names are matched by slug, so they're safe even during loading
    let domainLabel: string | null = null;
    const foundDomain = sidebar.domains.find(d => d.slug === domainSlug);
    if (foundDomain) {
      domainLabel = foundDomain.name;
    } else if (pageSidebar?.domain?.slug === domainSlug && !loading) {
      // Only use pageSidebar if not loading (to prevent stale data)
      domainLabel = pageSidebar.domain.name;
    }
    
    // SKELETON FALLBACK: If no label found and loading, mark as loading
    // SLUG FALLBACK: Use formatted slug as fallback (commented out below)
    const domainIsLoading = domainLabel === null && loading;
    
    items.push({
      label: domainLabel ?? formatSlugToTitle(domainSlug),
      url: domainUrl,
      isLoading: USE_SKELETON_FALLBACK ? domainIsLoading : false
    });

    // If just /domain/[domainSlug], we're done
    if (segments.length === 2) {
      return items;
    }

    // Remaining items: Page path
    // Build the page breadcrumb trail
    let currentPath = domainUrl;
    
    for (let i = 2; i < segments.length; i++) {
      const pageSlug = segments[i];
      currentPath += `/${pageSlug}`;
      
      // Try to get page name from various sources
      let pageLabel: string | null = null;
      
      // Check if this is the current page (last segment)
      if (i === segments.length - 1) {
        // IMPORTANT: Only use context data if NOT loading (data is fresh, not stale)
        // When loading is true, the data is from the PREVIOUS page, not current!
        
        // Try currentPage from context (only if not loading - prevents stale data)
        if (currentPage?.title && !loading) {
          pageLabel = currentPage.title;
        }
        // Try pageSidebar page info (only if not loading)
        else if (pageSidebar?.page?.slug === pageSlug && !loading) {
          pageLabel = pageSidebar.page.name;
        }
        // Try to find in domain's pages (this is safer - uses slug matching)
        else if (foundDomain) {
          const foundPage = foundDomain.pages.find(p => p.slug === pageSlug);
          if (foundPage) {
            pageLabel = foundPage.title;
          }
        }
      } else {
        // Intermediate page - try to find in domain's pages
        if (foundDomain) {
          const foundPage = foundDomain.pages.find(p => p.slug === pageSlug);
          if (foundPage) {
            pageLabel = foundPage.title;
          }
        }
      }
      
      // SKELETON FALLBACK: If no label found and loading, mark as loading
      const pageIsLoading = pageLabel === null && loading;
      
      items.push({
        label: pageLabel ?? formatSlugToTitle(pageSlug),
        url: currentPath,
        isLoading: USE_SKELETON_FALLBACK ? pageIsLoading : false
      });
    }

    return items;
  }, [pathname, sidebar.domains, pageSidebar, currentPage]);

  // ============================================
  // Collapse logic for deep paths (>3 items)
  // ============================================
  const shouldCollapse = breadcrumbItems.length > 3;
  
  const visibleItems = useMemo(() => {
    if (!shouldCollapse || breadcrumbItems.length === 0) return null;
    
    return {
      first: breadcrumbItems[0],
      collapsed: breadcrumbItems.slice(1, -1),
      last: breadcrumbItems[breadcrumbItems.length - 1]
    };
  }, [breadcrumbItems, shouldCollapse]);

  // ============================================
  // Render
  // ============================================

  // Don't render if no items (e.g., not on /domain path)
  if (breadcrumbItems.length === 0) {
    return null;
  }

  // Render non-collapsed version
  if (!shouldCollapse) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbItems.map((item, index) => (
            <div key={item.url} className="flex items-center">
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {index === breadcrumbItems.length - 1 ? (
                  // Last item is current page (not clickable)
                  <BreadcrumbPage>
                    {item.isLoading ? (
                      <Skeleton className="h-4 w-24 inline-block" />
                    ) : (
                      item.label
                    )}
                  </BreadcrumbPage>
                ) : (
                  // All other items are clickable links
                  <BreadcrumbLink asChild>
                    <Link href={item.url}>
                      {item.isLoading ? (
                        <Skeleton className="h-4 w-20 inline-block" />
                      ) : (
                        item.label
                      )}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </div>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  // Render collapsed version: First > ... > Last
  if (!visibleItems) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {/* First item (Domains) */}
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={visibleItems.first.url}>{visibleItems.first.label}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {/* Separator */}
        <BreadcrumbSeparator />

        {/* Collapsed items dropdown */}
        <BreadcrumbItem>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 cursor-pointer">
              <BreadcrumbEllipsis className="size-4" />
              <span className="sr-only">Show more breadcrumbs</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {visibleItems.collapsed.map((item) => (
                <DropdownMenuItem key={item.url} asChild className="cursor-pointer">
                  <Link href={item.url}>{item.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </BreadcrumbItem>

        {/* Separator */}
        <BreadcrumbSeparator />

        {/* Last item (Current page) */}
        <BreadcrumbItem>
          <BreadcrumbPage>
            {visibleItems.last.isLoading ? (
              <Skeleton className="h-4 w-24 inline-block" />
            ) : (
              visibleItems.last.label
            )}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

// ============================================
// OLD IMPLEMENTATION (API-DEPENDENT)
// ============================================
//
// The old implementation waited for the API to return breadcrumb data:
//
// export default function BreadcrumbDemo() {
//   const { data, loading, error } = useBreadcrumbDataFromContext();
//
//   // Don't render anything if no breadcrumbs or loading
//   if (loading || error || data.items.length === 0) {
//     return null;
//   }
//
//   // ... render using data.items
// }
//
// Issues with old approach:
// 1. Had to wait for API response before rendering
// 2. Showed nothing during loading
// 3. Breadcrumb structure was already derivable from URL
//
// New approach:
// 1. Derives structure from URL immediately
// 2. Uses PageContext for names (when available)
// 3. Falls back to formatted slugs
// 4. Renders instantly on navigation
//
