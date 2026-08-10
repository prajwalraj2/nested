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
| [x]  | 11  | DB write during page render (`getOrCreateMainPage`)                              | 🟢 Low          | Design smell       | 1 hr      |
| [x]  | 12  | `/api/debug/cache-test` open in production                                       | 🟢 Low          | Info leak          | 5 min     |
| [x]  | 13  | No `robots.txt` / `sitemap.xml` (404s in Vercel logs)                            | 🟢 Low          | SEO                | 30 min    |
| ~    | 14  | **Every page shares one title** — no per-page metadata                           | 🟠 **High**     | SEO / Growth       | 2 hrs (A) |
| ~    | 15  | Geo implementation — stale cookie, dead CDN cache, lost cookie on redirects      | 🟡 Medium       | Correctness / Perf | 1–2 hrs   |
| [x]  | 16  | Admin login had no brute-force limit + a user-enumeration timing leak            | 🟠 **High**     | Security           | 1.5 hrs   |
| ~    | 17  | **Seeded `admin@example.com` was live on production with the password committed to this repo** | 🔴 **Critical** | Security | 5 min |
| [x]  | 18  | Table data route uncached — a DB query on every view of 666 pages                 | 🟠 **High**     | Performance        | 1.5 hrs   |
| [x]  | 19  | No error boundaries anywhere — an unhandled throw served a bare 500               | 🟡 Medium       | Resilience / UX    | 1.5 hrs   |
| [x]  | 20  | **CONFIRMED BUG: 5 admin screens are frozen at build time — edits never appear**   | 🔴 **Critical** | Correctness / UX   | 1 hr      |
| ~    | 21  | Dark/light mode — **Phase 1 (public) DONE**; Phase 2 (admin) open                 | 🔵 Feature      | UX                 | 2 hrs–1 day |
| ~    | 22  | **Admin audit — 22.1/22.3/22.4/22.5 DONE; only 22.2 (write-once table data) open** | 🔴 **Critical** | Functionality      | multi-day |
| [x]  | 23  | **PRODUCTION OUTAGE: all rich-text admin routes 500 — unpinned Node version**      | 🔴 **Critical** | Deploy / Runtime   | 20 min    |
| [x]  | 24  | Domain status (Draft/Published/**Upcoming**) + public "Upcoming Domains" section  | 🔵 Feature      | Schema / UI        | Phase H   |
| [x]  | 25  | Page status + "Upcoming Resources" on section-based pages                        | 🔵 Feature      | Schema / UI        | Phase I   |
| [x]  | 26  | A `__main__` page can never be saved — app rejects a slug it generated itself      | 🟡 Medium       | Admin / Bug        | 30 min    |
| [x]  | 27  | Real icons for Domains and Pages — SVGs in /public, replacing emoji-in-title  | 🔵 Feature      | Schema / UI        | Phase J   |


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

### ✅ DONE — 29 Jul 2026

**Two of the three follow-ups above were deliberately NOT done. Reasons below.**

#### What the audit found before touching anything

Queried the development branch (a copy-on-write clone of production):

```
direct domains                             : 32
  └─ missing __main__                      : 0     ← the create branch had NEVER fired
  └─ with more than one __main__            : 0     ← the race had never happened
hierarchical domains with a stray __main__ : 0
Page indexes                               : Page_pkey, Page_domainId_parentId_slug_idx (NON-unique)
```

So the lazy creation was dead code in practice, and removing the safety net risked
nothing that exists today.

#### Correction to this finding's own text

The line reference `page.tsx:65` was stale — after the #7 / JSON-LD restructure the call
sat at **:316**. And the `hierarchical → direct` switch is in the **`PUT`** handler at
[`domains/[id]/route.ts:196`](src/app/api/admin/domains/[id]/route.ts#L196), not `PATCH`
(`PATCH` only handles `isPublished`, `orderInCategory` and `targetCountries` — it cannot
change `pageType`).

#### There are four `__main__` creators, not two

| # | Where | Trigger | Kept? |
| - | ----- | ------- | ----- |
| 1 | `POST /api/admin/domains` (:223) | domain created as `direct` | ✅ the primary one |
| 2 | `PUT /api/admin/domains/[id]` (:196) | `hierarchical → direct` switch | ✅ |
| 3 | `POST /api/admin/pages` (:171) | page created under a direct domain with no `__main__` | ✅ — it is already a write request, so self-healing there is legitimate |
| 4 | `domain/[...slug]/page.tsx` (:316) | **a public visitor loads the root** | ❌ **removed** |

All three survivors check for an existing row before inserting.

#### What changed

- [`page.tsx`](src/app/domain/[...slug]/page.tsx) — `getOrCreateMainPage(domain.id, domain.name)`
  → `getMainPage(domain.id)`, plus a `console.error` + `notFound()` when it is missing.
  A missing `__main__` means the root genuinely has no content, so 404 is the honest
  answer; the log names the domain so it is fixable in admin.
- [`page.service.ts`](src/services/page.service.ts) — **`getOrCreateMainPage` deleted
  outright**, not just left unused. Its only caller in the entire codebase was that one
  render line (the admin routes each do their own inline `prisma.page.create`), so nothing
  broke. An unused write-on-read helper is exactly what someone reaches for later without
  noticing it mutates.

#### Unplanned bonus: these 32 roots were never cached

`getOrCreateMainPage` was a plain `async` function — **deliberately uncached, because it
could write** (its own comment said so). `getMainPage` wraps `unstable_cache`. So every
visit to any of the 32 direct-domain roots was doing an uncached database read; they now
hit the Data Cache. This was a performance fix disguised as a correctness fix.

#### Follow-up 1 (unique constraint) — SKIPPED, on purpose

Prisma cannot express `UNIQUE (domainId) WHERE slug = '__main__'` in `schema.prisma`, so
it would have to go in as raw SQL inside a migration. The shadow database would then
contain an index the schema does not declare, which Prisma reports as drift and tries to
`DROP` on the next `migrate dev` — reintroducing exactly the problem #3 was spent
cleaning up.

A plain `@@unique([domainId, slug])` is **not** an option either: 83 `(domain, slug)`
pairs already collide legitimately across different parents (measured in #7), so it would
fail on existing data.

And it is no longer needed. The race was between two concurrent **anonymous GETs**;
removing #4 eliminates it. The only remaining writers are three admin paths that all check
first, and admin domain-creation is a single deliberate action, not a concurrent one.

#### Follow-up 2 (HealthCheck repair panel) — SKIPPED for now

The `console.error` covers the same need at a fraction of the cost: it surfaces in the
Vercel logs naming the exact domain, and per the audit it should never fire. Worth
revisiting only if it ever does.

#### Verification

Production build clean, `tsc --noEmit` clean, then against a real running server:

- **All 32 published direct-domain roots → HTTP 200 and rendered content.**
- **12 concurrent requests** to one root — the exact scenario that could previously race
  into duplicate rows.
- **`Page` row count unchanged: 1195 before, 1195 after. `__main__` count unchanged at
  32.** Zero writes during render — the actual point of this finding.
- **Failure branch exercised deliberately:** renamed one domain's `__main__` slug on the
  development branch, and its root returned **404** with the expected log line —
  `[#11] direct domain "affiliatemarketing" (…) has no __main__ page` — and **created 0
  replacement rows**. Slug restored in a `finally`; count back to 1.

⚠️ One observation from that test that is **not** a bug: after restoring the row directly
via Prisma, the root kept 404ing until the cache TTL expired. That is because the test
bypassed the API, so no invalidation fired. `getMainPageFromDB` is tagged
`CACHE_TAGS.PAGES`, and all three real creation paths call `invalidateDomains()` /
`invalidatePages()` — both of which `revalidateTag(PAGES)` — so a genuine admin-side
repair takes effect immediately.

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
| ⛔ `next/image` for `NarrativeLayout.tsx:104` — **WON'T DO (29 Jul)** | Raw `<img>` has no `width`/`height` → layout shift, and CLS *is* a ranking signal — but see next column | **`NarrativeLayout` renders for 0 of 1,198 pages.** It is only reachable via the `default:` branch of the layout switch, and the only four `contentType` values in the database — `table` (666), `rich_text` (418), `subcategory_list` (74), `section_based` (37) — each have an explicit `case`. Optimising an image in unreachable code buys nothing. Revisit if a `narrative` contentType is ever introduced. |
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



## 🟠 16. Admin Login Had No Brute-Force Limit — and Leaked Which Emails Exist

**Severity:** High — the account it protects can edit all 1,198 pages.
**Status:** ✅ **DONE, 29 Jul 2026.**

### What was wrong

Two separate problems in the same function, `authorize()` in `src/lib/auth.ts`.

**1. Unlimited password guesses.** Verified by search, not assumption:

```
rate limiting anywhere in src/     : none
account lockout / attempt counting : none
bcrypt cost                        : 12  (~438 ms per compare, measured)
```

`POST /api/auth/callback/credentials` accepted guesses forever. The only brake was
bcrypt's cost, which caps one attacker at roughly 200,000 guesses/day — and that is
parallelisable across connections. Survivable against a strong password; not a control
worth relying on alone for the account that owns the whole CMS.

**2. A user-enumeration timing side channel.** The old code returned `null` the moment
the email was not found, *before* reaching bcrypt:

```
unknown email               -> one indexed SELECT     ~5 ms
real email, wrong password  -> SELECT + bcrypt        ~438 ms
```

An ~85× gap is trivially measurable over a network, so anyone could discover which
emails have accounts without ever logging in. The `isActive: false` early-return leaked
deactivated accounts the same way.

### ⚠️ The finding that decided the implementation

The obvious place for a rate limit is middleware — but `api/auth` is **excluded from the
matcher** (`src/middleware.ts`), deliberately, because checking the session inside
middleware would recurse into NextAuth's own handler. **So middleware cannot protect the
login endpoint at all.** The logic had to live inside `authorize()`.

### Why per-account lockout in Postgres, not IP rate limiting in Redis

| Option | Verdict |
| ------ | ------- |
| In-memory `Map` counter | ❌ Vercel gives each serverless instance its own memory. A counter would reset on every cold start and would not be shared between instances, so guesses spread across concurrent connections would never trip it. |
| Upstash Redis + `@upstash/ratelimit` | ⚠️ Correct, but adds an external service and dependency to solve a problem this app does not yet have. |
| **Per-account counters in Postgres** | ✅ Chosen. Postgres is the state every instance already shares. And locking the *account* beats limiting by IP, which an attacker defeats by rotating proxies. |

### What changed

- **`prisma/schema.prisma`** + migration `20260729100000_add_login_lockout` —
  `failedLoginAttempts Int @default(0)` and `lockedUntil DateTime?`. Both additive with
  safe defaults, so the migration is backward compatible with the deployed code.
- **`src/lib/auth.ts`** — 5 failures ⇒ 15-minute lock; counters cleared on success;
  a locked account is refused *before* bcrypt runs; **always** runs bcrypt against a
  real cost-12 decoy hash when the user is missing, closing the timing gap; the
  deactivated-account check moved after bcrypt for the same reason; one shared
  `invalid_credentials` code for unknown email / wrong password / deactivated, so the
  response body cannot leak what the timing no longer does; `safeParse` instead of
  `parse`-in-`try` so a validation failure and a database outage stop taking the
  identical path.
- **`src/components/auth/LoginForm.tsx`** — reads `result.code` to explain a lockout with
  the real minutes remaining. (`result.error` is useless for this: it is always the
  literal string `"CredentialsSignin"`, which is why the form could previously only ever
  say "Invalid email or password".)

Lock duration is deliberately temporary, not permanent: a permanent lock would hand an
attacker a denial-of-service against the real admin by simply guessing wrong five times.

**Acknowledged trade-off:** the lockout message reveals that an account exists for that
email — the very thing the timing fix hides elsewhere. Accepted, because an admin who is
locked out and told only "invalid password" will conclude their password is broken and
never learn to just wait. Reaching that state already requires five failures.

### How it was verified

End-to-end against a running production build and a throwaway user, driving the real
CSRF + credentials-callback flow exactly as the browser does:

| Check | Result |
| ----- | ------ |
| 5 wrong passwords increment `failedLoginAttempts` 1→5 | ✅ |
| Lock set on the 5th, and **reported on that same attempt** | ✅ `locked-15` |
| Counter does not climb past the limit once locked | ✅ stays 5 |
| **The correct password is refused while locked** | ✅ no session issued |
| After expiry, correct password works and both counters reset | ✅ `0` / `null` |
| Unknown email and deactivated account share one code | ✅ `invalid_credentials` |
| Lock logged for the operator | ✅ `[auth] account … locked for 15m after 5 failed attempts` |
| All three real accounts left untouched | ✅ `attempts=0 lockedUntil=null` |

**Timing, measured as medians of 5 samples each:**

```
unknown email              : 485 ms
real email, wrong password : 689 ms
ratio                      : 1.42x   (was ~85x)
```

⚠️ **Honest limit — the gap is reduced, not eliminated.** The residual ~200 ms is the
extra `UPDATE` the real-account path performs to record the failed attempt. Distinguishing
485 ms from 689 ms through internet jitter needs many samples per email and yields only
"this address has an account", so this was accepted rather than chased further. Claiming it
is fully constant-time would be wrong.

### ⚠️ Deploy order matters for this one

`npm run build` runs `prisma generate`, **not** `prisma migrate deploy` — migrations never
apply themselves on Vercel. Because both columns are additive with defaults, the safe
order is: **apply the migration to production first, then deploy the code.** Deploying the
code first would have it query columns that do not exist yet.

---



## 🔴 17. The Seeded `admin@example.com` Account Is Live on Production — With the Password Committed to This Repository

**Severity:** Critical. **Status:** ⬜ open — needs a decision, see below.
**Found 29 Jul 2026,** incidentally, while confirming that the #16 lockout test had not
left counters on any real account.

`prisma/seed-admin.ts` hardcodes a default administrator:

```typescript
email:    'admin@example.com',   // ← Change this to your email
password: 'Admin123!',           // ← Change this to your preferred password
```

Those comments were never acted on. Reading production **read-only**:

```
PRODUCTION accounts:
  admin@example.com                  admin=true active=true lastLogin=2025-09-14
  priyanshupriyadarshi222@gmail.com  admin=true active=true lastLogin=2026-07-26
  prajwalraj2709@gmail.com           admin=true active=true lastLogin=2026-07-28
```

And the stored hash was compared against the committed string **locally**, so no sign-in
attempt was made against production and nothing was written:

```
password === "Admin123!"  ->  true
```

**So `admin@example.com` / `Admin123!` grants full administrator access to atno.io right
now, and the password is in this repository's git history.** The account was genuinely
used once (14 Sep 2025), so it is not a phantom row.

This outranks everything else still open in this document. #1 put authentication in front
of the admin API and #16 slowed brute-force guessing — neither helps when the credential
is published. A guessed password is not brute force; five attempts is not a limit when
one attempt succeeds.

### Options

1. **Delete the row.** Cleanest, but it is a `User` with relations
   (`createdUsers`, `accounts`, `sessions`) — check what references it first.
2. **Deactivate it** (`isActive: false`). One field; #16's logic already refuses
   inactive accounts *after* bcrypt, so it fails closed.
3. **Rotate the password** to something random. Keeps the row and its audit trail.

Whichever is chosen, **`prisma/seed-admin.ts` must stop shipping a real password** —
read it from an environment variable, or generate one with the existing
`PasswordUtils.generateSecurePassword()` and print it once.

⚠️ Note that removing the credential from the file does **not** remove it from git
history. It stays valid until the account is changed in the database, which is why the
database change is the actual fix and the file edit is only hygiene.

### ✅ Half done — 29 Jul 2026

**The live credential is revoked.** Option 1 was taken: the row was deleted via the Neon
console. Confirmed read-only against production afterwards:

```
PRODUCTION accounts (2):
  prajwalraj2709@gmail.com           admin=true active=true
  priyanshupriyadarshi222@gmail.com  admin=true active=true

  ✅ admin@example.com no longer exists on production
```

Row counts unchanged either side of the deletion — `domains=34 pages=1197 tables=651
richTextContent=415` — so nothing cascaded through the `createdUsers` / `accounts` /
`sessions` relations that were the reason to check before deleting.

### ✅ Seed script fixed — 29 Jul 2026

The script was **kept, not deleted.** Deleting it was considered and rejected: creating an
admin through the app requires `requireAdmin()`, so a database with no users has no way to
sign in at all — this script is the only thing that breaks that chicken-and-egg. Removing
it would have fixed the security problem by deleting the disaster-recovery path.

`prisma/seed-admin.ts` now reads `ADMIN_EMAIL`, `ADMIN_PASSWORD` and optionally
`ADMIN_NAME` from the environment, with **no default and no fallback** — a default is
precisely how a placeholder became a production credential, so the convenient path and the
safe path have to be the same one. It also now:

- validates the password against `PasswordUtils.validatePassword()`, the same policy the
  admin UI enforces. A bootstrap account is the last place to accept a weak password.
- sanity-checks the email format, since a typo silently creates an account nobody can use
- **stops printing the password.** The old version echoed it in full, copying it into
  terminal scrollback and any CI log — the same class of mistake as committing it.
- stays idempotent: re-running reports the existing user and changes nothing, rather than
  overwriting a password or re-enabling a deactivated account

**Verified** on the development branch — all four refusal paths exit non-zero (no
credentials; email without password; weak password, listing each policy failure; malformed
email), a valid run creates a working account (hash verifies at cost 12, wrong password
rejected, `isAdmin`/`isActive` true, #16's new columns defaulted correctly), a second run
is idempotent, and the supplied password appears nowhere in stdout. Probe account deleted
afterwards. `tsc` and `eslint` clean.

**Also fixed:** `package.json` had `"seed": "npx tsx prisma/seed.ts"` — and
`prisma/seed.ts` **does not exist**. That script had been dead for some time; the entry is
removed. `COLLEAGUE-SETUP-GUIDE.md` was telling new developers to run `npm run seed:admin`
with no credentials (it would now refuse) and `npx prisma db push` instead of
`migrate deploy` — the very command that caused #3's missing migration history. Both
corrected, plus a note that `npm run build` does not apply migrations.

⚠️ `eslint.config.mjs` needed no change: its exemption globs `prisma/**/*.ts`, not a
filename.

### ⬜ Remaining: the development branch still has the row

Production is clean, but the **development** Neon branch is a copy-on-write clone taken
before the deletion, so `admin@example.com` still exists there:

```
remaining users on dev: admin@example.com, priyanshupriyadarshi222@gmail.com, prajwalraj2709@gmail.com
```

Lower risk — that branch is not deployed and is only reachable with the connection string.
But it is still a live credential whose password is public, and it would come back to
production if that branch were ever promoted or used to reset production. It should be
deleted there too, the same way.

---



## 🟠 18. The Table Data Route Was Completely Uncached

**Severity:** High — it is one of the two hottest endpoints on the site.
**Status:** ✅ **DONE, 29 Jul 2026.**

### What was wrong

`table` is the most common content type: **666 of 1,198 pages**. Every one of them fetches
`/api/domain/tables/by-page/[pageId]` client-side from `TableLayout.tsx`. Nothing about
that request was cached at any layer:

```
TableService.getPublicTable  ->  React cache() ONLY
Cache-Control headers        ->  none
```

Those are two different failures that look like one:

- **React `cache()` is request-scoped.** It dedupes repeat calls *within a single render*
  and dies with the request. The route calls `getPublicTable` exactly once per request, so
  it had nothing to deduplicate. The file's own header said "request-level deduplication",
  which was accurate — request-level is simply the wrong level here.
- **No `Cache-Control`** meant Vercel's CDN never stored the response.

Net effect per view of a table page: **2 function invocations and 2 database round trips**,
repeated for every visitor and every refresh.

> ⚠️ **Correction to something claimed earlier in this session.** I initially assumed the
> service layer was caching this and described the fix as "add cache headers". Reading
> `table.service.ts` showed only React `cache()`. The service layer was the bigger half of
> the problem.

### The fix

Same shape as #15.1's fix for `/api/page-context`, because it is the same problem:

1. **Country moved into the URL** (`?country=IN`). A cookie-derived response is personal
   by definition — put shared cache headers on it and the CDN stores one visitor's rows and
   serves them to everyone. With the country in the URL, the URL fully identifies the
   response and it becomes safely shareable. Validated against a whitelist so
   `?country=<junk>` cannot mint unbounded CDN entries.
2. **Shared cache headers** when the country is recognised, `private, no-store` when it
   falls back to the cookie. Plus `X-Country-Source: url|cookie` as a one-line diagnostic.
3. **`unstable_cache` in the service layer**, so a CDN miss still does not reach Postgres.
4. **`TableLayout.tsx` sends the country**, via the same synchronous
   `getUserCountryFromCookie` reader `buildPageContextUrl` uses (the `useUserCountry()`
   hook returns `DEFAULT_COUNTRY` on first render, so a fetch built from it would use the
   wrong country or fire twice).
5. **Deleted 85 lines of dead code** — the route file was 150 lines, of which 85 were
   commented-out pre-refactor Prisma code.

### ⚠️ The cached value deliberately excludes the country

The obvious implementation is `unstable_cache(fn, [pageId, country])`. This does something
better: it caches the **unfiltered** table (which is identical for every visitor) and runs
`filterRowsByCountry` *after* the cache, per request.

- **Country cannot leak.** There is no country-specific value in the cache to hand to the
  wrong person; the filter always runs against the caller's own country.
- One entry per table instead of one per (table × country) — 6× fewer entries.

The in-memory filter is trivial: 8,050 rows across 651 tables, ~12 rows each.

### ⚠️ THREE MISSING INVALIDATIONS — this change would have shipped a stale-data bug

Caching table content is only safe if edits invalidate it. Auditing every table-writing
route found that **three of four did not invalidate at all**:

| Route + handler | What it writes | Invalidated before? |
| --------------- | -------------- | ------------------- |
| `tables/route.ts` POST | creates a table | ✅ yes |
| `tables/[id]/route.ts` **PUT** | name, schema, settings | ❌ **no** |
| `tables/[id]/route.ts` DELETE | deletes the table | ✅ yes |
| `tables/[id]/data/route.ts` **PUT** | **the actual rows** | ❌ **no** |
| `tables/[id]/data/route.ts` **DELETE** | clears all rows | ❌ **no** |

The row-data `PUT` is the most-used table write there is. All three now call
`invalidatePages()`.

This was legitimate before: table content was only behind React `cache()`, so every load
was already fresh and invalidation was genuinely unnecessary — this document said so
explicitly. Caching the content silently invalidated that reasoning. **The comment block in
`cache-invalidation.ts` that documented "table content is never cached" was corrected in
the same change**, along with the tag census: `CACHE_TAGS.TABLES` had **no subscriber
anywhere** in the codebase, so `revalidateTag(TABLES)` was a no-op. The new entry is tagged
both `TABLES` and `PAGES` — `PAGES` because that is what the admin routes already fire, and
`TABLES` so the tag finally means something. `invalidatePages()` now fires it too.

### How it was verified

Country tagging was **unused** — 0 of 8,050 rows were tagged — so correctness could not be
observed from existing data. Rows were tagged on the development branch covering every rule
in `filterRowsByCountry`, then driven through the real HTTP endpoint. **17 checks, all
passing:**

```
US  sees: ALL, US-only, IN+US, untagged, empty-tag
IN  sees: ALL, IN-only, IN+US, lowercase, spaced, untagged, empty-tag
GB  sees: ALL, spaced, untagged, empty-tag
ALL sees: ALL, untagged, empty-tag
```

- US never sees `IN-only`; IN never sees `US-only`; every country sees `ALL`
- a lowercase tag (`in`) matches `IN`; whitespace in `" IN , GB "` is trimmed
- untagged and empty-tag rows are visible to everyone (the documented default)
- `targetCountries` is stripped from both the public schema and the public rows
- **6 interleaved US/IN round trips never leaked** — the actual risk of this change
- `?country=IN` → `public, max-age=0, s-maxage=60, stale-while-revalidate=300`;
  no param → `private, no-store`; `?country=ZZ` → `private, no-store`
- an admin row edit through the real API was visible **immediately**, proving invalidation
  fires rather than relying on the TTL

Then, separately, **the cache was proven to be real** rather than merely present in the
source: rows were changed via Prisma directly, bypassing the API so nothing invalidated,
and the endpoint still returned the old 10 rows. Before this change it would have shown the
new data instantly, because nothing was cached.

`?country=ALL` returns only globally-targeted rows, not every row — consistent with how
`/api/page-context` treats `ALL`.

> **One observation worth knowing.** After the 60-second TTL lapsed, a single request still
> returned stale rows and the *next* one was fresh. That is `unstable_cache`'s
> stale-while-revalidate behaviour, not a bug: TTL expiry serves stale once while
> refreshing in the background. It matters only for TTL-driven refreshes — `revalidateTag`
> is immediate, which is why the three invalidation fixes above are what actually keeps
> admin edits instant.

### What it does not fix

The second round trip is still there — the table arrives via a client-side fetch, so the
page still renders empty and fills in. Removing that means server-rendering the table,
which is #8 territory and blocked on **#8-DR**. This makes the round trip cheap; it does
not remove it.

---



## 🟡 19. No Error Boundaries Anywhere

**Severity:** Medium — a safety net, not a fix for a known bug.
**Status:** ✅ **DONE, 29 Jul 2026.**

### What was wrong

```
error.tsx / global-error.tsx        ->  NONE, anywhere
ErrorBoundary / componentDidCatch   ->  none
Sentry or similar                   ->  none
not-found.tsx                       ->  2 (root + domain), sharing NotFoundContent.tsx
```

An unhandled throw during render had nothing to stop at, so it unwound to the root and
Next.js served a bare unstyled 500 — no header, no navigation, no route back. In the admin
panel that also meant losing unsaved form state with no explanation.

`not-found.tsx` does not cover this. `notFound()` is a **deliberate** outcome; this is for
the unplanned — a Neon cold start timing out mid-render, a dropped connection, malformed
data crashing a `.map()`.

### What was added — 5 new files, 0 modified

| File | Catches | Fallback keeps |
| ---- | ------- | -------------- |
| `src/components/ErrorContent.tsx` | shared body | mirrors the `NotFoundContent.tsx` precedent |
| `src/app/domain/error.tsx` | `/domain` + `/domain/[...slug]` | sidebar + breadcrumb |
| `src/app/admin/error.tsx` | the 13 admin pages | admin sidebar + header |
| `src/app/error.tsx` | `/login`, `/unauthorized`, **and throws in the two layouts above** | root layout |
| `src/app/global-error.tsx` | throws in the **root layout itself** | nothing — supplies its own `<html>` |

Three details that are easy to get wrong:

- **A boundary does not catch its own layout.** An error in `domain/layout.tsx` bubbles
  *past* `domain/error.tsx` to the parent — which is the entire reason `src/app/error.tsx`
  exists. Those layouts are not trivial (`PageContextProvider`, `AppSidebar`, `bread.tsx`;
  `SessionProvider`, `AdminSidebar`, `AdminHeader`). **Verified**: a layout throw produced
  a 500 with the domain shell absent from the payload, proving `domain/error.tsx` did not
  handle it.
- **`global-error.tsx` must import `globals.css` itself.** It replaces the root layout, the
  only other importer, so without that line every Tailwind class is inert and the page
  renders as unstyled black-on-white. **Verified**: with the root layout deliberately
  broken, the response still contained one `<html>`, one `<body>`, a linked stylesheet and
  27 KB of content — not a blank page.
- **The UI shows `error.digest`, not `error.message`.** In production Next strips the
  message from Server Component errors before it reaches the browser and keeps only the
  digest, which matches the server log line. Printing the message would look informative in
  development and show nothing useful in production.

### ⚠️ The real risk, and how it was checked

`notFound()` and `redirect()` are implemented by **throwing**. `domain/[...slug]/page.tsx`
calls `notFound()` in five places and `/` calls `redirect('/domain')`. Had a boundary
swallowed those, **every 404 would have become a 500 and the site's entry point would have
broken** — a spectacular regression from adding what looks like a harmless fallback.

React re-throws these control-flow errors, so `not-found.tsx` and the redirect still win.
That was **verified rather than taken from the documentation**, against a production build:

```
/                        308  redirect         <- entry point intact
/domain                  200  ok: Domains      domain-shell
/domain/gdesign          200  ok               domain-shell
/domain/does-not-exist   404  404-page         <- NOT 500
/nonexistent             404  404-page
/login, /unauthorized    200  ok
/robots.txt, /sitemap.xml 200 ok
6 real deep paths from the sitemap  200  domain-shell
server-side errors logged: none
```

Boundaries were then exercised individually with a temporary `process.env.BOOM` trigger in
each page and layout (all five removed before commit — `grep` confirmed zero remaining):

| Trigger | Result |
| ------- | ------ |
| domain page throws | 500, Next logged `digest: '3344484879'`, 404s and `/` unaffected |
| admin page throws | 500, **admin shell still in the payload**, `/admin` unaffected |
| domain layout throws | 500, **domain shell absent** — fell through, as designed |
| root layout throws | 500, valid document with linked CSS — `global-error` territory |

All four boundary UIs and their distinct log tags were confirmed present in the built
client chunks.

### ⚠️ Two honest limits on this verification

**1. These boundaries render on the CLIENT.** For a 500 on a dynamic route Next 15 returns
a minimal shell (`<html id="__next_error__">`) and streams the content as escaped JSON, so
`Something went wrong` never appears in the server HTML. Server probing therefore proves
the status code, the digest, which components are in the tree, and that the code shipped —
**not the final painted DOM**. No headless browser is installed, so the visual confirmation
is a manual browser check.

**2. A correction to comments written earlier in this change.** They claimed the
`console.error` in each boundary's `useEffect` reaches the Vercel logs. It does not —
`useEffect` runs only in the browser. The server side is already covered by Next itself,
which logs the real error and digest automatically (seen directly in the server log during
the triggered throws). The comments were corrected; the `console.error` calls are useful
mainly for CLIENT-component errors, where Next logs nothing server-side.

### Deliberately skipped

No `loading.tsx` files. Separate concern (Suspense fallbacks), pages already handle their
own loading states (`TableLayout` has a Skeleton), and adding them would change perceived
behaviour on every route for no correctness gain.

---



## 🔴 20. CONFIRMED BUG — Five Admin Screens Are Frozen at Build Time, So Edits Never Appear

**Severity:** Critical — the CMS lies to the person operating it.
**Status:** ⬜ open, and this is the **top priority** of the remaining items.

**Found incidentally on 29 Jul 2026** while testing #19: an error trigger placed in
`admin/page.tsx` never fired, because that page is never executed at request time.

### ✅ CONFIRMED BY REAL-WORLD USE — not an inference

The user, unprompted, described exactly this symptom:

> "When I change/update/create — some things, it does happen in live website. But so many
> things don't show up in the Admin UI — and that's a very glitch in the admin UI."

That is the signature of this bug precisely. The public pages are `force-dynamic`, so they
re-query on every view and updates appear. The affected admin screens are static HTML built
once at deploy time, so they cannot change no matter what is edited. **The live site being
correct while the admin panel is wrong is not a coincidence — it is the same root cause seen
from both sides.**

### The measurement

Every admin screen, by rendering mode:

```
/admin                            STATIC     FROZEN at build  <-- reads DB
/admin/categories                 STATIC     FROZEN at build  <-- reads DB
/admin/sections                   STATIC     FROZEN at build  <-- reads DB
/admin/tables                     STATIC     FROZEN at build  <-- reads DB
/admin/tables/new                 STATIC     FROZEN at build  <-- reads DB
/admin/rich-text                  STATIC     (fetches client-side — fine)
/admin/users                      STATIC     (fetches client-side — fine)
/admin/users/new                  STATIC     (pure client form — fine)
/admin/domains                    dynamic    live
/admin/pages                      dynamic    live
/admin/tables/[id]                per-param  live
/admin/users/edit/[id]            per-param  live
/admin/rich-text/edit/[pageId]    per-param  live

8 of 13 screens are static; 5 of those actually serve stale data.
```

> ⚠️ **Correction to this document's first version of this finding**, written hours earlier:
> it said "six admin pages". The real count of static screens is **eight** — `/admin/tables/new`
> and `/admin/users/new` were missed. But only **five** are genuinely broken, because three of
> the eight get their data from `useEffect` + `fetch('/api/admin/...')` on the client, so a
> static shell is harmless for them. Being static is not the bug; being static **while reading
> the database during server render** is.

### Why it happens

`initialRevalidateSeconds=false` on each — there is **no ISR at all**, they never re-render.
`.next/server/app/admin.html` exists as a real file on disk and is served verbatim. And **no
admin page declares `force-dynamic` or `revalidate`**.

Next 15 renders a page statically when it uses no dynamic API — no `cookies()`, no
`headers()`, no `searchParams`. These five call Prisma directly during render, so those
queries ran once at build time and the results were baked into HTML:

| Screen | Queries frozen into the HTML |
| ------ | --------------------------- |
| `/admin` | `domain.findMany`, `page.findMany`, `contentBlock.count`, `domainCategory.findMany` |
| `/admin/categories` | `domainCategory.findMany` |
| `/admin/sections` | `domain.findMany` |
| `/admin/tables` | `table.findMany`, `domain.findMany` |
| `/admin/tables/new` | `domain.findMany` |

`/admin/domains` and `/admin/pages` escape only **by accident**: they accept `searchParams`,
which forces dynamic rendering. Nothing about them was a deliberate choice, which is worth
knowing — a future refactor that dropped the `searchParams` prop would silently freeze them
too.

A concrete example of how this bites: create a new domain, then open **New Table**. The
domain is missing from the dropdown, because that `domain.findMany` ran at build time. There
is no error and no clue — the domain simply is not there.

### Why the #5 invalidation work does not help

`revalidateTag` clears the Data Cache (`unstable_cache` entries). These pages do not use
`unstable_cache` — they call Prisma directly — so there is no tag associated with them and
nothing to invalidate. Every `invalidatePages()` call in the codebase is powerless here.
**This is a different mechanism from everything #5 and #18 fixed**, which is why all that
invalidation work did not make the admin panel any fresher.

### The fix

`export const dynamic = 'force-dynamic'` on the five screens that read the database.

Deliberately **not** applied to the three static-but-client-fetching screens: they are
already live, and making them dynamic would add a function invocation per view for no gain.

The trade-off is explicit: build-time rendering is exchanged for one function invocation and
one query per view. For a CMS admin panel used by a handful of people, that is obviously the
right side of the trade — correctness matters and traffic is negligible. It is the opposite
of the public-page calculus in **#8-DR**, where 1,198 pages × crawler traffic makes static
rendering genuinely valuable.

**Also worth doing at the same time:** an audit for the same pattern elsewhere, and a note in
the code explaining why these exports exist — the next person to see
`export const dynamic = 'force-dynamic'` on an admin page will otherwise assume it is
cargo-culted from the public routes and delete it.

### ✅ DONE — 29 Jul 2026

`export const dynamic = 'force-dynamic'` added to exactly the five screens that read the
database during render. Each carries a `⚠️ DO NOT REMOVE` comment naming this finding;
`src/app/admin/page.tsx` holds the full explanation and the others cross-reference it. That
was the point of the note above — the export looks like cargo-culting from the public routes
and would otherwise be a tempting deletion.

**Result, measured from the build manifest:**

```
/admin                          dynamic  reads DB  fixed  [force-dynamic]
/admin/categories               dynamic  reads DB  fixed  [force-dynamic]
/admin/sections                 dynamic  reads DB  fixed  [force-dynamic]
/admin/tables                   dynamic  reads DB  fixed  [force-dynamic]
/admin/tables/new               dynamic  reads DB  fixed  [force-dynamic]
/admin/domains                  dynamic  reads DB  (was already, via searchParams)
/admin/pages                    dynamic  reads DB  (was already, via searchParams)
/admin/rich-text                STATIC   no        fine — client-fetched
/admin/users                    STATIC   no        fine — client-fetched
/admin/users/new                STATIC   no        fine — pure client form
/admin/tables/[id]              dynamic
/admin/users/edit/[id]          dynamic
/admin/rich-text/edit/[pageId]  dynamic

screens reading the DB while static: 0
prerendered routes: 16 -> 11   (exactly the five moved; nothing else changed)
```

Deliberately **not** applied to the three static-but-client-fetching screens: their data is
already live, so making them dynamic would add a function invocation per view for nothing.

#### Verified with the reproduction from this finding

Against a running production build, signed in as a throwaway admin on the development
branch, creating a domain through the **real admin API** — no rebuild, no restart, no waiting:

| Check | Result |
| ----- | ------ |
| dashboard "Total Domains" before | 34 |
| dashboard "Total Domains" after | **35** — incremented immediately |
| new domain in `/admin/tables` | **appears** |
| new domain in `/admin/sections` | **appears** |
| `/admin/categories`, `/admin/sections` still render | ✅ |

> ⚠️ **A test expectation of mine was wrong, and it is worth recording because it looks
> exactly like a bug.** The new domain did **not** appear in the New Table wizard, and the
> first instinct was that the fix had failed. It had not —
> `src/app/admin/tables/new/page.tsx:75` filters to domains that already have a page whose
> `contentType` is `table` or `narrative`:
>
> ```typescript
> const availableDomains = domains.filter(domain => domain.pages.length > 0);
> ```
>
> A brand-new domain has only its `__main__` page (`section_based`), so it is **correctly**
> excluded. Re-tested by creating a `table`-type page in the domain first, after which it
> appeared immediately. So the wizard is fresh; it simply has a design rule.
>
> Whether that rule is good UX is a separate question — a new domain silently missing from
> the picker with no empty state or explanation is confusing, and it is exactly the kind of
> thing the planned admin audit should catalogue. **Not a #20 defect.**

Development branch verified clean afterwards: probe domain, its pages and the throwaway
admin all removed, 0 residue.

> **Note on a baseline number**, so it does not cause confusion later: the development branch
> has **1,195** `Page` rows while production has **1,197**. Both are correct — the dev branch
> is a copy-on-write clone taken at an earlier point. A cleanup assertion in this session
> briefly flagged 1,195 as "residue found" purely because it was compared against
> production's figure.

---



## 🔵 21. Dark / Light Mode — Audit and Implementation Plan

**Type:** Feature request (not a defect). **Status:** ⬜ open, not started.
**Audited 29 Jul 2026** across all 106 `.tsx` files, `globals.css`, `package.json` and the
415 stored rich-text rows, before writing any code.

---

### 21.1 — The foundation already exists and is correct

This was the surprise. Everything shadcn's dark mode needs is already in the repository:

```
next-themes 0.4.6      installed  ✅   ...but NEVER imported anywhere — a dead dependency
Tailwind v4            @custom-variant dark (&:is(.dark *))   ✅  class-based, not media-query
globals.css :root      31 colour tokens + --radius            ✅
globals.css .dark      all 31 colour tokens — FULL parity     ✅
@theme inline          maps --color-* -> var(--*)             ✅
body                   @apply bg-background text-foreground   ✅
```

`grep -rn "next-themes\|ThemeProvider\|useTheme" src/` returns **nothing**. The package is
in `package.json`, has never been used, and has presumably been shipped in the bundle
manifest since it was installed.

> ⚠️ **Correction to a claim made during this audit.** A first pass reported that `.dark`
> was missing all 31 tokens that `:root` defines. That was wrong — the parsing script had
> matched Tailwind v4's `@theme inline` block (whose variables are named `--color-*`)
> instead of the real `.dark` rule. Reading `globals.css:81-113` directly shows `.dark`
> defines every token. **The tokens are complete; nothing is missing there.**

`@custom-variant dark (&:is(.dark *))` is the important line: dark styling activates from a
`.dark` **class on an ancestor**, not from the OS `prefers-color-scheme` media query. So the
operating system's dark setting currently does nothing at all, and cannot, until something
puts that class on `<html>`.

**Three pieces are missing, and only three:**

1. A `ThemeProvider` (next-themes) wrapping the app, to set `.dark` on `<html>`
2. `suppressHydrationWarning` on the `<html>` element in `src/app/layout.tsx`
3. A toggle control — **there is none anywhere in the codebase**

On (2): next-themes injects a small blocking script that reads `localStorage` and sets the
class *before* first paint — that is what prevents a flash of the wrong theme. But it means
the HTML the server sent and the HTML the browser has at hydration differ on that one
element, which React reports as a hydration mismatch. `suppressHydrationWarning` on `<html>`
silences it for that element only. Omitting it produces a console error on every page load.

> The screenshots that prompted this request show a sun/moon toggle button. Nothing like it
> exists in `src/` — no `Moon`/`Sun` icon import, no `setTheme` call — so those are a design
> reference for what to build, not the current state.

---

### 21.2 — The scale: 1,220 hardcoded colour classes in 60 of 106 files

A hardcoded class like `bg-gray-50` or `text-white` is a fixed value. It ignores the theme
entirely, so it stays exactly as-is when `.dark` is applied — which is what produces a
half-themed page.

Distribution is extremely lopsided:

| Area | Occurrences | Files | Verdict |
| ---- | ----------- | ----- | ------- |
| `src/components/admin` | **984** | 32 | the bulk of the work |
| `src/app/admin` | **162** | 13 | same |
| `src/components/domain` | 30 | 5 | mostly unreachable — see below |
| `src/components/table` | 20 | 1 | `DataTable`, already partly done |
| `src/components/header` | 12 | 1 | **dead code** — see below |
| `src/app/domain` | 3 | 2 | trivial |
| `src/components/ui` (shadcn) | 4 | 4 | effectively clean |
| `src/components/sidebar` | **0** | 0 | fully token-based already |
| `src/components/bread` | **0** | 0 | fully token-based already |
| `src/components/auth` | 1 | 1 | trivial |

**admin 1,146 vs public 66.** The public site was largely built on theme tokens; the admin
panel was not.

The `ui/` primitives are in good shape: 68 token-based background classes against only 4
hardcoded, and all 4 are legitimate — `bg-black` for the dialog and sheet overlay scrims
(which should be black in both themes) and `text-white` on primary buttons.

Existing `dark:` variants in the whole codebase: **29**, spread across the shadcn primitives
plus `DataTable` and `RichTextLayout`.

---

### 21.3 — Half the public "problem" is code that never runs

Two files account for 33 of the 66 public occurrences, and neither renders:

- **`src/components/header/AppHeader.tsx` (12).** Imported in *both* `src/app/layout.tsx:4`
  and `src/app/domain/layout.tsx:6`, and **commented out in both** (`{/* <AppHeader /> */}`).
  Dead code, along with its two dead imports.
- **`src/components/domain/NarrativeLayout.tsx` (21).** Only reachable via the `default:`
  branch of the layout switch, and the database contains only four `contentType` values —
  `table` (666), `rich_text` (418), `subcategory_list` (74), `section_based` (37) — each of
  which has an explicit `case`. It renders for **0 of 1,198 pages**. This is the same
  conclusion already recorded for the `next/image` decision in #14's SEO-B table.

**So the public site's real surface is ~33 occurrences across 8 files:**

```
DataTable.tsx           20   badge/boolean/rating accent colours (partly done already)
TableLayout.tsx          4   border-gray-300 ×4
SectionBasedLayout.tsx   2   border-gray-300 ×2
RichTextLayout.tsx       2   border-gray-300, bg-gray-100
app/domain/layout.tsx    2   text-gray-500 / text-gray-700  (the sidebar trigger)
SubcategorySelector.tsx  1   border-gray-300
app/domain/page.tsx      1   border-gray-300
auth/LoginForm.tsx       1   bg-gray-50  (the page background)
```

**Eight of those are `border-gray-300`** — decorative horizontal rules. `border-border` is a
drop-in replacement for every one.

And `DataTable` was already being done correctly by someone:

```tsx
<span className="font-medium text-green-600 dark:text-green-400 font-mono">   // currency
value ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400' // boolean
star <= stars ? 'text-yellow-500' : 'text-muted-foreground/30'                  // rating
```

Its remaining colours (`bg-blue-600 text-blue-100` badge variants, the green/red status dots,
the yellow stars) are **semantic accents** — a green "Yes" indicator should stay green in
both themes. Saturated 500/600 shades read acceptably on light and dark, so most need no
change; a few may want `dark:` tuning for contrast.

**Conclusion: the public site is roughly 90% dark-mode-ready.**

---

### 21.4 — ⚠️ The genuinely hard problem: inline colours in stored rich-text HTML

This is the part that cannot be solved by editing components, and it needs a decision.

Measured across all 415 `RichTextContent` rows:

```
rich-text rows                        : 415
rows with an inline text colour       : 395   (95%)
rows with an inline background colour :  57
total inline colour declarations      : 2,519
  ...dark enough to vanish on a dark background : 574

most-used inline colours:
   1331  #9ca3af            (mid grey — acceptable on both)
    216  #000000            \
    168  rgb(0, 0, 0)        |  384 pure-black declarations
    168  #292727             |  -> invisible on a dark background
     10  #1a1a1a            /
    180  #767c7c            (mid grey — acceptable on both)
    168  #9b9696            (light grey — fine on dark, weak on light)
    168  rgb(255, 255, 255) (white — presumably paired with the 57 inline backgrounds)
     87  #afb6b5
     19  #f3f4f6
      4  white
```

**Why CSS cannot fix this:** an inline `style` attribute beats any stylesheet rule on
specificity. A `.dark .rich-text-content { color: … }` rule simply loses to
`<span style="color:#000000">`. The only CSS lever is `!important`, which then overrides
*every* author colour indiscriminately — including the 168 white-text declarations that are
presumably deliberate on top of the 57 coloured backgrounds, which would become white on
white.

**There is also an existing rule that actively breaks in dark mode.** From #2's sanitiser
work, `globals.css:154`:

```css
.rich-text-content a:hover { color: #000 !important; }
```

Every hovered link would turn pure black on a near-black background — **invisible**. That
rule needs a dark-mode counterpart regardless of which option below is chosen.

React inline styles were also checked: `grep -rnE "style=\{\{[^}]*(color|background)"` across
all `.tsx` returns **0**. So the problem is confined to stored HTML, not component code.

#### The three options

| | Approach | Trade-off |
| - | -------- | --------- |
| **A** | **Content islands** — keep `.rich-text-content` on a light surface even in dark mode (an explicitly light card inside the dark page), and give the link-hover rule a light-surface-appropriate colour. | Cheapest, zero data loss, no author intent destroyed. The page chrome themes; the article body stays light. This is standard practice for user-generated HTML. **Recommended.** |
| B | `!important` overrides scoped to `.dark .rich-text-content` | Forces readability but discards all author colour, and **breaks** the white-on-coloured-background rows. |
| C | Data migration stripping inline colours from 395 rows, letting CSS theme the content | Content becomes fully themeable, but author styling is permanently and irreversibly lost across the whole catalogue. Needs a product decision and a backup. |

Note that option C interacts with #2: sanitising happens on **write**, so those inline styles
persist until each page is next saved. A migration would be a deliberate one-off pass, not
something that happens naturally.

---

### 21.5 — One thing that is already effectively "dark"

`src/components/admin/layout/AdminSidebar.tsx:121` is:

```tsx
<div className="w-64 bg-gray-900 text-white flex flex-col">
```

A **permanently dark** sidebar, sitting next to `AdminLayout`'s `bg-gray-50` page and
`bg-white` content area (`AdminLayout.tsx:30,44`) and `AdminHeader`'s `bg-white`
(`AdminHeader.tsx:94`). That is why the admin panel already looks half-dark: it is not a
broken theme, it is a hardcoded one. Any real theming work has to replace this with tokens
(`bg-sidebar text-sidebar-foreground` — both of which are already defined for light and dark
in `globals.css`).

---

### 21.6 — Implementation plan

**Phase 1 — public site, ~2 hours.** Delivers a complete, working dark mode for everything
a visitor sees.

| File | Change |
| ---- | ------ |
| `src/app/layout.tsx` | add `suppressHydrationWarning` to `<html>`; wrap children in a `ThemeProvider` |
| `src/components/ThemeProvider.tsx` *(new)* | thin `'use client'` wrapper around next-themes, `attribute="class"`, `defaultTheme="system"` |
| `src/components/ThemeToggle.tsx` *(new)* | sun/moon button; must render a stable placeholder until mounted, or it hydration-mismatches |
| `src/app/domain/layout.tsx` | mount the toggle in the breadcrumb bar; fix `text-gray-500/700` |
| 6 public components | `border-gray-300` → `border-border`, `bg-gray-100` → `bg-muted`, `bg-gray-50` → `bg-background` |
| `src/app/globals.css` | dark counterpart for `.rich-text-content a:hover`; light-surface island for `.rich-text-content` (option A) |
| *cleanup* | delete the two dead `AppHeader` imports while in these files |

**Phase 2 — admin panel, ~1 day.** 1,146 occurrences across 45 files. Mechanical but large:
`bg-gray-50`→`bg-background`, `bg-white`→`bg-card`, `text-gray-900`→`text-foreground`,
`text-gray-500`→`text-muted-foreground`, `border-gray-200/300`→`border-border`, and the
`AdminSidebar` rewrite above.

> **⚠️ REVISED DIRECTION (29 Jul, user request): rebuild on shadcn primitives rather than
> swap colour classes one by one.**
>
> The stated preference is to use shadcn components "as much as we could" — specifically the
> [sidebar block](https://ui.shadcn.com/blocks/sidebar), plus `button`, `breadcrumb`, `sheet`
> and others as they fit.
>
> That is a better plan than a find-and-replace sweep, and probably *less* work, for a
> concrete reason: shadcn components are already written against the theme tokens. Replacing
> `AdminSidebar`'s hand-rolled `bg-gray-900 text-white` markup with the sidebar block does not
> "fix its colours" — it deletes them. Every hardcoded class in a replaced component
> disappears rather than needing a swap.
>
> It also fixes things a colour sweep would not touch: the admin panel currently has **no
> responsive/mobile handling** in its shell (`w-64` fixed sidebar), no keyboard-accessible
> collapse, and its own bespoke breadcrumb markup — all of which the shadcn primitives provide.
> The public site already uses the same `ui/sidebar` primitive, so this also converges the two
> halves of the app on one system instead of two.
>
> **Suggested order for Phase 2:**
> 1. `AdminLayout` + `AdminSidebar` + `AdminHeader` → shadcn sidebar block, `breadcrumb`,
>    `sheet` for mobile. This is the shell, so it fixes the most visible surface first.
> 2. Shared primitives across the 32 admin components — `button`, `input`, `select`, `dialog`,
>    `table`, `badge` — replacing hand-rolled equivalents. Most of the 1,146 occurrences live
>    in these.
> 3. Token swap for whatever genuinely bespoke markup is left.
>
> ⚠️ **This is a rewrite of admin markup, not a restyle.** It will touch the same files as any
> functional fixes, which is why the **admin audit should come first** — fixing behaviour in
> markup that is about to be replaced would waste the work twice over.

> ⚠️ **Sequence this after #20.** Both touch many of the same admin files, and #20 is a
> confirmed bug while this is cosmetic. Doing dark mode first would mean editing those files
> twice and reviewing a much noisier diff.

**Phase 3 — optional.** The rich-text colour migration (option C), only if the content itself
should be themeable.

#### Things that will need testing, not assuming

- **No flash of the wrong theme** on first paint — the reason next-themes' blocking script
  exists; verify against a production build, not `next dev`.
- **No hydration warnings** in the console on any route.
- **The toggle inside `SidebarProvider`** — `src/app/domain/layout.tsx` already nests several
  client providers; the toggle must not remount the tree or reset sidebar state.
- **The admin panel is a separate React tree** (`SessionProvider` → `AdminLayout`) and needs
  the provider to reach it too, which it will from the root layout — but worth confirming
  rather than assuming.
- **`prefers-color-scheme` currently does nothing**, so "system" theme behaviour is entirely
  new and untested in this codebase.

---

### 21.7 — ✅ Phase 1 DONE (public site), 29 Jul 2026

**2 new files, 8 modified.** The public site now has a working light/dark theme.

| File | Change |
| ---- | ------ |
| `src/components/ThemeProvider.tsx` **(new)** | `'use client'` boundary around next-themes: `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange` |
| `src/components/ThemeToggle.tsx` **(new)** | sun/moon button with a `mounted` guard and a same-size placeholder |
| `src/app/layout.tsx` | `suppressHydrationWarning` on `<html>`; wrapped children in `ThemeProvider`; **deleted the dead `AppHeader` import** |
| `src/app/domain/layout.tsx` | mounted the toggle (`ml-auto`) in the breadcrumb bar; `text-gray-500/700` → `text-muted-foreground`/`text-foreground`; **deleted the dead `AppHeader` import and its commented-out JSX** |
| `TableLayout.tsx` ×4, `SectionBasedLayout.tsx` ×2, `SubcategorySelector.tsx`, `app/domain/page.tsx` | `border-gray-300` → `border-border` |
| `LoginForm.tsx` | `bg-gray-50` → `bg-muted` (a fixed-light page behind a themed Card) |
| `RichTextLayout.tsx` | the light content island — see below |
| `globals.css` | documented why `.rich-text-content a:hover { color:#000 }` needs **no** dark variant |

#### Why the `mounted` guard in the toggle is mandatory

The active theme lives in `localStorage`, which does not exist on the server, so
`resolvedTheme` is `undefined` during server render and there is no correct icon to draw.
Whatever the server guesses, the client often disagrees once it reads storage — a hydration
mismatch. The component therefore renders a **same-size** `aria-hidden` placeholder until
mounted. Same-size matters: returning `null` would make the breadcrumb row reflow the instant
hydration completed, so the bar would visibly jump on every page load.

It reads `resolvedTheme`, not `theme`: `theme` can be the literal `"system"`, which is not a
drawable icon, and would leave the button showing the wrong state for everyone on the default
setting — which is everyone until they first click it.

#### Rich text: option A implemented (light content island)

`RichTextLayout`'s card is now `bg-neutral-100 text-neutral-900` — **fixed values, on
purpose**, the one place in the public site that must not follow the theme. Rationale is in
21.4: 574 of 2,519 inline colour declarations are dark, inline styles beat stylesheets, so a
dark surface would make those 574 vanish and `!important` would break the 168 deliberate
white-text rows.

Two traps found and fixed while implementing it:

- `dark:prose-invert` was already on the prose wrapper. On a permanently-light card it would
  have inverted headings and lists to near-white **on light**. Removed.
- The **empty state** inside that card used `text-foreground` / `text-muted-foreground`, which
  resolve to near-white in dark mode — invisible on the light card. Switched to fixed
  `text-neutral-900` / `text-neutral-600`. This is the same bug the card comment warns about,
  found by looking rather than by reasoning.

#### What was verified, and how

`tsc --noEmit` clean, production build clean, then probed against a running production build
(dev is useless here — `next dev` behaves differently):

```
PATH                        ST   antiflash  toggle  stale-gray  island
/                          308   –          –       none        –
/domain                    200   YES        YES     none        –
/domain/gdesign            200   YES        YES     none        –
rich-text page             200   YES        YES     none        YES
/login                     200   YES        –       none        –
/unauthorized              200   YES        –       none        –
/nonexistent -> 404        404   no         –       none        –
/robots.txt                200   –          –       none        –
server errors: none
```

**No flash of the wrong theme — confirmed by byte position, not assumed.** The injected
script sits as the *first* thing inside `<body>`, before any visible markup:

```
</head><body class="geist… antialiased">
  <div hidden=""><template id="B:0"></template></div>
  <script>…("class","theme","system",null,["light","dark"],null,true,true)</script>
  <div class="flex flex-col min-h-screen">   <- visible content starts here
```

Those arguments also confirm the configuration landed: `attribute="class"`,
`storageKey="theme"`, `defaultTheme="system"`, `enableSystem`, and `style.colorScheme` set
(so native scrollbars and form controls match the theme).

> ⚠️ **A wrong conclusion drawn and corrected during this work.** A first check compared the
> script's byte offset against the position of `<body>`, found it later, and concluded "a
> flash is possible". That test was meaningless — what matters is whether the script precedes
> **visible content**, not the `<body>` tag itself. Reading the actual bytes showed it is the
> first child of `<body>`.

#### ⚠️ Known limitation: 404 and error pages flash light before hydration

The `__next_error__` shell that Next 15 serves for `notFound()` and for errors **does not
carry the blocking script** (`localStorage` appears nowhere in that response). The
`ThemeProvider` *is* in the payload — `next-themes` and the root layout's body class are both
present — so the theme does apply, but only after hydration. A dark-mode visitor hitting a
404 sees a brief light flash.

Not fixed: it affects only error paths, and the shell is generated by Next, not by us.
Recorded so it is not rediscovered as a new bug.

#### Also recorded: a stale-cache 404 during testing

The regression sweep showed `/domain/affiliatemarketing` returning **404**. Chased rather than
dismissed: the database was verified intact (all 32 direct domains have `__main__`), and
repeated requests returned 200 from the second onwards. It was the stale `null` cached by
**#11's** test, which renamed that exact domain's `__main__` and restored it via Prisma —
bypassing the API, so no `revalidateTag` fired. Identical stale-while-revalidate behaviour to
the one documented in #18. Development-branch artifact; production was never involved.

#### Not done in Phase 1

- `DataTable`'s remaining 20 hardcoded colours: one is inside a commented-out column-resizer
  block, the rest are **semantic accents** (`bg-blue-600 text-blue-100` badge variants,
  green/red status dots, yellow stars). A green "Yes" indicator should stay green in both
  themes, and 600-on-100 contrast reads acceptably on either surface. `dark:` tuning is
  optional polish, not correctness.
- **Phase 2 (the admin panel, 1,146 occurrences across 45 files) — still open, and still
  sequenced after #20.**

---



## 🔴 22. Admin Panel Audit — Findings and Fixes

**Audited 29 Jul 2026**, after #20 was fixed — which had to come first, because a stale screen
and a broken screen are indistinguishable from the outside. Prompted by "I don't like the whole
UI/UX of the admin panel" and a specific report that table editing does not work.

**Method.** All 13 admin screens were loaded against a production build with a real admin
session on the development branch; every finding was then traced to code, and anything
involving data was measured against the database. Two automated passes produced mostly false
positives and were discarded rather than reported — see 22.6.

### 22.0 — All 13 screens: load status and payload

Every screen returns HTTP 200. No screen is dead. But one is dramatically wrong:

| Screen | HTTP | Payload | Note |
| ------ | ---- | ------- | ---- |
| `/admin` Dashboard | 200 | 50 KB | |
| `/admin/categories` | 200 | 51 KB | |
| `/admin/domains` | 200 | 133 KB | |
| `/admin/pages` | 200 | 37 KB | |
| `/admin/sections` | 200 | 231 KB | large but legitimate — all pages, for the picker |
| **`/admin/tables`** | 200 | **8,592,689 B ≈ 8.19 MB** | 🔴 **37× the next biggest — see 22.1** |
| `/admin/tables/new` | 200 | 212 KB | |
| `/admin/tables/[id]` | 200 | 96 KB | |
| `/admin/rich-text` | 200 | 25 KB | |
| `/admin/rich-text/edit/[pageId]` | 200 | 25 KB | |
| `/admin/users` | 200 | 33 KB | |
| `/admin/users/new` | 200 | 35 KB | |
| `/admin/users/edit/[id]` | 200 | 24 KB | |

---

### 22.1 🔴 `/admin/tables` ships 8.19 MB to render a list

**The single worst thing found.** The screen that lists tables loads the complete contents of
every table — twice — to display names and row counts.

`src/app/admin/tables/page.tsx` runs two queries, and both pull the big JSON columns:

```typescript
// query 1 — `include` with no `select` on Table returns EVERY column, `data` and `schema` included
const tables = await prisma.table.findMany({
  include: { page: { include: { domain: { select: { id: true, name: true, slug: true } } } } },
  orderBy: { updatedAt: 'desc' }
});

// query 2 — `table: true` pulls the whole table again, for every table-type page
const domains = await prisma.domain.findMany({
  include: { pages: { where: { contentType: 'table' }, include: { table: true, … } }, … }
});
```

**Measured on the development branch:**

```
tables                        : 652
total rows                    : 8,065
Table.data  serialised        : 1.97 MB
Table.schema serialised       : 0.48 MB
data + schema                 : 2.45 MB
loaded TWICE by this page     : 4.90 MB
actual page payload           : 8.19 MB   (RSC escaping inflates it further)

what the list view displays   : name, domain, page title, row count, updatedAt
genuinely needed              : ~0.16 MB
waste ratio                   : ~16x on the data, ~50x on the shipped page
```

Every visit to that screen transfers 8.19 MB. On a mobile connection that is tens of seconds,
and it is 8.19 MB of Vercel egress per view. Note this got *worse* with #20: the page is now
dynamic, so it is rebuilt on every request rather than served as one frozen file — the right
fix for correctness, but it makes this over-fetch bite on every view.

#### ✅ The fix

Replace both `include`s with explicit `select`s that omit `data` and `schema`, and compute the
row count in the query rather than in JavaScript.

```typescript
const tables = await prisma.table.findMany({
  select: {
    id: true, name: true, updatedAt: true,
    page: { select: { id: true, title: true, slug: true,
      domain: { select: { id: true, name: true, slug: true } } } },
  },
  orderBy: { updatedAt: 'desc' },
});
```

The row count is the only thing that genuinely needs `data`. Two options, in order of
preference:

1. **A denormalised `rowCount` column on `Table`**, maintained by the write paths that already
   exist (`tables/route.ts` POST and `tables/[id]/data` PUT/DELETE). Costs a migration; makes
   the list query trivially cheap forever.
2. **A raw query** — `SELECT id, jsonb_array_length(data->'rows') AS "rowCount" FROM "Table"` —
   no migration, still avoids transferring the rows, but adds a second query and raw SQL.

The second query's purpose also needs checking: it appears to feed a domain/page picker, and
almost certainly does not need `table: true` at all — `table: { select: { id: true } }` would
answer "does this page already have a table?" for a fraction of the bytes.

**Effort:** ~1 hour for the `select` narrowing alone, which removes most of the 8 MB. The
`rowCount` column is a further ~30 minutes plus a migration.

#### ✅ DONE — 30 Jul 2026

Both `include`s replaced with explicit `select`s, and the two counts moved into Postgres. **No
migration needed** — option 2 (`jsonb_array_length`) was taken rather than a denormalised
column, so there is no new write-path maintenance.

**Results**

| | Before | After | |
| - | ------ | ----- | - |
| Page payload | 8,592,689 B (8.19 MB) | **1,809,734 B (1.73 MB)** | **4.7× smaller** |
| `tables.findMany` (warm, ×3) | 7618 / 11328 / 11091 ms | **3825 / 1460 / 943 ms** | **~11× faster** |

The query speed-up was the unexpected part — this was filed as a payload problem, but pulling
2.45 MB of JSON was also what made the query slow. (Absolute numbers are laptop→Neon round
trips over the public internet; Vercel is co-located with the database, so production is much
faster. The **ratio** is the meaningful figure.)

**How the counts work now**

```sql
CASE WHEN jsonb_typeof(data->'rows') = 'array'
     THEN jsonb_array_length(data->'rows') ELSE 0 END::int AS "rowCount"
```

⚠️ **The `jsonb_typeof` guard is not optional.** `jsonb_array_length` *raises* on a non-array,
and a raised error here would fail the whole page rather than one row. All 652 current rows are
well-shaped (verified), but `data` is an unvalidated `Json` column — nothing stops a future
write putting an object or `null` there.

**`schema`, `data` and `settings` were removed from `TablesManager`'s prop type**, with a note
explaining why, because the type declaration is what caused the transfer. `settings` was
declared and never read at all.

##### ⚠️ TEST CASES — run these before pushing

**A. The counts must be identical to the old JavaScript computation** — this is the correctness
risk, not the size. Compare `jsonb_array_length` against `.rows.length` for every table:

```
652 tables, 0 mismatches
total rows: 8065 (SQL) vs 8065 (JS)
```

**B. Payload shrank, and the JSON is genuinely gone**

| Check | Result |
| ----- | ------ |
| `/admin/tables` returns 200 | ✅ |
| At least 4× smaller | ✅ 4.7× |
| A string that exists **only** inside `Table.data` is absent from the HTML | ✅ probed with a real `row_…` id |

> ⚠️ **My first assertion here was "< 1 MB" and it failed at 1.73 MB — an arbitrary target, not
> a real regression.** Measuring the composition explained it: props are 487 KB, and RSC sends
> them **both** as flight data and as rendered HTML, so ~2× props + markup is the floor for 652
> unpaginated cards. The over-fetch is gone; what remains is the card list itself.

**C. The page still shows what it showed before** — table name, page title, "N rows" labels,
and the total-rows stat (8065) all still render.

**D. Regression sweep — every other admin screen, unchanged**

```
/admin 49 KB · /admin/categories 50 KB · /admin/sections 226 KB
/admin/tables/new 207 KB · /admin/rich-text 24 KB · /admin/users 32 KB
/admin/domains 129 KB · /admin/pages 36 KB      all HTTP 200
/admin/tables/[id] 94 KB — unchanged, and it SHOULD still load full row data
```

That last line matters: the editor legitimately needs `data` for one table. Only the **list**
was over-fetching, and the fix must not starve the editor.

##### Remaining, deliberately not fixed here

**The page renders all 652 tables with no pagination.** That is the whole of the remaining
1.73 MB, and it is a UI change rather than a query change — pagination or virtualisation, plus
a decision about search/filter behaviour across pages. Folding it into #21 Phase 2's shadcn
rebuild is the natural place, since the list markup is being replaced there anyway. Recorded
rather than done, because it is a different kind of change from this one.

---

### 22.2 🔴 Table data is WRITE-ONCE — the finding that prompted this audit

**The report was right: there is no way to edit a table after creating it.**

`TableEditor` (`/admin/tables/[id]`) has four tabs. **None of them can change anything:**

| Tab | What it actually is |
| --- | ------------------- |
| **Data** | Read-only. It renders `src/components/table/DataTable.tsx` — the **public** viewer. Sort, filter and search work; nothing is editable. |
| **Schema** | Read-only *display*. Column list with badges (`Required`, `Sortable`, `Filterable`). No inputs, no save button. |
| **Import** | A placeholder: *"CSV Import Coming Soon — Advanced CSV import functionality with column mapping and validation will be available in the next update."* |
| **Settings** | A placeholder: *"Settings Editor Coming Soon"* |

What *does* work in that screen: **Export** (CSV and JSON, both wired to a real handler) and
**Delete table**.

**Confirmed by search, not by reading:** a grep across all 32 admin components for
`addRow|deleteRow|editRow|updateRow|handleCellChange|onCellEdit|editable` returns **zero
matches**. There is no row-editing UI anywhere in the application.

#### ⚠️ The capability exists in the API and nothing calls it

```
PUT    /api/admin/tables/[id]/data   -> replaces or appends rows   ... called from: NOWHERE
DELETE /api/admin/tables/[id]/data   -> clears all rows            ... called from: NOWHERE
```

Both are fully implemented — `PUT` even supports `operation: 'replace' | 'append'`, and this
document's own #18 test drove it successfully over HTTP. The only UI reference to that path is
an export call (`GET …/data?format=csv&download=true`) and a broken link (22.2).

**So the practical consequence: to change one cell, the only route available is to delete the
table and rebuild it from a fresh CSV.** `TableSchemaEditor.tsx` exists as a component but is
only used by the creation wizard, so columns cannot be changed after creation either.

#### ✅ The fix

The backend is done. This is entirely UI work, and it splits into three independently
shippable pieces:

**(a) Re-import — smallest useful fix, ~2 hours.**
Replace the "CSV Import Coming Soon" placeholder with the `CSVUploadInterface` component that
**already exists** and is already used by the creation wizard. Wire its output to
`PUT /api/admin/tables/[id]/data` with `operation: 'replace'` or `'append'` — both already
supported. This alone turns the table from write-once into editable-in-bulk, which for
spreadsheet-sourced content may be all that is actually wanted.

⚠️ Two things to get right: `'replace'` destroys existing rows, so it needs a confirmation
step showing the before/after row count; and the uploaded CSV's columns must be validated
against the existing schema, or a mismatched file silently produces rows the table cannot
render.

**(b) Row-level editing — the real feature, ~1–2 days.**
Add/edit/delete individual rows. Needs a genuinely editable grid, which the current read-only
`DataTable` is not — it is the public viewer and should stay that way rather than growing an
`editable` prop, since that would put admin-only code in the public bundle. Build a separate
`AdminDataGrid` and keep `PUT …/data` as the save endpoint (send the full row set), which
avoids designing a per-row API.

⚠️ `targetCountries` must be editable here. It is a real column that the public site filters
on (verified working in #18), and it is stripped from public responses — so the admin grid is
the *only* place it can ever be set. Today there is no way to geo-target a row at all through
the UI, which makes the whole geo feature unreachable for content editors.

**(c) Schema editing — ~half a day.**
`TableSchemaEditor.tsx` already exists and is already wired in the creation wizard. Mount it in
the Schema tab and save via `PUT /api/admin/tables/[id]`, which exists.

⚠️ Renaming or removing a column orphans the corresponding key in every stored row. That needs
a deliberate decision (migrate the data, or refuse the change) rather than being discovered
later as data loss.

**Also replace the two "Coming Soon" placeholders with something honest in the meantime** — a
disabled control with a short explanation, as `AdminHeader`'s "Account Settings" already does
correctly with its "Soon" badge. A placeholder that looks like a feature is worse than a
visibly unavailable one.

#### ✅ (a) RE-IMPORT DONE — 30 Jul 2026

**One file changed.** Tables are no longer write-once: rows can now be replaced or appended
from a CSV without deleting and rebuilding the table.

Nothing new was built. `CSVUploadInterface` already existed and already did header
auto-mapping plus per-row schema validation; `PUT /api/admin/tables/[id]/data` already
supported `replace` and `append`. **The "CSV Import Coming Soon" placeholder was sitting
between two finished halves.**

##### The staging step is the feature, not decoration

Upload does **not** save. Parsed rows are held in state and a confirmation panel shows:

```
Current rows        Rows in file        After import
     15                   3                  18        (append)
     15                   3                   3        (replace)
```

⚠️ **Why that matters here more than usual:** `replace` deletes every row, there is no undo,
there are no table backups, and the original CSV is **never stored server-side** — it is parsed
in the browser and discarded (#22.8). A truncated or wrongly-mapped file would silently destroy
content that cannot be recovered. The resulting row count is shown *before* committing so an
accidental wipe is visible rather than discovered later, and `replace` additionally shows an
explicit red warning.

**`append` is the default.** If the destructive option were pre-selected, the safe path would
require noticing and changing it — the wrong way round for an irreversible action.

`router.refresh()` is used on success rather than `window.location.reload()`: the server
component re-runs so the Data tab shows the new rows, while React state is kept so the user
stays on the Import tab instead of being bounced to the top of Data. It is also the pattern
#22.6 exists to apply to the six `location.reload()` calls elsewhere — no reason to add a
seventh.

##### ⚠️ TEST CASES — run these before pushing

**A. `append`** — 15 → 18 rows; the original 15 still present; the 3 new ones present.

**B. `replace`** — row count becomes exactly the new set (2), and the previously appended rows
are gone. This is the destructive path, so it is tested explicitly rather than assumed.

**C. Geo defaulting still applies** — every imported row comes back with
`targetCountries: "ALL"`, because the route runs `ensureRowsHaveTargetCountries`. Without this,
imported rows would have no geo value and the filtering verified in #18 would silently skip
them.

**D. The PUBLIC page updates immediately** — `/api/domain/tables/by-page/[pageId]?country=US`
returns the new row count with no wait, confirming the `invalidatePages()` call added in #18
covers this path. It also confirms `targetCountries` is still stripped from public responses.

**E. Invalid input is rejected, not silently accepted**

| Body | Expected |
| ---- | -------- |
| `{}` (no data) | 400 |
| `{ data: { rows: 'nope' } }` | 400 |
| `{ operation: 'merge' }` | 400 |

**F. The new UI ships** — "Confirm import", the replace warning, and the uploader's own copy
are all in the client bundle; "CSV Import Coming Soon" is gone.

> ⚠️ **A bundle-assertion trap.** Searching for `papaparse` / `Papa` fails — the bundler
> minifies and the package name never appears as a literal. Assert on **user-facing copy**,
> which survives minification. Also note the uploader's strings were already in the bundle
> (the creation wizard uses the same component), so that check is a *necessary* condition, not
> proof; the proof is the new "Confirm import" text.

**G. Regression** — the editor still renders, export still works, `/admin/tables` and `/admin`
still 200. Development branch verified clean afterwards: 652 tables, **8,065 rows** (baseline),
0 probe rows.

##### Still open in 22.2

- **(b) Row-level editing** — the larger piece. ⚠️ `targetCountries` still has **no UI
  anywhere**, so geo-targeting a row remains impossible for a content editor even after this.
- **(c) Schema editing** — `TableSchemaEditor` exists and is wired in the creation wizard; the
  Schema tab is still read-only.
- The **"Settings Editor Coming Soon"** placeholder is untouched.

Both remaining pieces are new UI, so they belong **after** #21 Phase 2 — building a data grid
in the current markup and rewriting it days later is the work twice.

---

### 22.3 🔴 The "Manage Data" button 404s

`TablesManager` renders the tables list in two view modes, and the **same-labelled button
goes to two different places**:

```
card view  (TablesManager.tsx:316) -> /admin/tables/${id}        (identical to "Edit")
list view  (TablesManager.tsx:383) -> /admin/tables/${id}/data   <- NO SUCH PAGE
```

`src/app/admin/tables/[id]/` contains only `page.tsx`. The `/data` path exists **only** as an
API route (`src/app/api/admin/tables/[id]/data/route.ts`). So in list view the button that
should lead to data management leads to a 404, and in card view it silently duplicates "Edit".

This is consistent with 22.2: the feature was planned, the link was written, the page was
never built.

#### ✅ The fix

Two options, and the choice depends on whether 22.2(b) gets built:

- **If a data editor is built:** make `/admin/tables/[id]/data` a real page hosting it, and
  point *both* buttons at it. The route being linked already implies this was the intent.
- **If not:** point both at `/admin/tables/${id}` and rename one — two menu items with
  different labels doing the same thing is its own small confusion.

Either way this is a 5-minute change; the value is that it stops a 404 today.

**Effort:** 5 minutes for the repoint, or fold it into 22.2(b).

#### ✅ DONE — 30 Jul 2026 (with #22.5)

Both menus now offer **one** link, `/admin/tables/${id}`, labelled **📊 Open table**. That
route opens on its Data tab by default, which is what "Manage Data" was reaching for.

The duplicate went too: the grid menu had *both* "Edit" and "Manage Data" pointing at the same
URL, so one was pure noise. Two labels for one destination is its own small confusion, and
worth removing while fixing the 404 next to it.

**Verified:** `/admin/tables/[id]/data` still returns **404** — confirming the bug was real —
and no admin markup links there any more (regex sweep over the rendered list).

---

### 22.4 🔴 433 broken "Preview" / "view on site" links

Two places build a **flat** two-segment URL for a page that may be nested several levels deep:

```tsx
// RichTextManager.tsx:223
<Link href={`/domain/${page.domain.slug}/${page.slug}`} target="_blank">👁️ Preview</Link>

// app/admin/tables/[id]/page.tsx:83
<a href={`/domain/${table.page.domain.slug}/${table.page.slug}`} target="_blank">
```

`src/app/sitemap.ts` solves exactly this correctly, by walking the `parentId` chain
(`buildPagePath`). These two do not. **Measured against every page in the database:**

| Button | Wrong URLs |
| ------ | ---------- |
| `RichTextManager` "Preview" | **323 of 418** rich-text pages — **77.3%** |
| `admin/tables/[id]` "view on site" | **110 of 668** table pages — **16.5%** |

```
emits : /domain/animation/clientquestionnaire
should: /domain/animation/questionaries/clientquestionnaire

emits : /domain/webdev/shopifystore
should: /domain/webdev/nocode/definingservices/shopifystore

emits : /domain/webdev/ytube
should: /domain/webdev/withcode/ytube
```

Every one of those 433 opens a 404 in a new tab.

#### ✅ The fix

Extract the sitemap's `buildPagePath` into a shared helper and use it in both places. The
logic already exists and is already correct — it walks `parentId` upward, skips the synthetic
`__main__` root, and has a cycle guard. It just lives privately inside `src/app/sitemap.ts`.

```
src/lib/page-path.ts  (new)
  buildPagePath(page, pagesById) -> string | null      <- moved out of sitemap.ts
  sitemap.ts imports it                               <- no behaviour change
  RichTextManager + admin/tables/[id] import it        <- 433 links fixed
```

⚠️ The two admin call sites currently have only the page's own row, not the whole page map that
`buildPagePath` needs. So each needs its query widened to include the ancestor chain — either
by fetching `parentId` recursively, or by adding a `path` field the API returns. **The simpler
option:** have the two admin queries `select` the parent chain (max depth is 4, measured) and
resolve server-side, so the button receives a finished URL rather than assembling one.

**Alternative worth considering:** store the resolved path on `Page` as a column, maintained on
write. That would fix these two call sites, remove the traversal from `sitemap.ts`, and make
any future "link to this page" feature correct by default. Costs a migration and write-path
maintenance, and needs care when a page is re-parented (every descendant's path changes).

**Effort:** ~1 hour for the shared helper, and this is the **highest value-per-hour item in
this whole finding** — 433 broken links fixed by one extraction.

#### ✅ DONE — 30 Jul 2026

**The scope turned out to be larger than "extract one function": the traversal existed FOUR
times, in three different states of correctness.**

| # | Location | State before |
| - | -------- | ------------ |
| 1 | `sitemap.ts` `buildPagePath` | ✅ correct — cycle-guarded, Map-based |
| 2 | `api/admin/pages/route.ts` `generatePagePreviewUrl` | ⚠️ copy with **no cycle guard**, O(n²) via `allPages.find()` |
| 3 | `api/admin/pages/[id]/route.ts` `generatePagePreviewUrl` | ⚠️ **byte-identical duplicate of (2)** |
| 4 | `RichTextManager` + `admin/tables/[id]` | ❌ no traversal at all — two slugs joined |

Case (1) was moved verbatim into **`src/lib/page-path.ts`** and the other three now use it.
That means the two admin API routes gained a cycle guard they never had: `parentId` is an
unconstrained self-relation, and because those copies *recursed* rather than looped, one
corrupt row would have overflowed the stack and returned an opaque 500.

**Files changed**

```
src/lib/page-path.ts                          NEW — buildPagePath, buildPageUrl, toPageMap,
                                                    MAIN_PAGE_SLUG, PagePathNode
src/app/sitemap.ts                            imports it; ~50 lines of local copy deleted
src/app/api/admin/pages/route.ts              30-line copy -> 3-line wrapper
src/app/api/admin/pages/[id]/route.ts         30-line copy -> 3-line wrapper
src/app/api/admin/rich-text/route.ts          now returns `previewUrl` per page
src/components/admin/rich-text/RichTextManager.tsx  uses previewUrl; DISABLES when null
src/app/admin/tables/[id]/page.tsx            resolves `publicUrl`; DISABLES when null
```

**Why the rich-text URL had to move server-side.** `GET /api/admin/rich-text` returns only
`rich_text` pages, but the ancestors are `section_based`/`subcategory_list` pages — so the
chain simply is not in the payload and the client *cannot* compute the path. One extra query
per request, scoped to a single domain and selecting only the three columns `PagePathNode`
needs (deliberately not `include`, so this cannot become another #22.1 over-fetch).

**Both call sites now render a DISABLED control when the URL resolves to `null`**, rather than
linking somewhere known-broken. That is the actual behavioural fix — the old code always
produced *a* link, which is why 433 of them silently 404'd.

##### ⚠️ TEST CASES — run these before pushing

**A. Sitemap must be unchanged — highest regression risk, it drives SEO for ~1,200 URLs**

| Check | Expected |
| ----- | -------- |
| `GET /sitemap.xml` | 200 |
| URL count | matches `1 + published domains + reachable pages` **computed from current data** |
| Duplicates | none |
| Any URL containing `__main__` | none |
| All URLs absolute `https://atno.io/` | yes |
| Depth ≥ 4 URLs still present | yes (451 on the dev branch) |

> ⚠️ **Do not assert a hardcoded 1198.** The first run of this test did, failed with "got
> 1201", and looked like a refactor regression. It was not — the dev branch's page set had
> changed since that figure was recorded on 27 Jul. Computing the expected total from live
> data (1 + 35 roots + 1165 pages = 1201) matched exactly.

**B. Old vs new must agree where the old code was already right**

Reproduce the old `generatePagePreviewUrl` verbatim and diff it against the shared helper for
**every page in the database**. Result: **1,198 identical, 0 differing** — so the
`/api/admin/pages` `previewUrl` field is unchanged for every existing consumer, and the only
gain there is the cycle guard.

**C. The two broken call sites**

| | Pages | Old flat URL was wrong for | Now resolve to `null` |
| - | ----- | -------------------------- | --------------------- |
| RichTextManager Preview | 418 | **323 (77.3%)** | 0 |
| `tables/[id]` View Live | 668 | **110 (16.5%)** | 0 |

**D. Sampled against the running site** — for each fixed case, the NEW url returns 200 **and**
the OLD url is confirmed broken:

```
NEW /domain/animation/questionaries/clientquestionnaire        200
OLD /domain/animation/clientquestionnaire                     404
NEW /domain/webdev/nocode/definingservices/shopifystore        200
OLD /domain/webdev/shopifystore                                404
NEW /domain/webdev/withcode/ytube                              200
OLD /domain/webdev/ytube                                       404
```

> ⚠️ **A trap in writing this test.** The first version re-derived the page from the new
> URL's tail via `allPages.find(x => url.endsWith('/' + x.slug))`. With **83 ambiguous
> (domain, slug) pairs** in this database that returns an arbitrary match — sometimes in a
> *different domain* — so it probed the wrong flat URL and reported three spurious 200s that
> looked like the fix failing. Carry both URLs through the sample together instead of
> reconstructing either.

**E. End-to-end through the real API and page**

```
GET /api/admin/rich-text?domainId=<webdev>   200
  previewUrl present on all 46 pages          yes
  every previewUrl matches the helper         46/46
  nested deeper than /domain/x/y              46/46
  4 sampled URLs fetched                      all 200
GET /admin/tables/<id>                        200, contains the resolved URL
```

##### What else could this have affected — checked

- **`/sitemap.xml`** — verified above; the moved function is byte-identical and the country-
  filter `null` semantics it depends on are preserved and documented at the new location.
- **`/api/admin/pages` and `/api/admin/pages/[id]` `previewUrl`** — 1,198/1,198 identical, so
  `PagesManager` and any other consumer are unaffected.
- **`/admin/pages` screen** — unchanged; it already consumed the server-computed `previewUrl`.
- **`robots.txt`, JSON-LD breadcrumbs** — do not use this code path; `buildBreadcrumbData` has
  its own (separately fixed in #7) parent-chain walk.
- **Public page resolution** (`PageService.getByPath`) — untouched. Confirmed independently:
  `/domain/webdev/ytube` still correctly 404s, so nothing widened what resolves publicly.

---

### 22.5 🟡 Two genuinely dead buttons

`TablesManager.tsx:319` and `:387` — the **📤 Export** dropdown items in both view modes have
no `onClick`, no `asChild` and no link. They render, they are clickable, they do nothing.

(Export itself is not missing — it works inside `TableEditor`. It is only the shortcut from
the list that is dead.)

#### ✅ The fix

`TableEditor.handleExport` already does exactly the right thing — it hits
`GET /api/admin/tables/[id]/data?format=csv&download=true`, takes the blob and triggers a
download. Lift that into a small shared hook or helper and call it from these two menu items.

Or, if the shortcut is not wanted, **delete the menu items**. A button that does nothing is
worse than no button, because it teaches the user that the panel is unreliable — which is
directly relevant to "I don't like the whole UI/UX".

**Effort:** 20 minutes.

#### ✅ DONE — 30 Jul 2026 (with #22.3)

The working implementation was extracted from `TableEditor.handleExport` into
**`src/lib/export-table.ts`** and both screens now call it. Copying it into `TablesManager`
instead would have created a third divergent copy of one behaviour — precisely what #22.4 had
to undo four times over.

Each dead item became **two** working ones (📄 Export as CSV, 📋 Export as JSON), matching what
the editor already offers and what the endpoint already supports.

⚠️ **`isExporting` is per-card, not shared.** A single flag on the parent would grey out the
menu item on all 652 cards while one table downloaded, which would make the `disabled` prop
actively misleading.

##### ⚠️ TEST CASES — run these before pushing

**A. The bug was real** — `/admin/tables/[id]/data` returns **404** (page never existed; only
the API route does).

**B. Nothing links there any more** — regex sweep over the rendered list finds no
`/admin/tables/<id>/data` href.

**C. The export endpoint both new items call**

| | CSV | JSON |
| - | --- | ---- |
| HTTP | 200 | 200 |
| `Content-Disposition: attachment` | ✅ | ✅ |
| Body | 2,470 B | 4,828 B, parses as JSON |

**D. The new labels ship to the browser** — "Open table", "Export as CSV", "Export as JSON" all
present in the client chunks; the old bare `📤 Export` label is gone; the shared helper's
`/data?format=` call shipped.

> ⚠️ **A trap in testing dropdowns and tabs.** The first version of this test asserted those
> labels appeared in the **server HTML** and reported four failures. They were rendering
> behaviour, not bugs: `DropdownMenuContent` renders through a Radix **Portal** and mounts only
> when opened, and the editor's export buttons sit in an inactive `Tabs` panel which Radix
> unmounts. For lazily-mounted UI, assert against the **client bundle**, not the server
> response.

**E/F. Regression** — the editor still renders with its tab strip and table name, and `/admin`,
`/admin/tables/new`, `/admin/domains`, `/admin/rich-text` all still return 200.

##### Swept while here

`grep` for a bare `<DropdownMenuItem>` across **all** admin components returns nothing — every
menu item in the admin panel now has `asChild`, `onClick`, or an explicit `disabled`
(`AdminHeader`'s "Account Settings", which is an intentional "Soon" placeholder). So #22.5 is
closed panel-wide, not just on this screen.

---

### 22.6 🟡 Mutation UX patterns worth replacing

Not bugs, but they are a large part of why the panel feels rough:

- **6 × `window.location.reload()`** after a successful mutation —
  `CategoryForm.tsx:170`, `CategoryList.tsx:369,626`, `DomainForm.tsx:227`,
  `DomainsTable.tsx:142,443`. A full document reload discards scroll position, form state and
  the client router cache, and is noticeably slower than `router.refresh()`, which re-fetches
  server data while keeping the page mounted.
- **8 × `alert()` and 3 × `confirm()`** across 7 files, including for destructive confirmation
  (`TableEditor.tsx:88` guards table deletion with a native `confirm`). Native dialogs cannot
  be styled, ignore the new dark theme entirely, and look like a browser warning rather than
  part of the product. `dialog` and a toast component are already available in `ui/`.
- Two minor stale TODOs: `CategoryList.tsx:451` (a column pre-select that was never wired) and
  `DomainsTable.tsx:310` (a missing actions dropdown).

#### ✅ The fix

**Replace `window.location.reload()` with `router.refresh()`** (6 sites). In the App Router
that re-runs the server component and swaps in fresh data while keeping React state, scroll
position and the client cache. It is a near drop-in change — `const router = useRouter()` plus
the call — and it is a large part of why the panel feels heavy: today every save visibly
reloads the whole document.

⚠️ One caveat: `router.refresh()` refreshes *server* data. Anything held in client state
(a dialog's open flag, a form's fields) is deliberately kept, so any component relying on the
reload to reset itself needs its own reset. That is a real behaviour change to check per site,
not a blind find-and-replace.

**Replace `alert()` / `confirm()` with UI components** (8 + 3 sites). `dialog` is already in
`ui/`, and shadcn's `alert-dialog` is the correct primitive for destructive confirmation.
Native dialogs cannot be themed, so they now look doubly wrong next to the dark mode shipped
in #21 Phase 1.

⚠️ `confirm()` is *synchronous* — code after it runs immediately with the answer. A dialog
component is not, so each call site has to be restructured into an "open the dialog, act in its
callback" shape. `TableEditor.tsx:88` (table deletion) is the important one.

**Effort:** `router.refresh()` ~1 hour; dialogs ~2–3 hours. Both are better folded into #21
Phase 2, since the shadcn rebuild touches these files anyway — see 22.9.

---

### 22.7 ✅ Checked and NOT problems

Recorded deliberately — each of these looked like a finding and is not, so nobody re-reports
them:

| Looked wrong | Actually |
| ------------ | -------- |
| Sidebar links to `/admin/advanced-tables` and `/admin/editor` — neither route exists | **Commented out** under "Future features". Not rendered. |
| `AdminHeader.tsx:157` "Account Settings" has no handler | Intentional — carries `disabled` and a "Soon" badge. |
| Four `⋮` buttons and "Add New Admin" have no `onClick` | Wrapped in `DropdownMenuTrigger asChild` / `DialogTrigger asChild`. They work. |
| `DomainsTable.tsx:430` "TODO: Implement actual API call" | A **stale comment** — the `DELETE` call is implemented directly beneath it. |
| A new domain is missing from the New Table wizard | A deliberate filter (`tables/new/page.tsx:75`) to domains that already have a `table`/`narrative` page. See #20. |

> ⚠️ **Two of this audit's own automated passes produced mostly false positives**, and the
> method failures are worth recording:
>
> - A dead-button detector flagged **9**; only **2** were real. It did not know that a `Button`
>   inside `DropdownMenuTrigger asChild` is interactive.
> - An "unreachable API endpoint" detector flagged **20**; nearly all were wrong, because the
>   real call sites build the URL into a variable first —
>   `const url = isEditMode ? \`/api/admin/domains/${id}\` : '/api/admin/domains'` — which a
>   regex looking for a literal inside `fetch(` never sees. That output was discarded rather
>   than reported.
>
> The lesson that generalises: a static-analysis pass over JSX needs verifying case by case
> before any of it becomes a finding.

---

### 22.8 The CSV question: where does an uploaded file go?

Asked directly, so recorded here.

**It never leaves the browser.** `CSVUploadInterface.tsx:102` calls `Papa.parse(file, …)`,
which reads the file client-side. What is sent to the server is the resulting **JSON rows**,
not the file:

```
no FormData    no multipart    no writeFile    no S3/Cloudinary    no /uploads directory
```

The rows are stored in the `Table.data` **JSON column** in Postgres. The original `.csv` is
held in browser memory only and is discarded when the tab closes — it is never persisted and
cannot be recovered or re-downloaded. (Export regenerates a CSV *from the stored rows*; it is
not the original file.)

---

### 22.9 ✅ Write flows exercised end to end — all three work

The first pass of this audit verified that every screen *loads* and traced every interactive
element in code, but three write paths were read rather than driven. That gap is now closed:
each was exercised over HTTP against a production build with a real admin session, and the
effect verified directly in the database.

**Category — create / update / delete: all pass**

```
POST   /api/admin/categories        HTTP 200   row created
PUT    /api/admin/categories/[id]   HTTP 200   rename persisted
DELETE /api/admin/categories/[id]   HTTP 200   row removed
```

**Section layout — pass**

```
PUT /api/admin/sections/[id]        HTTP 200   sections persisted
```

> ⚠️ **A field-name trap worth knowing before touching this route.** The first attempt was
> rejected with `"Each section must have a valid column (1, 2, or 3)"`. The stored shape is:
>
> ```json
> { "order": 1, "title": "Skill Development", "column": 1, "pageIds": ["…"] }
> ```
>
> The field is **`column`**, not `columnPosition` — and `columnPosition` *is* the correct name
> on `DomainCategory`, which is exactly why it is easy to get wrong. The route also validates
> that every `pageId` is a real child of the page being updated, which is good and means a
> stale client cannot corrupt the layout.

**Rich text — create / update: all pass, and the #2 sanitiser is confirmed live on both**

```
POST /api/admin/rich-text           HTTP 200   content stored, wordCount computed (3)
PUT  /api/admin/rich-text/[pageId]  HTTP 200
```

Deliberately hostile input was sent through the `PUT`:

```html
<div><p onclick="alert(1)">x</p><script>alert(2)</script>
     <a href="https://ok.com" onmouseover="bad()">y</a></div>
```

and what was stored is:

```html
<div><p>x</p><a href="https://ok.com">y</a></div>
```

`<script>` gone, both `on*` handlers gone, the safe markup and the `href` intact. **That is
finding #2 working correctly on a real write path** — previously verified against stored data,
now verified end to end through the API.

Development branch confirmed fully restored afterwards: 7 categories, 0 probe rows, 415
`richTextContent` rows, 0 pages holding probe sections.

**Conclusion: the three flows not covered by the first pass are all healthy.** The failures in
this finding are concentrated in the **table** feature (22.1, 22.2, 22.3) and in **link
construction** (22.4) — not in the basic CRUD plumbing, which works.

---

### 22.10 Fix order, with reasoning

Ordered by value per hour, and sequenced so nothing is built twice.

| # | Item | Effort | Why here |
| - | ---- | ------ | -------- |
| 1 | **22.4** — 433 broken preview links | ~1 hr | Highest value-per-hour anywhere in this document. One helper extraction, no redesign, no schema change, fixes 433 user-facing 404s. |
| 2 | **22.1** — narrow the `/admin/tables` queries | ~1 hr | Removes ~8 MB per page view. Pure query change, no UI touched, cannot conflict with anything later. |
| 3 | **22.3** + **22.5** — the 404 button and the dead Export items | ~30 min | Trivial, and they are the most visible "this panel is broken" signals. |
| 4 | **22.2(a)** — re-import via the existing CSV component | ~2 hrs | Turns tables from write-once to editable using components and an endpoint that both already exist. Largest capability gain for the effort. |
| 5 | **#21 Phase 2** — shadcn shell rebuild | ~1 day | Do this **before** 22.2(b) and 22.6, not after. |
| 6 | **22.2(b)+(c)** — row editing and schema editing | ~2 days | Build inside the new shell. |
| 7 | **22.6** — `router.refresh()` and dialogs | folded into 5 | Do not port `alert()` calls into freshly written components. |

⚠️ **Why Phase 2 sits in the middle rather than last.** Items 1–4 are query changes, link fixes
and wiring up existing components — none of them design new UI, so the shadcn rebuild will not
invalidate them. Items 6–7 *are* new UI, and building a data grid or a confirmation dialog in
the old hand-rolled markup means rewriting it days later. So: fix the cheap correctness bugs
first, rebuild the shell, then build the new features into it.

### What this audit does and does not cover

**Covered:** all 13 screens loaded with a real session; every interactive element traced in
code; domain, page, table, user, category, section-layout and rich-text write flows all driven
end to end over HTTP with the result verified in the database (22.9).

**Not covered:** the CSV upload path was traced in code (22.8) but not driven with an actual
file, since it is parsed in the browser and cannot be exercised over HTTP. Browser-only
behaviour generally — drag-and-drop, client-side validation messages, responsive layout below
tablet width — was not tested; there is no headless browser installed.

---



## 🔴 23. Production Outage — Every Rich-Text Admin Route 500'd on an Unpinned Node Version

**Severity:** Critical — rich-text content could not be listed, created **or edited** on
production. **Status:** ✅ **FIXED 30 Jul 2026.**

Reported as "on rich-text when I select a domain it gives error" on atno.io, while the same
screen worked locally.

### The error, from the Vercel log

```
Failed to load external module jsdom: [ERR_REQUIRE_ESM]
require() of ES Module /var/task/node_modules/@exodus/bytes/encoding-lite.js
from /var/task/node_modules/html-encoding-sniffer/lib/html-encoding-sniffer.js not supported
```

Chain: `src/lib/sanitize-html.ts` → `isomorphic-dompurify` → **jsdom** →
`html-encoding-sniffer` → `@exodus/bytes` (ESM-only).

### Root cause: the runtime was never pinned

- Local Node is **v22.12.0**, the release that added `require()` of ES modules — so it works.
- **`package.json` had no `engines` field**, so Vercel chose its own default. On Node 20,
  `require()` of an ESM-only package throws exactly this.

Nothing pinned the runtime, so local and production silently diverged. Fixed with
`engines.node: ">=22.12.0"` plus a `.nvmrc`.

⚠️ **Vercel may still need Project Settings → General → Node.js Version set explicitly.** The
`engines` field should drive it, but a project created when 20.x was the default can have a
dashboard setting that overrides.

### ⚠️ The bigger problem it exposed: a module-scope import took down reads

The sanitiser was imported at the **top of the route file**, so loading the module threw and
**every handler in it failed — including the `GET` that sanitises nothing.** The same top-level
import exists in `rich-text/[pageId]/route.ts`, which is why **editing existing rich text was
broken on production too**, not just the listing.

`sanitizeRichTextHtml` is now imported **lazily inside the POST handler**. A read endpoint has
no business loading a full DOM implementation, and this means a future break in that dependency
tree can only affect writing, not reading.

### How three wrong hypotheses were eliminated first

Recorded because each looked plausible and each was tested against **production data**
(read-only) rather than reasoned about:

| Hypothesis | Result |
| ---------- | ------ |
| A data-dependent bug in #22.4's `previewUrl` change | ❌ 39 pages, all URLs resolve, 0 nulls |
| Response exceeding Vercel's ~4.5 MB limit | ❌ 0.35 MB |
| The added query pushing past a 10s function timeout | ❌ 4.2s total; the new query is 416 ms of it |
| Dependency drift between local and the lockfile | ❌ identical versions both sides |

The Vercel log settled it in one line. **Lesson: for an environment-specific failure, get the
server log before forming a theory** — three tested-and-wrong hypotheses cost more than reading
the log would have.

### Test cases

- `GET /api/admin/rich-text?domainId=…` → 200, 39 pages, `previewUrl` intact.
- `POST /api/admin/rich-text` → 200, and the lazy import genuinely loads: `<script>` and
  `onclick` stripped, `<p>`/`<a href>` preserved. Proving the sanitiser still runs is the point
  — a lazy import that silently failed would leave stored HTML unsanitised.

### Follow-up worth considering

`isomorphic-dompurify` drags in the whole of jsdom for what is a server-side string clean.
A DOM-free sanitiser would remove this class of failure entirely and shrink the bundle. Not
changed here — swapping the sanitiser means re-validating the allow-list against all 415 stored
rows, which is #2's work over again.

---

### 23.2 — ⚠️ The first fix was INCOMPLETE. Corrected root cause.

**The Node-version theory was wrong.** Vercel's project settings already showed
**Node.js Version = 22.x**, which supports `require()` of ES modules — so the `engines` pin
could not have been what fixed the listing. The **lazy import** was.

That mattered, because a lazy import in the list route only protects **that** route. Testing
"Edit HTML" on production confirmed it:

```
Error Loading Page
Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

`GET /api/admin/rich-text/[pageId]` returned a 500 **HTML error page**, and the client reported
a JSON parse failure because it tried to parse that page as the expected payload. So the
misleading client message was a symptom, not the bug.

#### The real cause is in the stack frame, not the Node version

```
at Context.externalRequire (.next/server/chunks/[turbopack]_runtime.js:501:15)
```

The `require()` was being performed by **Turbopack's own `externalRequire` shim** — not by
Node. Node 22.12+ can require an ES module; that shim cannot. This explains everything the Node
theory could not: why 22.x did not help, and why it never reproduced locally in dev.

#### What was changed

1. **`next build` no longer passes `--turbopack`** (package.json) — the production server bundle
   is built by webpack, whose externals handling loads ESM correctly. **Dev keeps Turbopack**;
   it works there and is far faster.
2. **`serverExternalPackages: ['isomorphic-dompurify', 'jsdom']`** in `next.config.ts` — states
   the intent explicitly instead of relying on Next's heuristics.
3. **Lazy import in `rich-text/[pageId]/route.ts`** as well, so `GET` and `DELETE` — neither of
   which sanitises anything — no longer load a DOM implementation just to read a row.

⚠️ **NOT VERIFIED.** The local test was interrupted before it ran, and local success would prove
little anyway: this failure only ever appeared in the Vercel build, so the only meaningful test
is deploying and clicking **Edit HTML** on production. **Treat this as an untested fix.**

⚠️ **Cost of the webpack switch:** the production build went from seconds to **~2.2 minutes**.
That is a real trade for correctness, and worth revisiting if Turbopack's externals handling
improves.

### 23.3 — Status: rich-text authoring is being redesigned, so this may be moot

The user's decision, 31 Jul:

> "Currently a plain text with paragraph does not look that good. It looks like a simple
> textbook page. Anyone would get bored… they would think people directly generated from AI &
> kept it here. So I think there will be refactoring of this whole structure."

So the raw-HTML authoring model — a `<textarea>` of HTML, sanitised on write, rendered with
`dangerouslySetInnerHTML` — is expected to be **replaced**, not improved. Public rendering is to
be **left exactly as it is** in the meantime.

That reframes several open items:

| Item | Effect |
| ---- | ------ |
| #23's jsdom problem | May disappear entirely — a block/structured editor stores JSON, so nothing needs HTML sanitising and jsdom is not required at all |
| #2's sanitiser + its allow-list derived from 415 rows | Becomes migration input rather than a thing to maintain |
| #21.4's light "content island" | Exists only because stored HTML carries 2,519 inline colour declarations. Structured content would theme natively |
| #22's rich-text screens (G-7) | Should not be rebuilt on shadcn until the authoring model is decided — that would be the work twice |

### 23.4 — ⛔ DECISION: the 23.2 fix was REVERTED. Edit HTML stays broken, knowingly.

**Reverted 31 Jul at the user's direction:** *"Its fine for now - let it be broken - good that
you have captured it - I will come back to it."*

Three files returned to their committed state:

```
next.config.ts                            serverExternalPackages removed
package.json                              `next build --turbopack` restored
api/admin/rich-text/[pageId]/route.ts     back to a module-scope sanitiser import
```

**Kept:** `engines.node: ">=22.12.0"` and `.nvmrc` — pinning the runtime is correct regardless
of this bug, and was already committed. The lazy import in the *list* route also stays committed,
which is why the rich-text **listing** works while **Edit HTML** does not.

**Why reverting is the right call here, not a compromise:** the fix cost the production build
~2.2 minutes (webpack instead of Turbopack) on every deploy, to repair a screen that is about to
be replaced wholesale (23.3). Paying that on every future deploy for a doomed feature is worse
value than a known-broken editor the user has consciously accepted.

#### ⚠️ CURRENT STATE — read this before touching rich text

| Operation | Production |
| --------- | ---------- |
| Public rendering of rich-text pages | ✅ works |
| `/admin/rich-text` listing | ✅ works (lazy import, committed) |
| **`/admin/rich-text/edit/[pageId]` — load** | ❌ **500** (`Unexpected token '<'`) |
| **Saving rich text** | ❌ **broken** — the `PUT` cannot load jsdom |

**Rich-text content cannot be edited on production at all.** The fix is known and recorded in
23.2 — restore those three changes and it should work, though it was never verified.

### 23.5 — Chosen direction for the replacement

> "I think this idea looks good: **Structured page templates** — define the shape per page type:
> Resource list, Step-by-step, Comparison, FAQ. The admin fills labelled fields; the renderer
> owns the design entirely." — 31 Jul

The observation that led there: **most of this content is not prose.** `Learn & Build in Public`
is "Description → 4 bullets, Advantages → 6 bullets". `Client Questionnaires` is the same shape.
It is structured data being forced through freeform HTML — which is also why the **tables** look
good and the rich-text pages look like a textbook.

What that direction removes, not just improves:

- **jsdom and #2's sanitiser entirely** — structured content is JSON, so there is no HTML to
  clean and #23 cannot recur
- **#21.4's light "content island"** — it exists only because stored HTML carries 2,519 inline
  colour declarations; structured content themes natively
- **`dangerouslySetInnerHTML`** from the public render path

⚠️ **G-7 (rich-text screens) should NOT be rebuilt on shadcn until this is decided** — rebuilding
an HTML editor that is being replaced is the work twice.

Deferred by the user: *"We will see to it afterwards."*

---

## 🔵 24. Domain Status — Draft / Published / Upcoming, and an "Upcoming Domains" section

**Requested by the user, 6 Aug 2026.** Two things, one underlying cause.

> *"A separate column at the end of the page, below all the domains, with a heading of Upcoming
> Domains / Future Domains. And then below it all the list of domains, just like we have on the
> current UI. On clicking those domains, maybe an alert should come up… Now in the Domain, how
> do we know which are in what status? One idea is: `isPublished` → something called Status —
> Draft, Published, Upcoming."*

### 24.1 What the site can express today

`Domain.isPublished` is a **boolean**, so a domain is either listed or not. There is no way to
say *"this exists, it is not ready, but tell visitors it is coming."* The user's proposal — a
three-state `status` — is the right shape, and this section records what it touches.

⚠️ **The blast radius is much smaller than a grep suggests.** `isPublished` returns **98
occurrences across 25 files**, which is misleading:

- **Only `Domain` has the column.** `isPublished` appears exactly **once** in
  `prisma/schema.prisma` (line 50). `Page` does not have it. The occurrences in
  `PageTree.tsx`, `PageForm.tsx` and `pages/DomainSelector.tsx` are *domain* objects being
  passed through the Pages screens.
- **25 of the 98 are inside a stale sample-JSON comment block** in `CategoryList.tsx` — noise,
  not code.

The **public** gates are only four queries:

| Location | Gate |
| --- | --- |
| `domain.service.ts` `getAllDomainsFromDB` | `isPublished: true` — the `/domain` index |
| `domain.service.ts` `getDomainsForNavigationFromDB` | `isPublished: true` — the sidebar |
| `domain.service.ts` `exists()` | returns `domain?.isPublished` — ⚠️ **never called by anything** |
| `sitemap.ts:125` | `isPublished: true` |

### 24.2 ⚠️ VERIFIED FINDING — the public domain route does not gate on publication at all

`src/app/domain/[...slug]/page.tsx:253-257` checks **only** two things: does the domain exist,
and is it visible to the visitor's country. It never reads `isPublished`. `DomainService.exists()`
is the one function that would check it, and **grep confirms it is never called anywhere.**

**Tested rather than inferred**, because a code reading alone could not distinguish "gated" from
"crashed". Two throwaway domains were created, identical except for publication, both with no
pages and `targetCountries: ["ALL"]`:

```
GET /domain/zz-probe-unpublished  (isPublished=false)  ->  404
GET /domain/zz-probe-published    (isPublished=true)   ->  404   <- the control
```

**Both 404, identically** — the 404 comes from the domain having no pages, not from its status.
So publication currently controls **listing, not access**.

Two further details from the same run:

- The unpublished domain's **full record (id, name, slug) is serialised into the RSC flight
  payload** of the 404 response. Not visible on screen, but present in the HTML.
- A *nonexistent* slug returns a 51 KB 404 with no domain names in it; an existing-but-pageless
  one returns 72 KB **with** the name. That difference is what exposed the leak.

⚠️ **Latent, not live: all 37 domains are currently published**, so nothing is exposed today.
But `UPCOMING` and `DRAFT` domains would be the **first records ever to depend on a gate that
does not exist.** The gate is therefore part of this work, not a follow-up — and adding it now
is free precisely because nothing is currently unpublished.

⚠️ **A first attempt at this probe returned 500 and I nearly reported it.** It had hit an
orphaned dev server left on port 3000 by an earlier `TaskStop` (which kills the `npm` wrapper
but not the `next dev` child), while the freshly started server was on 3001. **A probe must
name the port it is aiming at, and a status code from an unidentified server is not evidence.**

### 24.3 Decisions taken (user, 6 Aug)

| Question | Decision | Why |
| --- | --- | --- |
| Shape of the field | **`DomainStatus` enum** — `DRAFT` / `PUBLISHED` / `UPCOMING` | A second boolean beside `isPublished` makes 4 states from 2 flags, and "published AND upcoming" is meaningless. An enum makes the invalid state unrepresentable and leaves room for `ARCHIVED`. |
| Migration safety | **Keep `isPublished` for one release.** Code reads `status` only; writes set both. | atno.io is live. Rollback becomes a revert instead of a data-recovery job. Dropped in a later, separate migration. |
| Clicking an upcoming domain | **A `<button>` + a `sonner` toast, top-right. No route.** | No URL means no thin page for Google to index, and no link that silently changes meaning when the domain goes live. Keyboard-reachable and announced correctly, which a styled `<div>` would not be. |
| Sidebar | **Excluded.** Index page only. | The sidebar is navigation and these lead nowhere. A nav entry that does nothing is the dead-control pattern removed 4× in Phase G. |
| Heading wording | **"Upcoming Domains"** | Delegated to me. "Coming Soon" is punchier but vaguer; the page's core noun is "Domains", so this reads naturally in place. Subheading: *"These are in progress. Check back soon."* — plainer than the user's draft "we are cooking data". |
| Toast library | **`sonner`** | shadcn deprecated its own `toast` in favour of it, and this doc **already lists `sonner`** as the intended replacement for the 8 remaining `alert()` calls (#22.6). Installing it here pays that down instead of adding a second mechanism. |

### 24.4 ⚠️ Neon — production needs the migration separately, and NOTHING applies it for you

Raised by the user, and the answer is yes:

- **Neon branches are independent databases** (copy-on-write clones). Migrating `development`
  does **not** touch `production`.
- **`npm run build` is `prisma generate && next build` — there is no `migrate deploy` in it.**
  There is no `vercel.json` and no CI workflow either. `COLLEAGUE-SETUP-GUIDE.md:157` already
  states this.
- `.env` documents three branches; **only line 30 (`development`) is uncommented**, so all local
  work and every test in this section hit dev. Production and the old rehearsal branch are
  commented out and must be uncommented deliberately.

**Order of operations — migrate first, deploy second:**

1. `prisma migrate dev` on **development**, verify.
2. Commit the migration files (they are part of the repo).
3. `prisma migrate deploy` against **production** — *before* the code deploy. The migration only
   adds a column with a default, which the currently-deployed code ignores, so this is safe to
   run ahead of time.
4. Merge → Vercel deploys the new code, which finds the column already present.

⚠️ Deploying the code **first** would leave live code querying a `status` column that does not
exist — a 500 on every public page. Keeping `isPublished` through this release means step 4 is
also safely revertible.

⚠️ See **#3 (Migration Drift)** for the prior incident on this repo: `db push` was used instead
of migrations, so Prisma had no record of what had been applied and a fresh `migrate deploy`
produced a database with no `User` table. **`migrate deploy`, never `db push`.**

---

## 🔵 25. Page Status — and "Upcoming Resources" on section-based pages

**Requested 6 Aug, immediately after #24 shipped.** The same idea one level down: a child page —
a "resource block" such as *YouTube Channels* or *Books* under Graphic Designing — should be
able to say "coming soon", listed at the foot of its parent but not clickable.

### 25.1 `Page` has no status field at all

Confirmed by reading the model: **no `isPublished`, no `status`**. All **1,205 pages** are live,
subject only to geo targeting.

| contentType | count |
| --- | --- |
| `table` | 671 |
| `rich_text` | 418 |
| `subcategory_list` | 74 |
| `section_based` | **42** ← the "resource block" hubs this feature targets |

1,163 of the 1,205 are child pages (`parentId` not null).

### 25.2 ⚠️ THE DEFAULT MUST BE `PUBLISHED` — THE OPPOSITE OF `Domain`

`Domain.status` defaults to `DRAFT`, so a domain created by any path that forgets to set it is
invisible rather than accidentally live. **That reasoning inverts for `Page`.**

There are **five `prisma.page.create` call sites**, and two of them are *side effects of domain
operations*:

- `api/admin/domains/route.ts` — creating a direct domain creates its `__main__` page
- `api/admin/domains/[id]/route.ts` — changing a domain's `pageType` recreates it

Nobody is consciously "creating a page" there. With `@default(DRAFT)`, either path would produce
an invisible `__main__` and **the entire domain root would 404** — the failure `[#11]` already
warns about in `domain/[...slug]/page.tsx`, but silent and self-inflicted.

`@default(PUBLISHED)` preserves today's behaviour at every call site. It also makes the
migration simpler than #24's: `ADD COLUMN … NOT NULL DEFAULT 'PUBLISHED'` gives all 1,205
existing rows the right value on its own, so **no backfill `UPDATE` is needed** — unlike the
Domain migration, where the default was wrong for existing data and the hand-written `CASE`
was the difference between working and blanking the homepage.

### 25.3 ⚠️ The sitemap DOES need changing — the opposite of what was assumed

The question raised was whether the sitemap already covers this. It does **not**.

Domain status is covered *for pages*, because `sitemap.ts` fetches pages as a nested relation
inside the domain query — so an unpublished domain takes its pages with it. But a single
upcoming **page** under a live domain would still be listed, advertising a URL that 404s. The
nested `pages` where-clause currently filters on `targetCountries` only and needs
`status: 'PUBLISHED'` alongside it. Same soft-404 reasoning as #15.4.

### 25.4 Decisions taken (user, 6 Aug)

| Question | Decision | Why |
| --- | --- | --- |
| Type | **A new `PageStatus` enum**, not a shared one | Renaming the live `DomainStatus` to `ContentStatus` is conceptually tidier but means a second production type-rename to sequence, plus renaming `domain-status.ts` and its constants across ~15 files. Three duplicated literal values is the cheaper trade; the *logic* stays shared. |
| Scope | **All three states** — DRAFT / PUBLISHED / UPCOMING | One mental model with Domains. `DRAFT` is also new capability: today a page is live the moment it exists. |
| Placement | **`section_based` pages only** (42 of them) | What was asked for, and the smallest change. The 74 `subcategory_list` pages and hierarchical domain roots simply omit upcoming children. |
| Public heading | **"Upcoming Resources"** | "Resource Blocks" is internal vocabulary. |

### 25.5 ⚠️ Two hazards to close, not document

1. **`__main__` must never be non-published.** It is the domain root for every direct domain. If
   `getMainPage` filters on status and a `__main__` is drafted, the whole domain 404s. The API
   will **reject a non-published status on a `__main__` page**, and `PageForm` will hide the
   control for it. Closing the trap beats warning about it.
2. **A draft parent hides its whole subtree — and that is correct.** Child URLs resolve through
   the parent (`/domain/x/parent/child`), so once `getByPath` filters on status, drafting a
   parent 404s everything beneath it automatically. Worth knowing in advance rather than
   discovering.

### 25.6 In our favour already

`organizeSectionsIntoRows` in `SectionBasedLayout.tsx` already ends its `pageIds` lookup with
`.filter(Boolean)`. So once `getChildPages` stops returning non-published pages, they drop out
of their sections cleanly instead of crashing on `undefined`.

---

## 🟡 26. A `__main__` page can never be saved — the app rejects a slug it created itself

**Found 6 Aug while testing I-1. Pre-existing — nothing in #24 or #25 caused it.** Deferred by
decision, recorded here in full so it can be picked up cold.

### 26.1 The symptom

Open Admin → Pages, pick any **direct** domain, and choose **Edit page** on the `__main__` row
(the one badged *Hidden*). The form opens and populates correctly. Change anything — or nothing —
and press Save. It always fails with:

> Slug must contain only lowercase letters, numbers, and hyphens

The message names a field the admin did not touch, and describes a rule the value has never
satisfied.

### 26.2 The mechanism

Both page validators enforce the same pattern:

| File | Line | Rule |
| --- | --- | --- |
| `src/app/api/admin/pages/route.ts` | 337 | `const slugRegex = /^[a-z0-9-]+$/` |
| `src/app/api/admin/pages/[id]/route.ts` | 498 | identical, duplicated |

`__main__` contains **underscores**, which that pattern excludes. And the slug is sent back
unchanged by the form on every save, so **the row can never satisfy its own validator**.

⚠️ **The application creates this slug itself.** `POST /api/admin/domains` writes
`slug: '__main__'` when a direct domain is created, and `PUT /api/admin/domains/[id]` recreates
it when a domain's `pageType` changes. So the invalid value is not user input that slipped
through — it is structural, generated by the app, and then rejected by the app.

Three things combine to make it reachable:

1. `PageTree` offers **Edit page** on every row with no `__main__` guard
   (`PageTree.tsx:332` — the `DropdownMenuItem` is unconditional).
2. `PageForm` renders the slug field fully editable, with no `disabled` and no special case.
3. Neither validator exempts the one slug the app itself generates.

### 26.3 Blast radius

| Operation on `__main__` | Result |
| --- | --- |
| Edit → Save (anything at all) | ❌ Always 400 |
| Rename its title | ❌ blocked by the same check |
| Change target countries | ❌ blocked |
| Delete | ❌ blocked **deliberately** (`[id]/route.ts:327`) — correct |
| Set a non-published status | ❌ blocked **deliberately** (#25.5) — correct |

The last two are intentional guards. The first three are the bug: legitimate edits that the UI
offers and the API refuses.

⚠️ **It is the dead-control pattern again** — an action rendered, enabled and clickable that can
never succeed. Phase G removed four of these; this is a fifth, in a different shape, because the
control is not merely inert but actively misleading about *why* it failed.

**Nothing public is affected.** `__main__` renders the domain root normally; only admin edits to
that row are blocked.

### 26.4 Fix options

| Option | Effect | Trade-off |
| --- | --- | --- |
| **A. Exempt `__main__` from the slug rule, and refuse to CHANGE it** | Edits work; the slug stays structural | Two validators to touch (they are duplicated); needs an explicit "slug may not be changed on `__main__`" check so the exemption is not a loophole |
| **B. Make the slug read-only in `PageForm` for `__main__`** | Removes the temptation | UI-only — a direct API call still fails, so the bug survives where it started |
| **C. Widen the regex to allow underscores** | One-line | ⚠️ Also permits `my_page` as a public URL for **every** page, changing the URL vocabulary site-wide to fix one internal row. Rejected |
| **D. Don't offer Edit on `__main__` at all** | Honest — no control that cannot work | Loses the ability to retitle the root page, which is a real thing to want |

**Recommended: A + B together.** The API stops rejecting the slug it generated and starts
rejecting *changes* to it; the form shows it read-only so nobody tries. B alone is cosmetic;
A alone leaves an editable field that must then be policed.

⚠️ Whoever does this should deduplicate `validatePageData` / `validatePageUpdateData` at the same
time, or fix it in one file and not the other. The two validators are already near-identical
copies — the same smell noted for `validateCategoryData` in G-9.

### 26.5 Why it is deferred

It blocks no public behaviour and no part of #24 or #25. It was found because the `__main__`
status guard's 400 was being masked by this one — see the I-1 record, where a test passed for the
wrong reason precisely because of it.

---

## 🔵 27. Real icons for Domains and Pages — replacing emoji-in-the-title

**Raised 9 Aug 2026.** Discussed at length before any code; this section records the reasoning,
the measurements and the rejected options, because several of the decisions are non-obvious and
one of them reversed mid-discussion.

### 27.1 The requirement

From Notion, where each page can carry either an emoji **or** an uploaded image, and an image
already used elsewhere can be re-selected. The user's own examples:

- **Domains** — *YouTuber* → the YouTube logo
- **Pages** — *Facebook Groups*, *LinkedIn Groups*, *Subreddits*, *Instagram Pages*, *TED Talks*
- **Custom, non-brand** — *Blockchain & Web3*, *AI | ML | DL*, *Entrepreneurship | Startup*

The argument for it is simply that the right mark reads better than an arbitrary emoji, and the
screenshots supplied make that case well. The counter-argument is scope: this is the largest new
feature discussed so far.

### 27.2 What exists today — measured, not assumed

⚠️ **There is no icon concept in the schema at all.** The emoji is a *character inside the name
string*: `title = "▶️ YouTube Channels"`, not `{ icon: "▶️", title: "YouTube Channels" }`.

| | |
| --- | --- |
| Domains | **41**, of which **36 carry an emoji inside `name`** |
| Pages | **1,216**, of which **1,200 carry an emoji inside `title`** |
| Distinct emoji in use | **166** |
| Distinct page titles | **395** across 1,216 pages → **3.1× reuse** |
| `DomainCategory.icon` | field exists, set on **0 of 7** — already-dead field |

⚠️ The **3.1× reuse** is the number that shapes the design: one YouTube logo will serve many
pages, so icons must be *referenced*, not duplicated per row. It is also why `stripEmoji()` exists
in `src/lib/seo.ts` — the emoji has to be stripped out of titles for SEO precisely because it is
welded into them.

### 27.3 Format — SVG

Vector, so one file is sharp at any size on any screen, and no second file is needed for retina.
Measured from the Simple Icons CDN: **418–2,116 bytes** per coloured logo. PNG/WebP only for
anything photographic.

⚠️ **A CORRECTION MADE DURING THE DISCUSSION.** An earlier answer implied SVG was risky and
should perhaps be avoided. **That was overstated and wrong.** The real caution is narrow: an SVG
file *can* contain `<script>`, so accepting arbitrary SVG **uploads** from a browser needs
sanitising — which matters for finding #2's reasons. Committing SVGs you downloaded yourself into
the repository carries no such risk. SVG is the right format and is what we will use.

### 27.4 ⚠️ REJECTED: an icon library (`simple-icons`) — and why

The cheap option was `simple-icons`: 3,453 brand SVGs shipped as an npm package, so `icon =
"youtube"` renders inline with **no storage, no uploads, no security surface and zero image
requests**. It was about to be recommended.

It was tested against the user's own examples, by fetching each from the Simple Icons CDN:

```
youtube    200 ✓   474 bytes        instagram  200 ✓  2,116 bytes
reddit     200 ✓ 1,248 bytes        ted        200 ✓    418 bytes
facebook   200 ✓   557 bytes        linkedin   404 ✗  DOES NOT EXIST
```

**LinkedIn has been removed from Simple Icons on trademark grounds** — and *LinkedIn Groups* was
one of the five examples given. So the library fails the requirement on day one, uploads would
have to be bolted on anyway, and the result is two icon systems.

⚠️ **The deeper reason it is the wrong shape**: a library slug and a file URL are different
kinds of value, so every render site would have to branch on which kind it had. Contrast §27.5,
where the two candidate approaches both produce a URL and therefore never branch.

**Verified as still useful:** the Simple Icons site offers *Download coloured SVG*, so brand
logos can be sourced from there in full colour and committed — the library is a good *source*,
just not a good *mechanism*.

### 27.5 Storage — `/public/icons`, not Vercel Blob

Two candidates:

| | `/public/icons` | Vercel Blob |
| --- | --- | --- |
| Where files live | in the repository, deployed with the code | a Vercel storage service |
| Adding one | drop the file, `git push` (~90 s deploy) | upload from the admin panel |
| Schema change | **yes** — 2 columns | **yes** — 2 columns **+ a `MediaAsset` table** |
| Upload endpoint | none | auth, MIME check, size limit, SVG sanitising |
| Orphan cleanup | not a thing | needed eventually |
| Cost | £0 | free tier, then paid |

⚠️ **A misconception worth recording: `/public` is NOT "the no-schema-change option".** Both
approaches must record *which* icon a row uses, so both need columns on `Domain` and `Page`. Blob
additionally needs the `MediaAsset` table, because the picker has to list what has been uploaded
— with `/public` that list is the folder itself.

**The decisive argument is frequency, drawn from the data.** 41 domains created in about a year,
and 395 distinct titles across 1,216 pages, means new pages overwhelmingly reuse titles that
already exist — and therefore icons that already exist. Icon additions will be a burst of ~30
now and rare afterwards. An upload pipeline exists to make *frequent, unpredictable* additions
easy; that is the opposite of this situation, and it would be built to save a `git push` the user
already performs several times a day.

#### 27.5.1 ⚠️ `/public` is also FASTER — measured, and it is about origin

`/public` files are served from **`atno.io` itself**, confirmed against production:

```
GET https://atno.io/favicon.ico  →  200,  X-Vercel-Cache: HIT
```

Blob files are served from `*.public.blob.vercel-storage.com` — **a different origin**. Same-origin
images reuse the connection the page already opened and are multiplexed over HTTP/2 at no setup
cost. A different origin forces **DNS → TCP → TLS** before the first byte of the first icon,
typically **100–300 ms**, once per cold page load. `<link rel="preconnect">` shrinks that gap but
never closes it. **There is no case in which Blob is faster.**

After the first visit the two are identical — both cached in the browser, zero requests.

#### 27.5.2 ⚠️ `/public` needs a cache-header change, or it is slower than it looks

Vercel serves `/public` with `Cache-Control: public, max-age=0, must-revalidate` — verified on
production above. That means **the browser re-checks every icon on every page load**: cheap `304`
responses, but a round trip each, per icon. Fifteen icons is fifteen conditional requests every
visit.

Fixed with a `headers()` rule in `next.config.ts` (Phase J-1). ⚠️ The consequence of `immutable`
is that **an icon can never be edited in place** — a changed icon needs a changed filename, or
browsers will hold the old one for a year. For logos that never change this is the right trade.

### 27.6 ⚠️ THE EMOJI COUPLING — the hidden cost

1,200 page titles and 36 domain names have the emoji **inside the text**. Give such a row an icon
without touching its title and the visitor sees **two icons**:

```
[🔴 YouTube logo]  ▶️ YouTube Channels
```

Two ways out:

1. **Incremental (chosen).** Set an icon only on the rows that deserve one, and hand-remove the
   emoji from *those* titles. ~30 rows touched, reversible per row, nothing mass-edits content.
2. **Migrate everything.** A script strips the leading emoji from all 1,216 titles into a field.
   Tidier model, and `stripEmoji()` could eventually retire — but it rewrites every title in the
   database in one pass, across 166 distinct emoji.

The user offered to remove emoji manually, which makes (1) straightforward.

### 27.7 Performance — the `force-dynamic` worry is unfounded

⚠️ **`force-dynamic` governs the HTML document, not image assets.** Images are separate requests
with their own cache lifetime, served from the CDN; a dynamically rendered page does not stop an
icon being cached for a year.

And **reuse bounds the request count**: it is driven by *distinct* icons, not row count. A domain
page listing 70 children might reference 10 distinct logos — 10 small requests on first visit,
zero thereafter.

⚠️ **A size correction.** The figure floated was "under 2 MB", later "under 500 KB". For a 20-pixel
icon both are enormous — the measured logos are **418–2,116 bytes**. Twenty icons at 500 KB would
be **10 MB on one page**; the same twenty as SVG are ~30 KB. **Ceiling: 10 KB per icon**, enforced
by a build check in J-1 so an oversized file cannot slip in unnoticed.

### 27.8 Decisions

| Question | Decision |
| --- | --- |
| Format | **SVG** (PNG/WebP only if something photographic ever appears) |
| Source | Simple Icons *"Download coloured SVG"* for brands; anywhere for custom marks |
| Storage | **`/public/icons/`**, committed to the repository |
| Schema | `Domain.icon String?` and `Page.icon String?` — null means "fall back to the emoji" |
| Picker list | **generated from the folder at build time**, so it cannot drift from the files |
| Emoji | incremental — remove by hand only on rows that get an icon |
| Size ceiling | **10 KB**, enforced by a build-time check |
| Uploads | **deferred, not rejected** — see below |

⚠️ **Deferring uploads costs nothing later, and this is the point that de-risks the decision.**
Both approaches store a **URL**. `/icons/youtube.svg` and `https://….blob.vercel-storage.com/…`
are both strings in a `src` attribute, so adding Blob later means the picker grows an Upload
button and **no schema change, no migration and no change to any render site**. This is exactly
what §27.4 could not offer.

### 27.9 Corrections made during this discussion

- **SVG was wrongly implied to be unusable.** See §27.3. The risk is specific to accepting
  uploads, not to the format.
- **The `NarrativeLayout` image task was misremembered as pending.** It is recorded at line 2196
  as **WON'T DO (29 Jul)**: `NarrativeLayout` renders for **0 of 1,198 pages**, reachable only
  through the `default:` branch of a switch whose four real `contentType` values all have explicit
  cases. Nothing to pick up.
- **`/public` was described as avoiding a schema change.** It does not — see §27.5.

---

## 🗺️ Recommended Order of Work

All work happens on `dev-3.0` (branched from `master` @ `c4ff8d8`), one PR per
phase, merged to `master` → auto-deploys to `atno.io`.

### Where things stand — 30 Jul 2026

| Phase | Scope | Status |
| ----- | ----- | ------ |
| **A** | Security + SEO foundation | ✅ complete |
| **B** | Correctness | ✅ complete |
| **C** | Cleanup | ~ 11–13b done; **#8** blocked on the geo decision, **#4** yours |
| **D** | Polish (metadata, JSON-LD, breadcrumb labels) | ~ complete except product content |
| **E** | Security hardening + resilience | ✅ complete (**#17** half — dev branch row remains) |
| **F** | Performance + admin correctness | ~ **#18 #20 #22.4 #22.1 #22.3 #22.5 #22.2(a) done**; only **22.2(b)/(c)** left, and both wait for Phase G |
| **G** | Admin UI rebuild on shadcn | ~ **G-1 shell + G-2 Dashboard DONE**; G-3 Domains next |

**Next: Phase G — the shadcn admin rebuild.** Everything cheap and non-visual in Phase F is
done; what remains (`22.2(b)` row editing, `22.2(c)` schema editing, `22.6` dialogs, tables
pagination) is all **new UI**, and building any of it in the current hand-rolled markup means
rewriting it days later. So the shell comes first, then those are built inside it.

**The one thing blocking the largest win:** the geo decision (**#8-DR**, below). It gates
static rendering for all 1,198 public pages and cannot be resolved without a product call.

### Phase A — Security + SEO foundation ✅ complete


| Done | Commit | Item                                                                     | Notes                                                                                                                                                                                                               |
| ---- | ------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [x]  | 1      | **#1** Lock down `/api/admin/`* **+ #15.3**                              | `lib/api-auth.ts` + widened middleware + `requireAdmin()` on all 14 routes (36 handlers). Restructures middleware so every exit path carries the country cookie.                                                    |
| [x]  | 2      | **#13** `robots.ts`                                                      | With the `VERCEL_ENV` preview guard. *After* #1 — don't signpost `/admin` while it's open. Corrected the planned disallow list: `/api/` needed two `Allow` exceptions or table content would be hidden from Google. |
| [x]  | 3      | **#14** SEO-A: `metadataBase` + `generateMetadata` + OG tags             | New `src/lib/seo.ts`. Includes the `robots: { index: false }` guard for geo-restricted pages (a no-op today — no such content exists). Found and fixed three plan errors; see the SEO-A section.                    |
| [x]  | 4      | **#14** A4/A5: brand favicons, static OG card, brand-led `/domain` title | Replaced the stock Vercel favicon. Light/dark icon variants. `design/` folder for source artwork.                                                                                                                   |
| [x]  | 5      | **#13** `sitemap.ts`                                                     | 1198 URLs, `ALL`-targeted only, parent-chain traversal for depths 2–4. **Phase A complete.**                                                                                                                        |




### Phase B — Correctness ✅ complete

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



### Phase C — Cleanup ~ items 11–13b done; 14 (**#8**, blocked on the geo decision) and 15 (**#4**) open

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



### Phase D — Polish ~ 16a/16b/17/18 done; 16c partly won't-do; 19 continued in Phases E–G

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

- [~] 16c. **#14** SEO-B remainder: ~~`next/image` for `NarrativeLayout.tsx:104`~~ (won't do —
      that layout renders for 0 of 1,198 pages; see the SEO-B table); real page content is
      product work, still open
- [x] 17. **#11** Make the render path read-only — done 29 Jul. `getOrCreateMainPage` deleted;
      the unique index and health-check panel were skipped with reasons recorded under #11
- [x] 18. **#12** Gate or delete `/api/debug/cache-test` — deleted in Phase C
- [~] 19. Remaining Step 7 — split across Phases E and G below: error boundaries **done**
      (#19), rate limiting **partly done** (login lockout, #16), structured error responses
      **deferred**



### Phase E — Security hardening + resilience (29 Jul, complete)

Everything in this phase was found by continuing down the findings list; two items were
discovered incidentally while verifying others.

| Done | # | Item | Notes |
| ---- | - | ---- | ----- |
| [x] | **#11** | Stop the public render path writing to the database | `getOrCreateMainPage` **deleted**, not just bypassed — its only caller in the codebase was one render line. Audited first: all 32 `direct` domains already had `__main__`, 0 duplicates, so the create branch had never fired. Unplanned win: it was uncached *because* it could write, so 32 domain roots had been hitting Postgres on every view. |
| [x] | **#19** | Error boundaries for public / admin / root scopes | 5 new files, 0 modified. ⚠️ The real risk was that `notFound()` and `redirect()` are implemented by **throwing** — a boundary swallowing those would turn every 404 into a 500 and break `/`. Verified against a production build rather than trusted from docs. |
| [x] | **#16** | Admin login brute-force lockout + user-enumeration timing fix | 5 failures → 15-minute lock, counters in Postgres (each Vercel instance has its own memory). Also closed an ~85× timing gap that let anyone discover which emails had accounts. ⚠️ Could not go in middleware — `api/auth` is excluded from the matcher by design. |
| [~] | **#17** | 🔴 Seeded `admin@example.com` live on production with the password in this repo | **Live credential revoked** (row deleted, verified read-only). `prisma/seed-admin.ts` now reads `ADMIN_EMAIL`/`ADMIN_PASSWORD` with **no default**, validates against the real password policy, and no longer echoes the password. ⬜ **Still open:** the same row exists on the **development** branch. |

> ⚠️ **Deploy ordering, learned here:** `npm run build` runs `prisma generate`, **not**
> `prisma migrate deploy`. #16 added two columns, so the migration had to be applied to
> production **before** the code shipped. Both columns are additive with defaults, which is
> what makes that order safe. Now documented in `.env` itself.



### Phase F — Performance + admin correctness (30 Jul, in progress)

| Done | # | Item | Result |
| ---- | - | ---- | ------ |
| [x] | **#18** | Cache the table-data route + wire its invalidation | `table` is 666 of 1,198 pages and the route had **no caching at any layer** — no `Cache-Control`, and React `cache()` only, which is request-scoped and so deduplicated nothing. ⚠️ Auditing invalidation first found **three of four** table-writing handlers invalidated nothing, including the most-used one. |
| [x] | **#20** | 🔴 Five admin screens frozen at build time | The user-reported bug: changes appeared on the live site but not in the admin UI. `force-dynamic` on exactly the five that read the DB during render. Prerendered routes 16 → 11. `revalidateTag` could never have fixed it — those pages have no tag. |
| [x] | **#22.4** | 433 broken admin "Preview" / "View Live" links | The traversal existed **four times in three states of correctness**; two were byte-identical copies with **no cycle guard**. Consolidated into `src/lib/page-path.ts`. Old vs new agree on 1,198/1,198 pages, so no existing consumer changed. |
| [x] | **#22.1** | `/admin/tables` shipped 8.19 MB to render a list | 8.19 MB → **1.73 MB** (4.7×) and `tables.findMany` **~11× faster** (11,091 → 943 ms warm). Counts moved into Postgres via `jsonb_array_length`; **no migration needed**. |
| [x] | **#22.3** | The "Manage Data" button 404s | Both menus now offer one **📊 Open table** link. Also removed the grid menu's duplicate — "Edit" and "Manage Data" pointed at the same URL. |
| [x] | **#22.5** | Two dead **Export** dropdown items | Export extracted to `src/lib/export-table.ts` and shared with the editor; each dead item became working CSV + JSON items. Swept panel-wide: **no bare `<DropdownMenuItem>` left anywhere in admin.** |
| ~ | **#22.2** | 🔴 Table data is write-once | **(a) re-import DONE 30 Jul** — tables are editable in bulk again; the placeholder sat between two finished halves. **(b)** row editing and **(c)** schema editing remain, both **after Phase G**. ⚠️ `targetCountries` still has **no UI anywhere**, so the geo feature stays unreachable for editors until (b). |

> ⚠️ **22.2(b) must come after #21 Phase 2.** Building a data grid in the current hand-rolled
> markup and then rewriting it on shadcn primitives days later is the work twice.



### Phase G — Admin UI rebuild on shadcn — PLAN (agreed 30 Jul, not started)

**Approach:** rebuild page by page, shell first. Each step is its own commit and PR, with test
cases, so a regression is traceable to one screen.

#### G-0 · Design spec — agreed before any code

```
┌──────────────────────────────┐┌─────────────────────────────────────────────┐
│  ⚙  ATNO Admin          [«]  ││  Admin › Tables › Logo Makers      [+ New]  │ sticky
├──────────────────────────────┤├─────────────────────────────────────────────┤
│  ◈  Dashboard                ││   Tables                                    │
│                              ││   Create and manage data tables             │
│  STRUCTURE                   ││   ─────────────────────────────────────     │
│  ▢  Categories               ││                                             │
│  ▤  Domains                  ││   [ page content ]                          │
│  ▦  Pages                    ││                                             │
│                              ││                                             │
│  CONTENT                     ││                                             │
│  ▩  Section Layout           ││                                             │
│  ▥  Tables                   ││                                             │
│  ▧  Rich Text                ││                                             │
│                              ││                                             │
│  SYSTEM                      ││                                             │
│  ◉  Admin Users              ││                                             │
├──────────────────────────────┤│                                             │
│  ↗  View site                ││                                             │
│  ☾  Theme            [toggle]││                                             │
│  ┌──┐                        ││                                             │
│  │P │ Prajwal raj       [⋮]  ││                                             │
│  └──┘ prajwal…@gmail.com     ││                                             │
└──────────────────────────────┘└─────────────────────────────────────────────┘
   collapses to a 48px icon rail
```

**Decisions, with reasons:**

| Decision | Reason |
| -------- | ------ |
| **Flat nav, no submenus** | Every sub-route (`tables/new`, `rich-text/edit/[id]`, `users/new`, `users/edit/[id]`) is an **action or a detail view**, not a sibling destination. "New Table" belongs as a button on the Tables page where you can see what already exists. Submenus would add a click to the common case and duplicate what the page offers. |
| **"Add New Admin" leaves the nav** | It is the only nav item that is not a *place*. Becomes a button on the Users page. |
| **lucide icons, not emoji** | Emoji render differently per OS and ignore the theme. lucide is already installed. |
| **Collapsible to an icon rail** | The table and rich-text editors are wide; today's fixed `w-64` cannot be reclaimed. Descriptions move to tooltips on the rail. |
| **Theme toggle in the sidebar footer** | A preference, not a page action — grouped with the user block, leaving the header for page actions. Uses the existing `ThemeToggle` from #21 Phase 1; the provider is already global. |
| **Header = breadcrumb + page actions only** | It currently duplicates a title every page also renders. |
| **Breadcrumb resolves record names** | `Admin › Tables › 🏀 Online Customizable Logo Makers`, not a UUID. Today the editor gives no indication of which table you are in. |

#### G-1 → G-8 · Build order

| Step | Scope | Notes |
| ---- | ----- | ----- |
| **G-1** ✅ | **Shell** — `AdminLayout`, `AdminSidebar`, `AdminHeader`, breadcrumb | **DONE 30 Jul.** See below. **Zero new installs** — every primitive was already present. |
| **G-2** ✅ | **Dashboard** | **DONE 30 Jul.** Hardcoded colours **89 → 8** (all 8 intentional). Found and fixed **three real bugs** — see below. |
| **G-3a** ✅ | **Domains — page container** | **DONE 30 Jul.** Colours **53 → 1**. Form → dialog; 4 stat panels → 3; 2 dead buttons removed; stray `Roboto` import removed. Also fixed a document-level **horizontal scrollbar** (`min-w-0` on `SidebarInset`). |
| **G-3b** ✅ | **Domains — the table** | **DONE 31 Jul.** Colours **64 → 0**. Found **four real bugs** — the publish button was never wired to its API at all, and both modal backdrops rendered solid black (`bg-opacity-50` is dead in Tailwind v4). Installed `alert-dialog`. See below. |
| **G-3c** ✅ | **Domains — `DomainForm` + `DomainFilters`** | **DONE 1 Aug.** Colours **65 → 0** and **33 → 0**; no new installs. Filters became a responsive grid, so the component that *caused* the G-3a overflow no longer needs the workaround. Hit **two Radix `Select` traps** (empty-string values throw; `SelectValue` server-renders blank). Added a **slug-change warning** — renaming a slug 404s every page under it and there is no redirect table. **`/admin/domains` is now fully rebuilt.** |
| **G-4a** ✅ | **Pages — the state bug, alone** | **DONE 1 Aug.** ⚠️ **Correctness only — one file, logic + comments, zero JSX touched**, so it is reviewable in isolation. The page tree rendered **empty on first load** and built **another domain's URLs** after switching — one stale-closure root cause. **Proven: the API returns 70 pages and every one was discarded.** See the G-4 findings below. |
| **G-4b** ✅ | **Pages — shell + `PagesManager` chrome** | **DONE 1 Aug.** Colours **12 + 26 → 0**; no new installs. Removed a **`Roboto` import that was never referenced**. `confirm()`/`alert()` → an `AlertDialog` that **states the descendant count** the API actually deletes (#22.6). Gradient banner gone; the "Understanding Domain Types" panel is now a closed `Collapsible` with its content kept verbatim. Details below. |
| **G-4c** ✅ | **Pages — `PageTree` + `DomainSelector`** | **DONE 1 Aug.** Colours **51 + 43 → 0**, zero new installs. The tree printed **150 redundant labels** per 50-page domain and dropped a **Parent column that repeated one constant string 49 times**; rows went from three lines to one. Fixed a **keyboard trap** — `opacity-0` hover-only actions stay in the tab order, so a 50-page tree had 200 invisible tab stops. `DomainSelector` became a searchable `Popover`+`Command`. Details below. |
| **G-4d** ✅ | **Pages — `PageForm`** | **DONE 1 Aug.** Colours **59 → 0**; `/admin/pages` fully rebuilt (**191 → 0** across 5 files, **zero new installs** for all of G-4). Fixed two real bugs: **"Default (`__main__` page)" detached the page from `__main__` when editing** (POST compensates, PUT does not), and the parent list's `'  '.repeat(depth)` indentation **never rendered** because HTML collapses whitespace. Six radio cards → one `Select`, which also fixed **invisible keyboard focus**. Details below. |
| **G-5a(i)** ✅ | **Tables list — the page shell** | **DONE 3 Aug.** `app/admin/tables/page.tsx` colours **15 → 0**. `AdminPageHeader` + shared `StatsCard`; removed a local `StatsCard` copy and a hand-rolled loading skeleton. Dropped a "Recent Updates" stat that was **always 5**. |
| **G-5a(ii)** ✅ | **Tables list — `TablesManager`** | **DONE 3 Aug.** Colours **25 → 0**; the `bg-white` wrapper was the dark-mode problem on this screen. Removed a **duplicate header + second create button**. Added pagination: **1.73 MB → 675 KB**, of which rendered HTML fell ~1.2 MB → 136 KB. |
| **G-5a(iii)** ⏸️ | **Tables list — server-side pagination** | **DEFERRED 3 Aug, by decision — not forgotten.** The residual **539 KB** RSC payload. Not urgent: admin-only, single user, nothing broken, and #22.1 + G-5a(ii) already took the page **8.19 MB → 675 KB (92%)**. ⚠️ **Revisit trigger is table COUNT, not time** — it scales linearly, so ~2,000 tables would put it back near 1.6 MB. Needs URL-driven filters + a reworked query, keeping stats on a **separate unpaginated** query (they aggregate over all 652 tables / 8,076 rows / 33 domains) and giving the "By domain" tab its own source, since it cannot be derived from one page. |
| **G-5b** ✅ | **Tables — editor shell + wire up schema & settings** | `app/admin/tables/[id]/page.tsx` (202 / 18) + `TableEditor.tsx` (504 / 31). ⚠️ **`#22.2(c)` is mostly a WIRING job** — see the finding below. |
| **G-5c** ✅ | **Tables — row editing (`#22.2(b)`)** | The data tab currently renders the **public read-only** `DataTable`. `PUT /api/admin/tables/[id]/data` already accepts `{ data: { rows }, operation: 'replace' \| 'append' }`. |
| **G-5d(i)** ✅ | **Creation flow — shell + wizard chrome** | **DONE 3 Aug.** `new/page.tsx` **3 → 0** + `TableCreationWizard` **15 → 0**. Added a **Cancel** route (the wizard previously had no exit but the back button); `include:` → `select:` on the domains query; three stacked cards → two; hardcoded `bg-green-600` final button and blue/grey step indicators → theme tokens with `aria-current="step"`. |
| **G-5d(ii)** ✅ | **Creation flow — `tables/DomainPageSelector`** | **DONE 3 Aug.** Colours **31 → 0**. This was the near-invisible text in the user's screenshot. Selection states moved off hardcoded blue to `primary`/`accent`; emoji step headings and a `text-4xl` 🔍 → lucide. **Reordered ahead of the other two** because it is step 1 of the wizard and was the worst-looking thing on it. ⚠️ **NOT shared with `SectionsManager`** — see the correction note below. |
| **G-5d(iii)** ✅ | **Creation flow — `TablePreview` + `CSVUploadInterface`** | **DONE 3 Aug.** Colours **53 → 0** and **44 → 0**. Fixed the outstanding `toLocaleDateString()` **hydration hazard**. ⚠️ `Card` has no `variant` prop — a mechanical replace tried to give it one and `tsc` caught it; the error block is an `Alert`. **G-5 is now colour-clean.** |
| **G-6a** ✅ | **Categories — shell + list** | **DONE 3 Aug.** Colours **16 + 34 + 38 → 0**. Fixed **both solid-black modal overlays** (`bg-opacity-50` × 2), a **dead "Create First Category" button**, a subtitle **promising drag-and-drop that does not exist**, and three "Add to Column N" buttons that **ignored the column**. The delete dialog now states the domain count and surfaces the API's real refusal message instead of "Please try again". Both `window.location.reload()` calls → `router.refresh()`. Details below. |
| **G-6b** ✅ | **Categories — `CategoryForm`** | **DONE 3 Aug.** Colours **47 → 0**, so `/admin/categories` is entirely colour-clean. ⚠️ **Retired the LAST `Roboto` import in the app.** Removed `alert()` + `window.location.reload()` (#22.6), and **completed the `?column=N` wiring G-6a promised** — verified `?column=3` pre-selects 3 and `?column=99` clamps to 1. |
| **G-6c** ✅ | **Section Layout — shell + manager + picker** | **DONE 3 Aug.** Colours **14 + 8 + 33 → 0**. Removed the **fourth** local `StatsCard` copy and the **fourth** hand-rolled skeleton, plus a **duplicate page title** (third occurrence of that pattern). Four stat tiles → three: "Total Domains" counted every domain in the system, which says nothing about section layout. ⚠️ `sections/DomainPageSelector.tsx` had **no imports at all** before this. Details below. |
| **G-6d** ✅ | **Section Layout — `SectionEditor`** + shadcn pass | **DONE 3 Aug.** Colours **54 → 0**. ⚠️ **On the user's request, both pickers and both remaining native `<select>`s became shadcn** — the domain/page pickers are now searchable `Popover`+`Command` comboboxes with **lucide type icons instead of emoji**, and the "add page to section" control is a `Command` list because it can hold **864 pages**. **Phase G-6 complete: 244 → 0 colours, 0 native selects.** |
| **G-7** | **Rich Text list + editor** | |
| **G-8** ✅ | **Users** | **DONE 4 Aug.** Colours **36 → 0** across 6 files. Fixed two spinners using `border-gray-900` (invisible on dark) and ⚠️ **a `container mx-auto py-6` wrapper in 5 places** — the only admin area that double-padded against `AdminLayout`. Already had its "Add New Admin" button. ⚠️ **A hydration diagnosis of mine was wrong here — see the record below.** |
| **G-9** ✅ | **Categories — the row (`categoryOrder`) is now editable** | **DONE 6 Aug.** ⚠️ **Not a colour pass — a real missing feature, found by the user.** `categoryOrder` has always been the **row number** on the public homepage, but **no admin screen could write it**, so every category added through the UI started its own row. The admin drew three tidy stacks; the live site had **five empty cells**. Adds a Row field, rebuilds the preview as the actual grid, and makes moving a category a **swap** rather than an append. **14/14 HTTP tests pass.** Details below. |

**Components installed as needed, per step** — not up front. Expected later additions: `sonner`
(toasts, to replace the 8 `alert()` calls), `alert-dialog` (destructive confirms, replacing the
3 `confirm()` calls — ⚠️ `confirm()` is *synchronous*, so each call site needs restructuring,
not substituting). That is **#22.6**, folded into whichever step touches each call site.

#### Standing test cases for every step

Because these are UI rewrites, the risk is silent breakage rather than build failures:

1. **The screen still renders** and shows the same information it did before.
2. **Every mutation still works** — driven over HTTP with a real session, effect verified in the
   database, exactly as Phases E/F were tested.
3. **No screen regresses** — the other 12 still return 200.
4. **Dark mode** — the rebuilt screen works in both themes (the whole point of Phase 2).
5. **The count of hardcoded colours in that file goes to ~0** — measurable, and the reason the
   rebuild beats a colour sweep: replacing hand-rolled markup *deletes* its colours.

⚠️ **Nothing in Phase G should change behaviour.** Where a real bug is found mid-rebuild, fix it
as a separate commit so the UI diff stays reviewable.

### Phase H — Domain status + Upcoming Domains (#24) — PLAN (agreed 6 Aug, starting)

Two commits. **H-1 changes no public behaviour** (all 37 domains are already published, so
swapping the gate to `status: PUBLISHED` is a no-op today) — which makes it independently
testable before anything user-visible lands.

| Step | Scope | Status |
| --- | --- | --- |
| **H-1** ✅ | Schema + migration + admin UI + **the missing access gate** | **DONE 6 Aug.** Migration backfilled **37 → PUBLISHED, 0 DRAFT, 0 UPCOMING**, zero drift against the retained boolean. **25/25 HTTP tests pass.** Record below. |
| **H-2** ✅ | Public "Upcoming Domains" section + `sonner` | **DONE 6 Aug.** Buttons not links, so there is nothing crawlable and nothing to share. **14/14 tests pass** against a built server. Record below. |

##### ✅ H-2 DONE — 6 Aug 2026 (the public "Upcoming Domains" section)

**One new dependency (`sonner`), one new component, three files touched.**

`<Toaster position="top-right" />` mounted in the root layout **inside** `ThemeProvider` —
`components/ui/sonner.tsx` calls `useTheme()`, and outside the provider that returns the
default rather than the user's choice, so toasts would render light-on-light in dark mode.

**`UpcomingDomainList` renders `<button>`, not `<a>`.** An upcoming domain has no page — H-1
made `[...slug]` 404 anything not `PUBLISHED` — so a link here would point at a 404: crawlable
as a soft 404, and shareable as a URL that silently changes meaning the day the domain goes
live. A `<button>` has no href, and unlike a styled `<div onClick>` it is focusable, tab-
reachable, announced as interactive, and fires on Enter/Space.

Only the list is a Client Component. `domain/page.tsx` is an async Server Component, so it
cannot hold an `onClick` — but the heading and section wrapper stay server-rendered, keeping
the client bundle for this feature to one small file.

The section renders **only when at least one domain is upcoming**; a heading over an empty list
promises content that does not exist. `getUpcoming` takes the **same `userCountry`** as
`getAll`, so "upcoming" cannot become a way to leak geo-restricted content.

###### TEST CASES — 14/14 passed against `next build && next start`

| # | Case | Result |
| --- | --- | --- |
| 1 | Section renders when something is upcoming | heading, subheading and the domain name all present |
| 2 | Not links | no `href="/domain/test2"`; the section contains a `<button` |
| 3 | Out of the sitemap | absent |
| 4 | Detail page still 404s | 404 |
| 5 | Geo-restricted upcoming domain | shown to `US`, hidden from `IN` |
| 6 | Nothing upcoming → no section at all | heading and subheading both absent; published grid unaffected |
| 7 | Set back to UPCOMING | section returns |

Client bundle checked directly: `sonner` is in a shipped chunk and the toast's text is in
`/domain`'s own chunk, so the wiring ships. ⚠️ **The visual toast on click is NOT verified** —
that needs a real browser click.

###### Toast close button — and a trap in the vendored shadcn wrapper

Added `closeButton` to `<Toaster>` so every toast can be dismissed immediately rather than only
by waiting out the timer or swiping. Set on the Toaster, not per `toast()` call, so the toasts
that will later replace the remaining `alert()` calls (#22.6) behave identically without anyone
remembering to pass an option.

⚠️ Checked in `node_modules/sonner/dist/index.js` rather than assumed: in **2.0.7 the close
button carries no `opacity: 0`**, so it is visible at rest. Some earlier releases revealed it
only on hover, which would have quietly not been what was asked for.

⚠️ **THE POSITION CHANGE WAS REVERTED BY THE USER — the × keeps sonner's default top-left
placement.** The `[data-sonner-toaster]` rule below is **not in the codebase**; commit `d40136d`
carries only the `closeButton` prop, despite its message describing the move. The reasoning is
kept because the *trap* it documents is real and will bite anyone who tries this again.

sonner puts the × on the leading edge, so it sits on the top-**left** corner, half outside the
card. The natural fix is a `style` prop carrying sonner's three `--toast-close-button-*`
variables — but `src/components/ui/sonner.tsx` renders

```tsx
<Sonner … style={{ '--normal-bg': …, '--normal-text': …, '--normal-border': …, '--border-radius': … }} {...props} />
```

with **the spread LAST**. A `style` passed from `layout.tsx` therefore *replaces* that object
instead of merging, silently dropping the four variables that map the toast onto the app's theme
tokens. The toast would have lost its theming in exchange for a moved button. `className` has
the identical problem — it would drop `"toaster group"`.

Editing the wrapper to merge them would be the tidy fix, but it is vendored shadcn and stays
untouched. The variables were therefore put in `globals.css`, targeted at sonner's own
`[data-sonner-toaster]` attribute, which cannot clobber anything the component sets — verified
in the compiled CSS with `--normal-bg` still present in the client bundle. **That rule was then
reverted**, so if the button is ever moved, this is the route to take.

**Generalisable:** before passing `style` or `className` to a wrapped third-party component,
check where `{...props}` sits in the spread. Last means override, not merge.

###### Styling revisions after the user saw it (6 Aug)

Three changes on request, all verified in the rendered HTML **and** in the generated CSS:

1. **Fills downwards, five per column** — `lg:grid-flow-col lg:grid-rows-5` replaces a
   left-to-right `sm:grid-cols-2 lg:grid-cols-3` flow. Four upcoming domains were spreading
   across all three columns with a single orphan starting a second row; they now form one tidy
   column under the heading, matching the published category blocks above. `lg:` only, because
   `grid-flow-col` on a narrow screen would push items sideways off it.
2. **`text-foreground/80` instead of `text-muted-foreground`.** `muted-foreground` is the token
   for genuinely secondary text and made real domains look disabled next to the live ones. An
   alpha on the same token tracks both themes; a fixed grey would have been wrong in one.
3. **`mb-5` on the heading**, carrying the spacing the removed subtitle used to provide. The
   "These are in progress" line was deleted (not left commented out) — the heading already says
   it.

⚠️ **A CSS check nearly produced a false alarm.** `grep` for `text-foreground/80` returned **0**
— the CSS escapes the slash as `\/` — and printing the rule with `head -1` showed
`color:var(--foreground)` with no alpha, which looked exactly like a dropped utility of the
`bg-opacity-50` kind. It is not: **Tailwind v4 emits a plain fallback first and the real value
inside `@supports (color:color-mix(...))`**. The alpha applies. `.lg\:grid-rows-5` and
`.lg\:grid-flow-col` are likewise present inside the `lg` media query. **When checking whether a
Tailwind utility survived, read the whole rule set, not the first match.**

###### ⚠️ THE FIRST TEST RUN PRODUCED THREE FALSE FAILURES — worth recording

The first version mutated statuses with `prisma.domain.update` directly and reported that a
geo-targeted domain was hidden from its own country and that the section survived after
everything was un-upcoming. Both were **artefacts of the test, not defects**:

- `DomainService.getUpcoming` is an `unstable_cache` entry (`MEDIUM` = 60s, tag `DOMAINS`), and
  **only the API calls `invalidateDomains()`**. A direct database write leaves the cache holding
  the pre-write answer, and the page faithfully renders what it was given.
- ⚠️ **`DEFAULT_COUNTRY` is `'US'`**, so a cookie-less request populates the *same* cache entry
  as an explicit `user-country=US`. Test 1 fetched without a cookie and poisoned the US entry
  before the geo probe existed.
- ⚠️ The test's own restore set `status` without `isPublished`, leaving one row drifting —
  precisely the inconsistency the API's derived write exists to prevent. It was repaired, and
  restore now goes through the API.

**Lesson: a test that bypasses the write path also bypasses its cache invalidation, and will
blame the feature for its own staleness.** Every mutation now goes through the admin API, which
is what a real admin does anyway.

##### ✅ H-1 DONE — 6 Aug 2026 (status enum, admin UI, and the access gate)

**Migration `20260806090354_add_domain_status`.**

⚠️ **The generated migration would have taken the site down.** `prisma migrate dev
--create-only` produced only the `CREATE TYPE` and an `ADD COLUMN … DEFAULT 'DRAFT'` — which
would have marked **all 37 domains DRAFT**, and the public index reads `status` to decide what
to list. The homepage would have rendered empty. The `UPDATE … CASE WHEN "isPublished"` backfill
was written by hand and is the reason `--create-only` was used instead of letting Prisma apply
it directly.

Counts before: 37 total, 37 `isPublished`. After: **37 PUBLISHED / 0 DRAFT / 0 UPCOMING**, and
**0 rows where `status` disagrees with `isPublished`.**

**The access gate — the real bug fix in H-1.** `domain/[...slug]/page.tsx` now 404s anything
that is not `PUBLISHED`, in **both** the component and `generateMetadata`. Both are needed: they
run independently, so a component-only guard would emit a genuine title and canonical URL for a
page that then 404s.

**`isPublished` is derived, never accepted.** Every write sets `status` and computes
`isPublished = status === 'PUBLISHED'`, through one shared `resolveStatus()` in the new
`src/lib/domain-status.ts`. The retained column therefore cannot drift. `resolveStatus` also
accepts the old boolean, so a client that has not been updated keeps working — verified.

⚠️ **The PATCH quick-toggle had to change shape.** `DomainsTable` sent
`{ isPublished: !domain.isPublished }` — "make it the other thing". With three states there is
no other thing, and no sequence of flips reaches UPCOMING. It is now an explicit status set, and
the single menu item became a short list of the two statuses the domain is not currently in.

⚠️ **`draftDomains` was `!d.isPublished`** on two screens — "everything not live". That would
have counted UPCOMING domains as drafts. Each status is now counted for what it is.

⚠️ **The Pages screens' "Draft" badge was `!domain.isPublished`**, so an upcoming domain would
have been labelled a draft. It now names the actual state.

###### TEST CASES — 25/25 passed over HTTP with a real session, effects checked in the database

| # | Case | Result |
| --- | --- | --- |
| 1 | No public change | 37 PUBLISHED; `/domain` and `/sitemap.xml` both 200 |
| 2 | Create via API with explicit status | 200; stored PUBLISHED; boolean in sync; `__main__` page created |
| 3 | **Control** — PUBLISHED domain **with a page** | **200** |
| 4 | Same domain → DRAFT | **404**, boolean in sync |
| 5 | Same domain → UPCOMING | **404**, boolean in sync |
| 6 | UPCOMING domain not listed or crawled | absent from `/domain` **and** the sitemap |
| 7 | Back to PUBLISHED | **200** again |
| 8 | Invalid status (`BANANA`) | **400**, not a 500; status unchanged |
| 9 | Legacy client sending only `isPublished` | 200; mapped to DRAFT |
| 10 | Admin filter, all three values | each returns only its own status |

⚠️ **Test 3 is the reason tests 4 and 5 mean anything.** The §24.2 probe returned 404 for *both*
a published and an unpublished domain, because neither had a page — a 404 that proved nothing.
Here the same domain, with a page, returns 200 as PUBLISHED and 404 as DRAFT/UPCOMING. **A
negative result needs a positive control.**

###### ⚠️ FOUND ON PRODUCTION — the sitemap kept listing an unpublished domain

**Not caused by H-1, but exposed by it.** After migrating production and setting
`gdesign` to Draft there, the user confirmed it vanished from `/domain`, from the sidebar, and
that its page 404'd — but `/sitemap.xml` still listed it **and all 70 of its child pages**.
Locally the same change took effect immediately.

**Two facts explain the whole difference:**

1. `src/app/sitemap.ts:40` sets `export const revalidate = 3600`, making `/sitemap.xml` a
   **statically generated** route regenerated at most once an hour. The build output says so:
   `○ /sitemap.xml … 1h 1y`. And ISR serves the **stale** copy on the first request after
   expiry while regenerating behind it, so the real lag exceeds an hour.
2. ⚠️ **`revalidateTag` could never reach it.** `invalidateDomains()` only fires tags, and
   `sitemap.ts` queries `prisma` **directly** — it is not an `unstable_cache` entry, so it has
   no tag. Every call was a no-op for the sitemap.

⚠️ **`next dev` does not apply the static cache**, so the sitemap regenerates on every request
locally and the gap is completely invisible in development. **This class of bug can only be
seen on a built site.**

Harmless until now only because no domain had ever been unpublished. With DRAFT/UPCOMING that
is routine, and a sitemap advertising 404ing URLs is precisely the soft-404 problem
`sitemap.ts` already avoids for geo-restricted pages (#15.4).

**Fix:** `invalidateSitemap()` — a `revalidatePath('/sitemap.xml')` — added to both
`invalidateDomains()` and `invalidatePages()`. Pages are sitemap entries in their own right,
and `pageLastModified()` folds in table/rich-text timestamps, so content writes change the
document too. The hourly `revalidate` stays as a backstop.

✅ **A separate worry checked and cleared:** the child pages are fetched as a **nested relation
inside the domain query**, not as a separate query, so filtering the domain on
`status: 'PUBLISHED'` already excludes all of its pages. H-1's sitemap change was complete; the
70 URLs were simply part of the same stale document.

⚠️ **Verification could not be done in `next dev`** — there is no static cache there to
invalidate, so a dev test would pass without proving anything. It needs `next build && next
start`, which cannot run while a dev server is up (they share `.next`), so the user stopped
theirs first.

**Verified with an A/B control against a BUILT server** (`next start -p 3005`), because a green
run alone would only show the test passed, not that the fix caused it:

| Assertion | fix enabled | fix disabled (control) |
| --- | --- | --- |
| new PUBLISHED domain appears in the sitemap immediately | **PASS** | **FAIL** |
| DRAFT domain gone from the sitemap immediately | PASS | PASS *(vacuous)* |
| back to PUBLISHED → listed again immediately | **PASS** | **FAIL** |
| UPCOMING domain absent | PASS | PASS *(vacuous)* |

⚠️ **The two removal assertions pass in BOTH runs, and prove nothing on their own.** In the
control the domain was never in the cached sitemap to begin with, so "absent" was true for the
wrong reason. Only the two *addition* assertions discriminate. **This is the same trap as the
§24.2 404 probe, inverted** — a test that asserts absence cannot tell "correctly removed" from
"never there", and needs a positive case beside it.

Fix restored and rebuilt afterwards; `tsc` clean, build clean, no probe rows left in the
database.

⚠️ **`TaskStop` orphaned a `next start` on port 3005 as well** — third time this session that
killing the wrapper left the child listening. It caused an `EADDRINUSE` that aborted one run.
**Free the port explicitly, do not trust the task stop.**

###### ⚠️ MISSED ON THE FIRST PASS — the status filter dropdown (found by the user)

Step 12 of the H-1 plan named `DomainFilters.tsx` explicitly, **and I skipped it.** The API and
the page query both understood `?status=upcoming` from the start, but the dropdown that drives
them still offered only *Published* and *Draft* — so the filter could not reach a third of the
data, and the active-filter chip, a two-way ternary
(`status === 'published' ? 'Published' : 'Draft'`), would have labelled an upcoming filter
**"Status: Draft"**.

The root cause is that the option list was written out by hand. It is now **derived** from
`STATUS_BY_URL_PARAM`, with labels from `DOMAIN_STATUS_LABELS` — the same source the table
badges use — so a fourth status appears in the filter automatically and the option you pick
matches the badge you then see. `STATUS_BY_URL_PARAM`'s insertion order is now load-bearing and
says so.

**Verified** on `?status=` for each value: chips read *Live* / *Draft* / *Upcoming*, and the
result sets match the database (`upcoming` → only `test2`; `published` → the other 38;
`draft` → none).

⚠️ **The generalisable point: a hand-written list of enum values is a place a new value gets
missed silently.** The dropdown did not error — it just quietly offered less than the data had.

⚠️ **NOT verified from server HTML: the row menu's "Set to …" items.** Radix mounts
`DropdownMenuContent` children only when the menu opens, so they cannot appear in a fetched
page and a grep for them correctly returns 0. What *is* verified: **37/37 status badges render**,
"Unpublish" is gone, and the PATCH those items call is covered by tests 4/5/7. The menu itself
needs a click.

`tsc` clean; production build clean; database returned to 37 domains, all PUBLISHED, zero drift.

###### ⚠️ Orphaned dev servers — a process note

`TaskStop` kills the `npm run dev` wrapper but **not** the `next dev` child. Two orphans
accumulated on ports 3000 and 3001, and one of them served a stale 500 that nearly went into
§24.2 as a finding. Every probe now takes its base URL as an argument and the log is read for
the port actually bound before any request is made.

#### H-1 — schema, admin, access gate

**Database**

1. `prisma/schema.prisma` — add `enum DomainStatus { DRAFT PUBLISHED UPCOMING }` and
   `status DomainStatus @default(DRAFT)` on `Domain`. **`isPublished` stays** (see 24.3).
2. Migration backfills deterministically:
   `UPDATE "Domain" SET status = CASE WHEN "isPublished" THEN 'PUBLISHED' ELSE 'DRAFT' END`
3. ⚠️ **Verify before continuing**: count rows per status. Expect **37 `PUBLISHED`, 0 `DRAFT`,
   0 `UPCOMING`**. A mismatch means stop, not proceed.

**Server reads — swap the gate**

4. `src/services/types.ts` — `status` on `DomainBasic` / `DomainWithCategory`.
5. `src/services/domain.service.ts` — `getAllDomainsFromDB`, `getDomainsForNavigationFromDB`:
   `isPublished: true` → `status: 'PUBLISHED'`. `exists()` reads `status` (still uncalled, but
   it should not be *wrong* as well as unused).
6. `src/app/sitemap.ts:125` — same. **Upcoming domains must not enter the sitemap**: there is no
   page to visit.
7. ⚠️ **`src/app/domain/[...slug]/page.tsx` — ADD THE GATE.** 404 unless `PUBLISHED`. This is
   the fix for 24.2 and the reason H-1 is not purely mechanical.

**API writes**

8. `api/admin/domains/route.ts` + `[id]/route.ts` — accept and validate `status`; **write both
   `status` and `isPublished`** (`isPublished = status === 'PUBLISHED'`) so the retained column
   cannot drift; filter on `status`.
9. ⚠️ The **`PATCH` quick-toggle** (`[id]/route.ts:403`, sent from `DomainsTable.tsx:184` as
   `{ isPublished: !domain.isPublished }`) **has no meaning with three states.** A boolean flip
   cannot express "make this upcoming". It becomes a status *set*, and the row action becomes a
   small menu rather than a toggle.

**Admin UI**

10. `DomainForm.tsx:450` — the `isPublished` checkbox → a 3-way `Select`, each option saying what
    it means publicly (listed / hidden / listed as upcoming).
11. `DomainsTable.tsx:513` — badge `Live | Draft` → three states; `:591` toggle → status menu.
12. `DomainFilters.tsx` — the status filter already speaks `?status=published|draft` in the URL;
    add `upcoming`. ⚠️ Its `STATUS_LABELS` map and the active-filter chip at `:366` both
    hardcode a two-way choice.
13. Counts: `admin/page.tsx:335`, `admin/domains/page.tsx:281-282` (`publishedDomains` /
    `draftDomains`), and the `whereConditions` at `:226-228`.
14. Draft badges in `pages/DomainSelector.tsx:172` and `PageTree.tsx`.

**H-1 test cases**

- **Migration**: 37/0/0 across the three statuses, before and after.
- **No public change**: `/domain` lists the same 37 domains; a published domain's page still 200s.
- **The new gate works**: a throwaway `DRAFT` and `UPCOMING` domain — *with a page*, so a 404
  cannot be blamed on emptiness as in 24.2 — must 404, and a `PUBLISHED` control must 200.
- **Sitemap**: unchanged count today; excludes non-published once one exists.
- **Both columns stay in sync**: create + edit + the row action, then read `status` and
  `isPublished` back from the database and confirm they agree.
- **Admin**: filter by each of the three; badges render all three; dark mode.

#### H-2 — the public section

15. `npx shadcn@latest add sonner`; `<Toaster position="top-right" />` in the root layout.
    ⚠️ `sonner` needs `next-themes` to follow the app theme — **already installed** (`^0.4.6`).
16. `DomainService.getUpcoming(userCountry)` — same `orderBy` as the index query, so the admin
    keeps control of ordering, and the **same country filter**: a geo-hidden domain must not
    reappear via the upcoming list.
17. `src/app/domain/page.tsx` — a full-width section below the grid: heading "Upcoming Domains",
    the subheading, then the domains. Rendered **only when there is at least one** — an empty
    headed section is worse than no section.
18. A small client component for the item: a `<button>` styled like `DomainItem`, firing the
    toast. ⚠️ **The only client component on this page** — `domain/page.tsx` is an async server
    component, so the toast cannot live in it.

**H-2 test cases**

- With 0 upcoming domains the section does not render at all.
- Mark one `UPCOMING`: it appears **below** the grid, not inside it, and **not** in the 3-column
  grid rows.
- It is **not** a link — no `href`, and its detail page still 404s.
- It is **not** in the sidebar and **not** in the sitemap.
- Clicking fires one top-right toast; keyboard `Tab` + `Enter` does the same.
- A geo-restricted upcoming domain stays hidden from a non-matching country.
- Dark and light mode; the toast in both.

#### ⚠️ Production checklist for H-1 (see 24.4)

Neon branches are independent and **nothing runs migrations automatically**:

1. `migrate dev` on development → verify counts.
2. Commit migration files.
3. `migrate deploy` against **production** — *before* the code deploy.
4. Merge → Vercel deploys code that finds the column present.

Never `db push` (see #3).

---

### Phase I — Page status + "Upcoming Resources" (#25) — PLAN (agreed 6 Aug, starting)

Two commits, mirroring Phase H. **I-1 changes no public behaviour** — all 1,205 pages migrate to
`PUBLISHED`, so every filter added is a no-op on day one, which is what makes it testable.

| Step | Scope | Status |
| --- | --- | --- |
| **I-1** ✅ | Schema + migration + read filtering + access gate + admin | **DONE 6 Aug.** Migration needed **no backfill** — 1,205 rows landed on PUBLISHED from the column default alone. **23/23 tests pass.** Record below. |

##### ✅ I-1 DONE — 6 Aug 2026 (page status, filtering, the gate, the `__main__` guard)

**Migration `20260806144304_add_page_status` — a bare `ADD COLUMN`, and that is the point.**
`DEFAULT 'PUBLISHED'` gave all 1,205 existing rows the correct value on its own. Contrast
`add_domain_status`, where the generated SQL defaulted to DRAFT — wrong for existing data — and a
hand-written `CASE` backfill was the difference between working and blanking the homepage. The
default was chosen to make this true; see §25.2.

Verified: **1,205 PUBLISHED / 0 DRAFT / 0 UPCOMING.**

**Eight read paths filtered:** `getByPath`, `getByPathFallback` (both steps), `getChildPages`,
`getByDomain`, `getWithSections`, the three nested `pages:` selects in `domain.service.ts`, the
breadcrumb candidates query, and the sitemap's nested relation.

⚠️ **No separate 404 gate was needed in the route** — unlike H-1. Both `generateMetadata` and the
component resolve pages through `PageService.getByPath`, so filtering the service *is* the gate.
Checked rather than assumed, and a redundant guard was not added.

⚠️ **`getMainPage` is deliberately NOT filtered.** `__main__` is the domain root; its visibility
is already governed by `Domain.status`. If a hidden `__main__` somehow existed, filtering would
404 the whole domain (finding #11's failure mode) whereas not filtering renders a page that could
not legitimately have been hidden. The API guard is what keeps that state unreachable.

###### ⚠️ A TEST THAT PASSED FOR THE WRONG REASON — caught by one assertion

Test 7 asserted that hiding a `__main__` page returns 400. It did. But the follow-up assertion
"the message explains why" **failed** — and that failure was the useful one: the 400 was coming
from `validatePageUpdateData`'s slug regex `/^[a-z0-9-]+$/`, which rejects `__main__` for its
underscores. **The guard was never reached.** Three assertions around it were passing on the
strength of an unrelated rejection.

Fixed by moving the guard **above** the generic validation, so it fires first and returns an
actionable message. Re-verified: 23/23.

**Lesson: "it returned the right status code" is not evidence that the right code ran.** Assert
on the message, not only the status.

###### ⚠️ THREE FIXES AFTER THE USER TESTED THE UI — two bugs, one with a shared root cause

**1 + 2. The status showed "Live" on a DRAFT page, AND no badge ever appeared in the tree.**
Reported as two problems; they were one.

`buildPageHierarchy` in `PagesManager.tsx` rebuilds every page from an **explicit field list**,
and `status` was not in it. The API returned it correctly — this transform threw it away. So:

- `PageForm` read `editingPage.status` as `undefined` and fell back to `PUBLISHED`, showing
  "Live" for a drafted page. **Saving it would then have published it** — a destructive result
  from opening a form and pressing save.
- `PageTree`'s badge is gated on `page.status && …`, never truthy, so no badge rendered — which
  looked like the badge had not been built at all.

⚠️ **A rebuild-by-field-list cannot complain about a field it was never told about.** It just
returns less than it was given, silently. Same family as the hand-written status list in
`DomainFilters` (#24). **Whenever a new column has to reach the client, check for a transform
between the API and the component.**

**3. Editing a second page left the first page's data in the form.** `PageForm` seeds its state
from `editingPage`, and a `useState` initializer runs once — on mount. With the form rendered
inline it stayed mounted, so switching rows changed the prop and nothing else. This is the third
time this exact trap has appeared (`CategoryForm`'s `?column=`, `DomainFilters`, now here).

Fixed two ways, deliberately: the form is now a `Dialog` (content unmounts on close), **and** it
carries `key={editingPage?.id ?? 'new'}` so a remount is forced even if it is ever inlined again.

⚠️ **The inline-vs-dialog comment in that file argued the opposite and was wrong.** It claimed
the tree behind the form was "the context for what you are typing" — but the parent is chosen
from a dropdown *inside* the form, not by clicking the tree, and the form sat above a list dozens
of rows long, so editing anything far down meant scrolling away from it. The old reasoning is
quoted in place rather than deleted.

**Verified:** the admin list API carries `status` for all 74 pages of the test domain, and a
page created as DRAFT reads back as DRAFT. ⚠️ The transform fix itself is **client-side and was
not exercised headlessly** — the badge and the form default need a browser.

###### ⚠️ PRE-EXISTING BUG FOUND (not caused by I-1, not fixed here)

That slug regex means **a `__main__` page cannot be edited through the admin at all.** `PageTree`
offers "Edit page" on `__main__` rows, `PageForm` opens, and every save returns *"Slug must
contain only lowercase letters, numbers, and hyphens"* — because the slug it is submitting is the
one the app itself created. It is the dead-control pattern again: an action that can never
succeed. Reported, not fixed — out of scope for this step.

###### TEST CASES — 23/23 passed against `next build && next start`

| # | Case | Result |
| --- | --- | --- |
| 1 | No public change from the migration | 1,205 PUBLISHED; `/domain` and a domain root 200 |
| 2 | **Control** — child page reachable while PUBLISHED | 200, and listed in its section |
| 3 | Same page → DRAFT | **404**; gone from its section; parent still 200 |
| 4 | Same page → UPCOMING | **404** |
| 5 | Excluded from the sitemap | absent |
| 6 | Back to PUBLISHED | 200 again |
| 7 | `__main__` cannot be hidden | **400** with the right message; still PUBLISHED; domain root 200 |
| 8 | Invalid status | **400**, not 500 |
| 9 | Drafted **parent** hides its subtree | grandchild 200 → **404** → 200 |

`tsc` clean, build clean, database restored to 1,205 PUBLISHED with no hidden `__main__` pages.
| **I-2** ✅ | "Upcoming Resources" on `SectionBasedLayout` | **DONE 6 Aug.** `UpcomingDomainList` generalised into a shared `UpcomingList` serving both blocks. **18/18 tests pass.** Record below. |

##### ✅ I-2 DONE — 6 Aug 2026 ("Upcoming Resources" on section-based pages)

**One new service method, one component generalised, one block rendered.**

`PageService.getUpcomingChildPages` mirrors `getChildPages` exactly except for the status — same
country filter, same ordering, same select. Two slices of one shelf; they must not drift apart in
who can see them or how they sort.

⚠️ **`UpcomingDomainList` was REPLACED by a shared `UpcomingList`, not copied.** The page version
needed byte-identical markup, layout and toast behaviour — the only real differences were the
noun in the toast and where the data came from. A copy would have meant two files drifting on
spacing, colour and wording the moment either was touched. The component now takes a `noun`
prop ("Domain" / "Resource"): **one word, not a whole sentence**, so the sentence itself stays in
one place.

⚠️ **`upcomingChildPages` is a separate prop, not a filter over `childPages`.** `getChildPages`
is PUBLISHED-only by design, so upcoming rows are not in it and could not be recovered from it.
Keeping them apart is also what removes them from their configured section for free:
`organizeSectionsIntoRows` resolves each `pageId` against `childPages` and drops what it cannot
find.

The block renders **only when non-empty** — most of the 42 section-based pages will have nothing
upcoming, and those must look exactly as they do today.

###### TEST CASES — 18/18 passed against `next build && next start`

| # | Case | Result |
| --- | --- | --- |
| 1 | No block when nothing is upcoming | heading absent; sections unaffected |
| 2 | Mark a child UPCOMING | heading appears; the page is named |
| 3 | Rendered as a `<button>`, not a link | no `href` to its URL; block contains a `<button` |
| 4 | Still hidden elsewhere | its page 404s; absent from the sitemap |
| 5 | **Left its section — not shown twice** | absent from the markup above the block |
| 6 | Geo-restricted upcoming page | shown to `US`, hidden from `IN` |
| 7 | Back to PUBLISHED | block gone; back in its section; page 200s |
| 8 | Regression on the shared component | `/domain`'s "Upcoming Domains" block still renders |

Test 5 is the one worth keeping: without it, a page could appear in both its section and the
upcoming block and every other assertion would still pass.

###### ⚠️ FOUR REAL CONTENT PAGES ARE HIDDEN ON THE DEVELOPMENT BRANCH

Surfaced by the post-test count, which read `DRAFT=6 UPCOMING=2` when a clean tree would read
`PUBLISHED=1210`. `strays 0` confirmed none were left by the tests. Checking `createdAt`
separated them:

| Page | Status | Created |
| --- | --- | --- |
| `gdesign/podcasts` — 🎙️ Podcasts | DRAFT | **Sep 2025** |
| `gdesign/definingservices` — 📜 Defining Services \| Pricing | UPCOMING | **Sep 2025** |
| `gdesign/findingclients` — 🏆 Finding & Acquiring Clients | DRAFT | **Sep 2025** |
| `webdev/ytube` — ▶️ YouTube Channels | DRAFT | **Sep 2025** |
| `test-gdesign`, `test22`, `test33`, `test-draf` | mixed | 6 Aug 2026 |

The first four are **original content** whose status was changed during manual testing —
`createdAt` does not move, which is what made them identifiable. The last four are throwaways.

**Production is unaffected**: the migration sets every page there to PUBLISHED. But development
no longer mirrors production, which matters the next time it is used to judge whether something
is missing. Restore with a status change per page, or:

```sql
UPDATE "Page" SET status = 'PUBLISHED'
WHERE slug IN ('podcasts','definingservices','findingclients','ytube');
```

⚠️ **A count that does not match is worth chasing, not rounding off.** `1210` against an expected
`1205` was the thread that led here.

#### I-1 — schema, filtering, gate, admin

1. `enum PageStatus { DRAFT PUBLISHED UPCOMING }`; `status PageStatus @default(PUBLISHED)`.
2. Migration: `ADD COLUMN` only. ⚠️ **No backfill needed** — see 25.2.
3. ⚠️ **Verify before continuing:** 1,205 `PUBLISHED`, 0 `DRAFT`, 0 `UPCOMING`.
4. `PageService` — `getChildPages`, `getByPath`, `getByPathFallback`, `getMainPage`,
   `getByDomain` filter on `status: 'PUBLISHED'`.
5. `domain.service.ts` — the three nested `pages:` selects (sidebar and domain-with-pages).
6. `navigation.service.ts:580` — the path-resolution candidates query.
7. `sitemap.ts` — the nested `pages` where-clause (25.3).
8. `domain/[...slug]/page.tsx` — 404 a non-published page, in the component **and**
   `generateMetadata`, for the same reason as H-1.
9. `api/admin/pages/route.ts` + `[id]/route.ts` — accept, validate and write `status`;
   ⚠️ **reject any non-published status on a `__main__` page** (25.5).
10. `PageForm` — status `Select`, hidden for `__main__`. `PageTree` — status badge.

**I-1 test cases**

- Migration: 1,205 / 0 / 0.
- No public change: `/domain` and a domain root still 200; page counts unchanged.
- The gate: a throwaway child page set to DRAFT and to UPCOMING must 404, with a **PUBLISHED
  control that 200s** — the H-1 lesson, a negative needs a positive beside it.
- A non-published child disappears from its section, and the section still renders.
- `__main__` cannot be set non-published (API returns an error; domain root still 200).
- A drafted parent 404s its children too.
- Sitemap excludes non-published pages.
- Admin: badge and filter show all three; dark mode.

#### I-2 — the public section

11. `PageService.getUpcomingChildPages(domainId, parentId, userCountry)` — same country filter
    and ordering as `getChildPages`.
12. Generalise `UpcomingDomainList` into a shared `UpcomingList` — markup and toast are
    identical, so this is reuse rather than a second component.
13. `SectionBasedLayout` — "Upcoming Resources" below the section grid, rendered **only when
    non-empty**.

**I-2 test cases** — section renders/does not render, items are buttons not links, absent from
sitemap and sidebar, pages 404, geo-restricted upcoming page hidden from other countries.

#### ⚠️ Production checklist (same as #24.4)

`migrate deploy` against **production before** the code deploy; nothing runs migrations
automatically. Never `db push` (#3).

---

### Phase J — Icons for Domains and Pages (#27) — PLAN (agreed 9 Aug, not started)

Four steps. **J-1 and J-2 change nothing a visitor sees** — the field exists and the admin can set
it, but no public surface reads it until J-3. That ordering is deliberate: it means the schema and
the picker can be verified in isolation before anything on the live site moves.

| Step | Scope | Public effect | Status |
| --- | --- | --- | --- |
| **J-1** ✅ | Schema, migration, folder, manifest generation, cache headers, size check | none | **DONE 9 Aug.** Migration needed no backfill; all 41 domains and 1,216 pages null. Size guard and cache headers both verified **with controls**. Record below. |

##### ✅ J-1 DONE — 9 Aug 2026 (schema, storage, build plumbing)

**Migration `20260809123945_add_icons` — two nullable columns, no default, no backfill.**

Third migration in three phases, and each needed something different — worth keeping together:

| Migration | Default | Backfill |
| --- | --- | --- |
| `add_domain_status` | `DRAFT` — **wrong** for existing rows | ⚠️ hand-written `CASE`; without it the homepage would have blanked |
| `add_page_status` | `PUBLISHED` — **right** for existing rows | none needed |
| `add_icons` | none — **NULL is the meaningful value** | none possible |

Here NULL means "fall back to the emoji already in the name", which is true of every existing
row. Verified: **41/41 domains and 1,216/1,216 pages null**, nothing else changed.

**The size ceiling is enforced, not documented.** `scripts/generate-icon-manifest.mjs` exits
non-zero if any SVG exceeds 10 KB. ⚠️ **Tested by making it fail**, not only by watching it pass —
a 11.8 KB file stopped the build with a message naming the file and the limit. A guard that has
only been seen succeeding has not been tested.

**Cache headers verified with a control.** `/icons/*.svg` returns
`public, max-age=31536000, immutable`, and `og-image.png` returns `max-age=0` — proving the rule
is scoped to `/icons/` rather than blanketing all of `public/`. Without this, Vercel's default
`max-age=0, must-revalidate` would have cost a round trip per icon per page load (§27.5.2), which
would have quietly undone the main reason for choosing same-origin files.

⚠️ **`predev` as well as `prebuild`.** `prebuild` only runs before `npm run build`, so adding an
icon and running `npm run dev` would not have regenerated the manifest — the new icon simply
would not appear in the picker, with no error. Both hooks now run the generator.

⚠️ **The manifest is committed despite being generated.** `npm run dev` on a fresh clone would
otherwise fail on a missing import before `predev` had ever run. It carries a
DO-NOT-EDIT header, and both hooks keep it honest.

**Deleted:** `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` — Next.js
starter leftovers. Verified referenced by **0 files** before removing; the three real assets
(`og-image.png`, `icon-dark.png`, `icon-light.png`) are referenced and untouched.

**J-1 verification**

| Check | Result |
| --- | --- |
| Migration | 41/41 domains, 1,216/1,216 pages `icon IS NULL` |
| Empty folder | manifest generates as `[]`, build succeeds |
| Valid icon | appears in the manifest with id, url, label, bytes |
| **Oversized icon** | **build fails, exit 1**, names the file and limit |
| `/icons/*.svg` headers | `immutable, max-age=31536000` |
| **Control** — `og-image.png` | `max-age=0` — rule correctly scoped |
| Public pages | `/domain` 200, `/sitemap.xml` 200, unchanged |
| `tsc` / build | clean |

**`public/icons/` is empty** — the real SVGs are the user's to add. J-2's picker will have
nothing to show until at least one is committed.
| **J-2** ✅ | Admin: icon picker on the domain and page forms; icon in the tables | none | **DONE 9 Aug.** 18/18 tests pass, including the I-1 trap. Record below. |

##### ✅ J-2 DONE — 9 Aug 2026 (the admin picker)

**One new component, both forms, four API routes, both admin tables.**

`IconPicker` is a `Popover` + `Command` combobox reading `ICON_MANIFEST`, so its list is the
folder — it cannot drift from the files that exist. Search matches the id as well as the label,
so "chrome" finds *Google Chrome Extension*, and each row shows the icon, its name and its file
size (the 10 KB limit is easy to forget, and this is where an anomaly would be noticed before it
is committed).

⚠️ **Clearing is a first-class action.** `null` is a meaningful value — "fall back to the emoji
in the name" — and is the state of all 41 domains and 1,216 pages. A picker that could only ever
*set* an icon would make the default unreachable once left.

⚠️ **An id that is set but unknown is displayed, not hidden.** If an SVG is deleted while rows
still reference it, falling back to the placeholder would look identical to "no icon" and the
broken reference would sit there indefinitely. The trigger names the missing id instead.

**Validation is against the manifest, not just the type.** The value lands in an `src`
attribute, so `isValidIconId()` guards all four routes — an unrecognised id is a **400 naming
`public/icons/`**, not a broken image with no error. Same reasoning as the status enums.

⚠️ **`icon: body.icon !== undefined ? … : existing`, NOT `??`.** On update, `null` means
"remove the icon" and must be distinguishable from the field being absent. A `??` would treat a
deliberate clear as "unchanged" and the Remove button would silently do nothing. Tested both
ways — clearing works, and a legacy client omitting the field leaves the value alone.

###### ⚠️ The I-1 trap, closed deliberately this time

`buildPageHierarchy` in `PagesManager` rebuilds every page from an **explicit field list**. In
I-1 it silently dropped `status`, which produced two symptoms — the form defaulting wrongly and
the tree badge never rendering — with no error anywhere, because a rebuild-by-field-list cannot
complain about a field it was never told about.

`icon` was added there in the same change as the API, and **test 7 asserts on the payload the
client actually receives**, not on the database row. A test that stopped at the database would
have passed while the admin screens showed nothing.

###### TEST CASES — 18/18 against `next build && next start`

| # | Case | Result |
| --- | --- | --- |
| 1 | Manifest matches the folder | 9 SVGs, 9 entries |
| 2 | Set an icon on a domain | 200, stored |
| 3 | Comes back through the list API | field present, correct value |
| 4 | **Unknown icon id** | **400**, message names `public/icons/`, value unchanged |
| 5 | Clearing to `null` | 200, cleared |
| 6 | **Field omitted entirely** | icon **preserved**, not wiped |
| 7 | Page icon → **reaches the client payload** | `linkedin` — the I-1 trap, closed |
| 8 | Public pages untouched | `/domain` 200, no icon markup yet (J-3) |

Database restored: 0 domains and 0 pages carry an icon.

###### ⚠️ THE SAME BUG CLASS, A THIRD TIME — found by the user, and I checked the wrong file

**Symptom:** setting an icon on a domain worked — it saved, it rendered beside the name in the
table, it was in the database — but **reopening the edit dialog showed no icon**. Pages were
fine.

**Cause:** `DomainsTable` builds the object it hands to `DomainForm` as an **explicit literal**:

```tsx
domain={{ id: …, name: …, slug: …, status: domainToEdit.status, /* icon missing */ }}
```

A field the literal does not name never reaches the form. Nothing errors. And it fails in the
single place that looks most like "it did not save".

`PagesManager` was unaffected because it passes the whole object — `editingPage={editingPage}`.
**Spreading, or passing the object, is the shape that cannot rot.**

⚠️ **This is the third instance, and I had written the warning myself.** The Phase J plan says
in bold that a rebuild-by-field-list would silently drop `icon` "exactly as it dropped `status`
in I-1" — but it named `buildPageHierarchy`, so that is the one I guarded. **I looked at the file
I had written down instead of asking where else the pattern occurs.** Naming one instance of a
recurring bug reads as a complete list and is not one.

**Swept properly afterwards**, rather than fixing the reported case alone: every site copying
`.status` off a row object was listed and checked for a paired `.icon` copy. **All 12 now have
one**, across 6 files. That is the check that should have run when the pattern was first
identified.

###### Housekeeping on the user's nine icons

- ⚠️ `googlechromextension.svg` → **`google-chrome-extension.svg`** — the original was missing an
  `e` and used no hyphens. Renamed while **no row referenced it**; once icons are in use a
  rename means re-pointing every row that uses it.
- `LABEL_OVERRIDES` populated for **GitHub, LinkedIn, TED, YouTube** — the auto-generated labels
  read *Github*, *Linkedin*, *Ted*, *Youtube*. No rule recovers a brand's capitalisation from a
  lowercase filename, which is why the override map exists.
- All nine are within budget: largest **3.1 KB**, total **11.2 KB**.
| **J-3** ✅ | Public rendering across all **eight** surfaces | **visible** | **DONE 9 Aug.** 20/20 tests pass. ⚠️ The plan said seven; there were eight. Record below. |

##### ✅ J-3 DONE — 9 Aug 2026 (public rendering)

**One shared component, eight surfaces, eleven field lists.**

`ItemIcon` renders the icon or **nothing** — never a placeholder. That single decision is what
makes every call site a one-liner with no branching: a row without an icon lays out exactly as it
did before, which matters because that is ~1,190 of 1,216 pages and 39 of 41 domains.

⚠️ **Not `next/image`, deliberately.** It exists to resize and re-encode raster images; an SVG has
no pixels to resize, and these are same-origin files already served `immutable`. The
layout-shift protection people reach for it to get comes from explicit `width`/`height`, which
this has — verified in the rendered HTML.

⚠️ **`alt=""` is correct, not an omission.** The icon sits immediately beside the name it belongs
to, so alt text would make a screen reader say "YouTube YouTube Channels". Empty alt marks it
decorative, which is what it is here.

###### ⚠️ FOUND BY THE USER IN TESTING — THE PLAN SAID SEVEN. THERE WERE TEN.

Reported as "strange, maybe a Next.js cache issue". It was not caching. Three separate causes,
two of them omissions in the plan:

**1. `PageHeading` had no icon parameter at all.** It accepts `title` and nothing else, and it
renders the `<h1>` for **every content page** — section layout, subcategory list, table, rich
text, narrative. The plan listed it as *"optional: a larger icon beside the page `<h1>`"* and it
was skipped. That single gap accounted for most of what the user saw: Web Development, LinkedIn
Groups, Trading & Investing and every rich-text heading showed no icon because the component
could not render one. **Surface nine.**

**2. ⚠️ A DIRECT DOMAIN'S ROOT `<h1>` WAS READING THE `__main__` PAGE, NOT THE DOMAIN.**

`SectionBasedLayout` computed `title = page?.title || domain.name`, and for a domain root `page`
*is* the `__main__` page. The two rows drift apart immediately:

```
Domain    name  = "Graphic Designing"          icon = facebook
__main__  title = "🖌️ Graphic Designing"        icon = null
```

So removing the emoji from the domain and giving it an icon changed nothing on that domain's own
page — the heading was reading a different row. **Editing the thing the URL names had no effect
on the thing the URL renders.**

Fixed by preferring the domain for a root heading. `__main__`'s title was never chosen by anyone:
it is copied from the domain name when the row is auto-created and never updated again. The
domain is what `/domain/<slug>` identifies, so the domain is what it should name. A *nested*
section-based page still names itself, which is correct.

**3. Breadcrumbs** use `page.title` verbatim (`navigation.service.ts:633`), so an emoji left in a
title shows there. **Surface ten** — left text-only by decision: crumbs are small and dense, and
an icon per crumb reads as noise.

###### ✅ #26 FIXED HERE — it stopped being cosmetic

The `__main__` slug bug was recorded as deferred. Fix 2 above made it urgent: `__main__`'s title
is visible as the `<h1>` of every direct domain, and **the row could not be saved at all**.

Applied the **A + B** option from §26.4:

- **API** — `__main__` is exempt from the slug *format* rule, and a separate guard refuses any
  attempt to *change* its slug. The exemption alone would have been a loophole; the guard is what
  closes it. Its message names the real constraint instead of complaining about underscores.
- **Form** — the slug field is `disabled` for `__main__`, with a line explaining that it is
  structural. B alone was cosmetic (a direct API call still failed); A alone left an editable
  field that had to be policed.

⚠️ The POST validator is deliberately **not** exempted — that keeps `__main__` from being created
through the pages API, where a second one would break the domain's URL model.

###### ⚠️ #26 WAS FIXED ON THE SERVER AND STILL BROKEN ON THE SCREEN

Reported immediately after: the slug field was correctly greyed out, but **editing a `__main__`
page's TITLE still failed** with *"Slug must contain only lowercase letters, numbers, and
hyphens"* — a complaint about a field the admin could no longer even edit.

`PageForm` carries its **own client-side copy** of the slug rule (`validateForm`) for fast
feedback. Only the API's copy was exempted, so the form rejected the value and **never sent the
request at all**.

⚠️ **The server suite passed 15/15 while the screen it exists for did not.** It drove the API
directly — which is what makes it reliable for cache-invalidation questions — and that is exactly
what let it miss a client-side guard sitting in front of the endpoint.

**Generalisable: when a rule is mirrored on both sides for UX reasons, exempting one side fixes
nothing the user can see.** Search for the *message*, not the endpoint — one `grep` for the error
string listed both copies together, and would have found them the first time.

Checked while fixing: `DomainForm` and `CategoryForm` carry the same mirrored rule, but neither
model has a `__main__` concept — their slugs are entirely user-chosen — so no exemption belongs
there.

###### Verification of these four fixes — 15/15

| Case | Result |
| --- | --- |
| `__main__` page saves | **200** — was 400 on every save |
| `__main__` slug rename | **400**, message names the constraint; slug unchanged |
| Direct domain root `<h1>` | shows the **domain** name + icon; no `__main__` emoji |
| Hierarchical domain root `<h1>` | shows name + icon |
| Table page `<h1>` | shows title + icon |
| **Regression** — no icon set | name renders, **no `<img>` in the heading** |

###### ⚠️ THE PLAN SAID SEVEN SURFACES. THERE WERE EIGHT.

`PageSidebar.tsx` — the page-level sidebar — also renders page titles, and was missed when the
surfaces were enumerated. Left out, the main sidebar would have shown icons while the page
sidebar did not, on the same screen. Found by grepping for title renders rather than by trusting
the list in the plan.

###### ⚠️ THE FIELD-LIST TRAP, FOURTH AND FIFTH INSTANCES

`navigation.service.ts` builds its sidebar payloads as **explicit literals**, and `icon` is
**optional** on those types — so omitting it compiled cleanly and the sidebar would simply have
shown nothing. **`tsc` cannot catch this**, which is precisely why it keeps happening.

Contrast the two errors `tsc` *did* raise, on `SidebarDomain` in `services/types.ts`: that type
declares its fields exactly, so an excess property was rejected. **The difference between the
silent case and the caught case is whether the field is optional** — worth knowing when adding
the next column.

Fixed by sweeping: every literal in that file copying a page title or domain name, then every
`select:` in the services. **Eleven field lists in total.**

⚠️ One over-reach caught in the same sweep: a regex adding `icon` wherever `title: true` appeared
put it inside the `richTextContent` select, where `RichTextContent` has no such column. **A
mechanical sweep keyed on a field name will follow that name into models that merely share it.**

###### ⚠️ THE H-2 CACHE LESSON, REPEATED BY ME

The first run of the J-3 tests reported two failures. Both were the test's fault: it mutated with
`prisma.domain.update` directly, bypassing `invalidateDomains()`, so the `unstable_cache` entries
kept serving the pre-write answer and the pages faithfully rendered what they were given. **This
is documented verbatim in the H-2 record and I did it again.** Rewritten to mutate through the
admin API, which is what an admin does anyway.

A second failure was a **brittle assertion, not a bug**: it compared the icon count after
clearing a row against a baseline measured *while that row still had an icon*. Replaced with an
assertion about what the regression actually is — the icon we set is gone, other rows keep
theirs, names still render.

###### TEST CASES — 20/20 against `next build && next start`

| # | Case | Result |
| --- | --- | --- |
| 1 | Baseline | `/domain` renders |
| 2 | Domain icon on the index | renders, with explicit `width`/`height` and `alt=""` |
| 3 | Page icon in its section block | renders; title unaffected |
| 4 | Sidebar payload | `/api/page-context` carries the field and the value |
| 5 | Unknown icon id | API refuses with **400**; nothing renders |
| 6 | **Regression — rows with no icon** | unchanged; no stray empty `<img>` |
| 7 | Caching | `/icons/*.svg` returns `immutable` |

Database restored: the 2 domains and 5 pages that carried icons before still do.
| **J-4** | Uploads from the admin panel | — | **deferred (#27.8)** |

---

#### J-1 — schema, storage, and the build-time plumbing

**ADD**

| File | Purpose |
| --- | --- |
| `public/icons/` | The SVGs themselves. Committed. |
| `public/icons/README.md` | The rules: SVG, ≤10 KB, lowercase-hyphen filenames, changing an icon means a NEW filename (§27.5.2) |
| `scripts/generate-icon-manifest.mjs` | Globs `public/icons/*.svg`, writes the manifest, **fails the build** if any file exceeds 10 KB |
| `src/lib/icon-manifest.ts` | **Generated — do not hand-edit.** `[{ id, url, label }]` for the picker |
| `prisma/migrations/<ts>_add_icons/` | The migration |

**CHANGE**

| File | Change |
| --- | --- |
| `prisma/schema.prisma` | `Domain.icon String?`, `Page.icon String?`. ⚠️ Nullable with **no default** — null means "fall back to the emoji in the name", which is every existing row. So the migration is a bare `ADD COLUMN` with **no backfill**, like `add_page_status` and unlike `add_domain_status`. |
| `next.config.ts` | `headers()` → `/icons/:path*` gets `public, max-age=31536000, immutable` (§27.5.2) |
| `package.json` | `"prebuild": "node scripts/generate-icon-manifest.mjs"` so the manifest can never be stale |

**DELETE**

| File | Why |
| --- | --- |
| `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` | Next.js starter-template leftovers, referenced by nothing |

**J-1 verification**
- Migration applied; `Domain.icon` and `Page.icon` null on all 41 / 1,216 rows.
- `/domain` and a domain root still 200, byte-identical output.
- Manifest lists exactly the files present; add one, rebuild, it appears.
- Drop an 11 KB file in → **the build fails**. (Test the guard, not just the happy path.)
- `curl -I` a `/icons/*.svg` on the built server → `immutable` present.

---

#### J-2 — the admin picker

**ADD**

| File | Purpose |
| --- | --- |
| `src/components/admin/IconPicker.tsx` | Searchable `Popover` + `Command` (the pattern already used by `DomainSelector` and the sections picker), showing each icon rendered at 20 px beside its label, plus a **Clear** option for "use the emoji" |

**CHANGE**

| File | Change |
| --- | --- |
| `src/components/admin/domains/DomainForm.tsx` | Icon field; `icon` into `formData` and the submit body |
| `src/components/admin/pages/PageForm.tsx` | Same |
| `src/app/api/admin/domains/route.ts` + `[id]/route.ts` | Accept, validate and persist `icon`; return it |
| `src/app/api/admin/pages/route.ts` + `[id]/route.ts` | Same |
| `src/app/admin/domains/page.tsx` | `icon` into the query `select` and the row transform |
| `src/app/admin/pages/page.tsx` | `icon` into the `select` |
| `src/components/admin/domains/DomainsTable.tsx` | `icon` on the row type; render it in the name cell |
| `src/components/admin/pages/PageTree.tsx` | Same |
| `src/components/admin/pages/PagesManager.tsx` | ⚠️ **`buildPageHierarchy` — see the warning below** |

⚠️ **`PagesManager.buildPageHierarchy` rebuilds every page from an explicit field list and will
silently drop `icon` exactly as it dropped `status` in I-1.** That bug cost two symptoms (the form
defaulting wrongly and the badge never rendering) and was invisible because nothing errors — the
transform just returns less than it was given. **Add `icon` there in the same commit as the API
change, and check it end-to-end, not by reading the code.**

⚠️ **Validation must reject an unknown icon id.** The value comes from a form and lands in a `src`
attribute. Check it against the generated manifest server-side, exactly as `isDomainStatus` guards
the status enum — otherwise a typo produces a broken image with no error anywhere.

**J-2 verification**
- Set an icon on a domain and a page; reload the form — it shows the icon that was saved, not the
  default. (The I-1 failure mode.)
- Clear it → back to null, emoji still renders.
- Admin tables show the icon.
- Post an invalid id via the API → **400**, not a broken image.
- Public pages still unchanged at this point.

---

#### J-3 — public rendering

**ADD**

| File | Purpose |
| --- | --- |
| `src/components/domain/ItemIcon.tsx` | One component used by every surface below: renders the icon at a given size, or nothing when null. Keeps sizing, alt text and spacing in a single place — the `UpcomingList` lesson from I-2. |

**CHANGE — all seven surfaces where a domain name or page title is rendered**

| File | Line (today) | Surface |
| --- | --- | --- |
| `src/app/domain/page.tsx` | `DomainItem` | the `/domain` index |
| `src/components/domain/SectionBasedLayout.tsx` | `:219` | child links inside each section |
| `src/components/domain/SubcategorySelector.tsx` | `:147` | hierarchical domain roots + 74 `subcategory_list` pages |
| `src/components/domain/UpcomingList.tsx` | `:124` | **both** upcoming blocks |
| `src/components/sidebar/SidebarDomain.tsx` | `:56`, `:93` | a domain and its pages in the sidebar |
| `src/components/sidebar/SidebarPage.tsx` | `:31` | nested pages in the sidebar |
| `src/components/domain/PageHeading.tsx` | — | optional: a larger icon beside the page `<h1>` |

**CHANGE — the data plumbing that must carry `icon` to those surfaces**

| File | Change |
| --- | --- |
| `src/services/types.ts` | `icon` on `DomainBasic`, `PageBasic`, `ChildPage`, and the `Domain`/`Page` intersections |
| `src/services/domain.service.ts` | `icon` in `getDomainBySlugFromDB`'s `select` and the three nested `pages:` selects |
| `src/services/page.service.ts` | `icon` in `pageWithContentSelect`, `getChildPages`, `getUpcomingChildPages`, `getByDomain`, `getWithSections` |
| `src/services/navigation.service.ts` | `icon` through the sidebar payload |

⚠️ **Every one of those is an explicit field list.** The same class of omission as
`buildPageHierarchy`: miss one and that surface silently shows no icon while every other surface
works, which reads as "the icon did not save".

⚠️ **`next/image` is NOT used here.** It exists to resize and reformat raster images; an SVG has
no pixels to resize, and the optimiser would add a transform step for no gain. A plain `<img>`
with explicit `width`/`height` is correct — and the explicit dimensions are what prevent layout
shift, which is the reason `next/image` is usually reached for.

**J-3 verification**
- An icon set on a domain appears on `/domain`, in the sidebar, and on the domain's own page.
- An icon set on a page appears in its section, in the sidebar, and in the upcoming block if it
  is upcoming.
- A row with **no** icon renders exactly as it does today — this is the regression that matters,
  since it covers ~1,190 of 1,216 pages.
- Light and dark mode: a coloured logo must stay legible on both backgrounds.
- Page weight before/after on `/domain` and on a large domain root.
- `curl` a built page and count icon requests — should equal the number of **distinct** icons, not
  the number of rows.

---

#### J-4 — uploads from the admin panel (DEFERRED)

Not rejected — deferred on the reasoning in §27.5. Recorded so the trigger is explicit.

**Revisit when** adding an icon mid-content-editing becomes a real irritation, or someone other
than the repository owner needs to add one.

**What it would take:** a `MediaAsset` table; Vercel Blob; an upload route with auth, MIME
allow-list, a size limit and **SVG sanitising** (finding #2's reasoning applies the moment files
arrive over HTTP); upload progress and error states in the picker; orphan cleanup.

⚠️ **It requires no migration of existing icons.** Both approaches store a URL, so `/icons/x.svg`
and a blob URL coexist in the same column with no branching at any render site.

---

#### ✅ G-1 DONE — 30 Jul 2026

**1 new file, 3 rewritten. Zero new dependencies** — `sidebar`, `breadcrumb`, `separator`,
`dropdown-menu` and `avatar` were all already in `components/ui/`.

**Hardcoded colours in the shell: 74 → 0.** The ten a grep still finds are inside comments
quoting the classes that were removed. This is the argument for rebuilding rather than
colour-swapping: replacing hand-rolled markup **deletes** its colours instead of translating
each one.

##### `admin-nav.ts` — one config for nav *and* breadcrumb

The sidebar held `NAVIGATION_ITEMS` and the header held a separate `PAGE_INFO` map — two
hand-maintained lists of the same routes. **They had already drifted:**

- `PAGE_INFO` described **`/admin/editor`**, a route that does not exist.
- Its breadcrumbs inserted the sidebar's *group* name as a crumb — `Admin › Content › Tables` —
  implying an `/admin/content` page that has never existed. Crumbs now map to real routes only.

⚠️ `isAdminNavItemActive` special-cases `/admin` with an exact match. A `startsWith` test would
light Dashboard on **every** admin route, since they all begin with `/admin` — easy to
reintroduce when adding an item, so the reason is recorded at the function.

##### Decisions carried out

- **"Add New Admin" removed from the nav** — the only entry that was an *action*, not a place.
  Returns as a button on the Users screen in G-8.
- **Emoji → lucide.** Emoji cannot inherit `currentColor`, so they ignored the theme entirely —
  which matters now #21 has shipped.
- **Theme toggle in the sidebar footer**, reusing #21's `ThemeToggle`. Its provider is in the
  root layout, so this only gave it a home. Hidden on the collapsed rail rather than squeezed
  in, since it has its own sizing and would not align with icon-only rows.
- **Header reduced to breadcrumb + an actions slot.** It previously duplicated the `<h1>` every
  page already renders. `pageActions` is a prop rather than another route map, so the page that
  owns an action owns its button — a new screen cannot forget to register itself elsewhere.
- **Breadcrumb resolves record names** via `recordName`, so a detail route can read
  `Admin › Tables › Logo Makers` rather than exposing an id. Wired per-page from G-2 onward.

##### ⚠️ TEST CASES — run these before pushing

**A. All 13 screens still render** — every one HTTP 200.

**B. The nav** — all 8 destinations present; "Add New Admin" absent; the shadcn sidebar
primitive in use; "View site" present.

**C. Breadcrumbs** — dashboard shows a single `Admin` crumb (a second crumb to the same URL
would be noise); `/admin/tables` links back to `/admin`; `/admin/tables/new` ends in `New`; **no
bogus "Content" crumb**; the dead `/admin/editor` entry is gone.

**D. No hardcoded theme** — no `bg-gray-900`, no `bg-gray-50` shell, and `bg-sidebar`/
`--sidebar` tokens in use.

**E. Behaviour unchanged** — a real category create *and* delete driven over HTTP with a
session. A markup rewrite must not alter behaviour, so this is checked rather than assumed.

##### Not done here, deliberately

Page-level content is untouched — every screen still renders its own `<h1>`, its own
`bg-white` cards and its own hardcoded colours. Those belong to G-2…G-8. **Only the shell
changed**, which is what keeps this diff reviewable.

---

#### ✅ G-2 DONE — 30 Jul 2026 (Dashboard)

**1 new shared file, 5 rewritten. Hardcoded colours 89 → 19**, of which 11 are inside comments
quoting the removed classes — so **8 real ones remain**, all deliberate: the four health
statuses with explicit `dark:` pairs. A warning must read as a warning in both themes, which is
the same reasoning `DataTable` already uses.

New `AdminPageHeader` establishes the title/description/actions pattern for G-3…G-8. All 13
screens hand-rolled that block, so it was 13 chances for size, weight and spacing to drift.

##### ⚠️ Three real bugs found while rebuilding — none cosmetic

**1. The Recent Activity panel was showing fabricated data.**

`ActivityFeed` rendered a module-level `DEMO_ACTIVITIES` array — invented entries with invented
timestamps, presented exactly like real records. That is why the dashboard read *"Created
YouTube Channel page in Graphic Designing — 30 minutes ago"* when nothing of the sort had
happened. Its own comment said "replace with real data later".

It now queries `updatedAt` on `Domain`, `Page` and `Table`. ⚠️ The label says **"Updated"**, not
"Created" — `updatedAt` cannot distinguish the two, and guessing would repeat the original sin
in a subtler form. Those columns only exist because of **#3/5b**; before that migration this
panel could not have been built honestly, which is very likely why it shipped stubbed.

**2. A Quick Action pointed at a route that does not exist.**

`Edit Content → /admin/content` — a 404, the same class as the `/admin/editor` sidebar entry
found in G-1. Two others were dead weight: *View All Domains* went to `/admin/domains`, already
the destination of *Create New Domain*, and *System Overview* linked to `/admin` — the page you
are already on. Replaced with the three real routes that had no shortcut: tables, rich text and
section layout. **Six actions, six distinct working destinations.**

**3. "System Operational" was hardcoded.**

A green "All core systems are running smoothly" banner rendered unconditionally, directly above
a list that could be showing errors — so the panel could simultaneously claim health and report
critically low content coverage. The summary is now **derived from the worst item**. Two related
fixes: the "Quick Fixes" buttons had **no `onClick`** (dead controls, same pattern as #22.5) and
are now real links to the screen that fixes each problem; and a hardcoded "Performance Optimal"
row that measured nothing was removed, because reporting health you have not checked trains the
reader to ignore the panel.

##### Also removed

The "Welcome to Your Admin Dashboard! 👋" gradient banner. It used the most valuable space on
the screen to tell someone already signed in that the admin panel manages domains and pages —
a sentence never needed after the first visit — and its `from-blue-50 to-indigo-50` gradient was
hardcoded light. The stats now start at the top.

##### ⚠️ TEST CASES — run these before pushing

**A. Real statistics still shown** — domain (35), page (1,198) and category (7) counts all
present; welcome banner gone.

**B. Activity is real** — no `DEMO_ACTIVITIES` in the output, and the feed contains a genuinely
most-recently-updated record (verified against the database), labelled "Updated".

**C. Every dashboard link resolves** — all 12 `/admin/*` hrefs fetched; **0 broken**. No
`/admin/content`. This is the check that would have caught the original bug.

**D. Health summary is derived** — with 0 unpublished domains it reads "All checks passing";
the hardcoded "System Operational" string is gone.

**E. Regression** — the other 7 admin screens still return 200.

#### ✅ G-3a DONE — 30 Jul 2026 (Domains — page container)

`/admin/domains` was split into two commits because the page shell and the table are
independent: **G-3a** the container, **G-3b** the table. `DomainForm` and `DomainFilters`
remain untouched — those are **G-3c**.

**Hardcoded colours in `page.tsx`: 53 → 1.**

- **`DomainForm` moved into a dialog** (`NewDomainDialog.tsx`, new). It used to sit permanently
  expanded above the list, taking most of the first screen before any of the 35 domains was
  reachable — inverting how the page is used (creating is occasional, *looking* is constant).
  A thin client wrapper, so the page itself stays a Server Component.
- **Four stat panels → three `StatsCard`s** (reused from G-2). Published and Draft are
  complements of Total — three numbers carrying two facts. The freed tile shows how many rows
  the **current filters** return, which the page never surfaced despite having filters.
- **Two dead buttons removed** — "📥 Export" and "🔄 Bulk Actions", neither with an `onClick`
  nor a link (the #22.5 pattern). "Bulk Actions" was the worse of the two: it implies row
  selection that exists nowhere in this table.
- **Gradient intro banner removed** — described the screen you are already on, and its
  `from-green-50 to-emerald-50` was hardcoded light.
- **Tips box → `Collapsible defaultOpen={false}`** (per request) — advice you read once and
  then scroll past forever.
- **⚠️ A stray `Roboto` Google-Fonts import removed.** This one screen loaded a second webfont
  and applied it to individual headings, fighting the app-wide Geist. No other admin page does
  this. *Still imported in 6 other places* — the sweep is outstanding.

##### ⚠️ Horizontal-scrollbar fix (`AdminLayout`) — one line, easy to reintroduce

The rebuilt page scrolled **the whole document** sideways, dragging the header and sidebar out
of view and clipping the "New domain" button.

`SidebarInset` renders as `flex w-full flex-1 flex-col` with **no `min-w-0`**. As a flex *item*
beside the sidebar, its default `min-width: auto` refuses to shrink below its content's
intrinsic width — and `DomainFilters` carries a `min-w-48` column plus two `min-w-32` ones.

Fixed by passing `className="min-w-0"` **from `AdminLayout`**, not by editing
`components/ui/sidebar.tsx` — a vendored primitive `shadcn add sidebar` would silently revert.

⚠️ **Two levels need it**: the inset (stops it growing inside the sidebar row) *and* the inner
content column (stops that growing inside the inset). Remove either and the scrollbar returns.

#### ✅ G-3b DONE — 31 Jul 2026 (Domains — the table)

**Hardcoded colours: 64 → 0** (the ones a grep still finds are comments quoting what was
removed). **1 new dependency:** `alert-dialog`, which pulled in the unified `radix-ui` package
— it is the only vendored component using that import style; the rest use `@radix-ui/react-*`.
`button.tsx` was offered for overwrite during install and **declined**.

##### ⚠️ FOUR REAL BUGS, not styling

**1. The publish/unpublish button did nothing whatsoever.** The handler was, in full:

```tsx
onPublishToggle={() => setPublishingDomain(domain.id)}
```

No network request — and nothing ever cleared the flag, so clicking it swapped the icon to an
hourglass **permanently** and never changed the domain. Meanwhile
`PATCH /api/admin/domains/[id]` already accepted `{ isPublished }`, already worked, and already
called `invalidateDomains()` to bust the public cache. **The endpoint was fine; the button was
never wired to it.** This is the concrete shape of the complaint recorded under #20 — "I
change things and it doesn't show up in the Admin UI".

**2. Both modal backdrops rendered SOLID BLACK.** They used
`className="fixed inset-0 bg-black bg-opacity-50"`, but **`bg-opacity-*` is Tailwind v3 syntax
and was removed in v4** — which is what this project runs. An unknown utility is silently
dropped, so only `bg-black` survived and the "translucent" overlay blacked out the entire page.
Radix's own overlay uses `bg-black/50` (v4 slash-opacity), so this cannot recur here.
**⚠️ `CategoryList.tsx` has the identical bug — still live, lands in G-6.**

**3. Delete cascaded without saying how far.** `DELETE /api/admin/domains/[id]` runs a
transaction deleting every ContentBlock → every Page → the Domain, with **no guard on page
count**. The old dialog said pages "will also be deleted" but never said that "Graphic
Designing" means **70 of them**, one click from a red button, with no undo anywhere in this app
(no soft delete, no trash, no revision history). It now states the exact count and requires
typing an identifier.

**4. Two no-ops:** a `⋯` "More actions" button with no `onClick` (just a `TODO`), and `w-mx` on
the delete modal — not a real Tailwind class.

##### ⚠️ Type-to-confirm uses the SLUG, not the name — because of the real data

34 of the 35 domain names **start with an emoji**: `"🖌️ Graphic Designing"`,
`"🍄 Social Media Marketing"`. You cannot type those, and `🖌️` is two code points
(U+1F58C U+FE0F), so even copy-paste is fragile — a paste that drops the variation selector
compares unequal and the button stays dead with no explanation. The slug (`gdesign`) is ASCII,
short, already visible in the row, and is what the public URL is built from. Match is
case-**in**sensitive, since slugs are lowercase by construction.

An **empty** domain gets a plain confirm — nothing is lost, so no friction is added.

##### Other changes

- **Four emoji icon-buttons per row → one `DropdownMenu`.** They were ~24px unlabelled targets
  with destructive delete two pixels from edit; emoji also render per-platform and cannot
  inherit `currentColor`. Each action now has a *name*, delete is separated and marked
  `variant="destructive"`, and the reclaimed width was itself feeding the page overflow.
- **Hand-rolled `fixed inset-0` modals → `Dialog` / `AlertDialog`.** What the hand-rolled ones
  lacked: Escape-to-close, focus trapping, focus restored to the trigger, `aria-modal`, body
  scroll lock.
- **`alert()` → an inline `Alert` banner** showing the server's actual message, and the delete
  dialog now **stays open on failure**. The old code fired an `alert()` and left a dead modal
  behind it, so a failed delete looked like it had worked.
- **`window.location.reload()` → `router.refresh()`** (#22.6 landing early here). Re-runs only
  the Server Components, so no white flash and surrounding state survives. **Six calls remain
  elsewhere.** Consequence: `NewDomainDialog` now needs `setOpen(false)` on success, because
  `DomainForm` only falls back to a reload when given no `onSuccess`.
- **The row glyph** was derived by regex-matching the first non-word character out of the domain
  *name*, so "C++ Tutorials" would show a `+`. Now the category's own `icon` field, with a
  neutral globe fallback.

##### ⚠️ Verification note — how `/admin/*` was tested

Admin routes 307 to `/login`, so assertions need a session. Rather than hardcode a password,
a short-lived session JWT was signed with the project's own `AUTH_SECRET` (Auth.js v5 derives
its key from `(secret, salt)` where **the salt is the cookie name**). The script lives in the
scratchpad; it was copied into the repo root only to resolve `@auth/core` and deleted in the
same command. **Its `maxAge` is 10 minutes — an expired cookie silently reads as a 307, which
briefly looked like eight broken screens.**

##### ⚠️ TEST CASES — run these before pushing

**A. The table renders** — 35 rows (`aria-label="Actions for …"` × 35), 33 Direct + 2
Hierarchical badges, 35 Live / 0 Draft. Matches the database.

**B. Empty state** — `?search=zzzznomatch` → "No domains found", `colspan="6"`.

**C. Publish toggle actually mutates** — bug #1's fix, driven over HTTP: `PATCH` a real domain
to `false` → page renders **1 Draft / 34 Live**; `PATCH` back to `true` → **0 / 35**. Dev data
restored. *(This is the one to re-check by hand in the browser, since it was never wired.)*

**D. Error paths** — `PATCH` and `DELETE` against the all-zero UUID both return
`{"success":false,"message":"Domain not found"}` with 404, confirming the `body?.message` the
new error banner reads actually exists.

**E. Old styling gone from the rendered HTML** — `bg-opacity-50`, `bg-gray-50`, `text-blue-800`,
`text-gray-500`, `divide-gray-200`, `w-mx`, `tracking-wider`: **all absent**. Emoji
✏️ 🗑️ 🚀 👁️‍🗨️ ⏳ 🔗: **all absent**.

**F. Portal content** — menu items and dialog copy are **not** in server HTML (Radix mounts
Portals lazily; asserting on server HTML here has produced false failures before). Verified in
the client chunks instead: "Edit domain", "View live page", "Unpublish", "Delete domain",
"Type the domain's slug", "of its page", "Could not update".
⚠️ `"all 70 of its page"` was a **badly formed assertion** — the count is interpolated at
runtime, so no such literal can exist in a static bundle.

**G. Regression** — all 8 admin screens 200 (`/admin/sections`, *not* `/admin/section-layout`
— the nav label is "Section Layout" but the route is `/admin/sections`); `/domain` and
`/sitemap.xml` still 200.

**H. Still to check in a browser** (no headless browser installed): dark mode on this screen,
and that the dropdown/dialogs open and are positioned correctly.

#### ✅ G-3c DONE — 1 Aug 2026 (Domains — form + filters)

**Hardcoded colours: `DomainForm` 65 → 0, `DomainFilters` 33 → 0.** No new dependencies —
`input`, `label`, `select`, `checkbox`, `badge`, `alert` were all vendored already.
**`/admin/domains` is now fully rebuilt** (G-3a container, G-3b table, G-3c form + filters).

##### `DomainFilters`

- **⚠️ This component caused the page-wide horizontal scrollbar.** Its three filters were
  `flex-1 min-w-48` + two `flex-1 min-w-32` in a flex row — ~450px of minimum width that could
  not shrink, which is what forced `min-w-0` onto `SidebarInset` in G-3a. Now a responsive
  grid (`1 / sm:2 / lg:4`), because **grid tracks do not carry flexbox's `min-width: auto`**,
  so they wrap instead of pushing the document wider. *(The `min-w-0` stays — it is correct in
  its own right and protects every other admin screen — but it is no longer load-bearing here.)*
- **⚠️ The doc comment claimed debouncing that was never implemented.** The handler documented
  as "Handle search input change with debouncing" had the body `setSearchInput(value)` and
  nothing else. **Kept the explicit submit and corrected the comment** rather than adding a
  debounce, which would fire a server round-trip per keystroke.
- **A fake invisible label removed** — `<label className="text-xs text-transparent">.</label>`,
  a literal full stop rendered transparent purely to push "Clear All" into vertical alignment.
- **Labels had no `htmlFor`/`id`**, so clicking one did nothing and screen readers announced
  three unlabelled comboboxes.
- The four active-filter chips were four copies of the same block differing only by colour
  (blue/purple/green/orange, none of which meant anything) → one `FilterChip` component. Their
  remove control was a bare `×` character, which reads as "multiplication sign".

##### ⚠️ Two Radix `Select` traps, both hit during this step

**1. `SelectItem` throws on `value=""`.** The old native `<option value="">All Categories</option>`
cannot be ported directly — Radix reserves the empty string internally for "nothing selected".
Fixed with a `NO_FILTER = '__all__'` sentinel converted back to `''` at the URL boundary, so
**the URL shape is unchanged and the server page needed no modification**.

**2. `SelectValue` renders EMPTY on the server.** It resolves the trigger's label by looking
through its `SelectItem` children — which live in a Portal that only mounts in the browser. So
all three dropdowns server-rendered **blank** and filled in on hydration, a visible regression
against the native `<select>` they replaced. Caught by reading the actual markup after a grep
returned empty strings. Fixed by passing explicit children to `SelectValue`, computed from
props we already hold. Verified in server HTML: unfiltered → `All categories / All statuses /
All types`; `?status=published&pageType=direct` → `All categories / Published / Direct`.
*`DomainForm`'s selects deliberately do NOT need this — they exist only inside a dialog, which
cannot be reached before JS has loaded.*

##### `DomainForm`

- **⚠️ Every label was `text-black` and every input `bg-gray-200 text-gray-800`** — black labels
  on a dark card in dark mode, while the inputs stayed light grey. The worst dark-mode offender
  left on this screen after #21.
- **⚠️ Dead success path deleted.** `if (onSuccess) … else if (!isEditMode) { alert(...);
  window.location.reload(); }` became unreachable in G-3b once both call sites passed
  `onSuccess`. **`onSuccess` is now a required prop**, so the dead branch cannot return by
  someone forgetting to pass it. (#22.6.)
- **⚠️ Cancel only rendered in edit mode** (`isEditMode && onCancel`), so the create dialog had
  no Cancel button despite being handed one.
- **`SUPPORTED_COUNTRIES` was imported and never used.**
- Country picker: hand-rolled `bg-blue-600`/`bg-green-600` pills → toggle `Button`s with
  `aria-pressed`, so selection is announced rather than conveyed by colour alone.
- Publication checkbox: `<input type="checkbox" className="text-blue-600 …">` → shadcn
  `Checkbox`. *(`text-blue-600` never did anything — a native checkbox ignores text colour;
  `accent-color` is what tints one.)*
- `parseInt(e.target.value) || 0` → `Number(...) || 0`: an emptied number input yields `''`, and
  `parseInt('')` is **NaN** where `Number('')` is 0. The `|| 0` masked it, but the intent is now
  explicit.

##### ⚠️ NEW SAFETY FEATURE — the slug-change warning

**Changing a domain's slug silently breaks every public URL beneath it.** Pages are served from
`/domain/<domainSlug>/<pagePath>` and **this app has no redirect table**, so renaming `gdesign`
404s all **70** of its pages at once — every inbound link, search result and bookmark. The old
form's entire guard was placeholder text reading *"be careful changing this"*.

A destructive-variant `Alert` now appears **only when the slug of an existing domain has
actually been edited**, naming the old address, the new one, and the page count. `pageCount` is
plumbed through from `DomainsTable`, which already had it for the Pages column.

Confirmed against the API: `PUT` validates slug *uniqueness* and maintains the `__main__`
invariant (#11) server-side, but nothing anywhere addresses orphaned URLs. **A redirect table
remains genuinely absent — this warns, it does not fix.**

##### ⚠️ TEST CASES — run these before pushing

**A. Filters still filter** — `?status=published&pageType=direct` returns 200 and the page
renders the matching subset; unfiltered and filtered pages both 200.

**B. The `value=""` trap** — the filtered URL is the one that would throw if a `SelectItem`
still carried an empty value. It renders.

**C. Trigger labels in server HTML** — all three show their current value *before* hydration
(see above for the exact expected strings).

**D. Chips are conditional** — "Active filters:" appears 0 times unfiltered, 1 when filtered,
with one `Remove filter: …` per active filter (2 for the two-filter URL) and a "Clear all".

**E. Accessibility wiring** — `id="filter-category"` / `for="filter-category"` present; 3
`role="combobox"`.

**F. Dead code is gone from source** — `window.location.reload`, `alert(`,
`SUPPORTED_COUNTRIES`, `text-transparent`: **1 occurrence each, all inside comments** quoting
what was removed.

**G. Regression** — all 8 admin screens 200; `/domain` and `/sitemap.xml` 200.

**H. Still to check in a browser**: dark mode on the form and filters; the slug warning
appearing when (and only when) you edit an existing slug; that the filter grid wraps rather
than overflowing at a narrow width.

##### Roboto sweep — progress

`next/font/google` is now imported in **5** files, of which **`src/app/layout.tsx` is the
legitimate app-wide font**. The remaining 4 are `admin/categories/page.tsx`, `admin/pages/page.tsx`,
`CategoryForm.tsx` and `PagesManager.tsx` — they land in **G-4** (pages) and **G-6** (categories).

#### Phase G-4 — Pages: findings before the rebuild (audited 1 Aug 2026)

**5 files, 1,826 lines, 191 hardcoded colours** — noticeably larger than the Domains screen.

| File | Lines | Colours |
| ---- | ----- | ------- |
| `src/app/admin/pages/page.tsx` | 147 | 12 |
| `src/components/admin/pages/PagesManager.tsx` | 459 | 26 |
| `src/components/admin/pages/PageTree.tsx` | 397 | 51 |
| `src/components/admin/pages/DomainSelector.tsx` | 217 | 43 |
| `src/components/admin/pages/PageForm.tsx` | 606 | 59 |

##### ⚠️⚠️ THE PAGE TREE IS EMPTY ON FIRST LOAD — a stale-closure bug

This is very likely a large part of the complaint recorded in **#20** ("I change/update/create
some things — it does happen on the live website, but so many things don't show up in the
Admin UI").

`fetchPagesForDomain` closes over the `selectedDomain` **state variable** instead of using the
domain it was asked to fetch:

```js
const fetchPagesForDomain = async (domainId: string) => {
  const data = await response.json();
  const hierarchicalPages = buildPageHierarchy(data.pages, selectedDomain);  // <- stale
```

and `buildPageHierarchy` begins `if (!domain || !flatPages.length) return []`.

**Two distinct symptoms, one cause:**

1. **On mount — nothing renders.** The effect runs `setSelectedDomain(d)` then
   `fetchPagesForDomain(d.id)`. A state setter does **not** retroactively update a closure that
   has already been created, so `selectedDomain` is still `null` inside that call →
   `buildPageHierarchy` returns `[]` → `setPages([])`. **The fetch succeeds and its result is
   discarded.** The effect's deps are `[selectedDomainId, domains]`, neither of which changed,
   so it never re-runs and the screen never recovers.

2. **After switching domains — the wrong domain's URLs.** The closure now holds the
   *previous* domain, so `fullPath` and `previewUrl` are computed from the wrong `pageType`
   (which decides whether `__main__` is skipped in the path) and the wrong `domain.slug`.
   Preview links point into a different domain entirely.

**Fix:** pass the domain object into `fetchPagesForDomain` rather than reading it from state.
Fixed alone in **G-4a**, before any restyling, per this phase's own rule.

##### ✅ G-4a DONE — 1 Aug 2026

**One file. 57 insertions, 19 deletions, and `git diff` touches no JSX, no `className`, no
markup at all** — deliberately, so the correctness fix can be reviewed without a restyling
diff in the way.

`fetchPagesForDomain(domainId: string)` became `fetchPagesForDomain(domain: Domain)`, and
`buildPageHierarchy` is handed that argument instead of reading `selectedDomain` from state.
All 5 call sites updated. **This is preferable to adding `selectedDomain` to a dependency
array**: passing the value removes the timing question entirely, rather than trying to win it.

Two call sites (`handleFormSuccess`, `handleDeletePage`) still read `selectedDomain` — that is
safe and is commented as such: they run from a user action long after the state settled, not in
the same tick as the setter that assigned it.

###### ⚠️ How the bug was proven without a browser

The tree renders client-side after a fetch, so server HTML cannot show it. The claim was
established as a three-link chain instead, each link checked separately:

1. **The fetch succeeds.** `GET /api/admin/pages?domain=<Graphic Designing>` → **200**, 27,711
   bytes, `success: true`, **`pages.length === 70`**, `__main__` present.
2. **Those 70 were discarded.** `buildPageHierarchy` line 2 is
   `if (!domain || !flatPages.length) return []` — with `domain === null` it cannot return
   anything else.
3. **`domain` was `null` on mount.** `setSelectedDomain(d)` schedules the next render; it does
   not reach into a closure that already exists. So the call created during the first render
   saw the initial `null`.

**Regression:** all 8 admin screens 200, `/domain` and `/sitemap.xml` 200, and `/admin/pages`
still renders "Page Management System", "Select Domain" and "Understanding Domain Types" — the
shell is untouched by this commit and is G-4b's job.

⚠️ **Still needs a browser to confirm the symptom is actually gone**: open `/admin/pages` and
check the tree is populated on first load, then switch domains and check the preview links
point at the domain you selected.

**✅ CONFIRMED IN THE BROWSER (1 Aug):** the tree loads populated — 50 pages for UI/UX
Designing — and the preview URLs read `/domain/uiux/...`, i.e. the domain actually selected.
Both symptoms gone.

##### ✅ G-4b DONE — 1 Aug 2026 (shell + `PagesManager` chrome)

**Hardcoded colours: `page.tsx` 12 → 0, `PagesManager.tsx` 26 → 0.** No new dependencies.
The G-4a fix was preserved intact — all 5 `fetchPagesForDomain` call sites still pass the
domain object.

- **⚠️ A `Roboto` import that was never referenced** — `page.tsx` built the font object and
  then never used it, not one `roboto.className` in the file. `PagesManager` did use its own
  copy, on five headings. Both gone.
- **Gradient banner removed** (third time this phase, after G-2 and G-3a): `from-purple-50
  to-blue-50`, describing the screen you are already looking at, hardcoded light.
- **"Understanding Domain Types" → a closed `Collapsible`.** Content kept **verbatim**,
  because the direct-vs-hierarchical distinction is the one part of this app's model that is
  not self-evident from the UI. Restructured as `<dl>`/`<dt>`/`<dd>` — they are label/value
  pairs, and that is what conveys the relationship to a screen reader.
- **`?expand=` now filters empty segments.** An absent parameter produced `['']` — a page id
  that matches nothing. Harmless today, but it made the empty and one-item cases differ.

###### ⚠️ Delete now states what it actually deletes

`DELETE /api/admin/pages/[id]` collects **every descendant**, then removes their content
blocks and each page in one transaction. The guard was a browser `confirm()` reading
*"Are you sure you want to delete this page? This action cannot be undone."* — no number.

The count is computed **from the tree already in memory** (`countDescendants`, recursive)
rather than asking the server, because `buildPageHierarchy` has already nested every page of
the domain. Counting `children.length` alone would report 3 for a branch that takes 20 pages
with it — **worse than saying nothing**.

⚠️ `confirm()` is *synchronous*, so it cannot be swapped for a dialog in place — the call site
had to be split into "open" (`handleDeletePage`) and "confirm" (`confirmDeletePage`). That is
the restructuring #22.6 predicted for all 3 `confirm()` calls.

**Deliberately NO type-to-confirm here**, unlike the domain delete in G-3b. Deleting a domain
destroys 70 pages and is rare; pruning a page is routine. Adding friction to a frequent action
just trains people to click through it.

**The form stays inline rather than moving to a dialog** — unlike the domain form in G-3a. You
pick a parent from the tree behind it, so a modal would cover the very thing the form is about.

###### ⚠️ TEST CASES

**A. New shell renders** — page header, "Choose a domain to manage its page hierarchy",
"Understanding domain types" collapsible, and the no-domain empty state all present.

**B. Old shell gone** — "Page Management System", `from-purple-50`, `bg-cyan-50`,
"Create New Page", 📄 and 🔍: **all absent**.

**C. Delete dialog copy** — in the client bundle ("nested page", "Delete page", "beneath it"),
not server HTML, since Radix mounts it in a Portal.

**D. Regression** — all 8 admin screens 200; `/domain` and `/sitemap.xml` 200.

**E. Still to check in a browser**: dark mode; that deleting a parent page reports the right
nested count; that the inline form still opens from both "New page" and a row's `+`.

⚠️ **A verification mistake worth recording:** the header assertion hardcoded "35 domains" and
reported MISSING. The code was right — **there are now 37 domains**, three having been created
during testing. Same class of error as the hardcoded sitemap count of 1198 in Phase F: an
assertion that pins live data goes stale and then accuses correct code. Re-derived from the API.

⚠️ **Build note:** `npm run build` runs `prisma generate && next build`, and the generate step
hits `EPERM` on the Windows query-engine DLL whenever a dev server holds it. With the user's own
`npm run dev` running, the fix is **not** to kill it — run `npx next build --turbopack` alone
(the schema was unchanged) and verify on **port 3001**.

##### ✅ G-4c DONE — 1 Aug 2026 (`PageTree` + `DomainSelector`)

**Hardcoded colours: 51 + 43 → 0. Zero new dependencies** — `command` and `popover` were
already vendored.

User's verdict going in: *"this is the page where UX is not at all good. We need to improvise
this page a lot."* Agreed — and these two files **are** the page's UX.

###### ⚠️ Why the tree was unreadable — it is measurable

Every row rendered a four-column grid in which each value carried its own **label
underneath it**:

```
🖼️ UI/UX Designing      /__main__      /domain/uiux      Root
   Section Based           Slug          Preview URL      Parent
```

With 50 pages that is **150 label renders** — "Slug", "Preview URL", "Parent", fifty times
each — none of which tells you anything after the first row. They are what made each row
~80px tall, turning a 50-page domain into a wall you scroll through to find one page.

| Fixed | Why |
| ----- | --- |
| **Repeated labels deleted** | `/ytube` is self-evidently a slug |
| **Parent column deleted entirely** | For a `direct` domain every child read `__main__ (Hidden)` — the same string 49 times, **zero information**. Indentation already shows parentage; that is what a tree *is*. |
| **Full preview URL no longer printed per row** | It was `/domain/uiux/ytube`, where `/domain/uiux` is identical on all 50 rows |
| **Rows are one line, not three** | ~3× as many pages on screen — the actual fix for "I can't find anything" |
| **Emoji + pastel type tiles → lucide icons** | Six `bg-*-100 text-*-700` pairs that signalled nothing and could not inherit `currentColor` |
| **`▶` text glyph → rotating `ChevronRight`** | Rendered at a different size and baseline on every platform |

###### ⚠️ A keyboard trap in the old action buttons

The four per-row buttons were `opacity-0 group-hover:opacity-100`. **`opacity-0` does not
remove an element from the tab order** — so a keyboard user tabbed through four *invisible*
controls per row, **200 invisible stops in a 50-page tree**, one of which was delete. On a
touch screen there is no hover at all, so they were simply unreachable. Replaced by one
always-visible menu per row (the G-3b pattern).

Also added **real tree semantics** — `role="tree"`/`treeitem"`/`group`, `aria-expanded`,
`aria-level`. The old markup was nested `div`s, so assistive tech could not tell it was a
hierarchy or how deep any row sat.

⚠️ Indentation stays an **inline style**, not a Tailwind class: depth is unbounded and
`pl-${level*6}` cannot work, because Tailwind only emits classes it can literally see in the
source at build time.

⚠️ **Delete is omitted for `__main__`, not shown-and-disabled** — the API rejects it outright
(#11), so offering it would be a control that can only ever fail.

###### `DomainSelector` — the first thing you touch, and it had no search

37 domains in a flat, unsearchable list built from `useState(isOpen)` and an absolutely
positioned div. **No Escape, no click-outside, no focus trap**, focus never moved into the
list nor returned to the trigger, and no `role`/`aria-expanded` — so it announced as a plain
button. Now `Popover` + `Command`: type-to-filter, arrow keys, Enter, Escape, focus
restoration, correct roles.

⚠️ Each item's `value` includes **slug and category name**, not just the label — so typing
"design" matches both the name and everything in the Design category. Without it only the
visible label is searchable, and **34 of 37 names start with an emoji**.

###### ⚠️ TEST CASES

**A. Routes** — all 8 admin screens 200, `/domain` 200.
**B. Portal/client content in the bundle** — "Search domains", "No domain found", "Add child
page", "Edit page", "Preview page", "Delete page", "in this domain", "No pages yet",
"Subcategory list": all present. (Not in server HTML — `Command` and `DropdownMenu` mount
lazily.)
**C. The removals** — `>Slug<`, `>Parent<`, `getParentDisplay`, `getContentTypeColor` gone
from source; the only remaining `Preview URL` / `opacity-0 group-hover` hits are comments
quoting what was removed.
**D. No new dependencies** — `package.json` unchanged.
**E. Still to check in a browser**: dark mode; that the domain search filters as expected;
that expand/collapse still persists through `?expand=`; that the row menu does not clip at
the right edge on a deep row.

###### Still weak after G-4c — candidates if the screen needs more

These are **not** done and are not part of G-4d:

- **No way to search or filter pages within a domain.** With 50+ pages the tree is still a
  scroll. This is probably the largest remaining gap.
- **No expand-all / collapse-all.**
- **No drag to reorder or re-parent** — moving a page means editing it and changing its
  parent in a dropdown.
- **Nothing distinguishes a page with content from an empty one**, so you cannot see what
  still needs writing.

##### ✅ G-4d DONE — 1 Aug 2026 (`PageForm`)

**59 → 0 colours. `/admin/pages` is now fully rebuilt: 191 hardcoded colours across 5 files
→ 0, and zero new dependencies for the whole of G-4.**

###### ⚠️ BUG — "Default (`__main__` page)" did the opposite when editing

The parent dropdown offered `<option value="">Default (__main__ page)</option>`, and choosing
it set `parentId` to `null`. Whether that was right depended on which endpoint received it:

- **`POST`** compensates — `if (domain.pageType === 'direct' && !parentId)` looks up (or
  creates) `__main__` and uses its id. **Creating worked.**
- **`PUT`** does not — it stores `parentId: parentId || null` verbatim. **Editing an existing
  page and choosing the option labelled "Default (`__main__` page)" detached it from
  `__main__` and made it a root page** — the opposite of the label.

On a `direct` domain the entire URL model hangs off `__main__` (#11), so a detached page gets
a different public path than the tree shows.

**Fixed in the form, not the API**, because the form is where the ambiguity lives: a `direct`
domain now offers **no "no parent" option at all**. `__main__` appears as a normal selectable
row ("Main page (hidden root)") and is the default, so **both endpoints receive a concrete id
and cannot disagree about what it means.** The API is untouched and its POST-side correction
remains as a backstop.

###### ⚠️ BUG — the parent list's indentation never rendered

Depth was built with `{'  '.repeat(page.depth)}` inside an `<option>`. **HTML collapses runs
of whitespace**, so every entry rendered flush left no matter how deep it sat — in App
Development's 116-page tree, an unreadable flat list. Depth is now real padding on a
`SelectItem`, which is a `div` we control rather than an `<option>` we do not.

###### Other changes

- **⚠️ Six radio cards → one `Select`.** The old control was a three-column grid of six
  bordered cards, each three lines tall (label, description, italic example) — roughly 250px
  of an inline form you are trying to see **past** to reach the tree. Descriptions kept inside
  the dropdown, where they help at the moment of choosing; the "example" third line dropped.
- **⚠️ It also hid keyboard focus completely.** Each card had `focus:outline-none` on the
  label with an `sr-only` radio inside, so moving through the six options gave **no visual
  indication of where you were**.
- **Slug-change warning**, matching G-3c: changing an existing page's slug changes its public
  URL and every descendant's, with no redirect table. The old guard was the hint text "be
  careful changing this".
- **`SUPPORTED_COUNTRIES` imported and never used** — the identical dead import that
  `DomainForm` had before G-3c.
- Country pills → toggle `Button`s with `aria-pressed`, matching `DomainForm`.

###### ⚠️ Also fixed: the page count contradicted itself

Spotted in the user's screenshot — the header badge read **"3 pages"** while the tree
immediately below read **"116 pages in this domain"**. `pages` is the array of **root** pages,
so the badge was counting roots. **Pre-existing** (it said "3 pages *total*" before, which was
worse), and carried forward through G-4b before being caught.

For a `direct` domain it was worse still: every page hangs off `__main__`, the only root, so
the badge always said **"1 page"** regardless of the real count. Now uses the recursive total,
sharing `countDescendants` with the delete dialog so the two numbers cannot drift.

###### ⚠️ TOOLING NOTE — do not `next build` while a dev server is running

`next build` and `next dev` write to **the same `.next` directory**. Building while the user's
`npm run dev` was serving from it produced `PageNotFoundError: Cannot find module for page`
for `/_not-found`, `/admin/rich-text`, `/admin/tables/new` and others — *after* reporting
"Compiled successfully" — and left their dev server unresponsive on :3000.

Recovery: `rm -rf .next` (build output, ignored via `/.next/` in `.gitignore`) and rebuild
clean. **Prevention: check :3000 before building.** This is the third distinct `.next`
corruption in this project, and the first with a known cause.

###### ⚠️ TEST CASES

**A. Every route 200** after the clean rebuild — all 9 admin routes including
`/admin/tables/new` and `/admin/rich-text`, the two that had thrown `PageNotFoundError`;
`/domain` 200; an unknown path still 404s (so `/_not-found` is intact).

**B. Form copy in the client bundle** — "Root level (no parent)", "Main page (hidden root)",
"under the main page", "there are no redirects", "Organised content blocks", "Save changes".

**C. Colours** — all 5 Pages files: **0** outside comments.

**D. Roboto sweep** — `next/font/google` now in **3** files: `layout.tsx` (legitimate,
app-wide) plus `admin/categories/page.tsx` and `CategoryForm.tsx`, both of which land in G-6.

**E. ⚠️ Must be checked in a browser** — the two bugs above are the ones to exercise:
1. On a **direct** domain (e.g. UI/UX Designing), **edit** an existing page, leave the parent
   alone, save — it must stay under the main page, not jump to root.
2. Open the parent dropdown on **App Development** (116 pages) — entries should be visibly
   indented by depth.
3. The page-count badge should now match the tree's count.

#### Phase G-5 — Tables: findings before the rebuild (audited 1 Aug 2026)

**10 files, 3,872 lines, 253 hardcoded colours** — more than double the Pages screen, and the
largest remaining area of the admin.

The three **route** files (`page.tsx`, `new/page.tsx`, `[id]/page.tsx`) have **zero** shadcn
imports. The seven components are hybrids — partly modernised by #22.1/#22.2/#22.5, but still
carrying 217 of the 253 colours between them.

##### ⚠️⚠️ THREE OF THE EDITOR'S FOUR TABS DO NOTHING

`TableEditor` presents **Data · Schema · Import · Settings**. Only one of them works.

| Tab | What it actually does |
| --- | --------------------- |
| **Data** | Renders `DataTable` — the **public, read-only** table component. There is no way to edit a cell, add a row or delete one. This is `#22.2(b)`. |
| **Schema** | A **read-only list** of columns with their type and flags. Nothing is editable. |
| **Import** | ✅ Works — CSV replace/append, delivered in `#22.2(a)`. |
| **Settings** | A literal placeholder: `<h3>Settings Editor Coming Soon</h3>`. |

##### ⚠️ AND THE MISSING PIECES LARGELY ALREADY EXIST

This is the same shape as the publish button in G-3b — **built, working, and never wired up**:

- **`TableSchemaEditor.tsx` is 493 lines of fully-built schema editing** — add/remove/reorder
  columns, set type, required, sortable, filterable. It is rendered **only by
  `TableCreationWizard`**. The edit screen never imports it.
- **`PUT /api/admin/tables/[id]` already accepts and validates `schema`**
  (`if (body.schema !== undefined)` → checks `columns` is a non-empty array → writes it), and
  **already accepts `settings`**. It also invalidates the table cache afterwards (#18).
- **`PUT /api/admin/tables/[id]/data` already accepts** `{ data: { rows }, operation }` with
  `replace` and `append` — the endpoint row editing would post to.

So `#22.2(c)` (schema) and the Settings tab are **wiring, not construction**. `#22.2(b)` (rows)
needs a real editing UI, but not a new endpoint.

##### ⚠️⚠️ G-5b(i) DONE — 1 Aug 2026: the schema editor corrupted data, and had to be fixed first

The caveat above ("does anything reconcile existing rows with a changed schema?") was checked
before wiring, and the answer was worse than expected. **Two reproduced data-corruption bugs.**

**Rows are keyed by column ID, not name.** `TableRow = { id: string; [columnId: string]: unknown }`
— verified against a real table: **4 of 4 row keys matched column ids, 0 matched names**. So
*renaming* a column is safe. Everything else was not.

###### Bug 1 — a new column resurrects a deleted column's data

`TableSchemaEditor:79` minted ids from the array **length**:

```js
newColumn.id = `col_${currentSchema.columns.length + 1}`;
```

`removeColumn` correctly leaves the other ids alone, and deliberately does not touch the rows
— so the removed column's values stay in every row. The next add then reuses the freed number.
Reproduced exactly:

```
start        : col_1, col_2, col_3, col_4
remove col_4 : col_1, col_2, col_3      <- every row still holds col_4 = "secret note"
add a column : col_1, col_2, col_3, col_4
-> the "new, empty" column IS col_4, so it renders the DELETED column's data in all 11 rows
```

###### Bug 2 — removing from the middle produces duplicate ids

```
remove col_2 then add -> col_1, col_3, col_4, col_4   | duplicate ids? YES
```

###### Bug 3 — templates silently remap every column onto existing data

`applyTemplate` → `createTableSchema` → `generateColumnId(index)` re-ids **every** column as
`col_1 … col_N` (table-utils.ts:164-169). Apply the "Courses" template to a 4-column tools
table and `"Figma"` starts rendering under **"Course Name"**, `"figma.com"` under
**"Instructor"** — the values are unchanged, the meanings are not.

###### Why none of this has bitten yet

**`TableSchemaEditor` is only reachable from the creation wizard, where no rows exist.**
Wiring it into the table editor — which is exactly what `#22.2(c)` asks for — is what would
have turned all three into live corruption of real content. Hence: fixed **before** the
wiring, in its own commit, one file.

###### The fix (user's call: non-destructive)

Offered three options; the user chose **"leave orphaned data, just stop it resurfacing"** over
pruning row keys on save. Nothing is ever deleted, so a mistaken column removal stays
recoverable by re-adding a column with that id. The cost is that dead keys remain in the JSON,
adding to the payload #22.1 was trimming.

- `nextColumnId(columns, reserved)` — module-level and **pure**, so it needs no `useCallback`
  and cannot go stale in a closure. It counts up from 1 and skips anything in use, where "in
  use" spans the live columns **and every key present in the existing rows**
  (`reservedColumnIds`). Verified: `remove col_4 → add` now yields **`col_5`**, and
  `remove col_2 → add` yields `col_1, col_3, col_4, col_5` with **no duplicates**. Gap reuse
  still works on a table with no rows.
- `showTemplates` — defaults to `true` so the creation wizard is unchanged; the table editor
  will pass `false`.

⚠️ Both new props are **optional with safe defaults**, so `TableCreationWizard` needed no
change at all and its behaviour is byte-identical.

##### ✅ G-5b(ii) DONE — 1 Aug 2026: `#22.2(c)` — schema editing is wired up

**Both halves were already finished; nothing joined them.** The same shape as the publish
button in G-3b.

- The Schema tab rendered a **static list** of columns — name, type, flags, nothing editable.
  Once a table was created its structure was frozen. Directly part of the **#20** complaint.
- `TableSchemaEditor` — 493 working lines — was reachable **only** from the creation wizard.
- `PUT /api/admin/tables/[id]` **already** accepted and validated `schema` *and* `settings`,
  and already invalidated the table cache from #18.

The Schema tab now renders the real editor, with the two guards from G-5b(i):
`reservedColumnIds` (every key present in every row) and `showTemplates={false}`.

###### ⚠️ Four tabs became three

The **Settings tab was removed, not left empty**. It held a raw `JSON.stringify(table.settings)`
dump plus a dashed box reading *"Settings Editor Coming Soon"* — while the settings it promised
(pagination, sorting, filtering) are all edited by `TableSchemaEditor`, in a "⚙️ Table Settings"
card it renders itself.

⚠️ Splitting that component across two tabs would mean **mounting it twice with two independent
drafts** that could disagree about what to save — it owns schema and settings in a single piece
of state. So the Schema tab holds both and its label says so. The dead `TabsContent` was deleted
too, not just its trigger.

###### Design notes

- **Drafts are held in the caller.** `TableSchemaEditor` fires `onUpdate` on every keystroke and
  has no Save of its own — in the wizard, the next step commits it. Here nothing else would, so
  the save lives with the caller that owns the API call. `null` drafts mean "untouched", which
  is what disables the Save button.
- **Schema and settings go in ONE request**, each falling back to the stored value, so saving
  after changing only one of them does not blank the other.
- **"Discard changes" calls `router.refresh()`**, not just a state reset — that re-mounts the
  editor from the stored schema, so discarding genuinely restores rather than leaving the editor
  showing edits it no longer intends to save.
- **A removal warning** lists the columns a save would drop and states plainly that their values
  **stay in storage and are not deleted** — because "removed" normally implies "gone", and the
  chosen policy is non-destructive.
- ⚠️ The 400 body uses **`error`**, not `message` (`{"error":"Schema must have at least one
  column"}`), unlike the domains/pages APIs. The handler reads `body?.message ?? body?.error`
  so either shape surfaces.

###### ⚠️ TEST CASES — verified against real data

**A. Round-trip on a live table** (11 rows, 4 columns): renamed column 1 via `PUT` → read back
`"Name (G5B TEST)"` → **rows still 11** → restored to `"Name"` → verified. Dev data unchanged.

**B. API guard** — `PUT` with `{"columns": []}` → **400**,
`{"error":"Schema must have at least one column"}`.

**C. Tabs** — the rendered tablist is `grid-cols-3` with Data View / Schema &amp; Settings /
Import/Export. "Settings Editor Coming Soon" and "⚙️ Settings" are gone from the page; the only
remaining occurrences in source are comments quoting them. *(A `grid-cols-4` still on the page
belongs to an unrelated stats grid in `[id]/page.tsx`.)*

**D. Regression** — 8 admin routes 200, including `/admin/tables/[id]` and `/admin/tables/new`.

**E. Still to check in a browser**: add a column, remove one, save, and confirm the Data tab
reflects it; that "Discard changes" restores; and that the public table page updates (the PUT
invalidates the #18 cache).

###### ⚠️ PROCESS FAILURE — I broke the user's dev server, having just documented not to

G-4d recorded the rule: `next build` and `next dev` share `.next`, so **check :3000 before
building**. I then wrote the check and the build **in the same shell command**, so the check
could not gate anything — it printed `:3000 -> 200` and the build ran regardless, killing the
dev server. Recovered with `rm -rf .next` and a clean rebuild.

**The rule is not "check first", it is "check in a SEPARATE command and read the result before
building".** A guard that runs in the same breath as the thing it guards is not a guard.

##### ✅ G-5b(iii) DONE — 1 Aug 2026: dark mode on the table editor

Reported by the user with screenshots: *"in the dark — doesn't look that good."* Correct, and
partly self-inflicted — **wiring `TableSchemaEditor` into the editor in G-5b(ii) put its
light-only styling onto a dark card for the first time.** Until then it was only reachable from
the creation wizard, which nobody had looked at in dark mode either.

Two sources, both listed in the G-5 plan as G-5b scope and left unfinished:

**1. `app/admin/tables/[id]/page.tsx` (18 colours) — never touched by any earlier phase.**
It painted `bg-white` stat cards and `text-gray-900` headings straight onto the dark theme.
Rebuilt on `AdminPageHeader` (G-2) + the shared `StatsCard`, replacing a hand-rolled `text-3xl`
title, a `border-b` rule, a link styled as a button, a **second hand-maintained breadcrumb**
sitting directly under the real one from `admin-nav.ts` (G-1), and a **local `StatsCard` copy**
that drew its own white panel and took an emoji string as its icon.

**2. `TableSchemaEditor` (17 colours).** The worst was `text-gray-900` on the
"Define Your Table Structure" heading — **near-invisible on a dark card**. Also a
`border-blue-200 bg-blue-50` summary panel and two raw `<select>`s carrying
`border-gray-300 focus:ring-blue-500`. All converted to semantic tokens
(`text-muted-foreground`, `bg-muted/50`, `border-input`, `focus:ring-ring`).

**3. `TableEditor` passed `className="bg-white"` to `DataTable`** — forcing a white panel
inside a themed card, so the rows sat in a glaring white block. Removed; the DataTable brings
its own surface, and overriding it here could only ever hardcode one of the two themes.

⚠️ **`StatsCard.value` was widened from `number` to `number | string`** so the "Last updated"
date can use the shared component. `toLocaleString()` is now called **only for numbers** —
it groups thousands (1198 → "1,198"), which is the point; on a string it is a no-op that would
quietly imply formatting was happening.

###### ⚠️ TEST CASES

**A. Zero light-only classes on the rendered editor page** — `bg-white`, `text-gray-900`,
`text-gray-600`, `text-gray-500`, `border-gray-200`, `border-gray-300`, `bg-blue-50`,
`bg-gray-50`: **all absent**. (Before this step, `bg-white` was still present once.)

**B. New shell renders** — "Schema, data and settings for …", "View live table",
"Schema version", "Bumped on structure changes".

**C. Regression** — `/admin`, `/admin/tables`, `/admin/tables/[id]`, `/admin/tables/new`,
`/admin/pages`, `/admin/domains` all 200.

**D. Still to check in a browser**: the screen in *both* themes — the point of the fix is that
it now follows the theme rather than being restyled for dark.

⚠️ **Still light-only, and deliberately out of scope here** (they belong to G-5a and G-5d):
`TablesManager.tsx`, `app/admin/tables/page.tsx`, `CSVUploadInterface.tsx` and
`TablePreview.tsx` all still carry `bg-white` / `divide-gray-200`.

##### ✅ G-5c DONE — 1 Aug 2026: `#22.2(b)` — table rows are editable

**The answer to "am I able to edit rows?" was no.** The Data tab rendered `DataTable` — the
component the **public site** uses. It has no inputs, no `onCellChange`, no edit affordance of
any kind, because it was never meant to have one. The only three write paths on the whole
screen were: PUT schema/settings (new in G-5b), PUT data (CSV import), and DELETE the table.

So correcting a single typo meant **Export CSV → edit the file → Import with "replace"**. That
round-trip is the "Manage data doesn't work" complaint from **#20**, and it is what
`TableRowsEditor.tsx` (new) removes.

###### Design decisions, and why

- **A dialog rather than edit-in-place.** Columns are typed — `link`, `rating`, `currency`,
  `boolean`, `date`, `description` — and a contenteditable cell would flatten all of them to
  free text, which is how bad data gets in. Each column now gets the input its type deserves
  (`number` → numeric field with the right mobile keyboard, `boolean` → checkbox, `description`
  → textarea, `link`/`image` → url). Inline editing for plain `text` columns is a sensible
  later addition; typed columns should keep the dialog regardless.
- **Edits are staged, then saved explicitly.** `PUT /api/admin/tables/[id]/data` replaces the
  **whole** rows array — there is no per-row endpoint. Saving on blur would rewrite every row
  on each edit, and a failure mid-edit would leave the stored table in a state nobody chose.
- ⚠️ **`operation: 'replace'`, never `'append'`.** The editor returns the COMPLETE array with
  edits applied — it is not a delta — so `append` would duplicate every existing row.
- **`onSave` returns the error rather than setting state**, so a failed request keeps the
  user's unsaved edits on screen. Losing them to a failed save would be worse than the failure.
- **The delete-row dialog names the first column's value** ("CodeWithHarry"), because rows have
  no title of their own and `row_1754…` identifies nothing.
- **The admin grid renders values plainly** — a rating shows "4.5", not five stars. This view
  exists to find the row you want to change; the public `DataTable` remains the presentation.
  Links render as text so scanning for a row cannot navigate you away by accident.

###### ⚠️ The spread order in `RowDialog` is load-bearing

```js
onSubmit({ ...(row ?? { id: generateRowId() }), ...values })
```

Starting from the **existing row** preserves keys the form never shows: `targetCountries`
(per-row geo filtering, #15.3) and any orphaned values left by a removed column, which the
non-destructive policy from G-5b(i) says to keep. Building the row from `values` alone would
silently drop both — and `targetCountries` controls who sees the row on the public site.

###### ⚠️ TEST CASES — verified against real data

Run against the **user's own dev server**, read-only first, because `:3000` was up and
building would have killed it again (see the process failure above — the rule held this time).

**A. The grid renders** — "Filter rows", "Add row", "Save rows", "Row actions" all present on
`/admin/tables/[id]`.

**B. Round-trip on a live 15-row table** — `PUT` an edited `col_1` → read back
`"G5C ROUND TRIP"` → **row count still 15**, confirming `replace` did not duplicate → restored
to `"CodeWithHarry"` → verified. Dev data unchanged.

**C. ⚠️ The hidden field survived.** Row 0 carries `targetCountries: "IN"` — a **non-default**
value — and it was still `"IN"` after the edit and after the restore. That is the check that
proves the spread order above; had it been wrong, this row would have silently become visible
worldwide.

**D. Still to check in a browser**: add a row, delete a row, the `required` validation, and
that the public table page reflects a saved edit (the PUT calls `invalidatePages()`, #18).

##### ✅ G-5c follow-up — the `targetCountries` system column (2 Aug 2026)

###### ⚠️ A CLAIM OF MINE THAT WAS WRONG — recorded so it is not repeated

I asserted that the public site was **rendering a "Target Countries" column** on ~21 tables,
reasoning that `isHidden` is never read and `DataTable` maps `schema.columns` unfiltered. The
user checked several live table pages across different domains and found no such column.

**They were right.** The column *is* stripped — by explicit id comparison, on the public read
path:

```js
getPublicSchema(schema)  // table-utils.ts:599 — filters col.id !== TARGET_COUNTRIES_COLUMN_ID
getPublicRows(rows)      // table-utils.ts:612 — destructures the key off every row
```

both called by `TableService.getPublicTable`. Verified end-to-end afterwards: the public API
returns `Channel Name | Channel Link | Speaking Language | Description` with **no**
`targetCountries` key on any row.

**The error was methodological, not factual-detail:** I grepped for one candidate mechanism
(`isHidden`) plus filters inside `DataTable.tsx`, found none, and concluded *nothing* filtered
it. Absence of the mechanism I happened to look for is not absence of a mechanism. The claim
was about the user's live public site, which raises the bar — **trace the render path from the
page down before asserting anything about production.**

⚠️ Consequence for future refactors, now written into the code: **do not "tidy"
`getPublicSchema`/`getPublicRows` into an `isHidden` check.** Those two id comparisons are the
only thing keeping the column off the public site, and the flag they would read is unset on the
older tables.

###### Two real fixes that did come out of it

The user deleted the Target Countries column from a table via the newly-wired schema editor and
reported that the public table was unchanged — correct, because filtering reads
`row.targetCountries`, not the schema. But it left a genuine trap, confirmed on their table:

```
schema : Channel Name | Channel Link | Speaking Language | Description   (column gone)
rows   : 13, of which 1 still carries targetCountries: "IN"
```

That row stayed hidden from most of the world with **no UI anywhere to un-hide it** — invisible
state, no control, and nothing on screen explaining why the row never appears publicly.

**Fix 1 — `PUT /api/admin/tables/[id]` now calls `ensureTargetCountriesColumn`,** which `POST`
has always done. The asymmetry was harmless while the schema editor lived only in the creation
wizard; G-5b wiring it into the table editor is what exposed it. Saving an affected table's
schema now **heals it automatically** — verified by PUTing the user's damaged schema back
unchanged: the column returned with `isSystem`/`isHidden`/`defaultValue` intact, all 13 rows
preserved, and the one `"IN"` row still `"IN"`.

**Fix 2 — the schema editor no longer offers "Delete Column" on it.** Matched on the **id**, not
the `isSystem` flag, because that flag is absent from the 4-in-25 older schemas that predate it.

###### Reference — how `targetCountries` behaves (asked, so recorded)

**Creation flow** (*Select Page → Define Schema → Upload Data → Preview*, POST only at the end):
do **not** add the column by hand. It is appended server-side on POST. Name the CSV header
`Target Countries` and the values are captured **regardless of mapping**, because
`transformCsvToTableData` scans the raw headers itself for `targetcountries` (case-insensitive,
whitespace stripped) outside the mapping loop.
⚠️ It will therefore show as **unmapped** in the mapping step — cosmetic, not an error. Adding a
column to "fix" it would create a duplicate alongside the system one.

**CSV header matching** — `toLowerCase()` + all whitespace removed, compared to
`targetcountries`. So `targetCountries`, `Target Countries`, `TARGET COUNTRIES` all work;
`Target_Countries`, `Target-Countries`, `Countries` do **not**.

**Values** — `ALL` (or blank) = everyone; otherwise comma-separated codes from
`IN, US, GB, AU, CA`. ⚠️ Matching is exact, so a typo (`INDIA`, `IND`) matches no country and
hides the row from **everyone**, silently.

**Re-import into an existing table:**

| CSV has the column? | Operation | Result |
| ------------------- | --------- | ------ |
| Yes | either | CSV values win (it auto-maps *and* the header scan catches it — same source, no conflict) |
| No | **append** | Existing rows keep their targeting; new rows get `ALL`. Safe. |
| No | **replace** | ⚠️ **Every row resets to `ALL`** — geo-targeted rows go worldwide, silently |

**Practical rule: Export CSV → edit that file → re-import.** The export contains the column, so
a replace round-trip preserves targeting. Hand-building a CSV and replacing is what loses it.

⚠️ **Not done:** a warning when replacing from a CSV that lacks the column. That is the one
remaining sharp edge here.

##### ✅ G-9 DONE — 6 Aug 2026 (Categories — the row position, which never existed in the UI)

**Raised by the user**, not by a sweep: *"the Category only has Column Position, but there is no
way to set the row position. And if I change a column of something, I think it gets in a new
row."* Both halves were correct, and the second one had a specific cause.

###### THE ROOT CAUSE — one field, two contradictory meanings

`categoryOrder` (`prisma/schema.prisma:22`) is read by two places that disagree about what it is:

| | Interpretation | Consequence |
| --- | --- | --- |
| **Admin** — `groupCategoriesByColumn`, `CategoryList.tsx` | a sort key **within a column**; only the relative value matters | three independent stacks; gaps invisible |
| **Public** — `organizeDomainsIntoRows`, `src/app/domain/page.tsx:92` | the **row number** of a 3-wide grid; an absent column gets a blank placeholder cell (`:210`) | gaps are real whitespace on the live homepage |

So the admin preview was not a preview. The live data, dumped straight from the database:

```
row 1: [1] Design     [2] Development  [3] Video
row 2: [1] Marketing  [2] — EMPTY —    [3] — EMPTY —
row 3: [1] New Tech   [2] — EMPTY —    [3] — EMPTY —
row 4: [1] — EMPTY —  [2] Other        [3] Business
```

Five empty cells — visible as the large gaps in the user's own screenshot of `atno.io/domain`,
and invisible on the screen that manages them.

**Why moving a column jumped to a new row** (`api/admin/categories/[id]/route.ts:166`): the old
handler recomputed `categoryOrder` as `max + 1` in the destination column, i.e. appended to the
bottom of that stack — which in grid terms is *a brand-new row with two blank cells*, leaving a
permanent hole in the row it came from. And when the column did **not** change, `categoryOrder`
was **not written at all**, so a row-only move was impossible even if a field had existed.

⚠️ **Consequence worth stating plainly: the UI could not produce a row holding two or three
categories.** Row 1 exists only because the original seed created it that way.

###### WHAT CHANGED

**A. Row is editable.** A shadcn `Select` beside Column in `CategoryForm`, listing every row in
use plus one new one, each labelled with what occupies that cell in the chosen column
(*empty* / *taken by X* / *swap with X*). Both API handlers accept and validate `categoryOrder`;
`PUT` now applies it on **every** save, not only when the column changes.

**B. Collisions.** A duplicate `(column, row)` pair makes a category **vanish from the public
page with no error** — `orderGroups[order][column] = group` is a plain overwrite
(`domain/page.tsx:118`), and there is no unique constraint in the schema. Unreachable through
the old API; one keystroke away once the row is typeable. So: **create refuses** with a 409
naming the occupant, and **edit swaps** — the displaced category takes the cell being vacated,
which is free by definition, so it can never fail or cascade. Both writes run in a
`$transaction`, because between them the two records momentarily share a cell.

**C. The preview is now the grid**, rendered row by row with the blank cells shown. Each blank
cell is a button carrying `?column=N&row=M`, so "put this beside Development" is one click.

**D. Dead controls removed from `CategoryCard`** — the `#N` badge showed the **array index**,
not `categoryOrder` ("Other" displayed as **#2** while sitting on **row 4**); `onMove` and its
↑/↓ buttons were never passed a handler so they never rendered; the `⋯` button had no
`onClick`; the `⋮⋮` drag handle advertised drag-and-drop that has never existed. **Fourth
instance of the dead-control pattern this phase.**

###### A BUG FOUND WHILE REVIEWING MY OWN WORK

`useState` initializers run **once**. `requestedColumn` / `requestedRow` are read on mount only,
so clicking one "Add here" cell and then a **different** one pushed a new URL the form silently
ignored — it scrolled up and showed the first cell's coordinates. ⚠️ **This flaw already existed
in the G-6b `?column=` wiring**; with one button per column it was easy to miss, with a button
per empty cell it would fire constantly. Fixed with an effect keyed on the raw URL strings that
updates *only* the two position fields, leaving anything already typed intact.

###### TEST CASES — 14/14 passed, over HTTP with a real session, effects verified in the DB

| # | Case | Result |
| --- | --- | --- |
| 1 | Move Marketing onto Other's occupied cell | 200; **swap** — Marketing → col 2 row 4, Other → col 1 row 2; response names the swap |
| 2 | Change **only** the row, same column (**previously impossible**) | 200; New Tech col 1 row 3 → row 4 |
| 3 | Legacy caller: column changes, no row sent | 200; appends to col 3 row 5 — old behaviour preserved |
| 4 | Create into an occupied cell | **409**, message names "Other" |
| 5 | Create into a specific free cell | 200; lands exactly on col 2 row 2 |
| 6 | Fractional row (`2.5`) | **400** |

**Rendered admin HTML** (148 KB, authenticated): 4 row dividers + "New row" band, **8 "Add here"
buttons** — matching 0/2/2/1 empty cells across the four real rows plus 3 in the new band — and
**8 interpolated `Row N` badges** (7 cards + the select trigger), distributed 3/1/1/3 exactly as
the database says. `Column 1 (Left)` present in the **server** HTML, confirming the
`SelectValue`-children fix (a bare `<SelectValue />` server-renders blank — the G-3c trap).
`More actions`, `Move up`, `Move down`, `&#8942;`, `Add to column`: all **0**.

⚠️ **The `Row N` badge count needed a second grep to be trusted.** React splits interpolated
text with `<!-- -->`, so `grep "Row 1"` returned **1** — the divider — and missed all seven card
badges. Same trap that produced a false negative on "Step 1 of 4" in G-5d. **A literal grep for
interpolated JSX text will under-count.**

`tsc` clean; production build clean; database byte-identical before and after the test run.

###### NOT DONE

- **No migration, and no backfill.** The five empty cells are still there — they are *content*
  decisions, not bugs, and are now fixable in the UI in a few clicks. Deciding which categories
  should share a row is the user's call, not a script's.
- **`validateCategoryData` is duplicated** between the two route files (it already was).
  Deduplicating it touches every field, so it is noted rather than folded in here.

##### ✅ G-8 DONE — 4 Aug 2026 (Users)

**36 colours → 0** across 6 files (2 route files, `UserManager`, `UserTable`, `UserForm`, plus
the edit route). The lowest count of any screen in Phase G — this one was already largely on
shadcn primitives.

The user's report was narrow: *"everything looks good, only a few text colours here and there
are not looking that good."* From the screenshot, the specifics were:

- **`text-gray-900` on the "User Management" title** — the dark navy-on-dark that was nearly
  unreadable, plus `text-gray-600` on the subtitle and the Created / Last Login / Created By
  columns.
- Stat-card icons `text-green-600` / `text-blue-600`, the avatar circle `bg-blue-500`, error
  panels `bg-red-50` / `text-red-800`.
- ⚠️ **Two loading spinners built from `border-b-2 border-gray-900`** — a near-black arc on a
  near-black background, i.e. an invisible spinner. Now `border-current`.

###### ⚠️ A real layout bug: the only double-padded screen in the admin

`/admin/users` and its two sub-routes wrapped themselves in `container mx-auto py-6`
(**5 occurrences across 3 files**). `AdminLayout` already supplies `p-4 md:p-6`, so this screen
was padded twice and re-centred at a different width — visibly inset relative to every other
admin page. Grepped `src/app/admin/` to confirm: **no other page does this.** Removed.

###### ⚠️ A HYDRATION DIAGNOSIS OF MINE WAS WRONG — recorded in full

The screenshot also showed the red **"1 Issue"** dev-overlay badge. I saw formatted dates in a
client component and concluded it was the same mismatch that bit `TablesManager`: `date-fns`'s
`format()` has a fixed pattern (so it is immune to the *locale* problem) but renders in the
runtime's **local time zone** — server UTC vs the user's IST, a 5:30 difference on every
timestamp. I wrote that up as the cause, in a code comment, as established fact.

**Then I checked the mechanism and it does not hold.** `UserManager` fetches the user list in a
`useEffect`, so **those rows never exist in the server-rendered HTML**. Verified directly: no
formatted date appears anywhere in this page's server HTML. With no first render, there is
nothing for a second render to disagree with. **This was never the badge's cause, and the cause
remains unknown.** The code comment has been corrected to say so.

The UTC pinning was kept, but described honestly as **pre-emptive, not a fix**: it makes the
output deterministic and removes a latent hazard that would become real the moment this list is
server-rendered — which is the natural fix for its client-side fetch.

⚠️ **The generalisable lesson survives even though the diagnosis did not.** After the
`TablesManager` fix I swept every admin client component for `toLocaleDateString` /
`toLocaleString` and declared only the rich-text ones outstanding. **`date-fns` never appears in
that grep.** The hazard is *"formatting a date in a component that renders on both sides"*, not
*"calling a particular API"* — so the sweep was scoped to a symptom rather than the cause.

⚠️ **Second time this session I asserted a mechanism before verifying it** (the first was the
`isHidden` / public-leak claim). Both times the giveaway was the same: I reasoned from a
plausible pattern to a conclusion about observed behaviour, without tracing whether the pattern
actually applied to *this* code path. **Trace the path before naming a cause.**

###### TEST CASES

**A. Rendered page is clean** — `text-gray-900/600/500/400`, `bg-blue-500`, `text-blue-600`,
`text-green-600`, `bg-red-50`, `text-red-800`: all absent. "User Management" and "Add New
Admin" both present.
**B. Padding** — `container mx-auto` absent from the rendered page and from all of
`src/app/admin/`.
**C. Regression** — all 9 admin routes 200.
⚠️ **An earlier verification run reported all-clear from a file that was never written** — the
fetch had failed (`000`) and the greps ran against a missing path, printing "gone" for
everything. Re-run guarded on `[ -s file ]` and on a non-zero byte count. **A grep against a
nonexistent file is not evidence of absence.**
**D. Open**: the "1 Issue" badge's real cause — awaiting the overlay text from the user.

##### ✅ G-6d DONE — 3 Aug 2026 — and PHASE G-6 IS COMPLETE

`SectionEditor` **54 → 0**. **Phase G-6 total: 8 files, 2,502 lines, 244 colours → 0, and zero
native `<select>`s left on either screen.**

###### ⚠️ THE USER'S CORRECTION: a colour sweep is not a rebuild

After G-6c the user asked, reasonably: *"Why don't I see shadcn components here — like dropdown
and all? It should also have search."*

**They were right, and the gap was mine.** G-6c converted this screen's colours and stopped
there, leaving two native `<select>`s in the picker and two more in the editor. The result
*themed* correctly and was still awkward to use — **31 domains in an unsearchable list**, every
option prefixed with an emoji. The searchable-combobox pattern already existed (Pages in G-4c,
Tables in G-5a(ii)); this screen simply had not been given it.

**The lesson worth keeping: "colours → 0" is a measurable proxy, not the goal.** A file can
score zero and still be a hand-rolled control that ignores the design system. `sections/DomainPageSelector`
having **no imports at all** was the signal I noticed but did not act on.

###### What changed

- **Domain picker** → `Popover` + `Command`. Searches **name, slug and page type**, because most
  domain names start with an emoji and matching the visible label alone is close to useless.
  Each row shows how many section-based pages that domain has.
- **Page picker** → the same, plus a badge showing **whether the page is already configured
  (`N sections`) or not (`unconfigured`) — visible before you pick it.** Previously you had to
  select a page to find that out.
- ⚠️ **The "add page to section" control became a `Command` list, not a `Select`.** It draws from
  the unassigned child pages, and this screen reports **864 child pages** — picking one out of an
  unsearchable dropdown of that length is not workable.
  It also had a subtler flaw: its `value` was never set, so it relied on the browser resetting
  to the placeholder `<option value="">` after each pick.
- **"Add section" column chooser** → shadcn `Select`. ⚠️ Radix needs a **string** `value`, so the
  number is stringified in and parsed out; the state stays a number because the section model
  expects one.
- ⚠️ **Two emoji-string icon helpers replaced with lucide components:** `getDomainIcon()`
  (🎯 / 📁) and `getPageIcon()` (📊 📝 📂 📋 📄 🎨). Both now use **the same icons as the Domains
  table and `PageTree`**, so a "table" page or a "direct" domain looks identical everywhere in
  the admin. `tsc` caught two `getPageIcon` call sites I had missed when removing it.

###### TEST CASES

**A. No native selects** — 0 across all 4 files; the 4 grep hits are comments quoting what was
removed.
**B. Colours** — 0 across all 4 files (2 comment hits).
**C. Rendered** — `/admin/sections` returns 200 with **2 `role="combobox"` triggers**, and
"unconfigured" / "Choose a domain first" present. `Search pages` is Portal-mounted so it
correctly does not appear until opened.
**D. Regression** — `/admin`, `/admin/categories`, `/admin/domains`, `/admin/pages`,
`/admin/tables`, `/admin/sections` all 200. ⚠️ Verified against the **user's own dev server**,
because `:3000` was up — checked in a separate command first, per the G-5b rule.
**E. Still to check in a browser**: dark mode; searching the domain and page pickers; adding a
section; adding a page to a section via the new searchable list; and the type icons rendering.

##### ✅ G-6c DONE — 3 Aug 2026 (Section Layout — shell, manager, picker)

**Colours: page 14 → 0, `SectionsManager` 8 → 0, `sections/DomainPageSelector` 33 → 0.**

###### Patterns now seen four times each

- **The fourth local `StatsCard` copy** — after the dashboard's, `tables/[id]`'s and
  `tables/`'s. Each drew its own `bg-white` panel and took an emoji string as its icon. All four
  are now the shared component.
- **The fourth hand-rolled `bg-gray-200` + `animate-pulse` skeleton** → shadcn `Skeleton`.
- ⚠️ **The third duplicate page title.** `SectionsManager` rendered its own
  "🎯 Section Configuration" heading and subtitle directly beneath the page's own title — the
  same duplication found in `TablesManager` (G-5a(ii)) and created accidentally in G-5a(i).
  **This is now a predictable consequence of rebuilding a shell and its child separately**, and
  worth checking for by default rather than discovering each time.

###### ⚠️ A stat that measured the wrong thing

Four tiles became three. **"Total Domains" counted every domain in the system** — a number that
tells you nothing about section layout and never changes as you work. The two that matter are
how many pages *can* have sections and how many you have configured; "Configured" now carries
the remainder in its own description rather than needing a fourth tile to compare against.

###### ⚠️ `sections/DomainPageSelector.tsx` had NO imports

Not "few" — **zero**. Adding the first one broke my usual `0,/^import /` insertion, which found
nothing to anchor to and silently did nothing, and `tsc` caught the missing symbol. Worth noting
because a file with no imports is a hint in itself: it was pure hand-rolled markup with two
native `<select>`s, using nothing from the design system at all.

###### TEST CASES

**A. Rendered page is clean** — `bg-white`, `text-gray-900/700/600`, `border-gray-300/200`,
`bg-blue-50`, `bg-green-50`, `bg-yellow-50`: all absent.
**B. Duplicate chrome gone** — "Section Layout Management", "Section Configuration" and
"Total Domains" all absent.
**C. New shell present** — "Section layout", the configured-ratio description, the three tiles,
and the "Select a page to configure" empty state.
**D. Still to check in a browser**: dark mode; picking a domain then a page and confirming the
editor appears below.

⚠️ **Deferred by the user (3 Aug):** *"there are some more improvements on this page"* for
**Categories** — noted and not yet specified. `/admin/categories` is colour-clean and its known
defects are fixed, but the user has further UX changes in mind for a later pass.

##### ✅ G-6b DONE — 3 Aug 2026 (`CategoryForm`) — and `/admin/categories` is complete

**47 → 0 colours.** With G-6a, the entire Categories screen (4 files, 1,417 lines, 135 colours)
is colour-clean.

###### 🎉 `Roboto` IS RETIRED FROM THE APP

This file held the **last** `next/font/google` importer other than the root layout. It styled
every label in the form, fighting the app-wide Geist and paying for a second webfont download
to do it.

**Verified: the only remaining importer is `src/app/layout.tsx`'s `Geist` / `Geist_Mono`** —
which is the legitimate one. The sweep that started at **7 files** in G-3a is finished.

###### The same shape of problems as `DomainForm` before G-3c

- **`text-black` labels and `bg-gray-200 text-gray-800` inputs** — in dark mode, black labels
  on a dark card with light-grey input boxes. This was the light panel visible at the top of
  the user's screenshot.
- ⚠️ **`alert()` + `window.location.reload()`** on save. Both callbacks are optional, so the
  create form on `/admin/categories` — which passes neither — hit that branch **every time**:
  a blocking browser alert, then the whole document thrown away. Now `onSuccess?.()` plus
  `router.refresh()`.
- ⚠️ **Cancel was gated on `isEditMode && onCancel`** — the identical bug `DomainForm` had:
  the create form rendered no Cancel even when handed one. Now shown whenever a handler exists.
- The `bg-red-50` error panel → destructive `Alert`; `bg-blue-600` submit → default primary.

###### ✅ The `?column=N` promise from G-6a is now kept

G-6a's "Add to column N" buttons push `?column=N`; this step makes the form read it. Two
details that matter:

- ⚠️ **Clamped, not trusted.** The value comes from the URL, so `?column=99` is possible and
  the API rejects anything outside 1–3. Out-of-range falls back to 1.
- ⚠️ **Edit mode wins over the URL.** An existing category's own column must not be silently
  changed because `?column=2` is left in the address bar from an earlier click.
- After a successful create the form resets to the **requested** column, not hardcoded 1, so
  adding several categories to column 3 in a row does not reset the field each time.

###### TEST CASES

**A. The whole page is colour-clean** — `bg-white`, `text-gray-900/800/700/500`,
`bg-gray-200`, `border-gray-300/200`, `bg-blue-600`, `text-black`: **all absent** from the
rendered page.
**B. Column pre-selection** — `?column=1` → `value="1" selected`; `?column=3` →
`value="3" selected`; ⚠️ `?column=99` → falls back to `value="1" selected`.
**C. Roboto** — `grep -rn "^import.*next/font/google" src/` returns **only** `layout.tsx`.
**D. Regression** — all 9 admin routes and `/domain` return 200.
⚠️ **A first attempt at (D) reported 307 across the board** — my session cookie had expired
(10-minute `maxAge`), exactly the trap recorded in G-3b. Re-run with a fresh cookie before
believing a wall of redirects.
**E. Still to check in a browser**: dark mode on the form; creating a category (no alert, no
white flash, appears in the layout below); clicking "Add to column 3" and confirming the form's
column field is already 3.

##### ✅ G-6a DONE — 3 Aug 2026 (Categories — shell + list)

**Colours: page 16 → 0, `CategoryList` 34 → 0, `CategoryCard` 38 → 0.**

###### ⚠️ BOTH modal overlays rendered solid black

`bg-opacity-50` appeared **twice** in `CategoryList` (the delete confirm and the edit modal).
It is Tailwind **v3** syntax, removed in **v4** — which this project uses — so the utility was
silently dropped and only `bg-black` applied. Both overlays blacked out the entire page.

This is the **same bug fixed in `DomainsTable` in G-3b**, and it was recorded then as still
live here. Both are now real `AlertDialog` / `Dialog`, which also brings Escape-to-close, focus
trapping, focus restoration, `aria-modal` and scroll lock. *(The delete modal also carried
`w-mx` — not a real Tailwind class — the identical typo `DomainsTable` had.)*

###### ⚠️ Four controls that lied about what they did

1. **"Create First Category"** in the empty state — no `onClick`, no `href`. It rendered, it
   was clickable, and it did nothing (the #22.5 pattern, third occurrence). The form is at the
   top of the same page, so it now points there rather than inventing a route.
2. **"Drag categories to reorder within columns or move between columns"** — the Column Layout
   subtitle. **There is no drag-and-drop anywhere in these components**: grepped for
   `draggable`, `onDragStart`, `onDrop` and every dnd library — nothing. `CategoryList`'s own
   header comment says "drag-and-drop in future". The label was instructing the user to do
   something impossible; it now describes how reordering actually works.
3. **Three "Add Category to Column N" buttons** whose entire handler was
   `window.scrollTo({ top: 0 })`, with a `TODO` admitting the column was not pre-selected. So
   after telling the app which column you wanted, you scrolled to a form and had to pick it
   again. They now also record the choice as `?column=N`. ⚠️ **The form does not read that
   parameter yet — that is G-6b.** Flagged rather than left implied.

###### ⚠️ The delete dialog contradicted the API

It read *"Any domains in this category will need to be reassigned"*, implying the delete would
succeed and leave you to tidy up. In fact `DELETE /api/admin/categories/[id]` **refuses**
outright when the category holds domains, returning
`"Cannot delete category. It contains N domain(s)…"`.

And the UI **threw that message away**, replacing it with
`alert('Failed to delete category. Please try again.')` — advice that is not merely unhelpful
but wrong, since a retry fails identically every time.

`domainCount` was already on the category object, so the dialog now:

- states the count and **disables the delete button** when it is non-zero, preventing the
  doomed attempt entirely;
- shows the **server's own message** verbatim if a delete does fail.

###### TEST CASES

**A. Rendered page is clean** — `bg-white`, `text-gray-900/600`, `border-gray-200`,
`from-blue-50`, `bg-blue-50`, `bg-gray-50` and ⚠️ **`bg-opacity-50`**: all absent.
**B. Copy corrected** — "Drag categories" and "Create First Category" both gone.
**C. New shell present** — the header count, "Create a category", "Column layout", the
corrected reorder sentence, "Category tips".
**D. ⚠️ Three classes remain on the page** (`text-gray-500` ×7, `border-gray-300`,
`border-gray-200`) and were **attributed by grep to `CategoryForm`** — G-6b, rendered on this
page. Not stragglers from this step.
**E. Roboto** — now **one** importer left in the whole app (`CategoryForm`, G-6b);
`layout.tsx`'s Geist is the legitimate app-wide font.
**F. Still to check in a browser**: both dialogs opening and dimming rather than blacking out;
deleting a category that has domains (should refuse with the count) and one that has none.

##### ✅ G-5d(iii) DONE — 3 Aug 2026 — and PHASE G-5 IS COMPLETE

`TablePreview` **53 → 0** and `CSVUploadInterface` **44 → 0**. With this, **all 10 files of the
Tables screen carry 0 hardcoded colours** — the remaining grep hits across the phase are
comments quoting what was removed.

**Phase G-5 totals: 253 → 0 colours across 3,872 lines, with one new dependency
(`alert-dialog`, added in G-3b and reused here).**

- ⚠️ **`Card` has no `variant` prop.** A mechanical find-and-replace turned
  `className="border-red-200 bg-red-50"` into `variant="destructive"` on a `Card`, and **`tsc`
  caught it** — `Property 'variant' does not exist`. The error block is now a proper
  destructive `Alert`, which is the primitive that actually carries that treatment *and*
  brings the right ARIA role for a message the user must notice. Worth recording as the
  limit of sed-driven colour sweeps: they cannot know which component accepts which prop.
- ⚠️ **The outstanding hydration hazard is fixed.** `TablePreview`'s date cell formatter used
  a bare `toLocaleDateString()` — the same class of bug that produced the "1 Issue" badge on
  `/admin/tables`. Now pinned to `en-GB` + `timeZone: 'UTC'`.
- Four stat tiles that used `text-blue-600` / `text-green-600` / `text-orange-600` for
  Sortable / Filterable / Required are now uniform. The colours distinguished categories that
  are already distinguished by their labels, and none of them themed.
- `bg-white divide-gray-200` preview tables → `divide-y` on the themed surface; ✅ and ℹ️ status
  emoji → lucide; `bg-green-600` on the import button → default primary.

###### ⚠️ Hydration sweep — where things stand now

Every **client** component under `src/components/admin/` was re-checked for unpinned
locale formatting. **One remains:**

- `HtmlEditor.tsx:435` — bare `toLocaleString()` → **G-7** (rich text)
- *(`RichTextManager.tsx:117` pins the locale but not the time zone — partial; also G-7)*

###### TEST CASES

**A. Every route 200** — `/admin`, `/admin/tables`, `/admin/tables/[id]`, `/admin/tables/new`,
`/admin/sections`, `/admin/pages`, `/admin/domains`.
**B. Wizard steps 3–4 copy in the client bundle** — "Upload errors", "CSV Format Requirements",
"Data Ready for Import", "Empty Table", "Total Columns".
**C. Colours** — 0 outside comments in all five G-5d files.
**D. Still to check in a browser**: dark mode on the Upload and Preview steps; a CSV with a
deliberate validation error, to see the new `Alert`; and the date column rendering in a preview.

##### ✅ Two search affordances added on request — 3 Aug 2026

Both came from the user testing the rebuilt screens and finding the same problem in two
places: a list long enough that you have to read every entry to find one.

**1. Page search in the wizard's step 2** (`tables/DomainPageSelector`). Selecting a domain
like "Graphic Designing" lists **26 pages**, with no way to narrow them. Now a search matching
**title and slug** — either is what you might remember. Details:

- Rendered only when `availablePages.length > 5`; a search box above a two-item list is chrome
  that cannot help.
- ⚠️ **The term is cleared when the domain changes.** A leftover term would filter the new
  domain's list to nothing and read as "this domain has no pages".
- The list gained `max-h-80 overflow-y-auto`, so a 26-page domain no longer pushes the
  wizard's Next button far below the fold.
- A distinct empty state for "search matched nothing" — reachable only when the search filtered
  everything out, since the surrounding block already requires at least one page.

**2. The `/admin/tables` domain filter became a searchable combobox.** It was a shadcn
`Select` listing all **33** domains with no filter. Now `Popover` + `Command` — type-to-filter,
arrow keys, Enter, Escape — the same pattern the Pages screen's picker got in G-4c.
⚠️ Its searchable `value` includes the **slug** as well as the name, because most domain names
begin with an emoji ("🖌️ Graphic Designing"), so typing the visible label is often not how you
would look for one. Each row also shows that domain's table count.

⚠️ **A colour my sweep missed:** `text-orange-600` on the "already has a table" warning, because
my grep pattern did not include `orange`. Now `text-destructive` with a lucide icon. Worth noting
that a colour sweep is only as complete as its pattern — the count "31 → 0" was measured with a
pattern that could not see this one.

⚠️ **Two comments in `TablesManager` went stale** when the `Select` was replaced and were
rewritten rather than left to mislead: the summary line still claimed the control was a
`Select`, and the `ALL_DOMAINS` note justified the sentinel by a Radix `SelectItem` constraint
that no longer applies. (The sentinel is still needed — `''` would be indistinguishable from
"nothing selected" in the comparisons.)

##### ✅ "By domain" tab removed + a mislabelled stat fixed — 3 Aug 2026

The user asked whether the "By domain" tab was still needed, since it "makes you scroll a lot".
It was not. **Three tabs became two.**

It rendered one card per domain, each listing every table beneath it — sensible before this
screen had a domain filter, redundant afterwards:

| | "By domain" tab | Filter on "All tables" |
| --- | --- | --- |
| See one domain's tables | ✅ | ✅ |
| Paginated | ❌ **all 652 links** | ✅ 24 at a time |
| Searchable by table name | ❌ | ✅ |
| Per-domain count | ✅ | ✅ (added to each filter row) |

⚠️ **It was the only unpaginated list left on the screen**, which is why the page still
scrolled forever and which partly undid the pagination from G-5a(ii). Its one unique offering —
several domains side by side — was judged not worth that. `DomainCard` was deleted with it;
`domainsWithTables` is kept, because the domain filter still needs it.

###### ⚠️ A stat that contradicted the list beside it: 33 vs 31

Spotted while assessing the tab. The tile read **"Domains holding tables: 33"** while the tab
beside it read **"By domain (31)"**. Both numbers were correct and measured different things:

```js
totalDomains      = domains.filter(d => d.pages.length > 0)          // 33  (pages already
                                                                     //      filtered to
                                                                     //      contentType 'table')
domainsWithTables = domains.filter(d => d.pages.some(p => p.table))  // 31
```

So **two domains have a table-type page with no table created on it yet.** The tile's *label*
described the 31 — it was counting domains holding table-**pages**, not tables. Fixed by making
the number match the label, which also makes it agree with the domain filter's own list.
Verified: the tile now renders **31**.

⚠️ Worth noting the general shape: two numbers derived from the same query by slightly
different predicates, displayed side by side under near-identical labels. Neither was "a bug"
in isolation — the defect only existed in the pair.

###### Two more stale comments corrected

Removing the tab left the file's header comment claiming "Three views… a flat list, grouped by
domain, and recent activity", and left `Globe` imported with zero remaining uses. Both fixed.
That is now **three separate occasions** in this screen where a rewrite left a comment
describing the previous behaviour — worth a habit of grepping the file's own prose after
removing a feature, not just its code.

##### ⚠️ CORRECTION — `DomainPageSelector` is NOT one shared component. There are TWO.

When planning G-5d I wrote that `DomainPageSelector` was "also rendered by `SectionsManager`,
so changes here hit G-6's screen too". **Wrong.** There are two separate files:

| File | Lines | Colours | Props |
| ---- | ----- | ------- | ----- |
| `admin/tables/DomainPageSelector.tsx` | 378 | 31 | `onSelection(domain, page)` |
| `admin/sections/DomainPageSelector.tsx` | 210 | 33 | `onDomainChange`, `onPageChange` |

Different sizes, different prop contracts, **436 differing lines** ignoring whitespace. They
are two independent implementations that happen to share a name and a purpose.

⚠️ **The error was the same shape as the `isHidden` mistake earlier this session:** a grep
matched the *name* in two directory trees and I concluded it was the *same file*, without
checking the imports. `SectionsManager` imports `'./DomainPageSelector'` — its own local one.
**Matching a symbol name is not establishing identity.**

Two consequences, both good to know:

- **G-5d(ii) is simpler than planned** — rebuilding the tables one cannot break the Sections
  screen, and no second caller needs checking.
- ⚠️ **But it is a genuine duplication finding for G-6.** Two components solving "pick a domain,
  then pick one of its pages", maintained separately — the same class of problem as #22.4, where
  four copies of parent-chain traversal were consolidated into `src/lib/page-path.ts`. Whether
  they should merge is a G-6 decision: their prop shapes differ, and the Sections one filters
  for *sectionable* pages while the tables one filters for `table`/`narrative`.

##### ✅ G-5a(i) DONE — 3 Aug 2026 (tables list — page shell)

**`app/admin/tables/page.tsx`: 15 colours → 0.** Never touched by an earlier phase, so it
painted a `text-gray-900` heading and `bg-white` stat cards onto the dark theme — the same
story as `[id]/page.tsx` in G-5b.

- `AdminPageHeader` (G-2) replaces a hand-rolled `text-3xl` title and `border-b` rule, and
  gives **"New table" a home in the header** — previously the only way to create one was a
  button buried inside `TablesManager`.
- The **third** local `StatsCard` copy in this codebase is gone (after the dashboard's and
  `[id]/page.tsx`'s), replaced by the shared component.
- The loading skeleton was hand-rolled `bg-gray-200` blocks in an `animate-pulse` wrapper →
  shadcn `Skeleton`, which carries `bg-accent` and its own pulse. ⚠️ In dark mode the old
  skeleton made the **loading state the brightest thing on screen**.

⚠️ **A stat was dropped, not restyled.** "Recent Updates" rendered
`stats.recentActivity.length`, and `recentActivity` is `tablesWithCounts.slice(0, 5)` — so the
number was **always 5** for any project with five or more tables. A metric that cannot change
is not a metric. The recent-activity *list* is still rendered by `TablesManager`, where the
entries carry real information.

###### ⚠️ The payload is NOT addressed by this step

Measured after the rebuild: **2.48 MB** for `/admin/tables`. ⚠️ That figure is from the **dev
server**, which adds substantial overhead, so it is **not** comparable to the 1.73 MB recorded
from a production build in #22.1 — it is not evidence of a regression. What it does confirm is
that the page still ships every table's metadata at once. Closing that is **G-5a(iii)**, and it
needs server-side pagination, not a client-side slice.

###### TEST CASES

**A. New shell renders** — "N tables holding N rows", "New table" action, and the three stat
tiles (Tables / Rows / Domains).
**B. Old shell gone** — "Table Management", "Recent Updates", "Tables updated recently": all
absent.
**C. Colours** — 0 outside comments.
**D. ⚠️ Verified against the user's own dev server, read-only**, because `:3000` was up —
checked in a separate command first, per the rule from G-4d/G-5b.
**E. Still to check in a browser**: dark mode on the header and stat tiles. ⚠️ The list itself
will still look wrong until **G-5a(ii)** — `TablesManager` carries `bg-white` at line 121.

##### ✅ G-5a(ii) DONE — 3 Aug 2026 (`TablesManager`)

**25 colours → 0.** `/admin/tables` now themes correctly end to end.

- ⚠️ **`bg-white rounded-lg border border-gray-200` on the outer wrapper** was the single line
  responsible for this screen still glaring in dark mode after G-5a(i) — a white sheet under a
  themed page.
- ⚠️ **A DUPLICATE HEADER.** This component rendered its own "Tables Dashboard" heading,
  subtitle *and* a "➕ Create Table" button. G-5a(i) added `AdminPageHeader` with a "New table"
  action above it, so the screen had **two titles and two create buttons stacked**. Caught only
  because the rebuild put them side by side — worth remembering when a page shell and its
  child are rebuilt in separate steps.
- A native `<select>` with `border-gray-300 focus:ring-blue-500` → shadcn `Select`, with
  explicit `SelectValue` children so the label survives pre-hydration (the G-3c trap).
- **The view toggle was a dropdown** labelled "📄 View" that had to be opened to flip a binary,
  and showed its state only through an icon nobody reads as state. Two `aria-pressed` buttons.
- ⚠️ **`key={index}` on the activity list** → keyed on timestamp + table name.
- **`alert()` on a failed export** → an inline message on the card that failed (#22.6).
- `DomainCard` made the whole row a link instead of a floated `text-blue-600` "Edit" anchor,
  and stopped filtering the same array twice (once for the count, once for the list).

###### ⚠️ Pagination — effect measured, not assumed

All 652 tables rendered at once, each with its own dropdown menu. Now 24 per page. Measured on
a **production** build of `/admin/tables`, total **1.73 MB → 675 KB**:

| Part | Before | After |
| ---- | ------ | ----- |
| Rendered HTML | ~1.2 MB | **136 KB** (24 cards exist in the DOM, not 652) |
| RSC flight data | 539 KB | **539 KB — unchanged** |

⚠️ **This corrects a claim I made when planning the step.** I said client-side pagination
"would shrink the DOM but **not** the payload". Measured, the total transfer fell by about a
megabyte — so it *is* a real payload win. What is untouched is the **data** portion: search and
filtering run in the browser, so the whole list still has to be sent. Those 539 KB are exactly
what **G-5a(iii)** would remove by moving filtering and pagination into the query.

⚠️ Page number is **clamped on render**, not corrected in an effect: search down to 3 results
while on page 20 and a raw slice returns empty — a list that looks broken rather than filtered.
An effect would flash that empty state for one frame before fixing itself.

###### TEST CASES

**A. Zero light-only classes on the rendered page** — `bg-white`, `text-gray-900/600/500`,
`border-gray-200/300`, `hover:bg-gray-50`: all absent.
**B. Duplicate chrome gone** — "Tables Dashboard" and "Create Table" both absent.
**C. New controls present** — the three tabs with counts, "All domains", the search field.
**D. Pagination active** — **24** `Actions for …` menus rendered, not 652.
**E. Still to check in a browser**: dark mode; the list/grid toggle; that searching resets to
page 1; that a search matching nothing shows "No tables found" *without* offering
"Create a table"; and an export failure showing inline rather than as an alert.

###### ⚠️ HYDRATION MISMATCH — found from a screenshot, fixed, confirmed gone

The user's screenshot showed a red **"1 Issue"** badge (the Next dev overlay) on
`/admin/tables`, which they identified as a hydration error. Three causes, **all in
`TablesManager`** — a client component that is server-rendered first, so every string it
formats is produced **twice**, once by Node and once by the browser:

| What | Was | Why it mismatched |
| ---- | --- | ----------------- |
| "Updated …" | `toLocaleDateString()` | Node resolved **en-US** → `8/3/2026`; the browser is **en-IN** → `3/8/2026`. ⚠️ Not merely a mismatch — **day and month swap**, so one of the two renders a *wrong date*. |
| Activity timestamp | `toLocaleString()` | Same, plus time zone. |
| Row count | `toLocaleString()` | Easy to miss: thousands separators are locale-specific too — `1,198` / `1.198` / `1 198`. |

All three now pin **locale and time zone** (`en-GB`, `timeZone: 'UTC'` — UTC because Prisma
returns UTC), via `formatDate()` / `formatCount()` helpers with the reasoning written at each.
**Confirmed by the user: the badge is gone**, and dates render as `Updated 3 Aug 2026`.

⚠️ **Why `StatsCard` and the page shell were safe** despite calling `toLocaleString()`: they
are **server** components, so they render once. This hazard exists in client components only —
which is exactly why it is easy to introduce without noticing.

⚠️ **Two instances remain, both outside this screen**, and both should be fixed when their
phase comes round:

- `TablePreview.tsx:417` — bare `toLocaleDateString()` → **G-5d**
- `HtmlEditor.tsx:435` — bare `toLocaleString()` → **G-7**
- *(`RichTextManager.tsx:117` pins the locale but **not** the time zone — partial: a timestamp
  near midnight UTC would still render a different day on the two sides.)*

##### Component map

```
/admin/tables        → TablesManager
/admin/tables/[id]   → TableEditor → DataTable (public, read-only) + CSVUploadInterface
/admin/tables/new    → TableCreationWizard → DomainPageSelector + TableSchemaEditor
                                           + TablePreview + CSVUploadInterface
```

⚠️ **`DomainPageSelector` is shared with `SectionsManager`**, so G-5d's changes will land on
the Section Layout screen too — which is G-6. Worth doing them in that knowledge rather than
discovering it afterwards.

##### Other findings

- **⚠️ `admin/pages/page.tsx` declares `Roboto` and never uses it.** `roboto` is referenced
  exactly once — at its own declaration. Dead weight, unlike the other three importers which
  at least apply `roboto.className`.
- **⚠️ Delete never states the blast radius.** `DELETE /api/admin/pages/[id]` deletes the page
  **and every descendant** in a transaction; the UI guard is a browser `confirm()` reading only
  "This action cannot be undone". The API already computes the descendant count and already
  refuses to delete `__main__` (#11) — so the count exists and is simply not shown. Same
  treatment as the domain delete in G-3b. Lands in **G-4b** with the `confirm()`/`alert()`
  removal (#22.6).
- **`DomainSelector` is a hand-rolled dropdown** — `useState(isOpen)` plus a div. No Escape, no
  focus trap, no click-outside dismissal. With 35 domains it should be searchable.
- **`PageTree` puts four emoji buttons on every row** (`+`, 🔗, ✏️, 🗑️) — the exact pattern
  replaced in G-3b, including a destructive delete adjacent to edit.
- The page shell has a gradient banner plus a large hardcoded "Understanding Domain Types"
  explainer panel in cyan/blue/purple — reference material that is read once and then scrolled
  past forever, the same case as the Domains tips box (which became a closed `Collapsible`).

---

## 🔴 #28 — Editing a `__main__` page made it its own parent and detached the whole domain

**Found 10 Aug 2026, by the user, in testing, minutes after #26 shipped. Fixed same day.**
**Development branch only — production was never touched.**

### What happened

Edited the Graphic Designing `__main__` page to remove the emoji from its title. The title saved
correctly. Then:

- `/admin/pages` for that domain showed **"No pages yet — 0 pages"**
- `/domain/gdesign` returned **not found**
- the terminal filled with `[page-path] parent cycle detected at page ecab70c3…, skipping`

Repeated on Game Development, with the same result. **43 and 31 pages respectively disappeared
from every surface at once.**

### What was actually wrong

**Two rows.** Nothing was deleted — all 1,216 pages were in the database the entire time. Both
`__main__` rows had `parentId` set to **their own id**.

`buildPageHierarchy` walks upward through `parentId`. Seeing the same id twice, it logs the cycle
and drops the row — and every child hangs off that row, so the whole domain goes with it. The
115 pages that also reported cycles were simply its descendants inheriting the broken walk.

### The cause — `||` cannot tell "no value" from "deliberately null"

`PageForm.tsx` computed the parent default as:

```tsx
parentId: editingPage?.parentId || parentId || (isDirect ? (mainPage?.id ?? null) : null)
```

Correct for every ordinary page. A trap for `__main__`, because **`__main__`'s own `parentId` is
`null` — it is the root** — so the chain fell straight through:

```
editingPage.parentId → null       falsy → skip
parentId prop        → null       falsy → skip
mainPage.id          → ecab70c3…  ← THE ID OF THE PAGE BEING EDITED
```

⚠️ **`null` here is a meaningful value, not a missing one, and `||` erases that distinction.**

### ⚠️ Why it appeared only now — an unrelated fix made a latent bug reachable

This expression has been wrong since G-4d. It never caused harm because **saving a `__main__`
page always failed on the slug rule (#26)** — the value was computed on every edit and never once
written.

#26 was a correct fix. It simply let the save complete for the first time, and the save carried
this with it.

⚠️ **Generalisable: removing a blocker exposes everything the blocker was silently absorbing.**
When a fix makes a previously impossible operation possible, the operation's whole payload is
new, not just the field the fix was about. My #26 testing checked slug and title. It never looked
at what else the same request wrote.

### ⚠️ And the server's cycle guard reported "no cycle" while creating one

```ts
const isCircular = await isDescendantOf(parentId, id);   // "is my new parent BELOW me?"
```

Pass `parentId === id` and it loads that page, finds `parentId: null` — a root, nothing above it
— and returns `false`. The guard asks *"is the new parent a descendant of me"* and never *"is the
new parent me"*. **A one-node loop is the one cycle a descendant-walk cannot see**, because the
walk starts by stepping past the node.

### The fix — three parts

| | Change |
| --- | --- |
| **Data** | `parentId = null` on the 2 self-parented rows. Not a guess: a `__main__` page is its domain's root and `buildPageHierarchy` reads null as "top of the tree". Repair script targeted only ids verified self-parented, and refused to run against production. |
| **Client** | `PageForm.tsx` — `isEditingMainPage` short-circuits the `\|\|` chain to `null`. |
| **Server** | `PUT /api/admin/pages/[id]` — explicit `if (parentId === id)` → 400, above the descendant check. |

The server guard is not redundant. That endpoint is reachable by any authenticated admin request,
not only through one component, **and a corrupt tree costs far more to notice than a 400 does.**

### Verification — 12/12, `next dev` on :3000

Test 1 replays the exact payload the form sent. If that returns 200, nothing else matters.

| Case | Result |
| --- | --- |
| `parentId` = own id on `__main__` → 400, DB untouched | PASS ×3 |
| same on an ordinary page → 400, DB untouched | PASS ×2 |
| a real `__main__` title edit → 200, `parentId` still null, slug still `__main__` | PASS ×4 |
| `/domain/gdesign` renders again | PASS |
| **a legitimate re-parent still accepted** (guard not over-broad) | PASS |
| 0 cycles across all 1,216 pages | PASS |

### ⚠️ Lessons

1. **`||` on a field where `null` is legal is a bug waiting for the right row.** Use `??`, or
   branch explicitly. Root/parent, zero, and empty-string fields are where this bites.
2. **Fixing a validation error opens the whole write path, not one field.** After #26, the
   correct question was "what else does a successful `__main__` save now write?"
3. **A guard that has never rejected anything is untested.** `isDescendantOf` had presumably
   never returned `true` in production; its blind spot was free to sit there.
4. **Test the operation, not the field.** #26's tests asserted on slug and title — both correct
   — while the same request corrupted a third column.
5. Loud logging saved this. `[page-path] parent cycle detected` named the exact page id, which
   turned an alarming "my data is gone" into a two-row repair.

---

### Phase G — original scope notes

| Done | # | Item | Notes |
| ---- | - | ---- | ----- |
| ~ | **#21** | Dark / light mode | **Phase 1 (public) DONE 29 Jul** — `next-themes` was installed but never imported, so every `dark:` utility was inert. Rich-text keeps a deliberately **light** card: 574 of its 2,519 inline colour declarations are dark and inline styles beat stylesheets. |
| [ ] | **#21 Phase 2** | Admin dark mode — **as a shadcn rebuild, not a colour sweep** | 1,146 hardcoded colours across 45 files. Per the user's direction: rebuild on the [sidebar block](https://ui.shadcn.com/blocks/sidebar), `button`, `breadcrumb`, `sheet`. Better *and* less work — replacing hand-rolled markup **deletes** its hardcoded colours rather than needing each swapped — and it brings responsive/mobile handling the admin shell has none of. |
| [ ] | **#22.6** | `router.refresh()` instead of 6 × `window.location.reload()`; `dialog` instead of 8 × `alert()` / 3 × `confirm()` | Fold into the rebuild — do not port `alert()` calls into freshly written components. ⚠️ `confirm()` is *synchronous*, so each call site needs restructuring, not substituting. |
| [ ] | — | `/admin/tables` pagination | The entire residual 1.73 MB after #22.1 is 652 unpaginated cards. A UI change, so it belongs with the rebuild. |

**Suggested order for Phase 2 itself:** (1) `AdminLayout` + `AdminSidebar` + `AdminHeader` →
shadcn shell, since that is the most visible surface; (2) shared primitives across the 32 admin
components, where most of the 1,146 occurrences live; (3) token swap for whatever bespoke markup
remains.



### Still open, outside the phases

| | Item | Owner |
| - | ---- | ----- |
| 🔴 | **#8 / #8-DR** — the geo decision. Gates static rendering for 1,198 pages, the largest remaining performance item. | **Needs a product decision** — see *Open decisions* below |
| 🟡 | **#4** — delete the 15 merged branches | Yours (GitHub UI + local) |
| 🟡 | **`bread.tsx:159`** — the *visible* breadcrumb still matches pages by slug alone, with no `parentId` filter. Only safe because all 20 ambiguous slugs are **leaves**. Add one intermediate page with a duplicate slug and the trail goes wrong. | ~30 min, latent |
| ⬜ | **Structured error responses** — two competing contracts (`{error}` ×71 vs `{success:false,message}` ×14) across 18 route files | Deferred: no behaviour change, and the leak originally suspected was already dev-gated |
| ⬜ | **General IP rate limiting** | Deferred: needs Upstash to work on serverless, and there is no evidence of abuse. Login is covered by #16 |
| ⚠️ | **Neon role password rotation** — `npg_…` is shared across every branch including production and has appeared in a chat transcript | Yours; all DB work is finished so nothing blocks it |
| ⚠️ | **`admin@example.com` on the development branch** — would return to production if that branch were ever promoted | Yours, same as the production deletion |



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
*Revision 40 (Aug 1): **G-4b/c/d DONE — `/admin/pages` is fully rebuilt.* **191 hardcoded
colours across 5 files → 0, with zero new dependencies.** *The tree was the worst-reading
screen in the admin and the reason was measurable: every row printed its own labels beneath
each value, so a 50-page domain rendered* **150 redundant "Slug"/"Preview URL"/"Parent"
labels**, *and the Parent column repeated the constant* `__main__ (Hidden)` *49 times. Deleted
both, plus the full preview URL that shared an identical prefix on every row — rows went from
three lines to one.* **Found a keyboard trap:** *the four per-row actions were* `opacity-0
group-hover:opacity-100`, *and* `opacity-0` **does not remove an element from the tab order** —
*200 invisible tab stops in a 50-page tree, one of them delete, and unreachable entirely on
touch. The domain picker (the first thing you touch on every visit) had* **no search across 37
domains**, *no Escape, no focus trap; now* `Popover`+`Command`, *searching slug and category
too because 34 of 37 names start with an emoji.* **Two real bugs in the form:** *the parent
option labelled "Default (`__main__` page)"* **detached the page from `__main__` when editing**
*— POST compensates for a null parent, PUT stores it verbatim — fixed in the form by removing
the ambiguous option entirely so both endpoints get a concrete id; and the parent list's*
`'  '.repeat(depth)` *indentation* **never rendered, because HTML collapses whitespace**.
*Also fixed a page count that contradicted itself on screen (badge "3 pages" vs tree "116
pages" — it was counting roots).* ⚠️ **Tooling lesson recorded:** `next build` *and* `next dev`
*share* `.next`, *so building while the user's dev server was serving produced*
`PageNotFoundError` *for four routes* **after** *reporting "Compiled successfully", and killed
their server. Check :3000 before building.*

*Revision 39 (Aug 1): **G-4a DONE — the Pages tree was throwing away every page it fetched.**
Audited the Pages screen (5 files, 1,826 lines, 191 colours) and found a stale-closure bug with
two symptoms and one cause:* `fetchPagesForDomain` *read* `selectedDomain` *from state instead of
using the domain it was asked to fetch. On mount the effect called* `setSelectedDomain(d)` *then
the fetch — but a state setter does not reach into a closure that already exists, so the call saw
the initial* `null`, *and* `buildPageHierarchy` *opens with* `if (!domain …) return []`. **The
request succeeded and its 70 pages were discarded**, *and the effect never re-ran because its deps
had not changed. Second symptom: after switching domains the closure held the* **previous** *one,
so paths and preview links were built from the wrong* `pageType` *and the wrong* `domain.slug`.
*Very likely a large part of the #20 complaint. Fixed by passing the domain object as an argument
—* **preferable to adding it to a dependency array, because it removes the timing question rather
than trying to win it**. *Committed alone: one file, logic and comments only,* **zero JSX
touched**, *per this phase's own "fix real bugs in a separate commit" rule. Proven without a
browser as a three-link chain (API returns 70 pages → the guard returns* `[]` *when domain is null
→ the closure held null on mount), each link checked separately. G-4b/c/d planned and recorded.*

*Revision 38 (Aug 1): **G-3c DONE — `/admin/domains` is now fully rebuilt.** Colours* **65 → 0**
*and* **33 → 0**, *no new installs.* `DomainFilters` *— the component whose three* `min-w-*`
*flex columns* **caused** *the G-3a horizontal scrollbar — is now a responsive grid, so it wraps
instead of overflowing (grid tracks have no* `min-width: auto`*). Two Radix* `Select` *traps hit
and recorded:* `SelectItem` **throws on an empty-string value** *(the native* `<option value="">`
*"All …" pattern cannot be ported directly — solved with a sentinel, leaving the URL shape
unchanged), and* `SelectValue` **server-renders blank** *because it resolves its label from
Portal-mounted children, so all three dropdowns were empty until hydration — caught only by
reading the raw markup after a grep came back with empty strings. New safety feature:* **a
slug-change warning**, *because renaming a domain slug 404s every page beneath it (70 for
"Graphic Designing") and* **this app has no redirect table** *— the previous guard was
placeholder text saying "be careful". Also deleted an* `alert()` + `window.location.reload()`
*path that G-3b had made unreachable, a* `Cancel` *button that only rendered in edit mode, an
unused import, a comment claiming debouncing that was never written, and a transparent full-stop
label used to fake vertical alignment. Roboto sweep:* **7 → 5 files** *(one of which is the
legitimate app-wide font).*

*Revision 37 (July 31): **G-3a + G-3b DONE — the Domains screen and its table.** Hardcoded
colours* **53 → 1** *and* **64 → 0***. The rebuild surfaced* **four real bugs**, *the worst
being that the* **publish/unpublish button was never wired to anything** *— its handler set a
state flag and stopped, so it showed a permanent hourglass and never published. The API had
worked all along, cache invalidation included; only the call was missing. This is the concrete
shape of the #20 complaint. Second worst:* **both modal backdrops rendered solid black**,
*because* `bg-opacity-50` *is Tailwind* **v3** *syntax silently dropped by* **v4** *(⚠️ the same
bug is still live in* `CategoryList.tsx`*, landing in G-6). Delete now names the exact page count
— the API cascades through every Page with no guard, so "Graphic Designing" meant* **70 pages**
*one click away, with no undo anywhere in this app — and requires typing the domain's* **slug**,
*not its name, because* **34 of 35 domain names start with an emoji** *that cannot be typed and
whose two code points make even paste-equality fragile. Also fixed a document-level* **horizontal
scrollbar**: `SidebarInset` *ships without* `min-w-0`*, so as a flex item it refused to shrink
below* `DomainFilters`*' intrinsic width — fixed from* `AdminLayout` *rather than by editing the
vendored primitive.* `alert-dialog` *installed;* `button.tsx` *overwrite declined. First
`window.location.reload()` → `router.refresh()` conversions (#22.6);* **six remain**.
*⚠️ Two of my own verification steps were wrong and are recorded as such: asserting a
runtime-interpolated count as a bundle literal, and reading an* **expired session cookie** *as
eight broken admin screens.*

*Revision 36 (July 30): **#22.2(a) DONE — tables are no longer write-once.** One file changed.
Rows can now be **replaced or appended from a CSV** without deleting and rebuilding the table.
**Nothing new was built:** `CSVUploadInterface` *already existed and already did header
auto-mapping plus per-row schema validation, and* `PUT /api/admin/tables/[id]/data` *already
supported both operations — **the "CSV Import Coming Soon" placeholder was sitting between two
finished halves.** The design point is that **upload does not save**: parsed rows are staged and
a confirmation panel shows current / incoming / resulting row counts before committing.* ⚠️
*That matters more than usual here —* `replace` *deletes every row, there is no undo, there are
no table backups, and the original CSV is **never stored server-side** (parsed in the browser,
#22.8), so a truncated or wrongly-mapped file would destroy content unrecoverably.* `append` *is
the **default**, because pre-selecting the destructive option would make the safe path the one
requiring action.* `router.refresh()` *is used rather than* `window.location.reload()` *— the
Data tab updates while the user stays on the Import tab, and it avoids adding a seventh reload
for #22.6 to undo. **Test cases recorded:** append 15→18 with originals intact; replace reducing
to exactly the new set; every imported row defaulting to* `targetCountries: "ALL"` *via*
`ensureRowsHaveTargetCountries` *(without which the geo filtering verified in #18 would silently
skip imported rows); the **public** page reflecting the import immediately, confirming #18's
invalidation covers this path; and three malformed bodies all rejected with 400.* ⚠️ *A
bundle-assertion trap recorded: searching for* `papaparse`*/*`Papa` *fails because the bundler
minifies — assert on **user-facing copy**, and note the uploader's strings were already bundled
via the creation wizard, so that check is necessary but not sufficient. Dev branch verified
clean afterwards (652 tables, 8,065 rows, 0 probe rows). **Remaining in 22.2:** (b) row editing
and (c) schema editing, both deliberately **after Phase G** —* `targetCountries` *still has no UI
anywhere, so geo-targeting a row stays impossible for editors until (b).*

*Revision 35 (July 30): **#22.3 + #22.5 FIXED — the 404 button and the two dead Export items.**
Both table menus now offer a single* **📊 Open table** *link to* `/admin/tables/[id]`*, which
opens on its Data tab by default. That removes two separate problems at once: the list view's
"Manage Data" pointed at* `/admin/tables/[id]/data`*, which **exists only as an API route and
404s**, while the grid view had* **both** *"Edit" and "Manage Data" pointing at the same URL, so
one was pure noise. The dead* `📤 Export` *items — no* `onClick`*, no link, clickable and inert —
became working **CSV** and **JSON** items, with the implementation extracted from*
`TableEditor.handleExport` *into* `src/lib/export-table.ts` *and shared. Copying it instead
would have made a third divergent copy of one behaviour, which is exactly what #22.4 had to undo
four times over.* ⚠️ `isExporting` *is deliberately **per-card**: a single flag on the parent
would grey out the menu item on all 652 cards while one table downloaded. **Verified:**
`/admin/tables/[id]/data` *still 404s (confirming the bug was real), no markup links there any
more, and both export formats return 200 with* `Content-Disposition: attachment` *and non-empty
bodies (2,470 B CSV; 4,828 B JSON that parses).* ⚠️ ***A testing trap worth remembering***: the
first version asserted the new labels appeared in the **server HTML** and reported four
failures — but* `DropdownMenuContent` *renders through a Radix **Portal** and mounts only when
opened, and the editor's export buttons sit in an inactive* `Tabs` *panel that Radix unmounts.
For lazily-mounted UI, assert against the **client bundle**. **Swept while here:** a grep for a
bare* `<DropdownMenuItem>` *across all admin components now returns nothing, so #22.5 is closed
panel-wide rather than only on this screen.*

*Revision 34 (July 30): **#22.1 FIXED — /admin/tables went from 8.19 MB to 1.73 MB, and its
main query got ~11x faster.** Both* `include`*s replaced with explicit* `select`*s, and the only
two things* `data`*/*`schema` *were ever used for — a row count and a column count — moved into
Postgres via* `jsonb_array_length`*. **No migration needed**, so no new write-path maintenance.
**The speed-up was unexpected:** this was filed as a payload problem, but transferring 2.45 MB
of JSON was also what made the query slow —* `tables.findMany` *went from 7618/11328/11091 ms to
3825/1460/943 ms across three warm runs. (Absolute numbers are laptop-to-Neon round trips;
Vercel is co-located with the database, so the **ratio** is the meaningful figure.)* ⚠️ *The*
`jsonb_typeof` *guard around* `jsonb_array_length` *is mandatory, not defensive dressing: the
function **raises** on a non-array and that would fail the whole page rather than one row — all
652 current rows are well-shaped, but* `data` *is an unvalidated* `Json` *column.* `schema`*,*
`data` *and* `settings` *were also removed from* `TablesManager`*'s prop type (the declaration is
what caused the transfer);* `settings` *was declared and never read at all. **Test cases recorded
in the finding:** counts verified identical to the old JS computation across all 652 tables (0
mismatches, 8065 total rows both ways); a string existing only inside* `Table.data` *confirmed
absent from the HTML; and a regression sweep of all eight other admin screens plus*
`/admin/tables/[id]`*, which correctly still loads full row data — only the LIST was
over-fetching.* ⚠️ ***Another of my own assertions was wrong***: I first asserted "< 1 MB" and it
failed at 1.73 MB. Measuring the composition explained it — props are 487 KB and RSC sends them
**both** as flight data and as rendered HTML, so ~2x props + markup is the floor for 652
unpaginated cards. **Recorded as the remaining work:** the page has no pagination, which is now
the entire residual size, and it belongs with #21 Phase 2 since that rebuilds the list markup
anyway.*

*Revision 33 (July 30): **#22.4 FIXED — 433 broken admin links, via a four-way consolidation
that turned out larger than "extract one function".** The parent-chain traversal existed **four
times in three states of correctness**:* `sitemap.ts` *had it right (cycle-guarded, Map-based);*
`api/admin/pages/route.ts` *and* `api/admin/pages/[id]/route.ts` *each held a **byte-identical
copy with NO cycle guard** that recursed and used* `allPages.find()` *inside the recursion
(O(n²)); and the two broken UI call sites had no traversal at all. The correct version moved
verbatim into* `src/lib/page-path.ts` *and the other three now import it — which means **both
admin API routes gained a cycle guard they never had**, and since they recursed, one corrupt*
`parentId` *row would previously have overflowed the stack into an opaque 500. The rich-text
preview URL had to move server-side because the API returns only* `rich_text` *pages while the
ancestors are* `section_based`*/*`subcategory_list`*, so the chain is genuinely absent from the
client payload. **Both call sites now render a DISABLED control when the URL resolves to null**
rather than linking somewhere known-broken — the old code always produced *a* link, which is
exactly why 433 silently 404'd.* **Test cases recorded in the finding, as newly requested for
every change.** *Verified: sitemap unchanged (1201 served = 1 + 35 roots + 1165 pages, computed
from live data); **old vs new agree on 1,198 of 1,198 pages** so no existing consumer changes;
323/418 rich-text and 110/668 table URLs corrected; sampled NEW urls return 200 while the OLD
ones 404; and end-to-end the API returns* `previewUrl` *on 46/46 pages, all matching the helper
and all resolving.* ⚠️ ***Two of my own test assertions were wrong and are documented so they
are not repeated***: asserting a hardcoded sitemap count of 1198 reported a **data** change as a
refactor regression, and re-deriving a page from a URL tail via* `allPages.find(...)` *returned
an arbitrary match among the **83 ambiguous (domain, slug) pairs** — sometimes from a different
domain — producing three spurious 200s that looked like the fix failing. Also confirmed
untouched:* `PageService.getByPath` *still 404s* `/domain/webdev/ytube`*, so nothing widened what
resolves publicly.*

*Revision 32 (July 30): **#22's remaining gap closed — the three untested write flows were
driven end to end and all three work.** The previous revision flagged that category,
section-layout and rich-text writes had been **read but not run**. Each was then exercised over
HTTP against a production build with a real admin session, with the effect verified in the
database: category create/update/delete all HTTP 200 and persisted; section layout persisted;
rich-text create and update both persisted with* `wordCount` *computed.* ⚠️ *One trap recorded
for whoever edits the sections route: the field is* `column`*, **not** `columnPosition` *— and*
`columnPosition` *IS the correct name on* `DomainCategory`*, which is precisely why it is easy
to get wrong. The first attempt was rejected with "Each section must have a valid column (1, 2,
or 3)". **Bonus verification: finding #2's sanitiser is confirmed live on a real write path** —
hostile input containing* `<script>`*,* `onclick` *and* `onmouseover` *was POSTed and what
landed in the database was* `<div><p>x</p><a href="https://ok.com">y</a></div>`*: scripts and
handlers stripped, safe markup and the href intact. Previously that was only verified against
already-stored data. Development branch confirmed fully restored (7 categories, 0 probe rows,
415 richTextContent rows, 0 pages holding probe sections). **Conclusion: the basic CRUD
plumbing is healthy** — every failure in #22 is concentrated in the **table feature** (22.1–22.3)
and in **link construction** (22.4). The residual scope note is now honest about what remains
untestable here: the CSV path is parsed in the browser and cannot be driven over HTTP, and no
headless browser is installed, so drag-and-drop, client-side validation and responsive layout
below tablet width were not exercised.*

*Revision 31 (July 29): **#22 expanded into a full screen-by-screen audit with a fix documented
for every finding.** All 13 admin screens were loaded against a production build with a real
admin session — **every one returns HTTP 200**, none is dead — which surfaced the worst problem
in the document by a wide margin:* `/admin/tables` ***ships 8,592,689 bytes (8.19 MB)**, 37× the
next largest screen. Cause: both of its queries use* `include` *without a* `select`*, so*
`Table.data` *and* `Table.schema` *are pulled in full — and* `table: true` *in the second query
pulls them **again**. Measured: 1.97 MB of* `data` *+ 0.48 MB of* `schema` *= 2.45 MB, loaded
twice, to render a list that needs ~0.16 MB — roughly **50× more bytes than the page displays**.
⚠️ *Worth noting this got worse with #20: the page is now dynamic, so it is rebuilt per request
rather than served frozen — correct for freshness, but the over-fetch now bites on every view.
Fix documented as narrowing both* `select`*s plus either a denormalised* `rowCount` *column or*
`jsonb_array_length`*. Every other finding now carries a concrete fix with effort and caveats:
the 433 broken links resolve to extracting* `buildPagePath` *out of* `sitemap.ts` *into a shared
helper (~1 hr, the highest value-per-hour item anywhere here); table editing splits into three
independently shippable pieces, the smallest being **re-import using the* `CSVUploadInterface`
*component and* `PUT …/data` *endpoint that both already exist** (~2 hrs); and a caveat recorded
that* `targetCountries` ***has no UI anywhere***, so the geo feature verified working in #18 is
currently unreachable for content editors.* **Fix order revised so nothing is built twice:**
*cheap query/link fixes first, then #21 Phase 2's shadcn shell, then the new data-grid and dialog
work inside it — because building a grid or a confirmation dialog in the old markup would mean
rewriting it days later.* ⚠️ *Also recorded honestly: the audit verified every screen loads and
traced every interactive element in code, but **did not drive every create/edit/delete flow end
to end** — category, section-layout and rich-text write paths were read, not exercised.*

*Revision 30 (July 29): **#22 added — full admin audit, run after #20 so stale screens could
not be mistaken for broken ones.** The headline confirms the report: **table data is
write-once.** All four tabs of* `TableEditor` *are non-editable — Data renders the **public**
read-only* `DataTable`*, Schema is a display-only column list, and Import and Settings are
literal "Coming Soon" placeholders. A grep for* `addRow|deleteRow|editRow|handleCellChange|
editable` *across all 32 admin components returns **zero matches**: there is no row-editing UI
anywhere. Meanwhile* `PUT` *and* `DELETE /api/admin/tables/[id]/data` *are **fully implemented
and called from nowhere** — #18's own test drove the PUT successfully over HTTP. So changing one
cell today means deleting the table and rebuilding it from CSV. **433 broken links measured:**
the "Preview" button in* `RichTextManager:223` *and the "view on site" link in*
`admin/tables/[id]:83` *both build a flat* `/domain/{domain}/{page}` *URL, while* `sitemap.ts`
*correctly walks the* `parentId` *chain — **323 of 418 rich-text pages (77.3%)** and **110 of 668
table pages (16.5%)** open a 404. The list-view **"Manage Data" button 404s** —*
`/admin/tables/[id]/data` *exists only as an API route, never as a page — while the card-view
button of the same name silently duplicates "Edit". Two dead **Export** dropdown items. Plus 6*
`window.location.reload()` *calls and 8* `alert()` */ 3* `confirm()` *that ignore the new theme
entirely. **Answered the CSV question:** the file never leaves the browser —*
`Papa.parse` *reads it client-side, only JSON rows are POSTed, they land in the* `Table.data`
*JSON column, and the original .csv is discarded on tab close (export regenerates one from the
stored rows).* ⚠️ ***Two of the audit's own automated passes were mostly wrong and were
discarded rather than reported***: a dead-button detector flagged 9 where only 2 were real (it
did not know* `DropdownMenuTrigger asChild` *makes a Button interactive), and an "unreachable
endpoint" detector flagged 20 almost entirely wrongly, because real call sites build the URL
into a variable before* `fetch()`*. Five other look-alike findings were checked and dismissed,
and are recorded in 22.6 so they are not re-reported.*

*Revision 29 (July 29): **#20 FIXED — the five frozen admin screens are dynamic again.***
`export const dynamic = 'force-dynamic'` *added to* `/admin`*,* `/admin/categories`*,*
`/admin/sections`*,* `/admin/tables` *and* `/admin/tables/new` *— the exact five that read the
database during render — each with a* `⚠️ DO NOT REMOVE` *comment, since the export looks like
cargo-culting from the public routes and would otherwise be a tempting deletion. Prerendered
routes went **16 → 11**, exactly the five, nothing else; **0 screens now read the DB while
static**. Deliberately not applied to the three static-but-client-fetching screens
(*`/admin/rich-text`*,* `/admin/users`*,* `/admin/users/new`*), whose data is already live.
**Verified with the finding's own reproduction**: signed in as a throwaway admin on the dev
branch and created a domain through the real admin API — the dashboard count went 34 → 35
immediately, and the domain appeared in* `/admin/tables` *and* `/admin/sections` *with no
rebuild, restart or wait.* ⚠️ ***A test expectation of mine was wrong in a way that looked
exactly like a failure***: the new domain did **not** show in the New Table wizard, but
`tables/new/page.tsx:75` *filters to domains that already have a* `table`*- or* `narrative`
*-type page, and a fresh domain has only its* `section_based` `__main__`*. Re-tested with a
table page created first and it appeared at once — so the wizard is fresh, it just has a design
rule. Whether that rule is good UX (a new domain silently missing from the picker, no empty
state) is a question for the planned admin audit, not a #20 defect. **Also recorded: #21 Phase
2 direction revised at the user's request** — rebuild the admin shell on shadcn primitives (the
sidebar block,* `button`*,* `breadcrumb`*,* `sheet`*) rather than swapping 1,146 colour classes.
Better and probably less work, because shadcn components are already written against the theme
tokens, so replacing hand-rolled markup **deletes** its hardcoded colours instead of requiring
a swap — and it also brings responsive/mobile handling and keyboard-accessible collapse, which
the admin shell has none of today. **The admin audit still comes first**, since fixing behaviour
inside markup that is about to be replaced would waste the work twice.*

*Revision 28 (July 29): **#21 Phase 1 shipped — the public site now has a working light/dark
theme.** 2 new files (*`ThemeProvider`*,* `ThemeToggle`*) and 8 modified.* `next-themes` *is
finally wired (it had been an installed-but-never-imported dependency),* `<html>` *carries*
`suppressHydrationWarning` *because the anti-flash script mutates that element before
hydration, and the toggle sits at* `ml-auto` *in the breadcrumb bar so it does not shift as
breadcrumb trails change length in a sticky bar. **No flash of the wrong theme — confirmed by
reading the served bytes**, where the injected script is the first child of* `<body>`*, ahead
of all visible markup; its arguments also confirm the config landed
(*`"class","theme","system"`*, enableSystem, colorScheme).* ⚠️ *A **wrong conclusion was drawn
and corrected mid-task**: an initial check compared the script's offset against the* `<body>`
*tag, found it later, and reported "a flash is possible" — a meaningless test, since what
matters is whether the script precedes **visible content**. **Rich text uses option A**: the
card is fixed* `bg-neutral-100 text-neutral-900`*, a light island in a dark page, because 574
of its 2,519 inline colour declarations are dark and inline styles beat stylesheets. Two traps
surfaced there —* `dark:prose-invert` *was already present and would have inverted headings to
white **on light**, and the card's empty state used* `text-foreground`*/*`text-muted-foreground`
*which resolve near-white in dark mode, invisible on that light card; both fixed. **Known
limitation recorded:** the* `__next_error__` *shell Next serves for 404s and errors carries no
blocking script, so those pages flash light before hydration — the provider is in the payload,
so the theme does apply, just late. Also recorded: a* `/domain/affiliatemarketing` *404 during
the regression sweep was chased rather than dismissed and proved to be the stale* `null`
*cached by **#11's** test, which had renamed that domain's* `__main__` *and restored it via
Prisma without invalidating — the database was verified intact and the route self-healed on
the second request.* `DataTable`*'s 20 remaining colours were left deliberately: semantic
badge/status accents that should stay coloured in both themes. **Phase 2 (admin, 1,146
occurrences) remains open and still sequenced after #20.***

*Revision 27 (July 29): **#21 added — dark/light mode audited before writing any code.** The
finding that reframes the work:* **the entire shadcn dark-mode foundation is already present
and correct** *—* `next-themes 0.4.6` *is installed (and has **never been imported** — a dead
dependency), Tailwind v4 declares* `@custom-variant dark (&:is(.dark *))`*, and* `globals.css`
*defines all 31 colour tokens in both* `:root` *and* `.dark` *at full parity. Only three
pieces are missing: a* `ThemeProvider` *to put* `.dark` *on* `<html>`*,*
`suppressHydrationWarning` *on that element, and a toggle — which does not exist anywhere, so
the screenshots that prompted the request are a design reference rather than current state.*
⚠️ *This entry also **corrects a claim made during the audit itself**: a first pass reported*
`.dark` *was missing every token, which was a script error — it had parsed the* `@theme inline`
*block, whose variables are named* `--color-*`*. Measured **1,220 hardcoded colour classes in
60 of 106 files**, distributed very unevenly: **1,146 in admin, 66 public**, with*
`components/sidebar` *and* `components/bread` *at **zero** and the shadcn* `ui/` *primitives
effectively clean. **Half the public count is unreachable code** —* `AppHeader` *(12) is
commented out in both layouts and* `NarrativeLayout` *(21) renders for 0 of 1,198 pages —
leaving ~33 real occurrences across 8 files, eight of which are* `border-gray-300` *decorative
rules.* `DataTable` *already has correct* `dark:` *variants. **The one hard problem is stored
rich-text HTML:** 395 of 415 rows carry inline colours (2,519 declarations, 574 dark enough to
vanish on a dark background, plus 168 white-text and 57 inline-background rows). Inline styles
beat stylesheets, so CSS cannot retheme them — and the* `.rich-text-content a:hover { color:
#000 !important }` *rule added for #2 would make every hovered link invisible in dark mode.
Three options recorded, with light "content islands" recommended over blanket* `!important`
*or a destructive migration. Also noted:* `AdminSidebar` *is hardcoded* `bg-gray-900
text-white`*, which is why the admin panel already looks half-dark — a hardcoded theme, not a
broken one. **Phase 2 (the admin sweep) is explicitly sequenced after #20**, since both touch
the same 45 files and #20 is a confirmed bug while this is cosmetic.*

*Revision 26 (July 29): **#20 CONFIRMED and raised to Critical — it is a real, felt bug, not
an inference.** The user described the symptom unprompted: changes appear on the live site but
"so many things don't show up in the Admin UI — and that's a very glitch in the admin UI".
That is this bug's exact signature, seen from both sides of one root cause: public pages are*
`force-dynamic` *so they re-query per view, while the affected admin screens are static HTML
built once at deploy time and cannot change. Re-measured every admin screen and **corrected
this document's own earlier count**: **8 of 13** are static, not six —* `/admin/tables/new`
*and* `/admin/users/new` *were missed — but only **5** actually serve stale data
(*`/admin`*,* `/admin/categories`*,* `/admin/sections`*,* `/admin/tables`*,*
`/admin/tables/new`*), because three of the eight fetch client-side via* `useEffect` *+*
`fetch('/api/admin/…')` *and are therefore fine. Being static is not the bug; being static
**while reading the database during server render** is. Also noted:* `/admin/domains` *and*
`/admin/pages` *are live only **by accident**, because they accept* `searchParams` *— a
refactor dropping that prop would silently freeze them too. And a concrete reproduction:
create a domain, open **New Table**, and the domain is absent from the dropdown because that*
`domain.findMany` *ran at build time. Fix is* `force-dynamic` *on the five, which is the
opposite call from #8-DR for public pages — correct, because admin traffic is negligible and
correctness is not optional in the tool used to edit the site.*

*Revision 25 (July 29): **#19 done — error boundaries added; #20 opened as a High-severity
find.** The app had **no** `error.tsx` *anywhere, so an unhandled render throw served a bare
unstyled 500 with no navigation — and in admin, silently lost unsaved form state. Added five
files (a shared* `ErrorContent` *plus boundaries for* `/domain`*,* `/admin`*, the root, and*
`global-error`*) and modified none. Three non-obvious details drove the design: a boundary
does **not** catch its own layout (so a throw in* `domain/layout.tsx` *bubbles past its
sibling* `error.tsx`*, which is why the root one exists — verified by observing the domain
shell absent from the payload);* `global-error.tsx` *must import* `globals.css` *itself
because it replaces the root layout, the only other importer; and the UI shows*
`error.digest` *rather than* `error.message`*, which production strips from Server Component
errors.* ⚠️ ***The real risk was that* `notFound()` *and* `redirect()` *are implemented by
throwing*** *—* `[...slug]/page.tsx` *calls* `notFound()` *five times and* `/` *calls*
`redirect()`*, so a boundary that swallowed them would have turned every 404 into a 500 and
broken the site entry point. Verified against a production build rather than trusted from
docs: 404s stayed 404,* `/` *stayed 308, and 6 real deep sitemap paths stayed 200. Each
boundary was then exercised with a temporary* `process.env.BOOM` *trigger (all five removed;
grep confirmed zero left).* **Two honest limits recorded:** *these boundaries render on the
CLIENT — Next returns a minimal* `__next_error__` *shell and streams the content — so server
probing proves status, digest, tree membership and that the code shipped, but not the painted
DOM; no headless browser is installed, so the visual check is manual. And **a correction to
comments written during this same change**: they claimed the* `useEffect` `console.error`
*reaches the Vercel logs, which is wrong —* `useEffect` *runs only in the browser. Next logs
the server error and digest by itself, which was observed directly.* **Separately, #20:** *an
error trigger in* `admin/page.tsx` *never fired, revealing that* `/admin`*,* `/admin/tables`*,*
`/admin/users`*,* `/admin/categories`*,* `/admin/sections` *and* `/admin/rich-text` *are
**statically prerendered with* `initialRevalidateSeconds=false`***, so their direct Prisma
queries ran at build time and their data is frozen until the next deploy.* `revalidateTag`
*cannot help — they do not use* `unstable_cache`*, so nothing is tagged. Left open pending
confirmation from real use, since dev data had not changed since the build.*

*Revision 24 (July 29): **#18 done — the table data route is cached, and country tagging is
now proven to work.*** `/api/domain/tables/by-page/[pageId]` *serves the 666* `table` *pages
— 55% of the catalogue — and had **no caching at any layer**: no* `Cache-Control` *at all,
and* `TableService.getPublicTable` *wrapped in React* `cache()` *only, which is
request-scoped and therefore deduplicated nothing, since the route calls it once per
request. Every view of every table page cost 2 function invocations and 2 database round
trips. Fixed with #15.1's pattern — country into the URL, shared cache headers only when it
is a recognised value,* `unstable_cache` *in the service layer — plus 85 lines of
commented-out dead code deleted from a 150-line file. **The cached value deliberately
excludes the country:** it caches the unfiltered table and filters per request, so there is
no country-specific value in the cache to hand to the wrong visitor, and there is one entry
per table instead of one per (table × country).* ⚠️ ***Auditing invalidation before shipping
found three of four table-writing handlers invalidated nothing*** *—* `tables/[id]` *PUT,
and both* `tables/[id]/data` *PUT and DELETE, the first of which is the most-used table
write there is. That was legitimate while table content was uncached (this document said so
explicitly); caching it silently broke the reasoning, so all three now call*
`invalidatePages()` *and the stale comment block in* `cache-invalidation.ts` *was corrected.*
`CACHE_TAGS.TABLES` *had **no subscriber anywhere**, making* `revalidateTag(TABLES)` *a
no-op; the new entry is tagged both TABLES and PAGES. **Verified with 17 checks against the
real endpoint**, after tagging rows on the dev branch — country tagging was entirely unused
(0 of 8,050 rows), so correctness was unobservable from existing data. US never sees
IN-only, IN never sees US-only, everyone sees ALL, lowercase and whitespace-padded tags
match, and **6 interleaved US/IN round trips never leaked**. An admin edit through the real
API appeared immediately. The cache was then proven real by changing rows via Prisma
directly, bypassing invalidation, and confirming the endpoint still served the old data.
Noted for future reference:* `unstable_cache` *TTL expiry is stale-while-revalidate, so one
request past the TTL still sees old data —* `revalidateTag` *is the immediate path.*

*Revision 23 (July 29): **#17's seed script fixed — kept rather than deleted.** Deleting*
`prisma/seed-admin.ts` *was considered and rejected: creating an admin through the app
requires* `requireAdmin()`*, so a database with no users has no way in at all, and this
script is the only thing that breaks that chicken-and-egg — removing it would have fixed
the security hole by deleting the disaster-recovery path. It now reads* `ADMIN_EMAIL`*/*
`ADMIN_PASSWORD` *from the environment with **no default and no fallback**, validates the
password against the same* `PasswordUtils.validatePassword()` *policy the admin UI uses,
checks the email format, stays idempotent on re-run, and **no longer echoes the password**
(the old version printed it in full, copying it into scrollback and CI logs). All four
refusal paths and the happy path were verified on the development branch, then the probe
account deleted. **Two more problems surfaced while wiring this up:*** `package.json`
*declared* `"seed": "npx tsx prisma/seed.ts"` *and* `prisma/seed.ts` ***does not exist*** *—
a dead script, now removed; and* `COLLEAGUE-SETUP-GUIDE.md` *instructed new developers to
run* `npx prisma db push` *rather than* `migrate deploy`*, which is exactly the command that
produced #3's missing migration history. Both corrected.* `eslint.config.mjs` *needed
nothing — its exemption globs* `prisma/**/*.ts`*, not a filename.* ⬜ *One piece remains:
the **development** Neon branch is a clone taken before the deletion, so*
`admin@example.com` *still exists there and would return to production if that branch were
ever promoted.*

*Revision 22 (July 29): **#17's live credential revoked and #16's migration applied to
production.*** `admin@example.com` *was deleted from the production* `User` *table; verified
read-only afterwards (2 accounts remain, and* `domains=34 pages=1197 tables=651
richTextContent=415` *unchanged, so nothing cascaded through its* `createdUsers`*/*
`accounts`*/*`sessions` *relations).* `20260729100000_add_login_lockout` *was then applied
to production with* `prisma migrate deploy` *— status showed exactly one pending migration
and no drift beforehand, and afterwards* `failedLoginAttempts` *(integer, NOT NULL, default
0) and* `lockedUntil` *(nullable timestamp) exist with both existing rows carrying the
default rather than NULL. The migration went in **before** the code deploy, which is the
required order since* `npm run build` *runs only* `prisma generate`*.* `.env` *was switched
to production for the operation and switched straight back to the development branch, with
the procedure now documented in the file itself (*`.env` *is gitignored, so none of this was
committable).* ⬜ *#17 is only **half** closed:* `prisma/seed-admin.ts` *still hardcodes*
`Admin123!`*, so* `npm run seed:admin` *would recreate the deleted account — the finding
regresses until that script reads its credentials from the environment.*

*Revision 21 (July 29): **#16 done — admin login now locks after 5 failed attempts**, and
**#17 opened as Critical.** The lockout had to go inside* `authorize()` *rather than
middleware, because* `api/auth` *is excluded from the middleware matcher by design
(checking the session there would recurse into NextAuth's own handler) — so the obvious
integration point was unavailable. Counters live in Postgres rather than memory because
each Vercel instance has its own memory, and per-account rather than per-IP because IPs
rotate cheaply. The same change closed a **user-enumeration timing side channel**: the old
code returned* `null` *for an unknown email before reaching bcrypt, making an unknown email
(~5 ms) and a real email with a wrong password (~438 ms) differ by ~85x; both paths now run
bcrypt, one against a decoy cost-12 hash. Measured after the fix: 485 ms vs 689 ms, a
**1.42x** ratio — reduced, **not eliminated**, the remainder being the extra UPDATE that
records the failed attempt; that residue was accepted rather than chased. Verified
end-to-end through the real CSRF + credentials-callback flow on a throwaway user: counter
climbs 1→5, lock reported on the fifth attempt itself, the **correct** password refused
while locked, counters reset after expiry, and all three real accounts left untouched.
⚠️ Deploy order is not free here —* `npm run build` *runs* `prisma generate`*, not*
`prisma migrate deploy`*, so the migration must be applied to production BEFORE the code
ships (both columns are additive with defaults, so that order is safe). **Then, while
confirming the test had left no residue, found #17:*** `prisma/seed-admin.ts` *hardcodes*
`admin@example.com` */* `Admin123!`*, that account is **live on production as an active
admin** (last used 14 Sep 2025), and comparing the stored hash against the committed string
locally confirmed **the default password still works**. That outranks every other open
item: authentication (#1) and brute-force limits (#16) do not help when the credential is
published.*

*Revision 20 (July 29): **#11 done — the public render path no longer writes to the
database.*** `getOrCreateMainPage` *was **deleted**, not merely bypassed: its only caller in
the whole codebase was that one render line, since the three admin creators each do their
own inline* `prisma.page.create`*. An audit first confirmed the create branch had never
fired — all 32* `direct` *domains already had a* `__main__` *row, 0 duplicates, 0 strays —
so removing the safety net risked nothing that exists. Verified by rendering all 32 roots
(200 + content), firing 12 concurrent hits at one of them, and confirming the* `Page` *row
count was identical before and after (1195/1195, 32* `__main__`*); then by deliberately
renaming one* `__main__` *on the development branch to prove the new path 404s and logs
rather than silently recreating it. **Two follow-ups this document proposed were skipped
with reasons:** the partial unique index cannot be expressed in* `schema.prisma` *and
would reintroduce the migration drift #3 cleaned up (and a plain* `@@unique([domainId,
slug])` *would fail outright on the 83 legitimately-colliding pairs), while the race it
guarded against disappears once create-on-read is gone; the HealthCheck panel is covered
more cheaply by the* `console.error`*. Also corrected two stale details in #11 itself: the
call was at* `:316`*, not* `:65`*, and the* `hierarchical → direct` *switch lives in* `PUT`*,
not* `PATCH`*. Unplanned win:* `getOrCreateMainPage` *was uncached by design (it could
write), so those 32 roots had been hitting the database on every single view;*
`getMainPage` *wraps* `unstable_cache`*. Separately,* `next/image` *for*
`NarrativeLayout.tsx:104` *was marked **won't do** — the four* `contentType` *values in the
database all have explicit* `case` *branches, so that layout renders for 0 of 1,198 pages.*

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