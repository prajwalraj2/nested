'use client';

// Both come from the generated client; one import rather than two lines for the same module.
import type { DomainStatus, PageStatus } from '@/generated/prisma';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
// `X` was dropped along with the inline form's hand-rolled close button — `DialogContent`
// supplies a properly labelled one of its own.
import { AlertTriangle, Globe, Loader2, Network, Plus, Target } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DomainSelector } from './DomainSelector';
import { PageTree } from './PageTree';
import { PageForm } from './PageForm';

// ⚠️ The `Roboto` import was removed (G-4b). It styled five headings in this one component,
// fighting the app-wide Geist set in the root layout and costing a second webfont download.

/**
 * Main Pages Manager Component
 * 
 * Orchestrates the entire page management workflow:
 * 1. Domain selection
 * 2. Page tree display with correct parent logic
 * 3. Page creation/editing with proper validation
 * 4. Action handling (create, edit, delete)
 * 
 * Key Logic:
 * - Direct domains: Pages use __main__ as parent
 * - Hierarchical domains: Pages use domain or other pages as parent
 * - URLs built correctly based on parent hierarchy
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
  /** Lifecycle state, carried through to PageTree and PageForm. */
  status?: PageStatus;
  /** Icon id, carried through to PageTree and PageForm. */
  icon?: string | null;
  parentId: string | null;
  domainId: string;
  targetCountries?: string[];
  createdAt: Date;
  children: Page[];
  depth: number;
  fullPath: string;
  previewUrl: string;
};

type PagesManagerProps = {
  domains: Domain[];
  selectedDomainId?: string;
  expandedPageIds: string[];
};

export function PagesManager({ domains, selectedDomainId, expandedPageIds }: PagesManagerProps) {
  const router = useRouter();
  
  // State management
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set(expandedPageIds));
  
  // Form states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [createParentId, setCreateParentId] = useState<string | null>(null);

  /**
   * The page awaiting delete confirmation, or `null`.
   *
   * The whole PAGE is held, not just its id, because the dialog needs `title` and the
   * nested `children` to state how many descendants go with it.
   */
  const [deletingPage, setDeletingPage] = useState<Page | null>(null);

  /**
   * Initialize selected domain on mount or when selectedDomainId changes
   */
  useEffect(() => {
    if (selectedDomainId) {
      const domain = domains.find(d => d.id === selectedDomainId);
      if (domain) {
        setSelectedDomain(domain);
        // ⚠️ The DOMAIN OBJECT is passed, not its id — see the long note on
        // `fetchPagesForDomain`. Passing only the id is what made this screen render an
        // empty tree on first load.
        fetchPagesForDomain(domain);
      }
    } else if (domains.length > 0) {
      // Default to first domain if none selected
      setSelectedDomain(domains[0]);
      fetchPagesForDomain(domains[0]);
    }
  }, [selectedDomainId, domains]);

  /**
   * Fetch the pages of a domain and build the tree.
   *
   * ⚠️ TAKES THE DOMAIN OBJECT, NOT AN ID — AND THAT IS THE WHOLE FIX (G-4a).
   * ==========================================================================
   * This function used to take `domainId: string` and then read the domain from state:
   *
   *     const fetchPagesForDomain = async (domainId: string) => {
   *       ...
   *       const hierarchicalPages = buildPageHierarchy(data.pages, selectedDomain);
   *     };
   *
   * `selectedDomain` there is the value captured when this function was CREATED, during a
   * particular render. Calling `setSelectedDomain(d)` immediately before does not change it —
   * a state setter schedules the next render, it does not reach back into a closure that
   * already exists. That produced two separate bugs from one mistake:
   *
   * 1. ⚠️ THE TREE WAS EMPTY ON FIRST LOAD. On mount the effect above ran
   *    `setSelectedDomain(d)` then `fetchPagesForDomain(d.id)`, so inside the call
   *    `selectedDomain` was still its initial `null`. `buildPageHierarchy` starts with
   *    `if (!domain || !flatPages.length) return []`, so it returned an empty array and we
   *    called `setPages([])`. **The network request succeeded and its result was thrown
   *    away.** Nothing recovered afterwards: the effect's deps are
   *    `[selectedDomainId, domains]`, neither of which changes, so it never ran again.
   *
   * 2. ⚠️ SWITCHING DOMAINS BUILT ANOTHER DOMAIN'S URLS. After the first render the closure
   *    held the PREVIOUS domain, so `buildPageHierarchy` used the wrong `pageType` — which
   *    decides whether the hidden `__main__` segment is skipped — and the wrong
   *    `domain.slug`. Preview links pointed into a different domain.
   *
   * Taking the domain as an argument removes the closure from the equation entirely: the
   * data used to build the tree is the same data the caller used to request it. That is
   * also why this is preferable to adding `selectedDomain` to a dependency array — there is
   * no timing left to get wrong.
   */
  const fetchPagesForDomain = async (domain: Domain) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/pages?domain=${domain.id}`);

      if (!response.ok) {
        throw new Error('Failed to fetch pages');
      }

      const data = await response.json();

      if (data.success) {
        // Build hierarchical structure and calculate paths, using the domain we were
        // handed rather than whatever state happens to hold right now.
        const hierarchicalPages = buildPageHierarchy(data.pages, domain);
        setPages(hierarchicalPages);
      } else {
        throw new Error(data.message || 'Failed to fetch pages');
      }

    } catch (err) {
      console.error('Error fetching pages:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch pages');
      setPages([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle domain selection change
   */
  const handleDomainChange = (domain: Domain) => {
    setSelectedDomain(domain);
    setPages([]);
    setShowCreateForm(false);
    setEditingPage(null);
    
    // Update URL
    const url = new URL(window.location.href);
    url.searchParams.set('domain', domain.id);
    url.searchParams.delete('expand'); // Reset expanded state
    router.push(url.toString());

    // Fetch pages for the NEW domain. Passing the object is what stops the tree being
    // built against the previously selected domain — symptom 2 in the note above.
    fetchPagesForDomain(domain);
  };

  /**
   * Handle page creation
   */
  const handleCreatePage = (parentId: string | null = null) => {
    setCreateParentId(parentId);
    setShowCreateForm(true);
    setEditingPage(null);
  };

  /**
   * Handle page editing
   */
  const handleEditPage = (page: Page) => {
    setEditingPage(page);
    setShowCreateForm(false);
    setCreateParentId(null);
  };

  /**
   * Handle form success (refresh pages)
   */
  const handleFormSuccess = () => {
    setShowCreateForm(false);
    setEditingPage(null);
    setCreateParentId(null);
    
    // Refresh pages. `selectedDomain` is safe to use HERE — this runs from a user action
    // long after the state settled, not in the same tick as the setter that assigned it.
    if (selectedDomain) {
      fetchPagesForDomain(selectedDomain);
    }
  };

  /**
   * Handle form cancel
   */
  const handleFormCancel = () => {
    setShowCreateForm(false);
    setEditingPage(null);
    setCreateParentId(null);
  };

  /**
   * Open the delete confirmation.
   *
   * ⚠️ THIS USED TO BE A BROWSER `confirm()` — AND IT UNDERSTATED WHAT DELETE DOES.
   * ==========================================================================
   * The old guard was:
   *
   *     if (!confirm('Are you sure you want to delete this page? This action cannot be undone.'))
   *
   * `DELETE /api/admin/pages/[id]` does not delete one page. It collects every DESCENDANT,
   * then removes their content blocks and each page in one transaction. So deleting a
   * branch near the top of a 50-page tree takes everything under it, and the only warning
   * was a generic sentence that never named a number.
   *
   * The count is computed from the tree we already hold rather than asking the server —
   * `buildPageHierarchy` has already nested every page of this domain, so the answer is
   * local and exact. (Part of #22.6: `confirm()` is *synchronous*, so it cannot be swapped
   * for a dialog in place — the call site has to be split into "open" and "confirm", which
   * is what these two functions are.)
   */
  const handleDeletePage = (pageId: string) => {
    const page = findPageInTree(pages, pageId);
    if (page) setDeletingPage(page);
  };

  /**
   * Actually delete, once confirmed. Returns an error message, or `null` on success, so the
   * dialog can stay open and show the failure instead of firing an `alert()` and closing.
   */
  const confirmDeletePage = async (page: Page): Promise<string | null> => {
    try {
      const response = await fetch(`/api/admin/pages/${page.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        // The API answers `{ success, message }` — including the one refusal that matters
        // here, "Cannot delete the main page" for `__main__` (#11).
        const body = await response.json().catch(() => null);
        return body?.message ?? `Request failed (${response.status})`;
      }

      setDeletingPage(null);

      // Refresh pages after deletion — same reasoning as `handleFormSuccess`.
      if (selectedDomain) {
        fetchPagesForDomain(selectedDomain);
      }

      return null;
    } catch (err) {
      console.error('Error deleting page:', err);
      return err instanceof Error ? err.message : 'Network error.';
    }
  };

  /**
   * Handle expand/collapse
   */
  const handleToggleExpand = (pageId: string) => {
    const newExpanded = new Set(expandedPages);
    if (newExpanded.has(pageId)) {
      newExpanded.delete(pageId);
    } else {
      newExpanded.add(pageId);
    }
    setExpandedPages(newExpanded);
    
    // Update URL
    const url = new URL(window.location.href);
    if (newExpanded.size > 0) {
      url.searchParams.set('expand', Array.from(newExpanded).join(','));
    } else {
      url.searchParams.delete('expand');
    }
    router.replace(url.toString());
  };

  const isDirect = selectedDomain?.pageType === 'direct';

  /**
   * Every page in the domain, at any depth — `pages` holds only the roots.
   *
   * Reuses `countDescendants` so this number and the tree's own header cannot drift apart:
   * one recursion, two call sites.
   */
  const totalPageCount = pages.reduce((total, page) => total + 1 + countDescendants(page), 0);

  return (
    <div>
      {/* ── Domain selection ── */}
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {/*
            `h3`, not a styled `div` — this is the section heading, and the outline is what
            lets a screen-reader user skip between regions. The old markup used the right
            tag but overrode the type scale with `text-xl` plus a second webfont.
          */}
          <h3 className="text-sm font-medium">Domain</h3>
          <p className="text-muted-foreground text-xs">
            Choose a domain to manage its page hierarchy.
          </p>
        </div>

        {selectedDomain && (
          <div className="flex shrink-0 items-center gap-2">
            {/*
              Was `📊 {n} pages total` in muted grey next to a hand-rolled pill. Both are
              facts about the selected domain, so both are badges now — and the type badge
              matches the one on the Domains table (G-3b), so "Direct" looks the same
              wherever it appears.
            */}
            {/*
              ⚠️ COUNTS EVERY PAGE, NOT JUST THE ROOTS.

              This read `{pages.length} pages total` — but `pages` is the array of ROOT
              pages, so for the hierarchical "App Development" domain it announced
              **"3 pages total"** while the tree immediately below said "116 pages in this
              domain". Two numbers, one screen, both claiming to be the page count.

              For a `direct` domain it was worse: every page hangs off `__main__`, which is
              the only root, so the badge always said "1 page" no matter how many there were.
            */}
            <Badge variant="secondary" className="font-normal">
              {totalPageCount} page{totalPageCount === 1 ? '' : 's'}
            </Badge>
            <Badge variant="outline" className="gap-1 font-normal">
              {isDirect ? (
                <Target className="size-3" aria-hidden="true" />
              ) : (
                <Network className="size-3" aria-hidden="true" />
              )}
              {isDirect ? 'Direct' : 'Hierarchical'}
            </Badge>
          </div>
        )}
      </div>

      <div className="border-b p-4">
        <DomainSelector
          domains={domains}
          selectedDomain={selectedDomain}
          onDomainChange={handleDomainChange}
        />
      </div>

      {/* ── Content ── */}
      {selectedDomain ? (
        <div className="space-y-4 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h4 className="font-medium">Pages in {selectedDomain.name}</h4>
              <p className="text-muted-foreground text-xs">
                {isDirect
                  ? 'New pages are created under the hidden __main__ page.'
                  : 'Create root-level pages, or nest them under an existing page.'}
              </p>
            </div>

            <Button size="sm" className="shrink-0" onClick={() => handleCreatePage(null)}>
              <Plus className="size-4" aria-hidden="true" />
              New page
            </Button>
          </div>

          {/*
            ⚠️ NOW A DIALOG. The previous comment here argued the opposite, and it was wrong in
            practice:

              "The create/edit form stays INLINE rather than moving into a dialog like the
               domain form did in G-3a. Deliberate: you pick a parent from the tree behind it,
               and the tree is the context for what you are typing."

            The reasoning sounded right but did not survive use. The form sits ABOVE a tree that
            can run to dozens of rows, so editing a page far down the list meant scrolling up to
            a form you could no longer see the subject of — and the parent is chosen from a
            dropdown inside the form, not by clicking the tree, so the tree was never really the
            context it claimed to be.

            It also produced a real bug: with the form mounted inline, clicking "Edit page" on a
            DIFFERENT row left every field showing the previous page's data. A `Dialog` unmounts
            its content on close, so that state cannot survive from one page to the next.

            The `key` below closes the same hole directly rather than relying on that.
          */}
          <Dialog
            open={showCreateForm || editingPage !== null}
            onOpenChange={(open) => !open && handleFormCancel()}
          >
            {/*
              `max-h-[85vh] overflow-y-auto` because this form is tall — title, slug, content
              type, parent, status and six country buttons — and a dialog that overflows the
              viewport traps its own save button off-screen.
            */}
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>
                  {editingPage ? `Edit "${editingPage.title}"` : 'New page'}
                </DialogTitle>
                <DialogDescription>
                  {editingPage
                    ? 'Update this page’s details, status and visibility.'
                    : `Add a page to ${selectedDomain?.name ?? 'this domain'}.`}
                </DialogDescription>
              </DialogHeader>

              {/*
                ⚠️ `key` FORCES A REMOUNT WHEN THE TARGET CHANGES.

                `PageForm` seeds its `useState` from `editingPage` — and a `useState` initializer
                runs once, on mount. Without a changing key, switching from one page to another
                while the form is open would keep the first page's values, which is exactly the
                bug reported. Keying on the id makes React treat each target as a different
                component instance, so the initializer runs again with the right data.

                `'new'` for the create case, so opening "New page" after an edit also starts
                clean rather than inheriting the edited page's fields.
              */}
              <PageForm
                key={editingPage?.id ?? 'new'}
                domain={selectedDomain}
                pages={pages}
                parentId={createParentId}
                editingPage={editingPage}
                onSuccess={handleFormSuccess}
                onCancel={handleFormCancel}
              />
            </DialogContent>
          </Dialog>

          {loading && (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
              {/* `animate-spin` on a lucide icon, replacing a hand-rolled
                  `animate-spin rounded-full border-b-2 border-blue-600` div. */}
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading pages…
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!loading && !error && (
            <PageTree
              pages={pages}
              domain={selectedDomain}
              expandedPages={expandedPages}
              onToggleExpand={handleToggleExpand}
              onCreateChild={handleCreatePage}
              onEditPage={handleEditPage}
              onDeletePage={handleDeletePage}
            />
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Globe className="text-muted-foreground size-8" aria-hidden="true" />
          <p className="font-medium">Select a domain to get started</p>
          <p className="text-muted-foreground text-sm">
            Choose one above to manage its pages.
          </p>
        </div>
      )}

      {/*
        Delete confirmation. Keyed by id so the in-flight/error state cannot carry over from
        one page to the next — the same reasoning as the domain delete dialog in G-3b.
      */}
      {deletingPage && (
        <DeletePageDialog
          key={deletingPage.id}
          page={deletingPage}
          onConfirm={() => confirmDeletePage(deletingPage)}
          onCancel={() => setDeletingPage(null)}
        />
      )}
    </div>
  );
}

/**
 * Delete confirmation for a page and everything beneath it.
 *
 * ⚠️ The API deletes the WHOLE SUBTREE — see `handleDeletePage`. This states the descendant
 * count before you commit, which the browser `confirm()` it replaces never did.
 *
 * Unlike the domain delete in G-3b there is no type-to-confirm step. That is a judgement
 * about proportion: deleting a domain destroys 70 pages and is rare, while pruning a page is
 * routine. The count plus a destructive button is the right amount of friction — adding more
 * to a frequent action just trains people to click through it.
 */
type DeletePageDialogProps = {
  page: Page;
  /** Resolves to an error message, or `null` on success. */
  onConfirm: () => Promise<string | null>;
  onCancel: () => void;
};

function DeletePageDialog({ page, onConfirm, onCancel }: DeletePageDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const descendants = countDescendants(page);

  async function handleConfirm() {
    setIsDeleting(true);
    setError(null);

    const failure = await onConfirm();

    if (failure) {
      setError(failure);
      setIsDeleting(false);
    }
    // On success the parent clears `deletingPage`, unmounting this — so no state update
    // here, which would run against an unmounted component.
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{page.title}"?</AlertDialogTitle>
          <AlertDialogDescription>
            {descendants > 0 ? (
              <>
                This page has{' '}
                <strong className="text-foreground">
                  {descendants} nested page{descendants === 1 ? '' : 's'}
                </strong>{' '}
                beneath it. Deleting it removes all of them and their content. This cannot be
                undone.
              </>
            ) : (
              <>
                This will permanently delete the page and its content. It has no nested pages.
                This cannot be undone.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          {/*
            `preventDefault()` stops Radix closing the dialog on click, so a failed delete
            can report itself here instead of vanishing. Same pattern as G-3b — see the long
            note there for why Radix honours it.
          */}
          <AlertDialogAction
            variant="destructive"
            disabled={isDeleting}
            onClick={(event) => {
              event.preventDefault();
              handleConfirm();
            }}
          >
            {isDeleting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {isDeleting ? 'Deleting…' : 'Delete page'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Find a page anywhere in the nested tree by id.
 *
 * The tree is nested, so a flat `.find()` would only ever match root pages. This walks
 * depth-first and returns as soon as it hits the id.
 */
function findPageInTree(pages: Page[], pageId: string): Page | null {
  for (const page of pages) {
    if (page.id === pageId) return page;

    const found = findPageInTree(page.children, pageId);
    if (found) return found;
  }
  return null;
}

/**
 * Count every descendant of a page — children, grandchildren, all the way down.
 *
 * This is the number the delete dialog needs, because the API deletes the whole subtree.
 * Counting `page.children.length` alone would report 3 for a branch that actually takes 20
 * pages with it, which is worse than saying nothing.
 */
function countDescendants(page: Page): number {
  return page.children.reduce((total, child) => total + 1 + countDescendants(child), 0);
}

/**
 * Build hierarchical page structure with correct parent logic
 */
function buildPageHierarchy(flatPages: any[], domain: Domain | null): Page[] {
  if (!domain || !flatPages.length) return [];
  
  // Transform flat pages to typed pages with hierarchy info
  /*
    ⚠️ THIS EXPLICIT FIELD LIST SILENTLY DROPS ANYTHING NOT NAMED IN IT.

    `status` was missing here, and the API was returning it perfectly well — this transform
    threw it away. Two visible symptoms, one cause:

      • `PageForm` read `editingPage.status` as `undefined` and fell back to PUBLISHED, so
        opening a DRAFT page for editing showed "Live". Saving it would then have published it.
      • `PageTree`'s badge is gated on `page.status && …`, so it was never truthy and no badge
        ever rendered — which looked like the badge had not been built.

    Neither failed loudly. A rebuild-by-field-list has no way to complain about a field it was
    never told about; it just quietly returns less than it was given. Same family of trap as the
    hand-written status list in `DomainFilters` (#24), and worth checking whenever a new column
    reaches the client.
  */
  const transformedPages: Page[] = flatPages.map(page => ({
    id: page.id,
    title: page.title,
    slug: page.slug,
    contentType: page.contentType,
    status: page.status,
    // ⚠️ The field this transform dropped last time. See the warning above.
    icon: page.icon,
    parentId: page.parentId,
    domainId: page.domainId,
    targetCountries: page.targetCountries,
    createdAt: new Date(page.createdAt),
    children: [],
    depth: 0,
    fullPath: '',
    previewUrl: ''
  }));

  // Build parent-child relationships
  const pageMap = new Map(transformedPages.map(p => [p.id, p]));
  const rootPages: Page[] = [];

  transformedPages.forEach(page => {
    if (page.parentId && pageMap.has(page.parentId)) {
      // Has parent - add to parent's children
      const parent = pageMap.get(page.parentId)!;
      parent.children.push(page);
    } else {
      // No parent or parent not found - this is a root page
      rootPages.push(page);
    }
  });

  // Calculate depth, full path, and preview URL for all pages
  const calculatePageInfo = (page: Page, depth: number = 0, parentPath: string = '') => {
    page.depth = depth;
    
    // Build full path based on domain type and hierarchy
    if (domain.pageType === 'direct') {
      // For direct domains, skip __main__ in the URL path
      if (page.slug === '__main__') {
        page.fullPath = '';
        page.previewUrl = `/domain/${domain.slug}`;
      } else {
        // Check if parent is __main__
        const parent = pageMap.get(page.parentId || '');
        if (parent && parent.slug === '__main__') {
          page.fullPath = page.slug;
        } else {
          page.fullPath = parentPath ? `${parentPath}/${page.slug}` : page.slug;
        }
        page.previewUrl = `/domain/${domain.slug}/${page.fullPath}`;
      }
    } else {
      // For hierarchical domains, build normal path
      page.fullPath = parentPath ? `${parentPath}/${page.slug}` : page.slug;
      page.previewUrl = `/domain/${domain.slug}/${page.fullPath}`;
    }

    // Recursively calculate for children
    page.children.forEach(child => {
      calculatePageInfo(child, depth + 1, page.fullPath);
    });

    // Sort children by creation date
    page.children.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  };

  // Calculate info for all root pages
  rootPages.forEach(page => calculatePageInfo(page));

  // Sort root pages by creation date
  rootPages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return rootPages;
}
