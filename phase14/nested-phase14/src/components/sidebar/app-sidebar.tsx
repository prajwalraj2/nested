'use client';

import { ChevronUp, User2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu"
import { SidebarDomain } from './SidebarDomain'
import { PageSidebar } from './PageSidebar'
import { useSidebarDataFromContext, usePageSidebarDataFromContext } from '@/contexts/PageContextProvider'

export default function AppSidebar() {
  const {
    data,
    loading,
    error,
    toggleDomain,
    togglePage,
    isDomainExpanded,
    isPageExpanded,
    isCurrentPage,
    isPageOrDescendantCurrent,
    isDomainCurrent
  } = useSidebarDataFromContext();

  const { sidebarMode } = usePageSidebarDataFromContext();

  return (
    <Sidebar side="left" collapsible="offcanvas" variant="floating">
      {/* Content - Conditionally render based on sidebar mode */}
      {sidebarMode === 'domain' ? (
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Domains</SidebarGroupLabel>
            <SidebarGroupContent>
              {/* Loading Skeleton - grouped like actual domains */}
              {loading && (
                <SidebarMenu>
                  {/* Group 1 - 5 items */}
                  {[1, 2, 3, 4, 5].map((i) => (
                    <SidebarMenuItem key={`g1-${i}`}>
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <Skeleton className="h-5 w-5 rounded-sm bg-muted-foreground/20" />
                        <Skeleton className={`h-4 bg-muted-foreground/15 ${
                          i % 3 === 0 ? 'w-[110px]' : i % 2 === 0 ? 'w-[140px]' : 'w-[125px]'
                        }`} />
                      </div>
                    </SidebarMenuItem>
                  ))}
                  {/* Spacing between groups */}
                  <div className="h-4" />
                  {/* Group 2 - 5 items */}
                  {[1, 2, 3, 4, 5].map((i) => (
                    <SidebarMenuItem key={`g2-${i}`}>
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <Skeleton className="h-5 w-5 rounded-sm bg-muted-foreground/20" />
                        <Skeleton className={`h-4 bg-muted-foreground/15 ${
                          i % 3 === 0 ? 'w-[130px]' : i % 2 === 0 ? 'w-[100px]' : 'w-[115px]'
                        }`} />
                      </div>
                    </SidebarMenuItem>
                  ))}
                  {/* Spacing between groups */}
                  <div className="h-4" />
                  {/* Group 3 - 5 items */}
                  {[1, 2, 3, 4, 5].map((i) => (
                    <SidebarMenuItem key={`g3-${i}`}>
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <Skeleton className="h-5 w-5 rounded-sm bg-muted-foreground/20" />
                        <Skeleton className={`h-4 bg-muted-foreground/15 ${
                          i % 3 === 0 ? 'w-[120px]' : i % 2 === 0 ? 'w-[135px]' : 'w-[105px]'
                        }`} />
                      </div>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              )}

              {/* Error */}
              {error && (
                <div className="px-2 py-4 text-sm text-destructive">
                  Error loading navigation: {error}
                </div>
              )}

              {/* Data with category spacing */}
              {data && data.domains && (
                <SidebarMenu>
                  {data.domains.map((domain, index) => {
                    // Check if this is the first domain of a new category
                    const prevDomain = index > 0 ? data.domains[index - 1] : null;
                    const isNewCategory = !prevDomain || 
                      (prevDomain.categoryId !== domain.categoryId) ||
                      (prevDomain.columnPosition !== domain.columnPosition);
                    
                    return (
                      <div key={domain.id}>
                        {/* Add spacing between categories */}
                        {isNewCategory && index > 0 && (
                          <div className="h-4" />
                        )}
                        
                        <SidebarDomain
                          domain={domain}
                          isExpanded={isDomainExpanded(domain.id)}
                          isCurrent={isDomainCurrent(domain)}
                          onToggle={() => toggleDomain(domain.id)}
                          onPageToggle={togglePage}
                          isPageExpanded={isPageExpanded}
                          isCurrentPage={isCurrentPage}
                          isPageOrDescendantCurrent={isPageOrDescendantCurrent}
                        />
                      </div>
                    );
                  })}
                </SidebarMenu>
              )}

              {/* No data - only show when not loading and data is empty */}
              {!loading && data && data.domains && data.domains.length === 0 && (
                <div className="px-2 py-4 text-sm text-muted-foreground">
                  No domains available
                </div>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      ) : (
        <PageSidebar />
      )}
    </Sidebar>
  )
}
