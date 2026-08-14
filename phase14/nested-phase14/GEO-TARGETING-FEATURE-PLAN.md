# 🌍 Geo-Targeting Feature Plan

**Created:** February 3, 2026  
**Status:** PLANNED  
**Priority:** HIGH - Core Feature

---

## 📋 Overview

This document outlines the implementation plan for geo-targeting/localization features to show relevant content based on user's country.

### Problem Statement
- Content relevance varies by country (Hindi YouTube channels for India, English for USA)
- Product links are country-specific (Amazon.in vs Amazon.com)
- Some domains/pages/rows only apply to certain countries
- Need to filter content at multiple levels: Domain → Page → Table Row

### Countries to Support (Initial)
| Country | Code | Example |
|---------|------|---------|
| All Countries | `ALL` | Default, visible everywhere |
| India | `IN` | Hindi content, Amazon.in links |
| United States | `US` | English content, Amazon.com links |
| United Kingdom | `GB` | Amazon.co.uk links |
| Australia | `AU` | Amazon.com.au links |
| Canada | `CA` | Amazon.ca links |

---

## 🎯 Features to Implement

| # | Feature | Priority | Complexity |
|---|---------|----------|------------|
| 1 | User Country Detection | HIGH | Easy |
| 2 | Domain Filtering by Country | HIGH | Medium |
| 3 | Page Filtering by Country | HIGH | Medium |
| 4 | Table Row Filtering by Country | HIGH | Medium |
| 5 | Product Links (Multi-country) | MEDIUM | Medium |
| 6 | Table Optimization (Large Data) | MEDIUM | Complex |
| 7 | User Country Selection UI | LOW | Deferred |
| 8 | Website Language Selection | LOW | Deferred |

---

## 1️⃣ User Country Detection

### Approach
Use **Vercel's built-in geolocation headers** (FREE, no API calls needed).

### Implementation

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SUPPORTED_COUNTRIES = ['IN', 'US', 'GB', 'AU', 'CA'];
const DEFAULT_COUNTRY = 'US';

export function middleware(request: NextRequest) {
  // Get country from Vercel headers
  const detectedCountry = request.headers.get('x-vercel-ip-country') || DEFAULT_COUNTRY;
  
  // Use detected country if supported, otherwise default
  const userCountry = SUPPORTED_COUNTRIES.includes(detectedCountry) 
    ? detectedCountry 
    : DEFAULT_COUNTRY;
  
  // Check if user already has country cookie
  const existingCountry = request.cookies.get('user-country')?.value;
  
  const response = NextResponse.next();
  
  // Set cookie if not exists
  if (!existingCountry) {
    response.cookies.set('user-country', userCountry, {
      httpOnly: false, // Allow client-side access
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
  }
  
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

### Where Country Comes From
```
User visits site on Vercel deployment
        ↓
Vercel adds header: x-vercel-ip-country: "IN"
        ↓
Middleware reads header
        ↓
Sets cookie: user-country=IN
        ↓
All pages/APIs can read from cookie
```

### Important Notes
- ⚠️ Only works on **Vercel deployment**, not localhost
- VPN users will show VPN server's country
- Accuracy: ~95-99% for country level

---

## 2️⃣ Domain Filtering by Country

### Database Schema Change

```prisma
model Domain {
  id        String   @id @default(uuid())
  name      String
  slug      String   @unique
  pageType  String   @default("direct")
  
  // ... existing fields ...
  
  // NEW: Target countries
  targetCountries  String[]  @default(["ALL"])
  
  category    DomainCategory? @relation(fields: [categoryId], references: [id])
  categoryId  String?
  orderInCategory Int @default(0)
  isPublished Boolean @default(false)
  pages     Page[]
  createdAt DateTime @default(now())
  
  @@index([categoryId, orderInCategory])
}
```

### Filtering Logic

```typescript
// services/domain.service.ts
export const DomainService = {
  getAllForCountry: async (userCountry: string) => {
    return prisma.domain.findMany({
      where: {
        isPublished: true,
        OR: [
          { targetCountries: { has: 'ALL' } },
          { targetCountries: { has: userCountry } }
        ]
      },
      include: { category: true },
      orderBy: [
        { category: { columnPosition: 'asc' } },
        { orderInCategory: 'asc' }
      ]
    });
  }
};
```

### Admin UI Changes
- Add multi-select dropdown in **Domain create/edit form**
- Options: "All Countries", "India", "USA", "UK", "Australia", "Canada"
- Default: "All Countries" (`["ALL"]`)

### Example
```
Domain: "Import/Export Business"
targetCountries: ["IN"]  // Only visible to users from India

Domain: "Graphic Designing"
targetCountries: ["ALL"]  // Visible to everyone
```

---

## 3️⃣ Page Filtering by Country

### Database Schema Change

```prisma
model Page {
  id          String   @id @default(uuid())
  title       String
  slug        String
  contentType String   @default("narrative")
  
  // ... existing fields ...
  
  // NEW: Target countries
  targetCountries  String[]  @default(["ALL"])
  
  domain    Domain   @relation(fields: [domainId], references: [id])
  domainId  String
  parent    Page?    @relation("PageToSubPages", fields: [parentId], references: [id])
  parentId  String?
  subPages  Page[]   @relation("PageToSubPages")
  content   ContentBlock[]
  table     Table?
  richTextContent RichTextContent?
  order     Int      @default(0)
  createdAt DateTime @default(now())

  @@index([domainId, parentId, slug])
}
```

### Filtering Logic

```typescript
// services/page.service.ts
export const PageService = {
  getForDomainAndCountry: async (domainId: string, userCountry: string) => {
    return prisma.page.findMany({
      where: {
        domainId,
        OR: [
          { targetCountries: { has: 'ALL' } },
          { targetCountries: { has: userCountry } }
        ]
      },
      orderBy: { order: 'asc' }
    });
  }
};
```

### Admin UI Changes
- Add multi-select dropdown in **Page create/edit form**
- Same options as Domain
- Default: "All Countries" (`["ALL"]`)

### Example
```
Page: "YouTube Channels" (under Graphic Designing)
targetCountries: ["ALL"]  // Visible to everyone

Page: "Indian Tax Guidelines" (under Import/Export)
targetCountries: ["IN"]  // Only visible to users from India
```

---

## 4️⃣ Table Row Filtering by Country

### Current Flow
1. Admin creates table schema (defines columns)
2. Admin uploads CSV file
3. Data is stored in `Table.data` as JSON
4. UI renders the table

### The Challenge
- 20-30 domains × 30-40 pages each = 600-1200 tables
- Each table: 100-500 rows (can go up to 1000)
- Need to filter rows by country efficiently

### Solution: Mandatory `targetCountries` Column

#### CSV Structure (Required)
Every CSV file MUST have `targetCountries` column (at the end):

```csv
Channel Name,Link,Language,Description,targetCountries
CodeWithHarry,https://youtube.com/...,Hindi,Learn coding in Hindi,IN
Fireship,https://youtube.com/...,English,Quick tutorials,ALL
The Coding Train,https://youtube.com/...,English,Creative coding,ALL
Telusko,https://youtube.com/...,Hindi,Java tutorials,IN
```

#### Upload Process Logic

```typescript
// API: /api/admin/tables/upload
async function processCSVUpload(csvData: string[][], tableSchema: any) {
  const headers = csvData[0];
  const rows = csvData.slice(1);
  
  // Check if targetCountries column exists
  let targetCountriesIndex = headers.findIndex(h => 
    h.toLowerCase().replace(/\s/g, '') === 'targetcountries'
  );
  
  // If not exists, add it
  if (targetCountriesIndex === -1) {
    headers.push('targetCountries');
    targetCountriesIndex = headers.length - 1;
  }
  
  // Process rows
  const processedRows = rows.map(row => {
    const rowData: Record<string, any> = {};
    
    headers.forEach((header, index) => {
      if (header.toLowerCase().replace(/\s/g, '') === 'targetcountries') {
        // Handle targetCountries
        const value = row[index]?.trim();
        rowData.targetCountries = value && value !== '' ? value : 'ALL';
      } else {
        rowData[header] = row[index] || '';
      }
    });
    
    // Ensure targetCountries exists
    if (!rowData.targetCountries) {
      rowData.targetCountries = 'ALL';
    }
    
    return rowData;
  });
  
  return processedRows;
}
```

#### Table Schema Auto-Addition

When admin creates table schema:
1. `targetCountries` column is **automatically added**
2. Admin **cannot remove** this column
3. Column is **hidden from public view** (only used for filtering)

```typescript
// Ensure targetCountries in schema
function ensureTargetCountriesColumn(schema: TableSchema): TableSchema {
  const hasTargetCountries = schema.columns.some(
    col => col.id === 'targetCountries'
  );
  
  if (!hasTargetCountries) {
    schema.columns.push({
      id: 'targetCountries',
      name: 'Target Countries',
      type: 'text',
      isSystem: true,      // System column - can't be removed
      isHidden: true,      // Don't show in public UI
      defaultValue: 'ALL'
    });
  }
  
  return schema;
}
```

#### Frontend Filtering

```typescript
// In table component
function filterRowsByCountry(rows: TableRow[], userCountry: string): TableRow[] {
  return rows.filter(row => {
    const targetCountries = row.targetCountries || 'ALL';
    
    // Handle comma-separated values: "IN,US,GB"
    if (targetCountries.includes(',')) {
      const countries = targetCountries.split(',').map(c => c.trim());
      return countries.includes('ALL') || countries.includes(userCountry);
    }
    
    return targetCountries === 'ALL' || targetCountries === userCountry;
  });
}
```

### Example CSV Files

#### YouTube Channels (with targetCountries)
```csv
Channel Name,Link,Language,Description,targetCountries
CodeWithHarry,https://youtube.com/...,Hindi,Coding tutorials in Hindi,IN
Telusko,https://youtube.com/...,Hindi,Java in Hindi,IN
Fireship,https://youtube.com/...,English,Quick web dev tutorials,ALL
Traversy Media,https://youtube.com/...,English,Web development,ALL
The Net Ninja,https://youtube.com/...,English,Programming tutorials,ALL
```

#### Podcasts (with targetCountries)
```csv
Podcast Name,Link,Language,Description,targetCountries
Full Time Game Dev,https://...,English,Indie game developers,ALL
How to become Game Dev in India,https://...,Hindi,Career in gaming India,IN
Game Developer Podcast,https://spotify.com/...,English,Industry insights,ALL
```

---

## 5️⃣ Product Links (Multi-Country Support)

### The Challenge
- Product links (Amazon, etc.) are country-specific
- Amazon.in links don't work well for US users
- Need to show appropriate links based on user's country

### Solution: Hybrid Approach

#### Option A: Amazon OneLink (Preferred)
Amazon OneLink automatically redirects to user's local Amazon store.

**When to use:**
- Product is available globally on Amazon
- Set `targetCountries: ALL`

```csv
Product Name,Link,Description,targetCountries
Wacom Tablet,https://amzn.to/onelink123,Drawing tablet,ALL
Blue Yeti Mic,https://amzn.to/onelink456,USB microphone,ALL
```

#### Option B: Duplicate Rows (When Needed)
When product/link is country-specific, create separate rows.

**When to use:**
- Product only available in specific countries
- Different products for different markets
- Amazon not available in that country

```csv
Product Name,Link,Description,targetCountries
Wacom One (India),https://amzn.in/d/abc123,Entry tablet for India,IN
Wacom One (US),https://amzn.com/dp/xyz789,Entry tablet for US,US
Wacom One (UK),https://amzn.co.uk/dp/def456,Entry tablet for UK,GB
```

#### Option C: Multi-Link Column (Future Enhancement)
Store multiple links per product:

```csv
Product Name,Link_IN,Link_US,Link_UK,Description,targetCountries
Wacom Tablet,amzn.in/...,amzn.com/...,amzn.co.uk/...,Drawing tablet,ALL
```

**Note:** This requires more complex schema and UI changes. Implement later if needed.

### Recommended Workflow

```
1. Check if Amazon OneLink works for product
   ↓
   YES → Use OneLink, set targetCountries: ALL
   ↓
   NO → Check product availability
         ↓
         Available in multiple countries → Create separate rows
         ↓
         Country-specific product → Single row with specific country
```

---

## 6️⃣ Table Optimization (Large Data)

### Current Situation
- Tables can have 500-1000+ rows
- Currently fetching all data at once
- UI pagination (50-100 per page)

### The Question
> "Does it need optimization? Will fetching time increase as rows grow?"

### Analysis

#### Current Approach (Fetch All)
```
Database → API → All 1000 rows → Frontend → Show 50
```

| Rows | Approx Load Time | Network Size |
|------|------------------|--------------|
| 100 | ~50ms | ~20KB |
| 500 | ~150ms | ~100KB |
| 1000 | ~300ms | ~200KB |
| 2000 | ~500ms+ | ~400KB |

#### Issues with Current Approach
1. **Initial load time** increases with data
2. **Memory usage** - all data in browser memory
3. **Country filtering** - filtering 1000 rows client-side = slow

### Recommended Optimizations

#### Level 1: Server-Side Filtering (MUST DO)
Filter by country on the **server**, not client:

```typescript
// API: /api/tables/[pageId]/data
export async function GET(request: NextRequest) {
  const userCountry = request.cookies.get('user-country')?.value || 'US';
  
  const table = await prisma.table.findUnique({
    where: { pageId },
    select: { data: true }
  });
  
  // Filter on server
  const allRows = table.data.rows;
  const filteredRows = allRows.filter(row => {
    const tc = row.targetCountries || 'ALL';
    return tc === 'ALL' || tc.includes(userCountry);
  });
  
  return NextResponse.json({
    rows: filteredRows,
    totalCount: filteredRows.length
  });
}
```

#### Level 2: Server-Side Pagination (RECOMMENDED)
Only fetch the page user needs:

```typescript
// API: /api/tables/[pageId]/data?page=1&limit=50
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const userCountry = request.cookies.get('user-country')?.value || 'US';
  
  const table = await prisma.table.findUnique({
    where: { pageId },
    select: { data: true }
  });
  
  // Filter by country
  const allRows = table.data.rows;
  const filteredRows = allRows.filter(row => {
    const tc = row.targetCountries || 'ALL';
    return tc === 'ALL' || tc.includes(userCountry);
  });
  
  // Paginate
  const startIndex = (page - 1) * limit;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + limit);
  
  return NextResponse.json({
    rows: paginatedRows,
    totalCount: filteredRows.length,
    page,
    limit,
    totalPages: Math.ceil(filteredRows.length / limit)
  });
}
```

#### Level 3: Virtual Scrolling (FUTURE)
For very large tables (5000+ rows), use virtual scrolling:
- Only render visible rows
- Libraries: TanStack Virtual, react-window

### Optimization Summary

| Level | When to Use | Complexity | Performance Gain |
|-------|-------------|------------|------------------|
| Server-side filtering | Always | Easy | 20-50% |
| Server-side pagination | 500+ rows | Medium | 60-80% |
| Virtual scrolling | 5000+ rows | Complex | 90%+ |

### Recommendation for Now
1. **Implement Level 1 & 2** (Server-side filtering + pagination)
2. **Defer Level 3** until tables grow beyond 5000 rows

---

## 7️⃣ User Country Selection (DEFERRED)

### Decision
> "No need to give user a way to change the country. We decide what to show based on their location (like Netflix)."

### Rationale
- Simpler implementation
- Consistent experience
- Can always add later if needed

### Future Consideration
If needed later, add a small globe icon in header:
```
🌍 India ▼
```

**Status:** DEFERRED - Not implementing now

---

## 8️⃣ Website Language Selection (DEFERRED)

### Decision
> "User can select website language later, not now."

This is different from content language:
- **Content language:** Hindi vs English YouTube channels (filtered by targetCountries)
- **Website language:** UI labels in different languages (i18n)

**Status:** DEFERRED - Will implement later with next-intl or similar

---

## 📊 Database Migration Summary

### Schema Changes

```prisma
// Add to Domain model
model Domain {
  // ... existing fields ...
  targetCountries  String[]  @default(["ALL"])
}

// Add to Page model  
model Page {
  // ... existing fields ...
  targetCountries  String[]  @default(["ALL"])
}

// Table model - no schema change needed
// targetCountries is stored in JSON data column
```

### Migration Command
```bash
npx prisma migrate dev --name add-target-countries
```

---

## 📁 Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `middleware.ts` | Country detection & cookie setting |
| `src/lib/countries.ts` | Country constants & helpers |
| `src/hooks/useUserCountry.ts` | Client-side country hook |

### Files to Modify
| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add targetCountries fields |
| `Domain create/edit form` | Add country selector |
| `Page create/edit form` | Add country selector |
| `Table upload API` | Auto-add targetCountries column |
| `Table schema creation` | Force targetCountries column |
| `Domain listing API` | Filter by country |
| `Page listing API` | Filter by country |
| `Table data API` | Filter rows by country |
| `TableLayout component` | Use filtered data |

---

## ✅ Implementation Checklist

### Phase 1: Foundation
- [ ] Update Prisma schema (Domain + Page)
- [ ] Run migration
- [ ] Create country constants file
- [ ] Create middleware for detection
- [ ] Test detection on Vercel

### Phase 2: Domain & Page Filtering
- [ ] Update Domain admin form (add country selector)
- [ ] Update Page admin form (add country selector)
- [ ] Update domain listing API with filtering
- [ ] Update page listing API with filtering
- [ ] Test filtering works correctly

### Phase 3: Table Row Filtering
- [ ] Update table schema creation (auto-add targetCountries)
- [ ] Update CSV upload to handle targetCountries
- [ ] Update table data API with server-side filtering
- [ ] Update TableLayout to use filtered data
- [ ] Add server-side pagination
- [ ] Test with sample data

### Phase 4: Testing & Refinement
- [ ] Test all flows with different countries
- [ ] Test CSV upload with/without targetCountries column
- [ ] Test large table performance
- [ ] Deploy and test on Vercel

---

## 🔗 Related Documents
- [Architecture Improvements Plan](./ARCHITECTURE-IMPROVEMENTS-PLAN.md)
- [Comprehensive Project Analysis](./COMPREHENSIVE-PROJECT-ANALYSIS.md)

---

*This document will be updated as implementation progresses.*

