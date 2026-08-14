'use client';

import { useState } from 'react';
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
  // State for managing category operations
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Group categories by column for display
  const categoriesByColumn = groupCategoriesByColumn(categories);

  // Find the category being edited
  const categoryToEdit = editingCategory 
    ? categories.find(cat => cat.id === editingCategory) 
    : null;

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

      {/* Empty State */}
      {categories.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📂</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Categories Yet
          </h3>
          <p className="text-gray-600 mb-6">
            Create your first category to organize your domains
          </p>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Create First Category
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCategory && (
        <DeleteConfirmationModal
          categoryId={deletingCategory}
          isDeleting={isDeleting}
          onConfirm={() => handleDeleteCategory(deletingCategory, setIsDeleting)}
          onCancel={() => setDeletingCategory(null)}
        />
      )}

      {/* Edit Category Modal */}
      {editingCategory && categoryToEdit && (
        <EditCategoryModal
          category={categoryToEdit}
          onSuccess={() => {
            setEditingCategory(null);
            window.location.reload(); // Refresh to show changes
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
    <div className="text-center pb-4 border-b border-gray-200">
      <h4 className="text-lg font-semibold text-gray-900">
        {columnTitles[columnNumber as keyof typeof columnTitles]}
      </h4>
      <p className="text-sm text-gray-600 mt-1">
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
        <div className="text-center py-8 text-gray-500 text-sm border-2 border-dashed border-gray-200 rounded-lg">
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
  const handleAddCategory = () => {
    // TODO: In future, this could open a modal or scroll to form with column pre-selected
    // For now, we'll scroll to the form at the top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      onClick={handleAddCategory}
      className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
    >
      <span className="text-lg mr-2">+</span>
      Add Category to Column {columnNumber}
    </button>
  );
}

/**
 * Delete Confirmation Modal
 * Confirms category deletion with warning about domains
 */
type DeleteConfirmationModalProps = {
  categoryId: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

function DeleteConfirmationModal({ categoryId, isDeleting, onConfirm, onCancel }: DeleteConfirmationModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-mx mx-4">
        <div className="flex items-center mb-4">
          <span className="text-2xl mr-3">⚠️</span>
          <h3 className="text-lg font-semibold text-gray-900">
            Delete Category
          </h3>
        </div>
        
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete this category? This action cannot be undone. 
          Any domains in this category will need to be reassigned.
        </p>
        
        <div className="flex items-center justify-end space-x-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className={`
              px-4 py-2 border border-gray-300 text-gray-700 rounded-lg transition-colors
              ${isDeleting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}
            `}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className={`
              px-4 py-2 rounded-lg font-medium transition-colors
              ${isDeleting 
                ? 'bg-gray-400 text-gray-700 cursor-not-allowed' 
                : 'bg-red-600 text-white hover:bg-red-700'
              }
            `}
          >
            {isDeleting ? 'Deleting...' : 'Delete Category'}
          </button>
        </div>
      </div>
    </div>
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                Edit Category
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Update category information and settings
              </p>
            </div>
            
            {/* Close Button */}
            <button
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close"
            >
              <span className="text-xl text-gray-400">×</span>
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="px-6 py-6">
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
        </div>
        
      </div>
    </div>
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

/**
 * Handle category deletion
 * Manages loading state during deletion process
 */
async function handleDeleteCategory(categoryId: string, setIsDeleting: (loading: boolean) => void) {
  try {
    setIsDeleting(true);
    
    const response = await fetch(`/api/admin/categories/${categoryId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete category');
    }
    
    // Success - refresh page or update state
    window.location.reload();
    
  } catch (error) {
    console.error('Error deleting category:', error);
    alert('Failed to delete category. Please try again.');
    setIsDeleting(false);
  }
}
