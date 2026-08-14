// src/components/admin/sections/DomainPageSelector.tsx

'use client';

/**
 * Domain and Page Selector Component
 * 
 * Provides interface for selecting:
 * 1. Domain (with filtering for those that have section-based pages)
 * 2. Section-based page within the selected domain
 * 
 * Features:
 * - Dropdown selectors with search capability
 * - Visual indicators for page types and child count
 * - Clear selection buttons
 * - Responsive design
 */

// Type definitions
type Domain = {
  id: string;
  name: string;
  slug: string;
  pageType: string;
  pages: SectionablePage[];
};

type SectionablePage = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  sections?: any;
  subPages: ChildPage[];
  _count: {
    subPages: number;
  };
};

type ChildPage = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
};

type DomainPageSelectorProps = {
  domains: Domain[];
  selectedDomain: Domain | null;
  selectedPage: SectionablePage | null;
  onDomainChange: (domain: Domain | null) => void;
  onPageChange: (page: SectionablePage | null) => void;
};

export function DomainPageSelector({
  domains,
  selectedDomain,
  selectedPage,
  onDomainChange,
  onPageChange
}: DomainPageSelectorProps) {
  
  // Filter domains that have section-based pages
  const availableDomains = domains.filter(domain => domain.pages.length > 0);
  
  // Get pages for selected domain
  const availablePages = selectedDomain?.pages || [];

  return (
    <div className="space-y-6">
      
      {/* Selection Header */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Step 1: Select Domain and Page
        </h3>
        <p className="text-sm text-gray-600">
          Choose a domain and then select a section-based page to configure its layout.
        </p>
      </div>

      {/* Domain and Page Selection Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Domain Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Domain
          </label>
          <select
            value={selectedDomain?.id || ''}
            onChange={(e) => {
              const domain = availableDomains.find(d => d.id === e.target.value) || null;
              onDomainChange(domain);
            }}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="">Select a domain...</option>
            {availableDomains.map((domain) => (
              <option key={domain.id} value={domain.id}>
                {getDomainIcon(domain.pageType)} {domain.name} ({domain.pages.length} pages)
              </option>
            ))}
          </select>
          
          {/* Domain Info */}
          {selectedDomain && (
            <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
              <div className="font-medium text-blue-900">
                {getDomainIcon(selectedDomain.pageType)} {selectedDomain.name}
              </div>
              <div className="text-blue-700">
                Type: {selectedDomain.pageType} • Slug: /{selectedDomain.slug}
              </div>
            </div>
          )}
        </div>

        {/* Page Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Section-Based Page
          </label>
          <select
            value={selectedPage?.id || ''}
            onChange={(e) => {
              const page = availablePages.find(p => p.id === e.target.value) || null;
              onPageChange(page);
            }}
            disabled={!selectedDomain}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">
              {selectedDomain ? 'Select a page...' : 'First select a domain'}
            </option>
            {availablePages.map((page) => (
              <option key={page.id} value={page.id}>
                📋 {page.title} ({page._count.subPages} child pages)
              </option>
            ))}
          </select>
          
          {/* Page Info */}
          {selectedPage && (
            <div className="mt-2 p-2 bg-green-50 rounded text-sm">
              <div className="font-medium text-green-900">
                📋 {selectedPage.title}
              </div>
              <div className="text-green-700">
                Slug: /{selectedPage.slug} • Child Pages: {selectedPage._count.subPages}
              </div>
              <div className="text-green-600 mt-1">
                {selectedPage.sections ? 
                  `✅ Has ${Array.isArray(selectedPage.sections) ? selectedPage.sections.length : 0} sections configured` :
                  '⚠️ No sections configured yet'
                }
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Clear Selection Buttons */}
      {(selectedDomain || selectedPage) && (
        <div className="flex gap-2">
          {selectedPage && (
            <button
              onClick={() => onPageChange(null)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
            >
              Clear Page
            </button>
          )}
          {selectedDomain && (
            <button
              onClick={() => onDomainChange(null)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
            >
              Clear Domain
            </button>
          )}
        </div>
      )}

      {/* Available Domains Summary */}
      {availableDomains.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-yellow-500 text-xl mr-3">⚠️</div>
            <div>
              <h4 className="font-medium text-yellow-800">No Section-Based Pages Found</h4>
              <p className="text-yellow-700 text-sm mt-1">
                Create some pages with "section_based" content type in the Pages Management section first.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/**
 * Helper function to get icon for domain type
 */
function getDomainIcon(pageType: string): string {
  return pageType === 'direct' ? '🎯' : '📁';
}
