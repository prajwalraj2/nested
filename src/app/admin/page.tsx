import { prisma } from '@/lib/prisma';
import { StatsCard } from '@/components/admin/dashboard/StatsCard';
import { QuickActions } from '@/components/admin/dashboard/QuickActions';
import { ActivityFeed } from '@/components/admin/dashboard/ActivityFeed';
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
  // Fetch all the statistics we need for the dashboard
  const stats = await fetchDashboardStats();
  
  return (
    <div className="space-y-8">
      
      {/* Page Introduction */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Welcome to Your Admin Dashboard! 👋
        </h2>
        <p className="text-gray-600">
          Manage your domains, pages, and content all in one place. 
          Get insights into your content system and perform quick actions.
        </p>
      </div>

      {/* Statistics Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Domains"
          value={stats.totalDomains}
          icon="🌐"
          description={`${stats.publishedDomains} published`}
          trend={stats.domainsGrowth}
        />
        
        <StatsCard
          title="Total Pages"
          value={stats.totalPages}
          icon="📄"
          description={`${stats.pagesWithContent} with content`}
          trend={stats.pagesGrowth}
        />
        
        <StatsCard
          title="Content Blocks"
          value={stats.totalContentBlocks}
          icon="📝"
          description={`Across ${stats.totalPages} pages`}
          trend={stats.contentGrowth}
        />
        
        <StatsCard
          title="Categories"
          value={stats.totalCategories}
          icon="📂"
          description="Domain categories"
          trend={null} // Categories don't change often
        />
      </div>

      {/* Main Dashboard Content Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
            {/* Left Column: Quick Actions */}
            <div className="space-y-6">
            
            {/* Quick Actions Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                ⚡ Quick Actions
                </h3>
                <QuickActions />
            </div>
            
            {/* Health Check Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                🔍 System Health
                </h3>
                <HealthCheck stats={stats} />
            </div>
            
            </div>

            {/* Right Column: Activity Feed */}
            <div className="space-y-6">
            
            {/* Recent Activity Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                📈 Recent Activity
                </h3>
                <ActivityFeed />
            </div>
            
            </div>
        
      </div>
      
    </div>
  );
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
