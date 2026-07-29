// app/domain/page.tsx
// 
// Domain Index Page - Shows all published domains organized by category
// Uses Services Layer for data fetching
// Includes ISR for optimal performance

import type { Metadata } from 'next';
import Link from 'next/link';
import { getUserCountryFromCookies } from '@/lib/server-country';
import { DomainService, CategoryService, type DomainWithCategory, type CategoryFull } from '@/services';
import { buildOpenGraph, buildTwitter, SITE_NAME } from '@/lib/seo';
import { buildOrganizationJsonLd } from '@/lib/structured-data';
import { JsonLd } from '@/components/JsonLd';

// ============================================
// ISR Configuration
// ============================================

/** Revalidate page every 60 seconds */
export const revalidate = 60;

/** Force dynamic rendering due to geo-targeting (cookie-based) */
export const dynamic = 'force-dynamic';

// ============================================
// Metadata
// ============================================

/**
 * Static metadata — this is a single, fixed page, so there's nothing to compute
 * per-request and no need for `generateMetadata`.
 *
 * This is the site's real landing page: `/` issues a 308 redirect here, so this is
 * the URL Google indexes and the one inbound links to `atno.io` consolidate onto.
 */
const DESCRIPTION =
  'Browse every domain on ATNO — curated tools, resources and channels across design, development, AI, ecommerce and more.';

/**
 * Used for both the `<title>` and the Open Graph / Twitter title, so the search
 * result and the chat-app link preview say the same thing.
 *
 * Note `og:title` does NOT go through the layout's `%s · ATNO` template — that
 * only applies to `metadata.title`. Without spelling it out here, previews would
 * have shown a bare "Domains" while search showed the full brand-led title.
 */
const TITLE = `${SITE_NAME} - Curated Tools & Resources, by Domain`;

export const metadata: Metadata = {
  /**
   * ⚠️ `absolute` — this bypasses the `%s · ATNO` template in src/app/layout.tsx.
   *
   * WHY THIS PAGE IS SPECIAL: `/` issues a 308 permanent redirect here, and every
   * search crawler and link-preview bot follows redirects. So `/domain` is the
   * de-facto homepage — the URL people type, link to, and paste into chat.
   *
   * Through the template it would render as `Domains · ATNO`, which describes the
   * page mechanically and says nothing about what ATNO is. For the site's single
   * most-linked URL, the brand and the value proposition should lead. Every OTHER
   * page keeps the template, where a trailing brand is exactly right.
   *
   * Written out in full rather than `Domains` + template so there is only one
   * "ATNO" in the string — the template would otherwise append a second one.
   */
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    // Relative on purpose: `metadataBase` in the root layout expands it to
    // https://atno.io/domain, so both production hostnames emit the same canonical.
    canonical: '/domain',
  },
  // Via the builders, not inline: Next.js replaces (does not merge) the layout's
  // openGraph/twitter objects, so any field omitted here would be dropped entirely.
  openGraph: buildOpenGraph({ title: TITLE, description: DESCRIPTION, url: '/domain' }),
  twitter: buildTwitter({ title: TITLE, description: DESCRIPTION }),
};

// ============================================
// Data Organization Helper
// ============================================

type CategoryGroup = {
  category: CategoryFull | { name: string; slug: string; icon: string; description: string; columnPosition?: number; categoryOrder?: number };
  domains: DomainWithCategory[];
};

type RowData = {
  [column: number]: CategoryGroup | null;
};

function organizeDomainsIntoRows(
  domains: DomainWithCategory[],
  categories: CategoryFull[]
): RowData[] {
  // Group categories by their categoryOrder (row) and columnPosition
  const orderGroups: { [order: number]: { [column: number]: CategoryGroup } } = {};

  // Process all categories
  categories.forEach(category => {
    const categoryDomains = domains
      .filter(domain => domain.category?.id === category.id)
      .sort((a, b) => a.orderInCategory - b.orderInCategory);

    // Skip empty categories
    if (categoryDomains.length === 0) return;

    const categoryGroup: CategoryGroup = {
      category,
      domains: categoryDomains,
    };

    // Group by categoryOrder (row)
    const order = category.categoryOrder;
    if (!orderGroups[order]) {
      orderGroups[order] = {};
    }
    orderGroups[order][category.columnPosition] = categoryGroup;
  });

  // Handle uncategorized domains - add to a special row at the end
  const uncategorizedDomains = domains.filter(domain => !domain.category);
  if (uncategorizedDomains.length > 0) {
    const maxOrder = Math.max(...Object.keys(orderGroups).map(Number), 0);
    const uncategorizedOrder = maxOrder + 1;
    
    if (!orderGroups[uncategorizedOrder]) {
      orderGroups[uncategorizedOrder] = {};
    }
    orderGroups[uncategorizedOrder][1] = {
      category: {
        name: 'Other Domains',
        slug: 'other',
        icon: '📂',
        description: 'Miscellaneous domains',
        columnPosition: 1,
        categoryOrder: uncategorizedOrder,
      },
      domains: uncategorizedDomains,
    };
  }

  // Convert to sorted array of rows
  const sortedOrders = Object.keys(orderGroups)
    .map(Number)
    .sort((a, b) => a - b);

  // Create rows array where each row has columns 1, 2, 3 (or null if empty)
  const rows = sortedOrders.map(order => ({
    1: orderGroups[order][1] || null,
    2: orderGroups[order][2] || null,
    3: orderGroups[order][3] || null,
  }));

  return rows;
}

// ============================================
// Main Page Component
// ============================================

export default async function DomainIndexPage() {
  const userCountry = await getUserCountryFromCookies();

  // Fetch data using services (parallel execution)
  const [domains, categories] = await Promise.all([
    DomainService.getAll(userCountry),
    CategoryService.getActive(),
  ]);

  // Organize domains into rows (grouped by categoryOrder for alignment)
  const rows = organizeDomainsIntoRows(domains, categories);

  return (
    <div className="min-h-screen bg-background">
      {/*
        Organization structured data — emitted ONLY here.

        Tells Google that "ATNO" is a named entity with a canonical URL and a logo,
        rather than leaving it to infer a brand from page text. It can feed a knowledge
        panel and helps disambiguate the name in results.

        ⚠️ Deliberately not on all 1,198 pages. An Organization entity belongs on the
        site's primary entry point — `/` 308-redirects here, so this is it. Repeating an
        identical entity everywhere adds bytes and gives Google conflicting signals
        about which URL is the organisation's home.

        Static, so it costs no database access. See src/lib/structured-data.ts.
      */}
      <JsonLd data={buildOrganizationJsonLd()} />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Heading */}
        <h1 className="text-3xl font-bold text-foreground">Domains</h1>
        <div className="border-b border-border w-full mt-1 mb-8" style={{ borderBottomWidth: '1px' }}></div>
        
        {/* 3-Column Grid Layout - Row-based rendering for alignment */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-6 gap-y-10">
          {/* Render row by row - categories with same order render together */}
          {rows.map((row, rowIndex) => (
            // Each row renders 3 cells (columns 1, 2, 3)
            [1, 2, 3].map(colNum => {
              const categoryGroup = row[colNum];
              return categoryGroup ? (
                <CategoryCell
                  key={`row-${rowIndex}-col-${colNum}`}
                  domains={categoryGroup.domains}
                />
              ) : (
                // Empty placeholder to maintain grid alignment
                <div key={`row-${rowIndex}-col-${colNum}-empty`} />
              );
            })
          )).flat()}
        </div>

        {/* Empty State */}
        {domains.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🏗️</div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              No Domains Available
            </h3>
            <p className="text-muted-foreground">
              Check back soon as we add new domains to explore.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Category Cell Component (Renders domains for a category in a grid cell)
// ============================================

type CategoryCellProps = {
  domains: DomainWithCategory[];
};

function CategoryCell({ domains }: CategoryCellProps) {
  if (domains.length === 0) return null;

  return (
    <div className="space-y-1">
      {domains.map((domain) => (
        <DomainItem key={domain.id} domain={domain} />
      ))}
    </div>
  );
}

// ============================================
// Domain Item Component (Compact with text truncation)
// ============================================

type DomainItemProps = {
  domain: DomainWithCategory;
};

function DomainItem({ domain }: DomainItemProps) {
  return (
    <Link
      href={`/domain/${domain.slug}`}
      className="block px-3 py-1 rounded-md hover:bg-accent transition-colors"
      title={domain.name} // Show full name on hover
    >
      <span className="text-sm font-medium text-foreground block truncate">
        {domain.name}
      </span>
    </Link>
  );
}
