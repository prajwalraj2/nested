import { prisma } from '@/lib/prisma';
import { DomainsTable } from '@/components/admin/domains/DomainsTable';
import { DomainForm } from '@/components/admin/domains/DomainForm';
import { DomainFilters } from '@/components/admin/domains/DomainFilters';
import { Roboto } from 'next/font/google';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});

/**
 * Admin Domains Management Page
 * 
 * Comprehensive domain management interface with:
 * - Domain creation and editing
 * - Category-based filtering and organization
 * - Publication status management
 * - Page type configuration (direct vs hierarchical)
 * - SEO settings and slug management
 * - Bulk operations and quick actions
 * 
 * Layout Structure:
 * ┌─ Domain Creation Form ──────────────────────────────┐
 * │ [Name] [Category] [Page Type] [SEO] [Save]          │
 * └─────────────────────────────────────────────────────┘
 * ┌─ Filters & Search ─────────────────────────────────┐
 * │ [Search] [Category Filter] [Status] [Type Filter]  │
 * └─────────────────────────────────────────────────────┘
 * ┌─ Domains Table ────────────────────────────────────┐
 * │ Name        │ Category    │ Type   │ Status │ Actions │
 * │ Domain 1    │ Design      │ Direct │ Live   │ [E][D] │
 * │ Domain 2    │ Tech        │ Hier   │ Draft  │ [E][D] │
 * └─────────────────────────────────────────────────────┘
 */

type SearchParams = {
  search?: string;
  category?: string;
  status?: string;
  pageType?: string;
};

type DomainsPageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function DomainsManagePage({ searchParams }: DomainsPageProps) {
  // Await searchParams for Next.js 15 compatibility
  const awaitedSearchParams = await searchParams;
  
  // Fetch domains with filters applied
  const { domains, categories, stats } = await fetchDomainsWithFilters(awaitedSearchParams);
  
  return (
    <div className="space-y-8">
      
      {/* Page Introduction */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 border border-green-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          🌐 Manage Content Domains
        </h2>
        <p className="text-gray-600">
          Create and organize your content domains. Manage categories, page types, and publication status.
        </p>
      </div>

      {/* Domain Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Domains</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalDomains}</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <span className="text-blue-600 text-xl">🌐</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Published</p>
              <p className="text-2xl font-bold text-green-600">{stats.publishedDomains}</p>
            </div>
            <div className="p-2 bg-green-100 rounded-lg">
              <span className="text-green-600 text-xl">✅</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Draft</p>
              <p className="text-2xl font-bold text-orange-600">{stats.draftDomains}</p>
            </div>
            <div className="p-2 bg-orange-100 rounded-lg">
              <span className="text-orange-600 text-xl">📝</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Categories</p>
              <p className="text-2xl font-bold text-purple-600">{stats.categoriesUsed}</p>
            </div>
            <div className="p-2 bg-purple-100 rounded-lg">
              <span className="text-purple-600 text-xl">📂</span>
            </div>
          </div>
        </div>
      </div>

      {/* Domain Creation Form */}
      <div className="bg-white rounded-3xl border border-gray-300 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className={`text-xl font-semibold text-gray-900 ${roboto.className}`}>
              Create New Domain
            </h3>
            <p className={`text-md text-gray-600 mt-1 ${roboto.className}`}>
              Add a new content domain to your platform
            </p>
          </div>
          
          {/* Quick Stats */}
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span>📊 {domains.length} domain{domains.length !== 1 ? 's' : ''} shown</span>
            <span>🏷️ {categories.length} categories available</span>
          </div>
        </div>
        
        {/* Domain Form Component */}
        <DomainForm categories={categories} />
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="mb-4">
          <h3 className={`text-lg font-semibold text-gray-900 ${roboto.className}`}>
            Filter & Search Domains
          </h3>
          <p className={`text-sm text-gray-600 mt-1 ${roboto.className}`}>
            Find and organize your domains using filters and search
          </p>
        </div>
        
        <DomainFilters 
          categories={categories}
          currentFilters={awaitedSearchParams}
        />
      </div>

      {/* Domains Table */}
      <div className="bg-white rounded-lg border border-gray-200">



        {/* Table Header Wrapper */}
        <div className="px-6 py-4 border-b border-gray-200">

            {/* Table Header */}
          <div className="flex items-center justify-between">

            {/* Table Heading and Description */}
            <div>
              <h3 className={`text-lg font-semibold text-gray-900 ${roboto.className}`}>
                All Domains
              </h3>
              <p className={`text-sm text-gray-600 mt-1 ${roboto.className}`}>
                Manage and edit your content domains
              </p>
            </div>
            
            {/* Table Actions  Export and Bulk Actions */}
            <div className="flex items-center space-x-3">
              <button className="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                📥 Export
              </button>
              <button className="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                🔄 Bulk Actions
              </button>
            </div>
          </div>
        </div>
        
        <DomainsTable 
          domains={domains}
          categories={categories}
        />
      </div>

      {/* Domain Management Tips */}
      <div className="bg-green-50 rounded-lg p-6 border border-green-100">
        <h4 className="font-semibold text-green-900 mb-3">
          💡 Domain Management Best Practices
        </h4>
        <ul className="text-sm text-black space-y-2">
          <li>• <strong>Clear Names:</strong> Use descriptive domain names that clearly indicate the content focus</li>
          <li>• <strong>Category Organization:</strong> Assign domains to appropriate categories for better user navigation</li>
          <li>• <strong>Page Types:</strong> Choose "Direct" for content domains, "Hierarchical" for subcategory domains</li>
          <li>• <strong>SEO-Friendly Slugs:</strong> Keep URLs short, descriptive, and search-engine optimized</li>
          <li>• <strong>Publishing Strategy:</strong> Use draft status for domains under development</li>
        </ul>
      </div>
      
    </div>
  );
}

/**
 * Fetch Domains with Filters Applied
 * 
 * Retrieves domains based on search and filter parameters
 * Includes category information and statistics
 */
async function fetchDomainsWithFilters(searchParams: SearchParams) {
  try {
    // Build filter conditions
    const whereConditions: any = {};
    
    // Search filter
    if (searchParams.search) {
      whereConditions.OR = [
        { name: { contains: searchParams.search, mode: 'insensitive' } },
        { slug: { contains: searchParams.search, mode: 'insensitive' } }
      ];
    }
    
    // Category filter
    if (searchParams.category) {
      whereConditions.categoryId = searchParams.category;
    }
    
    // Status filter
    if (searchParams.status === 'published') {
      whereConditions.isPublished = true;
    } else if (searchParams.status === 'draft') {
      whereConditions.isPublished = false;
    }
    
    // Page type filter
    if (searchParams.pageType) {
      whereConditions.pageType = searchParams.pageType;
    }

    // Fetch domains with category information
    const domains = await prisma.domain.findMany({
      where: whereConditions,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
            columnPosition: true
          }
        },
        _count: {
          select: {
            pages: true
          }
        }
      },
      orderBy: [
        { category: { columnPosition: 'asc' } },
        { orderInCategory: 'asc' },
        { name: 'asc' }
      ]
    });

    // Fetch available categories
    const categories = await prisma.domainCategory.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        columnPosition: true
      },
      orderBy: [
        { columnPosition: 'asc' },
        { categoryOrder: 'asc' }
      ]
    });

    // Calculate statistics
    const stats = {
      totalDomains: domains.length,
      publishedDomains: domains.filter(d => d.isPublished).length,
      draftDomains: domains.filter(d => !d.isPublished).length,
      categoriesUsed: new Set(domains.map(d => d.categoryId)).size
    };

    // Transform domains for easier use in components
    const transformedDomains = domains.map(domain => ({
      id: domain.id,
      name: domain.name,
      slug: domain.slug,
      pageType: domain.pageType,
      isPublished: domain.isPublished,
      orderInCategory: domain.orderInCategory,
      targetCountries: domain.targetCountries,
      createdAt: domain.createdAt,
      category: domain.category,
      pageCount: domain._count.pages,
      // Generate preview URL
      previewUrl: `/domain/${domain.slug}`
    }));

    return {
      domains: transformedDomains,
      categories,
      stats
    };

  } catch (error) {
    console.error('Error fetching domains:', error);
    
    return {
      domains: [],
      categories: [],
      stats: {
        totalDomains: 0,
        publishedDomains: 0,
        draftDomains: 0,
        categoriesUsed: 0
      }
    };
  }
}
