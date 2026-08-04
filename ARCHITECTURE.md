# 🏛️ ATNO — System Architecture

**Written:** 4 August 2026
**Branch audited:** `dev-3.0` @ `1ebba3a`
**Scope:** Full read-through of the schema, services layer, middleware, auth, all four
caching layers, both rendering paths, the whole API surface, and the planning docs.

> **What this document is:** a description of the system **as it is actually built**.
>
> **What it is not:** a plan. The plans live in `ARCHITECTURE-IMPROVEMENTS-PLAN.md`,
> `ARCHITECTURE-IMPROVEMENTS-2.md`, `MASTER-TASK-LIST.md` and
> `REORDERED-EXECUTION-PLAN.md`. The findings-and-fixes log lives in
> `NEW-IMPROVEMENTS.md`. Read **this** file to understand how the thing works; read
> **those** to understand what is still to be done and why past decisions were made.
>
> ⚠️ `MASTER-TASK-LIST.md` shows every box unticked but almost all of it is done —
> `REORDERED-EXECUTION-PLAN.md` superseded it and is the one that tracks reality.

---

## Table of contents

1. [What the product is](#1-what-the-product-is)
2. [Stack](#2-stack)
3. [The data model — the key to everything](#3-the-data-model--the-key-to-everything)
4. [Two applications in one codebase](#4-two-applications-in-one-codebase)
5. [The layered architecture](#5-the-layered-architecture)
6. [Request lifecycle — a public page load](#6-request-lifecycle--a-public-page-load)
7. [Navigation architecture — the "1 API call" design](#7-navigation-architecture--the-1-api-call-design)
8. [Caching — four independent layers](#8-caching--four-independent-layers)
9. [Geo-targeting](#9-geo-targeting)
10. [Security](#10-security)
11. [SEO layer](#11-seo-layer)
12. [Admin panel](#12-admin-panel)
13. [Where the project stands](#13-where-the-project-stands)
14. [Things that will bite you](#14-things-that-will-bite-you)

---

## 1. What the product is

A **curated directory / content-catalogue site** — ATNO, live at `atno.io`. A visitor
browses nested categories and lands on pages that are mostly **data tables** (curated
tool lists, YouTube channels, resources) or **rich text**. An **admin CMS** authors all
of it, and content is **geo-targeted**: an Indian visitor and an American visitor can
legitimately see different rows in the same table.

Scale, measured against production:

| Thing | Count |
| --- | --- |
| Domains | ~33 |
| Pages | ~1,198 |
| Tables | ~652 (~8,076 rows total, ~12 rows/table) |
| Rich-text pages | ~418 (3.4 MB of HTML) |
| `ContentBlock` rows | **0** — the model is unused |

This is a real dataset, not a toy. Several architectural decisions only make sense at
this scale, and are called out where that matters.

---

## 2. Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15.5.9, App Router, React 19.1, Turbopack |
| Language | TypeScript, Tailwind v4 |
| UI | shadcn/ui on Radix, lucide-react icons, TanStack Table v8 |
| Database | PostgreSQL (Neon) via Prisma 6, client generated to `src/generated/prisma` |
| Auth | Auth.js v5 beta (NextAuth), Credentials provider, **JWT sessions** |
| Editor / data | Lexical (rich text), Papaparse (CSV), isomorphic-DOMPurify (sanitising) |
| Hosting | Vercel — uses `x-vercel-ip-country`, edge middleware, `VERCEL_ENV` |

Node is pinned in `.nvmrc` (`>=22.12.0` in `package.json` `engines`). That pin is not
cosmetic — an unpinned Node version took every rich-text admin route down in production
(finding #23).

---

## 3. The data model — the key to everything

`prisma/schema.prisma` defines a **4-level content tree**:

```
DomainCategory   "Design & Creative"   ← laid out in a 3-column grid
  └── Domain     "Graphic Designing"   ← pageType: 'direct' | 'hierarchical'
        └── Page  (self-referencing parentId → arbitrary depth, 1–4 in practice)
              ├── Table            (1:1 — schema + data + settings, all JSON)
              ├── RichTextContent  (1:1 — raw HTML + plainText + wordCount)
              └── ContentBlock[]   ← ⚠️ UNUSED. 0 rows in production.
```

Plus the auth models: `User`, `Account`, `Session`, `VerificationToken`.

Three ideas must be internalised before anything else makes sense.

### (a) `Domain.pageType` decides the shape of the URL tree

| pageType | Domain root renders | Top-level pages have |
| --- | --- | --- |
| `direct` | content immediately (`SectionBasedLayout`) | `parentId = <the __main__ page's id>` |
| `hierarchical` | a subcategory picker (`SubcategorySelector`) | `parentId = null` |

A `direct` domain owns a **synthetic `__main__` page** that holds its root layout in
`Page.sections`.

> ⚠️ **`__main__` is a real row but NOT a real URL.** `/domain/gdesign/__main__` does not
> exist; that content is served at `/domain/gdesign`. This single fact ripples through
> path building, the sitemap, breadcrumbs and `PageService.getByPath`. Every traversal
> must skip it.

**Who creates `__main__`:** only admin **write** paths, each of which checks for an
existing row first — `POST /api/admin/domains`, the `hierarchical → direct` switch in
`PUT /api/admin/domains/[id]`, and `POST /api/admin/pages`. It used to be created
lazily by the **public page renderer**, meaning an anonymous `GET` (including every
Googlebot crawl) could insert a row. That was removed in finding #11 — do not
reintroduce a create-on-read path.

### (b) `Page.contentType` decides which React component renders it

A plain string, dispatched in a `switch` at `src/app/domain/[...slug]/page.tsx:407`:

| contentType | Renderer | Content lives in |
| --- | --- | --- |
| `section_based` | `SectionBasedLayout` | `Page.sections` (same row) |
| `subcategory_list` | `SubcategorySelector` | the child `Page` rows |
| `table` | `TableLayout` → TanStack `DataTable` | `Table.data` (child row) |
| `rich_text` | `RichTextLayout` (`dangerouslySetInnerHTML`) | `RichTextContent` (child row) |
| anything else | `NarrativeLayout` | — |

> ⚠️ **91.7% of pages keep their content in a CHILD row.** That is why
> `Page.updatedAt` alone is the wrong answer for sitemap `lastmod` — see §11.

### (c) `targetCountries` exists at three levels

- `Domain.targetCountries String[]` — `["ALL"]` by default
- `Page.targetCountries String[]` — same
- a **hidden `targetCountries` column inside table row JSON** — supports
  comma-separated `IN,US,GB`

### ⚠️ Slugs are only unique within a parent, not within a domain

Measured: **83 `(domain, slug)` pairs have more than one page, covering 192 pages —
16.5% of the catalogue.** `/domain/appdev` alone has `ytube`, `courses`, `podcasts`,
`fonts`, `colors` and `networking` each appearing **three times** under different
parents. In 20 cases the titles genuinely differ (`facebookgroups` exists as both
"🐼 Facebook Groups" and "🍀 Facebook Groups").

**Any code that resolves a slug must walk the parent chain.** Matching by slug alone
returns whichever row Postgres hands back first — a coin flip. This caused a real
breadcrumb bug; see §7.

---

## 4. Two applications in one codebase

```
src/app/
├── page.tsx                  → 308 PERMANENT redirect to /domain (see §11)
│
├── domain/                   ─── PUBLIC SITE ───
│   ├── layout.tsx            → sidebar + breadcrumb bar + PageContextProvider
│   ├── page.tsx              → domain index (the de-facto homepage)
│   ├── [...slug]/page.tsx    → catch-all: renders EVERY public content page
│   ├── error.tsx             → error boundary inside the domain layout
│   └── not-found.tsx         → 404 that KEEPS the sidebar
│
├── admin/                    ─── CMS ─── 8 screens
│   ├── layout.tsx            → SessionProvider + AdminLayout
│   ├── page.tsx              → dashboard
│   ├── categories/ domains/ pages/ sections/
│   ├── tables/ (list · new · [id])
│   ├── rich-text/ (list · edit/[pageId])
│   └── users/ (list · new · edit/[id])
│
├── login/ · unauthorized/
│
├── api/
│   ├── page-context/         → ONE endpoint feeding all client navigation
│   ├── domain/tables/by-page/[pageId]/  → public table rows
│   ├── admin/*               → 14 route files, 36 handlers, full CRUD
│   └── auth/[...nextauth]/ · auth/logout/
│
├── sitemap.ts · robots.ts    → SEO
├── error.tsx · global-error.tsx · not-found.tsx
└── favicon.ico · apple-icon.png
```

**The entire public URL space is served by one catch-all route:**
`/domain/[...slug]`.

### The full API surface

| Route | Methods |
| --- | --- |
| `/api/page-context` | GET |
| `/api/domain/tables/by-page/[pageId]` | GET |
| `/api/admin/categories` · `/[id]` | GET POST · GET PUT DELETE |
| `/api/admin/domains` · `/[id]` | GET POST · GET PUT DELETE PATCH |
| `/api/admin/pages` · `/[id]` | GET POST · GET PUT DELETE |
| `/api/admin/sections/[id]` | GET PUT |
| `/api/admin/tables` · `/[id]` · `/[id]/data` | GET POST · GET PUT DELETE · GET PUT DELETE |
| `/api/admin/rich-text` · `/[pageId]` | GET POST · GET PUT DELETE |
| `/api/admin/users` · `/[id]` | GET POST · GET PUT DELETE |
| `/api/auth/[...nextauth]` · `/api/auth/logout` | (NextAuth) · POST |

Four navigation endpoints (`/api/sidebar`, `/api/header-domains`, `/api/breadcrumb`,
`/api/page-sidebar`) and `/api/debug/cache-test` **were deleted** in Phase C. The
blanket `Disallow: /api/` in `robots.ts` is deliberately written so that routes coming
and going needs no maintenance.

---

## 5. The layered architecture

```
Browser
  │
  ▼
middleware.ts  ── EDGE: geo cookie + admin authz  (runs on ~every request)
  │
  ▼
Page (React Server Component)  ─or─  API route handler
  │
  ▼
src/services/   ★ the only place allowed to READ via Prisma
  │             DomainService · PageService · CategoryService · TableService
  │             NavigationService  ← composes the other three, touches no Prisma directly
  ▼
src/lib/prisma.ts  ── singleton client
  │
  ▼
Postgres (Neon)
```

The **services layer** (`src/services/`) is the architectural centrepiece:

- every method is wrapped in **two** caches (§8)
- every method returns a **narrow, hand-written type** from `src/services/types.ts` —
  not a raw Prisma row
- country filtering is applied inside the service, not by callers

`NavigationService` deliberately touches no Prisma directly; it composes
`DomainService`, `PageService` and `CategoryService`.

> **Admin WRITE paths deliberately bypass the services layer** and call Prisma directly
> inside the route handler, then call an invalidation helper from
> `src/lib/cache-invalidation.ts`. Reads go through services; writes go direct.

### Supporting `src/lib/`

| File | Purpose |
| --- | --- |
| `prisma.ts` | singleton client (a `new PrismaClient()` per route was finding #6) |
| `auth.ts` | NextAuth config, lockout, timing-attack fix |
| `api-auth.ts` | `requireAdmin()` guard — layer 2 of authz |
| `cache.ts` | durations, tag taxonomy, HTTP header builders |
| `cache-invalidation.ts` | the three `revalidateTag` helpers |
| `countries.ts` | supported countries, names, flags, parsing |
| `server-country.ts` | `buildCountryFilter()` + the three country readers |
| `page-path.ts` | ★ **the one** parent-chain URL builder |
| `seo.ts` | `SITE_URL`, `SITE_NAME`, `TITLE_SEPARATOR`, OG/Twitter builders |
| `structured-data.ts` | JSON-LD builders (Organization, BreadcrumbList) |
| `sanitize-html.ts` | DOMPurify config for rich-text writes |
| `table-utils.ts` | schema/row helpers, CSV transform, country filtering |
| `export-table.ts` | CSV / JSON export |
| `password.ts` | bcrypt wrapper |
| `utils.ts` | `cn()` |

---

## 6. Request lifecycle — a public page load

Walking `/domain/webdev/withcode/ytube`:

**1. `middleware.ts` (edge).** Resolves the country from `x-vercel-ip-country`, decides
whether the `user-country` cookie needs writing, runs the admin check if the path
warrants it, then returns through a `withCountry()` wrapper.

> ⚠️ **Why `withCountry()` exists.** Middleware works by *returning* a response, and
> there are several different things it might return (continue / redirect / 401 JSON).
> The previous version set the cookie on a `NextResponse.next()` object and then
> returned a **different** redirect object — silently dropping it. A first-time visitor
> landing on `/admin` got bounced to `/login` with no country cookie. Routing every
> `return` through one helper makes "don't forget the cookie" **structural** instead of
> something you must remember at each exit.

**2. `generateMetadata()` runs.** Fetches domain + page, builds title, description,
canonical, Open Graph, `robots`.

**3. `DomainPage()` runs.** Fetches the **same** data — and costs **zero extra
queries**, because every service method is wrapped in React `cache()`, a per-request
memo.

> ⚠️ **Only if the arguments match exactly.** `cache()` keys on the argument list and
> compares object arguments **by reference**. Two separate `segments.slice(2)` calls
> produce arrays with identical contents but different references, so
> `['ytube'] !== ['ytube']` and the memo misses — silently doubling the query count.
> `NavigationService.getPageContext` threads one shared `pageSegments` array through for
> exactly this reason, and the comment in `generateMetadata` warns that its calls are
> *deliberately identical* to the component's.

**4. `PageService.getByPath()` resolves the path in one batch query** — fetch every page
whose slug appears in the path, then walk the parent chain **in memory**, requiring each
page to be a child of the previous one. (This replaced an N+1 loop with one query per
segment.) A per-level fallback exists for paths the batch cannot resolve.

**5. Country visibility check** → `notFound()` if the domain or page is invisible.

**6. Render.** BreadcrumbList JSON-LD + the layout component for that `contentType`.

> ⚠️ The body is assigned to `let content` and returned **once** at the bottom, rather
> than returned from each of six branches. Wrapping six separate returns in a fragment
> alongside `<JsonLd>` would be six chances to forget one — and a missing JSON-LD block
> is invisible: nothing renders and no error occurs.

**7. Client-side, after hydration.** The layout's `PageContextProvider` fires **one**
`fetch('/api/page-context?path=…&country=…')` to build the sidebar and header. On a
`table` page, `TableLayout` fires a second fetch for the rows.

**Net: 1 SSR render + 1–2 client fetches per page view.**

---

## 7. Navigation architecture — the "1 API call" design

The project's biggest refactor. Originally four endpoints and four hooks:

```
BEFORE   /api/header-domains + /api/sidebar + /api/page-sidebar + /api/breadcrumb
         useHeaderData + useSidebarData + usePageSidebarData + useBreadcrumbData
         = 4 API calls per page load

AFTER    /api/page-context  →  NavigationService.getPageContext()
         usePageContext()   →  PageContextProvider  →  every nav component
         = 1 API call per page load
```

`src/hooks/usePageContext.ts` is smarter than a plain fetch:

- **Static data** (header + sidebar) is fetched **once on mount**, guarded by a ref.
- **Page sidebar** is refetched only when the *parent context* changes — and what counts
  as the parent context **depends on `pageType`**: for `direct` domains it is the
  domain; for `hierarchical` it is `domain/firstLevelPage`.
- The same rule drives `sidebarMode` (`'domain'` vs `'page'`), which flips at **3
  segments for direct** and **4 for hierarchical**.
- **The breadcrumb is derived client-side** from `usePathname()` — no fetch at all.

### Why `getPageContext(path, country, includeBreadcrumb = false)`

The server used to compute breadcrumb data unconditionally on the **hottest endpoint in
the app**, and **every consumer threw it away** — `usePageContext` hardcodes
`breadcrumb: { items: [] }` in two places, and `bread.tsx` never destructures it. Three
database round-trips per request, one an uncached raw query, queried → serialised →
transmitted → discarded.

It is kept as an *option* rather than deleted because the server version is the correct
source for JSON-LD `BreadcrumbList` — which is where it is used now, on the page render
instead of the API.

### ⚠️ The parent-chain fix in `buildBreadcrumbData`

Worth reading in full (`src/services/navigation.service.ts:534`). The old code was:

```ts
const pageData = allPagesInPath.find(p => p.slug === slug)   // ← WRONG
```

With 83 ambiguous slugs, **20 of 1,163 paths resolved to a different page's title** —
`websitebuilders` reported "AI Website Builders" for a page actually called "Website
Builders (CMS)". It also ignored `targetCountries`, so a page invisible to the visitor
could still supply a label.

The fix reproduces `getByPath`'s traversal: start at the domain root, step down one
segment at a time, require each page to be a **child of the previous one**. Still one
query — `__main__` is added to the slug list so a `direct` domain's root id arrives in
the same result set, and the chain is resolved in memory.

**Feeding the broken labels to Google would have been worse than emitting nothing, which
is why this fix landed before the JSON-LD did.**

---

## 8. Caching — four independent layers

| Layer | Mechanism | Lifetime | Purpose |
| --- | --- | --- | --- |
| Request | React `cache()` | one render | dedupe layout + page + metadata asking the same thing |
| Cross-request | `unstable_cache()` | 60s / 300s | Next **Data Cache** — the one that stops hitting Postgres |
| HTTP / CDN | `Cache-Control` | `s-maxage=60`, `stale-while-revalidate=300` | Vercel edge |
| Page | ISR `revalidate` | 60s | ⚠️ **currently defeated by `force-dynamic`** — see §13 |

Durations and the tag taxonomy live in `src/lib/cache.ts`:

```
SHORT 30s · MEDIUM 60s · LONG 300s · STATIC 3600s
```

### Which tags actually have subscribers

There are **10 `unstable_cache` wrappers** in the app, subscribing to **5 real tags**:

| Tag | Cached entries subscribing to it |
| --- | --- |
| `DOMAINS` | `domains-all`, `domain-by-slug`, `domain-with-pages`, `domains-navigation` |
| `PAGES` | `page-main`, `page-by-id`, `domain-with-pages`, `table-by-page` |
| `CATEGORIES` | `categories-active`, `category-by-slug`, `category-by-id` |
| `NAVIGATION` | `domains-navigation` |
| `TABLES` | `table-by-page` |

> ⚠️ The other seven definitions in `CACHE_TAGS` — `DOMAIN(slug)`, `PAGE(id)`, `HEADER`,
> `SIDEBAR`, `BREADCRUMB`, `TABLE(id)`, `COUNTRY(code)` — have **no subscribers**.
> Calling `revalidateTag` with any of them **looks like it does something and does
> not.** They are kept for future use; do not mistake them for working invalidation.

### Invalidation

`src/lib/cache-invalidation.ts` exposes three **deliberately over-broad** functions,
called from **15 sites across 13 mutating handlers in 9 route files**:

| Function | Clears |
| --- | --- |
| `invalidateDomains()` | DOMAINS + PAGES + NAVIGATION |
| `invalidatePages()` | PAGES + DOMAINS + NAVIGATION + TABLES |
| `invalidateCategories()` | CATEGORIES + DOMAINS + NAVIGATION |

The reasoning is an **asymmetry**: over-invalidating costs one extra query on the next
request; under-invalidating shows a user stale data with no way to fix it. The tag graph
is small and highly interconnected, so surgical invalidation buys almost nothing and
risks missing a dependency.

> ⚠️ `revalidateTag` clears Next's **Data Cache only**. It does **not** clear HTTP/CDN
> caches, and it is **powerless against a statically prerendered page** (see finding
> #20 in §12).

### The two CDN-cache fixes worth understanding

Both hot endpoints — `/api/page-context` and `/api/domain/tables/by-page/[pageId]` —
had a subtle, **total** cache failure:

```
BEFORE:   country read from cookie   +   'Vary: Cookie'
```

`Vary: Cookie` keys the cache on the **entire** Cookie header. A real visitor's looks
like:

```
Cookie: user-country=IN; authjs.session-token=eyJhbGciOiJkaXIi…; _ga=GA1.1.882471.17
```

Session tokens and analytics IDs are unique per person, so **every single visitor minted
a unique cache key.** The CDN stored a private copy for each one and never reused a
single entry. **The cache was perfectly correct and hit 0% of the time** — every request
still ran the function and queried Postgres.

The fix moves the country into the **query string**:

```
/api/page-context?path=/domain&country=IN   ← one entry, shared by all IN visitors
/api/page-context?path=/domain&country=US   ← one entry, shared by all US visitors
```

Key space becomes `(supported countries) × (paths)` instead of one key per human being.
And the two things are **tied together deliberately**:

| Country source | Cacheability |
| --- | --- |
| in the URL, and **recognised** | shareable → `public, s-maxage=60, stale-while-revalidate=300` |
| from the cookie (fallback) | personal → `private, no-store` |

Both routes send `X-Country-Source: url \| cookie` as a debug aid, so "why is my hit rate
low?" is a one-line check in devtools rather than a guess.

> ⚠️ **The param is validated against a whitelist, not trusted.** Without that,
> `?country=<random>` mints a fresh CDN entry every time — anyone could evict everything
> useful, and each miss costs a function invocation plus a database round trip.

> ⚠️ **Why it is safe for the client to name its own country.** `targetCountries` exists
> for **relevance, not access control**. Nothing is protected by it; hand-editing
> `?country=IN` just shows you Indian rows. **If that ever stops being true, this
> approach must be revisited** — the country would become a security boundary and a
> client-supplied value could not define it.

### The safest cache-key decision in the codebase

`src/services/table.service.ts` caches the **unfiltered** table, **country-independent**,
and filters **after** the cache, per request:

```
getTableFromDB(pageId)             ← unstable_cache, NO country in the key
        ↓
filterRowsByCountry(rows, country) ← runs fresh on every call
        ↓
getPublicSchema / getPublicRows    ← strips the internal targetCountries column
```

Two wins over the obvious `unstable_cache(fn, [pageId, country])`:

1. **Country cannot leak.** There is no country-specific value in the cache to hand to
   the wrong person.
2. **One entry per table** instead of one per (table × country) — 6× fewer entries, so
   the cache warms faster and evicts less.

The in-memory filter costs ~12 rows.

> ⚠️ **Do not "optimise" this by moving the filter inside the cache.** That is precisely
> how one country's rows get served to another.

---

## 9. Geo-targeting

```
Vercel edge → x-vercel-ip-country → middleware → user-country cookie
                                                 (30d · httpOnly:false · sameSite lax)
                                                        │
              ┌─────────────────────────────────────────┼──────────────────────────┐
              ▼                                         ▼                          ▼
     Server Components                           API routes              Client components
  getUserCountryFromCookies()          getUserCountryFromRequest()   getUserCountryFromCookie()
              └──────────────────► buildCountryFilter(country) ◄────────────────┘
                            OR: [ { has: 'ALL' }, { has: country } ]
```

| Constant | Value |
| --- | --- |
| `SUPPORTED_COUNTRIES` | `IN, US, GB, AU, CA` |
| `DEFAULT_COUNTRY` | `US` |
| `ALL_COUNTRIES` | `ALL` |

Germany (`DE`) falls back to `US`, meaning those visitors see `ALL` + `US` content.
**Intentional, not an oversight** (finding #15).

### Three design decisions worth knowing

**(a) It re-detects on every request, and writes the cookie only when the value
changed.** Both halves matter:

- There is **deliberately no country switcher in the UI** — a recorded product decision
  (each visitor should feel the site was built for their market). So when detection is
  wrong (VPN, corporate proxy, carrier routing), re-detection is the **only correction
  the design permits.** It is not an optimisation.
- Returning `null` on no-change means a settled visitor gets **zero `Set-Cookie`
  headers** after their first request. `Set-Cookie` can stop shared caches storing a
  response, which now matters directly (§8).
- It is **free**: `x-vercel-ip-country` is already on every request, and the middleware
  already runs on every request. The old `if (existingCountry) return null` was never a
  performance measure.

**(b) There is a deliberate local-dev escape hatch.** With **no geo header** (localhost)
*and* an existing cookie, `resolveCountryCookie` returns `null` and leaves the value
alone. That is what allows hand-setting `user-country=IN` in DevTools → Application →
Cookies to test the Indian view locally. **Overwriting it with `DEFAULT_COUNTRY` every
request would make local geo testing impossible.**

**(c) Row-level geo works differently from domain/page geo.** Domain and page use a
Postgres `String[]` and a Prisma `has` filter. Table rows use a **hidden column inside
the JSON**, supporting comma-separated `IN,US,GB`, filtered in memory and **stripped
from both the schema and the rows** before leaving the server (`getPublicSchema` /
`getPublicRows` in `src/lib/table-utils.ts`).

### ⚠️ Geo drives an SEO rule

The sitemap lists **only `ALL`-targeted content**, and geo-restricted pages get
`noindex` via `isGloballyIndexable()`. A sitemap is a single global document with no
country context, so listing a URL that 404s for most of the world reads to Google as a
**soft 404** — a quality problem (finding #15.4). For a nested page, **both** the domain
and the page must be globally targeted for the URL to be indexable, which prevents a
soft-404 chain.

---

## 10. Security

**Defence in depth, two independent layers** — and there is a real story here.

### The original hole

The middleware only checked `pathname.startsWith('/admin')`. The string
`"/api/admin/domains/123"` starts with `"/api/admin"`, **not** `"/admin"`. So **every
admin API route was completely unauthenticated.** Anyone on the internet could call:

```
DELETE /api/admin/domains/<id>       → deletes a domain AND every page in it
PUT    /api/admin/tables/<id>/data   → wipes an entire table's rows
```

The middleware was **already running** on those requests — the `matcher` only excludes
`api/auth`, static assets and images. The matcher was never the bug; the `startsWith`
condition was.

### The two layers now

| Layer | Where | Covers |
| --- | --- | --- |
| **1** | `src/middleware.ts` | one choke point; catches every `/admin` **and** `/api/admin` request automatically, including route files not yet written |
| **2** | `requireAdmin()` in `src/lib/api-auth.ts` | an explicit guard inside all 36 handlers |

**Why layer 2 is not redundant paranoia:** layer 1 can silently stop working. If someone
edits the `matcher` regex, or a handler is invoked in a way that bypasses middleware (a
Server Action, a direct function import, a future Next.js change), the route is wide
open with no warning. Layer 2 costs ~1 ms — it verifies a JWT already in the cookie, no
database query.

### 401 vs 403 vs never-redirect

| Situation | Page route | API route |
| --- | --- | --- |
| Not logged in | redirect to `/login?callbackUrl=…` | **401** JSON `Authentication required` |
| Logged in, not admin | redirect to `/unauthorized` | **403** JSON `Admin access required` |
| Admin but `isActive: false` | redirect to `/login?error=…` | **403** JSON `Account is inactive` |

401 means *"I don't know who you are"*; 403 means *"I know exactly who you are, and you
still may not do this"* — retrying or re-logging-in would change nothing, which is why
it is not a 401.

> ⚠️ **Why an API must never be redirected.** `fetch()` follows redirects transparently.
> A redirect to `/login` means: fetch quietly receives the login **page**, the final
> status is **200** so `response.ok` is `true` and the error check passes, then
> `response.json()` chokes on `<!DOCTYPE html>` and throws `Unexpected token '<'`. **The
> real problem — not logged in — disappears entirely behind a JSON parse error.**

The `isActive` check exists because `DELETE /api/admin/users/[id]` is a **soft delete**
(sets `isActive = false`). Without it, a deactivated admin would keep full access until
their 24-hour JWT expired.

### Login hardening (`src/lib/auth.ts`)

**(a) A user-enumeration timing side channel — closed.** The previous version returned
`null` immediately when the email was unknown, **before** running bcrypt:

```
unknown email                →  one indexed SELECT               ~5 ms
real email, wrong password   →  SELECT + bcrypt compare        ~438 ms   (measured)
```

An **~85× gap** is trivially observable over the network, so anyone could discover which
emails have accounts just by timing responses — no successful login required. The fix is
`DECOY_PASSWORD_HASH`: a **genuine cost-12 bcrypt hash** of an impossible password,
compared when no user exists, so both paths do the same expensive work.

It must be a real hash — a fake string would make `bcrypt.compare` fail fast on parsing
and the gap would reopen. `isActive` is checked **after** bcrypt for the same reason; an
early return there leaked deactivated-account status identically.

**(b) Account lockout** — 5 consecutive failures → 15 minutes:

| Decision | Why |
| --- | --- |
| Stored in **Postgres**, not memory | Vercel runs serverless; each instance has separate memory, cold starts reset a counter, and an attacker spreading guesses across concurrent connections would never trip it. Postgres is the one piece of state every instance shares. |
| **Per-account**, not per-IP | IPs rotate cheaply (proxies, mobile networks), which defeats IP limits. Locking the *account* does not care where guesses come from. |
| An **expiry timestamp**, not a boolean | The lock releases itself — no scheduled job needed to unlock accounts. |
| **Not permanent** | A permanent lock hands an attacker a DoS against the real admin, lockable by simply guessing wrong five times on purpose. |

The maths: 5 attempts per 15 minutes gives an attacker **480 guesses/day** instead of
the ~200,000 bcrypt's cost alone allowed.

> ⚠️ **One acknowledged trade-off.** The `locked-<minutes>` error code **reveals that an
> account exists** — exactly what the timing fix prevents elsewhere. It is the right
> call anyway: an admin who is locked out and told only "invalid credentials" will keep
> retrying, believe their password is broken, and have no idea to simply wait. Reaching
> this state already requires five failures.

`SignInFailure extends CredentialsSignin` exists because returning `null` from
`authorize()` produces one generic error with no detail — there would be no channel to
explain a lockout at all.

### Stored XSS (`src/lib/sanitize-html.ts`)

`RichTextLayout` renders stored HTML with `dangerouslySetInnerHTML`, so whatever is
stored executes in every visitor's browser on the same origin as the admin panel.
Finding #1 closed the worst version (the write endpoint was unauthenticated). What
remains is bounded by sanitising.

> ⚠️ **Sanitise on WRITE, never on READ.** Every read path is cached
> (`unstable_cache`, CDN, ISR). One bad write cleaned only at render time would be
> re-served from cache indefinitely, and **every** cache layer would have to be trusted
> to call the sanitiser. Cleaning once at the boundary means the database only ever
> holds safe HTML.

**The allow-list was derived by scanning all 415 existing rows, not guessed.** Two
findings changed the file:

- `details` / `summary` — **52 uses each** (collapsible sections). A standard allow-list
  omits them, which would have collapsed 52 working disclosure widgets into loose text.
- `style` — **28,608 uses across 407 of 415 rows (98%)**. Inline styles are the
  *primary* formatting mechanism here, not classes. Dropping `style` would have
  flattened essentially every rich-text page on the site.

**Every `on*` event handler is removed**, without exception. The content contains 398
(`onmouseover`/`onmouseout` hover colours on 4 pages). Those are benign, but an
allow-list cannot distinguish a harmless `onmouseover` from
`onmouseover="fetch('/api/admin/users',{method:'POST',…})"`. The hover effect is
replaced by CSS in `globals.css` — which is *better* than the original, because it
applies to every link rather than only the 4 pages that had handlers.

Result over the real content: **0.41% fewer bytes, zero tags lost.**

#### ⚠️ Three DOMPurify traps, all found by testing rather than reading docs

1. **`USE_PROFILES` is mutually exclusive with `ALLOWED_TAGS`/`ALLOWED_ATTR`.** Setting
   it makes DOMPurify **ignore both lists** and substitute its own. An earlier version
   set `USE_PROFILES: { html: true }` intending to block SVG/MathML; the effect was the
   opposite of intended — `target` was stripped from all 541 links, and `<form>` /
   `<input>` **survived**.
2. **`#text` must be listed in `ALLOWED_TAGS`.** DOMPurify treats text nodes as a
   pseudo-tag. Omit it with `KEEP_CONTENT: false` and **every piece of visible text is
   destroyed** — an earlier version dropped 49% of the content's bytes with every tag
   intact and every word gone.
3. **A `/g` regex used with `.test()` is stateful.** It advances `lastIndex` and resumes
   from there, so alternating inputs make it miss matches. `DANGEROUS_CSS` deliberately
   has **no `g` flag**.

Also: `ADD_URI_SAFE_ATTR: ['target']` is **required**, or `ALLOWED_URI_REGEXP` silently
deletes `target` from all 541 links — `_blank` does not match a URL pattern.

---

## 11. SEO layer

Originally **every URL on the site returned the identical `<title>`**:
`ATNO - Domain Explorer`. `/domain/genai/videogen`, `/domain/appdev/ios`,
`/domain/webdev/withcode` — all the same. The `<title>` is the single strongest on-page
ranking factor, and site-wide duplicate titles are a direct quality problem.

### `src/lib/seo.ts` — single source of truth

| Export | Value / purpose |
| --- | --- |
| `SITE_NAME` | `'ATNO'` |
| `SITE_URL` | `'https://atno.io'` — **hardcoded, https** |
| `TITLE_SEPARATOR` | `' · '` (U+00B7) |
| `buildOpenGraph()` / `buildTwitter()` | builders, not inline objects |
| `stripEmoji()` · `truncate()` · `htmlToText()` | title/description hygiene |
| `isGloballyIndexable()` | the geo → `noindex` rule |

**Why builders rather than inline objects:** Next.js merges metadata **shallowly**. A
page defining `openGraph` **replaces** the layout's object entirely rather than merging
into it — so any field omitted (`og:type`, `og:site_name`, `og:locale`) silently
disappears from the rendered head. Going through one builder guarantees the full set.

**Why the separator is `·` and not `|`:** six domain names contain literal pipes as
*content* — `🌻 AI | ML | DL [ Traditional ]`, `👨‍💻 Cybersecurity | Hacking`. With `|` as
the separator the structure is indistinguishable from the content and a search result
reads as noise.

**Why `SITE_URL` is hardcoded:** production is served on **two hostnames** — `atno.io`
and `nested-two.vercel.app`. If canonicals were derived from whichever host answered,
Google would see two complete independent copies of the site, call it duplicate content,
and **split the ranking signals**. Pinning it means both hostnames emit
`https://atno.io/...`.

### ⚠️ Two metadata traps recorded in the code

- **`alternates.canonical` is deliberately NOT set in the root layout.** Because
  metadata is inherited, a canonical there would be adopted by every page that does not
  set its own — dozens of distinct URLs all telling Google "the real version of me is
  `https://atno.io/`". Google would drop them as duplicates of the home page. **That is
  a genuinely common way to accidentally deindex a whole site.** Canonicals must be
  per-page.
- **`metadataBase` alone does not emit a canonical tag.** It only decides what relative
  URLs expand to. The tag comes from `alternates.canonical`, which each page sets.
  **Both halves are required.**
- **Declaring an `icons` object suppresses the file-convention `apple-touch-icon` tag**
  (while inconsistently leaving `favicon.ico` in place). Without an explicit
  `icons.apple` entry, `src/app/apple-icon.png` is still built and served but nothing in
  the HTML points at it, so iOS falls back to a page screenshot. *Found by diffing the
  rendered `<head>` against the build output, not from the docs.* Once you take manual
  control of a metadata field, you own **all** of it.

### `robots.ts`

- **Non-production returns `Disallow: /` and returns early.** Every PR creates a
  publicly reachable preview serving a full copy of the site; without this you compete
  against yourself across half a dozen `*.vercel.app` hostnames. Gated on `VERCEL_ENV`,
  which is `undefined` under plain `npm run dev` — so localhost is treated as a preview
  and blocked, the safe default.
- **Production disallows** `/admin`, `/api/`, `/login`, `/unauthorized`.
- **But allows two API paths**, listed *before* the `Disallow` they override:

  | Allowed | Why |
  | --- | --- |
  | `/api/domain/` | ⚠️ Returns the **entire contents** of a table page. Block it and every one of ~652 `table` pages looks like an empty shell to Google — **the rows are the content.** |
  | `/api/page-context` | Builds the nav. Block it and Googlebot sees no sidebar, so it cannot follow internal links to discover deeper pages. |

  Google resolves the conflict by **longest matching path**, not file order —
  `/api/domain/` (12 chars) beats `/api/` (5). The ordering is for simpler crawlers that
  take the first match.
- ⚠️ **`robots.txt` is not security.** It is a public document, so everything listed is
  *advertised*. That is exactly why finding #1 (locking down `/api/admin/*`) had to ship
  **before** this file — publishing "the admin panel is at /admin" was fine once those
  routes required an admin, and would have been an invitation a week earlier.
- ⚠️ **`Disallow` does not reliably mean "keep out of search results."** If another site
  links to a blocked URL, Google may still list the bare URL with no snippet. Real
  exclusion needs `noindex` in page metadata — a different mechanism.

### `sitemap.ts`

~1,198 URLs, depth up to 4, `revalidate = 3600`.

**Why `revalidate` is required:** without it Next renders this once at build time and
serves that snapshot forever — silently omitting every domain and page added through the
admin panel since the last deploy. Content here is created by **authoring, not
deploying.**

**`pageLastModified()` takes the newest of the page AND its content rows.** A URL, to a
crawler, is simply *what it renders* — if a table's rows change, that URL changed, no
matter which database table the bytes came from. Measured:

| contentType | count | content lives in |
| --- | --- | --- |
| `table` | 666 | `Table.data` — own row, own `updatedAt` |
| `rich_text` | 418 | `RichTextContent` — own row, own `updatedAt` |
| `subcategory_list` | 74 | the child `Page` rows |
| `section_based` | 5 | `Page.sections` — same row, fine |

**Every one of the 651 table pages and 415 rich-text pages had a child timestamp NEWER
than its page timestamp — by up to 147 days.** Emitting `Page.updatedAt` would have told
Google that 1,066 URLs last changed up to five months before they actually did. That is
not "understating freshness safely" — **systematically wrong `lastmod` is precisely what
makes Google discard the field for an entire sitemap.**

The domain root's date is deliberately **not** the newest of every descendant: a child's
*title* changing does alter a hierarchical root, but a child's *table contents* changing
does not, and rolling that up would inflate the date on almost every edit anywhere in
the domain. **Overstating freshness is the failure mode Google penalises.**

`changeFrequency` and `priority` are **deliberately omitted** — Google documents that it
ignores both. A tag the major engines ignore is not harmless extra signal; it is noise
implying a control you do not have.

The whole query is wrapped in `try/catch` degrading to a single static entry, because
`revalidate` means this runs during `next build` and an unreachable database would
otherwise **break the deploy**.

### `/` → 308, not 307

| | Status | Google reads it as |
| --- | --- | --- |
| `redirect()` | 307 Temporary | "`/` is still the real URL, keep checking back" |
| `permanentRedirect()` | **308 Permanent** | "`/` has moved to `/domain` for good" |

`atno.io` is the URL people type and link to, so consolidating those signals onto
`/domain` is worth having.

> ⚠️ **Read this before adding a real homepage.** Browsers cache a 308 **indefinitely
> and aggressively** — that is what "permanent" means. If you later build a landing page
> at `/`, every returning visitor who hit this redirect even once is *still* bounced to
> `/domain`; their browser never asks the server again. **You cannot fix that from the
> server side.** If a marketing homepage is on the roadmap, change this to `redirect()`
> **first** and accept the weaker signal in exchange for staying reversible.

### JSON-LD (`src/lib/structured-data.ts`)

| Builder | Emitted on | Purpose |
| --- | --- | --- |
| `buildOrganizationJsonLd()` | **only** `/domain` | names ATNO as an entity with a canonical URL and logo; can feed a knowledge panel |
| `buildBreadcrumbJsonLd()` | every `/domain/[...slug]` page | replaces the raw URL in results with a readable hierarchy |

The Organization entity is deliberately **not** on all 1,198 pages — repeating an
identical entity everywhere adds bytes and gives Google conflicting signals about which
URL is the organisation's home.

---

## 12. Admin panel

Eight screens, all driven by `src/components/admin/layout/admin-nav.ts` as the **single
source of truth for both the sidebar and the breadcrumb**:

```
Dashboard
Structure:  Categories · Domains · Pages
Content:    Section Layout · Tables · Rich Text
System:     Admin Users
```

**Why one file for both:** the sidebar held `NAVIGATION_ITEMS` and `AdminHeader` held a
separate `PAGE_INFO` map — two hand-maintained lists of the same routes, which **had
already drifted.** `PAGE_INFO` still described `/admin/editor`, a route that does not
exist, and its breadcrumbs inserted a middle segment ("Structure", "Content", "System")
that is a **sidebar grouping, not a URL segment** — implying a page you cannot navigate
to. Deriving both from one list means a route that does not exist cannot be described.

`isAdminNavItemActive()` special-cases `/admin` to an **exact** match — a `startsWith`
test would mark Dashboard active on every admin route, since they all begin with
`/admin`. Everything else uses a prefix match so `/admin/tables/abc123` keeps **Tables**
lit.

**Pattern per screen:** an RSC page shell → a client `*Manager` component →
`fetch('/api/admin/…')`. Tables additionally have a 4-step creation wizard: select page
→ define schema → upload CSV → preview.

### ⚠️ Finding #20 — five admin screens were frozen at build time

**The symptom:** *"When I change/update/create — some things do happen on the live
website. But so many things don't show up in the Admin UI."* Create a domain, and the
public site updates while the dashboard counts, the tables list and the New Table
dropdown keep showing old data — **until the next deploy.**

**The cause:** Next 15 renders a page **statically** when it touches no dynamic API — no
`cookies()`, no `headers()`, no `searchParams`. The dashboard had none of those; it just
called Prisma. So Next ran those queries **once at `next build`**, baked the numbers
into HTML, and shipped `.next/server/app/admin.html` as a real file on disk. Every visit
served that file. `initialRevalidateSeconds` was `false`, so there was no ISR either —
**it could never refresh.**

**Why `revalidateTag` could never have fixed it:** all the invalidation work in #5 and
#18 clears the **Data Cache** (`unstable_cache` entries). This page never used
`unstable_cache` — it called Prisma directly — so no tag was associated with it and
there was nothing to clear. **Every `invalidatePages()` call in the codebase is powerless
against a statically prerendered page.** That is exactly why all the earlier caching work
never made the admin panel any fresher.

**The fix:** `export const dynamic = 'force-dynamic'`.

Note this is the **opposite trade-off** from the public pages. There, static rendering is
the *goal* (#8-DR) because 1,198 pages × crawler traffic makes it genuinely valuable.
Here the audience is a handful of admins and the data must be correct, so one function
invocation and one query per view is obviously the right price.

> ⚠️ **`/admin/domains` and `/admin/pages` are live only BY ACCIDENT** — they accept
> `searchParams`, which forces dynamic rendering. **If a refactor ever drops that prop
> they will silently freeze too.**
>
> `/admin/users`, `/admin/users/new` and `/admin/rich-text` are also statically rendered
> and are **deliberately left that way**: they fetch via `useEffect` + `fetch` on the
> client, so their data is already live and a static shell costs nothing. **Being static
> is not the bug — being static while reading the database during render is.**

---

## 13. Where the project stands

Work happens on `dev-3.0` (branched from `master` @ `c4ff8d8`), one PR per phase, merged
to `master` → auto-deploys to `atno.io`. Tracked in `NEW-IMPROVEMENTS.md` — a 438 KB
audit log of 23 findings.

| Phase | Scope | Status |
| --- | --- | --- |
| **A** | Security + SEO foundation | ✅ complete |
| **B** | Correctness (migrations, geo, sanitising, invalidation) | ✅ complete |
| **C** | Cleanup | ~ #8 blocked on a product call; #4 branch hygiene outstanding |
| **D** | Polish (metadata, JSON-LD, breadcrumb labels) | ~ complete except product content |
| **E** | Security hardening + resilience | ✅ complete (#17 half — dev-branch row remains) |
| **F** | Performance + admin correctness | ~ only 22.2(b)/(c) left |
| **G** | **Admin UI rebuild on shadcn** | ~ **G-1…G-6 + G-8 done; G-7 remaining** |

### Open items, most significant first

**1. ⚠️ #8 / #8-DR — `force-dynamic` on every public page.** The single biggest
available win, and it is **blocked on a product decision, not on code.** Every public
page declares **both** `revalidate = 60` **and** `dynamic = 'force-dynamic'` — the
latter wins, so ISR never engages and all 1,198 pages cost a function invocation per
view. Making them static requires deciding how geo-targeting coexists with static
rendering. See the decision record at `NEW-IMPROVEMENTS.md` §8-DR.

**2. G-7 — Rich Text list + editor.** The one Phase G screen left, **deliberately held
back** until the authoring model is decided; rebuilding on shadcn first would be the
work twice.

**3. #22.2(b)/(c) — table row editing and schema editing.** Both waited for Phase G
because they are new UI. `PUT /api/admin/tables/[id]/data` already accepts
`{ data: { rows }, operation: 'replace' | 'append' }`, so 22.2(c) is *mostly a wiring
job.*

**4. G-5a(iii) — server-side pagination on the tables list.** Deferred by decision, not
forgotten. Residual 539 KB RSC payload; #22.1 + G-5a(ii) already took the page from
8.19 MB → 675 KB (92%). ⚠️ **The revisit trigger is table COUNT, not time** — it scales
linearly, so ~2,000 tables puts it back near 1.6 MB.

**5. #17 — the seeded `admin@example.com` row still exists on the dev branch.**

**6. #4 — branch hygiene.** 15 merged branches, stale local refs.

**7. SEO backlog.** 14.A6 per-page generated OG cards (`opengraph-image.tsx` +
`ImageResponse` — one line in `buildOpenGraph` to switch), 14.A7 `manifest.ts` for
Android/PWA, 13.3 canonicalise `nested-two.vercel.app`.

---

## 14. Things that will bite you

1. **React `cache()` keys on argument IDENTITY.** A fresh `.slice()` or a new object
   literal breaks the memo and silently doubles your query count. Pass strings, or share
   the array reference.

2. **Slugs are not unique within a domain** (83 collisions, 192 pages). Always walk the
   parent chain. Use `src/lib/page-path.ts` — it is the **one** correct implementation.
   The logic previously existed **four times in three states of correctness**, and the
   broken copies produced **433 dead links** in the admin panel (77.3% of rich-text
   pages, 16.5% of table pages).

3. **`buildPagePath` returning `null` is load-bearing, not a bug.** A missing parent
   means an ancestor is targeted at other countries, so the page is genuinely
   unreachable. Returning a shallow path instead **advertises a 404 to Google.** Callers
   should render a disabled control, not a link they know is broken.

4. **`__main__` is a row, not a URL.** Skip it in every path build. And it must be
   created only by **write** paths — never lazily on read.

5. **Adding a `contentType` with its own content table?** You must add the relation to
   the `select` **and** to `pageLastModified()` in `sitemap.ts`, or those pages silently
   report a stale `lastmod`. *(That is how this file was wrong the first time.)* At a
   third content table, switch to touching `Page.updatedAt` on child writes instead.

6. **`revalidateTag` clears the Data Cache only.** Not HTTP/CDN caches, and **not
   statically prerendered pages.** Seven of the twelve `CACHE_TAGS` have no subscribers
   and are silent no-ops.

7. **Grep for `tx.page.update`, not just `prisma.page.update`,** when auditing which
   routes mutate what. Two table routes hide `contentType` changes inside a
   `$transaction`, and `contentType` decides which layout renders the page.

8. **Never move the table country filter inside the cache.** That is how one country's
   rows get served to another.

9. **Next.js merges metadata SHALLOWLY.** Defining `openGraph` on a page **replaces**
   the layout's object. Use the builders. Same trap applies to `icons`.

10. **Never redirect an API route.** `fetch()` follows redirects, so `response.ok`
    becomes `true` and the real error vanishes behind a JSON parse failure.

11. **`ContentBlock` is dead** (0 rows). The dashboard's "Content Blocks" tile was
    removed because it always read 0 — correctly. Real content lives in
    `RichTextContent` and `Table`.

12. **`bg-opacity-50` is dead in Tailwind v4.** It rendered two modal backdrops **solid
    black**. Bit this codebase at least three times (G-3b, G-6a ×2).

13. **Radix `Select` has two traps:** empty-string values **throw**, and `SelectValue`
    server-renders blank.

14. **`suppressHydrationWarning` on `<html>` is required, not papering over a bug.**
    `next-themes` injects a blocking script that sets `class="dark"` before first paint —
    that script is the entire reason there is no theme flash. The server cannot match it
    because the preference lives in `localStorage`.

15. **Renaming a domain or page slug 404s every page under it.** There is **no redirect
    table.** The domain form warns about this; nothing enforces it.

---

*Compiled 4 August 2026 from a full read-through of `dev-3.0` @ `1ebba3a`.*
*For the reasoning behind any specific fix, search `NEW-IMPROVEMENTS.md` for its finding
number.*
