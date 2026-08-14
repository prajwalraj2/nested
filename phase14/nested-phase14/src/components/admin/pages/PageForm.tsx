'use client';

import { useState, useEffect } from 'react';
import { SUPPORTED_COUNTRIES, ALL_COUNTRIES, getCountryOptions } from '@/lib/countries';

// Get country options for display
const countryOptions = getCountryOptions();

/**
 * Page Form Component
 * 
 * Handles creating and editing pages with correct parent logic:
 * 
 * DIRECT DOMAINS:
 * - New pages automatically get __main__ as parent
 * - User can see available parents (including other pages)
 * - URLs: /domain/slug/page-slug
 * 
 * HIERARCHICAL DOMAINS:
 * - New pages can be root level (domain as parent) or nested
 * - User can choose any existing page as parent
 * - URLs: /domain/slug/page-slug or /domain/slug/parent/page-slug
 * 
 * Features:
 * - Smart parent selection based on domain type
 * - Auto-slug generation from title
 * - Content type selection with descriptions
 * - URL preview showing final path
 * - Validation for slug conflicts
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
  targetCountries?: string[];
  children: Page[];
  depth: number;
  fullPath: string;
  previewUrl: string;
};

type PageFormProps = {
  domain: Domain;
  pages: Page[];
  parentId?: string | null;  // Pre-selected parent
  editingPage?: Page | null; // Page being edited (null for create)
  onSuccess: () => void;
  onCancel: () => void;
};

export function PageForm({ 
  domain, 
  pages, 
  parentId = null, 
  editingPage = null, 
  onSuccess, 
  onCancel 
}: PageFormProps) {
  
  // Form state
  const [formData, setFormData] = useState({
    title: editingPage?.title || '',
    slug: editingPage?.slug || '',
    contentType: editingPage?.contentType || 'section_based',
    parentId: editingPage?.parentId || parentId || getDefaultParentId(),
    targetCountries: editingPage?.targetCountries || [ALL_COUNTRIES]
  });
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = editingPage !== null;

  /**
   * Get default parent ID based on domain type and available pages
   */
  function getDefaultParentId(): string | null {
    if (domain.pageType === 'direct') {
      // For direct domains, find __main__ page
      const mainPage = getAllPages().find(p => p.slug === '__main__');
      return mainPage?.id || null;
    } else {
      // For hierarchical domains, allow root level (no parent)
      return null;
    }
  }

  /**
   * Get all pages flattened for easier searching
   */
  function getAllPages(): Page[] {
    const flattenPages = (pageList: Page[]): Page[] => {
      let result: Page[] = [];
      pageList.forEach(page => {
        result.push(page);
        result = result.concat(flattenPages(page.children));
      });
      return result;
    };
    return flattenPages(pages);
  }

  /**
   * Content type options with descriptions
   */
  const contentTypeOptions = [
    {
      value: 'section_based',
      label: '📋 Section Based',
      description: 'Organized content blocks and sections',
      example: 'Like current domain pages with Skills, Tools, etc.'
    },
    {
      value: 'subcategory_list', 
      label: '📂 Subcategory List',
      description: 'Navigation page with links to child pages',
      example: 'Overview page that lists its sub-pages'
    },
    {
      value: 'table',
      label: '📊 Table',
      description: 'Structured data in table format',
      example: 'Pricing tables, feature comparisons, data lists'
    },
    {
      value: 'rich_text',
      label: '✍️ Rich Text',
      description: 'Long-form content with rich formatting',
      example: 'Articles, documentation, detailed guides'
    },
    {
      value: 'narrative',
      label: '📄 Narrative',
      description: 'Story-style content flow',
      example: 'Blog posts, case studies, tutorials'
    },
    {
      value: 'mixed_content',
      label: '🎨 Mixed Content',
      description: 'Combination of multiple content types',
      example: 'Complex pages with various sections'
    }
  ];

  /**
   * Handle form field changes
   */
  const handleChange = (field: string, value: string | null | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      // Auto-generate slug when title changes (only in create mode)
      ...(field === 'title' && !isEditMode && value && {
        slug: generateSlug(value as string)
      })
    }));
    
    // Clear error when user changes something
    if (error) setError(null);
  };

  /**
   * Handle country toggle for multi-select
   */
  const handleCountryToggle = (countryCode: string) => {
    setFormData(prev => {
      const currentCountries = prev.targetCountries;
      
      // Special handling for "ALL"
      if (countryCode === ALL_COUNTRIES) {
        // If ALL is being selected, clear everything else and select only ALL
        return { ...prev, targetCountries: [ALL_COUNTRIES] };
      }
      
      // If a specific country is being selected
      let newCountries: string[];
      
      if (currentCountries.includes(countryCode)) {
        // Remove the country
        newCountries = currentCountries.filter(c => c !== countryCode);
        // If nothing left, default to ALL
        if (newCountries.length === 0) {
          newCountries = [ALL_COUNTRIES];
        }
      } else {
        // Add the country
        // Remove ALL if it was selected (since we're now selecting specific countries)
        newCountries = currentCountries.filter(c => c !== ALL_COUNTRIES);
        newCountries.push(countryCode);
      }
      
      return { ...prev, targetCountries: newCountries };
    });
    
    if (error) setError(null);
  };

  /**
   * Generate URL-friendly slug from title
   */
  const generateSlug = (title: string): string => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')     // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, '')        // Remove leading/trailing hyphens
      .substring(0, 50);               // Limit length
  };

  /**
   * Get available parent options (exclude current page and descendants in edit mode)
   */
  const getParentOptions = (): Page[] => {
    const allPages = getAllPages();
    
    if (isEditMode && editingPage) {
      // In edit mode, exclude the current page and its descendants
      const excludeIds = new Set([editingPage.id]);
      
      // Add all descendant IDs
      const addDescendants = (page: Page) => {
        page.children.forEach(child => {
          excludeIds.add(child.id);
          addDescendants(child);
        });
      };
      addDescendants(editingPage);
      
      return allPages.filter(page => !excludeIds.has(page.id));
    }
    
    return allPages;
  };

  /**
   * Validate form data
   */
  const validateForm = (): string | null => {
    if (!formData.title.trim()) {
      return 'Page title is required';
    }
    
    if (!formData.slug.trim()) {
      return 'Page slug is required';
    }
    
    if (!formData.contentType) {
      return 'Content type is required';
    }
    
    // Validate slug format
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(formData.slug)) {
      return 'Slug must contain only lowercase letters, numbers, and hyphens';
    }
    
    // Check for slug conflicts within same domain and parent
    const allPages = getAllPages();
    const conflictingPage = allPages.find(page => 
      page.slug === formData.slug && 
      page.parentId === formData.parentId &&
      (!isEditMode || page.id !== editingPage?.id)
    );
    
    if (conflictingPage) {
      return `A page with slug "${formData.slug}" already exists ${formData.parentId ? 'under the same parent' : 'at the root level'}`;
    }
    
    return null;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const submitData = {
        title: formData.title.trim(),
        slug: formData.slug.trim(),
        contentType: formData.contentType,
        domainId: domain.id,
        parentId: formData.parentId || null,
        targetCountries: formData.targetCountries
      };

      const url = isEditMode ? `/api/admin/pages/${editingPage.id}` : '/api/admin/pages';
      const method = isEditMode ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${isEditMode ? 'update' : 'create'} page`);
      }

      // Success
      onSuccess();
      
    } catch (err) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} page:`, err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Build preview URL
   */
  const buildPreviewUrl = (): string => {
    if (!formData.slug) return `/domain/${domain.slug}`;
    
    const parentPage = getParentOptions().find(p => p.id === formData.parentId);
    
    if (domain.pageType === 'direct') {
      // For direct domains, if parent is __main__, just use the slug
      if (parentPage && parentPage.slug === '__main__') {
        return `/domain/${domain.slug}/${formData.slug}`;
      }
      // If not __main__, build path including parent
      if (parentPage) {
        return `/domain/${domain.slug}/${parentPage.fullPath}/${formData.slug}`;
      }
    } else {
      // For hierarchical domains, build full path
      if (parentPage) {
        return `/domain/${domain.slug}/${parentPage.fullPath}/${formData.slug}`;
      }
    }
    
    return `/domain/${domain.slug}/${formData.slug}`;
  };

  const parentOptions = getParentOptions();
  const selectedParent = parentOptions.find(p => p.id === formData.parentId);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      
      {/* Title and Slug */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Page Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            Page Title *
          </label>
          <input
            id="title"
            type="text"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="e.g., YouTube Channels, Courses, Design Tools"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
          <p className="text-xs text-gray-500 mt-1">Descriptive title shown to users</p>
        </div>

        {/* Page Slug */}
        <div>
          <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-2">
            URL Slug *
          </label>
          <input
            id="slug"
            type="text"
            value={formData.slug}
            onChange={(e) => handleChange('slug', e.target.value)}
            placeholder="e.g., youtube-channels, courses, design-tools"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            {isEditMode ? 'URL identifier (be careful changing this)' : 'Auto-generated from title'}
          </p>
        </div>

      </div>

      {/* Content Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Content Type *
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {contentTypeOptions.map((option) => (
            <label
              key={option.value}
              className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                formData.contentType === option.value
                  ? 'border-blue-600 bg-blue-50 text-blue-900'
                  : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="contentType"
                value={option.value}
                checked={formData.contentType === option.value}
                onChange={(e) => handleChange('contentType', e.target.value)}
                className="sr-only"
              />
              <div className="flex-1">
                <div className="text-sm">
                  <div className="font-medium">{option.label}</div>
                  <div className={`mt-1 ${
                    formData.contentType === option.value ? 'text-blue-700' : 'text-gray-500'
                  }`}>
                    {option.description}
                  </div>
                  <div className={`text-xs mt-1 italic ${
                    formData.contentType === option.value ? 'text-blue-600' : 'text-gray-400'
                  }`}>
                    {option.example}
                  </div>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Parent Page Selection */}
      <div>
        <label htmlFor="parentId" className="block text-sm font-medium text-gray-700 mb-2">
          Parent Page
        </label>
        <select
          id="parentId"
          value={formData.parentId || ''}
          onChange={(e) => handleChange('parentId', e.target.value || null)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">
            {domain.pageType === 'direct' 
              ? 'Default (__main__ page)' 
              : 'Root Level (No Parent)'
            }
          </option>
          {parentOptions.map((page) => (
            <option key={page.id} value={page.id}>
              {'  '.repeat(page.depth)} {page.title} ({page.slug})
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          {domain.pageType === 'direct'
            ? 'Leave default to use __main__ page, or select a specific parent'
            : 'Select a parent page for nesting, or leave empty for root level'
          }
        </p>
        
        {/* Selected Parent Info */}
        {selectedParent && (
          <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="text-sm text-purple-800">
              <strong>Parent:</strong> {selectedParent.title}
              {selectedParent.slug === '__main__' && <span className="ml-1 text-purple-600">(Hidden)</span>}
              <span className="ml-3"><strong>Depth:</strong> Level {selectedParent.depth + 1}</span>
            </div>
          </div>
        )}
      </div>

      {/* Target Countries Selection */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="mb-3">
          <h4 className="text-sm font-medium text-gray-700">
            🌍 Target Countries
          </h4>
          <p className="text-xs text-gray-500 mt-1">
            Select which countries this page should be visible to
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {countryOptions.map(country => {
            const isSelected = formData.targetCountries.includes(country.code);
            const isAll = country.code === ALL_COUNTRIES;
            
            return (
              <button
                key={country.code}
                type="button"
                onClick={() => handleCountryToggle(country.code)}
                className={`
                  px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer
                  ${isSelected 
                    ? isAll
                      ? 'bg-blue-600 text-white'
                      : 'bg-green-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }
                `}
              >
                {country.flag} {country.name}
              </button>
            );
          })}
        </div>
        
        {/* Selected Countries Summary */}
        <div className="mt-3 text-xs text-gray-600">
          <strong>Selected:</strong>{' '}
          {formData.targetCountries.includes(ALL_COUNTRIES)
            ? '🌐 All Countries (Global)'
            : formData.targetCountries.map(code => {
                const country = countryOptions.find(c => c.code === code);
                return country ? `${country.flag} ${country.name}` : code;
              }).join(', ')
          }
        </div>
      </div>

      {/* URL Preview */}
      {formData.title && formData.slug && (
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <h4 className="text-sm font-medium text-green-900 mb-2">🔗 Page Preview</h4>
          <div className="text-sm text-green-800 space-y-1">
            <div><strong>Title:</strong> {formData.title}</div>
            <div><strong>URL:</strong> <code className="bg-green-100 px-2 py-1 rounded">{buildPreviewUrl()}</code></div>
            <div><strong>Content Type:</strong> {contentTypeOptions.find(opt => opt.value === formData.contentType)?.label}</div>
            <div><strong>Parent:</strong> {selectedParent ? selectedParent.title : (domain.pageType === 'direct' ? '__main__ (Default)' : 'Root Level')}</div>
            <div><strong>Visible To:</strong> {
              formData.targetCountries.includes(ALL_COUNTRIES)
                ? '🌐 All Countries'
                : formData.targetCountries.map(code => {
                    const country = countryOptions.find(c => c.code === code);
                    return country?.flag || code;
                  }).join(' ')
            }</div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-red-500 mr-2">❌</span>
            <span className="text-red-700 text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Form Actions */}
      <div className="flex items-center justify-between pt-6 border-t border-gray-200">
        <div className="text-sm text-gray-500">* Required fields</div>
        
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={isLoading}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              isLoading 
                ? 'bg-gray-400 text-gray-700 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isLoading 
              ? (isEditMode ? 'Updating...' : 'Creating...') 
              : (isEditMode ? 'Update Page' : 'Create Page')
            }
          </button>
        </div>
      </div>
      
    </form>
  );
}
