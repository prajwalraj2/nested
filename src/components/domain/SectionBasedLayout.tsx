// src/components/domain/SectionBasedLayout.tsx

import Link from 'next/link';
import { PageHeading } from './PageHeading';
// Shared with the "Upcoming Domains" block on /domain — see the note in that file for why its
// items are buttons rather than links.
import { UpcomingList } from './UpcomingList';
import { ItemIcon } from './ItemIcon';

// Types
type Domain = {
  id: string;
  name: string;
  slug: string;
  pageType: string;
  /** Icon id — used for the heading when this is the domain root. */
  icon?: string | null;
};

type Page = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  sections?: any; // JSON field containing section configuration
  /** Icon id — used for the heading when this is a nested section-based page. */
  icon?: string | null;
};

type ChildPage = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  parentId: string | null;
  /** Icon id from public/icons/, or null to fall back to the emoji in the title. */
  icon?: string | null;
};

type Section = {
  title: string;
  column: number;
  order: number;
  pageIds: string[];
};

type ProcessedSection = {
  title: string;
  order: number;
  column: number;
  pages: ChildPage[];
};

// Main Section-Based Layout Component
export function SectionBasedLayout({ 
  domain, 
  page, 
  childPages = [],
  upcomingChildPages = [],
  currentPath = ''
}: {
  domain: Domain;
  page?: Page;
  childPages?: ChildPage[];
  /**
   * Child pages with status UPCOMING, rendered in their own block below the grid.
   *
   * ⚠️ A SEPARATE PROP, not a filter over `childPages`. `childPages` comes from
   * `PageService.getChildPages`, which now returns PUBLISHED only — so these pages are not in
   * it and could not be recovered from it.
   *
   * Keeping them apart is also what stops them appearing inside a section:
   * `organizeSectionsIntoRows` resolves each `pageId` against `childPages` and drops what it
   * cannot find, so an upcoming page falls out of its configured section automatically.
   */
  upcomingChildPages?: ChildPage[];
  currentPath?: string;
}) {
  /**
   * ⚠️ THE DOMAIN ROOT SHOWS THE DOMAIN'S OWN NAME AND ICON — NOT `__main__`'s.
   * ==========================================================================
   *
   * This used to be `page?.title || domain.name`, and for a direct domain's root `page` IS the
   * `__main__` page — so `/domain/gdesign` rendered the `__main__` row's title, not the
   * domain's name. The two drift apart immediately in practice:
   *
   *     Domain   name = "Graphic Designing"        icon = facebook
   *     __main__ title = "🖌️ Graphic Designing"     icon = null
   *
   * Editing the domain — removing its emoji, giving it an icon — changed nothing on its own
   * root page, because the heading was reading a different row. That is what made icons look
   * broken on domain roots while working everywhere else.
   *
   * `__main__`'s title is not something anyone chose: it is copied from the domain name when
   * the row is auto-created (`POST /api/admin/domains`) and never updated again. The domain is
   * what the URL identifies, so the domain is what the heading should name.
   *
   * ⚠️ It also sidesteps #26 entirely — the `__main__` row could not be edited at all until
   * this same change, so "just fix the __main__ title" was not available.
   *
   * A NESTED section-based page (not a domain root) still uses its own title and icon, which is
   * correct — that page is what the URL identifies there.
   */
  const isDomainRoot = !page || page.slug === '__main__';
  const title = isDomainRoot ? domain.name : page.title;
  const headingIcon = isDomainRoot ? domain.icon : page.icon;

  const sections: Section[] = page?.sections || [];
  
  // Organize sections into rows (grouped by order)
  const rows = organizeSectionsIntoRows(sections, childPages);
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <PageHeading title={title} icon={headingIcon} />
      </div>

      {/* Main Content - Row-Based 3-Column Layout */}
      <div className="max-w-7xl mx-auto px-6 pb-12">
        {sections.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Sections Coming Soon
            </h3>
            <p className="text-muted-foreground">
              This page&apos;s sections are being configured. Create some pages and organize them into sections.
            </p>
          </div>
        ) : (
          /*
            ⚠️ 1 -> 2 -> 3 COLUMNS, AND THE MIDDLE STEP NEEDED MORE THAN A BREAKPOINT.

            This grid was `grid-cols-1 lg:grid-cols-3`, so it jumped straight from one column to
            three at 1024px with nothing in between - which is what the tablet range looked wrong at.

            ⚠️ WHY `md:grid-cols-2` ALONE WOULD HAVE BROKEN IT. This is not a flowing list. It is a
            BOARD: each category carries an admin-set `categoryOrder` (its row) and
            `columnPosition` (its column, 1-3), and the loop below emits three cells per row -
            including EMPTY placeholder cells to hold the alignment. Feed three cells per row into
            a two-column grid and the placeholders become visible holes in the middle of the page,
            with the third cell of each row wrapping under the first.

            The fix is on the placeholder, not here: `hidden lg:block` makes the empty cells exist
            only in the three-column layout that needs them. At two columns they vanish and the
            real cells close up into a natural flow.
          */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
            {/* Render row by row - sections with same order render together */}
            {rows.map((row, rowIndex) => (
              // Each row renders 3 cells (columns 1, 2, 3)
              [1, 2, 3].map(colNum => {
                const section = row[colNum];
                return section ? (
                  <SectionCell 
                    key={`row-${rowIndex}-col-${colNum}`}
                    section={section}
                    domain={domain}
                    currentPath={currentPath}
                  />
                ) : (
                  /*
                  ⚠️ `hidden lg:block` - an alignment spacer, NOT content.

                  It exists only to keep a row's real cells in their admin-assigned columns, which
                  is a three-column idea. Below `lg` there are two columns, the row structure no
                  longer maps onto them, and an empty cell would simply be a hole. Hiding it lets
                  the remaining cells flow.
                */
                <div key={`row-${rowIndex}-col-${colNum}-empty`} className="hidden lg:block" />
                );
              })
            )).flat()}
          </div>
        )}

        {/*
          ── Upcoming Resources ────────────────────────────────────────────
          Child pages with status UPCOMING: named here, with no page behind them.

          ⚠️ OUTSIDE the section grid, not another section within it. A section is a *configured*
          thing — it has a title, a column and an order stored in `Page.sections` — and these
          pages are deliberately absent from that configuration. Putting them in the grid would
          mean inventing a section they were never assigned to.

          ⚠️ Rendered ONLY when non-empty. A heading over an empty list reads as a bug and
          promises content that does not exist. Most of the 42 section-based pages will have
          nothing upcoming, and those must look exactly as they do today.

          The mirror of the "Upcoming Domains" block at the foot of `/domain` (#24), and it
          shares that block's component so the two cannot drift apart on spacing or wording.
        */}
        {upcomingChildPages.length > 0 && (
          <section className="mt-12 border-t pt-8" aria-labelledby="upcoming-resources-heading">
            <h2
              id="upcoming-resources-heading"
              className="text-foreground mb-3 text-xl font-semibold"
            >
              Upcoming Resources
            </h2>
            <UpcomingList
              noun="Resource"
              items={upcomingChildPages.map((child) => ({ id: child.id, name: child.title, icon: child.icon }))}
            />
          </section>
        )}
      </div>
    </div>
  );
}

// Section Cell Component (renders a single section in the grid)
function SectionCell({ section, domain, currentPath }: { 
  section: ProcessedSection;
  domain: Domain;
  currentPath: string;
}) {
  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold text-foreground mb-1" title={section.title}>
        <span className="block truncate">{section.title}</span>
      </h2>
      <div className="border-b border-border w-full mt-1 mb-2" style={{ borderBottomWidth: '1px' }}></div>
      
      <div className="space-y-1">
        {section.pages.map((page: ChildPage) => (
          <SectionItem 
            key={page.id} 
            page={page}
            domain={domain}
            currentPath={currentPath}
          />
        ))}
      </div>
      
      {section.pages.length === 0 && (
        <div className="text-center py-4 text-muted-foreground">
          <div className="text-sm">No pages in this section</div>
        </div>
      )}
    </div>
  );
}

// Section Item Component
function SectionItem({ page, domain, currentPath }: { 
  page: ChildPage;
  domain: Domain;
  currentPath: string;
}) {
  // Build URL based on domain type and page hierarchy
  const buildPageUrl = (page: ChildPage, domain: Domain, currentPath: string): string => {
    if (domain.pageType === 'direct') {
      // For direct domains: /domain/slug/page-slug
      return `/domain/${domain.slug}/${page.slug}`;
    } else {
      // For hierarchical domains: append to the current path
      // If currentPath is empty (top-level), use domain slug
      // Otherwise, append to the existing path
      if (!currentPath || currentPath === '') {
        return `/domain/${domain.slug}/${page.slug}`;
      } else {
        return `${currentPath}/${page.slug}`;
      }
    }
  };

  const pageUrl = buildPageUrl(page, domain, currentPath);

  return (
    <Link 
      href={pageUrl} 
      // `flex items-center gap-2` replaces `block` so the icon and title share a line. Rows
      // with no icon are unaffected — `ItemIcon` renders nothing rather than a placeholder.
      className="flex items-center gap-2 pl-1 pr-3 py-1 text-foreground hover:bg-accent rounded-md transition-colors"
      title={page.title} // Show full title on hover
    >
      <ItemIcon icon={page.icon} size={16} />
      <span className="text-sm font-medium block truncate">{page.title}</span>
    </Link>
  );
}

// Organize sections into rows (grouped by order for horizontal alignment)
function organizeSectionsIntoRows(
  sections: Section[], 
  childPages: ChildPage[]
): { [column: number]: ProcessedSection | null }[] {
  // First, process all sections and group by order
  const orderGroups: { [order: number]: { [column: number]: ProcessedSection } } = {};
  
  sections.forEach(section => {
    // Find pages for this section
    const sectionPages = section.pageIds
      .map(pageId => childPages.find(page => page.id === pageId))
      .filter(Boolean) as ChildPage[];
    
    const processedSection: ProcessedSection = {
      title: section.title,
      order: section.order,
      column: section.column,
      pages: sectionPages
    };
    
    // Group by order
    if (!orderGroups[section.order]) {
      orderGroups[section.order] = {};
    }
    orderGroups[section.order][section.column] = processedSection;
  });
  
  // Convert to sorted array of rows
  const sortedOrders = Object.keys(orderGroups)
    .map(Number)
    .sort((a, b) => a - b);
  
  // Create rows array where each row has columns 1, 2, 3 (or null if empty)
  const rows = sortedOrders.map(order => {
    return {
      1: orderGroups[order][1] || null,
      2: orderGroups[order][2] || null,
      3: orderGroups[order][3] || null
    };
  });
  
  return rows;
}
