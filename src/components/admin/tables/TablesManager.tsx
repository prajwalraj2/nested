// src/components/admin/tables/TablesManager.tsx

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Columns3,
  Database,
  FileDown,
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { downloadTableExport, type TableExportFormat } from '@/lib/export-table';
import type { TableStats } from '@/types/table';

/**
 * Tables list (rebuilt in Phase G-5a(ii)).
 * ============================================================================
 *
 * Two views of the same 652 tables: a searchable, paginated flat list, and recent activity.
 *
 * ⚠️ There was a third — "By domain" — removed on 3 Aug; see the note at `TabsList`.
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
 * 3. **A native `<select>`** carrying `border-gray-300 focus:ring-blue-500`. It first became a
 *    shadcn `Select`, then — on the user's request once they saw it — a **searchable
 *    `Popover` + `Command` combobox**, because a plain dropdown of 33 domains still has to be
 *    scrolled and read.
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
 * The "no domain filter" value.
 *
 * ⚠️ It has to be a non-empty string. That was originally because Radix `SelectItem` throws
 * on `''` (the G-3c trap), and it still holds now the control is a `Command` combobox: `''`
 * would be indistinguishable from "nothing selected" in the comparisons below. `'all'` was
 * already this component's value, so it doubles as the sentinel.
 */
const ALL_DOMAINS = 'all';

/** Tables rendered per page. 24 divides evenly by 2, 3 and 4, so no ragged last grid row. */
const PAGE_SIZE = 24;

/**
 * ⚠️ DATES ARE FORMATTED WITH AN EXPLICIT LOCALE **AND** TIME ZONE — DO NOT DROP EITHER.
 * ============================================================================
 * This is a client component, but the page is server-rendered first, so these strings are
 * produced twice: once by Node and once by the browser. A bare `toLocaleDateString()` uses
 * whatever default each runtime resolves, and those differ —
 *
 *   Node (server, often en-US / UTC) : "8/3/2026"
 *   Browser (this user is en-IN)     : "3/8/2026"
 *
 * — so the two renders disagree and React reports a hydration mismatch. Worse, the day and
 * month silently swap, which is a wrong date rather than an ugly one.
 *
 * Pinning both the locale and `timeZone: 'UTC'` makes the output identical on both sides.
 * UTC specifically because Prisma returns timestamps in UTC; formatting in the viewer's zone
 * would be friendlier but cannot be done here without reintroducing the mismatch — it would
 * have to be formatted on the server and passed down as a string.
 */
const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
};

const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  ...DATE_FORMAT,
  hour: '2-digit',
  minute: '2-digit',
};

/** `en-GB` for an unambiguous day-month order, and stable across both runtimes. */
function formatDate(value: Date | string, options = DATE_FORMAT): string {
  return new Date(value).toLocaleDateString('en-GB', options);
}

/**
 * ⚠️ NUMBERS NEED A PINNED LOCALE FOR THE SAME REASON AS DATES.
 *
 * Easy to overlook because it looks like plain formatting, but the thousands separator is
 * locale-specific: **1,198** (en) vs **1.198** (de) vs **1 198** (fr, with a narrow no-break
 * space). A bare `toLocaleString()` in a server-rendered client component can therefore
 * produce two different strings and trip the same hydration mismatch the dates did.
 *
 * ⚠️ `StatsCard` and the page shell call `toLocaleString()` too, but both are **server**
 * components — they render once, so they are safe as written. The rule applies to client
 * components only.
 */
function formatCount(value: number): string {
  return value.toLocaleString('en-GB');
}

export function TablesManager({ tables, domains, stats }: TablesManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>(ALL_DOMAINS);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [page, setPage] = useState(1);
  /** Open state for the searchable domain combobox below. */
  const [domainPickerOpen, setDomainPickerOpen] = useState(false);

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
          {/*
            ⚠️ THE "BY DOMAIN" TAB WAS REMOVED (3 Aug, on request) — three tabs became two.
            ==========================================================================
            It rendered one card per domain, each listing every table beneath it. That made
            sense before this screen had a domain filter; it does not now:

              • the searchable domain filter below does the same job, and adds pagination
                and table-name search on top;
              • the per-domain count it showed is now on each row of that filter;
              • ⚠️ it was the ONLY unpaginated list left here — 31 cards covering all 652
                table links — which is exactly why the screen still scrolled forever, and it
                partly undid the pagination added in G-5a(ii).

            The one thing it uniquely offered was seeing several domains side by side. That
            was judged not worth the cost.

            `DomainCard` was deleted with it. `domainsWithTables` is KEPT — the domain filter
            still needs it.
          */}
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tables">
              <Table2 className="size-4" aria-hidden="true" />
              All tables ({tables.length})
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

              {/*
                ⚠️ A SEARCHABLE COMBOBOX, NOT A PLAIN `Select` — changed on request.
                ==================================================================
                A `Select` lists all 33 domains with no way to filter, so finding one meant
                scrolling and reading. `Popover` + `Command` gives type-to-filter, arrow-key
                navigation, Enter to choose and Escape to dismiss — the same pattern already
                used by the Pages screen's domain picker in G-4c.

                ⚠️ The searchable `value` includes the **slug** as well as the name, because
                most domain names begin with an emoji ("🖌️ Graphic Designing") — typing the
                visible label is often not how you would look for one.
              */}
              <Popover open={domainPickerOpen} onOpenChange={setDomainPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={domainPickerOpen}
                    aria-label="Filter by domain"
                    // `justify-between` keeps the chevron pinned right; the fixed `sm:w-56`
                    // stops the control resizing as the selection changes.
                    className="w-full justify-between sm:w-56"
                  >
                    <span className="truncate">
                      {selectedDomain === ALL_DOMAINS
                        ? 'All domains'
                        : (domainsWithTables.find((d) => d.id === selectedDomain)?.name ??
                          'All domains')}
                    </span>
                    <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search domains…" />
                    <CommandList>
                      <CommandEmpty>No domain found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="All domains"
                          onSelect={() => {
                            updateFilter(() => setSelectedDomain(ALL_DOMAINS));
                            setDomainPickerOpen(false);
                          }}
                        >
                          <Check
                            className={
                              'size-4 shrink-0 ' +
                              (selectedDomain === ALL_DOMAINS ? 'opacity-100' : 'opacity-0')
                            }
                            aria-hidden="true"
                          />
                          All domains
                        </CommandItem>

                        {domainsWithTables.map((domain) => (
                          <CommandItem
                            key={domain.id}
                            value={`${domain.name} ${domain.slug}`}
                            onSelect={() => {
                              updateFilter(() => setSelectedDomain(domain.id));
                              setDomainPickerOpen(false);
                            }}
                          >
                            {/*
                              Always rendered and toggled with opacity, so every row keeps the
                              same left edge — conditionally mounting it would make the list
                              shift horizontally as the selection moves.
                            */}
                            <Check
                              className={
                                'size-4 shrink-0 ' +
                                (selectedDomain === domain.id ? 'opacity-100' : 'opacity-0')
                              }
                              aria-hidden="true"
                            />
                            <span className="min-w-0 flex-1 truncate">{domain.name}</span>
                            <span className="text-muted-foreground shrink-0 text-xs">
                              {domain.pages.filter((p) => p.table).length}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

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
        {formatCount(rowCount)}
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
          <span>Updated {formatDate(table.updatedAt)}</span>
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
          {formatDate(activity.timestamp, DATE_TIME_FORMAT)}
          {activity.domainName && ` · ${activity.domainName}`}
        </p>
      </div>
    </div>
  );
}
