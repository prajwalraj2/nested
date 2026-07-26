# 🔧 New Improvements — Findings from Full Codebase Audit

**Created:** July 25, 2026
**Audited:** `phase14` @ `5598778`; all findings re-verified against **production
`master` @ `c4ff8d8`** (the two differ only in copy changes to `RichTextLayout` /
`TableLayout` plus README).
**Work branch:** `dev-3.0` (branched from `master` @ `c4ff8d8`)
**Scope:** Full read-through of schema, services, all API routes, public rendering path, admin panel, middleware/auth, caching layers, and planning docs.

**Related documents:**
- `REORDERED-EXECUTION-PLAN.md` (execution status — Steps 1–5 done, 6–7 pending)
- `MASTER-TASK-LIST.md` (original 37-task plan)
- `ARCHITECTURE-IMPROVEMENTS-2.md`, `COMPREHENSIVE-PROJECT-ANALYSIS.md`

---

## 📊 Summary Table

| # | Finding | Severity | Type | Effort |
|---|---------|----------|------|--------|
| 1 | `/api/admin/*` routes mostly unauthenticated | 🔴 **Critical** | Security | 1–2 hrs |
| 2 | Stored XSS via unauthenticated rich-text write | 🔴 **Critical** | Security | 2–3 hrs |
| 3 | Migration drift — `targetCountries` has no migration | 🔴 **Critical** | Data / Deploy | 30 min |
| 4 | Branch hygiene — 15 merged branches, stale local refs | 🟡 Medium | Workflow | 20 min |
| 5 | Cache tags defined but never invalidated | 🟠 **High** | Correctness | 2–3 hrs |
| 6 | `new PrismaClient()` in rich-text routes | 🟡 Medium | Resource leak | 10 min |
| 7 | Dead breadcrumb work on every request | 🟡 Medium | Performance | 30 min |
| 8 | `revalidate` + `force-dynamic` contradiction | 🟡 Medium | Clarity | 5 min |
| 9 | Deprecated APIs/hooks still shipping + type coupling | 🟡 Medium | Tech debt | 1–2 hrs |
| 10 | `console.log` in hot render paths | 🟢 Low | Hygiene | 15 min |
| 11 | DB write during page render (`getOrCreateMainPage`) | 🟢 Low | Design smell | 1 hr |
| 12 | `/api/debug/cache-test` open in production | 🟢 Low | Info leak | 5 min |
| 13 | No `robots.txt` / `sitemap.xml` (404s in Vercel logs) | 🟢 Low | SEO | 30 min |
| 14 | **Every page shares one title** — no per-page metadata | 🟠 **High** | SEO / Growth | 2 hrs (A) |

---

## 🔴 1. Most `/api/admin/*` Routes Are Completely Unauthenticated

**Severity:** Critical — unauthenticated destructive writes from the public internet.

### Root cause

`src/middleware.ts` guards admin routes with:

```typescript
if (pathname.startsWith('/admin')) {
  const session = await auth()
  if (!session) return NextResponse.redirect(loginUrl)
  if (!session.user?.isAdmin) return NextResponse.redirect(unauthorizedUrl)
}
```

`/api/admin/pages/123` **does not start with** `/admin` — it starts with `/api/admin`.
So the middleware never protects any API route. Protection exists **only** where a
route file calls `auth()` itself — and most don't.

### Audit results

| Route file | Methods | Auth check |
|---|---|---|
| `api/admin/categories/route.ts` | GET, POST | ✅ Yes |
| `api/admin/domains/route.ts` | GET, POST | ✅ Yes |
| `api/admin/pages/route.ts` | GET, POST | ✅ Yes |
| `api/admin/users/route.ts` | GET, POST | ✅ Yes |
| `api/admin/users/[id]/route.ts` | GET, PUT, DELETE | ✅ Yes |
| `api/admin/categories/[id]/route.ts` | GET, PUT, **DELETE** | ❌ **NONE** |
| `api/admin/domains/[id]/route.ts` | GET, PUT, PATCH, **DELETE** | ❌ **NONE** |
| `api/admin/pages/[id]/route.ts` | GET, PUT, **DELETE** | ❌ **NONE** |
| `api/admin/sections/[id]/route.ts` | GET, PUT | ❌ **NONE** |
| `api/admin/tables/route.ts` | GET, POST | ❌ **NONE** |
| `api/admin/tables/[id]/route.ts` | GET, PUT, DELETE | ❌ **NONE** |
| `api/admin/tables/[id]/data/route.ts` | GET, PUT, **DELETE** | ❌ **NONE** |
| `api/admin/rich-text/route.ts` | GET, POST | ❌ **NONE** |
| `api/admin/rich-text/[pageId]/route.ts` | GET, PUT, DELETE | ❌ **NONE** |

**8 of 14 admin route files are open.** What an anonymous request can do today:

- `DELETE /api/admin/domains/{id}` → deletes a domain **and every page inside it**
  (transaction deletes all `ContentBlock`s, then all `Page`s, then the `Domain`)
- `DELETE /api/admin/pages/{id}` → deletes a page **and all recursive descendants**
- `PUT /api/admin/tables/{id}/data` → replace or wipe any table's entire dataset
- `PUT /api/admin/rich-text/{pageId}` → inject arbitrary HTML into any page (see #2)
- `PUT /api/admin/sections/{id}` → scramble any page's 3-column layout
- `PATCH /api/admin/domains/{id}` → publish/unpublish domains, change geo-targeting
- `GET /api/admin/tables?...` → dump every table's full contents, **including the
  hidden `targetCountries` column** that is normally stripped from public views

### Fix — two layers (do both)

**Layer 1 — widen the middleware matcher (defense in depth):**

```typescript
// src/middleware.ts
const isAdminPath = pathname.startsWith('/admin')
const isAdminApi  = pathname.startsWith('/api/admin')

if (isAdminPath || isAdminApi) {
  const session = await auth()

  if (!session?.user?.isAdmin || !session.user.isActive) {
    // APIs must get a status code, never an HTML redirect
    if (isAdminApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // existing redirect logic for page routes
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }
}
```

> ⚠️ Redirecting an API route to `/login` returns HTML with a 200/307 — client
> `fetch()` calls would silently parse garbage. Always return JSON + 401 for APIs.

**Layer 2 — a shared guard helper, applied to every admin route:**

```typescript
// src/lib/api-auth.ts  (new file)
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

/** Returns a 401/403 response if the caller is not an active admin, else null. */
export async function requireAdmin() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }
  if (!session.user?.isAdmin || !session.user?.isActive) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
  }
  return null
}
```

Then at the top of **every** handler in the 8 unprotected files:

```typescript
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const denied = await requireAdmin()
  if (denied) return denied
  // ...existing logic
}
```

Refactoring the 6 already-protected routes to use `requireAdmin()` too removes the
copy-pasted `auth()` blocks and guarantees consistent status codes.

### Why both layers

The middleware is a single choke point that can't be forgotten on a new route file.
The per-route guard survives a middleware matcher regression and works even if a
route is ever invoked outside the middleware's path (e.g. server actions, direct
imports, or a future matcher edit). Neither alone is sufficient in practice.

---

## 🔴 2. Stored XSS Chain via Rich Text

**Severity:** Critical (while #1 is open) → Medium (after #1 is fixed).

### The chain

1. `PUT /api/admin/rich-text/[pageId]` accepts a raw `htmlContent` string.
   The only validation is `if (!htmlContent)` — no sanitization, no allow-list.
2. It is stored verbatim in `RichTextContent.htmlContent`.
3. `src/components/domain/RichTextLayout.tsx` renders it to every public visitor:

```tsx
<div
  className="rich-text-content [&>div]:space-y-4"
  dangerouslySetInnerHTML={{ __html: page.richTextContent!.htmlContent }}
/>
```

Because the write endpoint is currently unauthenticated (#1), **any anonymous person
can plant `<script>` / `<img onerror=...>` on a public page** — which then executes in
every visitor's browser, including an admin's, in the same origin as the admin panel
and its (currently unguarded) API. That is a full site takeover primitive.

### Fix

**Step 1 (mandatory):** Fix #1. That reduces this to "admins can write raw HTML,"
which is a deliberate feature of this editor.

**Step 2 (recommended):** Sanitize on write anyway. Rationale: it limits the blast
radius of a compromised or careless admin account, and it costs almost nothing.

```bash
npm install isomorphic-dompurify
```

```typescript
// in api/admin/rich-text/[pageId]/route.ts and api/admin/rich-text/route.ts
import DOMPurify from 'isomorphic-dompurify'

const cleanHtml = DOMPurify.sanitize(htmlContent, {
  ALLOWED_TAGS: [
    'div','span','p','br','hr','h1','h2','h3','h4','h5','h6',
    'ul','ol','li','a','strong','em','b','i','u','s',
    'table','thead','tbody','tr','th','td',
    'img','blockquote','code','pre',
  ],
  ALLOWED_ATTR: ['class','href','target','rel','src','alt','title','style','colspan','rowspan'],
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|\/)/i,
})
```

Sanitize **on write**, not on read — read paths are cached, and one bad write would
otherwise be re-rendered forever.

> **Note on the editor's design:** the HTML template inserted by
> `HtmlEditor.insertSampleTemplate()` relies on Tailwind utility classes
> (`grid`, `list-disc`, `pl-6`, `font-[verdana]`, `text-[#afb6b5]`). Keep `class`
> in `ALLOWED_ATTR` or existing content will lose all styling. Also verify these
> classes survive Tailwind v4's content scanning — utilities that appear **only**
> inside DB-stored HTML are not in any scanned source file and may be purged from
> the production CSS bundle. If styling breaks in prod but works in dev, that's why;
> the fix is a safelist.

---

## 🔴 3. Migration Drift — `targetCountries` Has No Migration

**Severity:** Critical for any clean deployment or new environment.

### Evidence

```
prisma/migrations/
  20250824072606_init/
  ...
  20250910093410_simplify/          ← LAST migration (Sep 10, 2025)
```

`grep -rl "targetCountries" prisma/migrations/` → **no matches.**

But `prisma/schema.prisma` declares it on two models:

```prisma
model Domain {
  targetCountries String[] @default(["ALL"])
}
model Page {
  targetCountries String[] @default(["ALL"])
}
```

The geo-targeting feature (phases 9–10, Feb 2026) was applied to the live database
with `prisma db push`, which mutates the schema **without recording a migration**.

### Consequence

Anyone running `prisma migrate deploy` against a fresh database gets a schema with
**no `targetCountries` columns**. Then every navigation query fails, because
`buildCountryFilter()` is injected into essentially every read:

```typescript
// src/lib/server-country.ts
export function buildCountryFilter(userCountry: string) {
  return { OR: [
    { targetCountries: { has: 'ALL' } },
    { targetCountries: { has: userCountry } },
  ]}
}
```

Result: `DomainService`, `PageService`, and `NavigationService` all throw →
the entire public site 500s. This is a guaranteed failure on a new environment,
CI database, or any teammate's fresh clone (see `COLLEAGUE-SETUP-GUIDE.md`).

### Fix

Generate the missing migration **without re-applying it** to the already-correct
production database:

```bash
# 1. Create the SQL from the schema diff, but do NOT execute it
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL" \
  --script > migration.sql

# 2. Review migration.sql — expect roughly:
#    ALTER TABLE "Domain" ADD COLUMN "targetCountries" TEXT[] DEFAULT ARRAY['ALL']::TEXT[];
#    ALTER TABLE "Page"   ADD COLUMN "targetCountries" TEXT[] DEFAULT ARRAY['ALL']::TEXT[];

# 3. Place it as a proper migration folder
mkdir -p prisma/migrations/20260725000000_add_geo_targeting
mv migration.sql prisma/migrations/20260725000000_add_geo_targeting/migration.sql

# 4. Mark it as already applied on the live DB (does NOT run the SQL)
npx prisma migrate resolve --applied 20260725000000_add_geo_targeting

# 5. Confirm clean state
npx prisma migrate status
```

> ⚠️ **Do not** run `prisma migrate dev` here — it may detect drift and offer to
> reset the database. Always back up production before touching migration state.

**Also audit for other drift.** Everything added after Sep 10, 2025 needs the same
check — compare `schema.prisma` against the last migration for any other field that
was `db push`ed (run `npx prisma migrate status` and read the drift report).

---

## 🟡 4. Branch Hygiene — 15 Merged Branches, Stale Local Refs

**Severity:** Medium — workflow friction. No production risk.

### Verified state (after `git fetch`)

```
origin/master    c4ff8d8   May 9, 2026     ← production; atno.io deploys from here
origin/dev-3.0   c4ff8d8   May 9, 2026     ← new work branch, identical to master
phase14          5598778   Feb 10, 2026    ← 12 commits behind, 0 unique commits

git rev-list --left-right --count origin/master...phase14  →  12    0
```

Production **is** `master` — confirmed in the Vercel dashboard: *"To update your
Production Deployment, push to the `master` branch."* All phase work was merged via
PRs #2–#5 (Feb 3–10). Next.js on `master` is `15.5.9`, i.e. CVE-patched.
**Nothing needs merging.**

> ⚠️ **Correction.** An earlier revision of this document claimed `master` was four
> months stale and missing the services layer, geo-targeting, and the Next.js
> security patch. That was **wrong**. It was derived from a local clone whose
> remote-tracking refs had not been fetched since October 2025, so both `master` and
> `origin/master` pointed at `f01a212`. **Always `git fetch` before comparing
> branches** — `git log`, `git rev-list`, and `git branch -vv` all silently report
> against the last-fetched snapshot, with no warning that it is out of date.

### Actual issues

1. **15 fully-merged branches** (`phase1`–`phase14`, `branch7`) still exist locally
   and on the remote. Every one is an ancestor of `origin/master`. They clutter the
   branch list, and each still produces Vercel preview deployments — which are
   publicly crawlable (see #13).
2. **Local `master` was stale** at `f01a212`. Fixed with
   `git branch -f master origin/master`.
3. **Two hostnames serve the same production deployment** — `atno.io` and
   `nested-two.vercel.app`. This is duplicate content; see #13.

### Fix

```bash
git fetch origin --prune
git branch --merged origin/master          # verify the list before deleting
git branch -d phase1 phase2 phase3 phase4 phase5 phase6 phase8 phase9 \
              phase10 phase11 phase12 phase13 phase14 branch7
git push origin --delete phase1 phase2 …   # optional: clean the remote too
```

If the history markers matter, tag instead of keeping branches —
`git tag phase11 521eae0 && git push --tags`. Tags don't trigger preview builds.

**Going forward:** the PR-per-feature flow (branch → PR → merge to `master` →
auto-deploy) is sound. Just delete each branch once its PR merges.

---

## 🟠 5. Cache Tags Are Defined but Never Invalidated

**Severity:** High — admin edits appear not to work.

`src/lib/cache.ts` exports a complete tag taxonomy:

```typescript
export const CACHE_TAGS = {
  DOMAINS: 'domains',      DOMAIN: (slug) => `domain:${slug}`,
  PAGES: 'pages',          PAGE: (id) => `page:${id}`,
  CATEGORIES: 'categories', NAVIGATION: 'navigation',
  TABLES: 'tables',        COUNTRY: (code) => `country:${code}`,
} as const
```

Every `unstable_cache()` call in the services correctly passes these tags. But:

```
grep -rn "revalidateTag\|revalidatePath" src/  →  NONE
```

**Nothing ever invalidates anything.** Caches only expire on their timer:

| Data | Duration | Admin edit invisible for |
|---|---|---|
| Domains, Pages, Navigation | `MEDIUM` = 60s | up to 1 minute |
| Categories | `LONG` = 300s | **up to 5 minutes** |
| `/api/page-context` (CDN) | `s-maxage=60`, `stale-while-revalidate=300` | up to 5 min stale |

Stacked, an admin can publish a domain and not see it for minutes, with no way to
force a flush. This reads as a bug ("my change didn't save") and invites people to
disable caching entirely — losing the whole benefit of phase 11.

### Fix

```typescript
// src/lib/cache-invalidation.ts  (new file)
import { revalidateTag } from 'next/cache'
import { CACHE_TAGS } from './cache'

export function invalidateDomains() {
  revalidateTag(CACHE_TAGS.DOMAINS)
  revalidateTag(CACHE_TAGS.NAVIGATION)
}

export function invalidatePages() {
  revalidateTag(CACHE_TAGS.PAGES)
  revalidateTag(CACHE_TAGS.NAVIGATION)  // sidebar/header embed page lists
}

export function invalidateCategories() {
  revalidateTag(CACHE_TAGS.CATEGORIES)
  revalidateTag(CACHE_TAGS.NAVIGATION)
}

export function invalidateTables() {
  revalidateTag(CACHE_TAGS.TABLES)
}
```

Call the matching function after **every** successful mutation:

| Route | Call after success |
|---|---|
| `POST/PUT/PATCH/DELETE /api/admin/domains*` | `invalidateDomains()` + `invalidatePages()` |
| `POST/PUT/DELETE /api/admin/pages*` | `invalidatePages()` |
| `POST/PUT/DELETE /api/admin/categories*` | `invalidateCategories()` |
| `PUT /api/admin/sections/[id]` | `invalidatePages()` |
| `POST/PUT/DELETE /api/admin/tables*` | `invalidateTables()` |
| `PUT/POST/DELETE /api/admin/rich-text*` | `invalidatePages()` |

Note domain mutations must also invalidate pages: `getDomainWithPagesFromDB` is
tagged with both `DOMAINS` and `PAGES`, and the navigation payload nests page lists
inside domains.

---

## 🟡 6. `new PrismaClient()` Instead of the Singleton

**Severity:** Medium — connection exhaustion.

`src/lib/prisma.ts` implements the standard Next.js singleton so hot-reload doesn't
spawn a new pool per recompile:

```typescript
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

Two files bypass it and instantiate at module scope:

- `src/app/api/admin/rich-text/route.ts:6`
- `src/app/api/admin/rich-text/[pageId]/route.ts:6`

```typescript
import { PrismaClient } from '@/generated/prisma';
const prisma = new PrismaClient();          // ❌
```

In dev this leaks a connection pool on every hot reload (eventually
`too many connections`). On Vercel it adds an unnecessary pool per serverless
instance — meaningful against a connection-limited Postgres.

### Fix

```typescript
import { prisma } from '@/lib/prisma';       // ✅
```

Delete the local `const prisma = new PrismaClient()` from both files. No other code
changes needed — the API surface is identical.

Add a lint guard so it can't regress:

```javascript
// eslint.config.mjs — inside rules
'no-restricted-syntax': ['error', {
  selector: "NewExpression[callee.name='PrismaClient']",
  message: 'Import the shared singleton from @/lib/prisma instead.',
}],
```

(Exempt `prisma/seed-admin.ts` — a standalone script legitimately creates its own
client and calls `$disconnect()`.)

---

## 🟡 7. Dead Breadcrumb Work on Every Request

**Severity:** Medium — pure waste, one extra query per navigation.

`NavigationService.getPageContext()` computes full breadcrumb data server-side,
including an **extra database query** at `src/services/navigation.service.ts:474`:

```typescript
const { prisma } = await import('@/lib/prisma');
const allPagesInPath = await prisma.page.findMany({
  where: { domainId: domain.id, slug: { in: pageSegments } },
  select: { id: true, title: true, slug: true, contentType: true, parentId: true },
});
```

But the consumer throws it away. `src/hooks/usePageContext.ts` hardcodes:

```typescript
breadcrumb: { items: [], shouldCollapse: false, visibleItems: null },  // client-derived
```

And `src/components/bread/bread.tsx` derives breadcrumbs from `usePathname()` plus
existing sidebar data — a deliberate, good improvement (renders instantly, no API
wait). The server-side branch is simply orphaned.

Also note `getPageContext` calls `PageService.getByPath()` **twice** for the same
path — once for `currentPage` and once inside `buildBreadcrumbData` — plus the raw
query above. On a cache miss that's three redundant round-trips.

### Fix

Make the expensive parts opt-in:

```typescript
getPageContext: cache(async (
  path: string,
  userCountry: string,
  opts: { includeBreadcrumb?: boolean } = {}
): Promise<PageContextData> => {
  // ...
  const breadcrumb = opts.includeBreadcrumb
    ? await buildBreadcrumbData(segments, userCountry)
    : { items: [] };
  // ...
})
```

Default `false`, since no current caller uses it. Keep `buildBreadcrumbData` (it's
correct and N+1-free) for future server-rendered breadcrumbs or SEO metadata.

Additionally, dedupe the double `getByPath` — resolve the page once and reuse it for
both `currentPage` and the breadcrumb labels.

---

## 🟡 8. `revalidate` and `force-dynamic` Contradict Each Other

**Severity:** Medium (cosmetic, but actively misleading).

Both public pages declare:

```typescript
export const revalidate = 60;              // src/app/domain/page.tsx
export const dynamic = 'force-dynamic';    // src/app/domain/[...slug]/page.tsx
```

`force-dynamic` opts the route out of static generation entirely, so
**`revalidate = 60` has no effect.** Every request renders fresh.

The behavior is *correct* — both pages read the `user-country` cookie via
`getUserCountryFromCookies()`, and cookie-dependent pages genuinely cannot be
statically cached per-country without extra work. But `REORDERED-EXECUTION-PLAN.md`
lists "Task 5.4: Add ISR to domain pages ✅ COMPLETED", which reads as though ISR is
active. It isn't.

### Fix

Delete the misleading export and document the real reason:

```typescript
/**
 * Rendered per-request: geo-targeting reads the `user-country` cookie, so output
 * varies per visitor and cannot be statically cached.
 * Freshness comes from unstable_cache in the services layer (60s) plus the
 * CDN headers on /api/page-context.
 */
export const dynamic = 'force-dynamic';
```

Then correct the claim in `REORDERED-EXECUTION-PLAN.md`.

**If real ISR is wanted later:** the standard approach is to move country into the
route (`/[country]/domain/...`) or into a middleware rewrite, so each country gets
its own cacheable path. That's a larger change — worth its own task.

---

## 🟡 9. Deprecated APIs/Hooks Still Shipping — and a Deletion Trap

**Severity:** Medium — tech debt with a build-breaking landmine.

Per `REORDERED-EXECUTION-PLAN.md` Step 2, these were marked deprecated but kept:

| Deprecated API route | Deprecated hook |
|---|---|
| `src/app/api/header-domains/route.ts` | `src/hooks/useHeaderData.ts` |
| `src/app/api/sidebar/route.ts` | `src/hooks/useSidebarData.ts` |
| `src/app/api/page-sidebar/route.ts` | `src/hooks/usePageSidebarData.ts` |
| `src/app/api/breadcrumb/route.ts` | `src/hooks/useBreadcrumbData.ts` |

The API routes are still **live, publicly reachable endpoints** — 4 extra bits of
attack surface with their own (older, unaudited) query logic. `api/page-sidebar`
still contains commented-out `console.log` debug blocks and its own duplicated
`organizePagesIntoSections` implementation, which can now drift from the services
version.

### ⚠️ The deletion trap

Two **active** components import their *types* from a deprecated hook:

```typescript
// src/components/sidebar/SidebarDomain.tsx:11
import type { SidebarDomain } from '@/hooks/useSidebarData';

// src/components/sidebar/SidebarPage.tsx:5
import type { SidebarPage } from '@/hooks/useSidebarData';
```

Deleting `useSidebarData.ts` **breaks the build.** Fix the imports first — the
equivalent types already exist in the new hook:

```typescript
import type { SidebarDomain } from '@/hooks/usePageContext';
import type { SidebarPage } from '@/hooks/usePageContext';
```

### Recommended order

1. Repoint the two type imports to `@/hooks/usePageContext`
2. `grep -rn "useHeaderData\|useSidebarData\|usePageSidebarData\|useBreadcrumbData" src/`
   → confirm zero remaining references
3. Delete the 4 hooks
4. Delete the 4 API route files
5. Run `npm run build` to confirm

The new system has been in place since phase 11 and is verified working in
production — the "keep for reference" window has passed. Git history preserves them.

---

## 🟢 10. `console.log` in Hot Render Paths

**Severity:** Low, but one instance is a real performance issue.

16 `console.log` statements remain across 7 files:

| File | Note |
|---|---|
| `src/components/table/DataTable.tsx:124` | ⚠️ **Inside the cell renderer** — fires **per cell** for every description column, on every render, sort, filter, and paginate |
| `src/components/admin/layout/AdminSidebar.tsx:113` | `console.log("pathname", pathname)` on every admin navigation |
| `src/components/domain/TableLayout.tsx` | Commented-out logs + **~500 lines of pasted JSON sample output** in comments |
| `src/app/api/page-sidebar/route.ts` | Commented debug blocks (file is deprecated → delete per #9) |
| `src/hooks/usePageSidebarData.ts` | Deprecated → delete per #9 |
| `src/hooks/useUserCountry.ts`, `src/components/auth/LogoutButton.tsx` | Minor |

The `DataTable` one is worst:

```typescript
cell: ({ getValue, row }) => {
  const value = getValue();
  // Debug logging - remove after testing        ← left in
  if (col.name === 'Description' || col.id.includes('description')) {
    console.log('Description column detected:', { ... });
  }
  return formatCellValue(value, col.type, row.original, col.name);
}
```

With 25 rows × a description column, that's 25 console writes per render — and
console output in a hot path is genuinely slow in browsers with devtools open.

### Fix

Delete the `DataTable` block and the `AdminSidebar` line outright. Also strip the
~500 lines of commented sample JSON from `TableLayout.tsx` (724 lines → ~200); the
type definitions in `src/types/table.ts` already document that shape properly.

For anything worth keeping, gate it:

```typescript
if (process.env.NODE_ENV === 'development') console.log(...)
```

`console.error` in `catch` blocks is fine — leave those.

---

## 🟢 11. Database Write During Page Render

**Severity:** Low — design smell with a small race.

`src/app/domain/[...slug]/page.tsx:65`, on the GET path of a public page:

```typescript
const mainPage = await PageService.getOrCreateMainPage(domain.id, domain.name);
```

This **creates a `Page` row** if `__main__` is missing. Because the route is
`force-dynamic`, it runs on **every** visit to any direct-domain root.

Problems:
- A read request mutates data (surprising; breaks GET idempotency)
- Two concurrent first-hits can both pass the `findFirst` check and both insert —
  there's no unique constraint on `(domainId, slug)` to stop a duplicate `__main__`
- It masks the real bug: `__main__` should always already exist, created by
  `POST /api/admin/domains` and by the `hierarchical → direct` switch in
  `PATCH /api/admin/domains/[id]`

### Fix

Make the render path read-only:

```typescript
const mainPage = await PageService.getMainPage(domain.id);
if (!mainPage) {
  console.error(`Direct domain "${domain.slug}" (${domain.id}) has no __main__ page`);
  return notFound();
}
```

Then guarantee the invariant elsewhere:
1. Add a unique constraint so duplicates become impossible:
   ```prisma
   model Page {
     @@unique([domainId, slug, parentId])   // verify against existing data first
   }
   ```
   (Careful: Postgres treats `NULL`s as distinct in unique constraints, so root-level
   pages with `parentId = NULL` won't be covered. A partial unique index on
   `(domainId, slug) WHERE slug = '__main__'` is the precise fix.)
2. Add a repair check to `HealthCheck` on the admin dashboard: list direct domains
   missing `__main__`, with a one-click fix.
3. Keep `getOrCreateMainPage` but call it only from admin write paths.

---

## 🟢 12. `/api/debug/cache-test` Is Open in Production

**Severity:** Low — information disclosure.

`src/app/api/debug/cache-test/route.ts` has no auth, and its own header says:

```typescript
* ⚠️ Remove this in production or protect with authentication
```

It exposes domain/category counts, internal cache-duration config, and service
response timings — a light fingerprint of the stack and DB size.

### Fix

Either delete it, or gate it:

```typescript
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  // ...
}
```

Once `/api/admin/*` is protected (#1), moving it to `/api/admin/debug/cache-test`
also works and keeps it usable against production data when logged in as admin.

---

## 🟢 13. No `robots.txt` or `sitemap.xml`

**Severity:** Low — SEO / crawler hygiene.

Vercel logs show repeated `GET /robots.txt → 404` on `atno.io`. Crawlers request
this file before crawling; a 404 means "no restrictions", so nothing is *broken* —
but nothing is guided either, and `/admin`, `/login`, and `/api/*` are all
crawlable and indexable today.

`MASTER-TASK-LIST.md` Task 7.5 already tracks the sitemap; both belong together.

### Fix — `src/app/robots.ts`

```typescript
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://atno.io'
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/login', '/unauthorized'],
    }],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
```

### Fix — `src/app/sitemap.ts`

```typescript
import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://atno.io'

  // Published, globally-visible domains only — do not leak geo-targeted content
  const domains = await prisma.domain.findMany({
    where: { isPublished: true, targetCountries: { has: 'ALL' } },
    select: { slug: true, createdAt: true,
      pages: {
        where: { targetCountries: { has: 'ALL' }, slug: { not: '__main__' } },
        select: { slug: true, createdAt: true },
      },
    },
  })

  return [
    { url: `${baseUrl}/domain`, changeFrequency: 'daily', priority: 1 },
    ...domains.flatMap(d => [
      { url: `${baseUrl}/domain/${d.slug}`, lastModified: d.createdAt, priority: 0.8 },
      ...d.pages.map(p => ({
        url: `${baseUrl}/domain/${d.slug}/${p.slug}`,
        lastModified: p.createdAt,
        priority: 0.6,
      })),
    ]),
  ]
}
```

> ⚠️ **Only include `targetCountries: ['ALL']` content.** A sitemap is a single
> global document with no country context — listing geo-restricted URLs would
> advertise content that then 404s for most visitors, which hurts crawl quality.
>
> ⚠️ Nested `hierarchical` paths (`/domain/webdev/withcode/ytube`) need parent-chain
> resolution to build correctly. The query above only emits depth-1 pages; extend it
> using the same traversal logic as `generatePagePreviewUrl` if deeper URLs matter.

### Also required — block crawlers on preview deployments

Every `nested-git-*.vercel.app` preview URL is publicly reachable and indexable.
A blanket `allow: '/'` lets Google index preview builds, creating duplicate content
that competes with `atno.io`. Gate on `VERCEL_ENV`, which Vercel sets automatically
to `production` | `preview` | `development`:

```typescript
export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV !== 'production') {
    return { rules: [{ userAgent: '*', disallow: '/' }] }
  }
  // ...production rules
}
```

### Also required — canonicalise the duplicate hostname

**TODO:** `atno.io` and `nested-two.vercel.app` both serve the *same* production
deployment (both are listed under Domains in the Vercel dashboard). Google can index
every page twice and split ranking signals between the two hostnames.
`VERCEL_ENV` is `production` for both, so the guard above does **not** fix this.

Two options, do at least the first:

1. **Declare the canonical origin** — one line, fixes canonical tags site-wide:
   ```typescript
   // src/app/layout.tsx
   export const metadata: Metadata = {
     metadataBase: new URL('https://atno.io'),
     // ...
   }
   ```
2. **Redirect the alias** — Vercel → Settings → Domains → set
   `nested-two.vercel.app` to redirect to `atno.io`. Cleanest outcome. Worth first
   checking whether that alias is still needed at all.

Pair all of this with **Task 7.3 (SEO metadata)** — a sitemap pointing at pages with
no unique `<title>` or `<meta description>` wastes most of the benefit. The app
currently has **exactly one** `metadata` export (`src/app/layout.tsx`) and **zero**
`generateMetadata` functions, so every page on the site shares one title. See the
dedicated SEO section for the full picture.

---

## 🟠 14. SEO — Every Page Serves the Same Title

**Severity:** High for organic growth. Not a bug — the site works — but it caps
discoverability, and the fix is cheap.

### Verified current state

```
metadata exports:      1    (src/app/layout.tsx — static, site-wide)
generateMetadata:      0
openGraph / twitter:   0
JSON-LD structured:    0
next/image:            0    (one raw <img> in NarrativeLayout.tsx:104)
```

Every URL on `atno.io` returns the identical head:

```html
<title>ATNO - Domain Explorer</title>
<meta name="description" content="Explore specialized domains and discover unique opportunities">
```

`/domain/genai/videogen`, `/domain/appdev/ios`, `/domain/webdev/withcode` — all the
same. The `<title>` is the strongest on-page ranking factor, and site-wide duplicate
titles are a direct quality signal problem. **Nothing else in this section matters as
much as fixing this one thing.**

---

### SEO-A — the core fix (~2 hrs, most of the value)

#### A1. Per-page metadata

The data is already loaded, and because every service method is wrapped in React
`cache()`, `generateMetadata` and the page component **share the same query** — the
metadata costs no extra database round-trip.

```typescript
// src/app/domain/[...slug]/page.tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const [domainSlug, ...rest] = slug
  const userCountry = await getUserCountryFromCookies()

  const domain = await DomainService.getWithPages(domainSlug)   // cache() hit
  if (!domain) return { title: 'Not Found — ATNO' }

  if (rest.length === 0) {
    return {
      title: `${stripEmoji(domain.name)} — ATNO`,
      description: `Curated resources, tools and channels for ${stripEmoji(domain.name)}.`,
      alternates: { canonical: `/domain/${domain.slug}` },
    }
  }

  const page = await PageService.getByPath(
    domain.id, rest, domain.pageType as 'direct' | 'hierarchical', userCountry
  )

  // Do not let geo-restricted pages into the index — see the geo section below
  const isGlobal = page?.targetCountries?.includes('ALL') ?? false

  return {
    title: `${stripEmoji(page?.title ?? 'Page')} — ${stripEmoji(domain.name)} — ATNO`,
    description: `${stripEmoji(page?.title ?? '')} in ${stripEmoji(domain.name)}. Hand-picked resources on ATNO.`,
    alternates: { canonical: `/domain/${domain.slug}/${rest.join('/')}` },
    robots: isGlobal ? undefined : { index: false, follow: true },
  }
}
```

> **Emoji in titles.** DB titles carry emoji (`▶️ YouTube Channel`,
> `🖌️ Graphic Designing`). Valid in a `<title>`, but Google usually strips them from
> results and they eat character budget. Strip them for metadata, keep them in the UI:
> ```typescript
> const stripEmoji = (s: string) =>
>   s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}️]/gu, '').trim()
> ```

Do the same for `src/app/domain/page.tsx` (static metadata is fine there — it's one page).

#### A2. Canonical origin — one line, fixes duplicate hostnames site-wide

```typescript
// src/app/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL('https://atno.io'),   // ← makes all relative canonicals absolute
  title: { default: 'ATNO — Domain Explorer', template: '%s' },
  description: 'Explore specialized domains and discover unique opportunities',
}
```

This resolves the `atno.io` vs `nested-two.vercel.app` duplicate-content problem
described in #13, because canonical tags will always point at `atno.io` regardless of
which hostname served the request.

#### A3. Open Graph + Twitter cards

Sharing an `atno.io` link in WhatsApp, LinkedIn, or X currently renders a **bare URL
with no preview** — no title, no description, no image. For a directory that grows by
being shared, that is a direct and ongoing cost.

```typescript
// in src/app/layout.tsx metadata
openGraph: {
  type: 'website',
  siteName: 'ATNO',
  locale: 'en_US',
  url: 'https://atno.io',
},
twitter: { card: 'summary_large_image' },
```

Then per-page, inside `generateMetadata`:

```typescript
openGraph: {
  title: `${stripEmoji(page?.title ?? '')} — ${stripEmoji(domain.name)}`,
  description: `Hand-picked resources for ${stripEmoji(domain.name)}.`,
  url: `/domain/${domain.slug}/${rest.join('/')}`,
},
```

Next.js can also generate share images at the edge via `opengraph-image.tsx` — worth
adding later; a plain static OG image in `public/` is fine to start.

#### A4. `robots.ts` + `sitemap.ts`

See #13 — including the `VERCEL_ENV` preview guard and the sitemap's
`targetCountries: ['ALL']` filter.

---

### SEO-B — later, lower priority

| Item | Why | Note |
|---|---|---|
| JSON-LD `BreadcrumbList` | Puts breadcrumb trails into search results — a realistic win for a deeply nested site | Data already exists in `buildBreadcrumbData` (currently orphaned, see #7 — this is the use case that justifies keeping it) |
| JSON-LD `Organization` | Brand entity on the home page | Small |
| `next/image` for `NarrativeLayout.tsx:104` | Raw `<img>` has no `width`/`height` → layout shift. **CLS is a ranking signal.** | Also gets automatic format/size optimization |
| Static rendering | `force-dynamic` means no cached HTML and a DB hit on every crawl → slow TTFB | **Blocked on the geo decision below** |
| Real page content | See the caveat at the end of this section | Product work, not code |

---

### 🌍 Geo-Targeting × SEO — Decision Record

**Decision: Option A, as of July 2026.** Recorded here with the alternatives so this
isn't rediscovered from scratch later.

#### The underlying problem

Crawlers do not send cookies. So on every crawl:

```
Googlebot requests /domain/x
  → no `user-country` cookie
  → middleware.ts assigns DEFAULT_COUNTRY = 'US'
  → buildCountryFilter('US') → only ALL + US content is visible
```

**Any domain or page targeted exclusively at `IN` / `GB` / `AU` / `CA` is permanently
invisible to search.** This is not hypothetical — the live site has India-specific
content (e.g. "Dropshipping (Indian)").

Google documents this pattern as *locale-adaptive serving*, crawls predominantly from
US IP addresses, and **explicitly recommends separate URLs per locale** — which is
Option B below.

---

#### ✅ Option A — Index the global view only *(chosen)*

**How it works.** Change nothing about routing. Crawlers see the `ALL` + `US` view.
The sitemap lists **only** `targetCountries: ['ALL']` URLs, and `generateMetadata`
emits `robots: { index: false, follow: true }` for anything else.

| | |
|---|---|
| **Indexed** | All `ALL`-targeted content — the large majority |
| **Not indexed** | Anything exclusively `IN`/`GB`/`AU`/`CA` |
| **Work** | Sitemap filter + the `isGlobal` check in A1. Effectively zero. |

**⚠️ The wrinkle this solves.** Because the crawler's default country is `US`,
US-only pages *are* reachable and indexable via internal links even though they're
absent from the sitemap. If such a page gets indexed, an Indian visitor arriving from
Google hits `notFound()` — a **soft 404**, which Google penalises. The
`robots: { index: false }` line above is what makes Option A actually coherent, not
just convenient. Don't skip it.

**When to revisit:** when geo-restricted content becomes a significant share of the
catalogue, or when organic traffic from a non-US market becomes a goal.

---

#### Option B — Country in the URL path

**How it works.** Restructure to `/[country]/domain/[...slug]`:

```
/us/domain/genai/videogen
/in/domain/genai/videogen
```

Middleware rewrites (or 301-redirects) `/domain/x` → `/{detectedCountry}/domain/x`.
Country then comes from the **path**, not a cookie. Then declare the variants with
`hreflang` so Google treats them as regional alternates rather than duplicates:

```typescript
alternates: {
  canonical: `/in/domain/${domain.slug}`,
  languages: {
    'en-IN': `/in/domain/${domain.slug}`,
    'en-US': `/us/domain/${domain.slug}`,
    'en-GB': `/gb/domain/${domain.slug}`,
    'en-AU': `/au/domain/${domain.slug}`,
    'en-CA': `/ca/domain/${domain.slug}`,
    'x-default': `/us/domain/${domain.slug}`,
  },
},
```

All content is English, so this is region-only differentiation — exactly what
`hreflang` region codes exist for.

**What you gain**
- Every geo variant is independently indexable and correctly region-targeted
- **`force-dynamic` can be removed.** No cookie dependency → pages become
  statically renderable → real ISR, cached HTML, fast TTFB. This also resolves #8
  and much of the SEO-B performance list.
- Users can share a country-specific link that actually stays country-specific

**What it costs**
- **Every internal link must carry the country prefix.** That means
  `navigation.service.ts` (all URL building), `SectionBasedLayout`,
  `SubcategorySelector`, `PageSidebar`, `SidebarDomain`, `bread.tsx`, and
  `generatePagePreviewUrl` in the admin pages API.
- **URL migration.** Existing `/domain/*` URLs need 301s to preserve accrued authority
- Sitemap grows ~5× (countries × pages)
- `hreflang` must be reciprocal and complete, or Google ignores the whole cluster
- Admin UX has to start thinking in country terms

**Effort:** multi-day refactor. Justified only if geo content becomes central.

---

#### ❌ Option C — Detect the crawler and serve it everything

**Do not do this.** Sniffing `User-Agent` for Googlebot and serving content real
users don't get is **cloaking** — explicitly against Google's spam policies, with
manual-action and deindexing risk.

Note the distinction: varying content by the *user's* location is completely fine and
normal. Special-casing the *bot* is what crosses the line.

---

#### Option D — Make geo additive instead of exclusive *(worth considering)*

**How it works.** A product change rather than a routing change: stop *hiding*
geo-restricted content. Show everything to everyone, and let `targetCountries` drive
**ordering, grouping, or a badge** ("Popular in India") instead of visibility.

| | |
|---|---|
| **Gain** | The SEO problem disappears entirely — nothing is hidden, so nothing is unindexable. No URL refactor, no `hreflang`, no migration. `force-dynamic` could arguably go too. |
| **Cost** | Changes what the product *means*. Only viable if geo-targeting is about relevance, not restriction. |

**Worth an explicit answer before ever committing to Option B:** is
`targetCountries` there because Indian users shouldn't *see* US content, or because
Indian users should see Indian content *first*? If it's the latter, Option D is
dramatically cheaper than B and strictly better for SEO.

---

### ⚠️ Honest caveat on what SEO work will and won't achieve

Most public pages are **lists of outbound links** (`SectionBasedLayout`,
`SubcategorySelector`) or **tables** — little original text. `rich_text` pages are the
exception. From a search engine's perspective that is thin content.

So SEO-A will get the site **properly indexed, correctly titled, and cleanly shared** —
real, worthwhile, and a prerequisite for everything else. It will **not** make the site
rank for competitive terms. That requires actual written content on category pages:
intro paragraphs, context, why these particular resources were chosen.

Stated plainly so the outcome matches the expectation.

---

## 🗺️ Recommended Order of Work

All work happens on **`dev-3.0`** (branched from `master` @ `c4ff8d8`), one PR per
phase, merged to `master` → auto-deploys to `atno.io`.

### Phase A — Security + SEO foundation (in progress)
| Commit | Item | Notes |
|---|---|---|
| 1 | **#1** Lock down `/api/admin/*` | `lib/api-auth.ts` + widened middleware + `requireAdmin()` on all 14 routes |
| 2 | **#13** `robots.ts` | With the `VERCEL_ENV` preview guard. *After* #1 — don't signpost `/admin` while it's open. |
| 3 | **#14** SEO-A: `metadataBase` + `generateMetadata` + OG tags | Includes the `robots: { index: false }` guard for geo-restricted pages |
| 4 | **#13** `sitemap.ts` | `targetCountries: ['ALL']` only. Worth crawling now that titles are unique. |

### Phase B — Correctness
5. **#3** Generate the missing `targetCountries` migration → `migrate resolve --applied`
6. **#2** DOMPurify sanitization on rich-text write
7. **#5** Wire up `revalidateTag` on all mutations
8. **#6** Fix the two `new PrismaClient()` instances + add the lint rule

### Phase C — Cleanup
9. **#9** Repoint the two type imports, then delete the 8 deprecated files
10. **#7** Make server breadcrumb work opt-in; dedupe the double `getByPath`
11. **#10** Strip debug logs and the 500-line comment block
12. **#8** Remove the contradictory `revalidate` export; correct the plan doc
13. **#4** Delete the 15 merged branches

### Phase D — Polish
14. **#14** SEO-B: JSON-LD `BreadcrumbList`, `next/image`, real page content
15. **#11** Make the render path read-only; add the `__main__` invariant + health check
16. **#12** Gate or delete `/api/debug/cache-test`
17. Remaining Step 7: error boundaries, structured error responses, rate limiting

### Open decisions
- **Geo strategy** — Option A chosen for now (#14). Revisit if non-US organic traffic
  becomes a goal. **Option D is worth answering explicitly** before ever committing to
  Option B: is `targetCountries` about restricting visibility, or about relevance?
- **`nested-two.vercel.app`** — keep as an alias with `metadataBase` handling the
  canonical, or redirect it to `atno.io`? (#13)

---

## ✅ What's Already Good

Worth stating plainly, so refactoring doesn't undo it:

- **Services layer** (`src/services/`) is genuinely well-structured — clear
  separation, consistent `cache()` wrapping, shared types in one place.
- **`PageService.getByPath`** correctly replaced an N+1 loop with a single batched
  `slug: { in: [...] }` query plus in-memory parent-chain traversal, with a sensible
  per-segment fallback.
- **`usePageContext`'s fetch strategy** is smart: static data fetched once behind a
  ref guard, page-sidebar refetched only when mode or parent context actually
  changes, with `pageType`-aware logic for direct vs hierarchical.
- **Client-derived breadcrumbs** (`bread.tsx`) render instantly with skeleton
  fallbacks and avoid stale labels by checking `loading` before trusting context —
  a real UX improvement over the API-dependent version.
- **Three-tier geo-targeting** (domain → page → table row) is consistently applied,
  and the hidden `targetCountries` system column is properly stripped from public
  payloads by `getPublicSchema`/`getPublicRows`.
- **User management** does the security basics right: bcrypt cost 12, password
  strength rules, self-lockout guards (can't remove own admin / deactivate / delete
  self), soft-delete by default.
- **Layered caching** (React `cache()` → `unstable_cache` → HTTP/CDN) is a sound
  design. It just needs invalidation (#5) to be trustworthy.

---

*Full-codebase audit, July 25 2026. Findings verified against production `master` @ `c4ff8d8`.*
*Revision 2 (July 26): corrected finding #4; added #14 (SEO) with the geo decision record.*
