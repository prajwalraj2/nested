// src/app/api/domain/tables/by-page/[pageId]/route.ts

// ============================================
// OLD IMPORTS (before Services Layer refactor)
// ============================================
// import { prisma } from '@/lib/prisma';
// import { filterRowsByCountry, getPublicSchema, getPublicRows } from '@/lib/table-utils';
// import type { TableData, TableSchema } from '@/types/table';

// ============================================
// NEW IMPORTS (using Services Layer)
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import { getUserCountryFromRequest } from '@/lib/server-country';
import { TableService } from '@/services';

/**
 * API Route for Frontend Table Data Fetching
 * 
 * GET /api/domain/tables/by-page/[pageId] - Get table data for a specific page
 * 
 * Features:
 * - Uses TableService for database operations
 * - Filters rows by user's country (geo-targeting)
 * - Hides targetCountries column from public view
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const awaitedParams = await params;
    const pageId = awaitedParams.pageId;

    if (!pageId) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      );
    }

    // Get user's country from cookie
    const userCountry = getUserCountryFromRequest(request);

    // ============================================
    // NEW: Use TableService (cleaner, reusable)
    // ============================================
    const tableData = await TableService.getPublicTable(pageId, userCountry);

    if (!tableData) {
      return NextResponse.json(
        { error: 'No table found for this page' },
        { status: 404 }
      );
    }

    // Return table data formatted for frontend
    return NextResponse.json({
      table: {
        id: tableData.id,
        name: tableData.name,
        schema: tableData.schema,
        data: tableData.data,
        settings: tableData.settings,
        updatedAt: tableData.updatedAt,
        page: tableData.page
      },
      filtering: tableData.filtering,
    });

    // ============================================
    // OLD: Direct Prisma call (before Services Layer refactor)
    // ============================================
    // const table = await prisma.table.findUnique({
    //   where: { pageId: pageId },
    //   select: {
    //     id: true,
    //     name: true,
    //     schema: true,
    //     data: true,
    //     settings: true,
    //     updatedAt: true,
    //     page: {
    //       select: {
    //         id: true,
    //         title: true,
    //         slug: true,
    //         contentType: true,
    //         domain: {
    //           select: {
    //             id: true,
    //             name: true,
    //             slug: true,
    //           }
    //         }
    //       }
    //     }
    //   }
    // });
    //
    // if (!table) {
    //   return NextResponse.json(
    //     { error: 'No table found for this page' },
    //     { status: 404 }
    //   );
    // }
    //
    // const schema = table.schema as TableSchema;
    // const data = table.data as TableData;
    //
    // // FILTER ROWS BY USER'S COUNTRY
    // const filteredRows = filterRowsByCountry(data.rows || [], userCountry);
    //
    // // Remove targetCountries column from public view
    // const publicSchema = getPublicSchema(schema);
    // const publicRows = getPublicRows(filteredRows);
    //
    // return NextResponse.json({
    //   table: {
    //     id: table.id,
    //     name: table.name,
    //     schema: publicSchema,
    //     data: {
    //       rows: publicRows,
    //       metadata: {
    //         ...data.metadata,
    //         totalRows: publicRows.length,
    //         unfilteredTotalRows: data.rows?.length || 0,
    //       }
    //     },
    //     settings: table.settings,
    //     updatedAt: table.updatedAt,
    //     page: table.page
    //   },
    //   filtering: {
    //     userCountry,
    //     originalRowCount: data.rows?.length || 0,
    //     filteredRowCount: publicRows.length,
    //   }
    // });

  } catch (error) {
    console.error('Error fetching table data for page:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
