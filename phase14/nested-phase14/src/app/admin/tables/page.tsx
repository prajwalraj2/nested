// src/app/admin/tables/page.tsx

import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { TablesManager } from '@/components/admin/tables/TablesManager';
import type { TableStats } from '@/types/table';

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
    // Get all tables with their page and domain information
    const tables = await prisma.table.findMany({
      include: {
        page: {
          include: {
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

    // Get domains that have table-type pages
    const domains = await prisma.domain.findMany({
      include: {
        pages: {
          where: {
            contentType: 'table'
          },
          include: {
            table: true,
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
    const totalTables = tables.length;
    const totalRows = tables.reduce((acc, table) => {
      if (table.data && typeof table.data === 'object' && 'rows' in table.data) {
        return acc + (table.data.rows as any[]).length;
      }
      return acc;
    }, 0);
    
    const totalDomains = domains.filter(domain => domain.pages.length > 0).length;
    
    // Get recent activity (simplified for now)
    const recentActivity = tables.slice(0, 5).map(table => ({
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
      tables,
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
