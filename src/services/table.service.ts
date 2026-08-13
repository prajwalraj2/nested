/**
 * Table Service
 *
 * All database operations related to tables.
 *
 * ============================================================================
 * TWO LAYERS OF CACHING, AND WHY BOTH ARE NEEDED
 * ============================================================================
 * These are different things despite the similar names, and confusing them is how
 * this file ended up with no effective caching at all:
 *
 *   React `cache()`    — dedupes repeat calls WITHIN A SINGLE RENDER. Gone the moment
 *                        the request ends. Useful when a layout and a page both ask for
 *                        the same row while rendering one response.
 *
 *   `unstable_cache()` — stores the result in the Next.js Data Cache ACROSS requests
 *                        and deployments, cleared by `revalidateTag`. This is the one
 *                        that stops Postgres being hit on every visit.
 *
 * Until this change every function here had only the first one. `getPublicTable` is
 * called exactly once per request by `/api/domain/tables/by-page/[pageId]`, so
 * request-level deduplication had nothing to deduplicate — every single view of any of
 * the ~666 `table` pages performed a fresh database round trip.
 */

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { CACHE_DURATIONS, CACHE_TAGS } from '@/lib/cache';
import { filterRowsByCountry, getPublicSchema, getPublicRows } from '@/lib/table-utils';
import type { TableWithPage } from './types';
import type { TableSchema, TableData, TableImageMap } from '@/types/table';

/** The columns every table read needs. Extracted so the two readers cannot drift apart. */
const tableWithPageSelect = {
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
      domain: { select: { id: true, name: true, slug: true } },
    },
  },
} as const;

/**
 * Fetch a table's raw row — CACHED ACROSS REQUESTS.
 *
 * ⚠️ NOTE WHAT IS **NOT** IN THIS CACHE KEY: the country.
 *
 * That is deliberate and it is the safest possible arrangement. What lives in the
 * database is the COMPLETE row set, which is identical for every visitor; only the
 * *filtered view* of it differs by country. So this caches the country-independent
 * thing and `getPublicTable` filters afterwards, in memory.
 *
 * Two benefits over the obvious `unstable_cache(fn, [pageId, country])`:
 *
 *   1. **Country cannot leak.** If country were part of the cached VALUE, a key mistake
 *      would serve an Indian visitor's rows to an American. Here there is no
 *      country-specific value in the cache to hand to the wrong person — the filter
 *      always runs fresh against the caller's own country.
 *   2. One entry per table instead of one per (table × country) — 6x fewer entries for
 *      the same coverage, so the cache warms faster and evicts less.
 *
 * The in-memory filter is cheap: 8,050 rows across 651 tables, so ~12 rows per table.
 *
 * TAGGED WITH BOTH `TABLES` AND `PAGES`, on purpose:
 *   - `PAGES` because that is what the admin table routes already invalidate
 *     (`invalidatePages()` at admin/tables/route.ts:235 and
 *     admin/tables/[id]/route.ts:242). Without this tag, an admin would save a table
 *     edit and not see it until the TTL expired — the exact staleness bug #5 fixed.
 *   - `TABLES` because that is the semantically correct tag, and it had **no subscriber
 *     at all** before this (`CACHE_TAGS.TABLES` was referenced nowhere in the codebase).
 *     `invalidatePages()` now fires it too.
 */
const getTableFromDB = unstable_cache(
  async (pageId: string): Promise<TableWithPage | null> => {
    const table = await prisma.table.findUnique({
      where: { pageId },
      select: tableWithPageSelect,
    });

    return table as TableWithPage | null;
  },
  ['table-by-page'],
  {
    revalidate: CACHE_DURATIONS.MEDIUM,
    tags: [CACHE_TAGS.TABLES, CACHE_TAGS.PAGES],
  }
);

export const TableService = {
  /**
   * Get table by page ID (raw, without filtering)
   * 
   * @param pageId - The page ID
   */
  getByPageId: cache(async (pageId: string): Promise<TableWithPage | null> => {
    return getTableFromDB(pageId);
  }),

  /**
   * Get table with rows filtered by user's country
   * Also removes targetCountries column from public view
   * 
   * @param pageId - The page ID
   * @param userCountry - The user's country code
   */
  getPublicTable: cache(async (pageId: string, userCountry: string) => {
    // Cross-request cached, and country-independent — see getTableFromDB. The
    // country-specific work happens below, on every call, against the caller's own
    // country. That ordering is what makes a shared cache safe here.
    const table = await getTableFromDB(pageId);

    if (!table) return null;

    // Get schema and data
    const schema = table.schema as TableSchema;
    const data = table.data as TableData;

    /**
     * Filter rows by the caller's country. See `filterRowsByCountry` in
     * src/lib/table-utils.ts for the rules; in short, a row is visible when its
     * `targetCountries` is absent, is `ALL`, or names this country (a comma-separated
     * list like `IN,US,GB` counts as naming each of them).
     *
     * ⚠️ This MUST stay outside the cache above. Caching the filtered result under a key
     * that omits the country is precisely how one country's rows get served to another.
     */
    const filteredRows = filterRowsByCountry(data.rows || [], userCountry);

    // Remove targetCountries column from public view
    const publicSchema = getPublicSchema(schema);
    const publicRows = getPublicRows(filteredRows);

    /**
     * Resolve this table's image keys to URLs (K-5c).
     *
     * ⚠️ SERVER-SIDE, AND ONLY THE KEYS THIS TABLE USES. Rows store a `TableImage.key`, never
     * a URL — that indirection is what makes one image serve 40 rows and what makes changing
     * storage provider a one-column rewrite. The browser therefore needs a translation, and
     * doing it here costs one query instead of forty.
     *
     * ⚠️ Deliberately AFTER the country filter. A row hidden from this visitor must not
     * contribute its key, or the response would disclose that content exists for other
     * countries — the same reasoning that keeps `filterRowsByCountry` outside the cache.
     *
     * ⚠️ Not inside `getTableFromDB`'s cache, for the same reason: the cache key omits the
     * country. The extra query only runs for tables that actually declare an image column,
     * which is none until an admin configures one.
     */
    const imageFields = publicSchema.columns
      .map((col) => col.meta?.imageColumn)
      .filter((f): f is string => typeof f === 'string' && f.length > 0);

    let images: TableImageMap = {};
    if (imageFields.length > 0) {
      const keys = new Set<string>();
      for (const row of publicRows) {
        for (const field of imageFields) {
          const value = row[field];
          if (typeof value === 'string' && value.trim() !== '') keys.add(value.trim());
        }
      }
      if (keys.size > 0) {
        const found = await prisma.tableImage.findMany({
          where: { key: { in: [...keys] } },
          select: { key: true, url: true },
        });
        images = Object.fromEntries(found.map((i) => [i.key, i.url]));
        /*
          ⚠️ A key with no matching image is simply absent from the map, and the renderer
          shows nothing rather than a broken-image box. That is the same choice `ItemIcon`
          made in Phase J: on the public site a missing picture must never become visible
          damage. The admin screen is where a dangling reference gets surfaced.
        */
      }
    }

    return {
      images,
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
    // Reuses the cached read rather than its own `findUnique`. Slightly more data over
    // the wire on a cold key, but on a warm key it is zero queries instead of one — and
    // in practice anything asking "does a table exist?" is about to fetch it anyway.
    return (await getTableFromDB(pageId)) !== null;
  }),
};

