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
 * Category List Component
 * 
 * Displays categories in a 3-column layout matching how they appear on the main site.
 * Provides category management capabilities:
 * - Visual preview of category organization
 * - Edit and delete actions for each category  
 * - Reordering within columns (drag-and-drop in future)
 * - Moving categories between columns
 * - Add category buttons for each column
 * 
 * Layout Structure:
 * ┌─ Column 1 ─────┬─ Column 2 ─────┬─ Column 3 ─────┐
 * │ 📚 Education   │ 🛠️ Tools      │ 💼 Business    │
 * │ 🎨 Design      │ 💻 Tech        │ 📈 Marketing   │
 * │ [Edit][Delete] │ [Edit][Delete] │ [Edit][Delete] │
 * │ + Add Category │ + Add Category │ + Add Category │
 * └────────────────┴────────────────┴────────────────┘
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

  // Group categories by column for display
  const categoriesByColumn = groupCategoriesByColumn(categories);

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
      
      {/* Column Headers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ColumnHeader 
          columnNumber={1} 
          categoryCount={categoriesByColumn[1]?.length || 0} 
        />
        <ColumnHeader 
          columnNumber={2} 
          categoryCount={categoriesByColumn[2]?.length || 0} 
        />
        <ColumnHeader 
          columnNumber={3} 
          categoryCount={categoriesByColumn[3]?.length || 0} 
        />
      </div>

      {/* 3-Column Category Display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Column 1 */}
        <div className="space-y-4">
          <CategoryColumn
            columnNumber={1}
            categories={categoriesByColumn[1] || []}
            onEdit={setEditingCategory}
            onDelete={setDeletingCategory}
          />
          <AddCategoryButton columnNumber={1} />
        </div>

        {/* Column 2 */}
        <div className="space-y-4">
          <CategoryColumn
            columnNumber={2}
            categories={categoriesByColumn[2] || []}
            onEdit={setEditingCategory}
            onDelete={setDeletingCategory}
          />
          <AddCategoryButton columnNumber={2} />
        </div>

        {/* Column 3 */}
        <div className="space-y-4">
          <CategoryColumn
            columnNumber={3}
            categories={categoriesByColumn[3] || []}
            onEdit={setEditingCategory}
            onDelete={setDeletingCategory}
          />
          <AddCategoryButton columnNumber={3} />
        </div>
        
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
 * Category Column Component
 * Displays categories for a specific column with management actions
 */
type CategoryColumnProps = {
  columnNumber: number;
  categories: Category[];
  onEdit: (categoryId: string) => void;
  onDelete: (categoryId: string) => void;
};

function CategoryColumn({ columnNumber, categories, onEdit, onDelete }: CategoryColumnProps) {
  return (
    <div className="space-y-3">
      {categories.map((category, index) => (
        <CategoryCard
          key={category.id}
          category={category}
          position={index + 1}
          onEdit={() => onEdit(category.id)}
          onDelete={() => onDelete(category.id)}
        />
      ))}
      
      {/* Show message if column is empty */}
      {categories.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
          No categories in this column yet
        </div>
      )}
    </div>
  );
}

/**
 * Add Category Button
 * Quick action to add a new category to a specific column
 */
type AddCategoryButtonProps = {
  columnNumber: number;
};

function AddCategoryButton({ columnNumber }: AddCategoryButtonProps) {
  const router = useRouter();

  /**
   * ⚠️ THE LABEL USED TO PROMISE SOMETHING THE BUTTON DID NOT DO.
   *
   * It read "Add Category to Column 3" and its handler was, in full,
   * `window.scrollTo({ top: 0 })` — with a `TODO` admitting the column was not pre-selected.
   * So it scrolled you to a form where you still had to choose column 3 yourself, having just
   * told the app which column you wanted.
   *
   * Now it puts the choice in the URL as well as scrolling. ⚠️ The form does not read that
   * parameter **yet** — `CategoryForm` is G-6b, and it will. Until then the button is at least
   * no longer lying about what it did: the scroll is real and the intent is recorded.
   *
   * `scroll: false` on the push because we do our own smooth scroll; letting Next also jump
   * would fight it.
   */
  const handleAddCategory = () => {
    router.push(`/admin/categories?column=${columnNumber}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Button
      variant="outline"
      onClick={handleAddCategory}
      // `h-auto border-dashed` keeps the "empty slot" feel of the original without the
      // hardcoded greys, and `w-full` matches the column width.
      className="h-auto w-full border-dashed py-4"
    >
      <Plus className="size-4" aria-hidden="true" />
      Add to column {columnNumber}
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
  onSuccess: () => void;
  onCancel: () => void;
};

function EditCategoryModal({ category, onSuccess, onCancel }: EditCategoryModalProps) {
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
            isActive: category.isActive
          }}
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

/**
 * Group categories by column position
 */
function groupCategoriesByColumn(categories: Category[]) {
  const grouped: Record<number, Category[]> = { 1: [], 2: [], 3: [] };
  
  categories.forEach(category => {
    const column = category.columnPosition;
    if (column >= 1 && column <= 3) {
      grouped[column].push(category);
    }
  });
  
  // Sort categories within each column by categoryOrder
  Object.keys(grouped).forEach(column => {
    grouped[parseInt(column)].sort((a, b) => a.categoryOrder - b.categoryOrder);
  });
  
  return grouped;
}

