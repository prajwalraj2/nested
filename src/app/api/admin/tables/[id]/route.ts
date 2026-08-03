// src/app/api/admin/tables/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/api-auth';
// Needed because deleting a table can reset Page.contentType — see the call site.
import { invalidatePages } from '@/lib/cache-invalidation';
// Same helper POST has always used — see the note in the PUT handler for why PUT needs it too.
import { ensureTargetCountriesColumn } from '@/lib/table-utils';
import type { UpdateTableRequest } from '@/types/table';

/**
 * API Routes for Individual Table Management
 * 
 * Handles operations on specific tables:
 * 
 * GET /api/admin/tables/[id] - Get table details
 * PUT /api/admin/tables/[id] - Update table configuration
 * DELETE /api/admin/tables/[id] - Delete table
 * 
 * Features:
 * - Complete table data retrieval
 * - Schema and settings updates
 * - Safe table deletion with cleanup
 * - Data validation and error handling
 */

/**
 * GET /api/admin/tables/[id]
 * Retrieve a specific table with all its data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Layer 2 of defence in depth — see src/lib/api-auth.ts.
    // Returns the raw table including the hidden targetCountries column.
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const awaitedParams = await params;
    const tableId = awaitedParams.id;

    if (!tableId) {
      return NextResponse.json(
        { error: 'Table ID is required' },
        { status: 400 }
      );
    }

    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: {
        page: {
          include: {
            domain: {
              select: {
                id: true,
                name: true,
                slug: true,
              }
            }
          }
        }
      }
    });

    if (!table) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ table });

  } catch (error) {
    console.error('Error fetching table:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/tables/[id]
 * Update table configuration (schema, data, settings)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rewrites a table's schema/data/settings. Guard before reading the body.
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const awaitedParams = await params;
    const tableId = awaitedParams.id;
    const body = await request.json() as Partial<UpdateTableRequest>;

    if (!tableId) {
      return NextResponse.json(
        { error: 'Table ID is required' },
        { status: 400 }
      );
    }

    // Verify table exists
    const existingTable = await prisma.table.findUnique({
      where: { id: tableId },
      include: { page: true }
    });

    if (!existingTable) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};

    if (body.name !== undefined) {
      updateData.name = body.name.trim();
    }

    if (body.schema !== undefined) {
      // Validate schema structure
      if (!body.schema.columns || !Array.isArray(body.schema.columns) || body.schema.columns.length === 0) {
        return NextResponse.json(
          { error: 'Schema must have at least one column' },
          { status: 400 }
        );
      }
      /**
       * ⚠️ RE-ADD THE SYSTEM `targetCountries` COLUMN IF THE INCOMING SCHEMA LOST IT.
       * ======================================================================
       * `POST /api/admin/tables` has always done this; `PUT` did not. That asymmetry did
       * not matter while the schema editor was reachable only from the creation wizard, but
       * G-5b wired it into the table editor — so an admin can now save a schema with the
       * column removed, and nothing put it back.
       *
       * The consequence is a trap rather than an outage: geo-filtering keeps working, because
       * `isRowVisibleToCountry` reads `row.targetCountries` and the row data survives. But the
       * column vanishes from the admin UI, so a row that is hidden from most of the world
       * becomes **impossible to un-hide** — invisible state with no control to change it, and
       * nothing on screen explaining why the row never appears publicly.
       *
       * Re-adding here means saving the schema of an affected table heals it automatically.
       *
       * ⚠️ This is safe for the public site: `getPublicSchema()` / `getPublicRows()` strip the
       * column and the row key by id before anything is served (table-utils.ts:599/612).
       */
      updateData.schema = ensureTargetCountriesColumn(body.schema);
    }

    if (body.data !== undefined) {
      updateData.data = body.data;
    }

    if (body.settings !== undefined) {
      updateData.settings = body.settings;
    }

    // Update the table
    const updatedTable = await prisma.table.update({
      where: { id: tableId },
      data: updateData,
      include: {
        page: {
          include: {
            domain: {
              select: {
                id: true,
                name: true,
                slug: true,
              }
            }
          }
        }
      }
    });

    // Required since `table-by-page` began caching tables across requests: this handler
    // changes the name, schema and settings, all of which are inside the cached value.
    // Only the DELETE below used to invalidate, because it also touched `contentType`.
    invalidatePages();

    return NextResponse.json({
      message: 'Table updated successfully',
      table: updatedTable
    });

  } catch (error) {
    console.error('Error updating table:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/tables/[id]
 * Delete a table and optionally reset page content type
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Destructive: deletes the table and can reset the page's contentType.
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const awaitedParams = await params;
    const tableId = awaitedParams.id;
    const { searchParams } = new URL(request.url);
    const resetPageType = searchParams.get('resetPageType') === 'true';

    if (!tableId) {
      return NextResponse.json(
        { error: 'Table ID is required' },
        { status: 400 }
      );
    }

    // Verify table exists
    const existingTable = await prisma.table.findUnique({
      where: { id: tableId },
      include: { page: true }
    });

    if (!existingTable) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      );
    }

    // Delete table and optionally update page
    await prisma.$transaction(async (tx) => {
      // Delete the table
      await tx.table.delete({
        where: { id: tableId }
      });

      // Optionally reset page content type
      if (resetPageType) {
        await tx.page.update({
          where: { id: existingTable.pageId },
          data: { contentType: 'narrative' }
        });
      }
    });

    // ⚠️ Needed even though Table itself is never held in unstable_cache: the
    // transaction above can reset `Page.contentType` to 'narrative' when
    // `resetPageType` is set, and contentType decides WHICH layout component renders
    // the page (TableLayout vs NarrativeLayout). It is part of
    // `pageWithContentSelect`, so it sits inside the cached page-main / page-by-id /
    // domain-with-pages entries. Without this the page keeps rendering as a table for
    // up to 60s after its table was deleted.
    invalidatePages();

    return NextResponse.json({
      message: 'Table deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting table:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
