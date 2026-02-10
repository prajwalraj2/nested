// app/domain/page.tsx
// 
// Domain Index Page - Shows all published domains organized by category
// Uses Services Layer for data fetching
// Includes ISR for optimal performance

import Link from 'next/link';
import { getUserCountryFromCookies } from '@/lib/server-country';
import { DomainService, CategoryService, type DomainWithCategory, type CategoryFull } from '@/services';

// ============================================
// ISR Configuration
// ============================================

/** Revalidate page every 60 seconds */
export const revalidate = 60;

/** Force dynamic rendering due to geo-targeting (cookie-based) */
export const dynamic = 'force-dynamic';

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
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Heading */}
        <h1 className="text-3xl font-bold text-foreground">Domains</h1>
        <div className="border-b border-gray-300 w-full mt-1 mb-8" style={{ borderBottomWidth: '1px' }}></div>
        
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
      className="block px-3 py-2 rounded-md hover:bg-accent transition-colors"
      title={domain.name} // Show full name on hover
    >
      <span className="font-medium text-foreground block truncate">
        {domain.name}
      </span>
    </Link>
  );
}
