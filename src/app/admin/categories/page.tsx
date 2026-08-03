import { prisma } from '@/lib/prisma';
import { CategoryList } from '@/components/admin/categories/CategoryList';
import { ChevronDown, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { AdminPageHeader } from '@/components/admin/layout/AdminPageHeader';
import { CategoryForm } from '@/components/admin/categories/CategoryForm';

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
  
  const activeCount = categories.filter(c => c.isActive).length;

  return (
    <>
      {/*
        ⚠️ REBUILT IN G-6a. The `Roboto` import is gone — this was one of the **last two**
        `next/font/google` importers in the admin, downloading a second webfont to style four
        headings against the app-wide Geist.

        The `from-blue-50 to-indigo-50` gradient intro banner is gone too (fourth time this
        phase, after G-2, G-3a and G-4b): it described the screen you were already on and was
        hardcoded light.

        The two `bg-white rounded-3xl border-gray-300` panels are now `Card`s.
      */}
      <AdminPageHeader
        title="Categories"
        description={`${categories.length} categories across 3 homepage columns · ${activeCount} active.`}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create a category</CardTitle>
          <CardDescription>
            Categories group your domains into the three columns of the public homepage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Column layout</CardTitle>
          <CardDescription>
            {/*
              ⚠️ THIS SUBTITLE USED TO PROMISE DRAG-AND-DROP: "Drag categories to reorder
              within columns or move between columns". **There is no drag-and-drop anywhere in
              these components** — grepped for `draggable`, `onDragStart`, `onDrop` and every
              dnd library: nothing. `CategoryList`'s own header comment even says
              "drag-and-drop in future".

              So the label was instructing you to do something impossible. Reordering is done
              by editing a category's column and order fields, and that is what it now says.
            */}
            How your categories appear on the homepage. To move one, edit it and change its
            column or order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryList categories={categories} />
        </CardContent>
      </Card>

      {/* Tips, collapsed by default — the same treatment as the Domains and Pages screens. */}
      <Collapsible defaultOpen={false}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Lightbulb className="size-4" aria-hidden="true" />
            Category tips
            <ChevronDown
              className="size-4 transition-transform [[data-state=open]_&]:rotate-180"
              aria-hidden="true"
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-2">
            <CardContent>
              <ul className="text-muted-foreground space-y-2 text-sm">
                <li>
                  <strong className="text-foreground">Column balance:</strong> keep categories
                  evenly distributed across the three columns.
                </li>
                <li>
                  <strong className="text-foreground">Clear names:</strong> descriptive names
                  users will recognise at a glance.
                </li>
                <li>
                  <strong className="text-foreground">Icons:</strong> a relevant emoji makes a
                  category visually distinct.
                </li>
                <li>
                  <strong className="text-foreground">Order:</strong> most important categories
                  at the top of each column.
                </li>
                <li>
                  <strong className="text-foreground">Slugs:</strong> short and lowercase — they
                  become part of the public URL and are awkward to change later.
                </li>
              </ul>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </>
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
