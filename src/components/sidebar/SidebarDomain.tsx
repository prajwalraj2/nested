'use client';

import Link from 'next/link';
import { ChevronDown, ChevronRight, Home } from 'lucide-react';
import { 
  SidebarMenuButton, 
  SidebarMenuItem, 
  SidebarMenuSub,
  SidebarMenu
} from '@/components/ui/sidebar';
import type { SidebarDomain } from '@/hooks/useSidebarData';

interface SidebarDomainProps {
  domain: SidebarDomain;
  isExpanded: boolean;
  isCurrent: boolean;
  onToggle: () => void;
  onPageToggle: (pageId: string) => void;
  isPageExpanded: (pageId: string) => boolean;
  isCurrentPage: (url: string) => boolean;
  isPageOrDescendantCurrent: (page: any) => boolean;
}

export function SidebarDomain({
  domain,
  isExpanded,
  isCurrent,
  onToggle,
  onPageToggle,
  isPageExpanded,
  isCurrentPage,
  isPageOrDescendantCurrent
}: SidebarDomainProps) {
  // Only show chevron for hierarchical domains that have pages
  const isHierarchical = domain.pageType === 'hierarchical';
  const hasPages = domain.pages && domain.pages.length > 0;
  const shouldShowChevron = isHierarchical && hasPages;
  const shouldShowExpanded = shouldShowChevron && isExpanded;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild className={`
        ${isCurrent ? 'bg-accent text-accent-foreground' : ''}
        flex items-center justify-between w-full pr-1
      `}>
        <div className="flex items-center justify-between w-full min-w-0">
          <Link 
            href={domain.url} 
            className="flex items-center gap-2 min-w-0 flex-1"
          >
            {/* <Home className="h-4 w-4 flex-shrink-0" /> */}
            <span className="truncate text-sm">{domain.name}</span>
          </Link>
          
          {shouldShowChevron && (
            <button
              onClick={(e) => {
                e.preventDefault();
                onToggle();
              }}
              className="flex-shrink-0 p-1 hover:bg-accent/50 rounded-sm ml-1"
            >
              {shouldShowExpanded ? (
                <ChevronDown className="h-4 w-4 cursor-pointer" />
              ) : (
                <ChevronRight className="h-4 w-4 cursor-pointer" />
              )}
            </button>
          )}
        </div>
      </SidebarMenuButton>

      {/* If the domain is expanded, render the pages */}
      {shouldShowExpanded && (
        <SidebarMenuSub>
          <SidebarMenu>
            {domain.pages.map((page) => (
              <SidebarMenuItem key={page.id}>
                <SidebarMenuButton asChild className={`
                  ${isCurrentPage(page.url) ? 'bg-accent text-accent-foreground' : ''}
                  flex items-center justify-between w-full pr-1
                `}>
                  <div className="flex items-center justify-between w-full min-w-0">
                    <Link 
                      href={page.url} 
                      className="flex items-center gap-2 min-w-0 flex-1"
                    >
                      <span className="truncate text-sm">{page.title}</span>
                    </Link>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}
