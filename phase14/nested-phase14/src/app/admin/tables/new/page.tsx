// src/app/admin/tables/new/page.tsx

import { prisma } from '@/lib/prisma';
import { TableCreationWizard } from '@/components/admin/tables/TableCreationWizard';

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
    // Get all domains with their pages
    const domains = await prisma.domain.findMany({
      include: {
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
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          ➕ Create New Table
        </h1>
        <p className="text-gray-600 mt-2">
          Follow the steps below to create a powerful, interactive data table for your domain.
        </p>
      </div>

      {/* Creation Wizard */}
      <TableCreationWizard domains={domains} />

    </div>
  );
}
