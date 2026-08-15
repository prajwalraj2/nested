'use client';

import type { PageStatus } from '@/generated/prisma';
import { MAIN_PAGE_SLUG, PAGE_STATUSES, PAGE_STATUS_DESCRIPTIONS, PAGE_STATUS_LABELS, isMainPage } from '@/lib/page-status';
import type { DomainStatus } from '@/generated/prisma';
import { useState } from 'react';
import { AlertTriangle, Globe, Loader2 } from 'lucide-react';
// ⚠️ `SUPPORTED_COUNTRIES` was imported and never used here, exactly as in `DomainForm`
// before G-3c. Removed. `getCountryOptions()` returns the display-ready list.
import { ALL_COUNTRIES, getCountryOptions } from '@/lib/countries';
import { IconPicker } from '@/components/admin/IconPicker';
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
  /** Lifecycle state. Optional so a caller with the older shape still compiles. */
  status?: PageStatus;
  /** Icon id from public/icons/, or null to fall back to the emoji in the title. */
  icon?: string | null;
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
  { value: 'roadmap', label: 'Roadmap', description: 'A step-by-step learning path' },
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

  /**
   * ⚠️ IS THE PAGE BEING EDITED THE `__main__` ROW ITSELF?
   * ======================================================
   *
   * **This one line of state exists because its absence detached two entire domains.**
   *
   * The parent default below reads: "when editing, keep the page's own parent; otherwise fall
   * back to `__main__` for a direct domain". For every ordinary page that is right. For
   * `__main__` it is a trap, because `__main__`'s own `parentId` is `null` — it is the root —
   * so the `||` chain skipped straight past it to the fallback:
   *
   *     editingPage.parentId → null   (falsy, so `||` moves on)
   *     parentId prop        → null   (falsy, so `||` moves on)
   *     mainPage.id          → ecab70c3…   ← THE ID OF THE VERY PAGE BEING EDITED
   *
   * Saving then wrote `parentId = own id`. `buildPageHierarchy` walks upward through
   * `parentId`, saw the same id twice, logged `[page-path] parent cycle detected` and dropped
   * the row — taking all 42 of its children with it. The admin showed "No pages yet" and
   * `/domain/gdesign` 404'd, on a domain whose 43 rows were all still in the database.
   *
   * ⚠️ **`||` CANNOT DISTINGUISH "no value" FROM "deliberately null".** `null` is the correct,
   * meaningful parent of a root page, and `||` treats it as absent. That is the whole bug.
   *
   * ⚠️ AND IT WAS INVISIBLE FOR MONTHS. Saving a `__main__` page always failed on the slug
   * rule (#26), so this value was computed every time and never once written. Fixing #26
   * removed the accident that was suppressing it — **an unrelated fix made a latent bug
   * reachable.** Nothing about the #26 change was wrong; it simply let a save complete for the
   * first time, and the save carried this with it.
   */
  const isEditingMainPage = isEditMode && editingPage?.slug === '__main__';

  const [formData, setFormData] = useState({
    title: editingPage?.title || '',
    slug: editingPage?.slug || '',
    contentType: editingPage?.contentType || 'section_based',
    /*
      Precedence: the page's own parent when editing → the row you clicked "Add child" on →
      the domain's default. For a `direct` domain that default is `__main__`'s real id, NOT
      `null` — which is the fix described in the header comment.

      ⚠️ …EXCEPT WHEN THE PAGE BEING EDITED **IS** `__main__` — see `isEditingMainPage` below.
      Without that exclusion this line made the page its OWN parent and detached a whole
      domain. That bug is worth reading about; the explanation is directly above the constant.
    */
    parentId: isEditingMainPage
      ? null
      : editingPage?.parentId || parentId || (isDirect ? (mainPage?.id ?? null) : null),
    targetCountries: editingPage?.targetCountries || [ALL_COUNTRIES],
    /*
      ⚠️ Falls back to PUBLISHED, not DRAFT — matching the column default and today's behaviour,
      where a page is live the moment it is created. A DRAFT fallback would also mean that
      editing an existing live page and saving without touching this field would take it
      offline, which is a destructive result from doing nothing.
    */
    status: editingPage?.status ?? ('PUBLISHED' as PageStatus),
    // Null means "use the emoji already in the title" — true of 1,200 of 1,216 pages today.
    icon: editingPage?.icon ?? null,
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
    /*
      ⚠️ `__main__` IS EXEMPT — and this check is the one that actually bit.

      The API's exemption was added first (#26) and verified server-side, so a scripted PUT
      succeeded. But this client-side copy still rejected the value, so the form never sent the
      request: editing a `__main__` page's TITLE still failed with a message about its slug —
      a field now visibly greyed out and impossible to edit.

      **Fixing the server and not the mirrored client check leaves the bug exactly where the
      user meets it.** The server test passed while the screen it exists for did not.
    */
    if (formData.slug !== MAIN_PAGE_SLUG && !/^[a-z0-9-]+$/.test(formData.slug)) {
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
        status: formData.status,
        icon: formData.icon,
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
          {/*
            ⚠️ READ-ONLY FOR `__main__` — finding #26.

            That slug is generated by the app, contains underscores, and is the marker the whole
            direct-domain URL model hangs off: `PageService.getByPath` finds every top-level page
            by looking it up literally. The API refuses to change it.

            Before this, the field was freely editable and the server rejected the value it had
            itself supplied — so EVERY save of a `__main__` page failed with "Slug must contain
            only lowercase letters, numbers, and hyphens", naming a field the admin had not
            touched. Disabling it is the honest signal that this one value is structural.
          */}
          <Input
            id="page-slug"
            value={formData.slug}
            onChange={(event) => handleChange('slug', event.target.value)}
            placeholder="e.g. youtube-channels"
            className="font-mono"
            disabled={isMainPage({ slug: formData.slug })}
            required
          />
          {isMainPage({ slug: formData.slug }) && (
            <p className="text-muted-foreground text-xs">
              Fixed — this is the domain&apos;s root page, and every page beneath it is found
              through this name. Everything else here can be edited.
            </p>
          )}
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

      {/*
        ── Icon ──
        Optional; null means "use the emoji already in the title".

        ⚠️ The same double-icon trap as domains, and more widespread here: 1,200 of 1,216 page
        titles carry their emoji inside the title STRING. Setting an icon without editing the
        title renders both. See NEW-IMPROVEMENTS.md §27.6.

        ⚠️ One icon serves many pages — 395 distinct titles across 1,216 pages — so the picker
        deliberately lists generic ids (`youtube`) rather than per-page images.
      */}
      <div className="space-y-1.5 rounded-lg border p-3">
        <Label htmlFor="page-icon" className="text-sm font-medium">
          Icon
        </Label>
        <IconPicker
          id="page-icon"
          value={formData.icon}
          onChange={(iconId) => handleChange('icon', iconId)}
          disabled={isLoading}
        />
        <p className="text-muted-foreground text-xs">
          {formData.icon
            ? 'Remove any emoji from the title above, or both will show.'
            : 'Optional. Without one, the emoji in the title is used.'}
        </p>
      </div>

      {/*
        ── Status ──

        ⚠️ HIDDEN ENTIRELY FOR A `__main__` PAGE, not merely disabled.

        `__main__` is the root of a direct domain — it IS `/domain/<slug>` — so hiding it would
        404 that whole domain. `PUT /api/admin/pages/[id]` refuses a non-published status on it,
        and showing a control whose every non-default value the server rejects would be a worse
        experience than not showing it: you would only learn it was impossible after saving.

        To hide such a domain you change the DOMAIN's status, which is what the note says.
      */}
      {editingPage && isMainPage({ slug: formData.slug }) ? (
        <div className="rounded-lg border p-3">
          <h4 className="text-sm font-medium">Status</h4>
          <p className="text-muted-foreground text-xs">
            This is the domain&apos;s root page, so it is always live. To hide the domain,
            change the domain&apos;s status instead.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5 rounded-lg border p-3">
          <Label htmlFor="page-status" className="text-sm font-medium">
            Status
          </Label>
          <Select
            value={formData.status}
            onValueChange={(value) => handleChange('status', value)}
          >
            {/*
              `SelectValue` gets explicit children rather than a placeholder — Radix resolves
              the selected label from mounted content, which does not exist during server
              rendering, so a bare `<SelectValue />` paints an empty trigger until hydration.
            */}
            <SelectTrigger id="page-status" className="w-full">
              <SelectValue>{PAGE_STATUS_LABELS[formData.status]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PAGE_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {PAGE_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            {PAGE_STATUS_DESCRIPTIONS[formData.status]}
          </p>
        </div>
      )}

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
