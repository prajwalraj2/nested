// app/domain/[...slug]/page.tsx
// 
// Dynamic Page Routing - Handles nested domain pages
// Supports: direct, hierarchical, section_based, table, rich_text layouts
// Uses Services Layer for data fetching
// Includes ISR for optimal performance

import { notFound } from 'next/navigation';
import { SubcategorySelector } from '@/components/domain/SubcategorySelector';
import { SectionBasedLayout } from '@/components/domain/SectionBasedLayout';
import { NarrativeLayout } from '@/components/domain/NarrativeLayout';
import { TableLayout } from '@/components/domain/TableLayout';
import { RichTextLayout } from '@/components/domain/RichTextLayout';
import { getUserCountryFromCookies, isContentVisibleToUser } from '@/lib/server-country';
import { DomainService, PageService } from '@/services';

// ============================================
// ISR Configuration
// ============================================

/** Revalidate page every 60 seconds */
export const revalidate = 60;

/** Force dynamic rendering due to geo-targeting (cookie-based) */
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string[] }> };

// ============================================
// Main Page Component
// ============================================

export default async function DomainPage({ params }: Props) {
  const awaitedParams = await params;
  const [domainSlug, ...restSlug] = awaitedParams.slug;

  // Get user's country from cookies
  const userCountry = await getUserCountryFromCookies();

  // Find domain with its top-level pages
  const domain = await DomainService.getWithPages(domainSlug);

  if (!domain) return notFound();

  // Check if domain is visible to user's country
  if (!isContentVisibleToUser(domain.targetCountries, userCountry)) {
    return notFound();
  }

  // Transform domain for component compatibility
  // Components expect pages with content/subPages, but service returns PageBasic
  const domainForComponents = {
    ...domain,
    pages: domain.pages.map(p => ({
      ...p,
      content: [],
      subPages: [],
    })),
  };

  // Top-level domain access (e.g., /domain/gdesign)
  if (restSlug.length === 0) {
    if (domain.pageType === 'direct') {
      // Direct domains: show main page with sections
      const mainPage = await PageService.getOrCreateMainPage(domain.id, domain.name);
      const childPages = await PageService.getChildPages(domain.id, mainPage.id, userCountry);
      
      return (
        <SectionBasedLayout 
          domain={domain} 
          page={mainPage} 
          childPages={childPages} 
          currentPath={`/domain/${domain.slug}`} 
        />
      );
    } else {
      // Hierarchical domains: show subcategory selection
      return <SubcategorySelector domain={domainForComponents} />;
    }
  }

  // Nested page access (e.g., /domain/webdev/courses)
  const page = await PageService.getByPath(
    domain.id,
    restSlug,
    domain.pageType as 'direct' | 'hierarchical',
    userCountry
  );
  
  if (!page) return notFound();
  
  // Transform page for component compatibility
  const pageForComponents = {
    ...page,
    subPages: page.subPages.map(sp => ({
      ...sp,
      content: [],
      subPages: [],
    })),
  };
  
  // Render based on content type
  switch (page.contentType) {
    case 'section_based': {
      const childPages = await PageService.getChildPages(domain.id, page.id, userCountry);
      return (
        <SectionBasedLayout 
          page={page} 
          domain={domain} 
          childPages={childPages} 
          currentPath={`/domain/${domain.slug}/${restSlug.join('/')}`} 
        />
      );
    }
    case 'subcategory_list':
      return <SubcategorySelector domain={domainForComponents} page={pageForComponents} />;
    case 'table':
      return <TableLayout page={page} domain={domain} />;
    case 'rich_text':
      return <RichTextLayout page={page} domain={domain} />;
    default:
      return <NarrativeLayout page={page} domain={domain} />;
  }
}
