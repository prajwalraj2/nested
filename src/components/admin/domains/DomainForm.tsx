'use client';

import { useState } from 'react';
import { AlertTriangle, Globe, Loader2 } from 'lucide-react';
// ⚠️ `SUPPORTED_COUNTRIES` was imported here and never used — removed. It is the raw
// `['IN','US','GB','AU','CA']` tuple; this form needs the display-ready list, which is what
// `getCountryOptions()` returns (code + name + flag, with "ALL" first).
import { ALL_COUNTRIES, getCountryOptions } from '@/lib/countries';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
 * Create / edit a domain (rebuilt in Phase G-3c).
 * ============================================================================
 *
 * One form serving both modes: `domain === null` creates, otherwise it edits. It is
 * rendered inside a dialog in both cases — `NewDomainDialog` for create, `DomainsTable`'s
 * edit dialog for update (both since G-3a/G-3b).
 *
 * The submit logic is UNCHANGED — same endpoints, same payload, same validation rules. This
 * rebuild is presentation plus the three fixes below.
 *
 * WHAT THE REBUILD FIXED
 * ----------------------
 * 1. ⚠️ EVERY LABEL WAS `text-black` AND EVERY INPUT `bg-gray-200 text-gray-800`. In dark
 *    mode that put black labels on a dark card — effectively invisible — while the inputs
 *    stayed light grey. This was the worst dark-mode offender left on the domains screen
 *    after #21. All 65 hardcoded colours are gone.
 *
 * 2. ⚠️ DEAD SUCCESS PATH REMOVED. The old code ended with:
 *
 *        if (onSuccess) onSuccess();
 *        else if (!isEditMode) { alert('Domain created successfully!'); window.location.reload(); }
 *
 *    Since G-3b both call sites pass `onSuccess`, so that branch was unreachable — it is
 *    deleted rather than converted, and `onSuccess` is now a REQUIRED prop so the dead path
 *    cannot come back by someone forgetting to pass it. (#22.6.)
 *
 * 3. ⚠️ CANCEL ONLY EXISTED IN EDIT MODE. The button was gated on `isEditMode && onCancel`,
 *    so the create dialog rendered no Cancel even though one was passed to it. Now shown
 *    whenever `onCancel` is supplied.
 *
 * Plus the `Roboto` Google-Fonts import, which downloaded a second webfont to style the
 * labels of one form.
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
  /** `null` creates a new domain; an object edits that one. */
  domain?: {
    id: string;
    name: string;
    slug: string;
    pageType: string;
    categoryId: string;
    orderInCategory: number;
    isPublished: boolean;
    targetCountries?: string[];
    /**
     * How many pages live under this domain. Optional, and only used to size the slug
     * warning below — the form works without it, it just cannot state a number.
     */
    pageCount?: number;
  } | null;
  /** Required — see fix 2 in the header comment. */
  onSuccess: () => void;
  onCancel?: () => void;
};

// Computed once at module scope: the list is a constant, so rebuilding it per render
// would be pure waste.
const countryOptions = getCountryOptions();

export function DomainForm({ categories, domain = null, onSuccess, onCancel }: DomainFormProps) {
  const [formData, setFormData] = useState({
    name: domain?.name || '',
    slug: domain?.slug || '',
    pageType: domain?.pageType || 'direct',
    categoryId: domain?.categoryId || categories[0]?.id || '',
    orderInCategory: domain?.orderInCategory || 0,
    // `??` not `||` — `||` would turn a stored `false` into the default. It happens to be
    // `false` either way here, but the distinction is why this one line differs from its
    // neighbours, so it is worth not "tidying" into `||`.
    isPublished: domain?.isPublished ?? false,
    targetCountries: domain?.targetCountries || [ALL_COUNTRIES],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = domain !== null;

  /**
   * ⚠️ THE SLUG IS THE PUBLIC URL. Renaming it 404s every page beneath it.
   *
   * Pages are served from `/domain/<domainSlug>/<pagePath>`, and this app has NO redirect
   * table — nothing maps an old slug to a new one. So changing `gdesign` instantly breaks
   * all 70 of that domain's URLs: every inbound link, every search result, every bookmark.
   *
   * The old form's entire guard was placeholder text reading "be careful changing this".
   * This computes whether the slug has actually been edited on an EXISTING domain, so the
   * warning appears only when there is something to warn about — a banner shown on every
   * edit would be tuned out by the second one.
   */
  const slugChanged = isEditMode && formData.slug.trim() !== domain.slug;

  /**
   * Update one field. When the NAME changes on a NEW domain, the slug follows it — but
   * never in edit mode, where the slug is load-bearing (see above) and must only change
   * when deliberately typed.
   */
  function handleChange(field: string, value: string | number | boolean | string[]) {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'name' && !isEditMode && { slug: generateSlug(value as string) }),
    }));

    // Clear a stale error as soon as the admin starts fixing it, rather than leaving
    // "Slug is required" on screen while they type a slug.
    if (error) setError(null);
  }

  /**
   * Add or remove a target country.
   *
   * "ALL" is exclusive: picking it clears the specific ones, and picking a specific one
   * clears "ALL". Deselecting the last specific country falls back to "ALL" rather than an
   * empty list — an empty list would mean "visible to nobody", which is never the intent
   * and which `isVisibleToCountry` does not model.
   */
  function handleCountryToggle(countryCode: string) {
    setFormData((prev) => {
      if (countryCode === ALL_COUNTRIES) {
        return { ...prev, targetCountries: [ALL_COUNTRIES] };
      }

      const current = prev.targetCountries;
      let next: string[];

      if (current.includes(countryCode)) {
        next = current.filter((c) => c !== countryCode);
        if (next.length === 0) next = [ALL_COUNTRIES];
      } else {
        next = [...current.filter((c) => c !== ALL_COUNTRIES), countryCode];
      }

      return { ...prev, targetCountries: next };
    });

    if (error) setError(null);
  }

  /**
   * Turn a display name into a URL-safe slug.
   *
   * ⚠️ This has to cope with the real data: 34 of the 35 domain names START WITH AN EMOJI
   * ("🖌️ Graphic Designing"). The `[^a-z0-9]+` pass turns the emoji and the following space
   * into a single leading hyphen, which the next line strips — so the result is
   * "graphic-designing", not "-graphic-designing". Removing either step would break it.
   */
  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // non-alphanumeric runs → one hyphen
      .replace(/^-+|-+$/g, '') // trim hyphens from both ends
      .substring(0, 50);
  }

  /** Client-side validation. The server re-checks all of this — this is for fast feedback. */
  function validateForm(): string | null {
    if (!formData.name.trim()) return 'Domain name is required';
    if (!formData.slug.trim()) return 'URL slug is required';
    if (!formData.categoryId) return 'Category selection is required';
    if (!['direct', 'hierarchical'].includes(formData.pageType)) {
      return 'Page type must be either "direct" or "hierarchical"';
    }
    // Must match what the public router will accept as a path segment.
    if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      return 'Slug must contain only lowercase letters, numbers, and hyphens';
    }
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    // Stops the browser's own full-page form submission, which would navigate away and
    // discard everything before our fetch ran.
    event.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const submitData = {
        ...formData,
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        orderInCategory: Number(formData.orderInCategory) || 0,
      };

      const url = isEditMode ? `/api/admin/domains/${domain.id}` : '/api/admin/domains';

      const response = await fetch(url, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        // The API returns `{ success, message }` on every failure path — including the two
        // that matter most here, "A domain with this slug already exists" and "Selected
        // category does not exist". Showing that text beats a generic message.
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.message ?? `Failed to ${isEditMode ? 'update' : 'create'} domain`
        );
      }

      onSuccess();
    } catch (err) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} domain:`, err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      // In `finally` so a failed save re-enables the button. Without it the form would be
      // permanently stuck on "Saving…" after any error.
      setIsLoading(false);
    }
  }

  const selectedCategory = categories.find((c) => c.id === formData.categoryId);
  const targetsEverywhere = formData.targetCountries.includes(ALL_COUNTRIES);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/*
        ── Core fields ──
        Two columns from `sm` upward; the name spans both because it is the longest value
        and the field an admin fills first.
      */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="name">
            Domain name <RequiredMark />
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(event) => handleChange('name', event.target.value)}
            placeholder="e.g. Graphic Designing"
            required
          />
          <p className="text-muted-foreground text-xs">The name shown to visitors.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="slug">
            URL slug <RequiredMark />
          </Label>
          <Input
            id="slug"
            value={formData.slug}
            onChange={(event) => handleChange('slug', event.target.value)}
            placeholder="e.g. graphic-design"
            // `font-mono` because it is a URL fragment, where "l" vs "1" matters.
            className="font-mono"
            required
          />
          <p className="text-muted-foreground text-xs">
            {isEditMode ? (
              <>
                Public address: <code>/domain/{formData.slug || '…'}</code>
              </>
            ) : (
              'Generated from the name — edit if you want something shorter.'
            )}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="categoryId">
            Category <RequiredMark />
          </Label>
          <Select
            value={formData.categoryId}
            onValueChange={(value) => handleChange('categoryId', value)}
          >
            {/* `w-full` — SelectTrigger is `w-fit` by default and would not fill the cell. */}
            <SelectTrigger id="categoryId" className="w-full">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.icon ? `${category.icon} ` : ''}
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Determines which homepage column it appears in.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pageType">
            Page type <RequiredMark />
          </Label>
          <Select
            value={formData.pageType}
            onValueChange={(value) => handleChange('pageType', value)}
          >
            <SelectTrigger id="pageType" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="direct">Direct content</SelectItem>
              <SelectItem value="hierarchical">Hierarchical structure</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            {formData.pageType === 'direct'
              ? 'Pages sit directly under this domain.'
              : 'Pages are grouped into subcategories.'}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="orderInCategory">Display order</Label>
          <Input
            id="orderInCategory"
            type="number"
            min={0}
            value={formData.orderInCategory}
            // `Number(...) || 0` because an emptied number input yields `''`, and `Number('')`
            // is 0 while `parseInt('')` is NaN — NaN would be sent to the API and stored.
            onChange={(event) => handleChange('orderInCategory', Number(event.target.value) || 0)}
            placeholder="0"
          />
          <p className="text-muted-foreground text-xs">Position within the category (0 = first).</p>
        </div>
      </div>

      {/*
        ⚠️ SLUG-CHANGE WARNING — the blast radius, stated before you save.
        Appears only when the slug of an existing domain has actually been edited.
      */}
      {slugChanged && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertDescription>
            <span>
              Changing the slug changes this domain's public address from{' '}
              <code>/domain/{domain.slug}</code> to <code>/domain/{formData.slug}</code>.
              {domain.pageCount !== undefined && domain.pageCount > 0 ? (
                <>
                  {' '}
                  All <strong>{domain.pageCount}</strong> page
                  {domain.pageCount === 1 ? '' : 's'} under it will move too, and the old
                  addresses will stop working — there are no redirects.
                </>
              ) : (
                ' The old address will stop working — there are no redirects.'
              )}
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/*
        ── Target countries ──
        Geo-targeting (#8/#15.3): which visitors see this domain at all.
      */}
      <div className="space-y-3 rounded-lg border p-4">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-medium">
            <Globe className="size-4" aria-hidden="true" />
            Target countries
          </h4>
          <p className="text-muted-foreground text-xs">
            Who this domain is visible to. Selecting "All countries" clears the rest.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {countryOptions.map((country) => {
            const isSelected = formData.targetCountries.includes(country.code);

            return (
              /*
                Toggle buttons rather than hand-rolled `bg-green-600` / `bg-blue-600` pills.
                The old version coloured "ALL" blue and specific countries green, a
                distinction that carried no meaning beyond what the labels already say.

                `variant` switches on selection so the state is visible without colour
                alone, and `aria-pressed` is what makes a styled <button> announce as a
                toggle — without it a screen reader gives no hint that it is selected.

                ⚠️ `type="button"`: inside a <form>, a button with no type defaults to
                "submit", so picking a country would submit the form.
              */
              <Button
                key={country.code}
                type="button"
                size="sm"
                variant={isSelected ? 'default' : 'outline'}
                aria-pressed={isSelected}
                onClick={() => handleCountryToggle(country.code)}
              >
                <span aria-hidden="true">{country.flag}</span>
                {country.name}
              </Button>
            );
          })}
        </div>
      </div>

      {/*
        ── Publication status ──
        A real `Checkbox`, replacing `<input type="checkbox" className="text-blue-600 …">`
        (where `text-blue-600` did nothing useful — a native checkbox ignores text colour;
        `accent-color` is what tints one).
      */}
      <div className="flex items-start gap-3 rounded-lg border p-4">
        <Checkbox
          id="isPublished"
          checked={formData.isPublished}
          // Radix reports `boolean | 'indeterminate'`; this checkbox is never indeterminate,
          // but coercing keeps `formData.isPublished` a strict boolean for the API.
          onCheckedChange={(checked) => handleChange('isPublished', checked === true)}
          // `mt-0.5` optically aligns the box with the first line of the label text.
          className="mt-0.5"
        />
        <div className="space-y-1">
          <Label htmlFor="isPublished" className="font-medium">
            Published
          </Label>
          <p className="text-muted-foreground text-xs">
            {formData.isPublished
              ? 'Live — visible on the public site.'
              : 'Draft — hidden from visitors.'}
          </p>
        </div>
      </div>

      {/*
        ── Preview ──
        Restates the decisions as the visitor-facing result. Kept from the original (it is
        genuinely useful for catching a wrong category) but no longer a hardcoded blue panel.
      */}
      {formData.slug && (
        <div className="bg-muted/50 space-y-1 rounded-lg p-4 text-sm">
          <p className="font-medium">Preview</p>
          <p className="text-muted-foreground">
            <span className="font-mono">/domain/{formData.slug}</span>
          </p>
          <p className="text-muted-foreground text-xs">
            {formData.pageType === 'direct' ? 'Direct content' : 'Hierarchical'}
            {selectedCategory ? ` · ${selectedCategory.name}` : ''} ·{' '}
            {targetsEverywhere
              ? 'All countries'
              : formData.targetCountries
                  .map((code) => countryOptions.find((c) => c.code === code)?.name ?? code)
                  .join(', ')}
          </p>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <p className="text-muted-foreground text-xs">
          <RequiredMark /> Required
        </p>

        <div className="flex items-center gap-2">
          {/*
            Shown whenever a handler exists — fix 3. The old gate was
            `isEditMode && onCancel`, so create never got a Cancel button.
          */}
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
          )}

          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {isLoading
              ? isEditMode
                ? 'Saving…'
                : 'Creating…'
              : isEditMode
                ? 'Save changes'
                : 'Create domain'}
          </Button>
        </div>
      </div>
    </form>
  );
}

/**
 * The required-field asterisk.
 *
 * `aria-hidden` because the inputs already carry `required`, which assistive tech announces
 * properly — without this the label would be read as "Domain name star".
 */
function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden="true">
      *
    </span>
  );
}
