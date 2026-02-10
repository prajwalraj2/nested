/**
 * Table Service
 * 
 * All database operations related to tables.
 * Uses React's cache() for request-level deduplication.
 */

import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { filterRowsByCountry, getPublicSchema, getPublicRows } from '@/lib/table-utils';
import type { TableWithPage } from './types';
import type { TableSchema, TableData } from '@/types/table';

export const TableService = {
  /**
   * Get table by page ID (raw, without filtering)
   * 
   * @param pageId - The page ID
   */
  getByPageId: cache(async (pageId: string): Promise<TableWithPage | null> => {
    const table = await prisma.table.findUnique({
      where: { pageId },
      select: {
        id: true,
        name: true,
        pageId: true,
        schema: true,
        data: true,
        settings: true,
        updatedAt: true,
        page: {
          select: {
            id: true,
            title: true,
            slug: true,
            contentType: true,
            domain: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    return table as TableWithPage | null;
  }),

  /**
   * Get table with rows filtered by user's country
   * Also removes targetCountries column from public view
   * 
   * @param pageId - The page ID
   * @param userCountry - The user's country code
   */
  getPublicTable: cache(async (pageId: string, userCountry: string) => {
    const table = await prisma.table.findUnique({
      where: { pageId },
      select: {
        id: true,
        name: true,
        pageId: true,
        schema: true,
        data: true,
        settings: true,
        updatedAt: true,
        page: {
          select: {
            id: true,
            title: true,
            slug: true,
            contentType: true,
            domain: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!table) return null;

    // Get schema and data
    const schema = table.schema as TableSchema;
    const data = table.data as TableData;

    // Filter rows by user's country
    const filteredRows = filterRowsByCountry(data.rows || [], userCountry);

    // Remove targetCountries column from public view
    const publicSchema = getPublicSchema(schema);
    const publicRows = getPublicRows(filteredRows);

    return {
      id: table.id,
      name: table.name,
      schema: publicSchema,
      data: {
        rows: publicRows,
        metadata: {
          ...data.metadata,
          totalRows: publicRows.length,
          unfilteredTotalRows: data.rows?.length || 0,
        },
      },
      settings: table.settings,
      updatedAt: table.updatedAt,
      page: table.page,
      filtering: {
        userCountry,
        originalRowCount: data.rows?.length || 0,
        filteredRowCount: publicRows.length,
      },
    };
  }),

  /**
   * Check if a table exists for a page
   * 
   * @param pageId - The page ID
   */
  exists: cache(async (pageId: string): Promise<boolean> => {
    const table = await prisma.table.findUnique({
      where: { pageId },
      select: { id: true },
    });

    return !!table;
  }),
};

