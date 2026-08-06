import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/api-auth';
import { invalidateCategories } from '@/lib/cache-invalidation';

/**
 * Individual Category API Routes
 * 
 * Handles operations on specific categories:
 * - GET: Fetch single category details
 * - PUT: Update category
 * - DELETE: Delete category (with safety checks)
 */

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/admin/categories/[id]
 * Fetch details for a specific category
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Layer 2 of defence in depth — see src/lib/api-auth.ts for the reasoning.
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { id } = await params;

    const category = await prisma.domainCategory.findUnique({
      where: { id },
      include: {
        domains: {
          select: {
            id: true,
            name: true,
            slug: true,
            isPublished: true
          }
        },
        _count: {
          select: {
            domains: true
          }
        }
      }
    });

    if (!category) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Category not found' 
        },
        { status: 404 }
      );
    }

    // Format response data
    const formattedCategory = {
      id: category.id,
      name: category.name,
      slug: category.slug,
      icon: category.icon,
      description: category.description,
      columnPosition: category.columnPosition,
      categoryOrder: category.categoryOrder,
      isActive: category.isActive,
      createdAt: category.createdAt,
      domainCount: category._count.domains,
      publishedDomains: category.domains.filter(d => d.isPublished).length,
      domains: category.domains
    };

    return NextResponse.json({
      success: true,
      category: formattedCategory
    });

  } catch (error) {
    console.error('Error fetching category:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch category' 
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/categories/[id]
 * Update an existing category
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Reject non-admins before reading the body or touching the database.
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const body = await request.json();

    // Check if category exists
    const existingCategory = await prisma.domainCategory.findUnique({
      where: { id }
    });

    if (!existingCategory) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Category not found' 
        },
        { status: 404 }
      );
    }

    // Validate request data
    const validationError = validateCategoryData(body, id);
    if (validationError) {
      return NextResponse.json(
        { 
          success: false, 
          message: validationError 
        },
        { status: 400 }
      );
    }

    const { name, slug, icon, description, columnPosition, isActive, categoryOrder } = body;

    // Check if slug is taken by another category
    if (slug !== existingCategory.slug) {
      const slugConflict = await prisma.domainCategory.findFirst({
        where: { 
          slug,
          id: { not: id } // Exclude current category
        }
      });

      if (slugConflict) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'A category with this slug already exists' 
          },
          { status: 409 }
        );
      }
    }

    const updateData: any = {
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      icon: icon?.trim() || null,
      description: description?.trim() || null,
      isActive: isActive ?? true,
      columnPosition
    };

    /**
     * Work out the target ROW, then place the category there.
     * ========================================================================
     *
     * ⚠️ THE OLD CODE ONLY TOUCHED `categoryOrder` INSIDE `if (columnPosition changed)`.
     *
     * That was the bug behind the whole feature. Two consequences:
     *
     *   1. Changing ONLY the row was impossible — there was no form field for it, and even if
     *      one had sent the value, this handler would have thrown it away.
     *   2. Changing the column always recomputed the row as `max + 1` in the destination, i.e.
     *      it appended to the bottom of that column. On the public page that is not "the
     *      bottom of a stack" — it is a BRAND NEW horizontal row with two empty cells, and the
     *      row the category left keeps a permanent hole. This is exactly the "why did it jump
     *      to a new row?" behaviour, and the live data showed five such empty cells.
     *
     * Now the row is applied on every save.
     */
    const targetOrder: number =
      typeof categoryOrder === 'number'
        ? categoryOrder // explicit, from the form
        : columnPosition !== existingCategory.columnPosition
          ? // Legacy caller that sends no row but does change column: keep the old
            // append-to-bottom behaviour rather than silently leaving it on its current row,
            // which could collide with whatever already sits there.
            ((
              await prisma.domainCategory.findFirst({
                where: { columnPosition },
                orderBy: { categoryOrder: 'desc' }
              })
            )?.categoryOrder ?? 0) + 1
          : existingCategory.categoryOrder; // nothing about the position is changing

    updateData.categoryOrder = targetOrder;

    /*
      Who, if anyone, is already in the destination cell? Excluding this category itself, so
      that re-saving without moving anything is not mistaken for a collision.
    */
    const occupants = await prisma.domainCategory.findMany({
      where: {
        columnPosition,
        categoryOrder: targetOrder,
        id: { not: id }
      }
    });

    /*
      ⚠️ More than one occupant means the table ALREADY holds duplicate (column, row) pairs —
      which this endpoint cannot produce, so it indicates a direct database write or an older
      concurrent create. It matters because a duplicate makes one of the two categories
      disappear from the public page silently (see the overwrite in
      `src/app/domain/page.tsx:118`). Refusing here is deliberate: a swap has no correct answer
      when there are two things to swap with, and quietly picking one would hide the corruption.
    */
    if (occupants.length > 1) {
      return NextResponse.json(
        {
          success: false,
          message: `Column ${columnPosition} row ${targetOrder} already holds ${occupants.length} categories (${occupants.map(o => o.name).join(', ')}). Only one of them is visible on the public page. Move them apart before using this row.`
        },
        { status: 409 }
      );
    }

    /**
     * SWAP, rather than reject, when exactly one category is in the way.
     *
     * The displaced category takes the cell this one is vacating. That destination is free by
     * definition — we are leaving it — so a swap can never fail and never cascades into a
     * third record. It is also what you actually mean when you drag one card onto another.
     *
     * ⚠️ A `$transaction` because there is a moment between the two writes when both rows hold
     * the same (column, order). Nothing enforces uniqueness at the database level, so without
     * the transaction a crash between the two statements would leave exactly the duplicate
     * state described above — permanently, and invisibly.
     */
    const occupant = occupants[0];

    /*
      An INTERACTIVE transaction (a callback) rather than the array form. The array form would
      need the conditional swap spread into it, which makes the index of the result we actually
      want depend on whether a swap happened — and reaching past that costs the `include`'s
      return type. Here both writes are ordinary statements and `updated` keeps its full type,
      so `updated.domains` and `updated._count` below stay checked.

      `tx` is used for both writes, not `prisma` — a statement issued on `prisma` inside the
      callback would run OUTSIDE the transaction and would not roll back with it.
    */
    const updatedCategory = await prisma.$transaction(async (tx) => {
      if (occupant) {
        await tx.domainCategory.update({
          where: { id: occupant.id },
          data: {
            columnPosition: existingCategory.columnPosition,
            categoryOrder: existingCategory.categoryOrder
          }
        });
      }

      return tx.domainCategory.update({
        where: { id },
        data: updateData,
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
        }
      });
    });

    // A rename, icon change or column/order move all alter how the domain index and
    // header dropdown render, since domains are grouped and ordered BY category.
    invalidateCategories();

    return NextResponse.json({
      success: true,
      /*
        The message NAMES the swap when one happened. A swap moves a category the admin did not
        touch, so leaving it out would mean a second category quietly changed position on the
        public page with nothing in the UI acknowledging it.
      */
      message: occupant
        ? `Category updated. "${occupant.name}" moved to column ${existingCategory.columnPosition}, row ${existingCategory.categoryOrder} to make room.`
        : 'Category updated successfully',
      swappedWith: occupant?.name ?? null,
      category: {
        id: updatedCategory.id,
        name: updatedCategory.name,
        slug: updatedCategory.slug,
        icon: updatedCategory.icon,
        description: updatedCategory.description,
        columnPosition: updatedCategory.columnPosition,
        categoryOrder: updatedCategory.categoryOrder,
        isActive: updatedCategory.isActive,
        createdAt: updatedCategory.createdAt,
        domainCount: updatedCategory._count.domains,
        publishedDomains: updatedCategory.domains.filter(d => d.isPublished).length
      }
    });

  } catch (error) {
    console.error('Error updating category:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to update category' 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/categories/[id]
 * Delete a category (with safety checks)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Destructive: removes a category that domains may still reference. Admins only.
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { id } = await params;

    // Check if category exists
    const category = await prisma.domainCategory.findUnique({
      where: { id },
      include: {
        domains: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            domains: true
          }
        }
      }
    });

    if (!category) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Category not found' 
        },
        { status: 404 }
      );
    }

    // Check if category has domains
    if (category._count.domains > 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Cannot delete category. It contains ${category._count.domains} domain(s). Please reassign or remove the domains first.`,
          domains: category.domains
        },
        { status: 409 }
      );
    }

    // Safe to delete - no domains assigned
    await prisma.domainCategory.delete({
      where: { id }
    });

    invalidateCategories();

    return NextResponse.json({
      success: true,
      message: 'Category deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting category:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to delete category' 
      },
      { status: 500 }
    );
  }
}

/**
 * Validate category data for updates
 * Similar to create validation but allows checking against existing category
 */
function validateCategoryData(data: any, excludeId?: string): string | null {
  // Required fields
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    return 'Category name is required';
  }

  if (!data.slug || typeof data.slug !== 'string' || !data.slug.trim()) {
    return 'Category slug is required';
  }

  // Validate slug format
  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(data.slug.trim())) {
    return 'Slug must contain only lowercase letters, numbers, and hyphens';
  }

  // Validate column position
  if (!data.columnPosition || ![1, 2, 3].includes(data.columnPosition)) {
    return 'Column position must be 1, 2, or 3';
  }

  /*
    Row (`categoryOrder`) is optional; see the twin of this check in
    `src/app/api/admin/categories/route.ts` for why it must be a whole number of 1 or more.

    ⚠️ This validator is DUPLICATED between the two route files — it already was before this
    change. Noted rather than fixed here, because deduplicating it is a separate edit that
    touches every field, not just this one.
  */
  if (data.categoryOrder !== undefined) {
    if (!Number.isInteger(data.categoryOrder) || data.categoryOrder < 1) {
      return 'Row must be a whole number of 1 or more';
    }
  }

  // Validate optional fields
  if (data.icon && (typeof data.icon !== 'string' || data.icon.length > 10)) {
    return 'Icon must be a string with maximum 10 characters';
  }

  if (data.description && (typeof data.description !== 'string' || data.description.length > 500)) {
    return 'Description must be a string with maximum 500 characters';
  }

  if (data.isActive !== undefined && typeof data.isActive !== 'boolean') {
    return 'isActive must be a boolean value';
  }

  return null; // No validation errors
}
