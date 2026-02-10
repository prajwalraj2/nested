// src/components/domain/SectionBasedLayout.tsx

import Link from 'next/link';

// Types
type Domain = {
  id: string;
  name: string;
  slug: string;
  pageType: string;
};

type Page = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  sections?: any; // JSON field containing section configuration
};

type ChildPage = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  parentId: string | null;
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
  currentPath = ''
}: {
  domain: Domain;
  page?: Page;
  childPages?: ChildPage[];
  currentPath?: string;
}) {
  const title = page?.title || domain.name;
  const sections: Section[] = page?.sections || [];
  
  // Organize sections into rows (grouped by order)
  const rows = organizeSectionsIntoRows(sections, childPages);
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        <div className="border-b border-gray-300 mb-6 mt-1" style={{ borderBottomWidth: '1px' }}></div>
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-8 gap-y-10">
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
                  // Empty placeholder to maintain grid alignment
                  <div key={`row-${rowIndex}-col-${colNum}-empty`} />
                );
              })
            )).flat()}
          </div>
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
      <div className="border-b border-gray-300 w-full mt-1 mb-4" style={{ borderBottomWidth: '1px' }}></div>
      
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
      className="block px-3 py-2 text-foreground hover:bg-accent rounded-md transition-colors"
      title={page.title} // Show full title on hover
    >
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
