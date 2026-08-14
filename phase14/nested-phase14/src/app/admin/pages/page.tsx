import { prisma } from '@/lib/prisma';
import { PagesManager } from '@/components/admin/pages/PagesManager';
import { Roboto } from 'next/font/google';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});

/**
 * Admin Pages Management Page
 * 
 * Comprehensive page management system with correct parent logic:
 * 
 * DIRECT DOMAINS:
 * - Auto-create __main__ page when domain is created
 * - All first-level pages use __main__ as parent
 * - URLs: /domain/gdesign/ytube (ytube → __main__ → domain)
 * 
 * HIERARCHICAL DOMAINS: 
 * - NO __main__ page created
 * - First-level pages use domain as parent
 * - URLs: /domain/webdev/with-code (with-code → domain)
 * 
 * UI Features:
 * - Domain selection first
 * - Tree view with expand/collapse
 * - Page details: Title, Slug, Link, Parent
 * - Actions: + (add child), 🔗 (link), ✏️ (edit), 🗑️ (delete)
 */

type SearchParams = {
  domain?: string;    // Selected domain ID for filtering
  expand?: string;    // Comma-separated list of expanded page IDs
};

type PagesPageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function PagesManagePage({ searchParams }: PagesPageProps) {
  // Await searchParams for Next.js 15 compatibility
  const awaitedSearchParams = await searchParams;
  
  // Fetch domains for selection
  const domains = await fetchDomainsForPageManagement();
  
  return (
    <div className="space-y-8">
      
      {/* Page Header */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          📄 Page Management System
        </h2>
        <p className="text-gray-600">
          Create and organize your content pages with proper hierarchical structures. 
          Support both direct and hierarchical domain types.
        </p>
      </div>

      {/* Main Pages Manager Component */}
      <div className="bg-white rounded-lg border border-gray-200">
        <PagesManager 
          domains={domains}
          selectedDomainId={awaitedSearchParams.domain}
          expandedPageIds={awaitedSearchParams.expand?.split(',') || []}
        />
      </div>

      {/* Domain Type Explanation */}
      <div className="bg-cyan-50 rounded-lg p-6 border border-cyan-100">
        <h4 className="font-semibold text-cyan-900 mb-3">
          🔍 Understanding Domain Types
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-black">
          
          {/* Direct Domain */}
          <div className="bg-white rounded-lg p-4 border border-cyan-200">
            <h5 className="font-semibold mb-3 text-blue-900">🎯 Direct Domains</h5>
            <div className="space-y-2">
              <div><strong>Auto-creates:</strong> Hidden __main__ page</div>
              <div><strong>Parent Logic:</strong> All pages → __main__ → domain</div>
              <div><strong>URL Example:</strong> <code>/domain/gdesign/ytube</code></div>
              <div><strong>Use Case:</strong> Single topic with organized sections</div>
            </div>
            <div className="mt-3 p-2 bg-blue-50 rounded text-xs">
              <strong>Flow:</strong> Domain → __main__ (hidden) → Your Pages
            </div>
          </div>

          {/* Hierarchical Domain */}
          <div className="bg-white rounded-lg p-4 border border-cyan-200">
            <h5 className="font-semibold mb-3 text-purple-900">🏗️ Hierarchical Domains</h5>
            <div className="space-y-2">
              <div><strong>Auto-creates:</strong> Nothing (clean start)</div>
              <div><strong>Parent Logic:</strong> Top pages → domain directly</div>
              <div><strong>URL Example:</strong> <code>/domain/webdev/with-code</code></div>
              <div><strong>Use Case:</strong> Multiple main categories</div>
            </div>
            <div className="mt-3 p-2 bg-purple-50 rounded text-xs">
              <strong>Flow:</strong> Domain → Your Main Categories → Sub Pages
            </div>
          </div>
          
        </div>
      </div>
      
    </div>
  );
}

/**
 * Fetch domains for page management
 * Include only essential data needed for page management
 */
async function fetchDomainsForPageManagement() {
  try {
    const domains = await prisma.domain.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        pageType: true,
        isPublished: true,
        category: {
          select: {
            id: true,
            name: true,
            icon: true
          }
        }
      },
      orderBy: [
        { category: { columnPosition: 'asc' } },
        { orderInCategory: 'asc' },
        { name: 'asc' }
      ]
    });

    return domains;

  } catch (error) {
    console.error('Error fetching domains for page management:', error);
    return [];
  }
}
