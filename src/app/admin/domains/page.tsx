import { Globe, CheckCircle2, Filter, Lightbulb, ChevronDown } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { STATUS_BY_URL_PARAM } from '@/lib/domain-status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { AdminPageHeader } from '@/components/admin/layout/AdminPageHeader';
import { StatsCard } from '@/components/admin/dashboard/StatsCard';
import { DomainsTable } from '@/components/admin/domains/DomainsTable';
import { DomainFilters } from '@/components/admin/domains/DomainFilters';
import { NewDomainDialog } from '@/components/admin/domains/NewDomainDialog';

/**
 * ⚠️ THE `Roboto` FONT IMPORT WAS REMOVED (Phase G-3a).
 *
 * This page loaded Roboto from Google Fonts and applied `roboto.className` to individual
 * headings, fighting the app-wide Geist set in the root layout. So this one screen rendered
 * its text in a different typeface from every other admin page — and paid for an extra font
 * download to do it. No other admin page does this.
 */

/**
 * Admin Domains Management Page
 * 
 * Comprehensive domain management interface with:
 * - Domain creation and editing
 * - Category-based filtering and organization
 * - Publication status management
 * - Page type configuration (direct vs hierarchical)
 * - SEO settings and slug management
 * - Bulk operations and quick actions
 * 
 * Layout Structure:
 * ┌─ Domain Creation Form ──────────────────────────────┐
 * │ [Name] [Category] [Page Type] [SEO] [Save]          │
 * └─────────────────────────────────────────────────────┘
 * ┌─ Filters & Search ─────────────────────────────────┐
 * │ [Search] [Category Filter] [Status] [Type Filter]  │
 * └─────────────────────────────────────────────────────┘
 * ┌─ Domains Table ────────────────────────────────────┐
 * │ Name        │ Category    │ Type   │ Status │ Actions │
 * │ Domain 1    │ Design      │ Direct │ Live   │ [E][D] │
 * │ Domain 2    │ Tech        │ Hier   │ Draft  │ [E][D] │
 * └─────────────────────────────────────────────────────┘
 */

type SearchParams = {
  search?: string;
  category?: string;
  status?: string;
  pageType?: string;
};

type DomainsPageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function DomainsManagePage({ searchParams }: DomainsPageProps) {
  // Await searchParams for Next.js 15 compatibility
  const awaitedSearchParams = await searchParams;
  
  // Fetch domains with filters applied
  const { domains, categories, stats } = await fetchDomainsWithFilters(awaitedSearchParams);
  
  return (
    <>
      {/*
        The gradient "🌐 Manage Content Domains" intro banner was removed, for the same
        reason as the dashboard's welcome banner in G-2: it described the screen you are
        already looking at, and its `from-green-50 to-emerald-50` gradient was hardcoded
        light so it broke in dark mode.

        Title and primary action now share one row — which is where the eye goes first.
      */}
      <AdminPageHeader
        title="Domains"
        description={`${stats.totalDomains} domains across ${stats.categoriesUsed} categories.`}
        actions={<NewDomainDialog categories={categories} />}
      />

      {/*
        Stats reuse `StatsCard` from G-2 rather than four bespoke `bg-white` panels with
        their own coloured icon chips. Same information, one component, and it themes.

        ⚠️ Four tiles became three. The old set was Total / Published / Draft / Categories,
        but Published and Draft are complements of Total — three numbers carrying two facts.
        "Published" now states the split in its own description, and the freed slot shows
        how many rows the current filters are actually returning, which the page never
        surfaced despite having filters.
      */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatsCard
          title="Total Domains"
          value={stats.totalDomains}
          icon={Globe}
          description={`${stats.categoriesUsed} categories in use`}
        />
        <StatsCard
          title="Published"
          value={stats.publishedDomains}
          icon={CheckCircle2}
          /*
            ⚠️ Mentions upcoming only when there ARE any. With three states the old
            "N still draft" no longer accounts for every non-published domain, and a permanent
            "0 upcoming" would be noise on a site that may never use the state.
          */
          description={
            stats.upcomingDomains > 0
              ? `${stats.draftDomains} draft · ${stats.upcomingDomains} upcoming`
              : `${stats.draftDomains} still draft`
          }
        />
        <StatsCard
          title="Showing"
          value={domains.length}
          icon={Filter}
          description={
            domains.length === stats.totalDomains
              ? 'No filters applied'
              : 'Filtered by your search'
          }
        />
      </div>

      {/*
        Filters. The old version wrapped these in a card with its own "Filter & Search
        Domains" heading and a subtitle explaining that filters filter things — three lines
        of chrome above one row of controls.
      */}
      <Card>
        <CardContent>
          <DomainFilters
            categories={categories}
            currentFilters={awaitedSearchParams}
          />
        </CardContent>
      </Card>

      {/*
        The list.

        ⚠️ TWO DEAD BUTTONS REMOVED from this header: "📥 Export" and "🔄 Bulk Actions", both
        with no `onClick` and no link — the same dead-control pattern as #22.5. "Bulk
        Actions" was the worse of the two, since it implies row selection that does not
        exist anywhere in this table. Removed rather than stubbed, on request.
      */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle className="text-base">All domains</CardTitle>
          <CardDescription>Manage and edit your content domains.</CardDescription>
        </CardHeader>
        {/*
          No `CardContent` padding wrapper — the table draws its own edge-to-edge rows, and
          padding here would inset them from the card border.
        */}
        <DomainsTable domains={domains} categories={categories} />
      </Card>

      {/*
        Best-practice tips, now COLLAPSED by default (kept, per request).

        They were a permanently-open green panel of five static tips about naming and slugs
        — advice you read once and then scroll past on every subsequent visit. As a
        `Collapsible` the guidance stays available without occupying the screen forever.

        `defaultOpen={false}` is explicit rather than relying on the default, because it is
        the whole point of the change.
      */}
      <Collapsible defaultOpen={false}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Lightbulb className="size-4" aria-hidden="true" />
            Domain management tips
            <ChevronDown className="size-4 transition-transform [[data-state=open]_&]:rotate-180" aria-hidden="true" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-2">
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">Clear names:</strong> use descriptive
                  domain names that indicate the content focus.
                </li>
                <li>
                  <strong className="text-foreground">Categories:</strong> assign every domain
                  to a category so it appears in the right place in navigation.
                </li>
                <li>
                  <strong className="text-foreground">Page types:</strong> "Direct" for content
                  domains, "Hierarchical" for ones that hold subcategories.
                </li>
                <li>
                  <strong className="text-foreground">Slugs:</strong> keep them short and
                  descriptive — they become the public URL and are awkward to change later.
                </li>
              </ul>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}

/**
 * Fetch Domains with Filters Applied
 * 
 * Retrieves domains based on search and filter parameters
 * Includes category information and statistics
 */
async function fetchDomainsWithFilters(searchParams: SearchParams) {
  try {
    // Build filter conditions
    const whereConditions: any = {};
    
    // Search filter
    if (searchParams.search) {
      whereConditions.OR = [
        { name: { contains: searchParams.search, mode: 'insensitive' } },
        { slug: { contains: searchParams.search, mode: 'insensitive' } }
      ];
    }
    
    // Category filter
    if (searchParams.category) {
      whereConditions.categoryId = searchParams.category;
    }
    
    /*
      Status filter — the URL keeps its lowercase vocabulary (`?status=published`) and maps to
      the enum through the shared table, so this page and `GET /api/admin/domains` cannot
      interpret the same query string differently.
    */
    if (searchParams.status && STATUS_BY_URL_PARAM[searchParams.status]) {
      whereConditions.status = STATUS_BY_URL_PARAM[searchParams.status];
    }
    
    // Page type filter
    if (searchParams.pageType) {
      whereConditions.pageType = searchParams.pageType;
    }

    // Fetch domains with category information
    const domains = await prisma.domain.findMany({
      where: whereConditions,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
            columnPosition: true
          }
        },
        _count: {
          select: {
            pages: true
          }
        }
      },
      orderBy: [
        { category: { columnPosition: 'asc' } },
        { orderInCategory: 'asc' },
        { name: 'asc' }
      ]
    });

    // Fetch available categories
    const categories = await prisma.domainCategory.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        columnPosition: true
      },
      orderBy: [
        { columnPosition: 'asc' },
        { categoryOrder: 'asc' }
      ]
    });

    // Calculate statistics
    /*
      ⚠️ `draftDomains` used to be `!d.isPublished` — "everything that is not live". With three
      states that would silently count UPCOMING domains as drafts, so the stat would say
      "3 drafts" when one of them is deliberately advertised on the homepage. Each status is
      now counted for what it is.
    */
    const stats = {
      totalDomains: domains.length,
      publishedDomains: domains.filter(d => d.status === 'PUBLISHED').length,
      draftDomains: domains.filter(d => d.status === 'DRAFT').length,
      upcomingDomains: domains.filter(d => d.status === 'UPCOMING').length,
      categoriesUsed: new Set(domains.map(d => d.categoryId)).size
    };

    // Transform domains for easier use in components
    const transformedDomains = domains.map(domain => ({
      id: domain.id,
      name: domain.name,
      slug: domain.slug,
      pageType: domain.pageType,
      status: domain.status,
      icon: domain.icon,
      isPublished: domain.isPublished,
      orderInCategory: domain.orderInCategory,
      targetCountries: domain.targetCountries,
      createdAt: domain.createdAt,
      category: domain.category,
      pageCount: domain._count.pages,
      // Generate preview URL
      previewUrl: `/domain/${domain.slug}`
    }));

    return {
      domains: transformedDomains,
      categories,
      stats
    };

  } catch (error) {
    console.error('Error fetching domains:', error);
    
    return {
      domains: [],
      categories: [],
      stats: {
        totalDomains: 0,
        publishedDomains: 0,
        draftDomains: 0,
        // Must mirror the success-path shape exactly, or the two branches give the returned
        // `stats` a union type and every field the fallback omits becomes unreadable.
        upcomingDomains: 0,
        categoriesUsed: 0
      }
    };
  }
}
