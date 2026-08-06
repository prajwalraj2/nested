'use client';

import type { DomainStatus } from '@/generated/prisma';
import { useState } from 'react';
import { AlertTriangle, Globe, Loader2 } from 'lucide-react';
// ⚠️ `SUPPORTED_COUNTRIES` was imported and never used here, exactly as in `DomainForm`
// before G-3c. Removed. `getCountryOptions()` returns the display-ready list.
import { ALL_COUNTRIES, getCountryOptions } from '@/lib/countries';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
 * Create / edit a page (rebuilt in Phase G-4d).
 * ============================================================================
 *
 * Renders inline inside `PagesManager` — deliberately not a dialog, because you choose a
 * parent from the tree behind it (see the note at that call site).
 *
 * The submit logic is unchanged: same endpoints, same payload, same validation rules.
 *
 * ⚠️ BUG FIXED: "DEFAULT (__main__ PAGE)" DID NOT DO THAT WHEN EDITING.
 * ==========================================================================
 * The parent dropdown offered `<option value="">Default (__main__ page)</option>`, and
 * choosing it set `parentId` to `null`. Whether that was correct depended entirely on which
 * endpoint received it:
 *
 *   • **POST** compensates — `if (domain.pageType === 'direct' && !parentId)` looks up (or
 *     creates) the `__main__` page and uses its id. So CREATING worked.
 *   • **PUT** does not — it stores `parentId: parentId || null` verbatim. So EDITING an
 *     existing page and picking the option labelled "Default (__main__ page)" **detached it
 *     from `__main__` and made it a root page**, the opposite of what the label promised.
 *
 * On a `direct` domain the whole URL model hangs off `__main__` (#11), so a detached page
 * gets a different path than the tree implies.
 *
 * Fixed here rather than in the API, because the form is where the ambiguity is: a `direct`
 * domain now offers **no "no parent" option at all** — `__main__` is listed as a real,
 * selectable parent and is the default — so both endpoints receive a concrete id and cannot
 * disagree about what it means.
 *
 * ⚠️ BUG FIXED: THE PARENT LIST'S INDENTATION NEVER RENDERED.
 * It built depth with `{'  '.repeat(page.depth)}` inside an `<option>` — but **HTML
 * collapses consecutive whitespace**, so every entry appeared flush left regardless of how
 * deep it sat. In a 116-page tree that makes the list unreadable. Depth is now real padding.
 *
 * ⚠️ 59 hardcoded colours → 0, including a six-card radio grid whose `focus:outline-none`
 * on the label plus an `sr-only` radio meant **keyboard focus was completely invisible**.
 */

type Domain = {
  id: string;
  name: string;
  slug: string;
  pageType: string;
  status: DomainStatus;
  category: {
    id: string;
    name: string;
    icon: string | null;
  } | null;
};

type Page = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  parentId: string | null;
  domainId: string;
  targetCountries?: string[];
  createdAt: Date;
  children: Page[];
  depth: number;
  fullPath: string;
  previewUrl: string;
};

type PageFormProps = {
  domain: Domain;
  pages: Page[];
  /** Pre-selected parent, set when "Add child page" was used on a row. */
  parentId?: string | null;
  /** The page being edited; `null` creates. */
  editingPage?: Page | null;
  onSuccess: () => void;
  onCancel: () => void;
};

const countryOptions = getCountryOptions();

/**
 * ⚠️ SENTINEL FOR "NO PARENT" — Radix `SelectItem` throws on an empty-string value.
 *
 * Same trap as the domain filters in G-3c: `''` is reserved internally for "nothing
 * selected". Only offered for `hierarchical` domains, where root-level pages are legitimate.
 */
const ROOT_PARENT = '__root__';

/** Content types, with a one-line explanation of what each one produces. */
const CONTENT_TYPE_OPTIONS = [
  { value: 'section_based', label: 'Section based', description: 'Organised content blocks' },
  { value: 'subcategory_list', label: 'Subcategory list', description: 'Links to its child pages' },
  { value: 'table', label: 'Table', description: 'Structured rows and columns' },
  { value: 'rich_text', label: 'Rich text', description: 'Long-form written content' },
  { value: 'narrative', label: 'Narrative', description: 'Story-style flow' },
  { value: 'mixed_content', label: 'Mixed content', description: 'A combination of the above' },
];

export function PageForm({
  domain,
  pages,
  parentId = null,
  editingPage = null,
  onSuccess,
  onCancel,
}: PageFormProps) {
  const isEditMode = editingPage !== null;
  const isDirect = domain.pageType === 'direct';

  /** Every page in the domain, depth-first — the tree flattened for lookups. */
  const allPages = flattenPages(pages);

  /** The hidden root of a `direct` domain, if it exists. */
  const mainPage = allPages.find((p) => p.slug === '__main__');

  const [formData, setFormData] = useState({
    title: editingPage?.title || '',
    slug: editingPage?.slug || '',
    contentType: editingPage?.contentType || 'section_based',
    /*
      Precedence: the page's own parent when editing → the row you clicked "Add child" on →
      the domain's default. For a `direct` domain that default is `__main__`'s real id, NOT
      `null` — which is the fix described in the header comment.
    */
    parentId: editingPage?.parentId || parentId || (isDirect ? (mainPage?.id ?? null) : null),
    targetCountries: editingPage?.targetCountries || [ALL_COUNTRIES],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Pages that may be chosen as a parent.
   *
   * ⚠️ In edit mode the page itself and ALL its descendants are excluded — re-parenting a
   * page under its own child would create a cycle, and `buildPageHierarchy` recurses without
   * a depth limit, so it would hang the browser. (The API also refuses, via
   * `isDescendantOf` — this stops it being offered in the first place.)
   */
  const parentOptions = (() => {
    if (!isEditMode || !editingPage) return allPages;

    const excluded = new Set<string>([editingPage.id]);
    const excludeDescendants = (page: Page) => {
      page.children.forEach((child) => {
        excluded.add(child.id);
        excludeDescendants(child);
      });
    };
    excludeDescendants(editingPage);

    return allPages.filter((page) => !excluded.has(page.id));
  })();

  const selectedParent = parentOptions.find((p) => p.id === formData.parentId);

  /**
   * ⚠️ Changing an existing page's slug changes its public URL — and every descendant's,
   * since their paths are built from it. There is no redirect table anywhere in this app.
   * Same guard as the domain slug in G-3c; the old hint was "be careful changing this".
   */
  const slugChanged = isEditMode && formData.slug.trim() !== editingPage.slug;
  const affectedDescendants = isEditMode ? countDescendants(editingPage) : 0;

  function handleChange(field: string, value: string | null | string[]) {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
      // Slug follows the title only while creating. In edit mode the slug is load-bearing
      // and must change only when deliberately typed.
      ...(field === 'title' && !isEditMode && value && { slug: generateSlug(value as string) }),
    }));

    if (error) setError(null);
  }

  /**
   * "ALL" is exclusive both ways, and deselecting the last specific country falls back to
   * "ALL" rather than an empty list — an empty list would mean "visible to nobody", which
   * `isVisibleToCountry` does not model.
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

  /** Client-side checks, for fast feedback. The server re-validates all of them. */
  function validateForm(): string | null {
    if (!formData.title.trim()) return 'Page title is required';
    if (!formData.slug.trim()) return 'URL slug is required';
    if (!formData.contentType) return 'Content type is required';
    if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      return 'Slug must contain only lowercase letters, numbers, and hyphens';
    }

    /*
      Slugs must be unique among SIBLINGS, not across the domain — two different parents can
      each have a "courses" child, and they get distinct URLs. So the comparison includes
      `parentId`, and skips the page being edited so saving it unchanged is not a conflict.
    */
    const conflict = allPages.find(
      (page) =>
        page.slug === formData.slug &&
        page.parentId === formData.parentId &&
        (!isEditMode || page.id !== editingPage?.id)
    );

    if (conflict) {
      return `A page with slug "${formData.slug}" already exists ${
        formData.parentId ? 'under the same parent' : 'at the root level'
      }`;
    }

    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
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
        title: formData.title.trim(),
        slug: formData.slug.trim(),
        contentType: formData.contentType,
        domainId: domain.id,
        parentId: formData.parentId || null,
        targetCountries: formData.targetCountries,
      };

      const url = isEditMode ? `/api/admin/pages/${editingPage.id}` : '/api/admin/pages';

      const response = await fetch(url, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.message ?? `Failed to ${isEditMode ? 'update' : 'create'} page`
        );
      }

      onSuccess();
    } catch (err) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} page:`, err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * The URL this page will have, from the chosen parent's already-computed `fullPath`.
   *
   * ⚠️ `__main__` is skipped in public URLs — that is the entire point of a `direct` domain
   * (#11) — so a page parented to it sits directly under the domain.
   */
  function buildPreviewUrl(): string {
    if (!formData.slug) return `/domain/${domain.slug}`;

    if (selectedParent && selectedParent.slug !== '__main__') {
      return `/domain/${domain.slug}/${selectedParent.fullPath}/${formData.slug}`;
    }

    return `/domain/${domain.slug}/${formData.slug}`;
  }

  const targetsEverywhere = formData.targetCountries.includes(ALL_COUNTRIES);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="page-title">
            Title <RequiredMark />
          </Label>
          <Input
            id="page-title"
            value={formData.title}
            onChange={(event) => handleChange('title', event.target.value)}
            placeholder="e.g. YouTube Channels"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="page-slug">
            URL slug <RequiredMark />
          </Label>
          <Input
            id="page-slug"
            value={formData.slug}
            onChange={(event) => handleChange('slug', event.target.value)}
            placeholder="e.g. youtube-channels"
            className="font-mono"
            required
          />
        </div>
      </div>

      {slugChanged && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertDescription>
            <span>
              This changes the page's public URL. The old address will stop working — there
              are no redirects.
              {affectedDescendants > 0 && (
                <>
                  {' '}
                  All <strong>{affectedDescendants}</strong> nested page
                  {affectedDescendants === 1 ? '' : 's'} will move too.
                </>
              )}
            </span>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/*
          ⚠️ SIX RADIO CARDS BECAME ONE SELECT.

          The old control was a `md:grid-cols-2 lg:grid-cols-3` grid of six bordered cards,
          each three lines tall (label, description, italic example) — roughly 250px of an
          inline form you are trying to see PAST to reach the tree. The descriptions are kept
          inside the dropdown, where they help at the moment of choosing; the third "example"
          line is dropped as the least load-bearing of the three.

          It also fixes an invisible-focus bug: the cards had `focus:outline-none` on the
          label and an `sr-only` radio, so a keyboard user moving through the six options got
          **no visual indication of where they were**.
        */}
        <div className="space-y-1.5">
          <Label htmlFor="page-content-type">
            Content type <RequiredMark />
          </Label>
          <Select
            value={formData.contentType}
            onValueChange={(value) => handleChange('contentType', value)}
          >
            <SelectTrigger id="page-content-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTENT_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span>
                    <span className="block">{option.label}</span>
                    <span className="text-muted-foreground block text-xs">
                      {option.description}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="page-parent">Parent page</Label>
          <Select
            // `?? ROOT_PARENT` maps a null parent onto the sentinel, since Radix cannot
            // represent "no value" as a real option.
            value={formData.parentId ?? ROOT_PARENT}
            onValueChange={(value) =>
              handleChange('parentId', value === ROOT_PARENT ? null : value)
            }
          >
            <SelectTrigger id="page-parent" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/*
                ⚠️ ONLY HIERARCHICAL DOMAINS GET A "ROOT LEVEL" OPTION.

                A `direct` domain's pages all hang off `__main__`, so offering "no parent"
                there produced the PUT bug in the header comment. `__main__` itself appears
                in the list below as a normal, selectable row, so the default is a real id.
              */}
              {!isDirect && <SelectItem value={ROOT_PARENT}>Root level (no parent)</SelectItem>}

              {parentOptions.map((page) => (
                <SelectItem key={page.id} value={page.id}>
                  {/*
                    Depth as real padding. The old code wrote `{'  '.repeat(page.depth)}`
                    inside an `<option>`, and HTML collapses runs of whitespace — so a
                    116-page tree rendered as a flat, unreadable list.
                  */}
                  <span style={{ paddingLeft: `${page.depth * 12}px` }}>
                    {page.slug === '__main__' ? 'Main page (hidden root)' : page.title}
                    <span className="text-muted-foreground ml-2 font-mono text-xs">
                      /{page.slug}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            {isDirect
              ? 'Pages sit under the hidden main page unless you nest them deeper.'
              : 'Leave at root level, or nest under an existing page.'}
          </p>
        </div>
      </div>

      {/* ── Target countries ── */}
      <div className="space-y-3 rounded-lg border p-3">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-medium">
            <Globe className="size-4" aria-hidden="true" />
            Target countries
          </h4>
          <p className="text-muted-foreground text-xs">
            Who this page is visible to. "All countries" clears the rest.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {countryOptions.map((country) => {
            const isSelected = formData.targetCountries.includes(country.code);

            return (
              // `type="button"` — inside a <form>, an untyped button defaults to submit, so
              // picking a country would save the page.
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

      {/* ── Preview ── */}
      {formData.slug && (
        <div className="bg-muted/50 space-y-1 rounded-lg p-3 text-sm">
          <p className="font-mono text-xs">{buildPreviewUrl()}</p>
          <p className="text-muted-foreground text-xs">
            {CONTENT_TYPE_OPTIONS.find((o) => o.value === formData.contentType)?.label}
            {' · '}
            {selectedParent
              ? selectedParent.slug === '__main__'
                ? 'under the main page'
                : `under ${selectedParent.title}`
              : 'at root level'}
            {' · '}
            {targetsEverywhere
              ? 'all countries'
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

      <div className="flex items-center justify-between gap-3 border-t pt-3">
        <p className="text-muted-foreground text-xs">
          <RequiredMark /> Required
        </p>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {isLoading
              ? isEditMode
                ? 'Saving…'
                : 'Creating…'
              : isEditMode
                ? 'Save changes'
                : 'Create page'}
          </Button>
        </div>
      </div>
    </form>
  );
}

/**
 * Flatten the nested tree into a depth-first list.
 *
 * Order matters: depth-first keeps each page immediately after its parent, so the parent
 * dropdown reads top-to-bottom the way the tree looks.
 */
function flattenPages(pages: Page[]): Page[] {
  return pages.flatMap((page) => [page, ...flattenPages(page.children)]);
}

/** Every descendant of a page, at any depth. */
function countDescendants(page: Page): number {
  return page.children.reduce((total, child) => total + 1 + countDescendants(child), 0);
}

/**
 * Title → URL-safe slug.
 *
 * The `[^a-z0-9]+` pass collapses emoji, spaces and punctuation into single hyphens, and the
 * second pass trims them from the ends — so "▶️ YouTube Channels" becomes "youtube-channels"
 * rather than "-youtube-channels".
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

/** `aria-hidden` because the inputs carry `required`, which assistive tech announces itself. */
function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden="true">
      *
    </span>
  );
}
