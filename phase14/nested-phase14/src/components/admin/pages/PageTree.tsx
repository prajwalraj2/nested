'use client';

import Link from 'next/link';

/**
 * Page Tree Component
 * 
 * Displays pages in hierarchical tree structure with action buttons.
 * Each page shows: Title, Slug, Link, Parent
 * Actions: + (add child), 🔗 (link), ✏️ (edit), 🗑️ (delete)
 * 
 * Key Features:
 * - Proper indentation for hierarchy levels
 * - Expand/collapse for pages with children
 * - Action buttons for page management
 * - Correct parent display logic
 * - Clean URLs based on domain type
 */

type Domain = {
  id: string;
  name: string;
  slug: string;
  pageType: string;
  isPublished: boolean;
};

type Page = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  parentId: string | null;
  domainId: string;
  createdAt: Date;
  children: Page[];
  depth: number;
  fullPath: string;
  previewUrl: string;
};

type PageTreeProps = {
  pages: Page[];
  domain: Domain;
  expandedPages: Set<string>;
  onToggleExpand: (pageId: string) => void;
  onCreateChild: (parentId: string) => void;
  onEditPage: (page: Page) => void;
  onDeletePage: (pageId: string) => void;
};

export function PageTree({ 
  pages, 
  domain, 
  expandedPages, 
  onToggleExpand, 
  onCreateChild, 
  onEditPage, 
  onDeletePage 
}: PageTreeProps) {

  if (pages.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <div className="text-4xl mb-4">📄</div>
        <h4 className="text-lg font-medium text-gray-900 mb-2">No Pages Yet</h4>
        <p className="text-gray-600 mb-6">
          Create your first page for <strong>{domain.name}</strong>
        </p>
        <div className="text-sm text-gray-500">
          💡 {domain.pageType === 'direct' 
            ? 'Pages will be created under the hidden __main__ page'
            : 'You can create root-level pages that connect directly to the domain'
          }
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      
      {/* Tree Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg mb-4">
        <div className="text-sm font-medium text-gray-700">
          📊 {getTotalPageCount(pages)} page{getTotalPageCount(pages) !== 1 ? 's' : ''} total
        </div>
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <span>🔍 Use + to add child pages</span>
          <span>•</span>
          <span>🔗 Click links to preview</span>
        </div>
      </div>

      {/* Pages Tree */}
      <div className="space-y-1">
        {pages.map(page => (
          <PageTreeNode
            key={page.id}
            page={page}
            domain={domain}
            allPages={pages}
            expandedPages={expandedPages}
            onToggleExpand={onToggleExpand}
            onCreateChild={onCreateChild}
            onEditPage={onEditPage}
            onDeletePage={onDeletePage}
            level={0}
          />
        ))}
      </div>
      
    </div>
  );
}

/**
 * Individual Page Tree Node
 */
type PageTreeNodeProps = {
  page: Page;
  domain: Domain;
  allPages: Page[];
  expandedPages: Set<string>;
  onToggleExpand: (pageId: string) => void;
  onCreateChild: (parentId: string) => void;
  onEditPage: (page: Page) => void;
  onDeletePage: (pageId: string) => void;
  level: number;
};

function PageTreeNode({
  page,
  domain,
  allPages,
  expandedPages,
  onToggleExpand,
  onCreateChild,
  onEditPage,
  onDeletePage,
  level
}: PageTreeNodeProps) {
  const hasChildren = page.children.length > 0;
  const isExpanded = expandedPages.has(page.id);
  const isMainPage = page.slug === '__main__';

  return (
    <div className="space-y-1">
      
      {/* Page Row */}
      <div
        className={`flex items-center group hover:bg-gray-50 rounded-lg transition-colors ${
          isMainPage ? 'bg-yellow-50 border border-yellow-200' : 'border border-transparent'
        }`}
        style={{ paddingLeft: `${level * 24}px` }}
      >
        
        {/* Expand/Collapse Button */}
        <div className="flex items-center mr-3">
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleExpand(page.id);
              }}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
              type="button"
            >
              <span className={`transform transition-transform text-gray-500 text-sm ${
                isExpanded ? 'rotate-90' : ''
              }`}>
                ▶
              </span>
            </button>
          ) : (
            <div className="w-6 h-6 flex items-center justify-center">
              <span className="w-2 h-2 bg-gray-300 rounded-full"></span>
            </div>
          )}
        </div>

        {/* Page Content */}
        <div className="flex-1 flex items-center justify-between py-3 px-3">
          
          {/* Page Info */}
          <div className="flex-1 grid grid-cols-4 gap-4 items-center">
            
            {/* Page Title */}
            <div className="flex items-center space-x-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                getContentTypeColor(page.contentType)
              }`}>
                {getContentTypeIcon(page.contentType)}
              </div>
              <div>
                <div className={`font-medium text-gray-900 ${isMainPage ? 'text-yellow-800' : ''}`}>
                  {page.title}
                  {isMainPage && <span className="ml-2 text-xs text-yellow-600">(Hidden)</span>}
                </div>
                <div className="text-xs text-gray-500">
                  {formatContentType(page.contentType)}
                </div>
              </div>
            </div>

            {/* Page Slug */}
            <div className="text-sm">
              <div className="font-mono text-gray-700">/{page.slug}</div>
              <div className="text-xs text-gray-500">Slug</div>
            </div>

            {/* Page Link */}
            <div className="text-sm">
              <Link
                href={page.previewUrl}
                target="_blank"
                className="text-blue-600 hover:text-blue-800 hover:underline font-mono text-xs"
                title="Preview page"
              >
                {page.previewUrl}
              </Link>
              <div className="text-xs text-gray-500">Preview URL</div>
            </div>

            {/* Page Parent */}
            <div className="text-sm">
              <div className="text-gray-700">
                {getParentDisplay(page, domain, allPages)}
              </div>
              <div className="text-xs text-gray-500">Parent</div>
            </div>
            
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
            
            {/* Add Child Page */}
            <button
              onClick={() => onCreateChild(page.id)}
              className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
              title="Add child page"
            >
              ➕
            </button>

            {/* Preview Link */}
            <Link
              href={page.previewUrl}
              target="_blank"
              className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
              title="Preview page"
            >
              🔗
            </Link>

            {/* Edit Page */}
            <button
              onClick={() => onEditPage(page)}
              className="p-2 text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded transition-colors"
              title="Edit page"
            >
              ✏️
            </button>

            {/* Delete Page */}
            {!isMainPage && (
              <button
                onClick={() => onDeletePage(page.id)}
                className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                title="Delete page"
              >
                🗑️
              </button>
            )}

          </div>
          
        </div>
      </div>

      {/* Children (Recursive) */}
      {hasChildren && isExpanded && (
        <div className="space-y-1">
          {page.children.map((child) => (
            <PageTreeNode
              key={child.id}
              page={child}
              domain={domain}
              allPages={allPages}
              expandedPages={expandedPages}
              onToggleExpand={onToggleExpand}
              onCreateChild={onCreateChild}
              onEditPage={onEditPage}
              onDeletePage={onDeletePage}
              level={level + 1}
            />
          ))}
        </div>
      )}
      
    </div>
  );
}

/**
 * Utility Functions
 */

/**
 * Get total page count including nested pages
 */
function getTotalPageCount(pages: Page[]): number {
  let count = pages.length;
  pages.forEach(page => {
    count += getTotalPageCount(page.children);
  });
  return count;
}

/**
 * Get parent display text
 */
function getParentDisplay(page: Page, domain: Domain, allPages: Page[]): string {
  if (!page.parentId) {
    return domain.pageType === 'hierarchical' ? `${domain.name} (Domain)` : 'Root';
  }
  
  // Find the actual parent page
  const findPageInTree = (pages: Page[], targetId: string): Page | null => {
    for (const p of pages) {
      if (p.id === targetId) return p;
      const found = findPageInTree(p.children, targetId);
      if (found) return found;
    }
    return null;
  };
  
  const parentPage = findPageInTree(allPages, page.parentId);
  
  if (parentPage) {
    if (parentPage.slug === '__main__') {
      return '__main__ (Hidden)';
    }
    return parentPage.title;
  }
  
  // Fallback
  return domain.pageType === 'direct' ? '__main__ (Hidden)' : 'Parent Page';
}

/**
 * Get content type icon
 */
function getContentTypeIcon(contentType: string): string {
  const icons: Record<string, string> = {
    'narrative': '📄',
    'section_based': '📋',
    'subcategory_list': '📂',
    'table': '📊',
    'rich_text': '✍️',
    'mixed_content': '🎨'
  };
  return icons[contentType] || '📄';
}

/**
 * Get content type color classes
 */
function getContentTypeColor(contentType: string): string {
  const colors: Record<string, string> = {
    'narrative': 'bg-blue-100 text-blue-700',
    'section_based': 'bg-green-100 text-green-700',
    'subcategory_list': 'bg-purple-100 text-purple-700',
    'table': 'bg-orange-100 text-orange-700',
    'rich_text': 'bg-pink-100 text-pink-700',
    'mixed_content': 'bg-gray-100 text-gray-700'
  };
  return colors[contentType] || 'bg-gray-100 text-gray-700';
}

/**
 * Format content type for display
 */
function formatContentType(contentType: string): string {
  const formatted: Record<string, string> = {
    'narrative': 'Narrative',
    'section_based': 'Section Based',
    'subcategory_list': 'Subcategory List',
    'table': 'Table',
    'rich_text': 'Rich Text',
    'mixed_content': 'Mixed Content'
  };
  return formatted[contentType] || contentType;
}
