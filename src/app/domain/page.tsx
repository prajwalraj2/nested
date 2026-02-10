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

type ColumnData = {
  [key: number]: {
    category: CategoryFull | { name: string; slug: string; icon: string; description: string };
    domains: DomainWithCategory[];
  }[];
};

function organizeDomainsIntoColumns(
  domains: DomainWithCategory[],
  categories: CategoryFull[]
): ColumnData {
  const columnData: ColumnData = { 1: [], 2: [], 3: [] };
  
  // Add all categories to their respective columns
  categories.forEach(category => {
    const categoryDomains = domains
      .filter(domain => domain.category?.id === category.id)
      .sort((a, b) => a.orderInCategory - b.orderInCategory);
    
    columnData[category.columnPosition].push({
      category,
      domains: categoryDomains,
    });
  });

  // Add uncategorized domains to column 1
  const uncategorizedDomains = domains.filter(domain => !domain.category);
  if (uncategorizedDomains.length > 0) {
    columnData[1].push({
      category: {
        name: 'Other Domains',
        slug: 'other',
        icon: '📂',
        description: 'Miscellaneous domains',
      },
      domains: uncategorizedDomains,
    });
  }

  return columnData;
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

  // Organize domains by category and column
  const columnData = organizeDomainsIntoColumns(domains, categories);

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* 3-Column Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(columnNumber => (
            <div key={columnNumber} className="space-y-6">
              {columnData[columnNumber].map((categoryGroup, index) => (
                <CategoryCard 
                  key={categoryGroup.category.slug || `uncategorized-${index}`}
                  category={categoryGroup.category}
                  domains={categoryGroup.domains}
                />
              ))}
            </div>
          ))}
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
// Category Card Component (No header, just domains list)
// ============================================

type CategoryCardProps = {
  category: CategoryFull | { name: string; slug: string; icon: string; description: string };
  domains: DomainWithCategory[];
};

function CategoryCard({ category, domains }: CategoryCardProps) {
  if (domains.length === 0) return null;
  
  return (
    <div className="space-y-2">
      {domains.map((domain) => (
        <DomainCard key={domain.id} domain={domain} />
      ))}
    </div>
  );
}

// ============================================
// Domain Card Component (Compact with shadcn)
// ============================================

type DomainCardProps = {
  domain: DomainWithCategory;
};

function DomainCard({ domain }: DomainCardProps) {
  return (
    <Link 
      href={`/domain/${domain.slug}`}
      className="block"
    >
      <div className="px-3 py-2 rounded-md hover:bg-accent transition-colors cursor-pointer">
        <span className="font-medium text-foreground">
          {domain.name}
        </span>
      </div>
    </Link>
  );
}
