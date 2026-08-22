import { isValidIconId } from '@/lib/icon-manifest';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/api-auth';
import { invalidateDomains } from '@/lib/cache-invalidation';
import { SUPPORTED_COUNTRIES, ALL_COUNTRIES } from '@/lib/countries';
import {
  DOMAIN_STATUSES,
  DOMAIN_STATUS_LABELS,
  isDomainStatus,
  resolveStatus,
} from '@/lib/domain-status';

/**
 * Individual Domain API Routes
 * 
 * Handles operations on specific domains:
 * - GET: Fetch single domain details
 * - PUT: Update domain
 * - DELETE: Delete domain (with safety checks)
 * - PATCH: Toggle publication status
 */

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/admin/domains/[id]
 * Fetch details for a specific domain
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Layer 2 of defence in depth — see src/lib/api-auth.ts for the reasoning.
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { id } = await params;

    const domain = await prisma.domain.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
            columnPosition: true
          }
        },
        pages: {
          select: {
            id: true,
            title: true,
            slug: true,
            contentType: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            pages: true
          }
        }
      }
    });

    if (!domain) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Domain not found' 
        },
        { status: 404 }
      );
    }

    // Format response data
    const formattedDomain = {
      id: domain.id,
      name: domain.name,
      slug: domain.slug,
      pageType: domain.pageType,
      status: domain.status,
      icon: domain.icon,
      isPublished: domain.isPublished,
      orderInCategory: domain.orderInCategory,
      targetCountries: domain.targetCountries,
      createdAt: domain.createdAt,
      category: domain.category,
      pages: domain.pages,
      pageCount: domain._count.pages,
      previewUrl: `/domain/${domain.slug}`
    };

    return NextResponse.json({
      success: true,
      domain: formattedDomain
    });

  } catch (error) {
    console.error('Error fetching domain:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch domain' 
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/domains/[id]
 * Update an existing domain
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Reject non-admins before reading the body or touching the database.
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const body = await request.json();

    // Check if domain exists
    const existingDomain = await prisma.domain.findUnique({
      where: { id }
    });

    if (!existingDomain) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Domain not found' 
        },
        { status: 404 }
      );
    }

    // Validate request data
    const validationError = validateDomainData(body, id);
    if (validationError) {
      return NextResponse.json(
        { 
          success: false, 
          message: validationError 
        },
        { status: 400 }
      );
    }

    const { name, slug, pageType, categoryId, orderInCategory, isPublished, targetCountries } = body;

    // Check if slug is taken by another domain
    if (slug !== existingDomain.slug) {
      const slugConflict = await prisma.domain.findFirst({
        where: { 
          slug,
          id: { not: id } // Exclude current domain
        }
      });

      if (slugConflict) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'A domain with this slug already exists' 
          },
          { status: 409 }
        );
      }
    }

    // Verify category exists if changing
    if (categoryId !== existingDomain.categoryId) {
      const category = await prisma.domainCategory.findUnique({
        where: { id: categoryId }
      });

      if (!category) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Selected category does not exist' 
          },
          { status: 400 }
        );
      }
    }

    // Handle page type change from direct to hierarchical or vice versa
    if (pageType !== existingDomain.pageType) {
      if (pageType === 'direct' && existingDomain.pageType === 'hierarchical') {
        // Create __main__ page if switching to direct
        const mainPageExists = await prisma.page.findFirst({
          where: {
            domainId: id,
            slug: '__main__'
          }
        });

        if (!mainPageExists) {
          await prisma.page.create({
            data: {
              title: name.trim(),
              slug: '__main__',
              domainId: id,
              contentType: 'section_based',
              parentId: null
            }
          });
        }
      }
      // Note: When switching from direct to hierarchical, we keep the __main__ page
      // but it won't be used in the hierarchical structure
    }

    // Process targetCountries
    const validTargetCountries = validateAndProcessTargetCountries(
      targetCountries, 
      existingDomain.targetCountries
    );

    // Update the domain
    const updatedDomain = await prisma.domain.update({
      where: { id },
      data: {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        pageType,
        categoryId,
        orderInCategory: parseInt(orderInCategory.toString()),
        /*
          Both columns written, `isPublished` derived — see the twin of this in the POST
          handler. The fallback is the row's EXISTING status, so a PUT that omits the field
          entirely leaves the domain where it was rather than silently resetting it to DRAFT
          and pulling it off the live site.
        */
        status: resolveStatus(body, existingDomain.status),
        isPublished: resolveStatus(body, existingDomain.status) === 'PUBLISHED',
        /*
          ⚠️ `!== undefined`, not `?? existing`. `null` is a MEANINGFUL value here — it means
          "remove the icon and fall back to the emoji" — so it must be distinguishable from the
          field being absent. A `??` would treat a deliberate clear as "unchanged" and the
          Remove button would silently do nothing.
        */
        icon: body.icon !== undefined ? body.icon : existingDomain.icon,
        targetCountries: validTargetCountries
        /*
          ⚠⚠ DO NOT ADD `reviewedAt` TO THIS LIST. ⚠⚠

          This object is a REBUILD, not a patch: every column the domain should keep has to be
          named here, and anything omitted is written as whatever the list says. That is why
          `reviewedAt` is handled by a narrow branch in `PATCH` instead — if it were listed here
          and someone later removed the line, or if it is simply never added, an ordinary name
          edit silently discards the review date.

          Ten separate occurrences of exactly this bug are recorded in NEW-IMPROVEMENTS*.md. The
          field is intentionally absent.
        */
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
            columnPosition: true
          }
        },
        _count: {
          select: {
            pages: true
          }
        }
      }
    });

    // A full PUT can change the slug, which changes the URL, and the pageType,
    // which can create a `__main__` page (see the block above) — so PAGES needs
    // clearing as well, which invalidateDomains() does.
    invalidateDomains();

    return NextResponse.json({
      success: true,
      message: 'Domain updated successfully',
      domain: {
        id: updatedDomain.id,
        name: updatedDomain.name,
        slug: updatedDomain.slug,
        pageType: updatedDomain.pageType,
        status: updatedDomain.status,
        icon: updatedDomain.icon,
        isPublished: updatedDomain.isPublished,
        orderInCategory: updatedDomain.orderInCategory,
        targetCountries: updatedDomain.targetCountries,
        createdAt: updatedDomain.createdAt,
        category: updatedDomain.category,
        pageCount: updatedDomain._count.pages,
        previewUrl: `/domain/${updatedDomain.slug}`
      }
    });

  } catch (error) {
    console.error('Error updating domain:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to update domain' 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/domains/[id]
 * Delete a domain (with safety checks)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // The single most destructive endpoint in the app: the transaction below deletes
    // every ContentBlock, then every Page, then the Domain itself. Guard first.
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { id } = await params;

    // Check if domain exists and get page count
    const domain = await prisma.domain.findUnique({
      where: { id },
      include: {
        pages: {
          select: {
            id: true,
            title: true
          }
        },
        _count: {
          select: {
            pages: true
          }
        }
      }
    });

    if (!domain) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Domain not found' 
        },
        { status: 404 }
      );
    }

    // Use transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // First delete all content blocks associated with pages
      if (domain._count.pages > 0) {
        const pageIds = domain.pages.map(p => p.id);
        
        await tx.contentBlock.deleteMany({
          where: {
            pageId: { in: pageIds }
          }
        });
      }

      // Then delete all pages
      await tx.page.deleteMany({
        where: { domainId: id }
      });

      // Finally delete the domain
      await tx.domain.delete({
        where: { id }
      });
    });

    // The transaction above removed the domain AND every page inside it, so both
    // tags must go. Stale entries here would leave deleted domains rendering in the
    // navigation and 404ing when clicked.
    invalidateDomains();

    return NextResponse.json({
      success: true,
      message: 'Domain deleted successfully',
      deletedPages: domain._count.pages
    });

  } catch (error) {
    console.error('Error deleting domain:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to delete domain' 
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/domains/[id]
 * Toggle publication status or update specific fields
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // This handler can publish/unpublish a domain and rewrite its targetCountries —
    // i.e. change what the public sees. Admins only.
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const body = await request.json();

    // Check if domain exists
    const existingDomain = await prisma.domain.findUnique({
      where: { id }
    });

    if (!existingDomain) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Domain not found' 
        },
        { status: 404 }
      );
    }

    /**
     * Mark this domain reviewed, or clear the mark (N-5).
     *
     * ⚠️ A NARROW BRANCH THAT WRITES EXACTLY ONE COLUMN — deliberately in PATCH and deliberately
     * NOT in the PUT above. That PUT rebuilds its `data` from an explicit field list, and a field
     * missing from such a list is silently dropped: adding `reviewedAt` there would mean editing a
     * domain's NAME wiped its review date, with no error anywhere. That bug class has appeared ten
     * times in this project; this is the shape that avoids it.
     *
     * ⚠️ THE SERVER STAMPS THE TIME, THE CLIENT DOES NOT SEND IT. A client-supplied date is a
     * client-supplied claim — and the whole point of this field is that it records something real.
     * `{ reviewed: true }` means now; `{ reviewed: false }` clears it.
     *
     * ⚠️ REVIEWING IS NOT EDITING. Nothing else on the row changes, and `updatedAt` moving is an
     * unavoidable side effect of any write — which is exactly why the two fields are separate.
     */
    if ('reviewed' in body) {
      if (typeof body.reviewed !== 'boolean') {
        return NextResponse.json(
          { success: false, message: '`reviewed` must be true or false.' },
          { status: 400 }
        );
      }

      const updatedDomain = await prisma.domain.update({
        where: { id },
        data: { reviewedAt: body.reviewed ? new Date() : null },
        include: {
          category: {
            select: { id: true, name: true, slug: true, icon: true, columnPosition: true }
          }
        }
      });

      /*
        ⚠️ THE BADGE IS PUBLIC, so this is not an admin-only change. Without invalidation the
        badge would appear up to the cache duration later, which reads as the button not working.
      */
      invalidateDomains();

      return NextResponse.json({ success: true, domain: updatedDomain });
    }

    /**
     * Quick status change from the domains table.
     *
     * ⚠️ THIS WAS A BOOLEAN TOGGLE, AND A TOGGLE HAS NO MEANING WITH THREE STATES.
     *
     * `DomainsTable` used to send `{ isPublished: !domain.isPublished }` — flip whatever it is
     * now. There is no way to express "make this UPCOMING" by flipping a boolean, and with
     * three states "the opposite of published" is ambiguous. It is now a status *set*: the
     * caller names the state it wants, and the row action is a small menu rather than a toggle.
     *
     * The old shape still works. A body carrying only `isPublished` resolves through the same
     * helper, so an un-updated client keeps publishing and unpublishing exactly as before.
     */
    if ('status' in body || 'isPublished' in body) {
      if ('status' in body && !isDomainStatus(body.status)) {
        return NextResponse.json(
          {
            success: false,
            message: `Status must be one of ${DOMAIN_STATUSES.join(', ')}`
          },
          { status: 400 }
        );
      }

      const nextStatus = resolveStatus(body, existingDomain.status);

      const updatedDomain = await prisma.domain.update({
        where: { id },
        data: { status: nextStatus, isPublished: nextStatus === 'PUBLISHED' },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              icon: true,
              columnPosition: true
            }
          }
        }
      });

      // Publishing is the single most visible admin action — the domain appears on
      // or disappears from the public index. Without this it took up to 60s.
      invalidateDomains();

      return NextResponse.json({
        success: true,
        // Names the state it ended in. The old message said "published"/"unpublished", which
        // cannot describe a move to UPCOMING.
        message: `Domain set to ${DOMAIN_STATUS_LABELS[nextStatus]}`,
        domain: {
          id: updatedDomain.id,
          name: updatedDomain.name,
          slug: updatedDomain.slug,
          pageType: updatedDomain.pageType,
          status: updatedDomain.status,
          icon: updatedDomain.icon,
          isPublished: updatedDomain.isPublished,
          orderInCategory: updatedDomain.orderInCategory,
          category: updatedDomain.category
        }
      });
    }

    // Handle order change
    if ('orderInCategory' in body) {
      const updatedDomain = await prisma.domain.update({
        where: { id },
        data: { orderInCategory: parseInt(body.orderInCategory) }
      });

      // Order drives the rendering position on the domain index.
      invalidateDomains();

      return NextResponse.json({
        success: true,
        message: 'Domain order updated successfully',
        domain: {
          id: updatedDomain.id,
          orderInCategory: updatedDomain.orderInCategory
        }
      });
    }

    // Handle targetCountries change
    if ('targetCountries' in body) {
      const validTargetCountries = validateAndProcessTargetCountries(
        body.targetCountries, 
        existingDomain.targetCountries
      );

      const updatedDomain = await prisma.domain.update({
        where: { id },
        data: { targetCountries: validTargetCountries }
      });

      // Geo targeting decides who can see the domain at all — and it feeds the
      // sitemap and the `noindex` guard in generateMetadata.
      invalidateDomains();

      return NextResponse.json({
        success: true,
        message: 'Domain target countries updated successfully',
        domain: {
          id: updatedDomain.id,
          targetCountries: updatedDomain.targetCountries
        }
      });
    }

    return NextResponse.json(
      { 
        success: false, 
        message: 'No valid fields provided for update' 
      },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error updating domain:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to update domain' 
      },
      { status: 500 }
    );
  }
}

/**
 * Validate domain data for updates
 * Similar to create validation but allows checking against existing domain
 */
function validateDomainData(data: any, excludeId?: string): string | null {
  /*
    Icon. Optional, and `null` is a legitimate value meaning "fall back to the emoji in the
    name/title".

    ⚠️ VALIDATED AGAINST THE GENERATED MANIFEST, not merely type-checked. This value ends up in
    an `src` attribute, so an unrecognised id renders a broken image with no error anywhere —
    the same silent-failure shape as an unvalidated status enum. `isValidIconId` checks it
    against the SVGs that actually exist in public/icons/.
  */
  if (data.icon !== undefined && data.icon !== null && !isValidIconId(data.icon)) {
    return `Unknown icon "${data.icon}". Add the SVG to public/icons/ first.`;
  }

  // Required fields
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    return 'Domain name is required';
  }

  if (!data.slug || typeof data.slug !== 'string' || !data.slug.trim()) {
    return 'Domain slug is required';
  }

  if (!data.categoryId || typeof data.categoryId !== 'string') {
    return 'Category selection is required';
  }

  // Validate page type
  if (!data.pageType || !['direct', 'hierarchical'].includes(data.pageType)) {
    return 'Page type must be either "direct" or "hierarchical"';
  }

  // Validate slug format
  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(data.slug.trim())) {
    return 'Slug must contain only lowercase letters, numbers, and hyphens';
  }

  // Validate order if provided
  if (data.orderInCategory !== undefined && data.orderInCategory !== null) {
    const order = parseInt(data.orderInCategory);
    if (isNaN(order) || order < 0) {
      return 'Order in category must be a non-negative number';
    }
  }

  // Validate publication status
  // See the twin of this check in `api/admin/domains/route.ts`: an unrecognised status must
  // become a 400 here rather than an opaque Prisma error at query time.
  if (data.status !== undefined && !isDomainStatus(data.status)) {
    return `Status must be one of ${DOMAIN_STATUSES.join(', ')}`;
  }

  if (data.isPublished !== undefined && typeof data.isPublished !== 'boolean') {
    return 'Publication status must be a boolean value';
  }

  // Validate targetCountries if provided
  if (data.targetCountries !== undefined) {
    const tcError = validateTargetCountriesFormat(data.targetCountries);
    if (tcError) return tcError;
  }

  return null; // No validation errors
}

/**
 * Validate targetCountries format
 */
function validateTargetCountriesFormat(targetCountries: any): string | null {
  if (!Array.isArray(targetCountries)) {
    return 'Target countries must be an array';
  }

  if (targetCountries.length === 0) {
    return 'Target countries cannot be empty';
  }

  const validCountries = [ALL_COUNTRIES, ...SUPPORTED_COUNTRIES];
  
  for (const country of targetCountries) {
    if (typeof country !== 'string') {
      return 'Each target country must be a string';
    }
    if (!validCountries.includes(country)) {
      return `Invalid country code: ${country}. Valid codes are: ${validCountries.join(', ')}`;
    }
  }

  return null;
}

/**
 * Validate and process targetCountries - returns valid array or existing value
 */
function validateAndProcessTargetCountries(targetCountries: any, existingValue: string[]): string[] {
  // If not provided, keep existing value
  if (targetCountries === undefined) {
    return existingValue;
  }

  // Default to ["ALL"] if null or empty array
  if (!targetCountries || !Array.isArray(targetCountries) || targetCountries.length === 0) {
    return [ALL_COUNTRIES];
  }

  const validCountries = [ALL_COUNTRIES, ...SUPPORTED_COUNTRIES];
  
  // Filter to only valid country codes
  const validatedCountries = targetCountries.filter(
    (c: any) => typeof c === 'string' && validCountries.includes(c)
  );

  // Return existing if no valid countries after filtering
  return validatedCountries.length > 0 ? validatedCountries : existingValue;
}
