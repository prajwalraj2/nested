// src/app/admin/tables/[id]/page.tsx

import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { TableEditor } from '@/components/admin/tables/TableEditor';

/**
 * Admin Table Edit Page
 * 
 * Provides comprehensive table management interface:
 * - View table details and statistics
 * - Edit table schema (columns, types, settings)
 * - Manage table data (add, edit, delete rows)
 * - Upload/import CSV data
 * - Export table data
 * - Configure table settings
 * 
 * URL: /admin/tables/[id]
 */

type PageProps = {
  params: Promise<{ id: string }>;
};

async function getTableData(tableId: string) {
  try {
    const table = await prisma.table.findUnique({
      where: { id: tableId },
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
      }
    });

    if (!table) {
      return null;
    }

    return table;
  } catch (error) {
    console.error('Error fetching table data:', error);
    return null;
  }
}

export default async function TableEditPage({ params }: PageProps) {
  const awaitedParams = await params;
  const tableId = awaitedParams.id;

  const table = await getTableData(tableId);

  if (!table) {
    notFound();
  }

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              📊 {table.name}
            </h1>
            <p className="text-gray-600 mt-2">
              Manage table schema, data, and settings for "{table.page.title}" page.
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Quick Actions */}
            <a
              href={`/domain/${table.page.domain.slug}/${table.page.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              👁️ View Live Table
            </a>
          </div>
        </div>
        
        {/* Breadcrumb */}
        <div className="flex items-center space-x-2 text-sm text-gray-500 mt-3">
          <span>🌐 {table.page.domain.name}</span>
          <span>/</span>
          <span>📄 {table.page.title}</span>
          <span>/</span>
          <span className="text-gray-900 font-medium">📊 {table.name}</span>
        </div>
      </div>

      {/* Table Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          title="Total Rows"
          value={(table.data as any)?.rows?.length || 0}
          icon="📄"
          description="Data rows in table"
        />
        <StatsCard
          title="Columns"
          value={(table.schema as any)?.columns?.length || 0}
          icon="📋"
          description="Table columns defined"
        />
        <StatsCard
          title="Last Updated"
          value={table.updatedAt.toLocaleDateString()}
          icon="🔄"
          description="Last modification date"
        />
        <StatsCard
          title="Schema Version"
          value={(table.schema as any)?.version || 1}
          icon="🏷️"
          description="Current schema version"
        />
      </div>

      {/* Main Table Editor */}
      <TableEditor table={table} />

    </div>
  );
}

/**
 * Statistics Card Component
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
