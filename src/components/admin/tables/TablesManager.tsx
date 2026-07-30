// src/components/admin/tables/TablesManager.tsx

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TableStats } from '@/types/table';
// Finding #22.5 — the same export implementation the table editor uses.
import { downloadTableExport, type TableExportFormat } from '@/lib/export-table';

/**
 * Main Tables Manager Component
 * 
 * Provides the complete interface for managing tables:
 * - Overview dashboard with stats
 * - Table listing with search and filters
 * - Quick actions (create, edit, delete, export)
 * - Recent activity feed
 * - Domain-based filtering
 */

// Type definitions for better TypeScript support
type Domain = {
  id: string;
  name: string;
  slug: string;
  pages: Array<{
    id: string;
    title: string;
    slug: string;
    contentType: string;
    table?: {
      id: string;
      name: string;
    } | null;
  }>;
  _count: {
    pages: number;
  };
};

type TableWithPage = {
  id: string;
  name: string;
  pageId: string;
  /**
   * ⚠️ `schema`, `data` and `settings` were REMOVED from this type deliberately
   * (finding #22.1).
   *
   * They were only ever used to derive the two counts below, but declaring them meant the
   * server sent the complete contents of all 652 tables to the browser — 2.45 MB of JSON,
   * loaded twice by the page's two queries, producing an **8.19 MB** payload to render a
   * list that displays about 0.16 MB of information.
   *
   * The counts are now computed in Postgres with `jsonb_array_length` and arrive as plain
   * integers. `settings` was declared here and never read at all.
   *
   * **Do not add them back to render "N rows".** That is what these two fields are for. If a
   * future feature genuinely needs the row data, fetch it for the ONE table being viewed —
   * `/admin/tables/[id]` already does exactly that.
   */
  rowCount: number;
  columnCount: number;
  createdAt: Date;
  updatedAt: Date;
  page: {
    id: string;
    title: string;
    slug: string;
    contentType: string;
    domain: {
      id: string;
      name: string;
      slug: string;
    };
  };
};

type TablesManagerProps = {
  tables: TableWithPage[];
  domains: Domain[];
  stats: TableStats;
};

export function TablesManager({ tables, domains, stats }: TablesManagerProps) {
  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Filter tables based on search and domain
  const filteredTables = tables.filter(table => {
    const matchesSearch = searchTerm === '' || 
      table.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      table.page.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      table.page.domain.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDomain = selectedDomain === 'all' || 
      table.page.domain.id === selectedDomain;
    
    return matchesSearch && matchesDomain;
  });

  // Get domains that have tables
  const domainsWithTables = domains.filter(domain => 
    domain.pages.some(page => page.table)
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Tables Dashboard
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage your data tables and configure their schemas.
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button asChild>
              <Link href="/admin/tables/new">
                ➕ Create Table
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        
        <Tabs defaultValue="tables" className="space-y-6">
          
          {/* Tab Navigation */}
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tables">
              📊 All Tables ({tables.length})
            </TabsTrigger>
            <TabsTrigger value="domains">
              🌐 By Domain ({domainsWithTables.length})
            </TabsTrigger>
            <TabsTrigger value="activity">
              🔄 Recent Activity
            </TabsTrigger>
          </TabsList>

          {/* Tables Tab */}
          <TabsContent value="tables" className="space-y-4">
            
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search tables, pages, or domains..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              
              <div className="flex gap-2">
                <select
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Domains</option>
                  {domainsWithTables.map(domain => (
                    <option key={domain.id} value={domain.id}>
                      {domain.name}
                    </option>
                  ))}
                </select>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      {viewMode === 'list' ? '📄' : '🔲'} View
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setViewMode('list')}>
                      📄 List View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setViewMode('grid')}>
                      🔲 Grid View
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Tables List */}
            {filteredTables.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm || selectedDomain !== 'all' 
                    ? 'No Tables Found' 
                    : 'No Tables Created Yet'
                  }
                </h3>
                <p className="text-gray-600 mb-4">
                  {searchTerm || selectedDomain !== 'all'
                    ? 'Try adjusting your search or filter criteria.'
                    : 'Create your first data table to get started.'
                  }
                </p>
                {(!searchTerm && selectedDomain === 'all') && (
                  <Button asChild>
                    <Link href="/admin/tables/new">
                      Create Your First Table
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className={viewMode === 'grid' 
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' 
                : 'space-y-3'
              }>
                {filteredTables.map(table => (
                  <TableCard 
                    key={table.id} 
                    table={table} 
                    viewMode={viewMode}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Domains Tab */}
          <TabsContent value="domains" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {domainsWithTables.map(domain => (
                <DomainCard key={domain.id} domain={domain} />
              ))}
            </div>
            
            {domainsWithTables.length === 0 && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🌐</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Domains with Tables
                </h3>
                <p className="text-gray-600">
                  Create some tables first to see domain statistics.
                </p>
              </div>
            )}
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-4">
            <div className="space-y-3">
              {stats.recentActivity.map((activity, index) => (
                <ActivityItem key={index} activity={activity} />
              ))}
            </div>
            
            {stats.recentActivity.length === 0 && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🔄</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Recent Activity
                </h3>
                <p className="text-gray-600">
                  Table activities will appear here once you start managing tables.
                </p>
              </div>
            )}
          </TabsContent>

        </Tabs>

      </div>
    </div>
  );
}

/**
 * Individual Table Card Component
 */
type TableCardProps = {
  table: TableWithPage;
  viewMode: 'list' | 'grid';
};

function TableCard({ table, viewMode }: TableCardProps) {
  /**
   * Counts arrive pre-computed from the database (finding #22.1).
   *
   * These two lines used to walk `table.data.rows` and `table.schema.columns` in the
   * browser, which is why the whole of both JSON columns had to be shipped for all 652
   * tables — 8.19 MB to display two numbers per card. Postgres now counts them with
   * `jsonb_array_length` and sends integers. See src/app/admin/tables/page.tsx.
   */
  const { rowCount, columnCount } = table;

  /**
   * Export state is per-card, not shared across the list (finding #22.5).
   *
   * A single `isExporting` flag on the parent would disable the menu item on all 652
   * cards while one table downloaded. Each card owning its own flag means only the row
   * being exported shows as busy, which is also what makes the `disabled` prop honest.
   */
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: TableExportFormat) => {
    setIsExporting(true);
    // Same shared implementation the editor uses — see src/lib/export-table.ts.
    const result = await downloadTableExport(table.id, table.page.slug, format);
    if (!result.ok) {
      // `alert()` matches the rest of this screen; replacing it is #22.6 (Phase G).
      alert(result.message);
    }
    setIsExporting(false);
  };

  if (viewMode === 'grid') {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{table.name}</CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">⋮</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {/*
                  ⚠️ There used to be TWO items here — "Edit" and "Manage Data" — pointing at
                  the SAME url, so one of them was pure noise (finding #22.3). In the list
                  view below they differed, and the "Manage Data" one pointed at
                  `/admin/tables/[id]/data`, which **does not exist as a page** — only as an
                  API route — so it 404'd.

                  Both menus now offer one link to the editor. `/admin/tables/[id]` opens on
                  its Data tab by default, which is what "Manage Data" was reaching for.
                */}
                <DropdownMenuItem asChild>
                  <Link href={`/admin/tables/${table.id}`}>
                    📊 Open table
                  </Link>
                </DropdownMenuItem>
                {/*
                  These two replace a single dead "📤 Export" item that had no `onClick`,
                  no `asChild` and no link — it rendered, was clickable, and did nothing
                  (finding #22.5). Split by format because the endpoint supports both and
                  the editor already offers both; making the list ask "which format?" via a
                  submenu would be more clicks for no benefit.
                */}
                <DropdownMenuItem onClick={() => handleExport('csv')} disabled={isExporting}>
                  📄 Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('json')} disabled={isExporting}>
                  📋 Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              📄 {table.page.title}
            </p>
            <p className="text-sm text-gray-500">
              🌐 {table.page.domain.name}
            </p>
            <div className="flex justify-between text-sm">
              <span>{rowCount} rows</span>
              <span>{columnCount} columns</span>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary" className="text-xs">
                {table.page.contentType}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
      <div className="flex-1">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">📊</div>
          <div>
            <h3 className="font-medium text-gray-900">{table.name}</h3>
            <p className="text-sm text-gray-600">
              📄 {table.page.title} • 🌐 {table.page.domain.name}
            </p>
            <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
              <span>{rowCount} rows</span>
              <span>{columnCount} columns</span>
              <span>Updated {new Date(table.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <Badge variant="secondary" className="text-xs">
          {table.page.contentType}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">⋮</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {/*
              ⚠️ This menu's "Manage Data" item linked to `/admin/tables/${table.id}/data`,
              which **404s** — that path exists only as an API route
              (`src/app/api/admin/tables/[id]/data/route.ts`), never as a page. Finding
              #22.3. Same single link as the grid menu above now.
            */}
            <DropdownMenuItem asChild>
              <Link href={`/admin/tables/${table.id}`}>
                📊 Open table
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('csv')} disabled={isExporting}>
              📄 Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('json')} disabled={isExporting}>
              📋 Export as JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/**
 * Domain Card Component
 */
type DomainCardProps = {
  domain: Domain;
};

function DomainCard({ domain }: DomainCardProps) {
  const tablesCount = domain.pages.filter(page => page.table).length;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{domain.name}</span>
          <Badge>{tablesCount} tables</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {domain.pages.filter(page => page.table).map(page => (
            <div key={page.id} className="flex items-center justify-between text-sm">
              <span>📊 {page.table?.name}</span>
              <Link 
                href={`/admin/tables/${page.table?.id}`}
                className="text-blue-600 hover:underline"
              >
                Edit
              </Link>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Activity Item Component
 */
type ActivityItemProps = {
  activity: {
    action: string;
    tableName: string;
    timestamp: string;
    pageTitle?: string;
    domainName?: string;
  };
};

function ActivityItem({ activity }: ActivityItemProps) {
  return (
    <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
      <div className="text-2xl">🔄</div>
      <div className="flex-1">
        <p className="text-sm">
          <span className="font-medium">{activity.action}</span> table{' '}
          <span className="font-medium">{activity.tableName}</span>
          {activity.pageTitle && (
            <span className="text-gray-600"> in {activity.pageTitle}</span>
          )}
        </p>
        <p className="text-xs text-gray-500">
          {new Date(activity.timestamp).toLocaleString()}
          {activity.domainName && ` • ${activity.domainName}`}
        </p>
      </div>
    </div>
  );
}
