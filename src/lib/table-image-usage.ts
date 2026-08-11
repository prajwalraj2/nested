// src/lib/table-image-usage.ts

import { prisma } from '@/lib/prisma';
import type { TableColumn, TableRow, TableSchema } from '@/types/table';

/**
 * Which rows use which image (K-5b).
 * ============================================================================
 *
 * ⚠️ THERE IS NO JOIN TABLE, SO THIS IS A SCAN. Rows live inside `Table.data` as JSON
 * (#29.4), and a row references an image by writing its `key` into an image-bearing column.
 * Nothing in Postgres relates the two, so answering "who uses `pixabay`?" means reading every
 * table and walking its rows.
 *
 * ⚠️ THE FIRST VERSION OF THIS TOOK 7.4 SECONDS, AND THE COMMENT HERE CLAIMED "a few hundred
 * milliseconds". That was a guess, and measuring it disproved it.
 *
 * The scan itself is trivial. The cost was fetching **`data` for all 654 tables** — roughly
 * 2 MB of JSON across the wire from Neon — only to discard almost all of it, because a table
 * with no image-bearing column cannot contribute a usage.
 *
 * Filtering client-side was the obvious next attempt and still cost **1.6 seconds to return
 * nothing** — 654 schemas crossing the wire so JavaScript could reject all of them.
 *
 * ⚠️ So the predicate runs in Postgres: `jsonb_path_exists` names the tables that can
 * reference an image, and only those have their rows fetched. Until K-5c that set is empty
 * and the function is a single cheap query; afterwards it is proportional to tables that
 * actually use images rather than to every table that exists.
 *
 * ⚠️ It still scales with rows in those tables, so it remains one of the things K-8 (rows out
 * of the JSON blob) would make trivial. Recorded rather than optimised further: a join table
 * maintained by hand alongside a JSON blob is two sources of truth, and they would disagree.
 *
 * ── Why this exists at all ─────────────────────────────────────────────────────
 * Without it there is no safe way to delete an image. Deleting one still referenced by 40 rows
 * silently blanks 40 thumbnails, and nothing would report it. §29.7 promised the admin screen
 * would show usage counts and refuse such a delete; this is what makes that possible.
 */

/**
 * Which columns can hold an image key.
 *
 * ⚠️ Read from `col.meta.imageColumn`, not from `col.type === 'image'`. The decision in
 * §29.6(d) was that an image is a **companion to an existing column** — it renders inside the
 * name cell — rather than a column of its own, because a dedicated image column would be
 * near-empty and need hiding on mobile. So the key lives in a sibling field named by the
 * column's metadata, and K-5c is what starts writing it.
 *
 * Until K-5c no column carries this, so every count is legitimately 0. ⚠️ That is worth
 * knowing before reading the admin screen as broken.
 */
export function imageKeyFields(schema: TableSchema | null | undefined): string[] {
  const columns: TableColumn[] = schema?.columns ?? [];
  return columns
    .map((col) => (col.meta as { imageColumn?: string } | undefined)?.imageColumn)
    .filter((field): field is string => typeof field === 'string' && field.length > 0);
}

export type ImageUsage = {
  /** How many rows across all tables reference this key. */
  count: number;
  /** Where, so a refused delete can say exactly what is in the way. */
  places: Array<{ tableName: string; pageTitle: string | null; rowLabel: string }>;
};

/**
 * Usage for every image key, in one pass.
 *
 * ⚠️ Returns a map keyed by image key, NOT a per-image query. The admin grid needs a count
 * for every image at once; asking per image would be N scans of the same 8,120 rows.
 */
export async function getAllImageUsage(): Promise<Map<string, ImageUsage>> {
  /*
    Query 1 — ask POSTGRES which tables can reference an image, rather than shipping 654
    schemas across the Atlantic to answer it in JavaScript.

    ⚠️ Filtering client-side cost 1.6 seconds to return nothing: `schema` is small per table
    but there are 654 of them, and the round trip to Neon is not free. `jsonb_path_exists`
    evaluates the same predicate in the database and returns only matching ids — which today
    is none, so the whole function is one cheap query.

    The path walks the columns array looking for the metadata field K-5c writes. Postgres 12+;
    Neon is well past that.
  */
  const matches = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Table"
    WHERE jsonb_path_exists("schema", '$.columns[*].meta.imageColumn')
  `;

  const usage = new Map<string, ImageUsage>();
  // Nothing can reference an image yet — no second query at all.
  if (matches.length === 0) return usage;

  // Query 2 — the full rows, for those tables only.
  const withImages = await prisma.table.findMany({
    where: { id: { in: matches.map((m) => m.id) } },
    select: {
      id: true,
      name: true,
      schema: true,
      data: true,
      page: { select: { title: true } },
    },
  });

  for (const table of withImages) {
    const schema = table.schema as unknown as TableSchema | null;
    const fields = imageKeyFields(schema);
    if (fields.length === 0) continue;

    const rows = ((table.data as unknown as { rows?: TableRow[] } | null)?.rows ?? []) as TableRow[];

    /*
      A label for the row, so "used by 3 rows" can be expanded into something recognisable.
      The first text column is the identity column in this data — "Channel Name", "Course
      Name", "Product" — the same assumption the 4,521-distinct-things measurement rested on.
    */
    const labelField = schema?.columns.find((c) => c.type === 'text')?.id ?? schema?.columns[0]?.id;

    for (const row of rows) {
      for (const field of fields) {
        const key = row[field];
        if (typeof key !== 'string' || key.trim() === '') continue;

        const entry = usage.get(key) ?? { count: 0, places: [] };
        entry.count += 1;
        // Cap the detail. A key used by 40 rows needs the count, not forty lines — and the
        // admin dialog that shows them has finite room.
        if (entry.places.length < 25) {
          entry.places.push({
            tableName: table.name,
            pageTitle: table.page?.title ?? null,
            rowLabel: labelField ? String(row[labelField] ?? '(untitled row)') : '(untitled row)',
          });
        }
        usage.set(key, entry);
      }
    }
  }

  return usage;
}

/** Usage for one key. Still a full scan — see the note above about why. */
export async function getImageUsage(key: string): Promise<ImageUsage> {
  const all = await getAllImageUsage();
  return all.get(key) ?? { count: 0, places: [] };
}
