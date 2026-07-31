import { Globe, FileText, Blocks, FolderTree, Zap, Activity, History } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminPageHeader } from '@/components/admin/layout/AdminPageHeader';
import { StatsCard } from '@/components/admin/dashboard/StatsCard';
import { QuickActions } from '@/components/admin/dashboard/QuickActions';
import { ActivityFeed, type ActivityEntry } from '@/components/admin/dashboard/ActivityFeed';
import { HealthCheck } from '@/components/admin/dashboard/HealthCheck';

/**
 * ⚠️ DO NOT REMOVE — THIS FIXES A REAL, USER-REPORTED BUG (finding #20)
 * ============================================================================
 *
 * THE SYMPTOM
 * -----------
 * "When I change/update/create — some things do happen on the live website. But so many
 * things don't show up in the Admin UI." Create a domain, and the public site updates
 * while the dashboard counts, the tables list and the New Table dropdown keep showing the
 * old data — until the next deploy.
 *
 * THE CAUSE
 * ---------
 * Next 15 renders a page STATICALLY when it touches no dynamic API — no `cookies()`, no
 * `headers()`, no `searchParams`. This page has none of those; it just calls Prisma
 * directly. So Next ran these queries **once at build time**, baked the numbers into HTML,
 * and shipped `.next/server/app/admin.html` as a real file on disk. Every visit served
 * that file. `initialRevalidateSeconds` was `false`, meaning no ISR either — it could
 * never refresh.
 *
 * Note this is the OPPOSITE trade-off from the public pages. There, static rendering is
 * the goal (see #8-DR) because 1,198 pages × crawler traffic makes it genuinely valuable.
 * Here the audience is a handful of admins and the data must be correct, so one function
 * invocation and one query per view is obviously the right price.
 *
 * WHY `revalidateTag` COULD NOT HAVE FIXED IT
 * ------------------------------------------
 * All the invalidation work in #5 and #18 clears the **Data Cache** (`unstable_cache`
 * entries). This page does not use `unstable_cache` — it calls Prisma directly — so no tag
 * is associated with it and there is nothing for `revalidateTag` to clear. Every
 * `invalidatePages()` call in the codebase is powerless against a statically prerendered
 * page. That is exactly why all that earlier work never made the admin panel any fresher.
 *
 * WHY THE OTHER ADMIN SCREENS DIFFER
 * ----------------------------------
 * `/admin/domains` and `/admin/pages` were already live, but only **by accident** — they
 * accept `searchParams`, which forces dynamic rendering. If a refactor ever drops that
 * prop they will silently freeze too, and this comment is the explanation to reach for.
 *
 * `/admin/users`, `/admin/users/new` and `/admin/rich-text` are also statically rendered
 * and are deliberately left that way: they fetch through `useEffect` + `fetch('/api/…')`
 * on the client, so their data is already live and a static shell costs nothing. Being
 * static is not the bug — being static **while reading the database during render** is.
 */
export const dynamic = 'force-dynamic';

/**
 * Admin Dashboard Page
 * 
 * Main landing page for the admin panel that provides:
 * - System statistics and overview
 * - Quick action buttons for common tasks
 * - Recent activity feed
 * - Health checks and system status
 * 
 * Layout:
 * ┌─ Stats Cards Row ────────────────────────────────────┐
 * │ [Domains] [Pages] [Content Blocks] [Categories]      │
 * └──────────────────────────────────────────────────────┘
 * ┌─ Quick Actions ──┬─ Health Checks ──────────────────┐
 * │ + New Domain     │ ✅ All systems operational       │
 * │ + New Page       │ ⚠️ 3 pages missing content       │
 * │ + New Category   │ 🔗 All links working             │
 * └──────────────────┴───────────────────────────────────┘
 * ┌─ Recent Activity ────────────────────────────────────┐
 * │ • Created "YouTube Channels" page                    │
 * │ • Updated "Web Development" domain                   │
 * │ • Added content blocks to "Design Software"         │
 * └──────────────────────────────────────────────────────┘
 */

export default async function AdminDashboard() {
  // Both in parallel — they are independent, and the activity query is small.
  const [stats, activities] = await Promise.all([
    fetchDashboardStats(),
    fetchRecentActivity(),
  ]);
  
  return (
    <>
      {/*
        The "Welcome to Your Admin Dashboard! 👋" gradient banner was removed.

        It occupied the most valuable space on the screen to say nothing actionable — the
        person reading it is already signed into the admin panel, so being welcomed and
        told it manages domains and pages is a sentence they never need again after the
        first visit. Its `from-blue-50 to-indigo-50` gradient was also hardcoded light and
        broke in dark mode. The stats now start at the top, where the value is.
      */}
      <AdminPageHeader
        title="Dashboard"
        description="An overview of your content and recent activity."
      />

      {/*
        Stat tiles. `sm:grid-cols-2` before `lg:grid-cols-4` so they pair up on a tablet
        rather than jumping straight from one column to four — the old breakpoints skipped
        that middle case.
      */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Domains"
          value={stats.totalDomains}
          icon={Globe}
          description={`${stats.publishedDomains} published`}
          trend={stats.domainsGrowth}
        />
        <StatsCard
          title="Total Pages"
          value={stats.totalPages}
          icon={FileText}
          description={`${stats.pagesWithContent} with content`}
          trend={stats.pagesGrowth}
        />
        <StatsCard
          title="Content Blocks"
          value={stats.totalContentBlocks}
          icon={Blocks}
          description={`Across ${stats.totalPages} pages`}
          trend={stats.contentGrowth}
        />
        <StatsCard
          title="Categories"
          value={stats.totalCategories}
          icon={FolderTree}
          description="Domain categories"
          trend={null} // Categories don't change often
        />
      </div>

      {/*
        Two columns on large screens. The hand-rolled
        `bg-white rounded-lg border border-gray-200 p-6` wrappers are gone — each panel is
        now a real `Card`, so the surface, border and radius all come from the theme
        instead of three fixed classes repeated per panel.
      */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="size-4 text-muted-foreground" aria-hidden="true" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <QuickActions />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="size-4 text-muted-foreground" aria-hidden="true" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <HealthCheck stats={stats} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4 text-muted-foreground" aria-hidden="true" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed activities={activities} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/**
 * Real recent activity, replacing the `DEMO_ACTIVITIES` array the feed used to render
 * (Phase G-2).
 *
 * ⚠️ Three small queries rather than one, because there is no shared table to sort across
 * — `Domain`, `Page` and `Table` are separate models. Each is `take: 5`, so the cost is
 * bounded at 15 rows regardless of catalogue size; they are merged and re-sorted in memory
 * and the top 6 kept.
 *
 * Deliberately narrow `select`s: this needs a title, a timestamp and enough to build a
 * link. Using `include` here would repeat #22.1, where the tables screen pulled 2.45 MB of
 * JSON to render a list.
 *
 * ⚠️ `updatedAt` exists on all three only because of #3/5b. Before that migration this
 * panel could not have shown anything true, which is very likely why it shipped stubbed.
 */
async function fetchRecentActivity(): Promise<ActivityEntry[]> {
  try {
    const [domains, pages, tables] = await Promise.all([
      prisma.domain.findMany({
        select: { id: true, name: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      prisma.page.findMany({
        // `__main__` is a synthetic root with no admin screen of its own, so surfacing it
        // in a feed of clickable changes would produce entries that go nowhere useful.
        where: { slug: { not: '__main__' } },
        select: {
          id: true,
          title: true,
          updatedAt: true,
          domain: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      prisma.table.findMany({
        select: {
          id: true,
          name: true,
          updatedAt: true,
          page: { select: { domain: { select: { name: true } } } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
    ]);

    const entries: ActivityEntry[] = [
      ...domains.map(d => ({
        id: d.id,
        kind: 'domain' as const,
        title: d.name,
        context: null,
        timestamp: d.updatedAt.toISOString(),
        href: '/admin/domains',
      })),
      ...pages.map(p => ({
        id: p.id,
        kind: 'page' as const,
        title: p.title,
        context: p.domain?.name ?? null,
        timestamp: p.updatedAt.toISOString(),
        href: '/admin/pages',
      })),
      ...tables.map(t => ({
        id: t.id,
        kind: 'table' as const,
        title: t.name,
        context: t.page?.domain?.name ?? null,
        timestamp: t.updatedAt.toISOString(),
        // Tables are the one kind with a real detail route to link to.
        href: `/admin/tables/${t.id}`,
      })),
    ];

    return entries
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 6);
  } catch (error) {
    // An empty feed is honest; a crashed dashboard is not. Matches how
    // `fetchDashboardStats` below degrades.
    console.error('Error fetching recent activity:', error);
    return [];
  }
}

/**
 * Fetch Dashboard Statistics
 *
 * Gathers all the data needed for dashboard display:
 * - Counts of domains, pages, content blocks, categories
 * - Health check information
 * - Growth trends (can be enhanced later)
 */
async function fetchDashboardStats() {
  try {
    // Run all database queries in parallel for better performance
    const [
      domains,
      pages, 
      contentBlocks,
      categories
    ] = await Promise.all([
      // Get all domains with their published status
      prisma.domain.findMany({
        select: {
          id: true,
          isPublished: true,
          createdAt: true
        }
      }),
      
      // Get all pages with their content blocks
      prisma.page.findMany({
        select: {
          id: true,
          createdAt: true,
          content: {
            select: {
              id: true
            }
          }
        }
      }),
      
      // Get total content blocks count
      prisma.contentBlock.count(),
      
      // Get all categories
      prisma.domainCategory.findMany({
        select: {
          id: true,
          createdAt: true
        }
      })
    ]);

    // Calculate derived statistics
    const totalDomains = domains.length;
    const publishedDomains = domains.filter(d => d.isPublished).length;
    const totalPages = pages.length;
    const pagesWithContent = pages.filter(p => p.content.length > 0).length;
    const totalCategories = categories.length;
    
    // Calculate simple growth trends (can be enhanced with time-based analysis)
    const domainsGrowth = calculateGrowthTrend(domains.map(d => d.createdAt));
    const pagesGrowth = calculateGrowthTrend(pages.map(p => p.createdAt));
    
    return {
      // Basic counts
      totalDomains,
      publishedDomains,
      totalPages,
      pagesWithContent,
      totalContentBlocks: contentBlocks,
      totalCategories,
      
      // Health metrics
      unpublishedDomains: totalDomains - publishedDomains,
      pagesWithoutContent: totalPages - pagesWithContent,
      
      // Growth trends 
      domainsGrowth,
      pagesGrowth,
      contentGrowth: contentBlocks > 0 ? '+12%' : null // Placeholder - enhance later
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    
    // Return safe defaults if database query fails
    return {
      totalDomains: 0,
      publishedDomains: 0,
      totalPages: 0,
      pagesWithContent: 0,
      totalContentBlocks: 0,
      totalCategories: 0,
      unpublishedDomains: 0,
      pagesWithoutContent: 0,
      domainsGrowth: null,
      pagesGrowth: null,
      contentGrowth: null
    };
  }
}

/**
 * Calculate Growth Trend
 * 
 * Simple growth calculation based on creation dates
 * Can be enhanced later with more sophisticated analytics
 */
function calculateGrowthTrend(dates: Date[]): string | null {
  if (dates.length === 0) return null;
  
  // Simple trend: if we have recent additions (last 30 days), show positive growth
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentAdditions = dates.filter(date => date > thirtyDaysAgo).length;
  
  if (recentAdditions > 0) {
    return `+${Math.round((recentAdditions / dates.length) * 100)}%`;
  }
  
  return null;
}
