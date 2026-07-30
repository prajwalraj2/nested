// src/app/admin/tables/page.tsx

import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { TablesManager } from '@/components/admin/tables/TablesManager';
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

    const totalDomains = domains.filter(domain => domain.pages.length > 0).length;

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
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          📊 Table Management
        </h1>
        <p className="text-gray-600 mt-2">
          Create, manage, and configure dynamic data tables for your domains.
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          title="Total Tables"
          value={stats.totalTables}
          icon="📊"
          description="Data tables created"
        />
        <StatsCard
          title="Total Rows"
          value={stats.totalRows.toLocaleString()}
          icon="📄"
          description="Rows across all tables"
        />
        <StatsCard
          title="Active Domains"
          value={stats.totalDomains}
          icon="🌐"
          description="Domains with tables"
        />
        <StatsCard
          title="Recent Updates"
          value={stats.recentActivity.length}
          icon="🔄"
          description="Tables updated recently"
        />
      </div>

      {/* Main Tables Management Interface */}
      <Suspense fallback={<TablesManagerSkeleton />}>
        <TablesManager 
          tables={tables} 
          domains={domains} 
          stats={stats}
        />
      </Suspense>

    </div>
  );
}

/**
 * Statistics Card Component
 * Shows key metrics about the table system
 */
type StatsCardProps = {
  title: string;
  value: string | number;
  icon: string;
  description: string;
};

function StatsCard({ title, value, icon, description }: StatsCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center">
        <div className="text-2xl mr-3">{icon}</div>
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading skeleton for the tables manager
 */
function TablesManagerSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    </div>
  );
}
