# 🔧 New Improvements — Findings from Full Codebase Audit

**Created:** July 25, 2026
**Audited:** `phase14` @ `5598778`; all findings re-verified against **production**
`master` **@** `c4ff8d8` (the two differ only in copy changes to `RichTextLayout` /
`TableLayout` plus README).
**Work branch:** `dev-3.0` (branched from `master` @ `c4ff8d8`)
**Scope:** Full read-through of schema, services, all API routes, public rendering path, admin panel, middleware/auth, caching layers, and planning docs.

**Related documents:**

- `REORDERED-EXECUTION-PLAN.md` (execution status — Steps 1–5 done, 6–7 pending)
- `MASTER-TASK-LIST.md` (original 37-task plan)
- `ARCHITECTURE-IMPROVEMENTS-2.md`, `COMPREHENSIVE-PROJECT-ANALYSIS.md`

---



## 📊 Summary Table

Tick the **Done** box when a finding is fully implemented, verified, and merged.
Partially-done findings show which sub-items are complete.


| Done | #   | Finding                                                                          | Severity        | Type               | Effort    |
| ---- | --- | -------------------------------------------------------------------------------- | --------------- | ------------------ | --------- |
| [x]  | 1   | `/api/admin/*` routes mostly unauthenticated                                     | 🔴 **Critical** | Security           | 1–2 hrs   |
| [x]  | 2   | Stored XSS via unauthenticated rich-text write                                   | 🔴 **Critical** | Security           | 2–3 hrs   |
| [x]  | 3   | Migration drift — **no migration history at all**; geo *and* auth models missing | 🔴 **Critical** | Data / Deploy      | 30 min    |
| [ ]  | 4   | Branch hygiene — 15 merged branches, stale local refs                            | 🟡 Medium       | Workflow           | 20 min    |
| [x]  | 5   | Cache tags defined but never invalidated                                         | 🟠 **High**     | Correctness        | 2–3 hrs   |
| [x]  | 6   | `new PrismaClient()` in rich-text routes                                         | 🟡 Medium       | Resource leak      | 10 min    |
| [x]  | 7   | Dead breadcrumb work on every request                                            | 🟡 Medium       | Performance        | 30 min    |
| [ ]  | 8   | `force-dynamic` — every page view is a function invocation                       | 🟠 **High**     | Performance        | multi-day |
| [x]  | 9   | Deprecated APIs/hooks still shipping + type coupling                             | 🟡 Medium       | Tech debt          | 1–2 hrs   |
| [x]  | 10  | `console.log` in hot render paths                                                | 🟢 Low          | Hygiene            | 15 min    |
| [ ]  | 11  | DB write during page render (`getOrCreateMainPage`)                              | 🟢 Low          | Design smell       | 1 hr      |
| [x]  | 12  | `/api/debug/cache-test` open in production                                       | 🟢 Low          | Info leak          | 5 min     |
| [x]  | 13  | No `robots.txt` / `sitemap.xml` (404s in Vercel logs)                            | 🟢 Low          | SEO                | 30 min    |
| ~    | 14  | **Every page shares one title** — no per-page metadata                           | 🟠 **High**     | SEO / Growth       | 2 hrs (A) |
| ~    | 15  | Geo implementation — stale cookie, dead CDN cache, lost cookie on redirects      | 🟡 Medium       | Correctness / Perf | 1–2 hrs   |


**Sub-items:**


| Done | Item                                                | Notes                                                                           |
| ---- | --------------------------------------------------- | ------------------------------------------------------------------------------- |
| [x]  | 13.1 `robots.ts`                                    | Phase A commit 2                                                                |
| [x]  | 14.A0 Root `/` redirect 307 → 308                   | Shipped with commit 2                                                           |
| [x]  | 14.A1 Per-page `generateMetadata`                   | Phase A commit 3                                                                |
| [x]  | 14.A2 `metadataBase` / canonical origin             | Phase A commit 3                                                                |
| [x]  | 14.A3 Open Graph + Twitter cards                    | Phase A commit 3 — no image yet, card is `summary`                              |
| [x]  | 14.A4 Brand favicons + static OG share image        | Phase A commit 4 — card is now `summary_large_image`                            |
| [x]  | 14.A5 `/domain` title made brand-led                | `/` redirects here, so it's the de-facto homepage                               |
| [ ]  | 14.A6 Per-page generated OG cards                   | `opengraph-image.tsx` + `ImageResponse`. One line in `buildOpenGraph` to switch |
| [ ]  | 14.A7 `manifest.ts` for Android / PWA install       | The favicon.io `site.webmanifest` has empty `name` fields                       |
| [ ]  | 14.B SEO-B backlog (JSON-LD, `next/image`, content) | Phase D                                                                         |
| [x]  | 13.2 `sitemap.ts`                                   | Phase A commit 5 — 1198 URLs, depth up to 4                                     |
| [ ]  | 13.3 Canonicalise `nested-two.vercel.app`           | Partly handled by `metadataBase` in commit 3                                    |
| [x]  | 15.1 `Vary: Cookie` kills the CDN cache             | Country moved into the URL; cacheable only when explicit                        |
| [x]  | 15.2 Country cookie never refreshed                 | Re-detects per request, writes only on change; `maxAge` 1yr → 30d               |
| [x]  | 15.3 Cookie dropped on early returns                | Shipped with #1                                                                 |
| [ ]  | 15.4 `noindex` for geo-restricted pages             | Ships with #14 / SEO-A                                                          |


---



## ✅ 1. Most `/api/admin/*` Routes Are Completely Unauthenticated

**Status:** **[x] DONE** — Phase A commit 1 on `dev-3.0`. Shipped together with #15.3.

**What was actually built** (click to expand)


| File                          | Change                                                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/api-auth.ts`         | **New.** `requireAdmin()` returning a discriminated union — `{ ok: true, session }` or `{ ok: false, response }`.                   |
| `src/middleware.ts`           | Rewritten. Now matches `/api/admin` as well as `/admin`; returns JSON 401/403 for APIs; every exit path carries the country cookie. |
| 9 unguarded route files       | `requireAdmin()` added to every handler.                                                                                            |
| 5 already-guarded route files | Refactored onto the same helper.                                                                                                    |


**36 handlers across 14 files — all guarded.** Verified: handler count == guard count per file.

The refactor also fixed two latent bugs in the 5 files that *were* protected: their
inline `if (!session?.user?.isAdmin)` returned **403 to anonymous callers** (should be
401), and **never checked** `isActive` — so a soft-deleted admin kept full access until
their 24-hour JWT expired.

Deviation from the plan below: `requireAdmin()` returns a **tagged object**, not
`NextResponse | null`. The handlers need the session (`createdBy`, self-protection
checks), and returning it from the guard means they never call `auth()` twice.

**Verified:** `tsc --noEmit` clean · `npm run build` passes · all admin endpoints 401
when unauthenticated across GET/PUT/PATCH/DELETE · public routes unaffected ·
`set-cookie: user-country` present on the 307 redirect, the 200 page, and the 401.



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


| Route file                              | Methods                     | Auth check |
| --------------------------------------- | --------------------------- | ---------- |
| `api/admin/categories/route.ts`         | GET, POST                   | ✅ Yes      |
| `api/admin/domains/route.ts`            | GET, POST                   | ✅ Yes      |
| `api/admin/pages/route.ts`              | GET, POST                   | ✅ Yes      |
| `api/admin/users/route.ts`              | GET, POST                   | ✅ Yes      |
| `api/admin/users/[id]/route.ts`         | GET, PUT, DELETE            | ✅ Yes      |
| `api/admin/categories/[id]/route.ts`    | GET, PUT, **DELETE**        | ❌ **NONE** |
| `api/admin/domains/[id]/route.ts`       | GET, PUT, PATCH, **DELETE** | ❌ **NONE** |
| `api/admin/pages/[id]/route.ts`         | GET, PUT, **DELETE**        | ❌ **NONE** |
| `api/admin/sections/[id]/route.ts`      | GET, PUT                    | ❌ **NONE** |
| `api/admin/tables/route.ts`             | GET, POST                   | ❌ **NONE** |
| `api/admin/tables/[id]/route.ts`        | GET, PUT, DELETE            | ❌ **NONE** |
| `api/admin/tables/[id]/data/route.ts`   | GET, PUT, **DELETE**        | ❌ **NONE** |
| `api/admin/rich-text/route.ts`          | GET, POST                   | ❌ **NONE** |
| `api/admin/rich-text/[pageId]/route.ts` | GET, PUT, DELETE            | ❌ **NONE** |


**9 of the 14 admin route files are open** (36 handlers total across all 14).
What an anonymous request can do today:

- `DELETE /api/admin/domains/{id}` → deletes a domain **and every page inside it**
(transaction deletes all `ContentBlock`s, then all `Page`s, then the `Domain`)
- `DELETE /api/admin/pages/{id}` → deletes a page **and all recursive descendants**
- `PUT /api/admin/tables/{id}/data` → replace or wipe any table's entire dataset
- `PUT /api/admin/rich-text/{pageId}` → inject arbitrary HTML into any page (see #2)
- `PUT /api/admin/sections/{id}` → scramble any page's 3-column layout
- `PATCH /api/admin/domains/{id}` → publish/unpublish domains, change geo-targeting
- `GET /api/admin/tables?...` → dump every table's full contents, **including the
hidden** `targetCountries` **column** that is normally stripped from public views



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
can plant** `<script>` **/** `<img onerror=...>` **on a public page** — which then executes in
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



## ✅ 3. Migration Drift — **[x] DONE** (27 Jul 2026)

**Severity:** was Critical. Resolved on production, `development` and a rehearsal branch.

> ⚠️ **This finding was materially understated.** The heading used to read
> "`targetCountries` has no migration". Two things turned out to be worse:
>
> **1. There was no migration history at all.** `prisma migrate status` reported
> **all nine** migrations as unapplied, because the `_prisma_migrations` table
> **did not exist** in production. The database had been built entirely with
> `prisma db push`, so Prisma had no record of anything ever having been applied.
>
> **2.** `targetCountries` **was not the only missing schema.** Replaying every
> migration into an empty shadow database and diffing against `schema.prisma`
> revealed the **entire authentication schema** was absent too:
>
>
> |                    |                                                                                        |
> | ------------------ | -------------------------------------------------------------------------------------- |
> | Migrations created | `Domain`, `Page`, `ContentBlock`, `DomainCategory`, `Table`, `RichTextContent` — **6** |
> | Schema declares    | those 6 **plus** `User`, `Account`, `Session`, `VerificationToken` — **10**            |
>
>
> So a fresh `prisma migrate deploy` produced a database with **no** `User` **table**.
> Even after fixing the geo columns, that database would have had no way to log in
> (`authorize()` querying a nonexistent table), no NextAuth adapter models, and
> `prisma/seed-admin.ts` unable to create the first admin.
>
> **This was not findable by reasoning.** The plan was to write the geo migration
> and stop. Only the shadow-database replay surfaced it — which is the argument for
> doing the rigorous check rather than trusting `migrate status`.



### What was done — "baselining", Prisma's process for adopting migrations

Two migration files were added, then **all eleven** were registered as already
applied via `migrate resolve --applied`, which writes a history row and **executes
no SQL**:


| File                               | How it was produced                                                                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `20260727120000_add_geo_targeting` | Hand-written to match `information_schema` exactly: `TEXT[]`, **no** `NOT NULL` (`is_nullable=YES`), `DEFAULT ARRAY['ALL']::TEXT[]` |
| `20260727130000_add_auth_models`   | **Generated by Prisma** via `migrate diff --from-migrations`, so it matches `schema.prisma` exactly rather than approximately       |


> The `NOT NULL` detail mattered. Prisma models a scalar list (`String[]`) as a
> *nullable* Postgres array and treats SQL NULL as an empty list, so it never emits
> `NOT NULL` for one. Adding it would have made every new database permanently
> stricter than production.



### Verification, weakest to strongest

```
migrate status (production)     ->  "Database schema is up to date!"
drift vs schema.prisma          ->  "-- This is an empty migration."
migrate diff --from-migrations  ->  "-- This is an empty migration."
```

Then the test that actually reproduces the bug — empty a database, run what a
teammate would run:

```
prisma migrate deploy  ->  all 11 applied

PASS  all 10 tables present
PASS  Domain.targetCountries   _text nullable=YES default=ARRAY['ALL'::text]
PASS  Page.targetCountries     _text nullable=YES default=ARRAY['ALL'::text]
PASS  DomainService-style country-filtered query runs   <- this was the 500
PASS  User table queryable                              <- login was impossible
PASS  11 migrations recorded
```

Live site unaffected throughout: `/domain`, `/domain/gdesign`, `/sitemap.xml` and
`/api/page-context` all returned 200 after baselining production.

### Process notes worth keeping

`directUrl` **was NOT required.** All 11 `migrate resolve` calls succeeded over
Neon's **pooled** endpoint. Neon's own snippet says `directUrl` is only needed for
Prisma < 5.10 and this project is on **6.14.0**. An earlier revision of this
document called it a prerequisite; that was wrong, and no schema change was made.

**A target guard was used before every command.** Prisma reads `.env` by default,
and `migrate resolve` / `migrate deploy` have no confirmation prompt — so a stale
`.env` silently hits the wrong database. The guard parses the endpoint out of
`DATABASE_URL` and throws unless it matches the expected branch.

> It also caught its own bug: the first version drew a box with Unicode characters,
> Windows PowerShell 5.1 read the UTF-8 file as ANSI, and it died with a parse
> error. The "must abort on production" test *appeared* to pass — but only because
> of the crash, not the logic. **Testing the negative case is what exposed that.**



### ⚠️ Related finding — local dev was pointed at PRODUCTION

Discovered while setting this up: `.env`'s `DATABASE_URL` was the **production**
endpoint (`ep-bold-meadow-adyn4vas`). So `npm run dev` read and wrote the live
database — creating a test page locally created it on `atno.io`; deleting one
deleted it for real.

**Fixed.** The pre-existing (unused, 6-month-old) `development` branch was
**Reset from parent** to become a current copy, and `.env` now points there.
Verified: 34 domains / 1195 pages / 651 tables / 3 users, and it inherited all 11
baselined migrations. `.env` documents all three branches with only one pair
uncommented at a time.

Vercel is unaffected — production reads its own env vars from the Vercel dashboard.

### Still open — `updatedAt` on `Page` and `Domain`

Needed so `sitemap.ts` can emit honest `lastModified` dates (see #13). Not part of
the drift fix; tracked as Phase B.

The auth migration revealed the constraint: Prisma writes `@updatedAt` as
`TIMESTAMP(3) NOT NULL` **with no default**, which cannot be added directly to
tables that already hold 34 and 1195 rows. It needs a backfill:

```sql
ALTER TABLE "Domain" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "Domain" SET "updatedAt" = "createdAt";   -- honest: unedited rows were last
ALTER TABLE "Domain" ALTER COLUMN "updatedAt" SET NOT NULL;   -- changed at creation
```

Backfilling from `createdAt` rather than `CURRENT_TIMESTAMP` matters: the latter
would stamp all 1229 rows as "modified today" and tell Google the entire site
changed at once.

---

**Original analysis (for reference)**

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
**no** `targetCountries` **columns**. Then every navigation query fails, because
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

> This last instruction was the right one, and following it properly is what found
> the missing auth models. `migrate status` alone was **not** sufficient —
> `migrate diff --from-migrations` against a shadow database was.



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
Production Deployment, push to the* `master` *branch."* All phase work was merged via
PRs #2–#5 (Feb 3–10). Next.js on `master` is `15.5.9`, i.e. CVE-patched.
**Nothing needs merging.**

> ⚠️ **Correction.** An earlier revision of this document claimed `master` was four
> months stale and missing the services layer, geo-targeting, and the Next.js
> security patch. That was **wrong**. It was derived from a local clone whose
> remote-tracking refs had not been fetched since October 2025, so both `master` and
> `origin/master` pointed at `f01a212`. **Always** `git fetch` **before comparing
> branches** — `git log`, `git rev-list`, and `git branch -vv` all silently report
> against the last-fetched snapshot, with no warning that it is out of date.



### Actual issues

1. **15 fully-merged branches** (`phase1`–`phase14`, `branch7`) still exist locally
  and on the remote. Every one is an ancestor of `origin/master`. They clutter the
   branch list, and each still produces Vercel preview deployments — which are
   publicly crawlable (see #13).
2. **Local** `master` **was stale** at `f01a212`. Fixed with
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


| Data                       | Duration                                    | Admin edit invisible for |
| -------------------------- | ------------------------------------------- | ------------------------ |
| Domains, Pages, Navigation | `MEDIUM` = 60s                              | up to 1 minute           |
| Categories                 | `LONG` = 300s                               | **up to 5 minutes**      |
| `/api/page-context` (CDN)  | `s-maxage=60`, `stale-while-revalidate=300` | up to 5 min stale        |


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


| Route                                       | Call after success                          |
| ------------------------------------------- | ------------------------------------------- |
| `POST/PUT/PATCH/DELETE /api/admin/domains*` | `invalidateDomains()` + `invalidatePages()` |
| `POST/PUT/DELETE /api/admin/pages*`         | `invalidatePages()`                         |
| `POST/PUT/DELETE /api/admin/categories*`    | `invalidateCategories()`                    |
| `PUT /api/admin/sections/[id]`              | `invalidatePages()`                         |
| `POST/PUT/DELETE /api/admin/tables*`        | `invalidateTables()`                        |
| `PUT/POST/DELETE /api/admin/rich-text*`     | `invalidatePages()`                         |


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



## 🟠 8. `revalidate` and `force-dynamic` Contradict Each Other

**Severity:** ~~Medium (cosmetic)~~ → **raised to High.** No longer cosmetic: this is now
the single largest remaining performance cost on the site.

> ### 📈 Measured in production, 28 Jul 2026
>
> Vercel logs show **~24 `/domain/<slug>` requests inside one second** (`11:54:22–23`) —
> a crawler sweeping the sitemap. **Every one is a function invocation** doing a full
> dynamic render plus database queries. In the same log window `/api/page-context` shows
> a **cache** icon rather than an `f`, confirming #15.1 works — but it removed one
> function call per page view, while the page render itself is still one per view.
>
> So the page renders, not the API, are where the cost now sits.
>
> ⚠️ **Deleting `export const dynamic = 'force-dynamic'` would achieve NOTHING.** In
> Next 15, calling `cookies()` in a Server Component opts that route into dynamic
> rendering on its own, regardless of the `dynamic` export. The real cause is:
>
> ```typescript
> const userCountry = await getUserCountryFromCookies();   // <- this forces dynamic
> ```
>
> And the sting: because **no content is geo-restricted** (0 domains, 0 pages, 0 of
> 8050 table rows — see the audit in #15), that cookie read currently changes nothing
> about the output. All 24 of those renders produced exactly what a static build would
> have produced.
>
> **The fix is Option B from the geo decision record** — country in the route
> (`/[country]/domain/...`) or a middleware rewrite — which removes the cookie
> dependency and lets these pages be statically rendered with real ISR. That is a
> multi-day refactor touching every internal link (`navigation.service.ts`,
> `SectionBasedLayout`, `SubcategorySelector`, `PageSidebar`, `SidebarDomain`,
> `bread.tsx`, `generatePagePreviewUrl`), so it is **flagged, not scheduled**.
>
> Worth revisiting whenever page-render cost or crawl budget becomes a concern — it is
> the largest single lever left.

---

## 🧭 8-DR. Decision Record — Static Rendering vs Domain/Page Geo-Targeting

**Status: OPEN. Nothing decided, nothing implemented.** Recorded 28 Jul 2026 so the
reasoning survives outside a chat window.

This record exists because a proposal to make the public pages static was investigated,
found to be far cheaper than first estimated, and then **rejected** on evidence — and
that investigation surfaced a much more consequential problem that has nothing to do
with performance.

### 8-DR.1 — The proposal, and why it looked cheap

`/domain/*` pages are `force-dynamic`, so every view is a serverless invocation with
database queries. Production logs showed **~24 invocations inside one second** during a
crawler sweep of the sitemap.

Investigating what actually forces dynamic rendering produced a genuinely useful finding:

> ⚠️ **Deleting `export const dynamic = 'force-dynamic'` would achieve nothing.** In
> Next.js 15, calling `cookies()` in a Server Component opts that route into dynamic
> rendering by itself. The real cause is `getUserCountryFromCookies()`.

And there are only **three** such calls across the two public page files — with no
`searchParams` or `headers()` usage anywhere to force dynamic rendering independently:

```
src/app/domain/page.tsx:160
src/app/domain/[...slug]/page.tsx:75    (inside generateMetadata)
src/app/domain/[...slug]/page.tsx:244   (inside the page component)
```

**And a second finding made it look cheaper still.** Table-row filtering — the primary
use of `targetCountries` — never touches the page render at all:

```
src/app/api/domain/tables/by-page/[pageId]/route.ts:44
    const userCountry = getUserCountryFromRequest(request);
    const tableData = await TableService.getPublicTable(pageId, userCountry);
```

That is a **separate, client-fetched API route** (called from `TableLayout.tsx:51`) which
reads the cookie itself. So the server-rendered HTML uses the country for exactly three
things, all of them domain/page-level *visibility*:

| Location | Call | Level |
|---|---|---|
| `[...slug]/page.tsx:87`, `:252` | `isContentVisibleToUser(domain.targetCountries, …)` | domain |
| `[...slug]/page.tsx:132`, `:293` | `PageService.getByPath(…, userCountry)` | page |
| `[...slug]/page.tsx:272`, `:311` | `PageService.getChildPages(…, userCountry)` | page |

The proposal therefore became: **stop filtering by country at domain/page level**, and
the pages can be static. Table rows keep filtering exactly as they do now. Estimated at
about half a day — versus the "multi-day, rewrite every internal link" figure originally
attached to Option B.

### 8-DR.2 — ❌ Why it was rejected

The proposal rested on an assumption, taken from a verbal summary rather than from the
plan itself: *that only "one or two" domains and pages would ever carry a country tag.*

**The product plan (Notion → Domains Builder, Domain Data) contradicts that.**
Domain/page-level geo is structural and growing:

**Whole domains that are inherently India-specific**

| Domain | Evidence |
|---|---|
| `For Entrepreneurs \| Startups [Indian]` | `[Indian]` is in the name |
| `Import & Export Business Data` | Its page list *is* Indian regulation: *Important Indian Embassy Contacts*, *Export Promotion Councils*, *Major Trade Association in India*, *HS Code*, *Sector-Specific Approvals*, *Licenses & Documents*, *Incentives*, *Certification Bodies* |
| `Dropshipping [Indian]` | Already a row in the database |

**India-specific pages inside otherwise global domains**

| Page | Parent domain |
|---|---|
| *Indian Market Understanding ( Backed By Data, Charts, Statistics )* | E-commerce Business |
| *Tools for Product Demand Research (India Specific)* | E-commerce Business |
| *Selling On MarketPlaces ( Amazon \| Flipkart \| Meesho )* | E-commerce Business — Flipkart and Meesho are India-only |

So both levels are genuinely used, and the set grows with the catalogue.

**What dropping the filter would look like in practice:** an American visitor opening
`Import & Export Business Data` would be served *"Important Indian Embassy Contacts"* and
*"Export Promotion Councils"*. That is not a small relevance miss — it makes the site
look unmaintained.

> ⚠️ **Process note.** The half-day estimate came from accepting a summary of the geo
> plan instead of asking to see it. The plan was one screenshot away. **When an estimate
> hinges on how much of something exists, count it.** This is the same failure mode as
> the `lastmod` estimate in #13, which assumed child-row edits were an edge case and
> turned out to affect 91.7% of pages.

### 8-DR.3 — ⚠️ The real problem this uncovered: tagging content deletes it from Google

This matters more than the performance work, and it is **latent right now** — no content
is tagged yet, so nothing is lost. It triggers the moment the tagging work begins.

**The mechanism:**

```
1. Googlebot crawls from US IP addresses and sends NO cookies
2. src/middleware.ts assigns DEFAULT_COUNTRY = 'US'
3. buildCountryFilter('US') -> OR: [ has 'ALL', has 'US' ]
4. A domain or page tagged ["IN"] matches neither
5. isContentVisibleToUser() / getByPath() -> notFound() -> 404 TO GOOGLEBOT
6. It can never be indexed. Not "ranks poorly" - never enters the index.
```

Plus `sitemap.ts` filters to `targetCountries: ['ALL']` and `generateMetadata` emits
`robots: { index: false }` for anything else — both correct given the above, and both
reinforcing it.

**Concretely:** tag `Import & Export Business Data` as `IN` and every page in it
disappears from search. An Indian person googling *"export promotion councils India"* —
precisely the target audience — will never find `atno.io`.

> **The architecture currently punishes you for using the geo feature.** The more
> India-specific content is built and tagged, the more search visibility is destroyed.
> And the loss is not instantly recoverable: untagging later starts the indexing clock
> again from zero.

This is why the decision belongs **before** the tagging work, not after.

### 8-DR.4 — The three options, with honest costs

#### Option 1 — Status quo: stay dynamic, keep geo

| | |
|---|---|
| **Performance** | ❌ Every page view is a function invocation with DB queries |
| **Domain/page geo** | ✅ Works as designed |
| **India content in Google** | ❌ Invisible, permanently, once tagged |
| **Cost** | Zero |

Viable only while little content is tagged. Gets worse as the catalogue grows.

#### Option 2 — Middleware rewrite: performance only

Middleware already runs on every request and already resolves the country. It can
`NextResponse.rewrite()` `/domain/x` to an internal `/[country]/domain/x` route.

| | |
|---|---|
| **Performance** | ✅ Pages statically cacheable per country |
| **Domain/page geo** | ✅ Preserved — the country is in the internal path |
| **India content in Google** | ❌ **Still invisible.** Googlebot resolves to `US`, so it only ever reaches the US variant |
| **Internal links** | ✅ Unchanged — they keep pointing at `/domain/x`; middleware rewrites again |
| **Visible URL** | ✅ Unchanged |
| **Cost** | ~1 day |

Also needs: `revalidatePath` added to `cache-invalidation.ts` (ISR-cached **HTML** is a
different cache from the Data Cache, so `revalidateTag` alone will not bust it — the same
ordering trap as #15.1), and canonical tags checked so all country variants point at one
canonical URL.

**Buys the performance, leaves the bigger problem untouched.**

#### Option 3 — Real country paths + `hreflang`: performance *and* discoverability

`/in/domain/importexport` and `/us/domain/...` as genuine, linkable URLs, declared to
Google as regional alternates:

```typescript
alternates: {
  canonical: `/in/domain/${slug}`,
  languages: {
    'en-IN': `/in/domain/${slug}`,
    'en-US': `/us/domain/${slug}`,
    'x-default': `/us/domain/${slug}`,
  },
},
```

| | |
|---|---|
| **Performance** | ✅ Every variant statically renderable |
| **Domain/page geo** | ✅ Preserved |
| **India content in Google** | ✅ **Indexable and region-targeted in India** |
| **Internal links** | ❌ Every one must carry the country prefix |
| **Existing URLs** | ❌ Need 301s to preserve accrued authority |
| **Cost** | Multi-day |

Touches `navigation.service.ts` (all URL building), `SectionBasedLayout`,
`SubcategorySelector`, `PageSidebar`, `SidebarDomain`, `bread.tsx`, and
`generatePagePreviewUrl`. Sitemap grows roughly 5×. `hreflang` must be reciprocal and
complete or Google ignores the cluster entirely. Admin UX starts having to think in
country terms.

**The only option where tagging content does not cost search traffic.**

#### ❌ Not an option — drop domain/page geo

Rejected on the evidence in 8-DR.2.

#### ❌ Not an option — serve everything to crawlers

Detecting Googlebot and showing it content real users cannot see is **cloaking**, against
Google's spam policies, with deindexing risk. Recorded as Option C in #14 and still
prohibited.

### 8-DR.5 — The question to answer

> **Should India-specific content be findable in Google in India, or is it acceptable
> for it to be visitor-only?**

- **Findable** → Option 3. Plan it as a project, not a performance tweak.
- **Visitor-only** → Option 2 gets the performance for a fraction of the effort.
- **Not yet** → Option 1, but decide before tagging a large amount of content.

### 8-DR.6 — What this blocks

**#8 is not scheduled and should not be picked up as "make the pages static".** It is
downstream of 8-DR.5.

**Nothing else is blocked.** #2 (DOMPurify) and all of Phase C are independent, carry no
product decisions, and are the sensible next work.

---

**Original severity note:** Medium (cosmetic, but actively misleading).

Both public pages declare:

```typescript
export const revalidate = 60;              // src/app/domain/page.tsx
export const dynamic = 'force-dynamic';    // src/app/domain/[...slug]/page.tsx
```

`force-dynamic` opts the route out of static generation entirely, so
`revalidate = 60` **has no effect.** Every request renders fresh.

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


| Deprecated API route                  | Deprecated hook                   |
| ------------------------------------- | --------------------------------- |
| `src/app/api/header-domains/route.ts` | `src/hooks/useHeaderData.ts`      |
| `src/app/api/sidebar/route.ts`        | `src/hooks/useSidebarData.ts`     |
| `src/app/api/page-sidebar/route.ts`   | `src/hooks/usePageSidebarData.ts` |
| `src/app/api/breadcrumb/route.ts`     | `src/hooks/useBreadcrumbData.ts`  |


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


| File                                                                  | Note                                                                                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/components/table/DataTable.tsx:124`                              | ⚠️ **Inside the cell renderer** — fires **per cell** for every description column, on every render, sort, filter, and paginate |
| `src/components/admin/layout/AdminSidebar.tsx:113`                    | `console.log("pathname", pathname)` on every admin navigation                                                                  |
| `src/components/domain/TableLayout.tsx`                               | Commented-out logs + **~500 lines of pasted JSON sample output** in comments                                                   |
| `src/app/api/page-sidebar/route.ts`                                   | Commented debug blocks (file is deprecated → delete per #9)                                                                    |
| `src/hooks/usePageSidebarData.ts`                                     | Deprecated → delete per #9                                                                                                     |
| `src/hooks/useUserCountry.ts`, `src/components/auth/LogoutButton.tsx` | Minor                                                                                                                          |


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

This **creates a** `Page` **row** if `__main__` is missing. Because the route is
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

### ✅ Fix — `src/app/robots.ts` — **[x] DONE** (Phase A commit 2)

Shipped output, verified from the build artifact (`.next/server/app/robots.txt.body`):

```
User-Agent: *
Allow: /api/domain/
Allow: /api/page-context
Disallow: /admin
Disallow: /api/
Disallow: /login
Disallow: /unauthorized
Disallow: /header1

Host: https://atno.io
Sitemap: https://atno.io/sitemap.xml
```

Preview builds (`VERCEL_ENV !== 'production'`) correctly emit only:

```
User-Agent: *
Disallow: /
```

> ⚠️ **Two corrections to the plan this section originally contained.** The original
> draft was `disallow: ['/admin', '/api/', '/login', '/unauthorized']` with a blanket
> `allow: '/'`. Do not copy that version — it was wrong in a way that would have
> *damaged* SEO:
>
> **1. A blanket** `Disallow: /api/` **hides table content from Google.** Googlebot renders
> JavaScript, but it re-checks `robots.txt` for every subresource it fetches during
> rendering. Two **public** endpoints are fetched client-side:
>
>
> | Endpoint                              | Called from                 | What breaks if blocked                                                                                           |
> | ------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
> | `/api/domain/tables/by-page/[pageId]` | `TableLayout.tsx:51`        | **The entire contents of every** `table` **page.** The rows *are* the content — Google would see an empty shell. |
> | `/api/page-context`                   | `usePageContext.ts:393,553` | Sidebar + header nav → Googlebot can't follow internal links to deeper pages.                                    |
>
>
> Hence the two `Allow:` lines. Google resolves Allow/Disallow conflicts by
> **longest matching path**, not file order: `/api/domain/` (12 chars) beats `/api/`
> (5 chars). Next.js emits `Allow` before `Disallow` anyway, which also satisfies
> simpler first-match crawlers.
>
> **2.** `/header1` **was missing from the list.** `src/app/header1/page.tsx` is the stock
> shadcn/Radix `NavigationMenu` demo — placeholder copy ("Alert Dialog", "Hover Card")
> and dead links to `/docs/primitives/*` — and it is **live and crawlable on**
> `atno.io`. Blocked here as a stopgap; it should be **deleted** (added to Phase C).

**Design note — blanket-block plus whitelist, not an itemised list.** `Disallow: /api/`
means a route added next month is private by default. Itemising the current routes
instead would mean every new endpoint is crawlable until someone remembers to add it.

**Also deliberately blocked:** `/login` — the middleware appends `?callbackUrl=…` on
every redirect, so without this a crawler can burn budget on dozens of URLs that all
render the same form.

> ⚠️ `Sitemap:` **currently points at a 404** — `sitemap.ts` is commit 4. Consequence
> is one "Sitemap could not be read" warning in Search Console, which clears itself.
> Included now on purpose: crawlers re-read `robots.txt` roughly daily, so a line
> that's briefly wrong beats one we forget to add.

**Two things** `robots.txt` **does *not* do** — both worth internalising, because it's easy
to assume otherwise:

1. **It is not security.** It's a voluntary request. A malicious scraper ignores it.
  And it's a *public file*, so everything listed above is now advertised. That is
   precisely why #1 had to ship first — publishing "the admin panel is at `/admin`" is
   fine once those routes are 401-guarded, and would have been an invitation before.
2. `Disallow` **is not** `noindex`**.** If another site links to a blocked URL, Google can
  still list the bare URL with no snippet — it sees the link, just not the content.
   Keeping something genuinely *out* of the index needs `robots: { index: false }` in
   page metadata, which is a different mechanism (#14 / SEO-A, for geo-restricted
   pages).



### ✅ Fix — `src/app/sitemap.ts` — **[x] DONE** (Phase A commit 5)

**1198 URLs.** Verified against a running production build: no `__main__` leaked, no
duplicates, and every one of 20 sampled URLs (deepest first) returned **200**.

```
depth 1:   34   /domain/webdev
depth 2:  712   /domain/webdev/withcode
depth 3:  382   /domain/webdev/withcode/definingservices
depth 4:   69   /domain/webdev/withcode/definingservices/portfoliowebsite
```

> ⚠️ **The planned query would have produced a sitemap that was 39% broken links.**
> It selected all pages and emitted `/domain/${d.slug}/${p.slug}` — flattening every
> page to depth 2. That is correct only for the 712 depth-2 URLs; the 382 depth-3 and
> 69 depth-4 URLs — **451 of 1163 page URLs** — would have 404'd. Pages sharing a slug
> under different parents would also have collided into duplicate entries.
>
> A sitemap full of 404s is **worse than no sitemap**: it teaches Google the site is
> unreliable and wastes the crawl budget you were trying to direct.
>
> `buildPagePath()` walks the `parentId` chain upward in memory (one query per domain,
> zero per page — a query per parent would be a textbook N+1 on 1163 pages), mirroring
> the traversal in `PageService.getByPath`.

**Two correctness details that only show up at depth:**

- **A page is only public if its ENTIRE ancestor chain is** `ALL`**-targeted.** When a
parent is missing from the filtered set, `buildPagePath` returns `null` and the page
is dropped. `PageService.getByPath` applies the same country filter and then walks
segment by segment — so an invisible intermediate page makes its children 404 even
when the children themselves are global. A naive filter checking only the page's own
`targetCountries` would list URLs that cannot be reached.
- **Cycle guard.** `parentId` is a plain self-relation with no constraint preventing a
page being its own ancestor. One corrupt row would spin the traversal forever and
hang `next build`. A `Set` of visited ids bounds it.

`export const revalidate = 3600`**.** Without this, Next renders the sitemap once at
build time and serves that snapshot forever — silently omitting every domain and page
added through the admin panel since the last deploy. The query is also wrapped in
`try/catch` returning the single static entry, because `revalidate` means this runs
during `next build`: an unreachable database would otherwise fail the whole deploy.

**✅** `lastModified` **— now emitted on all 1198 entries** (added 27 Jul 2026).

Originally omitted because it could not be computed honestly: `Page` and `Domain` had
only `createdAt`. Migration `20260727140000_add_updated_at` added the column — see
Phase B item 5b below for the backfill detail that made it worthwhile.

Verified date distribution — a real spread, not one artificial spike:

```
2025-09    271 urls        entries stamped today: 0
2025-10    491 urls
2026-02    299 urls
2026-03    136 urls
```

`/domain` has no row of its own, so it takes `max(domain.updatedAt)` — adding,
renaming or unpublishing a domain genuinely changes what that page renders. It is set
*after* the query so the static entry still survives an unreachable database.

> ⚠️ `Page.updatedAt` **alone was NOT enough — and this was nearly shipped wrong.**
>
> An earlier revision of this document called it a "known limitation" affecting some
> pages, and said it "understates freshness, which is the safe direction". **Both
> claims were wrong.** Measured against real data:
>
> ```
> Pages by contentType (excluding __main__):
>   table               666    57.3%     content in Table.data
>   rich_text           418    35.9%     content in RichTextContent.htmlContent
>   subcategory_list     74     6.4%     content is the child Page rows
>   section_based         5     0.4%     content in Page.sections  (SAME row)
>
> content on a CHILD row : 1066   91.7%
> content on the Page row:   97    8.3%
> ```
>
> **91.7% of pages keep their content in a child row** — and it was already wrong,
> not wrong in theory. Every one of the 651 table pages and 415 rich-text pages had a
> child timestamp NEWER than its page timestamp, by up to **147 days**:
>
> ```
> tools    sitemap said 2025-09-12   content changed 2026-02-06   147 days stale
> courses  sitemap said 2025-09-12   content changed 2026-02-06   147 days stale
> ytube    sitemap said 2025-09-12   content changed 2026-02-06   147 days stale
> ```
>
> Systematically stale values are exactly what makes Google discard `lastmod` for an
> entire sitemap — the failure this column was added to prevent. "Safe direction" was
> the wrong framing: it would have been worse than emitting nothing.

**Fixed** by `pageLastModified()` in `sitemap.ts`, which takes the newest of the page
row and its content rows. Prisma resolves the two one-to-one relations as joins, so it
remains one query per domain — no N+1. Effect:

```
BEFORE                            AFTER
  2025-09    271 urls               2025-09     57 urls
  2025-10    491 urls               2025-10     49 urls
  2026-02    299 urls               2026-02    955 urls
  2026-03    136 urls               2026-03    137 urls
```

**912 URLs moved to their real dates.**

The domain root URL takes `max(domain.updatedAt, __main__ page's effective date)` —
for a `direct` domain the visible content is `__main__`'s. It deliberately does **not**
roll up every descendant: for a hierarchical domain a child's table contents changing
does not alter the root listing, and rolling that up would inflate the date on nearly
every edit anywhere in the domain. **Overstating** freshness is the direction Google
actually penalises, and each child has its own accurate entry regardless.

> ⚠️ **When adding a new content type**, if it stores content in a NEW table, add that
> relation to the `select` and to `pageLastModified()`. Otherwise pages of that type
> silently report a stale `lastmod` — precisely how this went wrong the first time.
>
> **The durable alternative, worth doing at three content tables:** make
> `Page.updatedAt` mean "this page's content changed" by touching the parent row on
> every child write — either explicitly
> (`prisma.page.update({ where: { id: pageId }, data: {} })`) from each mutation
> route, or automatically via a Prisma Client extension intercepting writes to any
> model with a `pageId`. Then `sitemap.ts` reads one field again and needs no changes
> when a content type is added. Better data model too — a meaningful `Page.updatedAt`
> would also serve the admin UI and cache invalidation (#5). Not done now because
> with exactly two content tables, reading both here is simpler and **cannot be
> forgotten at write time**.

**Two fields still deliberately omitted:**


| Field             | Why                                            |
| ----------------- | ---------------------------------------------- |
| `changeFrequency` | Google's documentation states it ignores this. |
| `priority`        | Likewise ignored.                              |


Both were in the plan below. Omitted for the same reason meta keywords were rejected:
**a tag the major engines ignore is not harmless extra signal, it is noise that implies
a control you do not have.**

**Scale:** the protocol caps one file at 50,000 URLs / 50 MB. At 1198 a single file is
correct; `generateSitemaps()` splits it if the catalogue ever approaches the limit.

---



### Original plan (for reference — see the corrections above)

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

> ⚠️ **Only include** `targetCountries: ['ALL']` **content.** A sitemap is a single
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



### ✅ SEO-A — the core fix — **[x] DONE** (Phase A commit 3)

Verified by reading the rendered `<head>` of a running production build, not by
inspecting the source. Sample:


| URL                    | `<title>`                                                | canonical                             |
| ---------------------- | -------------------------------------------------------- | ------------------------------------- |
| `/domain`              | `Domains · ATNO`                                         | `https://atno.io/domain`              |
| `/domain/gdesign`      | `Graphic Designing · ATNO`                               | `https://atno.io/domain/gdesign`      |
| `/domain/aimldl/ytube` | `YouTube Channels · AI | ML | DL [ Traditional ] · ATNO` | `https://atno.io/domain/aimldl/ytube` |
| `/login`               | `ATNO — Domain Explorer` *(layout default)*              | *(none — correct)*                    |


Full tag set now emitted on every public page: `title`, `description`, `canonical`,
`og:title`, `og:description`, `og:url`, `og:site_name`, `og:locale`, `og:type`,
`twitter:card`, `twitter:title`, `twitter:description`.

New shared module `src/lib/seo.ts`: `SITE_NAME`, `SITE_URL`, `TITLE_SEPARATOR`,
`stripEmoji`, `truncate`, `htmlToText`, `isGloballyIndexable`, `buildOpenGraph`,
`buildTwitter`. `sitemap.ts` (commit 4) reuses it.

---



#### ⚠️ Three things the plan got wrong — found only by inspecting the output

**1. Next.js merges metadata SHALLOWLY. A page's** `openGraph` **REPLACES the layout's.**

This is the one that would have shipped broken. The plan had the layout declare
`type`/`siteName`/`locale` once, with pages adding only `title`/`description`/`url`.
That does **not** merge — the page's object replaces the layout's wholesale:

```
Expected: og:title, og:description, og:url, og:site_name, og:locale, og:type
Actual:   og:title, og:description, og:url          ← the other three silently gone
```

Losing `og:site_name` removes the "ATNO" brand line from every WhatsApp / LinkedIn /
Slack preview — precisely the thing A3 exists to add. Fix: `buildOpenGraph()` and
`buildTwitter()` in `src/lib/seo.ts` construct the complete object, and all three
call sites go through them. A page can no longer partially specify one.

**Generalisable lesson:** metadata correctness is not visible in the source. Read the
rendered `<head>`.

**2.** `|` **is unusable as a title separator — 6 domain names already contain pipes.**

```
🌻 AI | ML | DL [ Traditional ]     🥽 AR | VR | MR | XR Developer
🌎 Gaming | E-Sports               👨‍💻 Cybersecurity | Hacking
🍪 Logo | Brand Designing          🧑‍💻 Entrepreneurship | Startup
```

plus page titles like `Languages | Libraries | Frameworks` and
`Local Businesses | Business Directories`. With the conventional `%s | ATNO`
template the first one renders `AI | ML | DL [ Traditional ] | ATNO` — the structural
separator is indistinguishable from content. Now `·` (U+00B7), verified absent from
every domain name and 500 page titles.

**3. The emoji regex needed far wider ranges than drafted.**

The drafted `[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]` misses `▶️` — that's U+25B6 in
**Geometric Shapes** (U+25A0–U+25FF), nowhere near the emoji planes — so
`▶️ YouTuber` would have become `▶ YouTuber`. Also missing: ZWJ (U+200D) for
sequences like `👨‍💻 Cybersecurity`, and variation selectors (U+FE0F).

`\p{Extended_Pictographic}` would be the correct tool but needs `target: ES2018`;
`tsconfig.json` is on **ES2017**, so the ranges are enumerated explicitly instead.
Verified against **all 34 real domain names** — every one strips correctly.

One deliberate non-removal: keycaps. `Step 1️⃣ Setup` → `Step 1 Setup`, not
`Step Setup`. The digit carries meaning.

---



#### 📊 Reality check — there is currently NO geo-restricted content

Queried directly against production data:

```
Domains with targetCountries != ["ALL"]  →  0
Pages   with targetCountries != ["ALL"]  →  0
```

> ⚠️ **Correction to #15.4**, which claimed page/domain-level geo was "confirmed, not
> theoretical". The *capability* is real and live — the admin UI accepts
> `targetCountries` when creating a domain or page — but **no row currently uses it**.
> Even `🛍️ Dropshipping [Indian]` is targeted `ALL`; its India-specific content lives
> at the **table-row** level, which per the geo decision record has no SEO cost at all.
>
> Consequences:
>
> - The `robots: { index: false }` guard is **a no-op today**. It is still correct to
> have — it applies automatically the moment someone sets a country in the admin UI,
> which is exactly when it would otherwise be forgotten.
> - **Option A is currently free, not a compromise.** Nothing is being withheld from
> the index, because nothing is geo-restricted at a level that affects URLs.
> - Verified instead by unit-checking `isGloballyIndexable()` across all combinations
> (ALL/ALL, ALL/US, US/ALL, empty, undefined) rather than against live data.

---



#### ✅ A4. Brand icons + share image — **[x] DONE** (Phase A commit 4)

**The tab icon was Vercel's.** `src/app/favicon.ico` was still the stock
`create-next-app` file — a black circle with a white triangle — and had been
`atno.io`'s tab icon since day one. Confirmed by converting the `.ico` and looking
at it.

**Installed:**


| Path                     | Source                                       | Purpose                                |
| ------------------------ | -------------------------------------------- | -------------------------------------- |
| `src/app/favicon.ico`    | `favicon-black-disc`                         | Tab icon. File convention → hashed URL |
| `src/app/apple-icon.png` | `favicon-black-disc` (180×180)               | iOS "Add to Home Screen"               |
| `public/icon-light.png`  | `favicon-black-glyph` → 192×192              | `prefers-color-scheme: light`          |
| `public/icon-dark.png`   | `only-icon-whitecolor-transparent` → 192×192 | `prefers-color-scheme: dark`           |
| `public/og-image.png`    | horizontal logo → 1200×630                   | Open Graph + Twitter card              |


Rendered `<head>`, verified against a running production build:

```html
<link rel="icon" href="/favicon.ico?favicon.864a0c81.ico" sizes="48x48" type="image/x-icon"/>
<link rel="icon" href="/icon-light.png" sizes="192x192" media="(prefers-color-scheme: light)"/>
<link rel="icon" href="/icon-dark.png"  sizes="192x192" media="(prefers-color-scheme: dark)"/>
<link rel="apple-touch-icon" href="/apple-icon.png" sizes="180x180"/>
```

All five assets return 200. `twitter:card` upgraded `summary` → `summary_large_image`.

**Why two icon variants.** Read from the alpha channel rather than assumed:


| Set                   | Corner      | Artwork                    | Light tab strip | Dark tab strip     |
| --------------------- | ----------- | -------------------------- | --------------- | ------------------ |
| `favicon-black-disc`  | transparent | black disc, **white** mark | ✅               | ✅ white mark shows |
| `favicon-black-glyph` | transparent | **black** mark, no disc    | ✅ crisp         | ❌ near-invisible   |


`black-glyph` is the sharper icon but disappears on Chrome's dark tab strip
(`#35363a`). Hence the `media` split, with `black-disc` as the `.ico` fallback for
anything that ignores `media` — it is self-contained and legible either way.

> ⚠️ `icons.apple` **must be declared explicitly even though**
> `src/app/apple-icon.png` **exists.** Defining any `icons` object in metadata
> **suppresses** the file-convention `<link rel="apple-touch-icon">` — while
> inconsistently leaving the `favicon.ico` tag in place. The file is still built and
> still served at `/apple-icon.png`, but nothing in the HTML points at it, so iOS
> falls back to a page screenshot on "Add to Home Screen".
>
> Same lesson as the `openGraph` shallow-merge trap: **once you take manual control
> of a metadata field, you own all of it.** Both were found by diffing the rendered
> `<head>` against the build output.

**Share image — static, deliberately.** One 1200×630 card for the whole site.
1200×630 is the OG recommendation (1.91:1) and X's `summary_large_image` wants 2:1 —
close enough that one image serves both. The source horizontal logo was already
**exactly 2:1**, cropped to its ink bounding box and centred on white at 62% width,
so the margins are intentional. **42 KB**, down from the 662 KB original — preview
crawlers fetch this synchronously and some (WhatsApp) abandon slow images.

**Per-page generated cards remain open (A5).** `src/app/opengraph-image.tsx` with
`ImageResponse` would draw each page's own title into its card, so sharing
`/domain/gdesign/ytube` shows "YouTube Channel — Graphic Designing". Much stronger
for a directory that grows by being shared. Static shipped first because the hard
part of this feature is platform caching, not the image — and that is now proven
end-to-end. Switching over is one line in `buildOpenGraph`.

**Can OG and Twitter use different images?** Yes — `openGraph.images` and
`twitter.images` are independent, and X reads `twitter:image` first while everything
else reads `og:image`. Both point at the same file here on purpose: two images means
two things to keep in sync for no benefit. Only worth diverging for a deliberately
square X card.

> ⚠️ **Link previews are cached per URL, per platform, and mostly cannot be purged.**
> After deploying, `atno.io` may show the old preview for days. That is not a bug.
>
>
> | Platform | Behaviour                                                                   |
> | -------- | --------------------------------------------------------------------------- |
> | WhatsApp | Effectively permanent per URL                                               |
> | Teams    | Aggressive; no public purge tool                                            |
> | X        | Card Validator retired; self-clears in days                                 |
> | LinkedIn | [Post Inspector](https://www.linkedin.com/post-inspector/) forces a refresh |
> | Facebook | Sharing Debugger forces a refresh                                           |
>
>
> To see the real result immediately, test a cache-busting URL: `atno.io/?v=2` is a
> completely different URL to every one of these.

**Teams mystery solved.** The square thumbnail was the *favicon* — Teams falls back
to the site icon when there is no `og:image`. So it was showing Vercel's triangle.

#### ✅ A5. `/domain` title is now brand-led — **[x] DONE**

`/` 308-redirects to `/domain`, and every crawler and preview bot follows redirects.
So `/domain` is the de-facto homepage — the most-typed, most-linked, most-pasted URL
on the site — and `Domains · ATNO` described it mechanically while saying nothing
about what ATNO *is*.

```
before:  Domains · ATNO                                    (14 chars)
after:   ATNO — Curated Tools & Resources, by Domain        (43 chars)
```

Uses `title: { absolute: … }` to bypass the `%s · ATNO` template, which would
otherwise append a second "ATNO". Every other page keeps the template, where a
trailing brand is correct.

> ⚠️ `og:title` does **not** pass through the title template — that applies only to
> `metadata.title`. Without setting it explicitly, search would have shown the full
> brand-led title while chat previews showed a bare "Domains".



#### 🗂️ Design assets consolidated

`favicon_io (1)`, `favicon_io (2)` and `atno logo images` (30 files, 4.9 MB) were
sitting untracked in the repo root with spaces and parentheses in their names.
Now `design/favicon-black-disc/`, `design/favicon-black-glyph/`, `design/logo/` —
committed, so the source artwork is versioned with the project.

---



#### 📏 Open item — some generated titles exceed Google's display budget

Longest titles across all pages (Google shows ~60 characters):

```
85  Local LLM Runners (The Infrastructure) · Gen AI & AI Agents ( Code & No-Code ) · ATNO
82  Specific YouTube Playlists | Videos · Gen AI & AI Agents ( Code & No-Code ) · ATNO
79  Collaborate with Influencers | Content Creators · Social Media Marketing · ATNO
77  APIs Available for Blockchain Projects · Blockchain & Web3 Development · ATNO
```

Not a defect and **not fixed in code**: the page title — the part that matters most —
comes first, so truncation eats the domain and brand, which is the right thing to lose.
No ranking penalty; only the visible snippet is shortened.

The real fix is **content, not code**: shorter domain names.
`Gen AI & AI Agents ( Code & No-Code )` is 37 characters, much of it punctuation, and
it prefixes every title in that domain. Truncating in code would just discard keywords.
**Your call** — flagged, not actioned.

---



### SEO-A — original plan (for reference)



#### ✅ A0. Root redirect: 307 → 308 — **[x] DONE** (shipped with commit 2)

`src/app/page.tsx` used `redirect("/domain")`, which emits **307 Temporary**. Changed to
`permanentRedirect("/domain")` → **308 Permanent**.

Why it matters: a 307 tells Google "`/` is still the real URL, it's just borrowing
`/domain` for now" — so `/` stays in the index and the ranking value from links pointing
at `atno.io` (the URL people actually type and link to) stays attached to a URL that
renders nothing. A 308 consolidates those signals onto `/domain`.

Verified against a running production build:

```
HTTP/1.1 308 Permanent Redirect
location: /domain
```

> ⚠️ **This is a one-way door for returning visitors.** Browsers cache 301/308
> **indefinitely** — that is what "permanent" means — and a 307 is not cached this way.
> If a real landing page is ever built at `/`, every visitor who hit this redirect even
> once will still be bounced to `/domain`, because their browser stops asking the
> server. **You cannot fix that server-side.** The response also carries
> `Cache-Control: s-maxage=31536000`, so the CDN holds it for a year too — though that
> part *can* be cleared by a redeploy.
>
> Acceptable now, since `/` has no content and no plan for any. **Revisit before
> putting anything at** `/`**:** switch back to `redirect()` first and accept the weaker
> SEO signal in exchange for staying reversible.

**Better long-term:** no redirect at all — serve the domain listing at `/` directly, or
rewrite to it (a rewrite keeps the URL as `/` in both the address bar and the index,
unlike a redirect). Then the root URL is itself the indexed page and no authority is
handed off. Larger change — it touches how the whole `/domain/...` tree is addressed —
so it is not folded in here.

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
>
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



### ❌ Decided against — `<meta name="keywords">`

**Not added, deliberately.** Recorded so it isn't revisited.

Google announced in **September 2009** that it does not use the keywords meta tag for
ranking, and has reconfirmed it repeatedly. Bing says the same — and has gone further,
describing it as something it may read as a **spam signal**, so stuffing it can count
against you. Only Yandex is reported to still give it any weight.

There is also a non-technical cost: it is public. Anyone can `view-source` and read
exactly which terms you are targeting.

For the record, had we added it: `keywords: ['a', 'b']` in any `Metadata` object →
`<meta name="keywords" content="a,b">`. Root layout for site-wide, or per-page in
`generateMetadata`. Per-page would be the only defensible form — one static list across
1198 pages says nothing — but the value is zero either way.

**What replaced it.** Search engines moved from keyword *declarations* to keyword
*evidence*:


| Signal                   | Status                     | Where we stand                             |
| ------------------------ | -------------------------- | ------------------------------------------ |
| `<title>`                | Strongest on-page factor   | ✅ #14 SEO-A                                |
| Real body text           | What Google actually reads | ⚠️ **The genuine gap** — mostly link lists |
| `<h1>` / headings        | Strong                     | ✅ Already present                          |
| JSON-LD structured data  | Enables rich results       | ❌ Open — SEO-B below                       |
| Internal links + sitemap | Discovery + importance     | ✅ #13                                      |
| `<meta keywords>`        | **Ignored since 2009**     | ❌ Not adding                               |


The same reasoning retired `changeFrequency` and `priority` from `sitemap.ts`.

### SEO-B — later, lower priority


| Item                                       | Why                                                                                   | Note                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| ✅ JSON-LD `BreadcrumbList` — **DONE**       | Puts breadcrumb trails into search results — a realistic win for a deeply nested site | Shipped. Required fixing the slug-only label resolution first (16a) — 20 of 1,163 trails were showing the wrong page's title |
| ✅ JSON-LD `Organization` — **DONE**         | Brand entity on the entry point | Shipped on `/domain` only |
| JSON-LD `Organization`                     | Brand entity on the home page                                                         | Small                                                                                                                      |
| `next/image` for `NarrativeLayout.tsx:104` | Raw `<img>` has no `width`/`height` → layout shift. **CLS is a ranking signal.**      | Also gets automatic format/size optimization                                                                               |
| Static rendering                           | `force-dynamic` means no cached HTML and a DB hit on every crawl → slow TTFB          | **Blocked on the geo decision below**                                                                                      |
| Real page content                          | See the caveat at the end of this section                                             | Product work, not code                                                                                                     |


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

**Any domain or page targeted exclusively at** `IN` **/** `GB` **/** `AU` **/** `CA` **is permanently
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


|                 |                                                                |
| --------------- | -------------------------------------------------------------- |
| **Indexed**     | All `ALL`-targeted content — the large majority                |
| **Not indexed** | Anything exclusively `IN`/`GB`/`AU`/`CA`                       |
| **Work**        | Sitemap filter + the `isGlobal` check in A1. Effectively zero. |


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
- `force-dynamic` **can be removed.** No cookie dependency → pages become
statically renderable → real ISR, cached HTML, fast TTFB. This also resolves #8
and much of the SEO-B performance list.
- Users can share a country-specific link that actually stays country-specific

**What it costs**

- **Every internal link must carry the country prefix.** That means
`navigation.service.ts` (all URL building), `SectionBasedLayout`,
`SubcategorySelector`, `PageSidebar`, `SidebarDomain`, `bread.tsx`, and
`generatePagePreviewUrl` in the admin pages API.
- **URL migration.** Existing `/domain/`* URLs need 301s to preserve accrued authority
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


|          |                                                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Gain** | The SEO problem disappears entirely — nothing is hidden, so nothing is unindexable. No URL refactor, no `hreflang`, no migration. `force-dynamic` could arguably go too. |
| **Cost** | Changes what the product *means*. Only viable if geo-targeting is about relevance, not restriction.                                                                      |


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



## 🟡 15. Geo Implementation — What's Intentional vs What's Broken

**Severity:** Medium. Three real defects, plus two behaviours that look like bugs but
are deliberate product decisions and must **not** be "fixed".

### 📊 Audit, July 27 2026 — the geo system currently has NO data behind it

Counted directly against production:

```
domains geo-restricted:      0 of 34
pages   geo-restricted:      0 of 1195
table rows geo-restricted:   0 of 8050        (across 651 tables)

row targetCountries values:  ALL        5683   70.6%
                             (missing)  2367   29.4%   ← treated as ALL, see below
```

**Every visitor from every country currently sees byte-identical content.** The
machinery is built and correct; nothing exercises it. Two consequences:

1. **There is no migration cost to any geo strategy.** The decision below is
  forward-looking only.
2. **The** `isGloballyIndexable` **/** `noindex` **guard is inert today** — correctly so. It
  activates automatically the first time a country is set in the admin UI.

**✅ The 2367 rows with no** `targetCountries` **value are safe.** `filterRowsByCountry`
opens with `if (!targetCountries) return true`, so a missing value means "visible to
everyone" — the same as `ALL`. These rows predate the geo feature. No action needed.

> ⚠️ **SUPERSEDED IN PART — see the decision record at #8-DR (28 Jul 2026).**
>
> The section below concluded "keep Domains and Pages `ALL`; vary only table rows",
> based on a verbal summary that only one or two would ever be country-tagged. **The
> product plan contradicts that** — whole domains (`Import & Export Business Data`,
> `For Entrepreneurs | Startups [Indian]`, `Dropshipping [Indian]`) and page subtrees
> (*Indian Market Understanding*, *Tools for Product Demand Research (India Specific)*)
> are India-specific by design.
>
> **What still holds:** the SEO analysis, the ALL+US asymmetry, and the fact that
> row-level filtering is free. **What does not:** the assumption that domain/page-level
> tagging is negligible, and therefore the conclusion that Option A is costless. Once
> tagging begins it has a real price — see #8-DR.3.

### 🎯 Strategy decision — keep Domains and Pages `ALL`; vary only table rows

**Confirmed July 27 2026.** The owner asked whether to build many country-specific
domains/pages, or keep them near-universal and vary only the table data. **The second
is correct, and not marginally.**

**The decisive reason: a geo-restricted domain or page is literally unindexable.**
Googlebot crawls from US IPs and sends no cookies, so the middleware assigns it
`DEFAULT_COUNTRY = 'US'`. A page targeted `IN` returns **404 to Googlebot** — it never
enters the index at all. Building a country-specific catalogue would make most of the
site invisible to search: the exact opposite of the intent.

Supporting reasons:


|                             |                                                                                                                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Authority concentration** | Google ranks URLs. One `/domain/ecommerce/websites` consolidates every link, share and click worldwide. Five country variants means five weak URLs competing, with Google picking one canonical and discarding the rest. |
| **Near-duplicates**         | IN/US/AU variants of the same page with ~80% identical structure is textbook duplicate content.                                                                                                                          |
| **Crawl budget**            | 1198 URLs × 5 countries ≈ 6,000, of which ~80% would be unindexable or duplicative.                                                                                                                                      |
| **Row filtering is free**   | Rows are not URLs. Varying them by visitor location is locale-adaptive serving — documented and supported. Zero SEO cost.                                                                                                |


**The honest cost.** Row-level geo content is invisible to search: Googlebot sees the
ALL + US view, so `IN`-only rows are never indexed. The site will not rank for
"best Indian dropshipping suppliers" on the strength of rows Google cannot see.

That is the right trade, because the two systems work in sequence, not in competition:


|               | Job                                                     | Operates on               |
| ------------- | ------------------------------------------------------- | ------------------------- |
| SEO           | Win generic queries — "graphic design youtube channels" | The URL and its `<title>` |
| Geo-filtering | Make the page useful once the visitor arrives           | The rows inside it        |


**⚠️ An asymmetry worth knowing.** `buildCountryFilter('US')` → ALL + US, and that is
what Googlebot sees:

```
rows tagged ALL          → indexed ✅
rows tagged US           → indexed ✅   (Googlebot resolves to US)
rows tagged IN/GB/AU/CA  → never indexed ❌
```

**US content is indexed for free; every other market's is not.** India is a target
market, so Indian rows that should be discoverable in Google must be tagged `ALL`,
not `IN`. Reserve `IN` for rows that would be actively useless or misleading elsewhere.

**Operating rules:**

1. **Domains and pages: always** `ALL`**.** Each exception is a URL with zero organic
  traffic, permanently.
2. **Put all geo variation at row level.** Free, SEO-wise.
3. The occasional country-specific page is fine — but it is invisible to search. If one
  ever matters for growth, make it `ALL` and vary its rows instead.
4. **Prefer** `ALL` **over a specific country** on any row you want indexed.

This supersedes the "Open decisions → Geo strategy" entry: **Option A confirmed, and it
is free rather than a compromise.** Option B (country-in-URL) would only become
relevant if geo-restricted content grew to a large share of the catalogue — which this
strategy explicitly avoids.

### 📌 Product intent (recorded — read this before changing any geo code)

`targetCountries` exists for **relevance, not access control**. Nothing is being
protected or hidden for security reasons; the goal is that each visitor sees the
resources that are useful *in their market*.

Canonical examples, in the owner's words:


| Content                                                         | `targetCountries` | Why                            |
| --------------------------------------------------------------- | ----------------- | ------------------------------ |
| Ecommerce domain → "Ecommerce Websites" table → an Indian store | `IN`              | Only useful to Indian visitors |
| Same table → an American store                                  | `US`              | Only useful to US visitors     |
| Graphic Design domain → "Tools" table → Photoshop               | `ALL`             | Universal — everyone uses it   |


**Two consequences that follow from "relevance, not restriction":**

1. **It is safe for the client to specify its own country** (e.g. as a URL query
  param). Someone hand-editing `country=IN` just sees Indian rows. There is no
   privilege escalation and no data they shouldn't have. This is what makes the CDN
   fix in 15.1 possible — do not "harden" it later on principle.
2. **Geo filtering is applied at three levels**, and they behave very differently:


| Level     | Code                                  | On mismatch                             | Notes                |
| --------- | ------------------------------------- | --------------------------------------- | -------------------- |
| Table row | `filterRowsByCountry()`               | Row omitted, **page still renders 200** | The primary use case |
| Page      | `buildCountryFilter()` in `getByPath` | `notFound()` → **404**                  | Used in practice     |
| Domain    | `isContentVisibleToUser()`            | `notFound()` → **404**                  | Used in practice     |


---



### ✅ Intentional — do not change

**No country switcher.** Deliberate: the owner wants each visitor to feel the site was
built for their country, so the country is detected and never offered as a choice.

> ⚠️ **This raises the stakes on 15.2.** With a switcher, a bad detection is a
> two-click annoyance. Without one, re-detection is the *only* correction mechanism a
> user has — so per-request detection stops being an optimisation and becomes the
> safety net.

`DEFAULT_COUNTRY = 'US'` **for unsupported countries.** Deliberate: only
`IN`, `US`, `GB`, `AU`, `CA` are supported today; more will be added progressively.
Everyone else should see **ALL + US**.

**Already implemented correctly — no code change needed:**

```typescript
buildCountryFilter('US')          → OR: [ has 'ALL', has 'US' ]   // ALL + US ✅
filterRowsByCountry(rows, 'US')   → 'ALL' ✅  'US' ✅  'IN' ❌      // ALL + US ✅
```

A German visitor gets universal resources plus the US set. Flagged here only so a
future reader doesn't mistake it for an oversight.

---



### 15.1 `Vary: Cookie` makes the page-context CDN cache useless

**Priority:** Medium — performance, not correctness. Current behaviour is *safe*,
just wasteful.

`src/app/api/page-context/route.ts:44-45` sets:

```typescript
...getCacheHeaders(0, CACHE_DURATIONS.MEDIUM, CACHE_DURATIONS.LONG),  // s-maxage=60
'Vary': 'Cookie',
```

`s-maxage=60` asks Vercel's CDN to store the response and serve it from the edge for
60s without running the function. `Vary: Cookie` is there for correctness — navigation
differs by country (domain/page-level targeting is real), so the cache must not serve
one country's sidebar to another.

**The problem:** `Vary: Cookie` keys the cache on the **entire** `Cookie` header:

```
Cookie: user-country=IN; authjs.session-token=eyJhbGciOiJkaXIi…; _ga=GA1.1.882471.17
```

Session tokens and analytics IDs are unique per visitor, so **every visitor produces a
unique cache key**. The CDN stores a separate private copy for each person and never
reuses one. The cache is correct and never hits — every request still executes the
function and queries Postgres.

**Fix — move the only meaningful variable into the URL:**

```
/api/page-context?path=/domain&country=IN   ← one copy, shared by all Indian visitors
/api/page-context?path=/domain&country=US   ← one copy, shared by all US visitors
```

```typescript
// route.ts — prefer the explicit param, fall back to the cookie
const userCountry = searchParams.get('country') ?? getUserCountryFromRequest(request)
// …and DELETE the 'Vary': 'Cookie' header — the URL now distinguishes the variants
```

```typescript
// usePageContext.ts — useUserCountry() already reads the cookie
fetch(`/api/page-context?path=/domain&country=${userCountry}`)
```

Cache key space becomes 5 countries × N paths, each shared by many users.
**The cookie itself stays** — it remains how the detected country is stored; the client
merely reads it and forwards the value.

---



### 15.2 The country cookie is set once and never refreshed

`src/middleware.ts:18-37`:

```typescript
const existingCountry = request.cookies.get('user-country')?.value
if (!existingCountry) {
  // …set cookie with maxAge: 60 * 60 * 24 * 365   ← ONE YEAR
}
```

Whatever country a visitor is assigned on their **first ever request** is frozen for a
year. If detection was wrong (VPN, corporate proxy, carrier routing), and there's no
switcher, the user is stuck with the wrong market's content and **no recourse at all**.

**Re-detecting on every request is free.** Two reasons:

1. `x-vercel-ip-country` is derived from the IP at the Vercel edge and is **already
  present on every request** — no API call, no lookup, no added latency.
2. The middleware **already runs on every request** (the matcher covers everything
  except `/api/auth`, static assets, and images). The `if (!existingCountry)` guard
   was never a performance measure.

**Fix:**

```typescript
const headerCountry = request.headers.get('x-vercel-ip-country')   // null in local dev
const existing = request.cookies.get('user-country')?.value

if (headerCountry) {
  const detected = SUPPORTED_COUNTRIES.includes(headerCountry) ? headerCountry : DEFAULT_COUNTRY
  if (existing !== detected) {
    // Write ONLY when it changed. Set-Cookie on a response makes it uncacheable by
    // CDNs, which would work against 15.1.
    response.cookies.set('user-country', detected, { maxAge: 60 * 60 * 24 * 30, /* 30d */ })
  }
} else if (!existing) {
  // No geo header (local dev) and no cookie yet → seed the default.
  // The `else if` is deliberate: it leaves a manually-set cookie alone when no header
  // is present, so `user-country=IN` can be hand-set locally to test the Indian view.
  response.cookies.set('user-country', DEFAULT_COUNTRY, { maxAge: 60 * 60 * 24 * 30 })
}
```

`maxAge` matters much less once re-detection is in place, since it self-corrects.
30 days is a reasonable value.

---



### ✅ 15.3 The country cookie is silently dropped on every early return

**Status:** **[x] DONE** — shipped with #1. The `withCountry()` helper in
`src/middleware.ts` now wraps every `return`. Verified: `set-cookie: user-country`
appears on the 307 `/admin` redirect, on a normal 200 page load, and on the new 401.

The original bug, kept here because the *shape* of it is worth remembering:

```typescript
let response = NextResponse.next()                    // ① create a response object

if (!existingCountry) {
  response.cookies.set('user-country', 'IN', {...})   // ② Set-Cookie attached to ①
}

if (pathname.startsWith('/admin')) {
  const session = await auth()
  if (!session) return NextResponse.redirect(loginUrl) // ③ a BRAND NEW object — ① discarded
}

return response                                        // ④ only reached if nothing redirected
```

Line ③ returns a different object, so the `Set-Cookie` from ② never reaches the
browser. Affects the `/login` redirect, the `/unauthorized` redirect, and the
logged-in-admin-bounced-off-`/login` redirect.

Impact today is small — it self-heals on the next non-redirecting request:


| Request                                 | Result                                                  |
| --------------------------------------- | ------------------------------------------------------- |
| `GET /admin` (no cookie, not logged in) | Redirect returned → **no cookie set**                   |
| `GET /login` (browser follows)          | No redirect → `response` returned → **cookie set here** |


It matters because **#1 adds more early returns** (401 JSON for `/api/admin/`*), each
another path that drops the cookie. Restructure so every exit carries it:

```typescript
// Decide the cookie ONCE, up front
const countryCookie = resolveCountryCookie(request)   // string | null

// Stamp it onto WHATEVER response we end up returning
const withCountry = (res: NextResponse) => {
  if (countryCookie) res.cookies.set('user-country', countryCookie, { /* … */ })
  return res
}

if (isAdminApi)  return withCountry(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
if (isAdminPage) return withCountry(NextResponse.redirect(loginUrl))
return withCountry(NextResponse.next())
```

Adding a branch later can no longer reintroduce the bug.

---



### 15.4 Page/Domain-level geo needs `noindex` — confirmed, not theoretical

Because domain- and page-level targeting **is** used, this sequence is live:

1. A page targeted `["US"]` → Googlebot crawls from a US IP → resolves to `US` →
  sees the page → **indexes it**
2. An Indian user finds it in Google, clicks → `getByPath` filters it out →
  `notFound()` → **404**
3. Google sees an indexed URL failing for most visitors → **soft 404**, a quality
  penalty

So the `robots: { index: false, follow: true }` guard in **#14 / SEO-A is required**,
not optional, and the sitemap must apply the same `targetCountries: ['ALL']` filter.

Pages targeted `["IN"]` are naturally safe — Googlebot resolves to `US`, gets a 404
during crawl, and never indexes them.

---



### ✅ Verified safe — geo never leaks through a cache

Checked explicitly, because this would have been the worst possible bug:

- `TableService.getPublicTable` uses React `cache()` **only** — request-scoped, keyed
on `(pageId, userCountry)`. No `unstable_cache`, so nothing survives the request.
- `/api/domain/tables/by-page/[pageId]` sets **no cache headers** — table data is
never held by the CDN.

An Indian visitor's rows can never be served to an American from cache. Preserve this
property in any future caching work: **never wrap row-filtered table data in**
`unstable_cache` **unless the country is part of the cache key.**

---



## 🗺️ Recommended Order of Work

All work happens on `dev-3.0` (branched from `master` @ `c4ff8d8`), one PR per
phase, merged to `master` → auto-deploys to `atno.io`.

### Phase A — Security + SEO foundation (in progress)


| Done | Commit | Item                                                                     | Notes                                                                                                                                                                                                               |
| ---- | ------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [x]  | 1      | **#1** Lock down `/api/admin/`* **+ #15.3**                              | `lib/api-auth.ts` + widened middleware + `requireAdmin()` on all 14 routes (36 handlers). Restructures middleware so every exit path carries the country cookie.                                                    |
| [x]  | 2      | **#13** `robots.ts`                                                      | With the `VERCEL_ENV` preview guard. *After* #1 — don't signpost `/admin` while it's open. Corrected the planned disallow list: `/api/` needed two `Allow` exceptions or table content would be hidden from Google. |
| [x]  | 3      | **#14** SEO-A: `metadataBase` + `generateMetadata` + OG tags             | New `src/lib/seo.ts`. Includes the `robots: { index: false }` guard for geo-restricted pages (a no-op today — no such content exists). Found and fixed three plan errors; see the SEO-A section.                    |
| [x]  | 4      | **#14** A4/A5: brand favicons, static OG card, brand-led `/domain` title | Replaced the stock Vercel favicon. Light/dark icon variants. `design/` folder for source artwork.                                                                                                                   |
| [x]  | 5      | **#13** `sitemap.ts`                                                     | 1198 URLs, `ALL`-targeted only, parent-chain traversal for depths 2–4. **Phase A complete.**                                                                                                                        |




### Phase B — Correctness

- [x] 5. **#3** Migration drift — **DONE.** Baselined all 11 migrations on production,
  ```
  `development` and a rehearsal branch. Found and fixed a second missing migration
  (the entire auth schema), not just `targetCountries`. Also repointed local dev
  off production onto the `development` branch.
  ```
- [x] 5b. `updatedAt` **on** `Page` **and** `Domain` — **DONE.** Migration
  ```
  `20260727140000_add_updated_at`, applied to all three branches.
  `sitemap.ts` now emits `lastModified` on all 1198 entries.

  **The backfill was the whole point.** Prisma's generated SQL was
  `ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`, which
  stamps all 1229 existing rows with the instant the migration ran — telling
  Google the entire site changed at once, exactly the unreliability that made us
  omit `lastmod` in the first place. Two hand-added statements fix it:

  ```sql
  UPDATE "Domain" SET "updatedAt" = "createdAt";
  UPDATE "Page"   SET "updatedAt" = "createdAt";
  ```

  For a row never edited, its creation time genuinely *is* its last-modified
  time. Result: dates spread across Sep 2025 – Mar 2026, zero stamped today.
  On a fresh database both UPDATEs match zero rows, so the migration is correct
  in both directions.

  Used `@updatedAt @default(now())` rather than bare `@updatedAt` (which is what
  `User` has). The DB default is a safety net for any INSERT not going through
  Prisma Client — raw SQL, seed scripts — which would otherwise fail on a
  `NOT NULL` column with no default.

  > ⚠️ **Deploy ordering matters here.** Prisma Client generated from a schema
  > containing `updatedAt` selects that column on any `include`-style query. Had
  > the code shipped before the migration ran, `DomainService.getWithPagesFiltered`
  > would have queried a nonexistent column and 500'd. The migration was applied
  > to production **first**, then the code.
  ```
- [x] 6. **#15.2** Re-detect country every request + 30-day `maxAge` — **DONE.** All in
      `resolveCountryCookie()`, exactly as the original note predicted.

      **Why it mattered despite no geo content existing yet.** The cookie was set once
      with a **1-year** lifetime, and there is deliberately **no country switcher** in
      the UI. So a visitor whose detection was wrong — VPN, corporate proxy, carrier
      routing — had *no mechanism at all* to correct it. Re-detection is not an
      optimisation here; it is the only correction the design permits. Doing it before
      the tagging work means the feature is correct for existing visitors from day one
      rather than for whoever happens to arrive with a fresh cookie.

      **And it is free:** `x-vercel-ip-country` is already on every request, and the
      middleware already runs on every request. The old `if (existingCountry) return
      null` was never a performance measure.

      > ⚠️ **It returns `null` when the value is unchanged, and that detail is load-bearing.**
      > `Set-Cookie` can stop shared caches storing a response — which matters now that
      > `/api/page-context` is CDN-cached (#15.1) and the public pages may become
      > cacheable (#8). Writing unconditionally would work against both. A settled
      > visitor now gets **zero** cookie writes after their first request.

      > ⚠️ **The local-dev guard is deliberate and must stay.** With no geo header
      > (localhost) *and* an existing cookie, the function returns `null` and leaves the
      > value alone — which is what allows hand-setting `user-country=IN` in DevTools to
      > test the Indian view. Overwriting it with `DEFAULT_COUNTRY` every request would
      > make local geo testing impossible.

      Verified locally: no cookie → sets `US`; `Cookie: user-country=IN` sent → **no**
      `Set-Cookie` (hand-set value preserved). The re-detection branch itself needs a
      real `x-vercel-ip-country` header, so it only exercises on Vercel.

- [x] 6b. **A proper 404 page** — the site was serving Next.js's stock black-and-white
      default. Two files so navigation survives where it matters:

      | Route | Renders | Sidebar |
      |---|---|---|
      | `src/app/not-found.tsx` | unknown URLs like `/foo` | ✗ root layout only |
      | `src/app/domain/not-found.tsx` | bad `/domain/...` paths | ✅ inside the domain layout |

      The second is the common case — `[...slug]/page.tsx` calls `notFound()` in four
      places — and a root-only 404 would have stripped the sidebar and breadcrumb there.
      Shared body in `src/components/NotFoundContent.tsx`.

      **⚠️ No database query on the 404 page.** Listing available domains would be
      friendlier, but 404s are precisely the URLs bots hammer; querying on each one
      converts a stream of bad requests into database load.

      Verified: `/nonexistent-page`, `/domain/does-not-exist` and
      `/domain/gdesign/no-such-page` all return **HTTP 404**, not 200 — a "not found"
      page served with 200 is a soft 404 and Google treats it as a quality problem.

      > **Observed quirk, accepted not worked around:** metadata from a *nested*
      > `not-found.tsx` is ignored. `/nonexistent-page` gets
      > `<title>Page not found · ATNO</title>` from the root file, while
      > `/domain/does-not-exist` falls back to the root layout's default. A 404's title
      > has no SEO weight, and adding a `metadata` export to the nested file would look
      > like it worked while changing nothing.
- [x] 7. **#2** DOMPurify sanitization on rich-text write — **DONE.** New
      `src/lib/sanitize-html.ts`, applied in both rich-text write handlers, with the
      allow-list derived from the 415 rows already stored (not from a template — the
      generic list would have flattened `details`/`summary` and all 28,608 `style`
      attributes). Over the real content: **0.41% fewer bytes, zero tags lost**, only
      the 398 intended `on*` handlers removed. Three DOMPurify config traps found by
      testing rather than reading: `USE_PROFILES` silently overrides
      `ALLOWED_TAGS`/`ALLOWED_ATTR`; `#text` must be listed or `KEEP_CONTENT: false`
      destroys all text; and a `/g` regex used with `.test()` is stateful. `on*` hover
      effects replaced with CSS in `globals.css`. **Phase B complete.**
- [x] 8. **#5** Wire up `revalidateTag` on all mutations — **DONE.** New
      `src/lib/cache-invalidation.ts`; **15 calls across 13 mutating handlers in 9 route
      files.** Verified mechanically that no route mutates `Domain`/`Page`/`Category`
      without invalidating, **and end-to-end with a real authenticated session** (12/12
      checks, against the `development` branch, all data restored):

      ```
      category rename  -> new name in nav payload with ZERO wait   (was up to 300s)
      domain unpublish -> link gone from /domain with ZERO wait     (was up to 60s)
      ```

      > ⚠️ **This is a public-site correctness fix, not just admin UX.** The caches serve
      > the public site. A stale entry meant *every visitor* got a page without the newly
      > published domain for up to 60s — the admin was merely the one person who knew it
      > was wrong. Publish and share a link immediately and the recipient would 404.

      **Corrected the severity claim in this document.** It said "an admin can publish a
      domain and not see it for minutes". Real figures: **300s** for categories
      (`CACHE_DURATIONS.LONG`), **60s** for domains / pages / `contentType`, and table
      rows and rich-text HTML were **already instant** (React `cache()` only, so
      request-scoped). The "minutes" figure assumed the CDN layer stacked on top, which
      it does not — `Vary: Cookie` means that cache never hits (#15.1).

      **Found while auditing — two table routes did need invalidation**, for a reason
      that is easy to miss:

      ```
      tables/route.ts       POST   -> tx.page.update({ contentType: 'table' })
      tables/[id]/route.ts  DELETE -> tx.page.update({ contentType: 'narrative' })
      ```

      `contentType` selects which layout component renders the page and is part of
      `pageWithContentSelect`, so it sits inside the cached `page-main` / `page-by-id` /
      `domain-with-pages` entries — attach a table and the page kept its old layout for
      up to 60s. These use **`tx.page.update` inside a `$transaction`**, so a grep for
      `prisma.page.update` missed them. **When auditing mutations, search for the
      transaction client too.**

      **8 of 12 `CACHE_TAGS` entries have no subscribers** — `DOMAIN(slug)`, `PAGE(id)`,
      `HEADER`, `SIDEBAR`, `BREADCRUMB`, `TABLES`, `TABLE(id)`, `COUNTRY(code)`.
      `revalidateTag` on any of them is a **silent no-op**. Only `DOMAINS`, `PAGES`,
      `CATEGORIES` and `NAVIGATION` are wired to the nine `unstable_cache` wrappers.

      **Product note:** renaming a category changes very little publicly.
      `src/app/domain/page.tsx` renders only the *domains* inside each category cell —
      the category name never appears there. It surfaces in the header dropdown via
      `/api/page-context`, and its `columnPosition` / `categoryOrder` drive layout order.
      (An earlier version of the test asserted against `/domain` and got a false-positive
      baseline: the category `Design` matched inside the domain name `Graphic Designing`.)

- [x] 9. **#6** Two `new PrismaClient()` → shared singleton, plus a
      `no-restricted-syntax` eslint rule set to **`error`** (warnings are ignored in this
      config by design), exempting `src/lib/prisma.ts` and `prisma/`. Rule tested in
      **both** directions — exemptions pass, and a probe file containing
      `new PrismaClient()` correctly errors.
  ```
  *(both call sites already carry a `TODO(#6)` comment — deliberately left for this step)*
  ```
- [x] 10. **#15.1** Country in the URL for `/api/page-context`, drop `Vary: Cookie` —
      **DONE.** Verified header behaviour across six request shapes:

      | Request | `Cache-Control` | `x-country-source` |
      |---|---|---|
      | `?country=IN` / `US` / `ALL` / `in` | `public, s-maxage=60, stale-while-revalidate=300` | `url` |
      | *no param* (cookie only) | **`private, no-store`** | `cookie` |
      | `?country=ZZ` (invalid) | **`private, no-store`** | `cookie` |

      > ⚠️ **The design point: dropping `Vary: Cookie` is only safe when the country is
      > in the URL.** The two are tied together deliberately —
      >
      > ```
      > country in the URL   -> the URL fully identifies the response -> shared-cacheable
      > country from cookie  -> personal                             -> private, no-store
      > ```
      >
      > Removing `Vary: Cookie` while still reading the cookie would have let the CDN
      > store **one visitor's** navigation and serve it to everyone — an Indian
      > visitor's sidebar handed to Americans, which is exactly what `Vary: Cookie`
      > was protecting against. The cookie fallback stays because the param is not
      > guaranteed (stale cached JS bundle, hand-typed request); those get correct
      > content, just uncached.

      **Invalid values fall back to private rather than being normalised.**
      `?country=ZZ` would otherwise mint a fresh CDN entry per junk value — an
      attacker could evict everything useful, and each miss costs a function
      invocation plus a Postgres round trip. Validating against `SUPPORTED_COUNTRIES`
      (plus `ALL`) bounds the key space to 6 values × N paths.

      **Bypassed `useUserCountry()` on purpose.** It returns `DEFAULT_COUNTRY` on the
      first render and corrects in an effect, so routing the fetch through it would
      either fire with the wrong country or fire twice.
      `getUserCountryFromCookie(document.cookie)` is synchronous, already validates,
      and is only called from inside effects so `document` always exists.

      **There were THREE fetch sites, not two** — this document listed two; a third
      builds its URL dynamically. All now go through one `buildPageContextUrl()`
      helper; missing one would have left a permanently uncacheable path. Confirmed in
      the built client bundle that `&country=` is emitted.

      `Vary: rsc, next-router-*` remains — Next.js adds it to every route handler and
      it is absent on a plain `fetch()`, so it does not fragment the cache.

      **IN and US currently return byte-identical responses (14,476 bytes).** Expected:
      no content is geo-restricted yet. The mechanism is correct and idle.

      **✅ Confirmed on production, 28 Jul 2026.** A cold cache key behaves exactly as
      designed, and the cookie path is correctly excluded:

      ```
      ?country=GB (cold)   ->  MISS (age=0)  ->  HIT (age=1)  ->  HIT (age=1)
      cookie only          ->  MISS, private, no-store          (never cached)
      ```

      Vercel's logs also now show a **cache** icon for `/api/page-context` instead of
      the `f` (function) icon, so the invocation really is being skipped.

      > ⚠️ **`cache-control` in the client response reads `public, max-age=0`, not what
      > we send.** That is expected, not a bug: Vercel's CDN *consumes* `s-maxage` and
      > `stale-while-revalidate` for its own edge cache and strips them before
      > responding, leaving `max-age=0` so the browser always revalidates. **Judge this
      > by `x-vercel-cache`, not by `cache-control`.**



### Phase C — Cleanup

- [x] 11. **#9** Repoint the two type imports, then delete the 8 deprecated files —
      **DONE.** Every reference verified by grep before deleting anything, not taken
      from the deprecation comments.

      **The distinction that made this safe:** active components use
      `useHeaderDataFromContext` / `useSidebarDataFromContext` /
      `usePageSidebarDataFromContext` from **`@/contexts/PageContextProvider`** —
      similar names, an entirely different module. `AppHeader.tsx`, `app-sidebar.tsx`
      and `PageSidebar.tsx` all go through the context provider. The four deprecated
      hooks had **zero** importers apart from two `import type` lines.

      **The type-import trap was real, and the doc's fix was correct.** Checked rather
      than trusted: `SidebarPage` and `SidebarDomain` are **byte-identical** in
      `useSidebarData.ts:20-40` and `usePageContext.ts:96-116`, so repointing was
      mechanical. Sequence used: repoint → `tsc` + build green → confirm zero importers
      → delete → rebuild.

      Each of the four endpoints was confirmed to have no live caller — every hit was
      either inside the hook being deleted alongside it, or a comment.

- [x] 12b. **Delete `/api/debug/cache-test`** — **DONE.** Chose deletion over gating.
      It leaked domain/category counts, internal cache-duration config and service
      timings, and its own header said "Remove this in production". If cache
      diagnostics are wanted later, `/api/admin/debug/…` is now guarded by #1.

- [x] 12. **#7** Make server breadcrumb work opt-in; dedupe the double `getByPath` —
      **DONE.** `getPageContext(path, userCountry, includeBreadcrumb = false)`. The one
      caller (`/api/page-context/route.ts:104`) passes two arguments, so it is off.

      **⚠️ The visible breadcrumb is untouched, and that is guaranteed rather than
      hoped.** `usePageContext.ts` (lines 684, 704) *already* overwrote whatever the API
      returned with `breadcrumb: { items: [], shouldCollapse: false, visibleItems: null }`,
      and `bread.tsx` destructures `{ sidebar, pageSidebar, currentPage, loading }` —
      never `breadcrumb`. The client was discarding the server value **before** this
      change, so removing the computation cannot alter client behaviour. The working
      breadcrumb comes from `bread.tsx` + `usePathname()`, which renders instantly with
      no API round-trip.

      **Three database round-trips removed from the hottest endpoint** — every public
      page load fetches `/api/page-context` to build the sidebar:

      | Query in `buildBreadcrumbData` | Cached? |
      |---|---|
      | `DomainService.getBySlug` | `unstable_cache` |
      | `PageService.getByPath` — **result assigned to `const page` and never read** | no |
      | raw `prisma.page.findMany` | **not cached at all** |

      **The dead query was the notable find.** Line 461 executed `getByPath` purely to
      throw the result away — verified across the whole function, the only other
      occurrences of `page` were `prisma.page`, a comment and the string `'page'`.

      **And the "double `getByPath`" had a subtle cause worth remembering.** React
      `cache()` keys on argument **identity**, comparing objects by reference. Both
      `getPageContext` (line 43) and `buildBreadcrumbData` (line 458) did
      `segments.slice(2)`, producing arrays with identical contents but *different
      references* — so `['ytube'] !== ['ytube']`, the memo missed, and the same query ran
      twice. Fixed by passing the caller's array down via `sharedPageSegments`, so an
      opt-in breadcrumb now reuses the memo instead of re-querying.

      Verified: `breadcrumb.items` is `0` in the response (proving the branch is
      skipped), while `header`, `sidebar`, `pageSidebar` and `currentPage` are all
      intact, and the breadcrumb still renders on `/domain/gdesign/ytube`.

      > **Method note:** the intent was to count queries with `DEBUG=prisma:query`, which
      > produced **zero log lines** — the singleton is not constructed with event-based
      > logging. The initial "0 queries" reading was broken instrumentation, not
      > evidence. Verified via the response payload instead, which proves the branch was
      > skipped directly.

      > ⚠️ **Latent bug documented, not fixed:** `buildBreadcrumbData` matches page
      > labels on **slug alone** — no parent-chain validation, no country filter. Slugs
      > repeat across parents (`consultation` appears under several), so a label can come
      > from the wrong branch of the tree. Harmless while nothing consumes it, but it
      > **must be fixed before enabling this for JSON-LD**, or wrong labels reach search
      > results. The removed `getByPath` call was very likely the half-finished intent —
      > it returns the correctly-resolved page with parent chain and country filter
      > already applied.

      `getBreadcrumbData` now has **zero callers** (it served the deleted
      `/api/breadcrumb`). Kept, documented as such, because it is the ready-made entry
      point for the JSON-LD work.

- [x] 13. **#10** Strip debug logs and the 500-line comment block — **DONE.**

      | File | Removed |
      |---|---|
      | `TableLayout.tsx` | **518 lines**: two block comments (67–324, 328–583) of pasted sample API output, plus 2 commented-out logs. **723 → 205 lines** |
      | `DataTable.tsx` | The `console.log` inside the **cell renderer** — fired once per cell per render/sort/filter/paginate |
      | `AdminSidebar.tsx` | `console.log("pathname", pathname)` on every admin navigation |
      | `LogoutButton.tsx` | 4 progress logs. `console.error` in catch blocks kept — a *failing* logout is worth reporting |

      > ⚠️ **`setTableData(result.table)` sits at line 325, between the two comment
      > blocks.** Deleting 67–583 as one range would have removed the statement that
      > actually stores the fetched table data — the page would have rendered
      > permanently empty. The two ranges were removed separately.

      > **Process note:** my first check of `TableLayout.tsx` counted only 14 comment
      > lines and I nearly reported the doc's "~500 lines" claim as wrong. The grep
      > pattern was at fault — lines *inside* a `/* … */` block start with neither `//`
      > nor `*`. Re-measured properly: 258 + 256 = **514 lines**, exactly as documented.
      > Result: 0 active `console.log` left in `src/` outside generated code.

- [x] 13b. **Delete `src/app/header1/page.tsx`** — **DONE.** Grepped `header1` across
      all of `src/`; the only reference was the `Disallow` line in `robots.ts`. Nothing
      linked to it. That `Disallow` was also removed — a rule for a path that now 404s
      is dead weight, and it advertises a URL that no longer exists.

- [ ] 14. **#8** — see decision record **#8-DR**. Not a `revalidate`-export cleanup any
      more; it is downstream of a product decision. **Do not pick this up as "make the
      pages static".**
- [ ] 15. **#4** Delete the 15 merged branches



### Phase D — Polish

- [x] 16a. **Breadcrumb label resolution fixed** — prerequisite for the JSON-LD below.

      `buildBreadcrumbData` matched page labels by **slug alone within a domain**, but
      slugs are only unique *within a parent*. Measured: **83 (domain, slug) pairs have
      more than one page, covering 192 pages — 16.5% of the catalogue.**
      `/domain/appdev` alone has `ytube`, `courses`, `podcasts`, `fonts`, `colors` and
      `networking` each appearing **three times** under different parents, so
      `.find(p => p.slug === slug)` returned whichever row Postgres happened to hand
      back first.

      **Compared old vs new labels across all 1,163 real page paths: 20 changed (1.7%).**

      ```
      /domain/webdev/nocode/websitebuilders
        BEFORE:  No-Code Web Dev › 🖥️ AI Website Builders
        AFTER :  No-Code Web Dev › 🏗️ Website Builders (CMS)     <- a DIFFERENT page

      /domain/webdev/nocode/waysofmonetization/sellcourses
        BEFORE:  … › 👩‍💻 Create & Sell Courses
        AFTER :  … › 👩‍💻 Create & Sell Courses - no              <- nocode, not withcode

      /domain/gdesign/facebookgroups
        BEFORE:  🍀 Facebook Groups        AFTER:  🐼 Facebook Groups
      ```

      > ⚠️ **Correction to an earlier claim in this document.** It said "in no observed
      > case would a completely unrelated page's title appear" — the first example
      > disproves that. `webdev` has parallel `withcode`/`nocode` subtrees with matching
      > page names, and the naive match crossed between them.

      **The fix**, same query count as before: `__main__` is added to the slug list (so
      a `direct` domain's synthetic root is available in the same round-trip), the chain
      is then walked **in memory** requiring each page to be a child of the previous one
      — a query per level would be an N+1 on paths 4 deep — and `buildCountryFilter` is
      applied so an invisible page never supplies a label. When the chain breaks,
      `undefined` propagates and remaining segments fall back to formatted slugs rather
      than silently matching an unrelated branch.

      > **No user-visible change, and that is expected.** The server breadcrumb is off by
      > default (#7) and the *visible* trail comes from `bread.tsx`, which was already
      > correct: for the last segment it prefers `currentPage.title`, resolved via
      > `PageService.getByPath`. Every one of the 20 ambiguous cases has the ambiguous
      > slug as a **leaf**, so `currentPage` covers it.
      >
      > ⚠️ `bread.tsx` does share the structural weakness — `getDomainsForNavigationFromDB`
      > returns *every* page in the domain with no `parentId` filter, so its line 159
      > `pages.find(p => p.slug === pageSlug)` is the same naive match. It is only saved
      > by the ambiguous slugs all being leaves. Create an **intermediate** page whose
      > slug duplicates another in the same domain and the visible trail would be wrong.

- [x] 16b. **#14** SEO-B: JSON-LD `BreadcrumbList` + `Organization` — **DONE.**

      New `src/lib/structured-data.ts` (pure builders) and
      `src/components/JsonLd.tsx` (the script tag). Verified rendered output:

      ```
      /domain                             -> Organization
      /domain/gdesign                     -> Domains › Graphic Designing
      /domain/gdesign/ytube               -> Domains › Graphic Designing › YouTube Channel
      /domain/webdev/nocode/websitebuilders
                                          -> Domains › Web Development › No-Code Web Dev
                                             › Website Builders (CMS)
      /domain/webdev/withcode/definingservices/portfoliowebsite
                                          -> 5-item trail, depth 4
      ```

      All blocks parse as valid JSON. Emoji stripped, relative URLs made absolute,
      `position` 1-based, and the **last crumb omits `item`** as schema.org prescribes
      (the final entry is the page you are already on).

      > ⚠️ **`dangerouslySetInnerHTML` is unavoidable, and there is a real XSS vector.**
      > React escapes text children, so `<script>{JSON.stringify(data)}</script>` turns
      > `<` into `&lt;` *inside the script body* — HTML entities are meaningless to a
      > JSON parser, so the block arrives corrupted and Google silently discards it.
      >
      > But inside a `<script>` element the HTML parser hunts for the literal bytes
      > `</script` and does not care that they sit inside a JSON string. Page titles are
      > plain `String` columns that never pass through the #2 sanitiser, so a title
      > containing `</script><script>…` would break out. `escapeForScriptTag` converts
      > `<` and `>` to `<` / `>`, which keeps the JSON semantically identical
      > while making that byte sequence impossible. `JSON.stringify` alone does **not**
      > help — it escapes quotes and backslashes, not angle brackets.
      >
      > Tested with the payload `</script><script>alert(document.cookie)</script>` as a
      > page title: no literal `</script` survives, no raw `<` at all, and the text is
      > still present in escaped form rather than silently dropped.

      **⚠️ This re-enables the breadcrumb queries #7 removed — deliberately, and
      elsewhere.** #7 took them out of `/api/page-context`, which the client hits on
      every page load and which discarded the result. Here the data is used, on the page
      render, and `getBreadcrumbData` is `cache()`-wrapped so it runs once per request.
      Net: one extra query per page render, none on the API.

      **`Organization` is emitted only on `/domain`** — the site's real entry point,
      since `/` 308-redirects there. Repeating an identical entity across 1,198 pages
      would add bytes and give Google conflicting signals about the organisation's home.

      The page component was restructured from six `return` statements to one
      `content` variable plus a single return. Wrapping six returns individually would
      have meant six chances to omit the `<JsonLd>` — and a missing block is invisible,
      since nothing renders and no error occurs.

      > **Honest expectations:** structured data is **not a ranking factor** (Google has
      > said so). It changes how a result *looks*, which affects click-through. Valid
      > markup makes you *eligible* for a rich result, never guaranteed. And it cannot
      > fix thin content — most pages here are lists of outbound links.

      **After deploy:** validate a URL with Google's Rich Results Test, then watch
      Search Console → Enhancements → Breadcrumbs over the following days.

- [ ] 16c. **#14** SEO-B remainder: `next/image` for `NarrativeLayout.tsx:104`, real page content
- [ ] 17. **#11** Make the render path read-only; add the `__main__` invariant + health check
- [ ] 18. **#12** Gate or delete `/api/debug/cache-test`
- [ ] 19. Remaining Step 7: error boundaries, structured error responses, rate limiting



### Open decisions

- 🔴 **Geo strategy — REOPENED July 28 2026. Full decision record at #8-DR.**
The July 27 conclusion ("domains and pages stay `ALL`; Option A is free") rested on an
assumption the product plan contradicts: whole domains (`Import & Export Business Data`,
`For Entrepreneurs | Startups [Indian]`, `Dropshipping [Indian]`) and page subtrees
(*Indian Market Understanding*, *Tools for Product Demand Research (India Specific)*) are
India-specific **by design**. The open question is now:

  > **Should India-specific content be findable in Google in India, or is it acceptable
  > for it to be visitor-only?**

  This matters more than the performance work it came out of, because **the current
  architecture makes tagging content `IN` equivalent to deleting it from Google** —
  Googlebot crawls from US IPs with no cookie, resolves to `US`, and gets a 404.
  **Answer this before tagging a large amount of content**: untagging later restarts the
  indexing clock from zero. Three options with honest costs in #8-DR.4.
- **OG image versioning** — when the share image is redesigned, bump the filename
(`og-image-v2.png`) rather than overwriting. Scrapers cache the whole rendered *card*
keyed on the page URL, so new bytes at the same path are never re-fetched. Keep the
old file so already-cached cards don't break.
- `nested-two.vercel.app` — keep as an alias with `metadataBase` handling the
canonical, or redirect it to `atno.io`? (#13)

---



## ✅ What's Already Good

Worth stating plainly, so refactoring doesn't undo it:

- **Services layer** (`src/services/`) is genuinely well-structured — clear
separation, consistent `cache()` wrapping, shared types in one place.
- `PageService.getByPath` correctly replaced an N+1 loop with a single batched
`slug: { in: [...] }` query plus in-memory parent-chain traversal, with a sensible
per-segment fallback.
- `usePageContext`**'s fetch strategy** is smart: static data fetched once behind a
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

*Full-codebase audit, July 25 2026. Findings verified against production* `master` *@* `c4ff8d8`*.*
*Revision 2 (July 26): corrected finding #4; added #14 (SEO) with the geo decision record.*
*Revision 3 (July 26): added Done checkboxes throughout; marked #1 and #15.3 complete.*
*Revision 4 (July 26): #13* `robots.ts` *shipped; corrected the planned* `/api/` *disallow
list (it would have hidden table content from Google); logged* `/header1` *for deletion;
root* `/` *redirect changed 307 → 308 (#14 A0).*
*Revision 19 (July 28): **breadcrumb label resolution fixed, then JSON-LD shipped.**
`buildBreadcrumbData` matched labels by slug alone; 83 (domain, slug) pairs have multiple
pages (16.5% of the catalogue), and comparing old vs new across all 1,163 paths showed
**20 changed** — including `websitebuilders` reporting "AI Website Builders" for a page
actually named "Website Builders (CMS)". That corrects an earlier claim in this document
that no unrelated title ever appeared. Then added `BreadcrumbList` + `Organization`
JSON-LD with a real `</script>`-injection defence, verified against a hostile title. No
user-visible breadcrumb change — `bread.tsx` was already correct via `currentPage.title`,
though it shares the same latent weakness for intermediate segments.*

*Revision 18 (July 28): **#7 done.** Server breadcrumb is now opt-in and off by default,
removing three database round-trips (one of them uncached, one a query whose result was
never read) from the hottest endpoint. The visible breadcrumb is provably unaffected:
`usePageContext` already overwrote the server value with an empty object. Also recorded
why the "double `getByPath`" happened — React `cache()` compares object arguments by
reference, so two `segments.slice(2)` calls missed the memo — and documented a latent
slug-only label-matching bug in `buildBreadcrumbData` that must be fixed before any
JSON-LD use. **Phase C now needs only #4 (branch deletion, being done via the GitHub
UI).***

*Revision 17 (July 28): **#15.2 done** — country cookie now re-detects per request and
writes only when the value changes (so a settled visitor triggers no `Set-Cookie`, which
keeps responses cacheable after #15.1); `maxAge` 1yr → 30d. The local-dev guard that lets
you hand-set `user-country=IN` is preserved. **Plus a proper 404 page** replacing the Next
default — two files so `/domain/*` 404s keep the sidebar, no DB query on the 404 path, and
all variants verified to return HTTP 404 rather than a soft 404.*

*Revision 16 (July 28): **Phase C mostly done** — #9, #10, #12, #13b and #2's doc tick.
**10 files / 1,660 lines deleted** (4 live public endpoints, 4 dead hooks, `/header1`,
`/api/debug/cache-test`) plus **518 lines** of dead comments from `TableLayout.tsx`
(723 → 205). All references grepped before deleting; the two `import type` lines were
repointed and the build verified green FIRST. Zero active `console.log` left outside
generated code. Only #7 and #4 remain in Phase C.*

*Revision 15 (July 28): added **decision record #8-DR** — investigated making the public
pages static, found it cheaper than estimated (only 3 `cookies()` calls force dynamic
rendering, and table-row filtering never touches the page render), then **rejected the
"drop domain/page geo" approach on evidence from the product plan**: whole domains and
page subtrees are India-specific by design, not the "one or two" assumed. That
investigation surfaced a bigger latent problem — **tagging content `IN` currently deletes
it from Google**, because Googlebot resolves to `US` and gets a 404. Geo strategy
reopened; #8 is now downstream of a product decision and is not scheduled.*

*Revision 14 (July 28): #15.1 confirmed working on production (cold key MISS→HIT, cookie
path correctly `private, no-store`, Vercel logs show a cache icon instead of a function
invocation). **Raised #8 from Medium/cosmetic to High/performance:** logs show ~24
`/domain/*` function invocations in one second during a crawl sweep, and those page
renders — not the API — are now the dominant cost. Recorded that deleting
`force-dynamic` would achieve nothing, because `cookies()` forces dynamic rendering by
itself, and that the cookie read currently changes no output at all since no content is
geo-restricted.*

*Revision 13 (July 28): **#15.1 done.** Country moved into the `/api/page-context` URL
and `Vary: Cookie` removed, so the hottest endpoint is genuinely CDN-cacheable. Shared
cache headers are sent ONLY when the country is explicit and recognised; a cookie-derived
or invalid value falls back to `private, no-store`, because dropping `Vary: Cookie` while
reading the cookie would let the CDN serve one visitor's navigation to everyone. Found a
third fetch site the plan had missed.*

*Revision 12 (July 28): **#5 and #6 done.** `revalidateTag` wired into 13 mutating
handlers (15 calls, 9 files), verified end-to-end with a real authenticated session —
category rename and domain unpublish now appear with zero wait. Corrected the severity
claim: 300s for categories, 60s for domains/pages, table and rich-text content already
instant. Found two table routes that DID need invalidation, via `tx.page.update` inside a
`$transaction` — which a `prisma.page.update` grep missed. Recorded that 8 of 12
`CACHE_TAGS` entries have no subscribers. #6: both `new PrismaClient()` replaced with the
singleton, plus an eslint rule tested in both directions.*

*Revision 11 (July 28): corrected the* `lastmod` *source.* `Page.updatedAt` *alone was
stale for **91.7% of pages** — content lives in* `Table.data` */* `RichTextContent`*, up to
147 days newer — which would have made Google discard* `lastmod` *site-wide. The earlier
"understates freshness, safe direction" framing was wrong.* `pageLastModified()` *now
takes the newest of the page and its content rows; 912 URLs moved to their real dates.*
*Revision 10 (July 27):* `updatedAt` *added to* `Page`*/*`Domain` *and applied to all three
Neon branches;* `sitemap.ts` *now emits* `lastModified` *on all 1198 entries, backfilled
from* `createdAt` *so dates spread Sep 2025 – Mar 2026 rather than all reading "today".*
*Revision 9 (July 27): **#3 migration drift resolved.** Finding was understated —
production had NO* `_prisma_migrations` *table at all, and the missing schema included
the entire auth model set (*`User`*/*`Account`*/*`Session`*/*`VerificationToken`*), not just*
`targetCountries`*. Baselined 11 migrations on production,* `development` *and a rehearsal
branch; verified a fresh* `migrate deploy` *now builds a working database. Also found and
fixed local dev pointing at the production database.* `directUrl` *was not required
(Prisma 6.14 over Neon's pooler) — an earlier claim to the contrary was wrong.*
*Revision 8 (July 27): geo audit — **0 of 34 domains, 0 of 1195 pages and 0 of 8050
table rows are currently country-restricted**, so the whole geo system is inert. Geo
strategy resolved: keep domains/pages* `ALL`*, vary only table rows, because a
geo-restricted page is unindexable (Googlebot resolves to US and gets a 404). Noted the
ALL+US asymmetry: US rows are indexed for free, IN/GB/AU/CA rows never are.*
*Revision 7 (July 27):* `sitemap.ts` *shipped — 1198 URLs with parent-chain traversal.
**Phase A complete.** The planned flat query would have made 39% of entries 404.*
`lastModified` *omitted because* `Page`*/*`Domain` *have no* `updatedAt` *(added to Phase B).
Recorded the decision NOT to add* `<meta keywords>`*, and dropped* `changeFrequency` */*
`priority` *for the same reason.*
*Revision 6 (July 27): brand favicons installed (the tab icon was still Vercel's),
static 1200×630 OG card,* `twitter:card` *→* `summary_large_image`*,* `/domain` *title made
brand-led, design assets consolidated into* `design/`*. Documented two Next.js metadata
traps found by reading the rendered head:* `openGraph` *is replaced not merged, and
declaring* `icons` *suppresses the file-convention* `apple-touch-icon` *tag.*
*Revision 5 (July 27): #14 SEO-A shipped (*`src/lib/seo.ts` *+ per-page metadata + OG).
Corrected three plan errors — Next.js replaces rather than merges* `openGraph`*,* `|` *is
unusable as a title separator, and the emoji regex needed wider ranges. Corrected
#15.4: page/domain-level geo targeting is supported but **currently unused** (0 rows),
so the* `noindex` *guard is a no-op today and Option A costs nothing.*