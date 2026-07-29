import { prisma } from '@/lib/prisma';
import { CategoryList } from '@/components/admin/categories/CategoryList';
import { CategoryForm } from '@/components/admin/categories/CategoryForm';
import { Roboto } from 'next/font/google';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});

/**
 * ⚠️ DO NOT REMOVE — finding #20. This page calls `prisma.domainCategory.findMany` during
 * render and uses no dynamic API, so Next 15 would prerender it at BUILD time and serve
 * frozen HTML: a newly created or renamed category would not appear until the next deploy.
 *
 * `revalidateTag` cannot help — this reads Prisma directly, so nothing is tagged. See the
 * full explanation in src/app/admin/page.tsx.
 */
export const dynamic = 'force-dynamic';

/**
 * Admin Categories Management Page
 * 
 * Main page for managing domain categories with:
 * - 3-column layout preview showing how categories will appear on main site
 * - Category CRUD operations (Create, Read, Update, Delete)
 * - Drag and drop reordering within columns
 * - Column assignment (moving categories between columns)
 * 
 * Layout Structure:
 * ┌─ Category Form (Create/Edit) ────────────────────────────┐
 * │ [Name] [Slug] [Icon] [Column] [Description] [Save]      │
 * └──────────────────────────────────────────────────────────┘
 * ┌─ 3-Column Preview ──────────────────────────────────────┐
 * │ Column 1        │ Column 2        │ Column 3            │
 * │ [📚 Education]  │ [🛠️ Tools]     │ [💼 Business]       │
 * │ [🎨 Design]     │ [💻 Tech]       │ [📈 Marketing]      │ 
 * │ + Add Category  │ + Add Category  │ + Add Category      │
 * └──────────────────────────────────────────────────────────┘
 */

export default async function CategoriesManagePage() {
  // Fetch all categories ordered by column and position for display
  const categories = await fetchCategoriesForAdmin();
  
  return (
    <div className="space-y-8">
      
      {/* Page Introduction */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          📂 Manage Domain Categories
        </h2>
        <p className="text-gray-600">
          Organize your content domains into a 3-column layout. 
          Categories help users navigate your content effectively.
        </p>
      </div>

      {/* Category Creation Form */}
      <div className="bg-white rounded-3xl border border-gray-300 p-6">

        {/* Category Creation Form Section Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className={`text-xl font-semibold text-gray-900 ${roboto.className}`}>
              Create New Category
            </h3>
            <p className={`text-md text-gray-600 mt-1 ${roboto.className}`}>
              Add a new category to organize your domains
            </p>
          </div>
          
          {/* Category Stats */}
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span>📊 {categories.length} total categories</span>
            <span>✅ {categories.filter(c => c.isActive).length} active</span>
          </div>
        </div>
        
        {/* Category Form Component */}
        <CategoryForm />
      </div>

      {/* Main Categories Management Interface */}
      <div className="bg-white rounded-3xl border border-gray-300 p-6">
        <div className="mb-6">
          <h3 className={`text-xl font-semibold text-gray-900 ${roboto.className}`}>
            Category Layout Preview
          </h3>
          <p className={`text-md text-gray-600 mt-1 ${roboto.className}`}>
            Drag categories to reorder within columns or move between columns
          </p>
        </div>
        
        {/* 3-Column Category Display */}
        <CategoryList categories={categories} />
      </div>

      {/* Category Management Tips */}
      <div className="bg-blue-50 rounded-lg p-6 border border-blue-100">
        <h4 className="font-semibold text-blue-900 mb-3">
          💡 Category Management Tips
        </h4>
        <ul className="text-sm text-black space-y-2">
          <li>• <strong>Column Balance:</strong> Keep categories evenly distributed across the 3 columns</li>
          <li>• <strong>Clear Names:</strong> Use descriptive names that users will easily understand</li>
          <li>• <strong>Icons:</strong> Choose relevant emoji icons to make categories visually distinct</li>
          <li>• <strong>Order Matters:</strong> Put most important categories at the top of each column</li>
          <li>• <strong>Slugs:</strong> Keep URL slugs short, lowercase, and SEO-friendly</li>
        </ul>
      </div>
      
    </div>
  );
}

/**
 * Fetch Categories for Admin Management
 * 
 * Retrieves all categories with their associated domain counts
 * Ordered by column position and category order for display
 * Includes inactive categories for management purposes
 */
async function fetchCategoriesForAdmin() {
  try {
    // Fetch all categories with domain counts and proper ordering
    const categories = await prisma.domainCategory.findMany({
      include: {
        domains: {
          select: {
            id: true,
            name: true,
            isPublished: true
          }
        },
        _count: {
          select: {
            domains: true
          }
        }
      },
      orderBy: [
        { columnPosition: 'asc' },    // First by column (1, 2, 3)
        { categoryOrder: 'asc' }      // Then by order within column
      ]
    });

    // Transform data for easier use in components
    return categories.map(category => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      icon: category.icon,
      description: category.description,
      columnPosition: category.columnPosition,
      categoryOrder: category.categoryOrder,
      isActive: category.isActive,
      createdAt: category.createdAt,
      
      // Domain information
      domainCount: category._count.domains,
      publishedDomains: category.domains.filter(d => d.isPublished).length,
      domains: category.domains
    }));
    
  } catch (error) {
    console.error('Error fetching categories for admin:', error);
    
    // Return empty array if database query fails
    return [];
  }
}
