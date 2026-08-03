// src/app/admin/tables/new/page.tsx

import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { AdminPageHeader } from '@/components/admin/layout/AdminPageHeader';
import { TableCreationWizard } from '@/components/admin/tables/TableCreationWizard';

/**
 * ⚠️ DO NOT REMOVE — finding #20, and this is the clearest reproduction of it.
 *
 * Step 1 of the wizard is a domain picker fed by `prisma.domain.findMany` during render.
 * With no dynamic API on the page, Next 15 prerendered it at BUILD time — so creating a new
 * domain and then opening this wizard showed a dropdown that simply did not contain it.
 * No error, no empty state, no clue: the domain was just absent.
 *
 * `revalidateTag` cannot help — this reads Prisma directly, so nothing is tagged. See the
 * full explanation in src/app/admin/page.tsx.
 */
export const dynamic = 'force-dynamic';

/**
 * Table Creation Wizard Page
 * 
 * Multi-step interface for creating new data tables:
 * 
 * Step 1: Select Domain and Page
 *   - Choose domain from dropdown
 *   - Select page with contentType "table" or create new page
 * 
 * Step 2: Define Table Schema
 *   - Add columns with types and properties
 *   - Configure validation rules
 *   - Set column display options
 * 
 * Step 3: Upload Data (Optional)
 *   - Upload CSV file
 *   - Map CSV columns to table columns
 *   - Validate data against schema
 * 
 * Step 4: Preview and Save
 *   - Review table configuration
 *   - Preview data (if uploaded)
 *   - Save table to database
 */

// Fetch available domains and pages for table creation
async function getTableCreationData() {
  try {
    /**
     * ⚠️ `select`, NOT `include` (the #22.1 discipline).
     *
     * This used `include: { pages: … }`, and `include` returns **every column of every
     * domain** alongside the nested pages — name, slug, pageType, isPublished,
     * targetCountries, orderInCategory, timestamps — when the picker displays only the name
     * and needs only the id. Naming the four fields keeps the rest off the wire.
     */
    const domains = await prisma.domain.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        pages: {
          where: {
            contentType: {
              in: ['table', 'narrative'] // Allow table pages and convert narrative to table
            }
          },
          select: {
            id: true,
            title: true,
            slug: true,
            contentType: true,
            table: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: { title: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Filter out domains that have no suitable pages
    const availableDomains = domains.filter(domain => domain.pages.length > 0);

    return {
      domains: availableDomains
    };
  } catch (error) {
    console.error('Error fetching table creation data:', error);
    return {
      domains: []
    };
  }
}

export default async function NewTablePage() {
  const { domains } = await getTableCreationData();

  return (
    <>
      {/*
        ⚠️ REBUILT IN G-5d. Was a hand-rolled `text-3xl text-gray-900` title with a
        `border-b border-gray-200` rule and an emoji — light-only, like every other page shell
        in this screen before its rebuild.

        `AdminPageHeader` also gives this page a **Cancel** route. Previously the only way out
        of the wizard was the browser back button: nothing on screen led back to the list.
      */}
      <AdminPageHeader
        title="New table"
        description={
          domains.length > 0
            ? `Create a data table on one of ${domains.length} eligible pages.`
            : 'No eligible pages yet — a table needs a page of type "table" or "narrative".'
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/tables">Cancel</Link>
          </Button>
        }
      />

      <TableCreationWizard domains={domains} />
    </>
  );
}
