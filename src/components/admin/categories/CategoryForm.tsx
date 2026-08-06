'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

/**
 * The subset of a category this form needs in order to reason about ROW occupancy.
 *
 * Deliberately narrow: the form does not care about names, domains or icons of OTHER
 * categories except to name an occupant in a label, so widening this would only couple the
 * form to shapes it has no use for.
 */
/**
 * Column numbers are meaningless on their own — "3" tells you nothing about where a category
 * appears. Module-level so the trigger and the list read from ONE source: when they were
 * written out twice, a trigger could disagree with the option it was showing.
 */
const COLUMN_LABELS: Record<number, string> = {
  1: 'Column 1 (Left)',
  2: 'Column 2 (Center)',
  3: 'Column 3 (Right)',
};

export type CategorySlot = {
  id: string;
  name: string;
  columnPosition: number;
  categoryOrder: number;
};

type CategoryFormProps = {
  category?: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    description: string | null;
    columnPosition: number;
    categoryOrder: number;
    isActive: boolean;
  } | null; // null for create mode, object for edit mode
  /**
   * EVERY category, including the one being edited.
   *
   * ⚠️ Required, not optional with a `[]` default. A default would make the Row dropdown offer
   * only "Row 1" whenever a caller forgot to pass this, and the form would then cheerfully
   * propose a cell that is already occupied — a silent wrong answer instead of a type error.
   * Both call sites (the create card on the categories page and the edit dialog inside
   * `CategoryList`) already hold the full list.
   */
  categories: CategorySlot[];
  onSuccess?: () => void; // Callback after successful save
  onCancel?: () => void;  // Callback for cancel action
};

export function CategoryForm({
  category = null,
  categories,
  onSuccess,
  onCancel,
}: CategoryFormProps) {
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

  /**
   * ROW OCCUPANCY — what the Row dropdown is built from.
   * ==========================================================================
   *
   * ⚠️ A "row" is a HORIZONTAL BAND ACROSS ALL THREE COLUMNS, not a slot inside one column.
   * The public page groups categories by `categoryOrder` and renders one grid row per distinct
   * value, filling in an empty cell for every column that value is missing
   * (`src/app/domain/page.tsx`, `organizeDomainsIntoRows`). So two categories sit side by side
   * on the live site precisely when they share a `categoryOrder` — that is the whole mechanism,
   * and it is what this form finally lets you express.
   *
   * The rows offered are therefore every value that already exists ANYWHERE, plus one fresh
   * row below them. Offering a free-text number instead would let you type 47, which is not
   * wrong — rows render as the sorted set of DISTINCT values, so gaps simply collapse — but it
   * would put you on "row 47" that displays fourth, which no label could then explain.
   */
  const existingRows = [...new Set(categories.map((c) => c.categoryOrder))].sort((a, b) => a - b);

  /** One past the last row, i.e. "start a new band at the bottom". */
  const newRowNumber = (existingRows[existingRows.length - 1] ?? 0) + 1;

  const rowOptions = [...existingRows, newRowNumber];

  /**
   * Which category — if any — already sits in a given cell.
   *
   * Excludes the category being edited, so that re-saving without moving anything is not
   * reported as a clash with itself.
   */
  const occupantOf = (column: number, row: number) =>
    categories.find(
      (c) => c.columnPosition === column && c.categoryOrder === row && c.id !== category?.id
    );

  /** The topmost row with nothing in it for this column, falling back to a brand-new row. */
  const firstFreeRow = (column: number) =>
    rowOptions.find((row) => !occupantOf(column, row)) ?? newRowNumber;

  /**
   * `?row=N` from the "Add here" buttons in the column layout below, which now name a specific
   * empty cell rather than just a column.
   *
   * Falls back to the first free row. Also REJECTED if the requested cell turns out to be
   * occupied — the URL is user-editable, and the alternative is a form that opens pre-filled
   * with a value the API will refuse.
   */
  const requestedRow = (() => {
    const raw = Number(searchParams.get('row'));
    const valid = Number.isInteger(raw) && raw >= 1 && rowOptions.includes(raw);
    if (valid && !occupantOf(requestedColumn, raw)) return raw;
    return firstFreeRow(requestedColumn);
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
    // Same rule for the row: an existing category opens on the row it is actually on.
    categoryOrder: category?.categoryOrder ?? requestedRow,
    isActive: category?.isActive ?? true
  });

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine if we're in edit mode or create mode
  const isEditMode = category !== null;

  /**
   * The rows the dropdown actually renders.
   *
   * ⚠️ GUARANTEES THE SELECTED VALUE HAS A MATCHING ITEM. A Radix `Select` whose `value` matches
   * no `SelectItem` renders a blank trigger, and there is one moment where that happens: right
   * after a successful create, the reset above sets the row one past the end while `categories`
   * is still the pre-save list, so the value is briefly one higher than anything in
   * `rowOptions`. It corrects itself when `router.refresh()` lands, but the control would flash
   * empty in between.
   */
  const rowChoices = rowOptions.includes(formData.categoryOrder)
    ? rowOptions
    : [...rowOptions, formData.categoryOrder].sort((a, b) => a - b);

  /**
   * Re-aim the form when the URL target changes.
   *
   * ⚠️ FIXES A BUG THE `?column=` WIRING ALREADY HAD. A `useState` initializer runs exactly
   * once, on mount. `requestedColumn` / `requestedRow` are therefore read only on the first
   * render — so clicking "Add here" on one cell, then a DIFFERENT cell, pushed a new URL that
   * the form completely ignored. The page scrolled up and the dropdowns still showed the first
   * cell. With one "Add to column N" button per column that was easy to miss; with a button on
   * every empty cell it would be hit constantly.
   *
   * Only the two position fields are touched. Anything already typed — name, slug, icon,
   * description — is left alone, because picking a different cell part-way through filling the
   * form is a normal thing to do and should not wipe the work.
   *
   * ⚠️ Create mode only. In edit mode the category's own column and row are the truth, and a
   * stale `?column=` left in the address bar from an earlier click must not overwrite them.
   *
   * The dependency list is the two RAW URL strings, deliberately. `requestedColumn` and
   * `requestedRow` are recomputed every render and `occupantOf` closes over `categories`, so
   * depending on those would re-run this on renders where the URL had not changed — and each
   * run calls `setFormData`, which renders again.
   */
  const columnParam = searchParams.get('column');
  const rowParam = searchParams.get('row');

  useEffect(() => {
    if (isEditMode) return;

    setFormData((prev) => ({
      ...prev,
      columnPosition: requestedColumn,
      categoryOrder: requestedRow,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnParam, rowParam, isEditMode]);

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
      }),
      /*
        Switching COLUMN can invalidate the chosen ROW: row 2 may be free in column 1 and
        taken in column 3. In CREATE mode there is nothing to swap with, so the API would
        reject the save — the row is moved to the first free one in the new column instead, so
        the form never sits in a state that cannot be submitted.

        ⚠️ Not done in EDIT mode. There a clash is legitimate and resolved by swapping, so
        silently relocating the row would override a move the admin explicitly asked for.
      */
      ...(field === 'columnPosition' &&
        !isEditMode &&
        occupantOf(value as number, prev.categoryOrder) && {
          categoryOrder: firstFreeRow(value as number)
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

    if (!Number.isInteger(formData.categoryOrder) || formData.categoryOrder < 1) {
      return 'Row must be a whole number of 1 or more';
    }

    /*
      In CREATE mode an occupied cell is a dead end — there is no existing record to swap with,
      so the API returns 409. The dropdown already disables those rows; this catches the case
      where the column was changed after the row was picked.

      Not checked in edit mode: there, an occupied cell is a swap, which is a valid save.
    */
    if (!isEditMode) {
      const clash = occupantOf(formData.columnPosition, formData.categoryOrder);
      if (clash) {
        return `Column ${formData.columnPosition}, row ${formData.categoryOrder} is already taken by "${clash.name}". Choose another row.`;
      }
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
          /*
            ⚠️ A BRAND-NEW ROW BELOW EVERYTHING, computed rather than reused.

            `categories` is a prop from the server component and is still STALE at this moment
            — `router.refresh()` below has not returned yet, so the category we just created is
            not in it. That rules out `firstFreeRow()`, which would happily hand back the row
            just used and pre-fill a cell the API would then refuse.

            `newRowNumber - 1` is the highest row that existed before this save; the row just
            submitted may be higher still (it could BE the new row), so take whichever is
            greater and go one past it. That value is free no matter which branch was taken.
          */
          categoryOrder: Math.max(newRowNumber - 1, formData.categoryOrder) + 1,
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

        {/*
          ⚠️ Column and Row are shadcn `Select`s, not the native `<select>` this file used.

          A new native dropdown would have been a step backwards — the Sections screen was
          rebuilt away from exactly that in G-6c. More practically, the Row list has to mark
          which entries are occupied and disable them in create mode, and a native `<option>`
          cannot carry that formatting.

          ⚠️ `SelectValue` is given EXPLICIT CHILDREN rather than a `placeholder`. Radix
          resolves the selected item's label by inspecting mounted children, and the content is
          not mounted during server rendering — so a bare `<SelectValue />` renders as an empty
          trigger in the initial HTML and only fills in after hydration. Passing the label
          directly means the closed trigger reads correctly from the first paint.
        */}

        {/* Column Position */}
        <div>
          <label htmlFor="columnPosition" className="mb-2 block text-sm font-medium">
            Column *
          </label>
          <Select
            value={String(formData.columnPosition)}
            onValueChange={(value) => handleChange('columnPosition', parseInt(value))}
          >
            <SelectTrigger id="columnPosition" className="w-full">
              <SelectValue>{COLUMN_LABELS[formData.columnPosition] ?? 'Select a column'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {/* `value` must be a non-empty string — Radix throws on `value=""`. */}
              <SelectItem value="1">{COLUMN_LABELS[1]}</SelectItem>
              <SelectItem value="2">{COLUMN_LABELS[2]}</SelectItem>
              <SelectItem value="3">{COLUMN_LABELS[3]}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-muted-foreground mt-1 text-xs">
            Which of the three homepage columns
          </p>
        </div>

        {/* Row (categoryOrder) */}
        <div>
          <label htmlFor="categoryOrder" className="mb-2 block text-sm font-medium">
            Row *
          </label>
          <Select
            value={String(formData.categoryOrder)}
            onValueChange={(value) => handleChange('categoryOrder', parseInt(value))}
          >
            <SelectTrigger id="categoryOrder" className="w-full">
              <SelectValue>Row {formData.categoryOrder}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {rowChoices.map((row) => {
                const occupant = occupantOf(formData.columnPosition, row);

                return (
                  <SelectItem
                    key={row}
                    value={String(row)}
                    /*
                      Occupied cells are selectable when EDITING (the save swaps the two) but
                      not when creating (there is nothing to swap with, so the API would 409).
                    */
                    disabled={!isEditMode && Boolean(occupant)}
                  >
                    Row {row}
                    <span className="text-muted-foreground ml-1 text-xs">
                      {occupant
                        ? isEditMode
                          ? `· swap with ${occupant.name}`
                          : `· taken by ${occupant.name}`
                        : row === newRowNumber
                          ? '· new row at the bottom'
                          : '· empty'}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground mt-1 text-xs">
            Categories sharing a row sit side by side on the homepage
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
