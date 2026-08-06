'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, FolderOpen, Loader2, Plus } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CategoryCard } from './CategoryCard';
import { CategoryForm } from './CategoryForm';

/**
 * Category List Component — a true preview of the public grid.
 * ============================================================================
 *
 * ⚠️ REBUILT FROM THREE STACKS INTO A ROW GRID, AND THIS IS THE POINT OF THE CHANGE.
 *
 * The old version bucketed categories by `columnPosition` and sorted each bucket by
 * `categoryOrder` — three independent columns, where `categoryOrder` was just a sort key and
 * only its relative value mattered. **The public page has never worked that way.**
 * `organizeDomainsIntoRows` in `src/app/domain/page.tsx` groups by `categoryOrder` as a ROW
 * NUMBER, lays out a 3-wide grid, and renders a blank cell wherever a row has no category in
 * a given column.
 *
 * So the same field meant "sort key within a column" here and "which horizontal band" there.
 * The admin drew three tidy stacks; the live site had five empty cells and large vertical
 * gaps. Nothing on this screen could show you that, let alone let you fix it.
 *
 * What is rendered now is the same shape the public page produces:
 *
 *   Row 1  [ Design    ][ Development ][ Video    ]
 *   Row 2  [ Marketing ][  + Add here ][ + Add here ]
 *   Row 3  [ New Tech  ][  + Add here ][ + Add here ]
 *   Row 4  [ + Add here][ Other       ][ Business ]
 *
 * The empty cells are the feature, not clutter: each one is a real gap on the homepage and a
 * button that opens the create form pre-aimed at exactly that cell.
 *
 * ⚠️ Rows are the sorted set of DISTINCT `categoryOrder` values, not indexes. Values of
 * 1/2/3/4 and 10/20/30/40 render identically — gaps collapse. What matters is only whether
 * two categories SHARE a value, which is what puts them side by side.
 */

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  columnPosition: number;
  categoryOrder: number;
  isActive: boolean;
  domainCount: number;
  publishedDomains: number;
};

type CategoryListProps = {
  categories: Category[];
};

/** categories data example
{
    "success": true,
    "categories": [
        {
            "id": "09cf15c2-974e-4690-a801-66cae0f85484",
            "name": "First Category",
            "slug": "first",
            "icon": null,
            "description": null,
            "columnPosition": 1,
            "categoryOrder": 0,
            "isActive": true,
            "createdAt": "2025-08-29T19:22:28.345Z",
            "domainCount": 5,
            "publishedDomains": 5,
            "domains": [
                {
                    "id": "cf28e597-0d85-440e-869c-243d1cf35286",
                    "name": "🖌️ Graphic Designing",
                    "isPublished": true
                },
                {
                    "id": "0bdd8941-3abf-4102-aa31-27d143096fe2",
                    "name": "🍪 Logo | Brand Designing",
                    "isPublished": true
                },
                {
                    "id": "1afa4b5a-7f41-4343-aa21-a6e3668ca02f",
                    "name": "🖼️ UI/UX Designing",
                    "isPublished": true
                },
                {
                    "id": "314d1237-1d0d-40f4-9eab-228cde06b454",
                    "name": "📝 Content Writing",
                    "isPublished": true
                },
                {
                    "id": "3059f7f5-7d09-49af-ac47-41e990bad6d5",
                    "name": "🎯 Copywriting",
                    "isPublished": true
                }
            ]
        },
        {
            "id": "ee9b2686-cd8e-4415-b4d8-3cb9373f641f",
            "name": "Fourth Category",
            "slug": "fourth",
            "icon": null,
            "description": null,
            "columnPosition": 1,
            "categoryOrder": 1,
            "isActive": true,
            "createdAt": "2025-08-29T19:22:28.392Z",
            "domainCount": 5,
            "publishedDomains": 5,
            "domains": [
                {
                    "id": "5bd9b6d5-28b7-4db5-b3d5-c88b728100dd",
                    "name": "🏆 Digital Marketing",
                    "isPublished": true
                },
                {
                    "id": "2005926d-f7a7-4f07-a613-75f8aea44562",
                    "name": "🍄 Social Media Marketing",
                    "isPublished": true
                },
                {
                    "id": "7501667d-07bc-4251-a4a3-59c12d6dc7bf",
                    "name": "🎏 Social Media Management",
                    "isPublished": true
                },
                {
                    "id": "5f96f0d7-32b4-491e-92ab-8b4adfa888fc",
                    "name": "🧩 Affiliate Marketing",
                    "isPublished": true
                },
                {
                    "id": "23c33a9f-e834-4c86-a2aa-8ab11be0f2e6",
                    "name": "📩 Email Marketing",
                    "isPublished": true
                }
            ]
        },
        {
            "id": "202f456c-387c-4660-9d10-acf1e5f0b41f",
            "name": "Second Category",
            "slug": "second",
            "icon": null,
            "description": null,
            "columnPosition": 2,
            "categoryOrder": 0,
            "isActive": true,
            "createdAt": "2025-08-29T19:22:28.384Z",
            "domainCount": 5,
            "publishedDomains": 5,
            "domains": [
                {
                    "id": "40383f19-4c6b-4a5b-9836-329c93537032",
                    "name": "🌐 Web Development",
                    "isPublished": true
                },
                {
                    "id": "6256b07e-7617-4db6-b95c-a67add345bac",
                    "name": "📱 App Development",
                    "isPublished": true
                },
                {
                    "id": "b4e902a8-b934-4007-a4b0-0a6aab3de16c",
                    "name": "🎮 Game Development",
                    "isPublished": true
                },
                {
                    "id": "a3f25f03-c525-4168-ad81-ae970bdbdc4c",
                    "name": "👨‍💻 Cybersecurity | Hacking",
                    "isPublished": true
                },
                {
                    "id": "b183dc58-fc5f-4fb5-ab77-4eaab78b4b74",
                    "name": "📊 Data Science",
                    "isPublished": true
                }
            ]
        },
        {
            "id": "97741027-25d5-46af-b50f-c189a9521f2d",
            "name": "Fifth Category",
            "slug": "fifth",
            "icon": null,
            "description": null,
            "columnPosition": 2,
            "categoryOrder": 1,
            "isActive": true,
            "createdAt": "2025-08-29T19:22:28.394Z",
            "domainCount": 5,
            "publishedDomains": 5,
            "domains": [
                {
                    "id": "823aef78-c96e-44b1-881b-81ee236abd2c",
                    "name": "🌎 Gaming | E-Sports",
                    "isPublished": true
                },
                {
                    "id": "4eeac763-57f7-4db8-920d-29be16eeb8cc",
                    "name": "📸 Photography",
                    "isPublished": true
                },
                {
                    "id": "81f2fb47-a3de-4b06-b669-5185a01b3d27",
                    "name": "🛍️ Dropshipping [Indian]",
                    "isPublished": true
                },
                {
                    "id": "257e923e-0ddd-4394-9f41-588fedf14865",
                    "name": "🎙️ Podcasting (Video/Audio)",
                    "isPublished": true
                },
                {
                    "id": "e650869b-a2be-44e1-b07d-1445be9243f3",
                    "name": "💁 Virtual Assistant",
                    "isPublished": true
                }
            ]
        },
        {
            "id": "33fb14c9-06e1-4ea6-8570-f043640a450c",
            "name": "Third Category",
            "slug": "third",
            "icon": null,
            "description": null,
            "columnPosition": 3,
            "categoryOrder": 0,
            "isActive": true,
            "createdAt": "2025-08-29T19:22:28.388Z",
            "domainCount": 5,
            "publishedDomains": 5,
            "domains": [
                {
                    "id": "fa87b024-b676-48d7-95f8-f022d68244fc",
                    "name": "▶️ YouTuber",
                    "isPublished": true
                },
                {
                    "id": "ee2bc79a-96a2-4811-801d-f87bc467462f",
                    "name": "📽️ Videography",
                    "isPublished": true
                },
                {
                    "id": "31879679-1234-47c9-804d-4e4fdd9de848",
                    "name": "🟩 VFX Artist",
                    "isPublished": true
                },
                {
                    "id": "1d631d50-df15-41a6-bc68-a0f27508814d",
                    "name": "🎬 Video Editing",
                    "isPublished": true
                },
                {
                    "id": "1ae3b5c8-042b-431a-ac80-eb87d0a28e49",
                    "name": "🃏 2D/3D Animation",
                    "isPublished": true
                }
            ]
        },
        {
            "id": "4b9248e6-27b9-46f4-a7c9-6e00e0c35d9d",
            "name": "Business",
            "slug": "business",
            "icon": "🎯",
            "description": "Just all the Domains with Business",
            "columnPosition": 3,
            "categoryOrder": 1,
            "isActive": false,
            "createdAt": "2025-08-31T06:13:03.918Z",
            "domainCount": 0,
            "publishedDomains": 0,
            "domains": []
        }
    ]
}
 */

export function CategoryList({ categories }: CategoryListProps) {
  const router = useRouter();

  // State for managing category operations
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  /** The server's message when a delete was refused — shown inside the dialog. */
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // The grid exactly as the public page would lay it out.
  const rows = buildRowGrid(categories);

  // Per-column totals for the three headers. Counted from the raw list rather than the grid,
  // so the number is right regardless of how the rows happen to be arranged.
  const countInColumn = (column: number) =>
    categories.filter((cat) => cat.columnPosition === column).length;

  /*
    Both dialogs look their category up by id on every render rather than storing a copy, so
    that after `router.refresh()` re-runs the server query they show the FRESH record. A stored
    copy would keep displaying stale values until closed.
  */
  const categoryToEdit = editingCategory
    ? categories.find(cat => cat.id === editingCategory)
    : null;

  const categoryToDelete = deletingCategory
    ? categories.find(cat => cat.id === deletingCategory)
    : null;

  /**
   * Delete a category.
   *
   * ⚠️ Returns the SERVER'S message on failure instead of a generic one. The API refuses to
   * delete a category that still holds domains and says exactly how many — information the old
   * `alert('Failed to delete category. Please try again.')` discarded, replacing it with advice
   * that could never work.
   */
  const handleDelete = async (categoryId: string) => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/admin/categories/${categoryId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setDeleteError(body?.message ?? `Delete failed (HTTP ${response.status})`);
        setIsDeleting(false);
        return;
      }

      setDeletingCategory(null);
      setIsDeleting(false);
      // `router.refresh()` rather than `window.location.reload()` — re-runs the server
      // component without discarding the document (#22.6).
      router.refresh();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Network error.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/*
        Column headers. `hidden md:grid` because below the `md` breakpoint the grid collapses
        to one column, so "Left / Center / Right" would sit above a single stack and describe
        nothing.
      */}
      <div className="hidden md:grid md:grid-cols-3 gap-4">
        <ColumnHeader columnNumber={1} categoryCount={countInColumn(1)} />
        <ColumnHeader columnNumber={2} categoryCount={countInColumn(2)} />
        <ColumnHeader columnNumber={3} categoryCount={countInColumn(3)} />
      </div>

      {/* Row-by-row grid — the same shape the public page renders. */}
      <div className="space-y-6">
        {rows.map((row) => (
          <div key={row.order} className="space-y-2">
            {/*
              A labelled divider per row. Without it the grid is just a wall of cards and
              there is no way to tell which band a card belongs to — which is the one thing
              this screen now exists to communicate.
            */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium">
                {row.isNew ? 'New row' : `Row ${row.order}`}
              </span>
              <div className="bg-border h-px flex-1" />
              <span className="text-muted-foreground text-xs">
                {row.isNew
                  ? 'add a category here to start a new row'
                  : `${row.filled} of 3 columns used`}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((column) => {
                const category = row.cells[column];

                return category ? (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    onEdit={() => setEditingCategory(category.id)}
                    onDelete={() => setDeletingCategory(category.id)}
                  />
                ) : (
                  <EmptyCell key={`${row.order}-${column}`} column={column} row={row.order} />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/*
        Empty state.

        ⚠️ Its "Create First Category" button was DEAD — no `onClick`, no `href`, nothing. It
        rendered, it was clickable, and it did nothing (the #22.5 pattern again). The form
        lives at the top of this same page, so the honest fix is to point at it rather than
        invent a second route.
      */}
      {categories.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <FolderOpen className="text-muted-foreground size-8" aria-hidden="true" />
          <p className="font-medium">No categories yet</p>
          <p className="text-muted-foreground text-sm">
            Use the form above to create your first category.
          </p>
        </div>
      )}

      {deletingCategory && categoryToDelete && (
        <DeleteConfirmationModal
          // Keyed by id so the in-flight and error state cannot carry from one category to
          // the next — same reasoning as the domain delete dialog in G-3b.
          key={categoryToDelete.id}
          category={categoryToDelete}
          isDeleting={isDeleting}
          error={deleteError}
          onConfirm={() => handleDelete(categoryToDelete.id)}
          onCancel={() => {
            setDeletingCategory(null);
            setDeleteError(null);
          }}
        />
      )}

      {editingCategory && categoryToEdit && (
        <EditCategoryModal
          category={categoryToEdit}
          // The full list, so the form's Row dropdown can say which cells are occupied and
          // by whom.
          categories={categories}
          onSuccess={() => {
            setEditingCategory(null);
            router.refresh();
          }}
          onCancel={() => setEditingCategory(null)}
        />
      )}

    </div>
  );
}

/**
 * Column Header Component
 * Shows column title and category count
 */
type ColumnHeaderProps = {
  columnNumber: number;
  categoryCount: number;
};

function ColumnHeader({ columnNumber, categoryCount }: ColumnHeaderProps) {
  const columnTitles = {
    1: 'Left Column',
    2: 'Center Column', 
    3: 'Right Column'
  };

  return (
    <div className="text-center pb-4 border-b">
      <h4 className="text-lg font-semibold">
        {columnTitles[columnNumber as keyof typeof columnTitles]}
      </h4>
      <p className="text-sm text-muted-foreground mt-1">
        {categoryCount} categor{categoryCount !== 1 ? 'ies' : 'y'}
      </p>
    </div>
  );
}

/**
 * An empty cell in the grid — a real gap on the public homepage.
 *
 * ⚠️ REPLACES `AddCategoryButton`, which sat once per column and said "Add to column 3".
 * That button carried `?column=3` and nothing else, so the form had to guess a row, and the
 * only row it could safely guess was a brand new one at the bottom. Which is precisely how
 * the live site ended up with five empty cells: **every category added through the UI started
 * its own row.**
 *
 * Now every gap is its own button and carries BOTH coordinates, so "put this category beside
 * Development" is a single click on the cell next to Development.
 */
type EmptyCellProps = {
  column: number;
  row: number;
};

function EmptyCell({ column, row }: EmptyCellProps) {
  const router = useRouter();

  const handleClick = () => {
    // `scroll: false` because we run our own smooth scroll below; letting Next jump as well
    // makes the two fight and the page lands in the wrong place.
    router.push(`/admin/categories?column=${column}&row=${row}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Button
      variant="outline"
      onClick={handleClick}
      // `h-auto ... min-h-` rather than a fixed height: the cell should look like a slot in
      // the row without stretching to match a tall neighbouring card.
      className="text-muted-foreground h-auto min-h-24 w-full border-dashed"
    >
      <Plus className="size-4" aria-hidden="true" />
      Add here
    </Button>
  );
}

/**
 * Delete Confirmation Modal
 * Confirms category deletion with warning about domains
 */
type DeleteConfirmationModalProps = {
  /** The whole category, not just its id — the dialog needs `name` and `domainCount`. */
  category: Category;
  isDeleting: boolean;
  /** The server's message when a delete failed, shown inside the dialog. */
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

function DeleteConfirmationModal({
  category,
  isDeleting,
  error,
  onConfirm,
  onCancel,
}: DeleteConfirmationModalProps) {
  /**
   * ⚠️ THE OLD DIALOG PROMISED SOMETHING THE API REFUSES.
   *
   * It read: *"Any domains in this category will need to be reassigned"* — implying the delete
   * would go through and leave you to tidy up. In fact `DELETE /api/admin/categories/[id]`
   * **blocks** it outright when the category holds domains, and returns a specific message
   * naming the count.
   *
   * `domainCount` is already on the category, so we can say so BEFORE the attempt rather than
   * after a failure — and disable the button, since pressing it could only ever fail.
   */
  const isBlocked = category.domainCount > 0;

  return (
    /*
      ⚠️ A real `AlertDialog`, replacing `fixed inset-0 bg-black bg-opacity-50`.
      `bg-opacity-*` is Tailwind **v3** and was removed in v4 — which this project uses — so
      the unknown utility was dropped and only `bg-black` applied: the "translucent" overlay
      **blacked out the whole page**. This was the second instance of the same bug; the first
      was fixed in `DomainsTable` in G-3b. (The old markup also carried `w-mx`, which is not a
      real Tailwind class at all.)
    */
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isBlocked ? `"${category.name}" still has domains` : `Delete "${category.name}"?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isBlocked ? (
              <>
                This category holds{' '}
                <strong className="text-foreground">
                  {category.domainCount} domain{category.domainCount === 1 ? '' : 's'}
                </strong>
                , so it cannot be deleted yet. Move those domains to another category first —
                Domains → edit → Category.
              </>
            ) : (
              <>
                This category has no domains, so nothing else is affected. This cannot be
                undone.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/*
          The server's own message, shown verbatim. The old code replaced it with
          `alert('Failed to delete category. Please try again.')` — advice that is not just
          unhelpful but wrong, since a retry fails identically every time.
        */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            {isBlocked ? 'Close' : 'Cancel'}
          </AlertDialogCancel>
          {!isBlocked && (
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              // `preventDefault()` keeps the dialog open so a failure can be reported here —
              // Radix would otherwise close it on click. Same pattern as G-3b.
              onClick={(event) => {
                event.preventDefault();
                onConfirm();
              }}
            >
              {isDeleting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {isDeleting ? 'Deleting…' : 'Delete category'}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Edit Category Modal
 * Shows the category form in edit mode within a modal overlay
 */
type EditCategoryModalProps = {
  category: Category;
  /** Every category — the form needs the whole set to work out row occupancy. */
  categories: Category[];
  onSuccess: () => void;
  onCancel: () => void;
};

function EditCategoryModal({
  category,
  categories,
  onSuccess,
  onCancel,
}: EditCategoryModalProps) {
  return (
    /*
      ⚠️ THE SECOND `bg-opacity-50` OVERLAY — same dead-class bug as the delete dialog above,
      so this one blacked out the page too.

      A real `Dialog` also supplies what the hand-rolled version lacked: Escape to close, focus
      trapped inside, focus returned to the trigger, `aria-modal` and labelling, and body
      scroll lock. The hand-rolled close button was a bare `×` character, which a screen reader
      announces as "multiplication sign"; `DialogContent` brings a labelled one.
    */
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit category</DialogTitle>
          <DialogDescription>
            {/* Naming it confirms which card you opened. */}
            Update the settings for &ldquo;{category.name}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <CategoryForm
          category={{
            id: category.id,
            name: category.name,
            slug: category.slug,
            icon: category.icon,
            description: category.description,
            columnPosition: category.columnPosition,
            // ⚠️ Was NOT passed before, because the form had no row field to receive it. Its
            // absence is why editing a category and saving could not preserve — let alone
            // change — the row it sits on.
            categoryOrder: category.categoryOrder,
            isActive: category.isActive
          }}
          categories={categories}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Utility Functions
 */

/** One horizontal band of the grid. */
type GridRow = {
  /** The `categoryOrder` value this band represents. */
  order: number;
  /** Column number → the category in that cell, if any. */
  cells: Record<number, Category | undefined>;
  /** How many of the three columns are occupied — shown in the row divider. */
  filled: number;
  /** True for the trailing placeholder band that holds no categories yet. */
  isNew: boolean;
};

/**
 * Build the grid the public page would render.
 *
 * ⚠️ REPLACES `groupCategoriesByColumn`, which bucketed by column and sorted each bucket —
 * three independent stacks. That model does not exist anywhere on the public site; see the
 * note at the top of this file.
 *
 * This mirrors `organizeDomainsIntoRows` in `src/app/domain/page.tsx` deliberately, so that
 * what is drawn here and what visitors see cannot drift apart. Two differences, both
 * intentional:
 *
 *   1. **Inactive categories are kept.** The public query filters on `isActive`; an admin
 *      still has to see and manage a hidden category, and the card marks it Inactive.
 *   2. **Categories with no domains are kept.** The public renderer skips those (an empty
 *      category contributes no links, so it would render as a blank cell anyway) — but here
 *      an empty category is a thing you are probably about to fill.
 *
 * ⚠️ Both differences mean a row can look occupied here and render empty publicly. That is
 * the honest trade: hiding them would make categories vanish from the only screen that
 * manages them.
 */
function buildRowGrid(categories: Category[]): GridRow[] {
  // Every distinct row value in use, ascending. Values need not be contiguous — a gap simply
  // means one fewer band, exactly as on the public page.
  const orders = [...new Set(categories.map((cat) => cat.categoryOrder))].sort((a, b) => a - b);

  const rows: GridRow[] = orders.map((order) => {
    const cells: Record<number, Category | undefined> = {};

    for (const cat of categories) {
      if (cat.categoryOrder !== order) continue;
      if (cat.columnPosition < 1 || cat.columnPosition > 3) continue;

      /*
        ⚠️ FIRST WRITER WINS, and a clash is surfaced rather than hidden.

        The public renderer does `orderGroups[order][column] = group` — a plain overwrite — so
        if two categories ever share a (column, row) pair, one of them disappears from the live
        site with no error anywhere. The API now refuses to create that state, but data written
        before this change (or directly in the database) could still hold it.

        Rather than silently drop the loser as the public page does, the card is kept out of
        the cell and the console says which one, so the screen does not quietly agree with a
        bug it exists to expose.
      */
      if (cells[cat.columnPosition]) {
        console.warn(
          `[categories] Column ${cat.columnPosition} row ${order} holds more than one category: ` +
            `"${cells[cat.columnPosition]!.name}" and "${cat.name}". Only the first is visible ` +
            `on the public page. Move one of them to another row.`
        );
        continue;
      }

      cells[cat.columnPosition] = cat;
    }

    return {
      order,
      cells,
      filled: [1, 2, 3].filter((column) => cells[column]).length,
      isNew: false,
    };
  });

  /*
    A trailing empty band, so there is always a way to start a new row. Without it the only
    route to a fourth row would be an occupied cell's edit form, and a screen with no
    categories at all would offer no "add" button anywhere.
  */
  rows.push({
    order: (orders[orders.length - 1] ?? 0) + 1,
    cells: {},
    filled: 0,
    isNew: true,
  });

  return rows;
}

