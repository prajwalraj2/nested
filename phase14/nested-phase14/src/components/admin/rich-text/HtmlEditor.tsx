// src/components/admin/rich-text/HtmlEditor.tsx

'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

/**
 * HTML Editor Component
 * 
 * Features:
 * - Large textarea for direct HTML editing
 * - Auto-save functionality with debouncing
 * - Live preview in separate panel
 * - Content statistics (word count, characters)
 * - Page information display
 * - Error handling and feedback
 */

interface PageData {
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
    title: string | null;
    wordCount: number;
    updatedAt: string;
  } | null;
}

interface HtmlEditorProps {
  pageId: string;
}

export function HtmlEditor({ pageId }: HtmlEditorProps) {
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [htmlContent, setHtmlContent] = useState('');
  const [contentTitle, setContentTitle] = useState('');
  const [loading, setLoading] = useState({
    page: true,
    saving: false,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [stats, setStats] = useState({
    words: 0,
    characters: 0,
    charactersNoSpaces: 0,
  });

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const hasUnsavedChanges = useRef(false);

  // Load page data on mount
  useEffect(() => {
    loadPageData();
  }, [pageId]);

  // Auto-save functionality
  useEffect(() => {
    if (hasUnsavedChanges.current && htmlContent) {
      // Clear existing timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      // Set new timeout for auto-save (3 seconds)
      autoSaveTimeoutRef.current = setTimeout(() => {
        saveContent();
      }, 3000);
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [htmlContent, contentTitle]);

  // Update stats when content changes
  useEffect(() => {
    updateStats(htmlContent);
  }, [htmlContent]);

  const loadPageData = async () => {
    setLoading(prev => ({ ...prev, page: true }));
    setError('');

    try {
      const response = await fetch(`/api/admin/rich-text/${pageId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load page');
      }

      const data = await response.json();
      setPageData(data.page);
      
      // Set initial content
      setHtmlContent(data.page.richTextContent?.htmlContent || '');
      setContentTitle(data.page.richTextContent?.title || '');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load page data');
    } finally {
      setLoading(prev => ({ ...prev, page: false }));
    }
  };

  const saveContent = async () => {
    if (!htmlContent.trim()) return;

    setLoading(prev => ({ ...prev, saving: true }));
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/admin/rich-text/${pageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          htmlContent: htmlContent.trim(),
          title: contentTitle.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save content');
      }

      const data = await response.json();
      setSuccess('Content saved successfully!');
      hasUnsavedChanges.current = false;
      
      // Update page data with new info
      if (pageData) {
        setPageData({
          ...pageData,
          richTextContent: data.richTextContent
        });
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save content');
    } finally {
      setLoading(prev => ({ ...prev, saving: false }));
    }
  };

  const updateStats = (content: string) => {
    const plainText = content.replace(/<[^>]*>/g, '').trim();
    const words = plainText ? plainText.split(/\s+/).length : 0;
    const characters = content.length;
    const charactersNoSpaces = content.replace(/\s/g, '').length;

    setStats({
      words,
      characters,
      charactersNoSpaces,
    });
  };

  const handleContentChange = (value: string) => {
    setHtmlContent(value);
    hasUnsavedChanges.current = true;
    setSuccess(''); // Clear success message when editing
  };

  const handleTitleChange = (value: string) => {
    setContentTitle(value);
    hasUnsavedChanges.current = true;
    setSuccess('');
  };

  const insertSampleTemplate = () => {
    const sampleHtml = `<div>
    <h5 class="mt-5 mb-2 font-[verdana]">✅ Step 1: Getting Started</h5>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 my-3 font-[verdana]">
        <ul class="list-disc pl-6">
            <li class="pb-2">First item here</li>
            <li class="pb-2">Second item here</li>
            <li class="pb-2">Third item here</li>
        </ul>
        <ul class="list-disc pl-6">
            <li class="pb-2">Fourth item here</li>
            <li class="pb-2">Fifth item here</li>
            <li class="pb-2">Sixth item here</li>
        </ul>
        <ul class="list-disc pl-6">
            <li class="pb-2">Seventh item here</li>
            <li class="pb-2">Eighth item here</li>
            <li class="pb-2">And many more.</li>
        </ul>
    </div>
    
    <h5 class="mt-5 mb-2 font-[verdana]">✅ Step 2: Next Steps</h5>
    <ul class="list-disc pl-6 font-[verdana]">
        <li class="pb-2 text-justify">Add your content description here.</li>
        <li class="pb-2 text-justify">More detailed information...</li>
    </ul>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 my-3 font-[verdana]">
        <div>
            <h6>🎯 Category Title</h6>
            <hr class="border-t border-[#afb6b5] mt-0" />
            <ul class="list-disc pl-6">
                <li><a href="https://example.com" target="_blank" class="text-[#afb6b5] underline">Link 1</a></li>
                <li><a href="https://example.com" target="_blank" class="text-[#afb6b5] underline">Link 2</a></li>
            </ul>
        </div>
        <div>
            <h6>📊 Another Category</h6>
            <hr class="border-t border-[#afb6b5] mt-0" />
            <ul class="list-disc pl-6">
                <li><a href="https://example.com" target="_blank" class="text-[#afb6b5] underline">Link 3</a></li>
                <li><a href="https://example.com" target="_blank" class="text-[#afb6b5] underline">Link 4</a></li>
            </ul>
        </div>
    </div>
</div>`;
    setHtmlContent(sampleHtml);
    hasUnsavedChanges.current = true;
  };

  if (loading.page) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center gap-2 text-gray-600">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600"></div>
          Loading page data...
        </div>
      </div>
    );
  }

  if (error && !pageData) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-red-400 text-xl mr-3">⚠️</span>
            <div>
              <p className="text-red-800 font-medium">Error Loading Page</p>
              <p className="text-red-600">{error}</p>
            </div>
          </div>
          <Button 
            onClick={loadPageData} 
            className="mt-4 bg-red-600 hover:bg-red-700"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      {pageData && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {pageData.title}
              </h2>
              <div className="text-sm text-gray-600">
                <span>/{pageData.domain.slug}/{pageData.slug}</span>
                <span className="ml-2">• {pageData.domain.name}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Rich Text Page</Badge>
              {pageData.richTextContent && (
                <Badge className="bg-green-100 text-green-800 border-green-300">
                  Has Content
                </Badge>
              )}
            </div>
          </div>
          <Separator />
        </div>
      )}

      {/* Status Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <span className="text-red-400 text-xl mr-3">⚠️</span>
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <span className="text-green-400 text-xl mr-3">✅</span>
            <p className="text-green-800">{success}</p>
          </div>
        </div>
      )}

      {/* Editor Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Content Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Content Title (Optional)
            </label>
            <Input
              value={contentTitle}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Enter a title for this content..."
              className="w-full"
            />
          </div>

          {/* HTML Content Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                HTML Content
              </label>
              <div className="flex items-center gap-2">
                <Button
                  onClick={insertSampleTemplate}
                  variant="outline"
                  size="sm"
                >
                  📋 Insert Template
                </Button>
                <Button
                  onClick={() => setShowPreview(!showPreview)}
                  variant="outline"
                  size="sm"
                >
                  {showPreview ? '✏️ Edit' : '👁️ Preview'}
                </Button>
              </div>
            </div>

            {showPreview ? (
              <div className="border rounded-lg p-4 bg-gray-50 min-h-[500px]">
                <div className="bg-white p-6 rounded border">
                  <div 
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: htmlContent }}
                  />
                </div>
              </div>
            ) : (
              <Textarea
                value={htmlContent}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Enter your HTML content here..."
                className="min-h-[500px] font-mono text-sm"
                style={{ fontFamily: 'Monaco, Menlo, Consolas, monospace' }}
              />
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              onClick={saveContent}
              disabled={loading.saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading.saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Saving...
                </>
              ) : (
                <>💾 Save Content</>
              )}
            </Button>
            
            {pageData && (
              <Button
                onClick={() => window.open(`/domain/${pageData.domain.slug}/${pageData.slug}`, '_blank')}
                variant="outline"
              >
                🔗 View Live Page
              </Button>
            )}
          </div>
        </div>

        {/* Statistics and Help Panel */}
        <div className="space-y-4">
          {/* Content Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📊 Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Words:</span>
                <Badge variant="outline">{stats.words}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Characters:</span>
                <Badge variant="outline">{stats.characters}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">No Spaces:</span>
                <Badge variant="outline">{stats.charactersNoSpaces}</Badge>
              </div>
              {pageData?.richTextContent && (
                <div className="pt-2 border-t">
                  <div className="text-xs text-gray-500">
                    Last updated: {new Date(pageData.richTextContent.updatedAt).toLocaleString()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Help */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">💡 Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <p className="font-medium text-gray-800">Auto-save:</p>
                <p className="text-gray-600">Changes save automatically after 3 seconds</p>
              </div>
              <div>
                <p className="font-medium text-gray-800">Tailwind CSS:</p>
                <p className="text-gray-600">Use any Tailwind classes for styling</p>
              </div>
              <div>
                <p className="font-medium text-gray-800">Preview:</p>
                <p className="text-gray-600">Toggle preview to see rendered output</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
