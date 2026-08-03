// src/components/admin/tables/TablesManager.tsx

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Database,
  FileDown,
  Globe,
  LayoutGrid,
  List,
  MoreHorizontal,
  RefreshCw,
  Rows3,
  Search,
  Table2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { downloadTableExport, type TableExportFormat } from '@/lib/export-table';
import type { TableStats } from '@/types/table';

/**
 * Tables list (rebuilt in Phase G-5a(ii)).
 * ============================================================================
 *
 * Three views of the same 652 tables: a flat list, grouped by domain, and recent activity.
 *
 * WHAT THE REBUILD FIXED
 * ----------------------
 * 1. ⚠️ **`bg-white rounded-lg border-gray-200` on the outer wrapper.** This was the reason
 *    the tables list still glared in dark mode after the page shell was rebuilt in G-5a(i) —
 *    a white sheet under a themed page.
 *
 * 2. ⚠️ **A DUPLICATE HEADER.** This component rendered its own "Tables Dashboard" heading,
 *    subtitle and "➕ Create Table" button. Since G-5a(i) the page above renders
 *    `AdminPageHeader` with a "New table" action, so the screen had two titles and two create
 *    buttons stacked on each other. The inner one is gone.
 *
 * 3. **A native `<select>`** carrying `border-gray-300 focus:ring-blue-500` → shadcn `Select`.
 *
 * 4. **The view toggle was a dropdown** labelled "📄 View" that opened to offer List or Grid —
 *    two clicks and a menu to flip a binary. Now two icon buttons showing which is active.
 *
 * 5. ⚠️ **`key={index}` on the activity list.** Harmless while the list is static, but it is
 *    the habit that breaks lists which reorder. Keyed on the timestamp + table name now.
 *
 * 6. **`alert()` on a failed export** → an inline message on the card that failed (#22.6).
 *
 * 7. ⚠️ **PAGINATION ADDED — with the effect measured, not guessed.** All 652 tables were
 *    rendered at once: 652 cards, each with its own dropdown menu. This shows 24 at a time.
 *
 *    Measured on a production build of `/admin/tables`, total **1.73 MB → 675 KB**:
 *
 *      rendered HTML    136 KB   <- was ~1.2 MB; only 24 cards now exist in the DOM
 *      RSC flight data  539 KB   <- UNCHANGED; still every one of the 652 tables
 *
 *    So this is a real cut to what the browser parses and renders, but the **data** payload
 *    is untouched, because search and filtering run here in the browser and therefore need
 *    the whole list. Those 539 KB are what G-5a(iii) would remove, by moving filtering and
 *    pagination into the query. **Do not mark #22.1's residual closed on the strength of
 *    this step.**
 *
 * 25 hardcoded colours → 0.
 */

type Domain = {
  id: string;
  name: string;
  slug: string;
  pages: Array<{
    id: string;
    title: string;
    slug: string;
    table: {
      id: string;
      name: string;
    } | null;
  }>;
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

/**
 * ⚠️ Radix `SelectItem` throws on an empty-string value, so "no filter" needs a sentinel.
 * Same trap as `DomainFilters` in G-3c. `'all'` was already the value this component used,
 * and it is non-empty, so it doubles as the sentinel.
 */
const ALL_DOMAINS = 'all';

/** Tables rendered per page. 24 divides evenly by 2, 3 and 4, so no ragged last grid row. */
const PAGE_SIZE = 24;

export function TablesManager({ tables, domains, stats }: TablesManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>(ALL_DOMAINS);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [page, setPage] = useState(1);

  /**
   * `useMemo` because this filters 652 rows and runs on every keystroke. Without it the work
   * repeats on unrelated re-renders too (a view-mode flip, a page change).
   */
  const filteredTables = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return tables.filter((table) => {
      const matchesSearch =
        term === '' ||
        table.name.toLowerCase().includes(term) ||
        table.page.title.toLowerCase().includes(term) ||
        table.page.domain.name.toLowerCase().includes(term);

      const matchesDomain =
        selectedDomain === ALL_DOMAINS || table.page.domain.id === selectedDomain;

      return matchesSearch && matchesDomain;
    });
  }, [tables, searchTerm, selectedDomain]);

  const domainsWithTables = useMemo(
    () => domains.filter((domain) => domain.pages.some((p) => p.table)),
    [domains]
  );

  const totalPages = Math.max(1, Math.ceil(filteredTables.length / PAGE_SIZE));

  /**
   * ⚠️ CLAMPED, NOT JUST READ. If you are on page 20 and then type a search that matches
   * three tables, `page` is still 20 and slicing would return an empty array — a list that
   * looks broken rather than filtered. Clamping renders the last real page instead.
   *
   * Derived rather than corrected in an effect: an effect would flash the empty state for one
   * frame before fixing itself.
   */
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visibleTables = filteredTables.slice(pageStart, pageStart + PAGE_SIZE);

  /** Any filter change sends you back to page 1 — staying on page 7 of a new result set is disorienting. */
  function updateFilter(apply: () => void) {
    apply();
    setPage(1);
  }

  const isFiltered = searchTerm.trim() !== '' || selectedDomain !== ALL_DOMAINS;

  return (
    /*
      A `Card`, replacing `bg-white rounded-lg border border-gray-200` — the single line most
      responsible for this screen looking wrong in dark mode.

      The inner "Tables Dashboard" header and its duplicate "Create Table" button are gone;
      the page above owns both since G-5a(i).
    */
    <Card>
      <CardContent>
        <Tabs defaultValue="tables" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tables">
              <Table2 className="size-4" aria-hidden="true" />
              All tables ({tables.length})
            </TabsTrigger>
            <TabsTrigger value="domains">
              <Globe className="size-4" aria-hidden="true" />
              By domain ({domainsWithTables.length})
            </TabsTrigger>
            <TabsTrigger value="activity">
              <RefreshCw className="size-4" aria-hidden="true" />
              Recent activity
            </TabsTrigger>
          </TabsList>

          {/* ── All tables ── */}
          <TabsContent value="tables" className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                  aria-hidden="true"
                />
                <Input
                  value={searchTerm}
                  onChange={(event) => updateFilter(() => setSearchTerm(event.target.value))}
                  placeholder="Search tables, pages or domains…"
                  className="pl-9"
                  aria-label="Search tables"
                />
              </div>

              <Select
                value={selectedDomain}
                onValueChange={(value) => updateFilter(() => setSelectedDomain(value))}
              >
                {/* `w-full sm:w-56` — SelectTrigger ships as `w-fit`, which would size to the
                    longest domain name and jump around as the filter changes. */}
                <SelectTrigger className="w-full sm:w-56" aria-label="Filter by domain">
                  {/*
                    Explicit children so the label is server-renderable and correct before
                    hydration — Radix otherwise resolves it from Portal-mounted items. Same
                    fix as `DomainFilters` in G-3c.
                  */}
                  <SelectValue>
                    {selectedDomain === ALL_DOMAINS
                      ? 'All domains'
                      : (domainsWithTables.find((d) => d.id === selectedDomain)?.name ??
                        'All domains')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_DOMAINS}>All domains</SelectItem>
                  {domainsWithTables.map((domain) => (
                    <SelectItem key={domain.id} value={domain.id}>
                      {domain.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/*
                Two buttons instead of a dropdown. The old control was a menu labelled
                "📄 View" that had to be opened to flip a binary — and it never showed which
                mode was active except by its own icon, which most people would not read as
                state. `aria-pressed` is what makes these announce as a toggle pair.
              */}
              <div className="flex gap-1">
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  aria-pressed={viewMode === 'list'}
                  aria-label="List view"
                  onClick={() => setViewMode('list')}
                >
                  <List className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="icon"
                  aria-pressed={viewMode === 'grid'}
                  aria-label="Grid view"
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>

            {filteredTables.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Database className="text-muted-foreground size-8" aria-hidden="true" />
                <p className="font-medium">{isFiltered ? 'No tables found' : 'No tables yet'}</p>
                <p className="text-muted-foreground text-sm">
                  {isFiltered
                    ? 'Try adjusting your search or domain filter.'
                    : 'Create your first data table to get started.'}
                </p>
                {/* Offered only when the list is genuinely empty — suggesting "create one" to
                    someone whose filter simply matched nothing is unhelpful. */}
                {!isFiltered && (
                  <Button size="sm" className="mt-2" asChild>
                    <Link href="/admin/tables/new">Create a table</Link>
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'
                      : 'space-y-2'
                  }
                >
                  {visibleTables.map((table) => (
                    <TableCard key={table.id} table={table} viewMode={viewMode} />
                  ))}
                </div>

                {/*
                  Pagination. Rendered only when there is more than one page — a pager showing
                  "Page 1 of 1" beneath every short list is chrome that never does anything.
                */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t pt-3">
                    <p className="text-muted-foreground text-xs">
                      Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredTables.length)}{' '}
                      of {filteredTables.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() => setPage(currentPage - 1)}
                      >
                        <ChevronLeft className="size-4" aria-hidden="true" />
                        Previous
                      </Button>
                      <span className="text-muted-foreground text-xs">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === totalPages}
                        onClick={() => setPage(currentPage + 1)}
                      >
                        Next
                        <ChevronRight className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ── By domain ── */}
          <TabsContent value="domains" className="space-y-4">
            {domainsWithTables.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {domainsWithTables.map((domain) => (
                  <DomainCard key={domain.id} domain={domain} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Globe className="text-muted-foreground size-8" aria-hidden="true" />
                <p className="font-medium">No domains with tables</p>
                <p className="text-muted-foreground text-sm">
                  Create some tables first to see them grouped here.
                </p>
              </div>
            )}
          </TabsContent>

          {/* ── Recent activity ── */}
          <TabsContent value="activity" className="space-y-2">
            {stats.recentActivity.length > 0 ? (
              stats.recentActivity.map((activity) => (
                <ActivityItem
                  // ⚠️ Was `key={index}`. Keyed on content instead — see note 5 in the header.
                  key={`${activity.timestamp}-${activity.tableName}`}
                  activity={activity}
                />
              ))
            ) : (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <RefreshCw className="text-muted-foreground size-8" aria-hidden="true" />
                <p className="font-medium">No recent activity</p>
                <p className="text-muted-foreground text-sm">
                  Table changes will appear here once you start editing.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

/**
 * One table, in either view.
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

  /** Replaces `alert(result.message)` — shown on the card that failed, not in a modal (#22.6). */
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async (format: TableExportFormat) => {
    setIsExporting(true);
    setExportError(null);

    // Same shared implementation the editor uses — see src/lib/export-table.ts.
    const result = await downloadTableExport(table.id, table.page.slug, format);
    if (!result.ok) setExportError(result.message);

    setIsExporting(false);
  };

  /** The menu is identical in both views, so it is built once. */
  const actions = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label={`Actions for ${table.name}`}
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/*
          ⚠️ There used to be TWO items here — "Edit" and "Manage Data" — pointing at the SAME
          url in the grid view, so one was pure noise (finding #22.3). In the list view they
          differed, and "Manage Data" pointed at `/admin/tables/[id]/data`, which **does not
          exist as a page** — only as an API route — so it 404'd.

          One link to the editor now, which opens on its Data tab: what "Manage Data" was
          reaching for. Since G-5c that tab is genuinely editable.
        */}
        <DropdownMenuItem asChild>
          <Link href={`/admin/tables/${table.id}`}>
            <Table2 className="size-4" aria-hidden="true" />
            Open table
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/*
          These two replace a single dead "📤 Export" item that had no `onClick`, no `asChild`
          and no link — it rendered, was clickable, and did nothing (finding #22.5). Split by
          format because the endpoint supports both; a submenu would be more clicks for no gain.
        */}
        <DropdownMenuItem onClick={() => handleExport('csv')} disabled={isExporting}>
          <FileDown className="size-4" aria-hidden="true" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('json')} disabled={isExporting}>
          <FileDown className="size-4" aria-hidden="true" />
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  /** Row/column counts, rendered the same way in both views. */
  const counts = (
    <>
      <span className="flex items-center gap-1">
        <Rows3 className="size-3" aria-hidden="true" />
        {rowCount.toLocaleString()}
      </span>
      <span className="flex items-center gap-1">
        <Columns3 className="size-3" aria-hidden="true" />
        {columnCount}
      </span>
    </>
  );

  const error = exportError && (
    <p className="text-destructive flex items-center gap-1 text-xs">
      <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
      {exportError}
    </p>
  );

  if (viewMode === 'grid') {
    return (
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            {/* `min-w-0` + `truncate` so a long table name cannot widen the grid cell. */}
            <CardTitle className="min-w-0 truncate text-base">{table.name}</CardTitle>
            {actions}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-muted-foreground truncate text-sm">{table.page.title}</p>
          <p className="text-muted-foreground truncate text-xs">{table.page.domain.name}</p>
          <div className="text-muted-foreground flex items-center gap-3 text-xs">{counts}</div>
          <Badge variant="secondary" className="font-normal">
            {table.page.contentType}
          </Badge>
          {error}
        </CardContent>
      </Card>
    );
  }

  return (
    // Was a hand-rolled `border border-gray-200 hover:bg-gray-50` div.
    <div className="hover:bg-muted/50 flex items-center gap-3 rounded-lg border p-3 transition-colors">
      <Table2 className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{table.name}</p>
        <p className="text-muted-foreground truncate text-xs">
          {table.page.title} · {table.page.domain.name}
        </p>
        <div className="text-muted-foreground mt-0.5 flex items-center gap-3 text-xs">
          {counts}
          <span>Updated {new Date(table.updatedAt).toLocaleDateString()}</span>
        </div>
        {error}
      </div>

      <Badge variant="secondary" className="hidden shrink-0 font-normal sm:inline-flex">
        {table.page.contentType}
      </Badge>
      {actions}
    </div>
  );
}

/**
 * One domain and the tables beneath it.
 */
type DomainCardProps = {
  domain: Domain;
};

function DomainCard({ domain }: DomainCardProps) {
  // Computed once rather than filtering twice — the old version called `.filter()` for the
  // count and again for the list, walking the same array a second time.
  const pagesWithTables = domain.pages.filter((page) => page.table);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="min-w-0 truncate">{domain.name}</span>
          <Badge variant="secondary" className="shrink-0 font-normal">
            {pagesWithTables.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {pagesWithTables.map((page) => (
          /*
            The whole row is the link, rather than a "Edit" anchor floated to the right of it
            — a bigger target, and it removes a `text-blue-600 hover:underline` that ignored
            the theme.
          */
          <Link
            key={page.id}
            href={`/admin/tables/${page.table?.id}`}
            className="hover:bg-muted flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
          >
            <span className="min-w-0 truncate">{page.table?.name}</span>
            <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * One entry in the recent-activity list.
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
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <RefreshCw className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm">
          <span className="font-medium">{activity.action}</span> table{' '}
          <span className="font-medium">{activity.tableName}</span>
          {activity.pageTitle && (
            <span className="text-muted-foreground"> in {activity.pageTitle}</span>
          )}
        </p>
        <p className="text-muted-foreground text-xs">
          {new Date(activity.timestamp).toLocaleString()}
          {activity.domainName && ` · ${activity.domainName}`}
        </p>
      </div>
    </div>
  );
}
