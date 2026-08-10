'use client';

import Link from 'next/link';
import { ItemIcon } from '@/components/domain/ItemIcon';
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
// Repointed from the deprecated `useSidebarData` hook — see the note in
// SidebarDomain.tsx. The type declaration is identical in both files.
import type { SidebarPage } from '@/hooks/usePageContext';

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
            <ItemIcon icon={page.icon} size={16} />
            <span className="truncate text-sm font-medium">{page.title}</span>
          </Link>
        </div>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
