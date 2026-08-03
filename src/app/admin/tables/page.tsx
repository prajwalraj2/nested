// src/app/admin/tables/page.tsx

import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { TablesManager } from '@/components/admin/tables/TablesManager';
import Link from 'next/link';
import { Globe, Plus, Rows3, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminPageHeader } from '@/components/admin/layout/AdminPageHeader';
import { StatsCard } from '@/components/admin/dashboard/StatsCard';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { TableStats } from '@/types/table';

/**
 * ⚠️ DO NOT REMOVE — finding #20. This page calls `prisma.table.findMany` and
 * `prisma.domain.findMany` during render and uses no dynamic API, so Next 15 would
 * prerender it at BUILD time and serve frozen HTML — a table created or deleted after the
 * last deploy would not show up here at all. This is one of the screens the reported
 * symptom ("changes don't show up in the Admin UI") was actually about.
 *
 * `revalidateTag` cannot help — this reads Prisma directly, so nothing is tagged. See the
 * full explanation in src/app/admin/page.tsx.
 */
export const dynamic = 'force-dynamic';

/**
 * Main Tables Management Dashboard
 * 
 * This page provides the interface for managing all data tables in the system.
 * 
 * Features:
 * - Overview of all tables with statistics
 * - Quick actions (create, edit, delete, export)
 * - Domain/page filtering
 * - Table search and sorting
 * - Bulk operations
 * 
 * Workflow:
 * 1. View all existing tables
 * 2. Filter by domain or search
 * 3. Create new tables or edit existing ones
 * 4. Manage table data and settings
 * 5. Export tables in various formats
 */

// Fetch tables and statistics
async function getTablesData() {
  try {
    /**
     * ⚠️ EXPLICIT `select`, NOT `include` — THIS PAGE USED TO SHIP 8.19 MB (finding #22.1)
     * ========================================================================
     * `include` returns EVERY column of the included model. On `Table` that means the
     * whole `data` JSON (all the rows) and the whole `schema` JSON, for all 652 tables.
     * Measured on the development branch:
     *
     *     Table.data   serialised : 1.97 MB
     *     Table.schema serialised : 0.48 MB
     *     loaded twice (see below): 4.90 MB
     *     actual page payload     : 8,592,689 bytes  (RSC escaping inflates it further)
     *
     * ...to render a list showing name, domain, page title, row count and a date —
     * roughly 0.16 MB of information. About 50x more bytes than the page displays.
     *
     * It got worse with #20: this page is now dynamic, so it is rebuilt on every request
     * rather than served as one frozen file. Correct for freshness, but it means the
     * over-fetch ran on every single view.
     *
     * `data` and `schema` were only ever used to derive TWO NUMBERS —
     * `rowCount` and `columnCount` in TablesManager.tsx — which are now computed in the
     * database (see the raw query below) and passed as plain integers. `settings` was
     * declared in the component's prop type and never read at all.
     */
    const tables = await prisma.table.findMany({
      select: {
        id: true,
        name: true,
        pageId: true,
        createdAt: true,
        updatedAt: true,
        page: {
          select: {
            id: true,
            title: true,
            slug: true,
            contentType: true,
            domain: {
              select: {
                id: true,
                name: true,
                slug: true,
              }
            }
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    /**
     * Row and column counts, computed IN POSTGRES so the JSON never crosses the wire.
     *
     * `jsonb_array_length` is the whole point: it returns an integer without serialising
     * the array. Two integers per table instead of ~3.8 KB of JSON each.
     *
     * ⚠️ THE `jsonb_typeof` GUARD IS NOT OPTIONAL. `jsonb_array_length` raises an error if
     * the value is not an array, and a raised error here would fail the entire page rather
     * than one row. Every one of the 652 current rows *is* well-shaped (verified), but
     * `data` is an unvalidated `Json` column — nothing in the schema prevents a future
     * write from putting an object or null there. The `CASE` degrades to 0 instead.
     *
     * Raw SQL because Prisma has no expression API for JSON functions. The identifiers are
     * literal and no user input is interpolated, so there is no injection surface —
     * `$queryRaw` (tagged template) is used rather than `$queryRawUnsafe` regardless.
     */
    const counts = await prisma.$queryRaw<Array<{ id: string; rowCount: number; columnCount: number }>>`
      SELECT
        id,
        CASE WHEN jsonb_typeof(data->'rows') = 'array'
             THEN jsonb_array_length(data->'rows') ELSE 0 END::int      AS "rowCount",
        CASE WHEN jsonb_typeof(schema->'columns') = 'array'
             THEN jsonb_array_length(schema->'columns') ELSE 0 END::int AS "columnCount"
      FROM "Table"
    `;
    const countsById = new Map(counts.map(c => [c.id, c]));

    const tablesWithCounts = tables.map(t => ({
      ...t,
      rowCount: countsById.get(t.id)?.rowCount ?? 0,
      columnCount: countsById.get(t.id)?.columnCount ?? 0,
    }));

    /**
     * Domains that have table-type pages — for the picker.
     *
     * ⚠️ `table: true` here was the SECOND copy of the 2.45 MB: it pulled every column of
     * every table again, for every table-type page across all domains. The picker only
     * needs to know a table exists and its name, which is two columns.
     */
    const domains = await prisma.domain.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        pages: {
          where: {
            contentType: 'table'
          },
          select: {
            id: true,
            title: true,
            slug: true,
            contentType: true,
            table: {
              select: {
                id: true,
                name: true,
              }
            },
            _count: {
              select: {
                content: true
              }
            }
          }
        },
        _count: {
          select: {
            pages: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Calculate statistics
    const totalTables = tablesWithCounts.length;
    // Summed from the integers Postgres already computed — no JSON walked in JS.
    const totalRows = tablesWithCounts.reduce((acc, t) => acc + t.rowCount, 0);

    /**
     * ⚠️ COUNTS DOMAINS THAT ACTUALLY HOLD A TABLE — the label used to lie.
     *
     * This was `domains.filter(d => d.pages.length > 0).length`, and `pages` is already
     * filtered to `contentType: 'table'` — so it counted domains with a table-type **page**,
     * whether or not a table had been created on it. That read **33** while the list's own
     * grouping read **31**: two domains have a table-type page with no table on it yet.
     *
     * Both numbers were correct; the tile's label ("Domains holding tables") described the
     * 31. Now the number matches the label, and matches the domain filter's own list.
     */
    const totalDomains = domains.filter(domain =>
      domain.pages.some(page => page.table)
    ).length;

    // Get recent activity (simplified for now)
    const recentActivity = tablesWithCounts.slice(0, 5).map(table => ({
      action: 'Updated',
      tableName: table.name,
      timestamp: table.updatedAt.toISOString(),
      pageTitle: table.page.title,
      domainName: table.page.domain.name,
    }));

    const stats: TableStats = {
      totalTables,
      totalRows,
      totalDomains,
      recentActivity,
    };

    return {
      tables: tablesWithCounts,
      domains,
      stats
    };
  } catch (error) {
    console.error('Error fetching tables data:', error);
    return {
      tables: [],
      domains: [],
      stats: {
        totalTables: 0,
        totalRows: 0,
        totalDomains: 0,
        recentActivity: [],
      }
    };
  }
}

export default async function TablesManagementPage() {
  const { tables, domains, stats } = await getTablesData();

  return (
    <>
      {/*
        ⚠️ REBUILT IN G-5a — this shell had never been touched by an earlier phase, so it
        painted a `text-gray-900` heading and `bg-white` stat cards straight onto the dark
        theme from #21. Same story as `[id]/page.tsx` in G-5b.

        `AdminPageHeader` (G-2) replaces a hand-rolled `text-3xl` title and `border-b` rule,
        and gives the "New table" action a home — previously the only way to create one was a
        button buried inside `TablesManager`.
      */}
      <AdminPageHeader
        title="Tables"
        description={`${stats.totalTables} tables holding ${stats.totalRows.toLocaleString()} rows.`}
        actions={
          <Button size="sm" asChild>
            <Link href="/admin/tables/new">
              <Plus className="size-4" aria-hidden="true" />
              New table
            </Link>
          </Button>
        }
      />

      {/*
        The shared `StatsCard` from G-2, replacing a local copy in this file that drew its own
        `bg-white` panel and took an emoji string as its icon.

        ⚠️ "Recent Updates" was dropped. It rendered `stats.recentActivity.length`, which is
        `tablesWithCounts.slice(0, 5).length` — i.e. **always 5** for any project with five or
        more tables. A metric that cannot change is not a metric. The recent-activity list
        itself is still shown by `TablesManager`, where the entries are actually useful.
      */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatsCard
          title="Tables"
          value={stats.totalTables}
          icon={Table2}
          description="Data tables created"
        />
        <StatsCard
          title="Rows"
          value={stats.totalRows}
          icon={Rows3}
          description="Across all tables"
        />
        <StatsCard
          title="Domains"
          value={stats.totalDomains}
          icon={Globe}
          description="Domains holding tables"
        />
      </div>

      <Suspense fallback={<TablesManagerSkeleton />}>
        <TablesManager
          tables={tables}
          domains={domains}
          stats={stats}
        />
      </Suspense>
    </>
  );
}


/**
 * Loading skeleton for the tables manager
 */
function TablesManagerSkeleton() {
  return (
    /*
      shadcn's `Skeleton` replaces hand-rolled `bg-gray-200` blocks inside an
      `animate-pulse` wrapper. It carries `bg-accent` and its own pulse, so each bar follows
      the theme instead of staying pale grey on a dark page — the previous version made the
      loading state the brightest thing on screen in dark mode.
    */
    <Card className="p-6">
      <Skeleton className="mb-4 h-6 w-1/4" />
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
      <div className="space-y-3">
        {/*
          Keys are the numbers themselves rather than the array index. Both are stable for a
          fixed-length placeholder list, but `key={i}` on a mapped literal invites the habit
          of index keys in lists that DO reorder.
        */}
        {[1, 2, 3, 4, 5].map((row) => (
          <Skeleton key={row} className="h-16" />
        ))}
      </div>
    </Card>
  );
}
