'use client';

import Link from 'next/link';
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import type { SidebarPage } from '@/hooks/useSidebarData';

interface SidebarPageProps {
  page: SidebarPage;
  isCurrent: boolean;
}

export function SidebarPage({
  page,
  isCurrent,
}: SidebarPageProps) {
  // Simplified component for simple page display (no nesting)
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
            <span className="truncate text-sm font-medium">{page.title}</span>
          </Link>
        </div>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
