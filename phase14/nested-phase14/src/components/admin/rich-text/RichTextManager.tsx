// src/components/admin/rich-text/RichTextManager.tsx

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * Rich Text Management Interface
 * 
 * Workflow:
 * 1. Select Domain → Auto-load pages with contentType="rich_text"
 * 2. Display table of rich text pages
 * 3. Show content status (empty/has content)
 * 4. Provide edit buttons for each page
 */

interface Domain {
  id: string;
  name: string;
  slug: string;
}

interface RichTextPage {
  id: string;
  title: string;
  slug: string;
  domain: {
    name: string;
    slug: string;
  };
  richTextContent: {
    id: string;
    htmlContent: string;
    wordCount: number;
    updatedAt: string;
  } | null;
  updatedAt: string;
}

export function RichTextManager() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState<string>('');
  const [richTextPages, setRichTextPages] = useState<RichTextPage[]>([]);
  const [loading, setLoading] = useState({
    domains: false,
    pages: false,
  });
  const [error, setError] = useState<string>('');

  // Load domains on component mount
  useEffect(() => {
    loadDomains();
  }, []);

  // Load pages when domain changes
  useEffect(() => {
    if (selectedDomainId) {
      loadRichTextPages(selectedDomainId);
    } else {
      setRichTextPages([]);
    }
  }, [selectedDomainId]);

  const loadDomains = async () => {
    setLoading(prev => ({ ...prev, domains: true }));
    setError('');
    
    try {
      const response = await fetch('/api/admin/domains');
      if (!response.ok) throw new Error('Failed to fetch domains');
      
      const data = await response.json();
      setDomains(data.domains || []);
    } catch (err) {
      setError('Failed to load domains. Please try again.');
      console.error('Error loading domains:', err);
    } finally {
      setLoading(prev => ({ ...prev, domains: false }));
    }
  };

  const loadRichTextPages = async (domainId: string) => {
    setLoading(prev => ({ ...prev, pages: true }));
    setError('');
    
    try {
      const response = await fetch(`/api/admin/rich-text?domainId=${domainId}`);
      if (!response.ok) throw new Error('Failed to fetch rich text pages');
      
      const data = await response.json();
      setRichTextPages(data.pages || []);
    } catch (err) {
      setError('Failed to load rich text pages. Please try again.');
      console.error('Error loading rich text pages:', err);
    } finally {
      setLoading(prev => ({ ...prev, pages: false }));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="p-6">
      {/* Domain Selection */}
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Domain
            </label>
            <Select
              value={selectedDomainId}
              onValueChange={setSelectedDomainId}
              disabled={loading.domains}
            >
              <SelectTrigger className="w-full">
                <SelectValue 
                  placeholder={loading.domains ? "Loading domains..." : "Choose a domain"} 
                />
              </SelectTrigger>
              <SelectContent>
                {domains.map((domain) => (
                  <SelectItem key={domain.id} value={domain.id}>
                    <div className="flex items-center gap-2">
                      <span>🌐</span>
                      <span>{domain.name}</span>
                      <span className="text-gray-500">({domain.slug})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <span className="text-red-400 text-xl mr-3">⚠️</span>
            <div>
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-600">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Rich Text Pages List */}
      {selectedDomainId && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              📄 Rich Text Pages
            </h2>
            <Badge variant="outline" className="text-sm">
              {richTextPages.length} page{richTextPages.length !== 1 ? 's' : ''} found
            </Badge>
          </div>

          {loading.pages ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center gap-2 text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600"></div>
                Loading rich text pages...
              </div>
            </div>
          ) : richTextPages.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardHeader>
                <CardTitle className="text-gray-500 text-center">
                  📝 No Rich Text Pages Found
                </CardTitle>
                <CardDescription className="text-center">
                  No pages with contentType "rich_text" found in the selected domain.
                  <br />
                  Create pages with rich text content type in the Pages section first.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="space-y-4">
              {richTextPages.map((page) => (
                <Card key={page.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <CardTitle className="text-lg">{page.title}</CardTitle>
                          {page.richTextContent ? (
                            <Badge className="bg-green-100 text-green-800 border-green-300">
                              ✅ Has Content
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-orange-300 text-orange-700">
                              📝 Empty
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          <span>/{page.domain.slug}/{page.slug}</span>
                          {page.richTextContent && (
                            <span className="ml-4">
                              • {page.richTextContent.wordCount} words
                              • Updated {formatDate(page.richTextContent.updatedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href={`/domain/${page.domain.slug}/${page.slug}`} target="_blank">
                          <Button variant="outline" size="sm">
                            👁️ Preview
                          </Button>
                        </Link>
                        <Link href={`/admin/rich-text/edit/${page.id}`}>
                          <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                            ✏️ Edit HTML
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardHeader>
                  {page.richTextContent?.htmlContent && (
                    <CardContent className="pt-0">
                      <div className="bg-gray-50 p-3 rounded border">
                        <p className="text-xs text-gray-500 mb-2">HTML Preview:</p>
                        <div className="text-sm text-gray-700 font-mono bg-white p-2 rounded border max-h-20 overflow-hidden">
                          {page.richTextContent.htmlContent.slice(0, 200)}
                          {page.richTextContent.htmlContent.length > 200 && '...'}
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Helper Text */}
      {!selectedDomainId && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📝</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Select a Domain to Get Started
          </h3>
          <p className="text-gray-600 max-w-md mx-auto">
            Choose a domain from the dropdown above to view and manage 
            all rich text pages within that domain.
          </p>
        </div>
      )}
    </div>
  );
}
