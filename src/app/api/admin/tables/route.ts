// src/app/api/admin/tables/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { CreateTableRequest, TableListResponse } from '@/types/table';
import { ensureTargetCountriesColumn, ensureRowsHaveTargetCountries } from '@/lib/table-utils';

/**
 * API Routes for Table Management
 * 
 * Handles CRUD operations for data tables:
 * 
 * GET /api/admin/tables - List all tables with filtering and pagination
 * POST /api/admin/tables - Create a new table
 * 
 * Features:
 * - Domain-based filtering
 * - Search functionality
 * - Pagination support
 * - Table creation with validation
 * - Page relationship management
 */

/**
 * GET /api/admin/tables
 * Retrieve all tables with optional filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '25');
    const domain = searchParams.get('domain');
    const search = searchParams.get('search');
    
    // Build where clause for filtering
    const whereClause: any = {};
    
    if (domain && domain !== 'all') {
      whereClause.page = {
        domain: {
          id: domain
        }
      };
    }
    
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { page: { title: { contains: search, mode: 'insensitive' } } },
        { page: { domain: { name: { contains: search, mode: 'insensitive' } } } }
      ];
    }

    // Get total count for pagination
    const totalTables = await prisma.table.count({
      where: whereClause
    });

    // Get tables with pagination
    const tables = await prisma.table.findMany({
      where: whereClause,
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
      },
      orderBy: {
        updatedAt: 'desc'
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const response: TableListResponse = {
      tables: tables as any,
      pagination: {
        page,
        pageSize,
        total: totalTables,
        totalPages: Math.ceil(totalTables / pageSize),
      },
      filters: {
        domain: domain || undefined,
        search: search || undefined,
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching tables:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/tables
 * Create a new table
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CreateTableRequest;
    const { name, pageId, schema, data, settings } = body;

    // Validate required fields
    if (!name || !pageId || !schema) {
      return NextResponse.json(
        { error: 'Missing required fields: name, pageId, schema' },
        { status: 400 }
      );
    }

    // Validate schema structure
    if (!schema.columns || !Array.isArray(schema.columns) || schema.columns.length === 0) {
      return NextResponse.json(
        { error: 'Schema must have at least one column' },
        { status: 400 }
      );
    }

    // Validate page exists and doesn't already have a table
    const existingPage = await prisma.page.findUnique({
      where: { id: pageId },
      include: {
        table: true,
        domain: {
          select: { id: true, name: true, slug: true }
        }
      }
    });

    if (!existingPage) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    if (existingPage.table) {
      return NextResponse.json(
        { error: 'Page already has a table' },
        { status: 400 }
      );
    }

    // Ensure targetCountries column exists in schema
    const schemaWithTargetCountries = ensureTargetCountriesColumn(schema);
    
    // Ensure all rows have targetCountries value (default to ALL)
    const dataWithTargetCountries = data ? {
      ...data,
      rows: ensureRowsHaveTargetCountries(data.rows || []),
    } : { 
      rows: [], 
      metadata: { 
        totalRows: 0, 
        lastUpdated: new Date().toISOString(),
        importSource: 'manual'
      } 
    };

    // Start a transaction to create table and update page
    const result = await prisma.$transaction(async (tx) => {
      // Update page content type to 'table' if it's not already
      if (existingPage.contentType !== 'table') {
        await tx.page.update({
          where: { id: pageId },
          data: { contentType: 'table' }
        });
      }

      // Create the table (serialize objects to ensure Prisma compatibility)
      const newTable = await tx.table.create({
        data: {
          name: name.trim(),
          pageId,
          schema: JSON.parse(JSON.stringify(schemaWithTargetCountries)),
          data: JSON.parse(JSON.stringify(dataWithTargetCountries)),
          settings: JSON.parse(JSON.stringify(settings || {
            pagination: { enabled: true, pageSize: 25, showSizeSelector: true, showInfo: true },
            sorting: { enabled: true, multiSort: false },
            filtering: { enabled: true, globalSearch: true, columnFilters: true, advancedFilters: false },
            responsive: { enabled: true, breakpoint: 'md', stackColumns: false, hideColumns: [] },
            export: { enabled: true, formats: ['csv', 'json'] },
            ui: { density: 'normal', showBorders: true, alternatingRows: true, stickyHeader: true }
          }))
        },
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

      return newTable;
    });

    return NextResponse.json({
      message: 'Table created successfully',
      table: result
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating table:', error);
    
    // Handle specific Prisma errors
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json(
          { error: 'Page already has a table' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}