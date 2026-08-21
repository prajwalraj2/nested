// src/app/admin/tables/[id]/page.tsx

import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { TableEditor } from '@/components/admin/tables/TableEditor';
import { Columns3, ExternalLink, RefreshCw, Rows3, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminPageHeader } from '@/components/admin/layout/AdminPageHeader';
import { StatsCard } from '@/components/admin/dashboard/StatsCard';
// Finding #22.4 — a page's public URL needs its parent chain walked, not two slugs joined.
import { buildPageUrl, toPageMap } from '@/lib/page-path';
import { resolveTableImages } from '@/lib/table-image-usage';

/**
 * Admin Table Edit Page
 * 
 * Provides comprehensive table management interface:
 * - View table details and statistics
 * - Edit table schema (columns, types, settings)
 * - Manage table data (add, edit, delete rows)
 * - Upload/import CSV data
 * - Export table data
 * - Configure table settings
 * 
 * URL: /admin/tables/[id]
 */

type PageProps = {
  params: Promise<{ id: string }>;
};

async function getTableData(tableId: string) {
  try {
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
      return null;
    }

    /**
     * Resolve the page's REAL public URL by walking its parent chain (finding #22.4).
     *
     * The "view on site" link below used to be built as
     * `/domain/${table.page.domain.slug}/${table.page.slug}` — correct only for a page one
     * level below the domain root. Measured: **110 of 668 table pages (16.5%)** produced a
     * URL that 404s, e.g.
     *
     *     emitted : /domain/webdev/ytube
     *     correct : /domain/webdev/withcode/ytube
     *
     * One extra query, scoped to this page's own domain and selecting only the three
     * columns `PagePathNode` needs — deliberately not `include`, so this cannot become
     * another #22.1-style over-fetch.
     */
    const chainPages = await prisma.page.findMany({
      where: { domainId: table.page.domain.id },
      select: { id: true, slug: true, parentId: true },
    });

    const publicUrl = buildPageUrl(
      table.page,
      table.page.domain.slug,
      toPageMap(chainPages)
    );

    return { ...table, publicUrl };
  } catch (error) {
    console.error('Error fetching table data:', error);
    return null;
  }
}

export default async function TableEditPage({ params }: PageProps) {
  const awaitedParams = await params;
  const tableId = awaitedParams.id;

  const table = await getTableData(tableId);

  if (!table) {
    notFound();
  }

  /*
    ⚠️ `(table.data as ...).rows` RATHER THAN A TYPED READ, because `Table.data` is a Prisma `Json`
    column validated by nobody. The cast is narrow and local; `resolveTableImages` tolerates junk
    (a non-string field is skipped) rather than trusting the shape.

    ⚠️ ALL rows, not a filtered set — this is the admin, which must see every row including ones
    hidden from every visitor by `targetCountries`. The public service passes its FILTERED rows for
    the opposite reason; see the note on `resolveTableImages`.
  */
  const images = await resolveTableImages(
    ((table.data as { rows?: unknown[] } | null)?.rows ?? []) as never,
    table.schema as never
  );

  return (
    <div className="space-y-6">
      
      {/*
        ⚠️ REBUILT IN G-5b — this shell was never touched by an earlier phase, so it still
        painted `bg-white` cards and `text-gray-900` headings straight onto the dark theme
        from #21. It is the reason this screen looked wrong in dark mode.

        `AdminPageHeader` (G-2) replaces a hand-rolled `text-3xl` title, a `border-b` rule
        and a bespoke link-styled-as-a-button. The emoji breadcrumb below it is gone too:
        the shell already renders a real breadcrumb from `admin-nav.ts` (G-1), so this was a
        second, hand-maintained one directly beneath it.
      */}
      <AdminPageHeader
        title={table.name}
        description={`Schema, data and settings for the "${table.page.title}" page.`}
        actions={
          /*
            The public URL is resolved on the server by walking the parent chain. When a page
            has no reachable public URL the button is DISABLED rather than linking somewhere
            broken — which the old two-slug version did for 110 of 668 tables.

            `asChild` keeps it a real anchor so middle-click and "open in new tab" work;
            the disabled case is a `Button` with no href, since a disabled anchor is not a
            thing HTML supports.
          */
          table.publicUrl ? (
            <Button variant="outline" size="sm" asChild>
              <a href={table.publicUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" aria-hidden="true" />
                View live table
              </a>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled title="This page has no reachable public URL">
              <ExternalLink className="size-4" aria-hidden="true" />
              View live table
            </Button>
          )
        }
      />

      {/*
        Stats now use the shared `StatsCard` from G-2 rather than a local copy that drew its
        own `bg-white` panel and took an emoji string as its icon. Same four numbers, one
        component, and it themes.
      */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Rows"
          value={(table.data as any)?.rows?.length || 0}
          icon={Rows3}
          description="Data rows in this table"
        />
        <StatsCard
          title="Columns"
          value={(table.schema as any)?.columns?.length || 0}
          icon={Columns3}
          description="Columns defined"
        />
        <StatsCard
          title="Last updated"
          value={table.updatedAt.toLocaleDateString()}
          icon={RefreshCw}
          description="Last modification"
        />
        <StatsCard
          title="Schema version"
          value={(table.schema as any)?.version || 1}
          icon={Tag}
          description="Bumped on structure changes"
        />
      </div>

      {/*
        Main Table Editor.

        ⚠️ `images` IS RESOLVED HERE, ON THE SERVER, AND NOT FETCHED BY THE EDITOR (N-1).

        Rows store a `TableImage.key`, never a URL, so the row list had no way to draw a thumbnail
        — you could only tell whether a row had a picture by opening its dialog. `RowImagePicker`
        does fetch the whole image library, but that endpoint also computes usage across every
        table (`getAllImageUsage` scans 8,133 rows), which is a heavy call to make for four URLs.

        This page is already a server component doing its own Prisma read, so resolving here costs
        one extra query and no new endpoint. `resolveTableImages` is the SAME function the public
        service uses, so the two screens cannot disagree about which image belongs to which row.
      */}
      <TableEditor table={table} images={images} />

    </div>
  );
}

