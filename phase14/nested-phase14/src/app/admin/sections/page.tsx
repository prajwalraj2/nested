// src/app/admin/sections/page.tsx

import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { SectionsManager } from '@/components/admin/sections/SectionsManager';

/**
 * Main Sections Management Page
 * 
 * This page provides the interface for configuring how child pages
 * are organized into 3-column sections on section-based pages.
 * 
 * Features:
 * - Domain and page selection
 * - Visual section configuration editor
 * - Live preview of section layout
 * - Drag-and-drop page organization
 * 
 * Workflow:
 * 1. Select a domain (direct or hierarchical)
 * 2. Select a section-based page within that domain
 * 3. Configure how child pages are organized into sections
 * 4. Save the configuration to the database
 */

// Fetch domains and their section-based pages
async function getSectionablePages() {
  try {
    const domains = await prisma.domain.findMany({
      include: {
        pages: {
          where: {
            contentType: 'section_based'
          },
          include: {
            subPages: {
              select: {
                id: true,
                title: true,
                slug: true,
                contentType: true
              },
              orderBy: { order: 'asc' }
            },
            _count: {
              select: {
                subPages: true
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Get statistics
    const totalDomains = domains.length;
    const totalSectionablePages = domains.reduce((acc, domain) => acc + domain.pages.length, 0);
    const configuredPages = domains.reduce((acc, domain) => 
      acc + domain.pages.filter(page => page.sections && Array.isArray(page.sections) && page.sections.length > 0).length, 0
    );
    const totalChildPages = domains.reduce((acc, domain) => 
      acc + domain.pages.reduce((pageAcc, page) => pageAcc + page.subPages.length, 0), 0
    );

    return {
      domains,
      stats: {
        totalDomains,
        totalSectionablePages,
        configuredPages,
        totalChildPages
      }
    };
  } catch (error) {
    console.error('Error fetching sectionable pages:', error);
    return {
      domains: [],
      stats: {
        totalDomains: 0,
        totalSectionablePages: 0,
        configuredPages: 0,
        totalChildPages: 0
      }
    };
  }
}

export default async function SectionsManagementPage() {
  const { domains, stats } = await getSectionablePages();

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          🎯 Section Layout Management
        </h1>
        <p className="text-gray-600 mt-2">
          Configure how child pages are organized into 3-column sections on section-based pages.
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          title="Total Domains"
          value={stats.totalDomains}
          icon="🌐"
          description="Domains in system"
        />
        <StatsCard
          title="Section-Based Pages"
          value={stats.totalSectionablePages}
          icon="📋"
          description="Pages that can have sections"
        />
        <StatsCard
          title="Configured Pages"
          value={stats.configuredPages}
          icon="✅"
          description="Pages with sections setup"
        />
        <StatsCard
          title="Total Child Pages"
          value={stats.totalChildPages}
          icon="📄"
          description="Pages available for organization"
        />
      </div>

      {/* Main Sections Management Interface */}
      <Suspense fallback={<SectionsManagerSkeleton />}>
        <SectionsManager domains={domains} />
      </Suspense>

    </div>
  );
}

/**
 * Statistics Card Component
 * Shows key metrics about the sections system
 */
type StatsCardProps = {
  title: string;
  value: number;
  icon: string;
  description: string;
};

function StatsCard({ title, value, icon, description }: StatsCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center">
        <div className="text-2xl mr-3">{icon}</div>
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading skeleton for the sections manager
 */
function SectionsManagerSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
        </div>
        <div className="h-64 bg-gray-200 rounded mt-6"></div>
      </div>
    </div>
  );
}
