'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Domain filters (rebuilt in Phase G-3c).
 * ============================================================================
 *
 * WHAT IT DOES
 * ------------
 * Search + three dropdowns that filter the domains list. Filter state lives in the URL
 * (`?search=&category=&status=&pageType=`), not in React state — which is the one part of
 * the original worth keeping: filters survive a refresh, can be shared as a link, and the
 * back button steps through them. The Server Component page reads `searchParams` and does
 * the filtering in the database, so nothing is filtered client-side.
 *
 * WHAT THE REBUILD FIXED
 * ----------------------
 * 1. ⚠️ THIS COMPONENT CAUSED THE PAGE-WIDE HORIZONTAL SCROLLBAR. The three filters were
 *    `flex-1 min-w-48` + `flex-1 min-w-32` + `flex-1 min-w-32` in a flex row — roughly
 *    450px of minimum width that could not shrink. That is what forced `min-w-0` onto
 *    `SidebarInset` in G-3a. They are now a RESPONSIVE GRID, so on a narrow window they
 *    wrap onto multiple rows instead of pushing the page wider than the viewport.
 *    (The `min-w-0` in `AdminLayout` stays — it is correct in its own right and protects
 *    every other admin screen — but it is no longer load-bearing for this one.)
 *
 * 2. ⚠️ THE DOC COMMENT CLAIMED DEBOUNCING THAT DID NOT EXIST. The old file had a handler
 *    documented as "Handle search input change with debouncing" whose entire body was
 *    `setSearchInput(value)`. Search only ever fired on Enter or the button. Rather than
 *    add a debounce — which would fire a server round-trip per keystroke against a table
 *    the admin scrolls constantly — the explicit submit is KEPT and the comment corrected.
 *
 * 3. A FAKE INVISIBLE LABEL is gone: `<label className="text-xs text-transparent">.</label>`
 *    — a literal full stop, rendered transparent, whose only job was to push the "Clear
 *    All" button down so it lined up with the fields beside it. Grid alignment does that.
 *
 * 4. Labels were not associated with their controls (no `htmlFor`/`id`), so clicking one
 *    did nothing and a screen reader announced three unlabelled dropdowns.
 *
 * 5. The `Roboto` Google-Fonts import is gone — a second webfont downloaded to style three
 *    tiny labels, fighting the app-wide Geist. (Four other admin files still do this.)
 *
 * 33 hardcoded colours → 0.
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

/**
 * ⚠️ SENTINEL FOR "NO FILTER" — DO NOT REPLACE WITH `''`.
 *
 * The old code used `<option value="">All Categories</option>`, which is fine for a native
 * `<select>`. Radix's `Select` **throws at runtime** if a `SelectItem` has an empty string
 * value — it reserves `''` internally to mean "nothing selected", so an empty-valued item
 * would be indistinguishable from the placeholder.
 *
 * So the "no filter" choice carries this sentinel in the UI, and `toParamValue` converts it
 * back to `''` at the URL boundary — meaning **the URL shape is unchanged** and the server
 * page needs no modification.
 */
const NO_FILTER = '__all__';

/** UI value → URL value. The sentinel means "remove this parameter". */
function toParamValue(uiValue: string): string {
  return uiValue === NO_FILTER ? '' : uiValue;
}

/** URL value → UI value. A missing/empty parameter selects the "All …" item. */
function toUiValue(paramValue: string | undefined): string {
  return paramValue && paramValue !== '' ? paramValue : NO_FILTER;
}

/**
 * ⚠️ WHY EACH `SelectValue` IS GIVEN EXPLICIT CHILDREN.
 *
 * Left to itself, Radix's `Select.Value` renders the *selected item's* text — which it finds
 * by looking through the `SelectItem`s. Those live in a Portal that only mounts in the
 * browser, so **on the server the trigger renders completely empty** and fills in on
 * hydration. The result is three blank dropdowns for the first paint, where the old native
 * `<select>` had its value in the HTML from the start.
 *
 * Passing children overrides that lookup, so the label is computed here (from `props` we
 * already have) and server-rendered correctly.
 *
 * `DomainForm`'s selects deliberately do NOT do this: they only exist inside a dialog, which
 * cannot be reached before JS has loaded, so there is no pre-hydration paint to protect.
 */
const STATUS_LABELS: Record<string, string> = {
  published: 'Published',
  draft: 'Draft',
};

const PAGE_TYPE_LABELS: Record<string, string> = {
  direct: 'Direct',
  hierarchical: 'Hierarchical',
};

export function DomainFilters({ categories, currentFilters }: DomainFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  /**
   * `useTransition` keeps the current list on screen while the new one loads, instead of
   * blanking it. `isPending` is what drives the disabled/spinner states below.
   */
  const [isPending, startTransition] = useTransition();

  /**
   * The search box is UNCONTROLLED BY THE URL while you type — you need to be able to edit
   * the text without firing a navigation on every keystroke. It is seeded from the URL on
   * mount and pushed to the URL on submit.
   */
  const [searchInput, setSearchInput] = useState(currentFilters.search || '');

  /**
   * Write filters into the URL. Reads the CURRENT params first and patches them, so
   * changing one filter preserves the others — building the string from scratch would
   * silently drop them.
   */
  function updateFilters(newFilters: Partial<CurrentFilters>) {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(newFilters).forEach(([key, value]) => {
      if (value && value !== '') {
        params.set(key, value);
      } else {
        // Deleted rather than set to empty, so we get `/admin/domains` and not
        // `/admin/domains?search=&category=` once everything is cleared.
        params.delete(key);
      }
    });

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/admin/domains?${query}` : '/admin/domains');
    });
  }

  function clearAllFilters() {
    setSearchInput('');
    startTransition(() => {
      router.push('/admin/domains');
    });
  }

  const hasActiveFilters = Object.values(currentFilters).some((value) => value && value !== '');

  /** Resolves a category id from the URL to its display name for the active-filter chip. */
  const activeCategoryName = currentFilters.category
    ? (categories.find((c) => c.id === currentFilters.category)?.name ?? 'Unknown')
    : null;

  return (
    <div className="space-y-4">
      {/* ── Search ── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          {/*
            The magnifying glass was a 🔍 emoji in an absolutely-positioned div. A lucide
            icon inherits `currentColor`, so it follows the theme; emoji cannot.

            `pointer-events-none` so clicking the icon still focuses the input underneath —
            without it the icon swallows the click. `pl-9` on the input reserves its space.
          */}
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            // Enter submits, matching the old behaviour. Kept deliberately — see note 2 in
            // the header comment about why there is no debounce.
            onKeyDown={(event) => {
              if (event.key === 'Enter') updateFilters({ search: searchInput });
            }}
            placeholder="Search domains by name or slug…"
            className="pl-9"
            aria-label="Search domains"
          />
        </div>

        <Button onClick={() => updateFilters({ search: searchInput })} disabled={isPending}>
          {/*
            The spinner replaces the label's icon rather than the label itself, so the
            button does not change width mid-request and shift the layout.
          */}
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Search className="size-4" aria-hidden="true" />
          )}
          Search
        </Button>
      </div>

      {/*
        ── Filters ──
        ⚠️ THE GRID IS THE OVERFLOW FIX. `grid-cols-1` stacks on a phone, two columns on a
        small screen, four on a large one — every track is free to shrink because grid tracks
        do not carry flexbox's `min-width: auto`. The old `flex-1 min-w-48` + two `min-w-32`
        could not shrink below ~450px and pushed the whole document sideways.
      */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Category */}
        <div className="space-y-1.5">
          {/*
            `htmlFor` + a matching `id` on the trigger. The old labels had neither, so they
            were decorative text: clicking did not focus the control, and assistive tech
            announced an unnamed combobox.
          */}
          <Label htmlFor="filter-category">Category</Label>
          <Select
            value={toUiValue(currentFilters.category)}
            onValueChange={(value) => updateFilters({ category: toParamValue(value) })}
            disabled={isPending}
          >
            {/* `w-full` because SelectTrigger ships as `w-fit` and would otherwise size to
                its content, breaking the grid's alignment. */}
            <SelectTrigger id="filter-category" className="w-full">
              {/* Explicit children — see the note on STATUS_LABELS above. */}
              <SelectValue>{activeCategoryName ?? 'All categories'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_FILTER}>All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {/* The icon is a real field an admin sets, so it is shown as content
                      rather than as decoration. */}
                  {category.icon ? `${category.icon} ` : ''}
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Publication status */}
        <div className="space-y-1.5">
          <Label htmlFor="filter-status">Status</Label>
          <Select
            value={toUiValue(currentFilters.status)}
            onValueChange={(value) => updateFilters({ status: toParamValue(value) })}
            disabled={isPending}
          >
            <SelectTrigger id="filter-status" className="w-full">
              <SelectValue>
                {(currentFilters.status && STATUS_LABELS[currentFilters.status]) ??
                  'All statuses'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_FILTER}>All statuses</SelectItem>
              {/* ✅ / 📝 emoji dropped — the words carry the meaning, and the table's own
                  badges are the place status is read at a glance. */}
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Page type */}
        <div className="space-y-1.5">
          <Label htmlFor="filter-page-type">Page type</Label>
          <Select
            value={toUiValue(currentFilters.pageType)}
            onValueChange={(value) => updateFilters({ pageType: toParamValue(value) })}
            disabled={isPending}
          >
            <SelectTrigger id="filter-page-type" className="w-full">
              <SelectValue>
                {(currentFilters.pageType && PAGE_TYPE_LABELS[currentFilters.pageType]) ??
                  'All types'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_FILTER}>All types</SelectItem>
              <SelectItem value="direct">Direct</SelectItem>
              <SelectItem value="hierarchical">Hierarchical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/*
          Clear all. Occupies its own grid cell and is pushed to the bottom of the row with
          `self-end`, which is what the transparent full-stop label was faking.

          Rendered only when something is filtered — a permanently visible "Clear" on an
          unfiltered list is a control that does nothing.
        */}
        {hasActiveFilters && (
          <div className="flex items-end">
            <Button variant="outline" onClick={clearAllFilters} disabled={isPending}>
              <X className="size-4" aria-hidden="true" />
              Clear all
            </Button>
          </div>
        )}
      </div>

      {/*
        ── Active filter chips ──
        Each chip names the filter and removes just that one. Previously four hardcoded
        colour pairs (blue / purple / green / orange) that conveyed nothing — the colour did
        not mean anything, it just distinguished chips that are already distinguished by
        their text. One `secondary` variant now, so they read as a set.
      */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-sm">Active filters:</span>

          {currentFilters.search && (
            <FilterChip
              label={`Search: "${currentFilters.search}"`}
              onRemove={() => {
                // Local state must be cleared too, or the box keeps showing the term you
                // just removed and the next submit would re-apply it.
                setSearchInput('');
                updateFilters({ search: '' });
              }}
              disabled={isPending}
            />
          )}

          {currentFilters.category && (
            <FilterChip
              label={`Category: ${activeCategoryName}`}
              onRemove={() => updateFilters({ category: '' })}
              disabled={isPending}
            />
          )}

          {currentFilters.status && (
            <FilterChip
              label={`Status: ${currentFilters.status === 'published' ? 'Published' : 'Draft'}`}
              onRemove={() => updateFilters({ status: '' })}
              disabled={isPending}
            />
          )}

          {currentFilters.pageType && (
            <FilterChip
              label={`Type: ${currentFilters.pageType === 'direct' ? 'Direct' : 'Hierarchical'}`}
              onRemove={() => updateFilters({ pageType: '' })}
              disabled={isPending}
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * One removable active-filter chip.
 *
 * Extracted because the original repeated the same 10-line block four times with only the
 * colour and the label differing — the kind of duplication where a fix gets applied to
 * three of the four copies.
 */
type FilterChipProps = {
  label: string;
  onRemove: () => void;
  disabled: boolean;
};

function FilterChip({ label, onRemove, disabled }: FilterChipProps) {
  return (
    <Badge variant="secondary" className="gap-1 font-normal">
      {label}
      {/*
        A real `<button>`, not a `×` character inside a span. The old markup used a bare
        `×` (U+00D7) as the entire accessible name, which a screen reader reads as
        "multiplication sign" — `aria-label` says what it actually does.

        `type="button"` matters if this is ever placed inside a form: a button with no type
        defaults to `submit`.
      */}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove filter: ${label}`}
        className="hover:text-foreground -mr-0.5 rounded-sm disabled:opacity-50"
      >
        <X className="size-3" aria-hidden="true" />
      </button>
    </Badge>
  );
}
