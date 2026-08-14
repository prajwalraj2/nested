# 📋 Master Task List - ATNO Architecture Overhaul

**Created:** February 5, 2026  
**Status:** IN PROGRESS  
**Reference Documents:**
- `ARCHITECTURE-IMPROVEMENTS-2.md` (Current analysis)
- `ARCHITECTURE-IMPROVEMENTS-PLAN.md` (Services layer plan)
- `COMPREHENSIVE-PROJECT-ANALYSIS.md` (Full project analysis)

---

## 🎯 Goals

1. **Reduce API calls** from 5-6 per page to 1-2
2. **Eliminate N+1 queries** in breadcrumb and page resolution
3. **Clean up code** - remove debug logs, dead code
4. **Centralize data access** with services layer
5. **Add caching** for better performance
6. **Unify UI theme** for consistent UX

---

## 📊 Task Overview

| Phase | Focus | Tasks | Effort | Status |
|-------|-------|-------|--------|--------|
| 1 | Quick Wins | 5 tasks | 1-2 hours | ⬜ Pending |
| 2 | API Consolidation | 6 tasks | 1-2 days | ⬜ Pending |
| 3 | Services Layer | 7 tasks | 2-3 days | ⬜ Pending |
| 4 | Page Refactoring | 4 tasks | 1-2 days | ⬜ Pending |
| 5 | Caching | 4 tasks | 1-2 days | ⬜ Pending |
| 6 | UI Consistency | 5 tasks | 1-2 days | ⬜ Pending |
| 7 | Production Ready | 6 tasks | 2-3 days | ⬜ Pending |

**Total: 37 tasks**

---

## 🚀 Phase 1: Quick Wins (Code Cleanup)

> **Goal:** Clean up the codebase without changing functionality  
> **Effort:** 1-2 hours  
> **Risk:** Very Low

### Task 1.1: Remove Debug Console.logs
**Files to modify:**
- [ ] `src/components/sidebar/PageSidebar.tsx` (lines 51, 66, 76, 127)
- [ ] `src/hooks/usePageSidebarData.ts` (lines 101, 122)
- [ ] `src/app/api/page-sidebar/route.ts` (lines 131, 132, 144, 163)

**Total: 10 console.log statements to remove**

---

### Task 1.2: Fix N+1 Query in Breadcrumb API
**File:** `src/app/api/breadcrumb/route.ts`

**Current (Bad):**
```typescript
for (let i = 0; i < pageSegments.length; i++) {
  const page = await prisma.page.findFirst({...}); // Query per segment!
}
```

**Target (Good):**
```typescript
// Single query to fetch all pages in path
const allPages = await prisma.page.findMany({
  where: {
    domainId: domain.id,
    slug: { in: pageSegments }
  }
});
// Then build breadcrumbs from fetched data
```

---

### Task 1.3: Remove Commented-Out Code
**Files to clean:**
- [ ] `src/components/sidebar/app-sidebar.tsx` (lines 41-49, 121-145)
- [ ] `src/app/domain/layout.tsx` (lines 11-12, 24)

**Action:** Either implement these features or delete the commented code

---

### Task 1.4: Remove Unused Imports
**Scan all files for:**
- Unused imports
- Unused variables
- Unused functions

---

### Task 1.5: Standardize Error Handling
**Current:** Mix of try/catch patterns  
**Target:** Consistent error response format across all APIs

```typescript
// Standard error response format
{
  success: false,
  error: {
    code: 'NOT_FOUND',
    message: 'Domain not found'
  }
}
```

---

## 🔗 Phase 2: API Consolidation

> **Goal:** Merge 4 navigation APIs into 1 unified endpoint  
> **Effort:** 1-2 days  
> **Risk:** Medium

### Task 2.1: Create Unified Page Context API
**Create:** `src/app/api/page-context/route.ts`

**Endpoint:** `GET /api/page-context?path=/domain/gdesign/ytube`

**Response structure:**
```typescript
{
  success: true,
  data: {
    // Header data (domains by category for dropdown)
    header: {
      columnData: { 1: [...], 2: [...], 3: [...] },
      totalDomains: number,
      totalCategories: number
    },
    
    // Sidebar data (all domains for navigation)
    sidebar: {
      domains: [...],
      categories: [...]
    },
    
    // Page sidebar data (current domain's pages)
    pageSidebar: {
      type: 'direct_domain' | 'hierarchical_page',
      domain: { name, slug },
      page?: { name, slug },
      sections: [...]
    },
    
    // Breadcrumb data
    breadcrumb: {
      items: [
        { label: 'Domains', url: '/domain', type: 'root' },
        { label: 'Graphic Design', url: '/domain/gdesign', type: 'domain' },
        { label: 'YouTube', url: '/domain/gdesign/ytube', type: 'page' }
      ]
    },
    
    // Current page info (optional)
    currentPage?: {
      id: string,
      title: string,
      contentType: string
    }
  }
}
```

---

### Task 2.2: Create usePageContext Hook
**Create:** `src/hooks/usePageContext.ts`

**Features:**
- Single hook that replaces 4 existing hooks
- Manages all navigation state
- Caches data to prevent re-fetching
- Provides helpers for active state detection

```typescript
export function usePageContext() {
  return {
    // Data
    header: HeaderData,
    sidebar: SidebarData,
    pageSidebar: PageSidebarData,
    breadcrumb: BreadcrumbData,
    
    // State
    loading: boolean,
    error: string | null,
    
    // Helpers
    isCurrentPage: (url: string) => boolean,
    isDomainExpanded: (id: string) => boolean,
    toggleDomain: (id: string) => void,
    // ...etc
  }
}
```

---

### Task 2.3: Create PageContext Provider
**Create:** `src/contexts/PageContextProvider.tsx`

Wrap the app with this provider so all components can access the same data.

---

### Task 2.4: Update Components to Use New Hook
**Files to update:**
- [ ] `src/components/bread/bread.tsx` → use `usePageContext().breadcrumb`
- [ ] `src/components/sidebar/app-sidebar.tsx` → use `usePageContext().sidebar`
- [ ] `src/components/sidebar/PageSidebar.tsx` → use `usePageContext().pageSidebar`
- [ ] `src/components/header/AppHeader.tsx` → use `usePageContext().header`

---

### Task 2.5: Deprecate Old APIs
**Mark as deprecated (don't delete yet):**
- [ ] `src/app/api/header-domains/route.ts`
- [ ] `src/app/api/sidebar/route.ts`
- [ ] `src/app/api/page-sidebar/route.ts`
- [ ] `src/app/api/breadcrumb/route.ts`

Add deprecation comments and redirect to new API.

---

### Task 2.6: Deprecate Old Hooks
**Mark as deprecated:**
- [ ] `src/hooks/useHeaderData.ts`
- [ ] `src/hooks/useSidebarData.ts`
- [ ] `src/hooks/usePageSidebarData.ts`
- [ ] `src/hooks/useBreadcrumbData.ts`

---

## 🏗️ Phase 3: Services Layer

> **Goal:** Centralize all database operations  
> **Effort:** 2-3 days  
> **Risk:** Medium

### Task 3.1: Create Services Folder Structure
**Create:**
```
src/services/
├── domain.service.ts
├── page.service.ts
├── category.service.ts
├── table.service.ts
├── navigation.service.ts
├── types.ts
└── index.ts
```

---

### Task 3.2: Create Domain Service
**File:** `src/services/domain.service.ts`

**Methods:**
```typescript
export const DomainService = {
  // Get all published domains
  getAll: cache(async (userCountry?: string) => {...}),
  
  // Get domain by slug
  getBySlug: cache(async (slug: string) => {...}),
  
  // Get domain with pages
  getWithPages: cache(async (slug: string) => {...}),
  
  // Check if domain exists
  exists: cache(async (slug: string) => {...}),
}
```

---

### Task 3.3: Create Page Service
**File:** `src/services/page.service.ts`

**Methods:**
```typescript
export const PageService = {
  // Get page by path (optimized - no N+1)
  getByPath: cache(async (domainId: string, slugPath: string[]) => {...}),
  
  // Get main page for direct domains
  getMainPage: cache(async (domainId: string) => {...}),
  
  // Get or create main page
  getOrCreateMainPage: async (domainId: string, domainName: string) => {...},
  
  // Get child pages
  getChildPages: cache(async (domainId: string, parentId: string) => {...}),
}
```

---

### Task 3.4: Create Category Service
**File:** `src/services/category.service.ts`

**Methods:**
```typescript
export const CategoryService = {
  // Get all active categories
  getActive: cache(async () => {...}),
  
  // Get category by slug
  getBySlug: cache(async (slug: string) => {...}),
}
```

---

### Task 3.5: Create Table Service
**File:** `src/services/table.service.ts`

**Methods:**
```typescript
export const TableService = {
  // Get table by page ID
  getByPageId: cache(async (pageId: string) => {...}),
  
  // Get table with filtered rows (geo-targeting)
  getPublicTable: cache(async (pageId: string, userCountry: string) => {...}),
}
```

---

### Task 3.6: Create Navigation Service
**File:** `src/services/navigation.service.ts`

**Purpose:** Combines domain, page, category services for navigation needs

**Methods:**
```typescript
export const NavigationService = {
  // Get all navigation data in one call
  getPageContext: cache(async (path: string, userCountry: string) => {
    // Returns header, sidebar, pageSidebar, breadcrumb data
  }),
}
```

---

### Task 3.7: Create Shared Types
**File:** `src/services/types.ts`

```typescript
export type DomainWithCategory = Domain & { category: DomainCategory | null };
export type DomainWithPages = Domain & { pages: PageWithContent[] };
export type PageWithContent = Page & { content: ContentBlock[]; subPages: Page[] };
// ...etc
```

---

## 📄 Phase 4: Page Component Refactoring

> **Goal:** Simplify page components using services  
> **Effort:** 1-2 days  
> **Risk:** Medium

### Task 4.1: Refactor Domain Index Page
**File:** `src/app/domain/page.tsx`

**Current:** ~235 lines with direct Prisma calls  
**Target:** ~80 lines using DomainService

```typescript
// AFTER
import { DomainService, CategoryService } from '@/services';

export default async function DomainIndexPage() {
  const [domains, categories] = await Promise.all([
    DomainService.getAll(),
    CategoryService.getActive(),
  ]);
  
  // ... render
}
```

---

### Task 4.2: Refactor Domain Slug Page
**File:** `src/app/domain/[...slug]/page.tsx`

**Current:** 487 lines with N+1 queries  
**Target:** ~150 lines using services

```typescript
// AFTER
import { DomainService, PageService } from '@/services';

export default async function DomainPage({ params }: Props) {
  const { slug } = await params;
  const [domainSlug, ...pathSegments] = slug;

  const domain = await DomainService.getBySlug(domainSlug);
  if (!domain) return notFound();

  // Use optimized page resolution
  const page = await PageService.getByPath(domain.id, pathSegments);
  
  return <DomainRouter domain={domain} page={page} />;
}
```

---

### Task 4.3: Create DomainRouter Component
**Create:** `src/components/domain/DomainRouter.tsx`

**Purpose:** Route to correct layout based on page contentType

```typescript
export function DomainRouter({ domain, page }) {
  switch (page?.contentType) {
    case 'section_based':
      return <SectionBasedLayout domain={domain} page={page} />;
    case 'table':
      return <TableLayout page={page} domain={domain} />;
    case 'rich_text':
      return <RichTextLayout page={page} domain={domain} />;
    // ...etc
  }
}
```

---

### Task 4.4: Extract Helper Functions
**Create:** `src/lib/domain-helpers.ts`

Move helper functions out of page components:
- `findPageByPath`
- `getOrCreateMainPage`
- `organizeByColumn`

---

## 💾 Phase 5: Caching Strategy

> **Goal:** Add caching to reduce database load  
> **Effort:** 1-2 days  
> **Risk:** Low

### Task 5.1: Add React cache() to Services
All service methods should use React's `cache()` for request-level deduplication.

```typescript
import { cache } from 'react';

export const DomainService = {
  getAll: cache(async () => {
    return prisma.domain.findMany({...});
  }),
}
```

---

### Task 5.2: Add HTTP Cache Headers
**Files to update:** All public API routes

```typescript
return NextResponse.json(data, {
  headers: {
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
  },
});
```

---

### Task 5.3: Consider Redis Caching (Optional)
For high-traffic scenarios:
- Cache navigation data with 1-hour TTL
- Invalidate on admin updates

---

### Task 5.4: Add ISR to Static Pages (Optional)
For pages that rarely change:

```typescript
export const revalidate = 3600; // Revalidate every hour
```

---

## 🎨 Phase 6: UI Consistency

> **Goal:** Unified visual design across all pages  
> **Effort:** 1-2 days  
> **Risk:** Low

### Task 6.1: Define CSS Variables
**Create/Update:** `src/app/globals.css`

```css
:root {
  --background-primary: #2f2f2f;
  --background-secondary: #1f1f1f;
  --text-primary: #ffffff;
  --text-secondary: #a0a0a0;
  --accent-primary: #3b82f6;
  /* ...etc */
}
```

---

### Task 6.2: Update Layout Components
**Files to update:**
- [ ] `src/components/domain/SectionBasedLayout.tsx`
- [ ] `src/components/domain/TableLayout.tsx`
- [ ] `src/components/domain/RichTextLayout.tsx`
- [ ] `src/components/domain/SubcategorySelector.tsx`
- [ ] `src/app/domain/page.tsx`

**Goal:** All use same background, spacing, typography

---

### Task 6.3: Update Header Theme
**File:** `src/components/header/AppHeader.tsx`

Match dark theme or create proper light/dark toggle.

---

### Task 6.4: Create Loading Skeletons
**Create:** `src/components/ui/skeletons/`

Replace "Loading..." text with proper skeleton components.

---

### Task 6.5: Redesign Homepage
**File:** `src/app/page.tsx`

**Current:** Debug links only  
**Target:** Proper landing page with:
- Hero section
- Featured domains
- Quick navigation

---

## 🛡️ Phase 7: Production Readiness

> **Goal:** Prepare for production deployment  
> **Effort:** 2-3 days  
> **Risk:** Low

### Task 7.1: Add Error Boundaries
**Create:** `src/components/ErrorBoundary.tsx`

Wrap critical sections to prevent full-page crashes.

---

### Task 7.2: Add Structured Error Responses
Standardize API error format:

```typescript
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid input',
    details: {...}
  }
}
```

---

### Task 7.3: Add SEO Metadata
**Files to update:**
- [ ] `src/app/domain/page.tsx` - Add generateMetadata
- [ ] `src/app/domain/[...slug]/page.tsx` - Add generateMetadata

---

### Task 7.4: Add Rate Limiting (Optional)
Protect public APIs from abuse.

---

### Task 7.5: Create sitemap.xml
**Create:** `src/app/sitemap.ts`

---

### Task 7.6: Add Performance Monitoring (Optional)
Consider Vercel Analytics or similar.

---

## 📝 Progress Tracking

### Phase 1: Quick Wins
- [ ] Task 1.1: Remove debug console.logs
- [ ] Task 1.2: Fix N+1 query in breadcrumb
- [ ] Task 1.3: Remove commented-out code
- [ ] Task 1.4: Remove unused imports
- [ ] Task 1.5: Standardize error handling

### Phase 2: API Consolidation
- [ ] Task 2.1: Create unified page-context API
- [ ] Task 2.2: Create usePageContext hook
- [ ] Task 2.3: Create PageContext provider
- [ ] Task 2.4: Update components to use new hook
- [ ] Task 2.5: Deprecate old APIs
- [ ] Task 2.6: Deprecate old hooks

### Phase 3: Services Layer
- [ ] Task 3.1: Create services folder structure
- [ ] Task 3.2: Create Domain service
- [ ] Task 3.3: Create Page service
- [ ] Task 3.4: Create Category service
- [ ] Task 3.5: Create Table service
- [ ] Task 3.6: Create Navigation service
- [ ] Task 3.7: Create shared types

### Phase 4: Page Refactoring
- [ ] Task 4.1: Refactor domain index page
- [ ] Task 4.2: Refactor domain slug page
- [ ] Task 4.3: Create DomainRouter component
- [ ] Task 4.4: Extract helper functions

### Phase 5: Caching
- [ ] Task 5.1: Add React cache() to services
- [ ] Task 5.2: Add HTTP cache headers
- [ ] Task 5.3: Consider Redis caching
- [ ] Task 5.4: Add ISR to static pages

### Phase 6: UI Consistency
- [ ] Task 6.1: Define CSS variables
- [ ] Task 6.2: Update layout components
- [ ] Task 6.3: Update header theme
- [ ] Task 6.4: Create loading skeletons
- [ ] Task 6.5: Redesign homepage

### Phase 7: Production Readiness
- [ ] Task 7.1: Add error boundaries
- [ ] Task 7.2: Add structured error responses
- [ ] Task 7.3: Add SEO metadata
- [ ] Task 7.4: Add rate limiting
- [ ] Task 7.5: Create sitemap.xml
- [ ] Task 7.6: Add performance monitoring

---

## 🚦 Ready to Start?

**Recommended starting point:** Phase 1, Task 1.1 (Remove debug console.logs)

This is the safest change with immediate benefit - clean console output in production.

---

*Last Updated: February 5, 2026*

