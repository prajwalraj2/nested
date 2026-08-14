'use client';

import { useState } from 'react';
import { Roboto } from 'next/font/google';
const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});

/**
 * Category Form Component
 * 
 * Handles creating and editing domain categories with:
 * - Category name and auto-generated slug
 * - Icon selection (emoji picker or text input)
 * - Description (optional)
 * - Column position selection (1, 2, or 3)
 * - Active/inactive status toggle
 * 
 * Form validates required fields and provides user feedback
 * Supports both create and edit modes
 */

type CategoryFormProps = {
  category?: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    description: string | null;
    columnPosition: number;
    isActive: boolean;
  } | null; // null for create mode, object for edit mode
  onSuccess?: () => void; // Callback after successful save
  onCancel?: () => void;  // Callback for cancel action
};

export function CategoryForm({ category = null, onSuccess, onCancel }: CategoryFormProps) {
  // Form state - initialize with category data if editing, defaults if creating
  const [formData, setFormData] = useState({
    name: category?.name || '',
    slug: category?.slug || '',
    icon: category?.icon || '',
    description: category?.description || '',
    columnPosition: category?.columnPosition || 1,
    isActive: category?.isActive ?? true
  });
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine if we're in edit mode or create mode
  const isEditMode = category !== null;

  /**
   * Handle form field changes
   * Auto-generates slug when name changes
   */
  const handleChange = (field: string, value: string | number | boolean) => {
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
   * Generate URL-friendly slug from category name
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
      return 'Category name is required';
    }
    
    if (!formData.slug.trim()) {
      return 'Category slug is required';
    }
    
    if (formData.columnPosition < 1 || formData.columnPosition > 3) {
      return 'Column position must be 1, 2, or 3';
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
        description: formData.description.trim() || null,
        icon: formData.icon.trim() || null
      };

      // Make API call (create or update)
      const url = isEditMode ? `/api/admin/categories/${category.id}` : '/api/admin/categories';
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
        throw new Error(errorData.message || `Failed to ${isEditMode ? 'update' : 'create'} category`);
      }

      // Success! Reset form if creating, call success callback
      if (!isEditMode) {
        setFormData({
          name: '',
          slug: '',
          icon: '',
          description: '',
          columnPosition: 1,
          isActive: true
        });
      }
      
      if (onSuccess) {
        onSuccess();
      } else if (!isEditMode) {
        // Only show alert and reload for create mode when no onSuccess callback
        alert(`Category ${isEditMode ? 'updated' : 'created'} successfully!`);
        window.location.reload();
      }
      
    } catch (err) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} category:`, err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      
      {/* Form Fields Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Category Name */}
        <div>
          <label htmlFor="name" className={`block text-sm font-medium text-black mb-2 ${roboto.className}`}>
            Category Name *
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g., Design & Creative"
            className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent bg-gray-200 text-gray-800"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Descriptive name shown to users
          </p>
        </div>

        {/* Category Slug */}
        <div>
          <label htmlFor="slug" className={`block text-sm font-medium text-black mb-2 ${roboto.className}`}>
            URL Slug *
          </label>
          <input
            id="slug"
            type="text"
            value={formData.slug}
            onChange={(e) => handleChange('slug', e.target.value)}
            placeholder="e.g., design-creative"
            className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent bg-gray-200 text-gray-800"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            {isEditMode ? 'URL identifier (be careful changing this)' : 'Auto-generated from name'}
          </p>
        </div>

        {/* Category Icon */}
        <div>
          <label htmlFor="icon" className={`block text-sm font-medium text-black mb-2 ${roboto.className}`}>
            Icon
          </label>
          <input
            id="icon"
            type="text"
            value={formData.icon}
            onChange={(e) => handleChange('icon', e.target.value)}
            placeholder="🎨"
            className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent bg-gray-200 text-gray-800"
            maxLength={10}
          />
          <p className="text-xs text-gray-500 mt-1">
            Emoji or short text (optional)
          </p>
        </div>

        {/* Column Position */}
        <div>
          <label htmlFor="columnPosition" className={`block text-sm font-medium text-black mb-2 ${roboto.className}`}>
            Column Position *
          </label>
          <select
            id="columnPosition"
            value={formData.columnPosition}
            onChange={(e) => handleChange('columnPosition', parseInt(e.target.value))}
            className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent bg-gray-200 text-gray-800"
            required
          >
            <option value={1}>Column 1 (Left)</option>
            <option value={2}>Column 2 (Center)</option>
            <option value={3}>Column 3 (Right)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Which column to display in
          </p>
        </div>

        {/* Active Status */}
        <div>
          <label htmlFor="isActive" className={`block text-sm font-medium text-black mb-2 ${roboto.className}`}>
            Status
          </label>
          <div className="flex items-center">
            <input
              id="isActive"
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => handleChange('isActive', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-gray-300 border-gray-300 rounded bg-gray-200 text-gray-800"
            />
            <label htmlFor="isActive" className={`ml-2 text-sm text-gray-700 ${roboto.className}`}>
              Active (visible to users)
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Inactive categories are hidden from public view
          </p>
        </div>

      </div>

      {/* Description Field (Full Width) */}
      <div>
        <label htmlFor="description" className={`block text-sm font-medium text-black mb-2 ${roboto.className}`}>
          Description
        </label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Optional description of this category..."
          rows={3}
          className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent bg-gray-200 text-gray-800"
        />
        <p className="text-xs text-gray-500 mt-1">
          Optional description for admin reference
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-red-500 mr-2">❌</span>
            <span className="text-red-700 text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Form Footer */}
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
                : 'bg-blue-600 text-white hover:bg-blue-700'
              }
            `}
          >
            {isLoading 
              ? (isEditMode ? 'Updating...' : 'Creating...') 
              : (isEditMode ? 'Update Category' : 'Create Category')
            }
          </button>
        </div>
      </div>
      
    </form>
  );
}
