// src/components/admin/tables/DomainPageSelector.tsx

'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, FileText, Globe, Search, SearchX } from 'lucide-react';
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

  /**
   * ⚠️ PAGE SEARCH — added on request (G-5d(ii)).
   *
   * Selecting a domain such as "Graphic Designing" lists **26 pages**, and the only way to
   * find one was to read every title top to bottom. Matches title AND slug, since either is
   * what you might remember.
   */
  const [pageSearch, setPageSearch] = useState('');

  const filteredPages = (() => {
    const term = pageSearch.trim().toLowerCase();
    if (term === '') return availablePages;

    return availablePages.filter(
      (page) =>
        page.title.toLowerCase().includes(term) || page.slug.toLowerCase().includes(term)
    );
  })();

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
    // Clear the page search too — a term left over from the previous domain would filter the
    // new domain's list down to nothing and look like it has no pages.
    setPageSearch('');
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
        <h3 className="text-xl font-semibold mb-2">
          Choose Where to Create Your Table
        </h3>
        <p className="text-muted-foreground">
          Select a domain and page where your new data table will be displayed.
        </p>
      </div>

      {/* Domain Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="size-4" aria-hidden="true" />Step 1 · Select a domain
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
                      ? 'border-primary bg-accent ring-2 ring-ring/30'
                      : 'hover:border-muted-foreground/40 hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{domain.name}</h4>
                    {selectedDomain?.id === domain.id && (
                      <Badge variant="default">Selected</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">/{domain.slug}</p>
                  <div className="text-xs text-muted-foreground">
                    {tablePagesCount} table pages • {availablePagesCount} available pages
                  </div>
                </div>
              );
            })}
          </div>

          {filteredDomains.length === 0 && (
            // A lucide icon rather than a 🔍 emoji at `text-4xl`: it inherits `currentColor`
            // so it follows the theme, and at `size-6` it stops dominating an empty state
            // whose message is the actual point.
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center">
              <SearchX className="size-6" aria-hidden="true" />
              <p className="text-sm">No domains match &ldquo;{searchTerm}&rdquo;.</p>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Page Selection */}
      {selectedDomain && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2"><FileText className="size-4" aria-hidden="true" />Step 2 · Select or create a page</span>
              <Badge variant="outline">{selectedDomain.name}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            
            {/* Existing Pages */}
            {availablePages.length > 0 && (
              <div className="mb-6">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h4 className="font-medium">Choose an existing page</h4>
                  {/*
                    Shows how much the search has narrowed things. Only when it is actually
                    filtering — "26 of 26" on every visit is noise.
                  */}
                  {pageSearch.trim() !== '' && (
                    <span className="text-muted-foreground text-xs">
                      {filteredPages.length} of {availablePages.length} pages
                    </span>
                  )}
                </div>

                {/*
                  ⚠️ PAGE SEARCH — added on request. Selecting a domain like "Graphic
                  Designing" lists **26 pages**, and the only way to find one was to read
                  every title. Matches title AND slug, because you may remember either.

                  Rendered only past a handful of pages: a search box above a two-item list
                  is chrome that cannot help.
                */}
                {availablePages.length > 5 && (
                  <div className="relative mb-3">
                    <Search
                      className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                      aria-hidden="true"
                    />
                    <Input
                      value={pageSearch}
                      onChange={(e) => setPageSearch(e.target.value)}
                      placeholder="Search pages by title or slug…"
                      className="pl-9"
                      aria-label="Search pages"
                    />
                  </div>
                )}

                {/*
                  `max-h-80 overflow-y-auto` so a 26-page domain does not push the wizard's
                  Next button far below the fold. `-mx-1 px-1` keeps the focus ring on a card
                  from being clipped by the scroll container.
                */}
                <div className="-mx-1 max-h-80 space-y-2 overflow-y-auto px-1">
                  {filteredPages.map(page => {
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
                              ? 'border-primary bg-accent cursor-pointer'
                              : 'hover:border-muted-foreground/40 hover:bg-muted/50 cursor-pointer'
                            : 'bg-muted cursor-not-allowed opacity-60'
                        }`}
                      >
                        <div>
                          <div className="flex items-center space-x-2">
                            <h5 className="font-medium">{page.title}</h5>
                            <Badge 
                              variant={page.contentType === 'table' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {page.contentType}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">/{page.slug}</p>
                          {hasTable && (
                            // ⚠️ Was `text-orange-600` with a ⚠️ emoji — a colour my sweep
                            // missed because the pattern did not include orange. `destructive`
                            // is the theme's "this blocks you" colour, and a lucide icon
                            // inherits it instead of ignoring the theme.
                            <p className="text-destructive flex items-center gap-1 text-xs">
                              <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
                              Already has a table: {page.table?.name}
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

                  {/*
                    Only reachable when the search filtered everything out — the surrounding
                    block already requires `availablePages.length > 0`, so "this domain has no
                    pages" is a different case and cannot land here.
                  */}
                  {filteredPages.length === 0 && (
                    <div className="text-muted-foreground flex flex-col items-center gap-2 py-6 text-center">
                      <SearchX className="size-5" aria-hidden="true" />
                      <p className="text-sm">No pages match &ldquo;{pageSearch}&rdquo;.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <Separator className="my-6" />

            {/* Create New Page */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Create New Page</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateForm(!showCreateForm)}
                >
                  {showCreateForm ? 'Cancel' : '+ New Page'}
                </Button>
              </div>

              {showCreateForm && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
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
                    <p className="text-xs text-muted-foreground mt-1">
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
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <div className="text-2xl">✅</div>
              <div>
                <h4 className="font-medium">Selection Complete</h4>
                <p className="text-muted-foreground text-sm mt-1">
                  <span className="font-medium">Domain:</span> {selectedDomain.name} • 
                  <span className="font-medium ml-2">Page:</span> {selectedPage.title}
                  {selectedPage.isNew && <Badge variant="secondary" className="ml-2">New Page</Badge>}
                </p>
                <p className="text-muted-foreground text-xs mt-1">
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
