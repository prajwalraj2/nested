'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Roboto } from 'next/font/google';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});

/**
 * Domain Filters Component
 * 
 * Provides filtering and search capabilities for domains:
 * - Text search across name and slug
 * - Category-based filtering
 * - Publication status filtering (all, published, draft)
 * - Page type filtering (all, direct, hierarchical)
 * - Clear all filters functionality
 * - URL-based filter persistence
 * 
 * Uses Next.js router for filter state management in URL params
 */

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  columnPosition: number;
};

type CurrentFilters = {
  search?: string;
  category?: string;
  status?: string;
  pageType?: string;
};

type DomainFiltersProps = {
  categories: Category[];
  currentFilters: CurrentFilters;
};

export function DomainFilters({ categories, currentFilters }: DomainFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  
  // Local state for search input (for better UX)
  const [searchInput, setSearchInput] = useState(currentFilters.search || '');

  /**
   * Update URL with new filter parameters
   */
  const updateFilters = (newFilters: Partial<CurrentFilters>) => {
    const params = new URLSearchParams(searchParams.toString());
    
    // Update or remove filter parameters
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value && value !== '') {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    
    // Navigate with new parameters
    startTransition(() => {
      router.push(`/admin/domains?${params.toString()}`);
    });
  };

  /**
   * Handle search input change with debouncing
   */
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
  };

  /**
   * Submit search when user presses enter or clicks search button
   */
  const handleSearchSubmit = () => {
    updateFilters({ search: searchInput });
  };

  /**
   * Handle enter key in search input
   */
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearchSubmit();
    }
  };

  /**
   * Clear all filters
   */
  const clearAllFilters = () => {
    setSearchInput('');
    startTransition(() => {
      router.push('/admin/domains');
    });
  };

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = Object.values(currentFilters).some(value => value && value !== '');

  return (
    <div className="space-y-4">
      
      {/* Search Bar */}
      <div className="flex items-center space-x-3">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-400 text-sm">🔍</span>
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search domains by name or slug..."
            className={`
              w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg 
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              ${isPending ? 'opacity-75' : ''}
            `}
          />
        </div>
        
        <button
          onClick={handleSearchSubmit}
          disabled={isPending}
          className={`
            px-4 py-2 bg-blue-600 text-white rounded-lg font-medium transition-colors
            ${isPending ? 'opacity-75 cursor-not-allowed' : 'hover:bg-blue-700'}
          `}
        >
          Search
        </button>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-4">
        
        {/* Category Filter */}
        <div className="flex-1 min-w-48">
          <label className={`block text-xs font-medium text-gray-700 mb-1 ${roboto.className}`}>
            Filter by Category
          </label>
          <select
            value={currentFilters.category || ''}
            onChange={(e) => updateFilters({ category: e.target.value })}
            disabled={isPending}
            className={`
              w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              ${isPending ? 'opacity-75 cursor-not-allowed' : ''}
            `}
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.icon && `${category.icon} `}{category.name}
              </option>
            ))}
          </select>
        </div>

        {/* Publication Status Filter */}
        <div className="flex-1 min-w-32">
          <label className={`block text-xs font-medium text-gray-700 mb-1 ${roboto.className}`}>
            Publication Status
          </label>
          <select
            value={currentFilters.status || ''}
            onChange={(e) => updateFilters({ status: e.target.value })}
            disabled={isPending}
            className={`
              w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              ${isPending ? 'opacity-75 cursor-not-allowed' : ''}
            `}
          >
            <option value="">All Status</option>
            <option value="published">✅ Published</option>
            <option value="draft">📝 Draft</option>
          </select>
        </div>

        {/* Page Type Filter */}
        <div className="flex-1 min-w-32">
          <label className={`block text-xs font-medium text-gray-700 mb-1 ${roboto.className}`}>
            Page Type
          </label>
          <select
            value={currentFilters.pageType || ''}
            onChange={(e) => updateFilters({ pageType: e.target.value })}
            disabled={isPending}
            className={`
              w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              ${isPending ? 'opacity-75 cursor-not-allowed' : ''}
            `}
          >
            <option value="">All Types</option>
            <option value="direct">🎯 Direct</option>
            <option value="hierarchical">🏗️ Hierarchical</option>
          </select>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <div className="flex-shrink-0">
            <label className="block text-xs text-transparent mb-1">.</label>
            <button
              onClick={clearAllFilters}
              disabled={isPending}
              className={`
                px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg transition-colors
                ${isPending ? 'opacity-75 cursor-not-allowed' : 'hover:bg-gray-50'}
              `}
            >
              🗑️ Clear All
            </button>
          </div>
        )}
        
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex items-center space-x-2 text-sm">
          <span className="text-gray-500 font-medium">Active filters:</span>
          
          {currentFilters.search && (
            <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-md">
              Search: "{currentFilters.search}"
              <button 
                onClick={() => {
                  setSearchInput('');
                  updateFilters({ search: '' });
                }}
                className="ml-1 hover:text-blue-600"
              >
                ×
              </button>
            </span>
          )}
          
          {currentFilters.category && (
            <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 rounded-md">
              Category: {categories.find(c => c.id === currentFilters.category)?.name || 'Unknown'}
              <button 
                onClick={() => updateFilters({ category: '' })}
                className="ml-1 hover:text-purple-600"
              >
                ×
              </button>
            </span>
          )}
          
          {currentFilters.status && (
            <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-md">
              Status: {currentFilters.status === 'published' ? 'Published' : 'Draft'}
              <button 
                onClick={() => updateFilters({ status: '' })}
                className="ml-1 hover:text-green-600"
              >
                ×
              </button>
            </span>
          )}
          
          {currentFilters.pageType && (
            <span className="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-800 rounded-md">
              Type: {currentFilters.pageType === 'direct' ? 'Direct' : 'Hierarchical'}
              <button 
                onClick={() => updateFilters({ pageType: '' })}
                className="ml-1 hover:text-orange-600"
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}

      {/* Loading Indicator */}
      {isPending && (
        <div className="flex items-center justify-center py-2">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>Updating filters...</span>
          </div>
        </div>
      )}
      
    </div>
  );
}
