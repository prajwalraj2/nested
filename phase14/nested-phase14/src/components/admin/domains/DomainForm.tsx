'use client';

import { useState } from 'react';
import { Roboto } from 'next/font/google';
import { SUPPORTED_COUNTRIES, ALL_COUNTRIES, getCountryOptions } from '@/lib/countries';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});

/**
 * Domain Form Component
 * 
 * Handles creating and editing content domains with:
 * - Domain name and auto-generated slug
 * - Category assignment (required)
 * - Page type selection (direct vs hierarchical)
 * - Publication status control
 * - SEO metadata fields
 * - Order within category management
 * 
 * Form validates required fields and provides user feedback
 * Supports both create and edit modes
 */

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  columnPosition: number;
};

type DomainFormProps = {
  categories: Category[];
  domain?: {
    id: string;
    name: string;
    slug: string;
    pageType: string;
    categoryId: string;
    orderInCategory: number;
    isPublished: boolean;
    targetCountries?: string[];
  } | null; // null for create mode, object for edit mode
  onSuccess?: () => void; // Callback after successful save
  onCancel?: () => void;  // Callback for cancel action
};

// Get country options for display
const countryOptions = getCountryOptions();

export function DomainForm({ categories, domain = null, onSuccess, onCancel }: DomainFormProps) {
  // Form state - initialize with domain data if editing, defaults if creating
  const [formData, setFormData] = useState({
    name: domain?.name || '',
    slug: domain?.slug || '',
    pageType: domain?.pageType || 'direct',
    categoryId: domain?.categoryId || (categories[0]?.id || ''),
    orderInCategory: domain?.orderInCategory || 0,
    isPublished: domain?.isPublished ?? false,
    targetCountries: domain?.targetCountries || [ALL_COUNTRIES]
  });
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine if we're in edit mode or create mode
  const isEditMode = domain !== null;

  /**
   * Handle form field changes
   * Auto-generates slug when name changes
   */
  const handleChange = (field: string, value: string | number | boolean | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      // Auto-generate slug when name changes (only in create mode)
      ...(field === 'name' && !isEditMode && {
        slug: generateSlug(value as string)
      })
    }));
    
    // Clear error when user starts typing
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
   * Generate URL-friendly slug from domain name
   */
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')     // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, '')        // Remove leading/trailing hyphens
      .substring(0, 50);               // Limit length
  };

  /**
   * Validate form data before submission
   */
  const validateForm = (): string | null => {
    if (!formData.name.trim()) {
      return 'Domain name is required';
    }
    
    if (!formData.slug.trim()) {
      return 'Domain slug is required';
    }
    
    if (!formData.categoryId) {
      return 'Category selection is required';
    }
    
    if (!['direct', 'hierarchical'].includes(formData.pageType)) {
      return 'Page type must be either "direct" or "hierarchical"';
    }
    
    // Validate slug format
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(formData.slug)) {
      return 'Slug must contain only lowercase letters, numbers, and hyphens';
    }
    
    return null; // No errors
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Prepare data for API
      const submitData = {
        ...formData,
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        orderInCategory: parseInt(formData.orderInCategory.toString())
      };

      // Make API call (create or update)
      const url = isEditMode ? `/api/admin/domains/${domain.id}` : '/api/admin/domains';
      const method = isEditMode ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${isEditMode ? 'update' : 'create'} domain`);
      }

      // Success! Reset form if creating, call success callback
      if (!isEditMode) {
        setFormData({
          name: '',
          slug: '',
          pageType: 'direct',
          categoryId: categories[0]?.id || '',
          orderInCategory: 0,
          isPublished: false,
          targetCountries: [ALL_COUNTRIES]
        });
      }
      
      if (onSuccess) {
        onSuccess();
      } else if (!isEditMode) {
        // Only show alert and reload for create mode when no onSuccess callback
        alert(`Domain ${isEditMode ? 'updated' : 'created'} successfully!`);
        window.location.reload();
      }
      
    } catch (err) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} domain:`, err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      
      {/* Form Fields Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Domain Name */}
        <div className="lg:col-span-2">
          <label htmlFor="name" className={`block text-sm font-medium text-black mb-2 ${roboto.className}`}>
            Domain Name *
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g., Graphic Design, Web Development"
            className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent bg-gray-200 text-gray-800"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Descriptive name shown to users
          </p>
        </div>

        {/* Domain Slug */}
        <div>
          <label htmlFor="slug" className={`block text-sm font-medium text-black mb-2 ${roboto.className}`}>
            URL Slug *
          </label>
          <input
            id="slug"
            type="text"
            value={formData.slug}
            onChange={(e) => handleChange('slug', e.target.value)}
            placeholder="e.g., graphic-design"
            className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent bg-gray-200 text-gray-800"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            {isEditMode ? 'URL identifier (be careful changing this)' : 'Auto-generated from name'}
          </p>
        </div>

        {/* Category Assignment */}
        <div>
          <label htmlFor="categoryId" className={`block text-sm font-medium text-black mb-2 ${roboto.className}`}>
            Category *
          </label>
          <select
            id="categoryId"
            value={formData.categoryId}
            onChange={(e) => handleChange('categoryId', e.target.value)}
            className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent bg-gray-200 text-gray-800"
            required
          >
            <option value="" disabled>Select a category</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.icon && `${category.icon} `}{category.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Which category this domain belongs to
          </p>
        </div>

        {/* Page Type */}
        <div>
          <label htmlFor="pageType" className={`block text-sm font-medium text-black mb-2 ${roboto.className}`}>
            Page Type *
          </label>
          <select
            id="pageType"
            value={formData.pageType}
            onChange={(e) => handleChange('pageType', e.target.value)}
            className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent bg-gray-200 text-gray-800"
            required
          >
            <option value="direct">Direct Content</option>
            <option value="hierarchical">Hierarchical Structure</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Content organization structure
          </p>
        </div>

        {/* Order in Category */}
        <div>
          <label htmlFor="orderInCategory" className={`block text-sm font-medium text-black mb-2 ${roboto.className}`}>
            Display Order
          </label>
          <input
            id="orderInCategory"
            type="number"
            min="0"
            value={formData.orderInCategory}
            onChange={(e) => handleChange('orderInCategory', parseInt(e.target.value) || 0)}
            placeholder="0"
            className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent bg-gray-200 text-gray-800"
          />
          <p className="text-xs text-gray-500 mt-1">
            Order within category (0 = first)
          </p>
        </div>

      </div>

      {/* Target Countries Selection */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="mb-3">
          <h4 className={`text-sm font-medium text-black ${roboto.className}`}>
            🌍 Target Countries
          </h4>
          <p className="text-xs text-gray-500 mt-1">
            Select which countries this domain should be visible to
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

      {/* Publication Status */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h4 className={`text-sm font-medium text-black ${roboto.className}`}>
              Publication Status
            </h4>
            <p className="text-xs text-gray-500 mt-1">
              Control whether this domain is visible to users
            </p>
          </div>
          
          <div className="flex items-center">
            <input
              id="isPublished"
              type="checkbox"
              checked={formData.isPublished}
              onChange={(e) => handleChange('isPublished', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-gray-300 border-gray-300 rounded bg-gray-200"
            />
            <label htmlFor="isPublished" className={`ml-2 text-sm ${roboto.className}`}>
              <span className={formData.isPublished ? 'text-green-700 font-medium' : 'text-gray-700'}>
                {formData.isPublished ? '✅ Published (Live)' : '📝 Draft (Hidden)'}
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Preview Information */}
      {formData.slug && (
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <h4 className={`text-sm font-medium text-blue-900 mb-2 ${roboto.className}`}>
            🔗 Domain Preview
          </h4>
          <div className="text-sm text-blue-800 space-y-1">
            <div><strong>URL:</strong> <code>/domain/{formData.slug}</code></div>
            <div><strong>Type:</strong> {formData.pageType === 'direct' ? 'Direct content page' : 'Hierarchical with subcategories'}</div>
            {categories.find(c => c.id === formData.categoryId) && (
              <div><strong>Category:</strong> {categories.find(c => c.id === formData.categoryId)?.name}</div>
            )}
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
        <div className="text-sm text-gray-500">
          * Required fields
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Cancel Button (only show in edit mode) */}
          {isEditMode && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}
          
          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`
              px-6 py-2 rounded-lg font-medium transition-colors cursor-pointer
              ${isLoading 
                ? 'bg-gray-400 text-gray-700 cursor-not-allowed' 
                : 'bg-green-600 text-white hover:bg-green-700'
              }
            `}
          >
            {isLoading 
              ? (isEditMode ? 'Updating...' : 'Creating...') 
              : (isEditMode ? 'Update Domain' : 'Create Domain')
            }
          </button>
        </div>
      </div>
      
    </form>
  );
}
