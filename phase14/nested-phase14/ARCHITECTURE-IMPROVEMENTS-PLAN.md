# 🏗️ Architecture Improvements Plan

**Created:** February 2, 2026  
**Status:** PLANNED - To be implemented after core feature completion  
**Priority:** High

---

## 📋 Overview

This document outlines the planned architecture improvements for the ATNO project to make it:
- ✅ More organized and maintainable
- ✅ Ready for future mobile app (Expo)
- ✅ Scalable for high traffic
- ✅ Properly cached for performance

---

## 🎯 Goals

1. **Separate concerns** - Move database logic out of page components
2. **Create reusable services** - Single source of truth for data operations
3. **Enable future mobile support** - APIs that Expo can consume
4. **Improve performance** - Add caching at the service layer
5. **Reduce code duplication** - Shared types and utilities

---

## 📊 Current vs Target Architecture

### Current Architecture (Problems)

```
page.tsx (440 lines!)
├── Types defined inline
├── prisma.domain.findUnique()     ← Direct DB call
├── prisma.page.findFirst()        ← Direct DB call  
├── prisma.page.findFirst()        ← Direct DB call (in loop - N+1!)
├── prisma.page.create()           ← Direct DB call
├── Business logic functions
└── JSX rendering

Problems:
❌ Everything mixed in one file
❌ N+1 query patterns (loop with DB calls)
❌ No caching
❌ Can't reuse logic for mobile API
❌ Hard to test
❌ Hard to maintain
```

### Target Architecture (Clean)

```
src/
├── services/                    # Data access layer
│   ├── domain.service.ts        # All domain operations
│   ├── page.service.ts          # All page operations
│   ├── category.service.ts      # All category operations
│   ├── table.service.ts         # All table operations
│   └── index.ts                 # Export all
│
├── types/                       # Shared TypeScript types
│   ├── domain.types.ts
│   ├── page.types.ts
│   └── api.types.ts
│
├── app/
│   ├── api/v1/                  # Versioned API for mobile
│   │   ├── domains/route.ts
│   │   ├── pages/route.ts
│   │   └── ...
│   │
│   └── domain/
│       ├── page.tsx             # Clean - just calls services
│       └── [...slug]/page.tsx   # Clean - just calls services
│
└── components/                  # Rendering only
```

---

## 📁 New Files to Create

### 1. Services Layer

#### `src/services/domain.service.ts`

```typescript
import { prisma } from '@/lib/prisma';
import { cache } from 'react';
import type { Domain, DomainWithPages, DomainWithCategory } from '@/types/domain.types';

/**
 * Domain Service
 * 
 * All database operations related to domains.
 * Uses React's cache() for request-level deduplication.
 */
export const DomainService = {
  
  /**
   * Get all published domains with their categories
   * Used by: /domain page, header dropdown
   */
  getAll: cache(async (): Promise<DomainWithCategory[]> => {
    return prisma.domain.findMany({
      where: { isPublished: true },
      include: { category: true },
      orderBy: [
        { category: { columnPosition: 'asc' } },
        { category: { categoryOrder: 'asc' } },
        { orderInCategory: 'asc' },
      ],
    });
  }),

  /**
   * Get single domain by slug with top-level pages
   * Used by: /domain/[slug] page
   */
  getBySlug: cache(async (slug: string): Promise<DomainWithPages | null> => {
    return prisma.domain.findUnique({
      where: { slug },
      include: {
        pages: {
          where: { parentId: null },
          include: {
            content: { orderBy: { order: 'asc' } },
            subPages: { orderBy: { order: 'asc' } }
          },
          orderBy: { order: 'asc' }
        }
      }
    });
  }),

  /**
   * Get domain with full page tree (for complex pages)
   */
  getWithFullPages: cache(async (slug: string) => {
    return prisma.domain.findUnique({
      where: { slug, isPublished: true },
      include: {
        category: true,
        pages: {
          include: {
            content: { orderBy: { order: 'asc' } },
            subPages: { orderBy: { order: 'asc' } },
            richTextContent: true,
            table: true,
          },
          orderBy: { order: 'asc' }
        }
      }
    });
  }),

  /**
   * Check if domain exists and is published
   */
  exists: cache(async (slug: string): Promise<boolean> => {
    const domain = await prisma.domain.findUnique({
      where: { slug },
      select: { isPublished: true }
    });
    return domain?.isPublished ?? false;
  }),
};
```

#### `src/services/page.service.ts`

```typescript
import { prisma } from '@/lib/prisma';
import { cache } from 'react';
import type { PageWithContent, ChildPage } from '@/types/page.types';

/**
 * Page Service
 * 
 * All database operations related to pages.
 * Includes optimized queries to avoid N+1 problems.
 */
export const PageService = {
  
  /**
   * Get page by path - OPTIMIZED single query approach
   * Replaces the old N+1 loop pattern
   */
  getByPath: cache(async (
    domainId: string, 
    pathSegments: string[],
    domainType: 'direct' | 'hierarchical'
  ): Promise<PageWithContent | null> => {
    if (pathSegments.length === 0) return null;
    
    // For direct domains, pages are children of __main__
    // For hierarchical, pages are at root level
    const firstPageWhere = domainType === 'direct'
      ? {
          slug: pathSegments[0],
          domainId,
          parent: { slug: '__main__' }
        }
      : {
          slug: pathSegments[0],
          domainId,
          parentId: null
        };

    // Get all pages in the path with a single query
    const allPages = await prisma.page.findMany({
      where: {
        domainId,
        slug: { in: pathSegments }
      },
      include: {
        content: { orderBy: { order: 'asc' } },
        subPages: { orderBy: { order: 'asc' } },
        richTextContent: true,
      }
    });

    // Build the path from fetched pages
    let currentPage = allPages.find(p => 
      domainType === 'direct' 
        ? p.slug === pathSegments[0]
        : p.slug === pathSegments[0] && p.parentId === null
    );

    for (let i = 1; i < pathSegments.length && currentPage; i++) {
      currentPage = allPages.find(p => 
        p.slug === pathSegments[i] && p.parentId === currentPage?.id
      );
    }

    return currentPage as PageWithContent | null;
  }),

  /**
   * Get main page for direct domains
   */
  getMainPage: cache(async (domainId: string): Promise<PageWithContent | null> => {
    return prisma.page.findFirst({
      where: { domainId, slug: '__main__' },
      include: {
        content: { orderBy: { order: 'asc' } },
        subPages: { orderBy: { order: 'asc' } },
      }
    });
  }),

  /**
   * Get or create main page for direct domains
   */
  getOrCreateMainPage: async (domainId: string, domainName: string): Promise<PageWithContent> => {
    let mainPage = await prisma.page.findFirst({
      where: { domainId, slug: '__main__' },
      include: {
        content: { orderBy: { order: 'asc' } },
        subPages: { orderBy: { order: 'asc' } },
      }
    });

    if (!mainPage) {
      mainPage = await prisma.page.create({
        data: {
          title: domainName,
          slug: '__main__',
          contentType: 'section_based',
          domainId,
          order: 0,
        },
        include: {
          content: { orderBy: { order: 'asc' } },
          subPages: { orderBy: { order: 'asc' } },
        }
      });
    }

    return mainPage as PageWithContent;
  },

  /**
   * Get child pages of a parent page
   */
  getChildPages: cache(async (domainId: string, parentId: string): Promise<ChildPage[]> => {
    return prisma.page.findMany({
      where: { domainId, parentId },
      select: {
        id: true,
        title: true,
        slug: true,
        contentType: true,
        parentId: true,
      },
      orderBy: { order: 'asc' }
    });
  }),
};
```

#### `src/services/category.service.ts`

```typescript
import { prisma } from '@/lib/prisma';
import { cache } from 'react';

/**
 * Category Service
 * 
 * All database operations related to domain categories.
 */
export const CategoryService = {
  
  /**
   * Get all active categories
   */
  getActive: cache(async () => {
    return prisma.domainCategory.findMany({
      where: { isActive: true },
      orderBy: [
        { columnPosition: 'asc' },
        { categoryOrder: 'asc' },
      ],
    });
  }),

  /**
   * Get category by slug
   */
  getBySlug: cache(async (slug: string) => {
    return prisma.domainCategory.findUnique({
      where: { slug }
    });
  }),
};
```

#### `src/services/table.service.ts`

```typescript
import { prisma } from '@/lib/prisma';
import { cache } from 'react';

/**
 * Table Service
 * 
 * All database operations related to tables.
 */
export const TableService = {
  
  /**
   * Get table by page ID
   */
  getByPageId: cache(async (pageId: string) => {
    return prisma.table.findUnique({
      where: { pageId },
      include: {
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
              }
            }
          }
        }
      }
    });
  }),
};
```

#### `src/services/index.ts`

```typescript
// Export all services from a single file
export { DomainService } from './domain.service';
export { PageService } from './page.service';
export { CategoryService } from './category.service';
export { TableService } from './table.service';
```

---

### 2. Shared Types

#### `src/types/domain.types.ts`

```typescript
import type { Domain, DomainCategory, Page, ContentBlock } from '@/generated/prisma';

export type DomainWithCategory = Domain & {
  category: DomainCategory | null;
};

export type DomainWithPages = Domain & {
  pages: PageWithContent[];
};

export type PageWithContent = Page & {
  content: ContentBlock[];
  subPages: Page[];
  richTextContent?: {
    id: string;
    htmlContent: string;
    title: string | null;
    wordCount: number;
    updatedAt: Date;
  } | null;
};

export type ChildPage = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  parentId: string | null;
};
```

---

### 3. API Routes for Mobile (Future)

#### `src/app/api/v1/domains/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { DomainService, CategoryService } from '@/services';

/**
 * GET /api/v1/domains
 * Get all published domains with categories
 * 
 * Used by: Mobile app, external integrations
 */
export async function GET() {
  try {
    const [domains, categories] = await Promise.all([
      DomainService.getAll(),
      CategoryService.getActive(),
    ]);

    return NextResponse.json({
      success: true,
      data: { domains, categories }
    });
  } catch (error) {
    console.error('Error fetching domains:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch domains' },
      { status: 500 }
    );
  }
}
```

#### `src/app/api/v1/domains/[slug]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { DomainService } from '@/services';

/**
 * GET /api/v1/domains/[slug]
 * Get single domain by slug with pages
 * 
 * Used by: Mobile app
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const domain = await DomainService.getBySlug(slug);

    if (!domain) {
      return NextResponse.json(
        { success: false, error: 'Domain not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: domain
    });
  } catch (error) {
    console.error('Error fetching domain:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch domain' },
      { status: 500 }
    );
  }
}
```

---

## 📝 Files to Refactor

### 1. `src/app/domain/page.tsx`

**Before:** ~230 lines with direct Prisma calls  
**After:** ~80 lines using services

```typescript
// AFTER refactoring
import { DomainService, CategoryService } from '@/services';
import Link from 'next/link';

export default async function DomainIndexPage() {
  const [domains, categories] = await Promise.all([
    DomainService.getAll(),
    CategoryService.getActive(),
  ]);

  // Organize domains by category (keep this logic here or move to service)
  const columnData = organizeByColumn(domains, categories);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* ... JSX rendering only ... */}
    </div>
  );
}

// Helper function can stay here or move to utils
function organizeByColumn(domains, categories) {
  // ... organization logic ...
}
```

### 2. `src/app/domain/[...slug]/page.tsx`

**Before:** ~440 lines with N+1 queries  
**After:** ~150 lines using services

```typescript
// AFTER refactoring
import { DomainService, PageService } from '@/services';
import { notFound } from 'next/navigation';
import { DomainRouter } from '@/components/domain/DomainRouter';

type Props = { params: Promise<{ slug: string[] }> };

export default async function DomainPage({ params }: Props) {
  const { slug } = await params;
  const [domainSlug, ...pathSegments] = slug;

  // Single service call to get domain
  const domain = await DomainService.getBySlug(domainSlug);
  if (!domain) return notFound();

  // Handle top-level domain access
  if (pathSegments.length === 0) {
    if (domain.pageType === 'direct') {
      const mainPage = await PageService.getOrCreateMainPage(domain.id, domain.name);
      const childPages = await PageService.getChildPages(domain.id, mainPage.id);
      return <SectionBasedLayout domain={domain} page={mainPage} childPages={childPages} />;
    }
    return <SubcategorySelector domain={domain} />;
  }

  // Get nested page with optimized query
  const page = await PageService.getByPath(
    domain.id, 
    pathSegments, 
    domain.pageType as 'direct' | 'hierarchical'
  );
  
  if (!page) return notFound();

  // Route to appropriate layout
  return <DomainRouter domain={domain} page={page} />;
}
```

### 3. Create `src/components/domain/DomainRouter.tsx`

```typescript
// New component to handle content type routing
import { SectionBasedLayout } from './SectionBasedLayout';
import { SubcategorySelector } from './SubcategorySelector';
import { TableLayout } from './TableLayout';
import { RichTextLayout } from './RichTextLayout';
import { NarrativeLayout } from './NarrativeLayout';

export function DomainRouter({ domain, page }) {
  switch (page.contentType) {
    case 'section_based':
      return <SectionBasedLayout domain={domain} page={page} />;
    case 'subcategory_list':
      return <SubcategorySelector domain={domain} page={page} />;
    case 'table':
      return <TableLayout page={page} domain={domain} />;
    case 'rich_text':
      return <RichTextLayout page={page} domain={domain} />;
    default:
      return <NarrativeLayout page={page} domain={domain} />;
  }
}
```

---

## 🔄 Migration Strategy

### Phase 1: Create Services (Non-breaking)
1. Create `src/services/` folder
2. Create service files with all methods
3. Create shared types
4. **No changes to existing code yet**

### Phase 2: Refactor Pages (One at a time)
1. Refactor `domain/page.tsx` first (simpler)
2. Test thoroughly
3. Refactor `domain/[...slug]/page.tsx`
4. Test thoroughly

### Phase 3: Create API Routes
1. Create `/api/v1/` folder structure
2. Create API routes using services
3. Test with Postman/curl
4. Ready for mobile!

### Phase 4: Consolidate Navigation APIs
1. Merge `header-domains`, `sidebar`, `page-sidebar`, `breadcrumb`
2. Create unified `/api/page-context` endpoint
3. Update client-side hooks to use new endpoint

---

## 📊 Expected Improvements

| Metric | Before | After |
|--------|--------|-------|
| Lines in `[...slug]/page.tsx` | 440 | ~150 |
| DB queries per page | 5-10 | 1-3 |
| Code reusability | Low | High |
| Mobile API ready | ❌ No | ✅ Yes |
| Test coverage possible | Hard | Easy |
| Caching | ❌ None | ✅ Built-in |

---

## ✅ Checklist

- [ ] Create `src/services/` folder
- [ ] Create `domain.service.ts`
- [ ] Create `page.service.ts`
- [ ] Create `category.service.ts`
- [ ] Create `table.service.ts`
- [ ] Create `src/services/index.ts`
- [ ] Create `src/types/domain.types.ts`
- [ ] Refactor `domain/page.tsx`
- [ ] Refactor `domain/[...slug]/page.tsx`
- [ ] Create `DomainRouter.tsx` component
- [ ] Create `/api/v1/domains/` routes
- [ ] Create `/api/v1/pages/` routes
- [ ] Update existing navigation APIs (optional)
- [ ] Test all pages work correctly
- [ ] Performance testing

---

## 📚 References

- [Next.js Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [React cache() function](https://react.dev/reference/react/cache)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)

---

*This plan will be implemented after the current core feature is completed.*

