// src/app/api/admin/tables/[id]/data/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/api-auth';
import { invalidatePages } from '@/lib/cache-invalidation';
import { exportTableToCsv, exportTableToJson, ensureRowsHaveTargetCountries } from '@/lib/table-utils';
import type { TableData } from '@/types/table';

/**
 * API Routes for Table Data Management
 * 
 * Handles data-specific operations:
 * 
 * GET /api/admin/tables/[id]/data - Get table data with optional export
 * PUT /api/admin/tables/[id]/data - Update table data (bulk operations)
 * DELETE /api/admin/tables/[id]/data - Clear all table data
 * 
 * Features:
 * - Data export in multiple formats (CSV, JSON)
 * - Bulk data updates and imports
 * - Data validation and sanitization
 * - Row-level operations
 */

/**
 * GET /api/admin/tables/[id]/data
 * Retrieve table data with optional export functionality
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Layer 2 of defence in depth — see src/lib/api-auth.ts.
    // This can export an ENTIRE table as CSV/JSON, unfiltered and including the
    // hidden targetCountries column. It was a full data-dump endpoint for anyone.
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const awaitedParams = await params;
    const tableId = awaitedParams.id;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format'); // 'csv' | 'json' | null
    const download = searchParams.get('download') === 'true';

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
          select: {
            title: true,
            slug: true,
            domain: {
              select: { name: true, slug: true }
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

    // Handle export requests
    if (format) {
      const schema = table.schema as any;
      const data = table.data as TableData;
      
      let exportData: string;
      let contentType: string;
      let filename: string;

      switch (format) {
        case 'csv':
          exportData = exportTableToCsv(data, schema);
          contentType = 'text/csv';
          filename = `${table.page.slug}-table.csv`;
          break;
        case 'json':
          exportData = exportTableToJson(data, schema);
          contentType = 'application/json';
          filename = `${table.page.slug}-table.json`;
          break;
        default:
          return NextResponse.json(
            { error: 'Unsupported export format' },
            { status: 400 }
          );
      }

      const response = new NextResponse(exportData);
      response.headers.set('Content-Type', contentType);
      
      if (download) {
        response.headers.set('Content-Disposition', `attachment; filename="${filename}"`);
      }

      return response;
    }

    // Return table data as JSON
    return NextResponse.json({
      table: {
        id: table.id,
        name: table.name,
        schema: table.schema,
        data: table.data,
        settings: table.settings,
        page: table.page,
        updatedAt: table.updatedAt
      }
    });

  } catch (error) {
    console.error('Error fetching table data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/tables/[id]/data
 * Update table data (bulk operations)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // operation: 'replace' overwrites EVERY row in the table. Guard first.
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const awaitedParams = await params;
    const tableId = awaitedParams.id;
    const body = await request.json();
    const { data, operation = 'replace' } = body;

    if (!tableId) {
      return NextResponse.json(
        { error: 'Table ID is required' },
        { status: 400 }
      );
    }

    if (!data || !data.rows || !Array.isArray(data.rows)) {
      return NextResponse.json(
        { error: 'Invalid data format' },
        { status: 400 }
      );
    }

    // Verify table exists
    const existingTable = await prisma.table.findUnique({
      where: { id: tableId }
    });

    if (!existingTable) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      );
    }

    let newData: TableData;
    const currentData = existingTable.data as TableData;

    // Ensure all rows have targetCountries value
    const rowsWithTargetCountries = ensureRowsHaveTargetCountries(data.rows);

    switch (operation) {
      case 'replace':
        // Replace all data
        newData = {
          rows: rowsWithTargetCountries,
          metadata: {
            totalRows: rowsWithTargetCountries.length,
            lastUpdated: new Date().toISOString(),
            importSource: data.metadata?.importSource || 'api'
          }
        };
        break;

      case 'append':
        // Append new rows to existing data
        const existingRows = currentData.rows || [];
        newData = {
          rows: [...existingRows, ...rowsWithTargetCountries],
          metadata: {
            totalRows: existingRows.length + rowsWithTargetCountries.length,
            lastUpdated: new Date().toISOString(),
            importSource: 'api'
          }
        };
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid operation. Use "replace" or "append"' },
          { status: 400 }
        );
    }

    // Update the table (serialize to ensure Prisma compatibility)
    const updatedTable = await prisma.table.update({
      where: { id: tableId },
      data: { data: JSON.parse(JSON.stringify(newData)) },
      include: {
        page: {
          include: {
            domain: {
              select: { id: true, name: true, slug: true }
            }
          }
        }
      }
    });

    /**
     * ⚠️ REQUIRED SINCE TABLE DATA BECAME CACHED.
     *
     * This handler is the one that saves actual ROWS, so it is the most-used table
     * write there is. It previously needed no invalidation because table content was
     * only ever behind React `cache()` — request-scoped, so every load was fresh.
     *
     * `table-by-page` in src/services/table.service.ts now caches the table across
     * requests (tagged TABLES and PAGES). Without this call an admin would save rows
     * and keep seeing the old ones for up to 60 seconds, which reads as "my edit
     * didn't save".
     */
    invalidatePages();

    return NextResponse.json({
      message: `Table data ${operation}d successfully`,
      table: updatedTable,
      summary: {
        operation,
        rowsProcessed: data.rows.length,
        totalRows: newData.metadata?.totalRows || 0
      }
    });

  } catch (error) {
    console.error('Error updating table data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/tables/[id]/data
 * Clear all table data
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Clears every row in the table. Guard first.
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

    // Verify table exists
    const existingTable = await prisma.table.findUnique({
      where: { id: tableId }
    });

    if (!existingTable) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      );
    }

    // Clear table data
    const emptyData: TableData = {
      rows: [],
      metadata: {
        totalRows: 0,
        lastUpdated: new Date().toISOString(),
        importSource: 'manual'
      }
    };

    const updatedTable = await prisma.table.update({
      where: { id: tableId },
      data: { data: JSON.parse(JSON.stringify(emptyData)) }
    });

    // Same reason as the PUT above: rows are now cached across requests, so clearing
    // them has to clear the cache or the page keeps showing rows that no longer exist.
    invalidatePages();

    return NextResponse.json({
      message: 'Table data cleared successfully',
      table: updatedTable
    });

  } catch (error) {
    console.error('Error clearing table data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}