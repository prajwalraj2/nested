// src/components/admin/tables/DomainPageSelector.tsx

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

/**
 * Domain and Page Selector for Table Creation
 * 
 * Step 1 of the table creation wizard.
 * Allows users to:
 * - Select a domain from available options
 * - Choose an existing page with contentType "table" 
 * - Or create a new page for the table
 * - Convert existing "narrative" pages to "table" type
 * 
 * Features:
 * - Domain filtering and search
 * - Page type validation
 * - New page creation form
 * - Visual indicators for page status
 */

// Type definitions
type Domain = {
  id: string;
  name: string;
  slug: string;
  pages: Array<{
    id: string;
    title: string;
    slug: string;
    contentType: string;
    table?: {
      id: string;
      name: string;
    } | null;
  }>;
};

type SelectedDomain = {
  id: string;
  name: string;
  slug: string;
};

type SelectedPage = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  isNew?: boolean;
};

type DomainPageSelectorProps = {
  domains: Domain[];
  selectedDomain?: SelectedDomain;
  selectedPage?: SelectedPage;
  onSelection: (domain: SelectedDomain | null, page: SelectedPage | null) => void;
};

export function DomainPageSelector({
  domains,
  selectedDomain,
  selectedPage,
  onSelection
}: DomainPageSelectorProps) {
  
  // Local state
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPageData, setNewPageData] = useState({
    title: '',
    slug: '',
  });

  // Filter domains based on search
  const filteredDomains = domains.filter(domain =>
    domain.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    domain.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get available pages for selected domain
  const availablePages = selectedDomain 
    ? domains.find(d => d.id === selectedDomain.id)?.pages || []
    : [];

  // Handle domain selection
  const handleDomainSelect = (domain: Domain) => {
    const domainData: SelectedDomain = {
      id: domain.id,
      name: domain.name,
      slug: domain.slug
    };
    
    onSelection(domainData, null); // Reset page selection when domain changes
    setShowCreateForm(false);
    setNewPageData({ title: '', slug: '' });
  };

  // Handle page selection
  const handlePageSelect = (page: any) => {
    const pageData: SelectedPage = {
      id: page.id,
      title: page.title,
      slug: page.slug,
      contentType: page.contentType,
      isNew: false
    };
    
    onSelection(selectedDomain!, pageData);
    setShowCreateForm(false);
  };

  // Handle new page creation
  const handleCreateNewPage = () => {
    if (!newPageData.title.trim() || !selectedDomain) return;
    
    // Generate slug from title if not provided
    const slug = newPageData.slug.trim() || 
      newPageData.title.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    
    const pageData: SelectedPage = {
      id: `new_${Date.now()}`, // Temporary ID for new pages
      title: newPageData.title.trim(),
      slug: slug,
      contentType: 'table',
      isNew: true
    };
    
    onSelection(selectedDomain, pageData);
    setNewPageData({ title: '', slug: '' });
    setShowCreateForm(false);
  };

  // Auto-generate slug from title
  useEffect(() => {
    if (newPageData.title && !newPageData.slug) {
      const autoSlug = newPageData.title.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setNewPageData(prev => ({ ...prev, slug: autoSlug }));
    }
  }, [newPageData.title, newPageData.slug]);

  return (
    <div className="space-y-6">
      
      {/* Step Description */}
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Choose Where to Create Your Table
        </h3>
        <p className="text-gray-600">
          Select a domain and page where your new data table will be displayed.
        </p>
      </div>

      {/* Domain Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            🌐 Step 1: Select Domain
          </CardTitle>
        </CardHeader>
        <CardContent>
          
          {/* Search */}
          <div className="mb-4">
            <Label htmlFor="domain-search">Search Domains</Label>
            <Input
              id="domain-search"
              placeholder="Search by domain name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Domain Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredDomains.map(domain => {
              const tablePagesCount = domain.pages.filter(p => p.contentType === 'table').length;
              const availablePagesCount = domain.pages.filter(p => 
                p.contentType === 'table' || (p.contentType === 'narrative' && !p.table)
              ).length;
              
              return (
                <div
                  key={domain.id}
                  onClick={() => handleDomainSelect(domain)}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedDomain?.id === domain.id
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{domain.name}</h4>
                    {selectedDomain?.id === domain.id && (
                      <Badge variant="default">Selected</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">/{domain.slug}</p>
                  <div className="text-xs text-gray-500">
                    {tablePagesCount} table pages • {availablePagesCount} available pages
                  </div>
                </div>
              );
            })}
          </div>

          {filteredDomains.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">🔍</div>
              <p>No domains found matching "{searchTerm}"</p>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Page Selection */}
      {selectedDomain && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>📄 Step 2: Select or Create Page</span>
              <Badge variant="outline">{selectedDomain.name}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            
            {/* Existing Pages */}
            {availablePages.length > 0 && (
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-3">Choose Existing Page</h4>
                <div className="space-y-2">
                  {availablePages.map(page => {
                    const hasTable = !!page.table;
                    const canUse = page.contentType === 'table' || 
                      (page.contentType === 'narrative' && !hasTable);
                    
                    return (
                      <div
                        key={page.id}
                        onClick={() => canUse && handlePageSelect(page)}
                        className={`p-3 border rounded-lg flex items-center justify-between ${
                          canUse
                            ? selectedPage?.id === page.id
                              ? 'border-blue-500 bg-blue-50 cursor-pointer'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
                            : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-60'
                        }`}
                      >
                        <div>
                          <div className="flex items-center space-x-2">
                            <h5 className="font-medium text-gray-900">{page.title}</h5>
                            <Badge 
                              variant={page.contentType === 'table' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {page.contentType}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">/{page.slug}</p>
                          {hasTable && (
                            <p className="text-xs text-orange-600">
                              ⚠️ Already has table: {page.table?.name}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {selectedPage?.id === page.id && (
                            <Badge variant="default">Selected</Badge>
                          )}
                          {!canUse && (
                            <Badge variant="secondary">Unavailable</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <Separator className="my-6" />

            {/* Create New Page */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">Create New Page</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateForm(!showCreateForm)}
                >
                  {showCreateForm ? 'Cancel' : '+ New Page'}
                </Button>
              </div>

              {showCreateForm && (
                <div className="space-y-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div>
                    <Label htmlFor="page-title">Page Title</Label>
                    <Input
                      id="page-title"
                      placeholder="e.g., Course Recommendations"
                      value={newPageData.title}
                      onChange={(e) => setNewPageData(prev => ({ ...prev, title: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="page-slug">Page Slug</Label>
                    <Input
                      id="page-slug"
                      placeholder="e.g., course-recommendations"
                      value={newPageData.slug}
                      onChange={(e) => setNewPageData(prev => ({ ...prev, slug: e.target.value }))}
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      URL: /domain/{selectedDomain.slug}/{newPageData.slug || 'page-slug'}
                    </p>
                  </div>

                  <Button
                    onClick={handleCreateNewPage}
                    disabled={!newPageData.title.trim()}
                    className="w-full"
                  >
                    Create Page for Table
                  </Button>
                </div>
              )}
            </div>

          </CardContent>
        </Card>
      )}

      {/* Selection Summary */}
      {selectedDomain && selectedPage && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <div className="text-2xl">✅</div>
              <div>
                <h4 className="font-medium text-green-900">Selection Complete</h4>
                <p className="text-green-700 text-sm mt-1">
                  <span className="font-medium">Domain:</span> {selectedDomain.name} • 
                  <span className="font-medium ml-2">Page:</span> {selectedPage.title}
                  {selectedPage.isNew && <Badge variant="secondary" className="ml-2">New Page</Badge>}
                </p>
                <p className="text-green-600 text-xs mt-1">
                  Table URL: /domain/{selectedDomain.slug}/{selectedPage.slug}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
