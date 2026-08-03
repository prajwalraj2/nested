'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
// ⚠️ THE LAST `Roboto` IMPORT IN THE APP was here, styling every label in this form against
// the app-wide Geist and downloading a second webfont to do it. With this removed, the only
// remaining `next/font/google` importer is `src/app/layout.tsx` — which is the legitimate one.
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
  const router = useRouter();
  const searchParams = useSearchParams();

  /**
   * ⚠️ COMPLETES THE PROMISE G-6a's BUTTONS MADE.
   *
   * `CategoryList`'s "Add to column N" buttons push `?column=N` — before G-6a their entire
   * handler was `window.scrollTo({ top: 0 })` with a `TODO` admitting the column was not
   * pre-selected, so after telling the app which column you wanted you had to pick it again.
   * This is the other half: the form reads that parameter.
   *
   * Clamped to 1–3 rather than trusted: it comes from the URL, so anyone can type
   * `?column=99`, and the API rejects anything outside that range. Falls back to 1.
   */
  const requestedColumn = (() => {
    const raw = Number(searchParams.get('column'));
    return raw >= 1 && raw <= 3 ? raw : 1;
  })();

  // Form state - initialize with category data if editing, defaults if creating
  const [formData, setFormData] = useState({
    name: category?.name || '',
    slug: category?.slug || '',
    icon: category?.icon || '',
    description: category?.description || '',
    /*
      ⚠️ Edit mode wins over the URL. An existing category's own column must not be silently
      changed just because `?column=2` happens to be in the address bar from an earlier click.
      `??` not `||`, since column 0 is invalid anyway but the intent should be explicit.
    */
    columnPosition: category?.columnPosition ?? requestedColumn,
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

      // Reset the form after a create, so the next one starts blank.
      if (!isEditMode) {
        setFormData({
          name: '',
          slug: '',
          icon: '',
          description: '',
          // Back to whichever column the URL asked for, not hardcoded 1 — so adding several
          // categories to column 3 in a row does not reset the field each time.
          columnPosition: requestedColumn,
          isActive: true
        });
      }

      /**
       * ⚠️ `alert()` + `window.location.reload()` REMOVED (#22.6).
       *
       * This branch used to fire a blocking browser alert and then throw the whole document
       * away. `onCancel`/`onSuccess` are optional, so the create form on
       * `/admin/categories` — which passes neither — hit it every time.
       *
       * `router.refresh()` re-runs the page's server component so the new category appears in
       * the column layout below, without the reload's white flash, and without discarding the
       * form's own state.
       */
      onSuccess?.();
      router.refresh();

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
          <label htmlFor="name" className="mb-2 block text-sm font-medium">
            Category Name *
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g., Design & Creative"
            className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
            required
          />
          <p className="text-muted-foreground mt-1 text-xs">
            Descriptive name shown to users
          </p>
        </div>

        {/* Category Slug */}
        <div>
          <label htmlFor="slug" className="mb-2 block text-sm font-medium">
            URL Slug *
          </label>
          <input
            id="slug"
            type="text"
            value={formData.slug}
            onChange={(e) => handleChange('slug', e.target.value)}
            placeholder="e.g., design-creative"
            className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
            required
          />
          <p className="text-muted-foreground mt-1 text-xs">
            {isEditMode ? 'URL identifier (be careful changing this)' : 'Auto-generated from name'}
          </p>
        </div>

        {/* Category Icon */}
        <div>
          <label htmlFor="icon" className="mb-2 block text-sm font-medium">
            Icon
          </label>
          <input
            id="icon"
            type="text"
            value={formData.icon}
            onChange={(e) => handleChange('icon', e.target.value)}
            placeholder="🎨"
            className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
            maxLength={10}
          />
          <p className="text-muted-foreground mt-1 text-xs">
            Emoji or short text (optional)
          </p>
        </div>

        {/* Column Position */}
        <div>
          <label htmlFor="columnPosition" className="mb-2 block text-sm font-medium">
            Column Position *
          </label>
          <select
            id="columnPosition"
            value={formData.columnPosition}
            onChange={(e) => handleChange('columnPosition', parseInt(e.target.value))}
            className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
            required
          >
            <option value={1}>Column 1 (Left)</option>
            <option value={2}>Column 2 (Center)</option>
            <option value={3}>Column 3 (Right)</option>
          </select>
          <p className="text-muted-foreground mt-1 text-xs">
            Which column to display in
          </p>
        </div>

        {/* Active Status */}
        <div>
          <label htmlFor="isActive" className="mb-2 block text-sm font-medium">
            Status
          </label>
          <div className="flex items-center">
            <input
              id="isActive"
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => handleChange('isActive', e.target.checked)}
              className="border-input size-4 rounded"
            />
            <label htmlFor="isActive" className="ml-2 text-sm font-normal">
              Active (visible to users)
            </label>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Inactive categories are hidden from public view
          </p>
        </div>

      </div>

      {/* Description Field (Full Width) */}
      <div>
        <label htmlFor="description" className="mb-2 block text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Optional description of this category..."
          rows={3}
          className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
        />
        <p className="text-muted-foreground mt-1 text-xs">
          Optional description for admin reference
        </p>
      </div>

      {/* Was a `bg-red-50 border-red-200` panel with a ❌ emoji — light-only, and duplicating
          what shadcn's destructive `Alert` already provides. */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <p className="text-muted-foreground text-xs">
          <span className="text-destructive" aria-hidden="true">*</span> Required
        </p>

        <div className="flex items-center gap-2">
          {/*
            ⚠️ Shown whenever a handler exists, not only in edit mode.

            The old gate was `isEditMode && onCancel`, the identical bug `DomainForm` had before
            G-3c: the create form rendered no Cancel even when one was passed to it.
          */}
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
          )}

          {/* `bg-blue-600` removed — the default primary style is what marks the primary action. */}
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {isLoading
              ? isEditMode
                ? 'Saving…'
                : 'Creating…'
              : isEditMode
                ? 'Save changes'
                : 'Create category'}
          </Button>
        </div>
      </div>

    </form>
  );
}
