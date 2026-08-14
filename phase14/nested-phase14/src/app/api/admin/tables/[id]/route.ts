// src/app/api/admin/tables/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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
      updateData.schema = body.schema;
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
