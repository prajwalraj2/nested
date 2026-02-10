'use client';

import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageSidebarDataFromContext } from '@/contexts/PageContextProvider';
import type { PageSidebarSection, PageSidebarPage } from '@/hooks/usePageContext';

/**
 * PageSidebar Component
 * 
 * Displays page-specific sidebar with sections and pages.
 * Used when user is viewing a specific page within a domain.
 */
export function PageSidebar() {
  const { 
    pageData, 
    loading, 
    error, 
    togglePageExpansion, 
    isCurrentPage, 
    isPageExpanded 
  } = usePageSidebarDataFromContext();

  if (loading) {
    return (
      <SidebarContent>
        {/* Header skeleton */}
        <SidebarGroup>
          <SidebarGroupLabel>
            <Skeleton className="h-3 w-12 bg-muted-foreground/20" />
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-2 py-1">
              <Skeleton className="h-4 w-28 mb-1 bg-muted-foreground/20" />
              <Skeleton className="h-3 w-20 bg-muted-foreground/15" />
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Section 1 skeleton - 8 items */}
        <SidebarGroup>
          <SidebarGroupLabel>
            <Skeleton className="h-3 w-28 bg-muted-foreground/20" />
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <SidebarMenuItem key={`s1-${i}`}>
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <Skeleton className="h-4 w-4 rounded-sm bg-muted-foreground/20" />
                    <Skeleton className={`h-4 bg-muted-foreground/15 ${
                      i % 3 === 0 ? 'w-[100px]' : i % 2 === 0 ? 'w-[140px]' : 'w-[120px]'
                    }`} />
                  </div>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Section 2 skeleton - 7 items */}
        <SidebarGroup>
          <SidebarGroupLabel>
            <Skeleton className="h-3 w-24 bg-muted-foreground/20" />
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <SidebarMenuItem key={`s2-${i}`}>
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <Skeleton className="h-4 w-4 rounded-sm bg-muted-foreground/20" />
                    <Skeleton className={`h-4 bg-muted-foreground/15 ${
                      i % 3 === 0 ? 'w-[130px]' : i % 2 === 0 ? 'w-[90px]' : 'w-[110px]'
                    }`} />
                  </div>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Section 3 skeleton - 9 items */}
        <SidebarGroup>
          <SidebarGroupLabel>
            <Skeleton className="h-3 w-20 bg-muted-foreground/20" />
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <SidebarMenuItem key={`s3-${i}`}>
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <Skeleton className="h-4 w-4 rounded-sm bg-muted-foreground/20" />
                    <Skeleton className={`h-4 bg-muted-foreground/15 ${
                      i % 3 === 0 ? 'w-[115px]' : i % 2 === 0 ? 'w-[135px]' : 'w-[95px]'
                    }`} />
                  </div>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    );
  }

  if (error || !pageData) {
    return (
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Error</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="text-sm text-muted-foreground p-4">
              {error || 'Failed to load page data'}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    );
  }

  // Sort sections by column and order
  const sortedSections = [...pageData.sections].sort((a, b) => {
    if (a.column !== b.column) {
      return a.column - b.column;
    }
    return a.order - b.order;
  });

  return (
    <SidebarContent>
      {/* Header showing current context */}
      <SidebarGroup>
        <SidebarGroupLabel className="text-xs text-muted-foreground">
          {pageData.type === 'direct_domain' ? 'Domain' : 'Page'}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <div className="px-2 py-1">
            <div className="font-semibold text-sm">
              {pageData.page ? pageData.page.name : pageData.domain.name}
            </div>
            {pageData.page && (
              <div className="text-xs text-muted-foreground">
                in {pageData.domain.name}
              </div>
            )}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Sections */}
      {sortedSections.map((section, index) => (
        <PageSidebarSection
          key={`${section.title}-${index}`}
          section={section}
          togglePageExpansion={togglePageExpansion}
          isCurrentPage={isCurrentPage}
          isPageExpanded={isPageExpanded}
        />
      ))}
    </SidebarContent>
  );
}

/**
 * Individual Section Component
 */
function PageSidebarSection({
  section,
  togglePageExpansion,
  isCurrentPage,
  isPageExpanded
}: {
  section: PageSidebarSection;
  togglePageExpansion: (pageId: string) => void;
  isCurrentPage: (url: string) => boolean;
  isPageExpanded: (pageId: string) => boolean;
}) {
  if (section.pages.length === 0) {
    return null;
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {section.pages.map((page) => (
            <PageSidebarItem
              key={page.id}
              page={page}
              togglePageExpansion={togglePageExpansion}
              isCurrentPage={isCurrentPage}
              isPageExpanded={isPageExpanded}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

/**
 * Individual Page Item Component
 */
function PageSidebarItem({
  page,
  togglePageExpansion,
  isCurrentPage,
  isPageExpanded
}: {
  page: PageSidebarPage;
  togglePageExpansion: (pageId: string) => void;
  isCurrentPage: (url: string) => boolean;
  isPageExpanded: (pageId: string) => boolean;
}) {
  const isCurrent = isCurrentPage(page.url);
  const isExpanded = isPageExpanded(page.id);
  const shouldShowChevron = page.hasChildren && page.contentType === 'subcategory_list';

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild className={`
        ${isCurrent ? 'bg-accent text-accent-foreground' : ''}
        flex items-center justify-between w-full pr-1
      `}>
        <div className="flex items-center justify-between w-full min-w-0">
          <Link 
            href={page.url} 
            className="flex items-center gap-2 min-w-0 flex-1"
            title={page.title}
          >
            <span className="truncate text-sm">{page.title}</span>
          </Link>
          
          {shouldShowChevron && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                togglePageExpansion(page.id);
              }}
              className="flex-shrink-0 p-1 hover:bg-accent rounded-sm transition-colors"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
      </SidebarMenuButton>

      {/* Children (for subcategory_list pages) */}
      {shouldShowChevron && isExpanded && page.children.length > 0 && (
        <SidebarMenuSub>
          {page.children.map((childPage) => (
            <SidebarMenuSubItem key={childPage.id}>
              <SidebarMenuSubButton asChild className={
                isCurrentPage(childPage.url) ? 'bg-accent text-accent-foreground' : ''
              }>
                <Link 
                  href={childPage.url} 
                  className="flex items-center gap-2"
                  title={childPage.title}
                >
                  <span className="truncate text-sm">{childPage.title}</span>
                </Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}
