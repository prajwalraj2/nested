'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DomainSelector } from './DomainSelector';
import { PageTree } from './PageTree';
import { PageForm } from './PageForm';
import { Roboto } from 'next/font/google';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});

/**
 * Main Pages Manager Component
 * 
 * Orchestrates the entire page management workflow:
 * 1. Domain selection
 * 2. Page tree display with correct parent logic
 * 3. Page creation/editing with proper validation
 * 4. Action handling (create, edit, delete)
 * 
 * Key Logic:
 * - Direct domains: Pages use __main__ as parent
 * - Hierarchical domains: Pages use domain or other pages as parent
 * - URLs built correctly based on parent hierarchy
 */

type Domain = {
  id: string;
  name: string;
  slug: string;
  pageType: string;
  isPublished: boolean;
  category: {
    id: string;
    name: string;
    icon: string | null;
  } | null;
};

type Page = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  parentId: string | null;
  domainId: string;
  targetCountries?: string[];
  createdAt: Date;
  children: Page[];
  depth: number;
  fullPath: string;
  previewUrl: string;
};

type PagesManagerProps = {
  domains: Domain[];
  selectedDomainId?: string;
  expandedPageIds: string[];
};

export function PagesManager({ domains, selectedDomainId, expandedPageIds }: PagesManagerProps) {
  const router = useRouter();
  
  // State management
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set(expandedPageIds));
  
  // Form states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [createParentId, setCreateParentId] = useState<string | null>(null);

  /**
   * Initialize selected domain on mount or when selectedDomainId changes
   */
  useEffect(() => {
    if (selectedDomainId) {
      const domain = domains.find(d => d.id === selectedDomainId);
      if (domain) {
        setSelectedDomain(domain);
        fetchPagesForDomain(domain.id);
      }
    } else if (domains.length > 0) {
      // Default to first domain if none selected
      setSelectedDomain(domains[0]);
      fetchPagesForDomain(domains[0].id);
    }
  }, [selectedDomainId, domains]);

  /**
   * Fetch pages for the selected domain
   */
  const fetchPagesForDomain = async (domainId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/admin/pages?domain=${domainId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch pages');
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Build hierarchical structure and calculate paths
        const hierarchicalPages = buildPageHierarchy(data.pages, selectedDomain);
        setPages(hierarchicalPages);
      } else {
        throw new Error(data.message || 'Failed to fetch pages');
      }
      
    } catch (err) {
      console.error('Error fetching pages:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch pages');
      setPages([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle domain selection change
   */
  const handleDomainChange = (domain: Domain) => {
    setSelectedDomain(domain);
    setPages([]);
    setShowCreateForm(false);
    setEditingPage(null);
    
    // Update URL
    const url = new URL(window.location.href);
    url.searchParams.set('domain', domain.id);
    url.searchParams.delete('expand'); // Reset expanded state
    router.push(url.toString());
    
    // Fetch pages for new domain
    fetchPagesForDomain(domain.id);
  };

  /**
   * Handle page creation
   */
  const handleCreatePage = (parentId: string | null = null) => {
    setCreateParentId(parentId);
    setShowCreateForm(true);
    setEditingPage(null);
  };

  /**
   * Handle page editing
   */
  const handleEditPage = (page: Page) => {
    setEditingPage(page);
    setShowCreateForm(false);
    setCreateParentId(null);
  };

  /**
   * Handle form success (refresh pages)
   */
  const handleFormSuccess = () => {
    setShowCreateForm(false);
    setEditingPage(null);
    setCreateParentId(null);
    
    // Refresh pages
    if (selectedDomain) {
      fetchPagesForDomain(selectedDomain.id);
    }
  };

  /**
   * Handle form cancel
   */
  const handleFormCancel = () => {
    setShowCreateForm(false);
    setEditingPage(null);
    setCreateParentId(null);
  };

  /**
   * Handle page deletion
   */
  const handleDeletePage = async (pageId: string) => {
    if (!confirm('Are you sure you want to delete this page? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/pages/${pageId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete page');
      }
      
      // Refresh pages after deletion
      if (selectedDomain) {
        fetchPagesForDomain(selectedDomain.id);
      }
      
    } catch (err) {
      console.error('Error deleting page:', err);
      alert('Failed to delete page. Please try again.');
    }
  };

  /**
   * Handle expand/collapse
   */
  const handleToggleExpand = (pageId: string) => {
    const newExpanded = new Set(expandedPages);
    if (newExpanded.has(pageId)) {
      newExpanded.delete(pageId);
    } else {
      newExpanded.add(pageId);
    }
    setExpandedPages(newExpanded);
    
    // Update URL
    const url = new URL(window.location.href);
    if (newExpanded.size > 0) {
      url.searchParams.set('expand', Array.from(newExpanded).join(','));
    } else {
      url.searchParams.delete('expand');
    }
    router.replace(url.toString());
  };

  return (
    <div className="space-y-6">
      
      {/* Domain Selection */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className={`text-xl font-semibold text-gray-900 ${roboto.className}`}>
              Select Domain
            </h3>
            <p className={`text-sm text-gray-600 mt-1 ${roboto.className}`}>
              Choose a domain to manage its page hierarchy
            </p>
          </div>
          
          {selectedDomain && (
            <div className="flex items-center space-x-4 text-sm">
              <span className="text-gray-600">
                📊 {pages.length} page{pages.length !== 1 ? 's' : ''} total
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                selectedDomain.pageType === 'direct' 
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-purple-100 text-purple-800'
              }`}>
                {selectedDomain.pageType === 'direct' ? '🎯 Direct' : '🏗️ Hierarchical'}
              </span>
            </div>
          )}
        </div>
        
        <DomainSelector 
          domains={domains}
          selectedDomain={selectedDomain}
          onDomainChange={handleDomainChange}
        />
      </div>

      {/* Content Area */}
      {selectedDomain && (
        <div className="px-6 pb-6">
          
          {/* Create Page Button */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className={`text-lg font-semibold text-gray-900 ${roboto.className}`}>
                Pages in {selectedDomain.name}
              </h4>
              <p className={`text-sm text-gray-600 mt-1 ${roboto.className}`}>
                {selectedDomain.pageType === 'direct' 
                  ? 'Pages will be created under the hidden __main__ page'
                  : 'Create root-level pages or nested sub-pages'
                }
              </p>
            </div>
            
            <button
              onClick={() => handleCreatePage(null)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              + Create New Page
            </button>
          </div>

          {/* Page Creation/Edit Form */}
          {(showCreateForm || editingPage) && (
            <div className="mb-6 bg-gray-50 rounded-lg p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h5 className={`text-md font-semibold text-gray-900 ${roboto.className}`}>
                  {editingPage ? `Edit Page: ${editingPage.title}` : 'Create New Page'}
                </h5>
                <button
                  onClick={handleFormCancel}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <PageForm
                domain={selectedDomain}
                pages={pages}
                parentId={createParentId}
                editingPage={editingPage}
                onSuccess={handleFormSuccess}
                onCancel={handleFormCancel}
              />
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading pages...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <span className="text-red-500 mr-2">❌</span>
                <span className="text-red-700 text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* Pages Tree */}
          {!loading && !error && (
            <PageTree
              pages={pages}
              domain={selectedDomain}
              expandedPages={expandedPages}
              onToggleExpand={handleToggleExpand}
              onCreateChild={handleCreatePage}
              onEditPage={handleEditPage}
              onDeletePage={handleDeletePage}
            />
          )}

        </div>
      )}

      {/* No Domain Selected State */}
      {!selectedDomain && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🌐</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Select a Domain to Get Started
          </h3>
          <p className="text-gray-600 mb-6">
            Choose a domain from the dropdown above to manage its pages
          </p>
        </div>
      )}
      
    </div>
  );
}

/**
 * Build hierarchical page structure with correct parent logic
 */
function buildPageHierarchy(flatPages: any[], domain: Domain | null): Page[] {
  if (!domain || !flatPages.length) return [];
  
  // Transform flat pages to typed pages with hierarchy info
  const transformedPages: Page[] = flatPages.map(page => ({
    id: page.id,
    title: page.title,
    slug: page.slug,
    contentType: page.contentType,
    parentId: page.parentId,
    domainId: page.domainId,
    targetCountries: page.targetCountries,
    createdAt: new Date(page.createdAt),
    children: [],
    depth: 0,
    fullPath: '',
    previewUrl: ''
  }));

  // Build parent-child relationships
  const pageMap = new Map(transformedPages.map(p => [p.id, p]));
  const rootPages: Page[] = [];

  transformedPages.forEach(page => {
    if (page.parentId && pageMap.has(page.parentId)) {
      // Has parent - add to parent's children
      const parent = pageMap.get(page.parentId)!;
      parent.children.push(page);
    } else {
      // No parent or parent not found - this is a root page
      rootPages.push(page);
    }
  });

  // Calculate depth, full path, and preview URL for all pages
  const calculatePageInfo = (page: Page, depth: number = 0, parentPath: string = '') => {
    page.depth = depth;
    
    // Build full path based on domain type and hierarchy
    if (domain.pageType === 'direct') {
      // For direct domains, skip __main__ in the URL path
      if (page.slug === '__main__') {
        page.fullPath = '';
        page.previewUrl = `/domain/${domain.slug}`;
      } else {
        // Check if parent is __main__
        const parent = pageMap.get(page.parentId || '');
        if (parent && parent.slug === '__main__') {
          page.fullPath = page.slug;
        } else {
          page.fullPath = parentPath ? `${parentPath}/${page.slug}` : page.slug;
        }
        page.previewUrl = `/domain/${domain.slug}/${page.fullPath}`;
      }
    } else {
      // For hierarchical domains, build normal path
      page.fullPath = parentPath ? `${parentPath}/${page.slug}` : page.slug;
      page.previewUrl = `/domain/${domain.slug}/${page.fullPath}`;
    }

    // Recursively calculate for children
    page.children.forEach(child => {
      calculatePageInfo(child, depth + 1, page.fullPath);
    });

    // Sort children by creation date
    page.children.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  };

  // Calculate info for all root pages
  rootPages.forEach(page => calculatePageInfo(page));

  // Sort root pages by creation date
  rootPages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return rootPages;
}
