// src/components/domain/SubcategorySelector.tsx
'use client';

import Link from 'next/link';
import { ItemIcon } from './ItemIcon';
import { usePathname } from 'next/navigation';
import { PageHeading } from './PageHeading';

// Types
type DomainWithPages = {
  id: string;
  name: string;
  /** Icon id — used for the heading when this is the domain root. */
  icon?: string | null;
  slug: string;
  pageType: string;
  pages: PageWithContent[];
};

type PageWithContent = {
  id: string;
  title: string;
  /** Icon id from public/icons/, or null to fall back to the emoji in the title. */
  icon?: string | null;
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
  /*
    Same rule as SectionBasedLayout: when this IS the domain root, the heading names the DOMAIN,
    not whatever page row happens to be passed. A hierarchical domain has no `__main__` page at
    all, so `page` is simply absent here — but a nested subcategory_list page passes its own row
    and should name itself.
  */
  const isDomainRoot = !page;
  const title = isDomainRoot ? domain.name : page.title;
  const headingIcon = isDomainRoot ? domain.icon : page.icon;

  // Organize pages into row groups (each with 3 columns of up to 5 pages)
  const rowGroups = organizePagesIntoRows(subcategories);
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <PageHeading title={title} icon={headingIcon} />
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
      className="flex items-center gap-2 px-3 py-1 rounded-md hover:bg-accent transition-colors"
      title={subcategory.title}
    >
      <ItemIcon icon={subcategory.icon} size={16} />
      <span className="text-sm font-medium text-foreground block truncate">
        {subcategory.title}
      </span>
    </Link>
  );
}
