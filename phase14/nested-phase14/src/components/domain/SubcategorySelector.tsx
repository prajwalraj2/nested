// src/components/domain/SubcategorySelector.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Types
type DomainWithPages = {
  id: string;
  name: string;
  slug: string;
  pageType: string;
  pages: PageWithContent[];
};

type PageWithContent = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  content: any[];
  subPages: any[];
};

type ColumnData = {
  [column: number]: PageWithContent[];
};

type RowGroup = ColumnData;

// Organize pages into columns (5 pages per column, fill column-first)
function organizePagesIntoRows(pages: PageWithContent[]): RowGroup[] {
  const PAGES_PER_COLUMN = 5;
  const COLUMNS = 3;
  const PAGES_PER_ROW_GROUP = PAGES_PER_COLUMN * COLUMNS; // 15 pages per row group

  const rowGroups: RowGroup[] = [];
  
  // Split pages into row groups of 15
  for (let i = 0; i < pages.length; i += PAGES_PER_ROW_GROUP) {
    const groupPages = pages.slice(i, i + PAGES_PER_ROW_GROUP);
    
    const rowGroup: RowGroup = { 1: [], 2: [], 3: [] };
    
    // Distribute pages to columns (1-5 to col 1, 6-10 to col 2, 11-15 to col 3)
    groupPages.forEach((page, index) => {
      const columnIndex = Math.floor(index / PAGES_PER_COLUMN) + 1; // 1, 2, or 3
      if (columnIndex <= COLUMNS) {
        rowGroup[columnIndex].push(page);
      }
    });
    
    rowGroups.push(rowGroup);
  }

  return rowGroups;
}

// Main Subcategory Selector Component
export function SubcategorySelector({ domain, page }: { 
  domain: DomainWithPages; 
  page?: PageWithContent;
}) {
  const pathname = usePathname();
  const subcategories = page?.subPages || domain.pages;
  const pathPrefix = pathname;
  const title = page?.title || domain.name;

  // Organize pages into row groups (each with 3 columns of up to 5 pages)
  const rowGroups = organizePagesIntoRows(subcategories);
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        <div className="border-b border-gray-300 mb-6 mt-1" style={{ borderBottomWidth: '1px' }}></div>
      </div>

      {/* 3-Column Grid Layout */}
      <div className="max-w-7xl mx-auto px-6 pb-12">
        {subcategories.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🚧</div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Coming Soon
            </h3>
            <p className="text-muted-foreground">
              Subcategories are being added for this domain.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {rowGroups.map((rowGroup, groupIndex) => (
              <div key={groupIndex} className="grid grid-cols-1 lg:grid-cols-3 gap-x-6 gap-y-1">
                {/* Column 1 */}
                <div className="space-y-1">
                  {rowGroup[1].map((subcategory) => (
                    <SubcategoryItem
                      key={subcategory.id}
                      subcategory={subcategory}
                      pathPrefix={pathPrefix}
                    />
                  ))}
                </div>
                {/* Column 2 */}
                <div className="space-y-1">
                  {rowGroup[2].map((subcategory) => (
                    <SubcategoryItem
                      key={subcategory.id}
                      subcategory={subcategory}
                      pathPrefix={pathPrefix}
                    />
                  ))}
                </div>
                {/* Column 3 */}
                <div className="space-y-1">
                  {rowGroup[3].map((subcategory) => (
                    <SubcategoryItem
                      key={subcategory.id}
                      subcategory={subcategory}
                      pathPrefix={pathPrefix}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Simple Subcategory Item (compact, like domain page)
function SubcategoryItem({ subcategory, pathPrefix }: {
  subcategory: PageWithContent;
  pathPrefix: string;
}) {
  return (
    <Link
      href={`${pathPrefix}/${subcategory.slug}`}
      className="block px-3 py-1 rounded-md hover:bg-accent transition-colors"
      title={subcategory.title}
    >
      <span className="text-sm font-medium text-foreground block truncate">
        {subcategory.title}
      </span>
    </Link>
  );
}
