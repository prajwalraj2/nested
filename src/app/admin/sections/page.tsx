// src/app/admin/sections/page.tsx

import { Suspense } from 'react';
import { CircleCheck, FileText, LayoutPanelTop } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPageHeader } from '@/components/admin/layout/AdminPageHeader';
import { StatsCard } from '@/components/admin/dashboard/StatsCard';
import { SectionsManager } from '@/components/admin/sections/SectionsManager';

/**
 * ⚠️ DO NOT REMOVE — finding #20. This page calls `prisma.domain.findMany` during render
 * and uses no dynamic API, so Next 15 would prerender it at BUILD time and serve frozen
 * HTML: a newly created domain would be missing from the picker until the next deploy.
 *
 * `revalidateTag` cannot help — this reads Prisma directly, so nothing is tagged. See the
 * full explanation in src/app/admin/page.tsx.
 *
 * Note the `Suspense` boundary below does NOT make this dynamic. Suspense controls when
 * parts of the tree stream in; it does not opt a route out of static rendering.
 */
export const dynamic = 'force-dynamic';

/**
 * Main Sections Management Page
 * 
 * This page provides the interface for configuring how child pages
 * are organized into 3-column sections on section-based pages.
 * 
 * Features:
 * - Domain and page selection
 * - Visual section configuration editor
 * - Live preview of section layout
 * - Drag-and-drop page organization
 * 
 * Workflow:
 * 1. Select a domain (direct or hierarchical)
 * 2. Select a section-based page within that domain
 * 3. Configure how child pages are organized into sections
 * 4. Save the configuration to the database
 */

// Fetch domains and their section-based pages
async function getSectionablePages() {
  try {
    const domains = await prisma.domain.findMany({
      include: {
        pages: {
          where: {
            contentType: 'section_based'
          },
          include: {
            subPages: {
              select: {
                id: true,
                title: true,
                slug: true,
                contentType: true
              },
              orderBy: { order: 'asc' }
            },
            _count: {
              select: {
                subPages: true
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Get statistics
    const totalDomains = domains.length;
    const totalSectionablePages = domains.reduce((acc, domain) => acc + domain.pages.length, 0);
    const configuredPages = domains.reduce((acc, domain) => 
      acc + domain.pages.filter(page => page.sections && Array.isArray(page.sections) && page.sections.length > 0).length, 0
    );
    const totalChildPages = domains.reduce((acc, domain) => 
      acc + domain.pages.reduce((pageAcc, page) => pageAcc + page.subPages.length, 0), 0
    );

    return {
      domains,
      stats: {
        totalDomains,
        totalSectionablePages,
        configuredPages,
        totalChildPages
      }
    };
  } catch (error) {
    console.error('Error fetching sectionable pages:', error);
    return {
      domains: [],
      stats: {
        totalDomains: 0,
        totalSectionablePages: 0,
        configuredPages: 0,
        totalChildPages: 0
      }
    };
  }
}

export default async function SectionsManagementPage() {
  const { domains, stats } = await getSectionablePages();

  return (
    <>
      {/*
        ⚠️ REBUILT IN G-6c. Another shell no earlier phase had touched: a hand-rolled
        `text-3xl text-gray-900` title over a `border-gray-200` rule, and `bg-white` stat
        cards — light-only, straight onto #21's dark theme.

        The local `StatsCard` in this file was the **fourth** copy in the codebase (after the
        dashboard's, `tables/[id]`'s and `tables/`'s), each drawing its own white panel and
        taking an emoji string as its icon. All four are now the shared component.
      */}
      <AdminPageHeader
        title="Section layout"
        description={`Organise child pages into 3-column sections. ${stats.configuredPages} of ${stats.totalSectionablePages} eligible pages are configured.`}
      />

      {/*
        ⚠️ Four tiles became three. "Total Domains" counted every domain in the system, which
        says nothing about section layout — the number you actually want is how many pages can
        have sections and how many you have done. "Configured" now carries the ratio in its
        description instead of needing a tile of its own alongside the total.
      */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatsCard
          title="Eligible pages"
          value={stats.totalSectionablePages}
          icon={LayoutPanelTop}
          description="Section-based pages"
        />
        <StatsCard
          title="Configured"
          value={stats.configuredPages}
          icon={CircleCheck}
          description={`${stats.totalSectionablePages - stats.configuredPages} still unconfigured`}
        />
        <StatsCard
          title="Child pages"
          value={stats.totalChildPages}
          icon={FileText}
          description="Available to organise"
        />
      </div>

      <Suspense fallback={<SectionsManagerSkeleton />}>
        <SectionsManager domains={domains} />
      </Suspense>
    </>
  );
}


/**
 * Loading skeleton for the sections manager
 */
function SectionsManagerSkeleton() {
  return (
    /*
      shadcn `Skeleton`, replacing hand-rolled `bg-gray-200` blocks in an `animate-pulse`
      wrapper — the fourth such skeleton in the admin. It carries `bg-accent` and its own
      pulse, so it follows the theme instead of making the loading state the brightest thing
      on a dark page.
    */
    <Card className="p-6">
      <Skeleton className="mb-4 h-6 w-1/4" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
      <Skeleton className="mt-6 h-64" />
    </Card>
  );
}
