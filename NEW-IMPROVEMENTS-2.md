# NEW-IMPROVEMENTS-2

Continuation of `NEW-IMPROVEMENTS.md`, which passed 8,900 lines during Phase J and became slow to
open and search. **Nothing moved** — that file keeps items #1–#28 and Phases A–J exactly as
written. New work starts here at **#29 / Phase K**.

Same conventions as the original: ⚠️ marks a trap or a correction, every claim carries the
measurement behind it, and each phase step records what was verified rather than what was
intended.

---

## ⚠️ OPEN — credentials exposed in chat, awaiting rotation

| Credential | Exposure | Blast radius | Owner |
| --- | --- | --- | --- |
| **Neon `npg_…` password** | Appeared in a chat transcript. **Shared across every branch, production included.** | Full read/write on all data | User — recorded in `NEW-IMPROVEMENTS.md` *Still open* |
| **`BLOB_READ_WRITE_TOKEN`** | Pasted into chat 11 Aug 2026 while setting up K-5a | Write and delete on the `atno-table-images` store. **No database access, no user data** — but arbitrary files could be hosted under the Vercel blob domain, or images deleted | User — rotate in the store's Settings, or disconnect/reconnect the project |

⚠️ **Neither is a code change.** Both are dashboard actions, and both stay open until done.

**Convention going forward:** environment values are reported as `NAME=<set>` rather than pasted.
Nothing in this workflow needs a secret's value — the test scripts read `.env` from disk
themselves.

---

## ✅ #31 — `sharp` failed on Vercel and worked locally (RESOLVED 12 Aug)

**Fixed in two rounds, deployed, and confirmed on `atno.io`.** `serverExternalPackages: ['sharp']`
plus `outputFileTracingIncludes` for the two image routes.

⚠️ **Neither round could be reproduced locally, and the second round's cause is why.**

| Round | Change | Result |
| --- | --- | --- |
| 1 | Include `@img/sharp-linux-x64` | Got further — `ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.3` |
| 2 | Include the whole `@img` scope | Works |

**Sharp splits its native code differently per platform.** On linux the `.node` addon and
`libvips-cpp.so` are **two packages**; on Windows `@img/sharp-win32-x64` contains both. Confirmed
by listing `node_modules/@img/`: three entries here, and **no libvips package at all**. There was
nothing to forget locally, so no amount of local testing could have surfaced either round.

The glob names the whole scope rather than specific packages because **the split has moved
between sharp releases** and a list of names silently stops matching after an upgrade. npm only
installs the running platform's optional packages, so the scope limits itself.

⚠️ **One diagnosis of mine was wrong and cost a round trip.** Seeing the same deployment hash in
two screenshots, I said the fix looked uncommitted — it was committed and pushed. **A Vercel
preview URL is pinned to one deployment**, so refreshing that tab serves the old build forever.
The observation was right; the conclusion was not.

### ⚠️ The pattern is now proven, and #23 is the same shape

`isomorphic-dompurify` → jsdom fails identically for the rich-text editor, in the same log.
23.2's fix cost 2.2 minutes per build and was reverted for it; **this is the cheaper one**, and
it is the route to take if #23 is ever picked up.

<details>
<summary>Original diagnosis, kept for the reasoning</summary>

## 🔴 #31 — `sharp` fails on Vercel and works locally (#23's class, recurring)

**Found by the user on `atno.io` immediately after K-5b deployed, 11 Aug 2026.** Everything
worked on localhost.

```
GET /api/admin/table-images -> 500
Failed to load external module sharp:
  Could not load the "sharp" module using the linux-x64 runtime
  at Context.externalImport (.next/server/chunks/[turbopack]_runtime.js:484:15)
```

⚠️ **The same Vercel log showed `jsdom` failing identically** for the rich-text editor — same
message, same Turbopack frame. That is **#23**, diagnosed and fixed in 23.2 and then reverted
in 23.4 because the fix cost 2.2 minutes of build time to repair a feature that was being
replaced anyway.

**`sharp` is not that.** It is load-bearing for Phase K, so the same trade does not apply.

### What is actually wrong — not what the error suggests

The error advises installing optional dependencies. That is a red herring here:

| Checked | Result |
| --- | --- |
| `@img/sharp-linux-x64` in `package-lock.json` | **present** — Vercel will install it |
| `.npmrc` / `vercel.json` suppressing optional deps | **none exist** |
| Native `.node` binaries in the route's trace | ⚠️ **zero** — the only `@img/*` entries traced were the pure-JS `@img/colour` |

**It is file tracing.** sharp resolves its native library through a runtime lookup that static
analysis cannot follow, so the tracer records sharp's 29 JavaScript files and none of its
binaries. Vercel uploads what was traced, so the function ships sharp's JavaScript and nothing
for it to load.

### The fix, and why it is unverified

`serverExternalPackages: ['sharp']` plus `outputFileTracingIncludes` naming
`@img/sharp-linux-x64` for the two routes that use it.

⚠️ **This cannot be tested locally, and the local trace proves nothing.** Windows loads
`@img/sharp-win32-x64` and works either way; `node_modules/@img/sharp-linux-x64` does not exist
here, so the include glob matches nothing and the trace is byte-identical before and after.
**Only a deploy can answer it** — the same conclusion 23.2 reached, recorded there as "the only
meaningful test is deploying".

### ⚠️ If it does not work, do NOT reach for webpack

The remaining lever from 23.2 is dropping `--turbopack` from the build script. **It is the
wrong next step**, and 23.4 already judged that trade: it costs ~2.2 minutes on every future
deploy, forever.

**Prefer replacing `sharp` with a WASM encoder.** The reasoning is stronger here than it was
for jsdom:

- Sharp exists to be fast at volume. This resizes **64×64 thumbnails, uploaded by hand, one at
  a time**. A WASM encoder costing 100 ms instead of 10 ms is invisible in an admin upload.
- No native binary means **no tracing problem, no platform mismatch, and no recurrence of this
  entire class** — on Vercel or anywhere else.
- The security property that matters is **re-encoding**, not the encoder. Any decoder/encoder
  discards EXIF and appended payloads equally well.

`processUpload` is already isolated in `src/lib/image-processing.ts` with 44 tests against it,
so swapping the encoder is one file and the suite says whether it still behaves.

**Not needed in the end** — round 2 fixed it. Kept because the escape hatch is still there if
sharp becomes troublesome again, and because the reasoning for *when* to abandon a patching
approach is worth having written down.

</details>

---

## 🟡 #32 — One Blob store, two databases

**Noticed by the user, 12 Aug 2026:** an image uploaded from `localhost` does not appear on the
preview deployment.

**Working as built, and worth understanding.** There is one Blob store, and it is connected to
Production and Preview while `.env` points local development at the same token. But the *rows*
that name those objects live in whichever database is configured:

```
local      -> development Neon branch  ─┐
preview    -> production Neon branch   ─┼─>  ONE store: atno-table-images
production -> production Neon branch   ─┘
```

The file lands in the shared store; the `TableImage` row lands in the local database. The admin
screen lists **rows**, so preview cannot see it.

⚠️ **Two consequences:**

- **Invisible orphans.** An object uploaded locally has no row in production, so no environment
  lists it — and the "Unused only" filter, which reads rows, can never surface it. It is
  unreachable rather than merely unused.
- **Cross-environment deletes.** Deleting an image on production removes the object. If a
  development row happened to reference the same content hash, that row's thumbnail breaks.

Neither is urgent: the volume is a few kilobytes of test uploads, and the second requires the
same bytes in both environments.

**Two ways to fix it when it matters**, neither done yet:

1. **A separate Blob store for development.** Cleanest separation; costs one more store and a
   second token to manage.
2. **An environment prefix in the object path** — `dev/table-images/<hash>.webp` versus
   `prod/…`. One line in the adapter, no extra store. ⚠️ It does forfeit dedup across
   environments, which is harmless.

⚠️ Whichever is chosen, `BLOB-TO-R2-MIGRATION.md` needs the same treatment — it currently
assumes one store.

---

## ⚠️ STANDING RULE — data-dependent changes run on BOTH branches

**Adopted 11 Aug 2026, after K-4b shipped code that depended on a migration run only on
development.** The result: production tables striped and the Sort panel refused a second rule,
while local was correct and every test passed.

The tests passed because they read `DATABASE_URL` from `.env`, which points at development by
design. **A migration verified only where it was run proves nothing about anywhere else.**

So, for any change where code depends on stored data:

1. The step's record **names the data change explicitly** and lists which branches need it.
2. The script is **committed under `scripts/`**, not left in a scratch directory — it has to
   be runnable per branch, more than once, by the user.
3. It is **idempotent** and reports which branch it is pointed at before touching anything.
4. **Both branches are run before the code merges to production**, and the record states the
   row counts for each.
5. ⚠️ `.env` goes back to development **immediately** after a production run.

Neon branches are independent databases. Nothing about deploying code moves data between them.

⚠️ **A data-only fix needs no deploy.** Both the live site and preview deployments read the
production database, so a corrected value reaches whatever code is already running within
`CACHE_DURATIONS.MEDIUM` (60s). Verifying it *before* the next merge isolates the data fix from
whatever that merge contains.

---

## 🔴 #29 — The public table is a good engine with the wiring left unfinished

**Raised by the user, 10 Aug 2026:** *"Tables are a very big part of our website. A lot of pages
have it. It should look & feel professional. And should have features."* — with the direct
question of whether to rebuild from scratch or improve what exists.

Design note with live mockups: **[Table redesign](https://claude.ai/code/artifact/930079be-3d25-47bb-9d16-5f128abf9135)**

### 29.1 — What the audit measured

Every number below came from the development branch on 10 Aug 2026, not from reading code.

```
tables      654          rows         8,120
columns   2,675          avg row        256 bytes
```

**Only 4 of 12 declared column types are used:**

| Type | Columns | | Type | Columns |
| --- | ---: | --- | --- | ---: |
| `text` | 1,165 | | `image` | **0** |
| `link` | 642 | | `number`, `date`, `email` | 0 |
| `description` | 572 | | `phone`, `currency`, `rating` | 0 |
| `badge` | 296 | | `boolean` | 0 |

⚠️ **`image` is declared as a type and has no branch in `formatCellValue`.** It falls through to
`default` and prints the raw URL as text.

### 29.2 — ⚠️ The core finding: the schema declares far more than the renderer reads

This is why the answer is *improve*, not *rewrite*. The engine is TanStack Table — the same
library behind the shadcn demo the user linked. What is missing is connection, not capability.

| Declared in `src/types/table.ts` | Stored on | Actually used |
| --- | ---: | --- |
| Column resizing | — | **Commented out in 4 places**, `// COMMENTED OUT FOR NOW` |
| `col.align` | **2,675 columns** | Never applied |
| `col.width` | 0 columns | Never applied |
| `col.meta.badgeColors` | 0 columns | Never read |
| `TableSettings` (density, sticky header, page size, alternating rows) | **654 tables** | `TableLayout` types it `settings?: any` and **drops it** |
| Page size | 654 tables | Hardcoded `25` in `DataTable` |
| Export | — | ⚠️ **This row was WRONG** — see the correction in the K-2 record. `src/lib/export-table.ts` is imported by `TableEditor` and `TablesManager`; the audit grep excluded the very import lines it was looking for. No public surface renders export, which is the part that was right. |

**Generalisable, and the third time this class has appeared in this project:** a type definition
is not a feature. `tsc` is happy because every one of these fields is optional — the same reason
the `icon` field slipped through five explicit field lists in Phase J. **Optional fields fail
silently in both directions: unset when they should be set, and ignored when they are set.**

### 29.3 — 🔴 Badge colour is the first letter of the text, modulo five

```ts
// DataTable.tsx:396
const colorIndex = String(value).toLowerCase().charCodeAt(0) % badgeColors.length;
```

Not the meaning of the value — its **first character**. Measured across all 296 badge columns:

| | Columns |
| --- | ---: |
| Badge columns total | 296 |
| …where two distinct values collide | **155** |
| …where **every** value renders one colour | **75** |

Real examples, both reported by the user from the live site:

```
Courses / Pricing          "Free to Audit"  "Free Course"  "Paid Course"
                            f=102, p=112, both ≡ 2 (mod 5)  ->  ALL YELLOW

YouTube Channels /          "English"  "Only Music"  ->  e=101, o=111, both ≡ 1  ->  GREEN
  Speaking Language         "Hindi"    ->  h=104 ≡ 4  ->  RED
```

**75 badge columns currently convey no information at all.** The colour is noise.

### 29.4 — ⚠️ Rows live in a single JSON column — the real ceiling

```prisma
model Table {
  data      Json     // { rows: [{ id, [columnId]: content }] }
}
```

There is no row table. Nothing can be paged, filtered or sorted in the database, and opening a
table page ships **every row** to the browser, always.

At the measured 256 bytes/row:

| Rows in one table | Shipped | Feel |
| ---: | ---: | --- |
| 40 — *today's largest* | 10 KB | Instant |
| 500 | 125 KB | Fine |
| 1,000 | 250 KB | Noticeable on mobile |
| 5,000 | 1.2 MB | Slow load, laggy sort |
| 10,000 | 2.4 MB | Not viable |

⚠️ **Everything in Phase K works well up to roughly 1,000 rows per table.** Past that the JSON
blob must become real rows — a migration, not a feature. Recorded as **K-8**, deferred.

⚠️ **The trigger is a real table crossing ~1,000 rows, not a date.** Designing the UI for
server-side data today would cost weeks and change nothing a visitor can see. What K-1…K-7 *must*
do is keep the render path indifferent to where rows come from, so K-8 stays a data change.

### 29.5 — Row height is uncontrolled

Cells are `p-2` and height is entirely content-driven: a plain-text table sits near 36px, one
with badges or the description popover runs taller. The user noticed this as *"some table has row
height very less"*.

It is not per-table. **Nothing controls it** — while `settings.ui.density` is defined in the type
and stored on all 654 tables.

---

## 29.6 — Decisions, with the reasoning that produced them

Agreed with the user across 10–11 Aug 2026. Recorded here because the reasoning is what makes
them reversible later.

### (a) Improve, do not rewrite

A rewrite re-derives a foundation that is already correct, re-tests 654 live tables, and arrives
at the same architecture. The problem is **incompleteness, not wrongness**.

### (b) Badge colours — assigned by position, stored, hand-overridable

⚠️ **A hash was proposed first and was wrong.** Hashing the whole value fixes the first-letter
bug but still cannot promise distinctness:

```
5 values into 10 colour buckets
P(no collision) = (10·9·8·7·6) / 10⁵ = 0.302
                                    -> 70% of columns still collide
```

The user's requirement was explicit — *"ensure each value gets one colour not matching with
others"* — and only **positional assignment** delivers it: collect the column's distinct values,
hand out colour 1, 2, 3… in order. Uniqueness becomes structural rather than probabilistic.

**Uniqueness only has to hold inside one column.** Nobody compares the Pricing badge on one table
with the Language badge on another. So the count needed is the widest single column, not the
site-wide total:

| Distinct values in one badge column | Columns |
| ---: | ---: |
| 1 | 47 |
| 2 | 125 |
| 3 | 72 |
| 4 | 46 |
| **5 — the maximum anywhere** | 6 |

62 distinct badge values exist site-wide; **no column holds more than 5**.

**Ten colours:** `emerald · sky · amber · violet · rose · teal · indigo · orange · pink · slate`.
Double the headroom over anything that exists. Past ten it wraps — but a badge column with eleven
categories is free text, not a badge column.

**Stored, not computed at render.** Computed live, adding one new value re-shuffles every existing
colour. Stored in `col.meta.badgeColors`, a new value takes the next free colour and nothing else
moves.

**Zero data entry.** The assignment is pre-filled from the data on save; the editor lists it so
any one value can be nudged (*Free* → green, *Paid* → amber). All 296 columns are fixed on first
save without anyone typing.

### (c) Column widths — per-visitor, reset on reload

User's decision: *"every user can change their width of the table — it doesn't need to affect
other users. It can reset its width on reload."*

This removes an entire class of problem: no schema write on drag, no permission question, no
admin-versus-visitor branch in the component. `col.width` remains the **starting** width an admin
sets; a drag is local state for that visit.

⚠️ **Why resizing failed before.** The old commented-out code was going to infer width from column
*type* (`description ? 280 : link ? 200 : 150`) while the real `col.width` field went unused — so
nothing persisted and every reload discarded the drag. **Re-enabling the handle is not the fix;
applying and storing `col.width` is.**

### (d) Images — an upload service, not the repository

⚠️ **The repo was proposed first and the user correctly rejected it.** The reasoning for that
rejection is worth preserving, because it is a genuinely different case from Phase J's icons:

| | Icons (Phase J) | Table row images |
| --- | --- | --- |
| Count | 9, maybe 30 eventually | **4,521 distinct** |
| Attached to | Domains and pages — *structure* | Table rows — **data** |
| Changes | Twice a year | Every CSV import |
| Adding one | A `git push` is proportionate | **A deploy per content update** |
| Deleting one | Rare | Routine — and git history is permanent |
| Who adds them | A developer | Whoever curates content |

**The decisive argument: images arrive with data, and coupling data to deploys is wrong.** The
user is about to add Entrepreneurship and Ecommerce domains; every new table would be a commit.

⚠️ **Hotlinking third-party URLs was also rejected, by the user, for good reasons:** *"What if
some channel got deactivated on YouTube. What if some website got removed completely. If we put
public logo url — things are not in our control then."* Correct. Third-party URLs rot, change
without notice, are uncontrolled in size, and leak who is reading the page.

**What survives from the repo proposal — and it is the important part — is referencing by id
rather than by URL.** Measured reuse:

```
7,602 rows  ->  4,521 distinct things   (1.68x)

pixabay  40 rows      artlist  27      fiverr  24      upwork  24
```

One `pixabay` image serves **40 rows**. Stored as a URL per row, that is 40 copies to update.
Stored as a key with a lookup table, replacing it is one write that changes all 40.

### (e) Vercel Blob now, Cloudflare R2 kept one commit away

| | Vercel Blob | Cloudflare R2 |
| --- | --- | --- |
| Storage | $0.023/GB-mo | $0.015/GB-mo |
| **Egress** | **$0.05/GB** | **$0 — always** |
| Free tier | 1 GB storage, 10 GB transfer/mo | 10 GB storage, 1M writes, 10M reads/mo |
| Setup | package + auto-injected env var | S3 SDK, credentials, bucket, custom domain |

Storage need is **~9 MB** (4,521 × ~2 KB). Both free tiers swallow it; storage cost is irrelevant.
Bandwidth is the only variable, at ~50 KB of images per page view:

```
Vercel Blob free transfer   10 GB/mo ÷ 50 KB  ≈  200,000 pageviews/month
beyond that                 $0.05/GB  ->  ~$5/mo at 100 GB
Cloudflare R2               $0 egress at any volume
```

**Chosen: Vercel Blob.** R2 is genuinely cheaper and zero egress is a real advantage — but the
difference is **$0 versus $0** until ~200k pageviews/month, and what R2 costs instead is setup
complexity. Take the cheap-to-build option while the bill is identical.

⚠️ **On the user's instruction, the code must not assume Blob.** All storage access goes through
one adapter interface (K-5a); an R2 implementation ships **written and commented out** beside it.
Switching becomes changing one env var and uncommenting one file. Full procedure in
**`BLOB-TO-R2-MIGRATION.md`**.

**Switch trigger:** image bandwidth approaching 10 GB/month, visible in Vercel's usage dashboard.

### (f) What is deliberately NOT being built

| Feature | Why not |
| --- | --- |
| **Export** | User: *"not planning to have on public pages."* Already true — no public surface has ever rendered an export control. ⚠️ **NOT deleted:** admin export is real and in use (see the K-2 correction). |
| Row selection, bulk actions | No action a visitor can take on a row. An admin idea, not a public one. |
| Inline editing on the public table | Read-only by design; editing lives in the admin. |
| Row virtualisation | Solves rendering 10,000 rows. The **payload** breaks long before the renderer does (29.4). |
| Saved views, grouping | Real Notion features, real cost. Revisit when tables are large enough to need them. |
| **Filter/sort in the URL** | Every filter combination becomes a distinct URL to Google — hundreds of near-identical pages competing with the 1,198 real ones for crawl budget, which cuts against **#8**. Addable later with `<link rel="canonical">`, provided filter state lives in one place. |
| Server-side rows | Right eventually — **K-8**, triggered by a table crossing ~1,000 rows. |

---

## 29.7 — How the whole thing works

### The toolbar

Search stays left; every control moves right as an icon button that opens a panel. Active state
shows on the button itself, so a filtered table is obvious without opening anything.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⌕ Search all columns…          [⧩ Filter ②] [⇅ Sort] [▥ Columns] [≡ Normal]  │
└──────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────────┐
│ Course Name            ⇅ ┊ Course Link      ┊ Pricing    ⇅ ┊ Description      │  ← sticky
├─────────────────────────┼──────────────────┼──────────────┼──────────────────┤
│ ◕ Agentic AI: A Primer  │ coursera.org/l…  │ (Free to Au) │ Executive-focus… │
│ ◕ AI Engineer Track     │ udemy.com/cou…   │ (Paid Cours) │ Master AI agent… │
└─────────────────────────┴──────────────────┴──────────────┴──────────────────┘
  5 of 41 rows · 2 filters active          Rows per page 25 ▾    ‹ 1 / 2 ›
          ▲                                          ▲
          │                                          └─ from settings.pagination
          └─ states what you are looking at, not just a page number
                                        ┊ = drag handle, resizes that column
```

**Four panels, nothing buried in a right-click:**

| Control | What it does |
| --- | --- |
| **Filter** | Condition builder — `Where [column] [operator] [value]`, joined And/Or. Replaces today's badge-only faceted chips. Operators follow the column type. |
| **Sort** | Multi-column, drag to reorder priority. Header click still sorts and stays the fast path. |
| **Columns** | Visibility **and drag-to-reorder in one list** — column ordering for free, no second control to learn. |
| **Density** | Compact / Normal / Comfortable. Reads `settings.ui.density`. |

**Operators per type:**

- `text` / `description` — contains, does not contain, is, starts with, is empty
- `badge` — is any of, is none of
- `link` — contains, is empty
- `number` / `date` — comparisons and ranges, when those types are used

### The image pipeline

```
   ADMIN                          SERVER                        STORAGE
┌──────────┐   PNG/JPG      ┌──────────────────┐           ┌──────────────┐
│  drag a  │ ─ up to 4 MB ─▶│ 1 magic-byte     │           │ Vercel Blob  │
│   file   │                │   check          │           │  (adapter)   │
└──────────┘                │ 2 reject SVG     │           └──────┬───────┘
                            │ 3 sharp → 64×64  │──── put ────────▶│
                            │    WebP (~2 KB)  │                  │
                            │ 4 hash the bytes │◀─── url ─────────┘
                            └────────┬─────────┘
                                     │ INSERT
                                     ▼
                           ┌─────────────────────┐
                           │  TableImage         │
                           │  key   "pixabay"    │◀── stable, human-chosen
                           │  url   /a3f9c2.webp │◀── content-hashed
                           └─────────┬───────────┘
                                     │ referenced by key
        ┌────────────────────────────┼────────────────────────────┐
        ▼                            ▼                            ▼
   row in table A              row in table B              …40 rows total
   { image: "pixabay" }        { image: "pixabay" }

   Replace the artwork  ->  new hash, new URL, ONE update  ->  all 40 rows change
```

⚠️ **Content-hashed filenames remove the versioning discipline entirely.** Different bytes produce
a different URL by construction, so `immutable, max-age=31536000` is safe and the whole
"never overwrite, use `-v2`" rule from `ICON-GUIDE.md` §9 **does not apply here**. Rows point at a
key; the key points at a hash; the hash changes when the picture does.

⚠️ **This is also why rows must store the key and not the URL.** Storing URLs would mean 40 row
writes on every replacement, across 40 different table JSON blobs.

### What the admin sees

**Image Management** — a new admin section, the user's design:

```
Admin › Images
┌──────────────────────────────────────────────────────────────────────────┐
│ ⌕ Search…            [ Unused only ☐ ]              [ ⇧ Upload images ]  │
├──────────────────────────────────────────────────────────────────────────┤
│  ▣ pixabay        64×64  2.1 KB   used in 40 rows            ⋯          │
│  ▣ artlist        64×64  1.8 KB   used in 27 rows            ⋯          │
│  ▣ old-fiverr     64×64  2.4 KB   ⚠ unused                   ⋯          │
└──────────────────────────────────────────────────────────────────────────┘
                                                      ⋯ = replace · rename · delete
```

- Drag-drop upload, several at once
- **Usage count per image**, expandable to the rows and tables that use it
- **"Unused only" filter** — orphan cleanup becomes a visible list, not a script
- Delete is **blocked when in use**, and says where it is used
- Replace artwork updates every referencing row automatically

**In the table editor:** the badge colour list appears under any `badge` column, pre-filled, each
value with a colour swatch that can be changed. Image shape is a per-column dropdown.

**In the row editor:** an image picker per row — the same `Popover`+`Command` component as
`IconPicker`, searching `TableImage` keys.

### What the visitor sees

The image sits **inside the name cell**, before the text — not in a column of its own. A dedicated
image column would be near-empty and would need hiding on mobile.

```
  ╭───╮                        ┌───┐
  │ ◕ │  Abi Connick           │ ▣ │  Canva
  ╰───╯                        └───┘
  circle                       rounded square
  people, YouTube channels     apps, tools, websites, product logos
```

**1:1 only — circle and square.** On the user's instruction the 2:3 `cover` branch (books) is
**written and commented out**, with a note explaining what enabling it costs.

⚠️ **Shape and density are coupled.** A 2:3 cover 32px wide is 48px tall, forcing a book table to
`comfortable` row height whether or not it is chosen. That is why cover is deferred rather than
merely unimplemented.

### Upload rules for the person adding images

Full guide in **`TABLE-IMAGES-GUIDE.md`** (written in K-5c). The short version:

| Upload | When |
| --- | --- |
| **PNG** ✅ | Logos, icons, crops. **Keeps transparency** — a JPG logo shows a white box on the dark theme. |
| JPG | Photos and screenshots with no transparent areas |
| WebP | Accepted, no advantage — everything is re-encoded |
| ❌ **SVG** | **Rejected.** This is the upload risk noted in #27 — the one case where the earlier "SVG is only dangerous for uploads" correction actually bites. |
| ❌ GIF, HEIC | Animation is pointless at 32px; HEIC support is patchy |

⚠️ **Do not resize or convert before uploading.** The server re-encodes. Client-side prep is
inconsistent (someone eventually uploads a 400px PNG) and it is the most tedious step in the
workflow. Drag in a 2 MB crop; get a ~2 KB WebP.

---

## Phase K — The table (#29) — PLAN (agreed 11 Aug 2026, not started)

Eight steps. **K-1 through K-3 are wiring** — they read fields that already exist on 654 tables
and 2,675 columns, so they carry no schema change and can each ship alone. K-4 is the largest UI
piece. K-5 is the only part that adds infrastructure.

Ordered so the most visible fix lands first and nothing depends on anything later.

| Step | Scope | Schema change | Public effect |
| --- | --- | --- | --- |
| **K-1** ✅ | Badge colour system — positional assignment, 10-colour tinted palette | `col.meta.badgeColors` (existing field, first use) | **Large** — 75 broken columns fixed. **DONE 11 Aug, 23/23 + CSS proof. Record below.** |
| **K-2** ✅ | Read the settings already stored — density, sticky header, page size, alternating rows. Delete dead code | none | Visible: consistent row height. **DONE 11 Aug, 36/36. Record below.** |
| **K-3** ✅ | `col.align`, `col.width`, working column resize | none | Visible: column resizing. **DONE 11 Aug. Record below.** |
| **K-4** ✅ | Toolbar — Filter, Sort, Columns panels | none | **Large** — the tool feel. **DONE 11 Aug in four steps, records below.** |
| **K-5a** ✅ | Storage adapter + Vercel Blob + upload endpoint + `TableImage` model | **`TableImage` table** | none. **DONE 11 Aug — 30/30 end-to-end + 44/44. Record below.** |
| **K-5b** ✅ | Image Management admin section | none | none. **DONE 11 Aug — 15/15. Record below.** |
| **K-5c** ✅ | Image rendering in cells, CSV id column, row-editor picker, guide | `col.meta.imageShape` | **Visible** — images appear. **DONE 12 Aug — 31/31 full chain. Record below.** |
| **K-6** | Admin table editor: badge colour list, shape dropdown, width defaults | none | none |
| **K-7** ⏸️ | *Deferred* — icons onto the upload path (J-4 revisited) | — | — |
| **K-8** ⏸️ | *Deferred* — rows out of the JSON blob | **large** | — |

### K-1 — Badge colour system

**Files:** `src/lib/badge-colors.ts` (new), `src/components/table/DataTable.tsx`,
`src/types/table.ts`.

1. Ten colour tokens defined once, each with a tinted background, readable foreground and a
   one-pixel border, in **both themes**. Not Tailwind literals — tokens, so the dark theme is
   designed rather than inverted.
2. `assignBadgeColors(values: string[])` — distinct values in a deterministic order, colour by
   index, wrapping past ten.
3. `DataTable` reads `col.meta.badgeColors` when present; **falls back to computing it on the fly**
   when absent, so all 296 columns are correct before anyone opens the editor.
4. Delete the `charCodeAt` block.

⚠️ **The fallback is what makes K-1 shippable alone.** Without it nothing improves until K-6 gives
the admin a way to store an assignment.

**Test cases**

| # | Case | Expect |
| --- | --- | --- |
| 1 | Courses / Pricing — `Free to Audit`, `Free Course`, `Paid Course` | **three different colours** |
| 2 | YouTube / Speaking Language — `English`, `Only Music`, `Hindi` | three different colours |
| 3 | Every one of the 75 single-colour columns | ≥2 colours wherever ≥2 values |
| 4 | All 296 badge columns, scripted | **zero within-column collisions** |
| 5 | A stored `meta.badgeColors` | **overrides** the computed assignment |
| 6 | An 11-value column (synthetic) | wraps, does not crash |
| 7 | Empty / null cell | renders `-`, not a badge |
| 8 | Contrast, both themes | AA against the tinted ground |

##### ✅ K-1 DONE — 11 Aug 2026 (badge colours)

**One new file, one function replaced.** `src/lib/badge-colors.ts` (new),
`src/components/table/DataTable.tsx`. No schema change, no migration, no new dependency.

**The assignment moved from the cell to the column.** The old rule could live inside the cell
renderer *because* it only looked at the one value in front of it — which is exactly why it was
broken: a cell cannot see its siblings, so it cannot avoid colliding with them. `badgeAssignments`
is now a `useMemo` keyed by column id.

⚠️ **This also made it cheaper.** The old rule ran once per cell; a 40-row table with two badge
columns computed 80 times on every sort, filter and page change. It now computes twice.

⚠️ **`col.meta.badgeColors` is read but not yet written — the fallback is what makes K-1 ship
alone.** When no assignment is stored, the component computes one from the data. All 296 columns
are therefore correct *now*, without waiting for K-6 to give the admin a way to save one. Verified
against the live API: the Courses table returns `meta: undefined`, so the fallback is the path
actually running in production.

###### ⚠️ Two traps worth keeping

**1. Tailwind cannot see a constructed class name.** The natural way to write the palette —

```ts
`bg-${color}-100 text-${color}-800`     // ❌ emits NO CSS
```

— produces nothing, because Tailwind scans source for **literal strings** and never evaluates
code. The badge would render unstyled, only in production, only for colours not used elsewhere in
the app. `BADGE_COLOR_CLASSES` is a lookup of complete literals for this reason, and that is why
it is 10 long lines rather than one clever one.

**Proven, not assumed:** all 20 classes (10 light + 10 dark) are present in the built CSS, and a
control colour deliberately outside the palette (lime, at the 100 step) is absent, so the check
discriminates rather than matching anything.

⚠️ **That control sentence originally named the class in full, and naming it CREATED it.**
Tailwind v4 uses automatic content detection with no config file, and it scans `.md` as readily
as `.tsx` — so writing the literal into this document compiled the class into the production
bundle, and a re-run of the control would have failed for a reason unrelated to the code.

**Generalisable: in a Tailwind v4 project, documentation is build input.** A class name written
anywhere in the repo exists. Controls must therefore be described rather than spelled, or the
docs excluded from the scan.

Measured before rewriting: **8 colour classes** existed in the CSS because a document mentioned
them and nothing in `src/` used them — about 500 bytes of 141 KB, so the cost is negligible and
the correctness point is the real one. Scoping Tailwind with `@source` would remove it; not done,
because a wrong path there silently produces a site with no CSS at all, which is a poor trade for
half a kilobyte.

**2. `localeCompare` would have been a hydration bug.** Distinct values are sorted with a plain
`<` comparison, not `localeCompare`, because this renders on the server and hydrates in the
browser. A locale disagreement about the order of two values is a disagreement about their
colours — a React hydration mismatch that would appear on some machines and not others. Sorting
(rather than first-seen order) also means re-importing the same CSV with rows shuffled does not
repaint the table.

###### TEST CASES — 23/23

⚠️ **The suite runs the shipped `badge-colors.ts` through `ts.transpileModule`**, not a copy of
the logic. An earlier attempt stripped types with regexes and broke on the first type predicate;
using the real compiler is both more robust and stops the test drifting from the source.

⚠️ **The old rule is reimplemented as a negative control.** Without it, "0 collisions" could mean
the fix worked *or* that the data was never broken. The control reproduces **exactly 155 and 75**
— the numbers from the §29.3 audit — proving the test measures the right thing.

| # | Case | Result |
| --- | --- | --- |
| 1 | All 296 badge columns — collisions, **old rule (control)** | **155** — matches the audit |
| 2 | All 296 badge columns — collisions, **new rule** | **0** |
| 3 | Columns rendering one colour — **old (control)** | **75** — matches the audit |
| 4 | Columns rendering one colour — **new** | **0** |
| 5–6 | The two columns the user reported | all values distinct |
| 7–8 | Row order / duplicates do not change colours | stable |
| 9–12 | Empty, blank, null, whitespace-equal values | no badge, or treated as one value |
| 13–14 | 11 values | wraps, 11th reuses the 1st |
| 15 | Non-string values coerce | `true` → sky |
| 16–19 | Stored override wins; **invalid override falls back** rather than throwing | correct |
| 20–23 | Palette integrity — 10, unique, all have bg/text/border **and a dark variant** | correct |
| — | Built CSS contains all 20 classes; an off-palette control colour absent | correct |
| — | `tsc`, `next build` | clean |

###### ⚠️ Automatic assignment guarantees DISTINCTNESS, not MEANING

Worth stating plainly, because the result is visible immediately:

```
Courses / Pricing     Free Course    -> emerald
                      Free to Audit  -> amber
                      Paid Course    -> sky
```

Alphabetical order puts *Free to Audit* second, so *Paid Course* lands on sky rather than the
amber that would read as "costs money". **Every value is distinct, which is the fixed bug** — but
the semantic pairing free=green / paid=amber is a judgement no algorithm can make. That is
precisely what `col.meta.badgeColors` and the K-6 editor are for.

###### 🔴 FOUND WHILE VERIFYING — table content is not server-rendered at all

Attempting to check the rendered HTML turned up something larger than the check.
`curl` of `/domain/gdesign/courses` returns **200 with no table in it** — no column headers, no
row values, no badges, old palette or new.

`TableLayout` is `'use client'` and fetches its data in a `useEffect`
(`/api/domain/tables/by-page/{id}`). **The table is never in the server HTML**; it appears only
after the browser runs JavaScript and completes a second round trip.

That means, across roughly **650 pages whose primary content is a table**:

- the content is absent from the initial HTML, so a crawler must execute JS to see any of it
- every table page costs an extra round trip after paint
- ⚠️ it cuts directly against **#8**, which is about getting content indexed

⚠️ **It also means K-1 cannot be verified by fetching a page**, and no headless browser is
installed. K-1's evidence is therefore: the module's own behaviour against real data (23/23), the
built CSS (20 classes + control), and confirmation that the API delivers exactly the three values
with no stored `meta` — i.e. that the tested fallback path is the one that runs. **The final
visual check is the user's.**

Recorded as **#30**, unscheduled — it is a rendering-architecture change, not part of Phase K, and
it interacts with K-8.

### K-2 — Read the settings that already exist

**Files:** `TableLayout.tsx` (drops `settings` today), `DataTable.tsx`, `src/lib/table-utils.ts`.

1. Pass `settings` through `TableLayout` — it is currently typed `settings?: any` and discarded.
2. `ui.density` → three fixed row heights.
3. `ui.stickyHeader`, `ui.alternatingRows`, `ui.showBorders`.
4. `pagination.pageSize` → replaces the hardcoded `25`; `showSizeSelector`, `showInfo`.
5. Fall back to `DEFAULT_TABLE_SETTINGS` when a field is absent.
6. **Delete `src/lib/export-table.ts`** (dead, and export is not wanted publicly) and the unused
   `ColumnResizeMode` import and dead `formatDate` in `DataTable`.

⚠️ **Verify against a table whose stored settings differ from the defaults**, or this passes while
still ignoring the field — the settings blob exists on all 654 tables but has never been read, so
its contents are unproven.

##### ✅ K-2 DONE — 11 Aug 2026 (reading the stored settings)

**Files:** `src/lib/table-utils.ts`, `DataTable.tsx`, `DataTablePagination.tsx`,
`TableLayout.tsx`. No schema change. One data update across 654 rows.

###### ⚠️ FIRST: the settings blob was boilerplate, not decisions

Before writing anything, the stored blobs were surveyed. **All 20 fields hold exactly one
distinct value across all 654 tables.** Nothing has ever been edited, because no screen writes
them — `TableSchemaEditor` stamps `DEFAULT_TABLE_SETTINGS` at creation and that is the end of it.

The proof is `export.enabled: true` sitting on every table beside a user decision *not* to have
export on public pages. **These values were never chosen.**

That reframed K-2 from "obey the settings" to "make the settings honest", and produced two
different answers for two fields that looked identical:

| Field | Stored | Decision |
| --- | --- | --- |
| `ui.alternatingRows` | `true`, **never implemented** | Implemented, then **defaulted to `false` and the 654 rows updated to match** — see below |
| `export.enabled` | `true`, and **genuinely real** | Left `true` — see the correction below |

###### ⚠️ CORRECTION — `export-table.ts` is NOT dead, and §29.2 was wrong about it

§29.2 recorded it as *"71 lines, imported by nothing"* and K-2 planned to delete it. **Both were
wrong.** `TableEditor` and `TablesManager` each import `downloadTableExport`.

The audit grep was:

```bash
grep -rn "export-table" src | grep -v "lib/export-table"    # ❌
```

⚠️ **The exclusion pattern matched the import path itself.** `from '@/lib/export-table'`
contains `lib/export-table`, so every line that proved the file was used was filtered out by the
filter meant to exclude the file's own contents. **An exclusion that matches the import path
cannot find imports.**

Caught by checking before deleting rather than after. Export exists, in the admin, and works;
the user's decision was that it does not belong on **public** pages, which was already true —
no public surface has ever rendered an export control.

⚠️ Flipping `export.enabled` to `false` would also have been actively misleading: `TablePreview`
renders it as an "Enabled / Disabled" badge in the creation wizard, while admin export runs
unconditionally without consulting it. The badge would have claimed export was off while the
button beside it kept working.

###### What now works

| Setting | Before | After |
| --- | --- | --- |
| `ui.density` | **nothing controlled row height** — content-driven, so a badge or a description popover silently made rows taller (#29.5) | three fixed paddings: `py-1` / `py-2.5` / `py-4` |
| `ui.stickyHeader` | stored `true`, not implemented | header sticks within a `max-h-[70vh]` scroll container |
| `ui.showBorders` | stored `true`, not implemented | frame and row rules |
| `ui.alternatingRows` | stored `true`, not implemented | implemented, **default `false`** |
| `pagination.pageSize` | **hardcoded `25`** | read from settings; `enabled: false` shows every row |
| `pagination.showSizeSelector` | always shown | honoured |
| `pagination.showInfo` | rendered "Page 1 of 2" | **"1–10 of 41 rows"**, which is what the type has always documented it to mean |

⚠️ **`showInfo` counts the FILTERED rows**, and says so when they differ: *"1–10 of 12 rows
(filtered from 412)"*. Showing the raw total beside a filtered result claims the filter did not
work.

⚠️ **`resolveTableSettings` is a hand-written deep merge, not a spread.** `{...DEFAULT,
...stored}` is shallow, so a blob containing only `{ui:{density:'compact'}}` would replace the
whole `ui` object and drop `showBorders` and `stickyHeader` to `undefined` — read as "off". A
partial save from the K-6 editor would silently turn features off that nobody touched.

⚠️ **`??` throughout, never `||`** — every field is a boolean or a number, so `false` and `0`
are legitimate. `stored.showBorders || true` makes `false` unexpressible. Same class as #28.

###### Data change — 654 rows

`ui.alternatingRows` set to `false` on every table, because a default only applies where a
stored value is absent: leaving the stored `true` would have striped the entire site the moment
the renderer started obeying it.

Verified after: **20 settings paths still present** (a drop would mean a shallow spread ate
keys), every other field unchanged, `density`/`stickyHeader`/`showBorders` untouched.

###### 🔴 THE STICKY HEADER DID NOT STICK — a vendored component owned the scroll container

**Found by the user in the browser, immediately after K-2 shipped.** Three tables, three
different symptoms, which is what made it look random:

| Page | Symptom |
| --- | --- |
| `/gdesign/tools` | **No header row at all** |
| `/gdesign/newsletters` | Header **sliced in half** |
| `/gdesign/instagrampages` | Header fine |

The pattern is scroll position: correct at the top, degrading as the container scrolls. The
header was not sticking; it was scrolling away like any other row.

**Cause — `components/ui/table.tsx` renders its own wrapper:**

```jsx
<div data-slot="table-container" className="relative w-full overflow-x-auto">
  <table>…</table>
</div>
```

`position: sticky` anchors to its **nearest scrolling ancestor**, and that div is one.

⚠️ **`overflow-x: auto` makes an element a scroll box on BOTH axes** — the spec forces the
other axis away from `visible` — so it qualified as the anchor, while nothing constrained its
height, so it never actually scrolled. **The header stuck faithfully to the top of a box that
never moved**, while the real scrolling happened in the `max-h-[70vh]` div one level further
out.

**Generalisable: a wrapper you did not write can silently become the scroll container.** The
sticky element and the element that scrolls must be the same box, and `overflow` anywhere
between them decides which box that is.

**Fixed without editing the vendored file** — the cap is applied to shadcn's own div through
its `data-slot`:

```
[&_[data-slot=table-container]]:max-h-[70vh]
[&_[data-slot=table-container]]:overflow-y-auto
```

Verified the arbitrary variant actually compiles — it is an unusual selector and a silent miss
would look exactly like the original bug:

```css
.[&_[data-slot=table-container]]:max-h-[70vh] [data-slot="table-container"] { max-height: 70vh }
```

**Two smaller fixes in the same change:**

⚠️ **`relative` and `sticky` were both on the `<th>`.** Both set `position`, so the outcome
depended on tailwind-merge and CSS source order rather than on intent. `relative` now applies
only in the non-sticky branch; it is needed for K-3's resize handle, and a sticky element is
already a positioning context.

⚠️ **A sticky `th` scrolls away from its own border.** Tailwind's preflight sets
`border-collapse: collapse`, which hands cell borders to the table's grid rather than to the
cell — so the header would have floated over the rows with nothing separating them. Replaced
with `shadow-[inset_0_-1px_0_0_var(--border)]`, which belongs to the element and travels with
it.

###### Scrollbars — thin and themed, app-wide

Giving the table its own scroll container put a default OS scrollbar beside the page's default
OS scrollbar. Reference for the intended look was `demo.port.io`: a thin rounded thumb, no
visible track.

⚠️ **shadcn's `ScrollArea` was considered and rejected**, despite being the obvious answer:

- It only styles containers you wrap, so it **could never reach the page's own scrollbar** —
  the fix would have been half-done by construction, leaving a styled table scrollbar beside a
  default page one.
- Its viewport renders children inside `<div style="min-width:100%; display:table">`, and an
  unexpected wrapper around this exact table is what had *just* broken `position: sticky`.
- A dependency and a component file, for a visual change.

Two inherited CSS properties on `html` do the whole job — `scrollbar-width` and
`scrollbar-color` — reaching the page, the table, the sidebar, popovers and the admin at once,
with no structural change anywhere.

⚠️ **Both syntaxes are declared and they do not conflict.** Chrome uses `::-webkit-scrollbar`
and ignores the standard properties when pseudo-elements are styled; Firefox does the reverse,
having never supported them. Each engine takes the one it implements, so no `@supports` guard is
needed. The pseudo-elements earn their place by providing a **hover state**, which
`scrollbar-color` cannot express — there is no selector for the thumb.

⚠️ **No dark variant needed** — `--muted-foreground` is already redefined under `.dark`, so the
thumb follows the theme. The opposite of the `.rich-text-content` rule in the same file, which
is pinned to a light card and documents why.

Verified in the served CSS: Lightning CSS emitted the fallback pattern by itself — plain
`var(--muted-foreground)`, then the softened `color-mix` inside
`@supports (color: color-mix(in lab, red, red))`. Also styles
`::-webkit-scrollbar-corner`, which otherwise paints an opaque square where a table's two
scrollbars meet.

`ScrollArea` remains the right call for the **sidebar** (already on the user's board) — no sticky
children there, and an overlay scrollbar suits a plain list. Separate job.

###### ⚠️ THE H-2 LESSON, HIT A THIRD TIME

The positive control **failed on the first run** — the API returned `normal`/`true`/`25` after
the test had written `compact`/`false`/`7`.

Cause: `getTableFromDB` is wrapped in `unstable_cache` with tags. The test wrote through Prisma,
so `revalidateTag` never fired and the public API kept serving the cached old settings. **The
code was correct; the test was wrong.**

Rewritten to drive `PUT /api/admin/tables/[id]`, which calls `invalidatePages()`. **Mutate
through the API, always** — this is now three occurrences (H-2, J-3, K-2).

###### TEST CASES — 36/36

⚠️ **Every case uses a NON-DEFAULT value as its control.** All 654 blobs are identical and
several match the constants the old code hardcoded — `pageSize: 25` most obviously — so "the site
still looks right" cannot distinguish *reading* the setting from *ignoring* it.

| # | Case | Result |
| --- | --- | --- |
| 1–3 | `undefined` / `null` / `{}` → defaults | correct |
| 4–7 | **Partial blob** — stored field honoured, siblings and other blocks survive | correct |
| 8–12 | **`false` and `0` preserved**, not treated as absent | correct |
| 13–17 | Garbage in the Json column (string, number, array, bool, wrong shape) | falls back, never throws |
| 18–20 | Density map — three keys, distinct, vertical padding only | correct |
| 21–23 | Defaults changed as decided | correct |
| 24–28 | All 654 rows updated; **no settings key lost** | correct |
| 29–36 | **Positive control** — admin PUT of `compact`/`false`/`7` reaches the public API and resolves to `py-1` | correct |
| — | `tsc`, `next build` | clean |

**Removed as genuinely dead:** the unused `ColumnResizeMode` import (K-3 re-adds it deliberately)
and `formatDate`, declared once and called never.

⚠️ **Not verifiable by fetching HTML** — see #30. The end-to-end proof stops at the API payload;
the visual check is the user's.

### K-3 — Alignment, width, resizing

1. Apply `col.align` — **already set on all 2,675 columns and ignored today**.
2. Apply `col.width` as the initial width; `minWidth`/`maxWidth` as bounds.
3. Re-enable resizing properly: `columnResizeMode: 'onChange'`, a real drag handle, **state only**
   — no persistence, per decision (c).
4. `font-variant-numeric: tabular-nums` wherever content is numeric.

**Test:** drag persists within the visit, **resets on reload**, respects min/max, and a table with
no widths set looks exactly as it does today.

##### ✅ K-3 DONE — 11 Aug 2026 (alignment, widths, column resizing)

**One file:** `DataTable.tsx`. No schema change, no data change, no new dependency.

###### ⚠️ The survey first: two of the three planned changes are invisible

| Field | Stored on 2,675 columns | Effect of wiring it |
| --- | --- | --- |
| `col.align` | **`"left"` on every one** | **None visible** — left is already the rendered default |
| `col.width` / `minWidth` / `maxWidth` | **`undefined` on every one** | **None** — nothing to apply |
| `col.searchable` | `false` on 469 | **Almost none** — 468 are the hidden `Target Countries` system column, stripped server-side. One real column. |

So K-3's visible content is **column resizing alone**. The rest is plumbing so the K-6 editor
has somewhere to write. Recorded plainly rather than presented as three features.

Also measured: tables are **max 7 columns, median 4**, which is why resizing matters less here
than the request implied — there is rarely a width problem in four columns.

###### ⚠️ WHY THE RESIZE IS HAND-WRITTEN INSTEAD OF `columnResizeMode: 'onChange'`

TanStack's resizing requires every column to carry an explicit `size`, which forces the table
into a **fixed layout**. No column has a width today, so the browser auto-sizes to content —
and that is precisely why the tables look right: a long *Course Name* takes the room it needs
with nothing configured.

Re-laying-out all 654 tables to enable an interaction nobody sees until they drag is a bad
trade. **This is also the trap the original attempt fell into** — the commented-out code
inferred widths from column type (`description ? 280 : link ? 200 : 150`), which would have
changed every table's proportions on the day it shipped.

So nothing is sized until someone drags:

| State | Layout |
| --- | --- |
| Untouched (every table, every load) | browser auto layout — **identical to before**, still responsive |
| After a drag | `table-fixed` with pinned widths, so the drag is obeyed exactly |
| After reload | untouched again — per decision #29.6(c) |

⚠️ **The first drag measures EVERY column, not just the dragged one.** Setting a width on one
column of an auto-laid-out table makes the browser redistribute the rest, so the neighbours
would visibly jump mid-drag. `mousedown` snapshots what the browser has already chosen for all
columns and pins them at once — invisible at the moment it happens, and it is what makes the
drag behave.

⚠️ **The starting width is read from the DOM, not from state.** `setColumnWidths` earlier in the
same handler has not applied yet, so a state read would start every drag from the fallback
150px and the column would jump before moving. Measuring sidesteps the timing entirely.

⚠️ **`table-fixed` is required, not cosmetic.** Under auto layout a `width` is a hint the
browser may overrule when content demands more — the drag would feel like it was fighting back.

Smaller decisions:
- **Listeners on `document`, not the handle** — the pointer routinely leaves a 6px strip
  mid-drag, and a handler bound to the handle would stop tracking.
- **No handle on the last column** — a `w-full` table has nowhere to give the space back to.
  Derived from `getVisibleLeafColumns()`, ⚠️ **not `column.getIsLastColumn()`**, which belongs
  to the column-pinning feature that is not enabled. It also respects the View menu, so hiding
  the last column moves the omitted handle.
- **Double-click resets** a column to automatic sizing — the quickest way out of a bad drag.
- **`cursor` and `user-select` are set on `<body>` during the drag**, so the resize cursor
  survives the pointer crossing other content.

###### Verification

⚠️ **A drag cannot be tested here** — it is a DOM interaction, the table is not
server-rendered (#30), and no headless browser is installed. What was verified:

| Check | Result |
| --- | --- |
| `tsc`, `next build` | clean |
| `table-fixed`, `cursor-col-resize`, `text-left/center/right`, `translate-x-1/2`, `absolute` in built CSS | all present |
| `/courses`, `/tools`, `/newsletters` still serve | 200 ×3 |
| **The no-op claim** — API payload carries `align: "left"`, `width: null` on every column | confirmed, so every table still renders on auto layout |

**The drag itself is the user's to test.**

### K-4 — The toolbar

**Files:** `DataTableToolbar.tsx`, `DataTableFilterPanel.tsx`, `DataTableSortPanel.tsx` (new),
`DataTableViewOptions.tsx` (gains reorder), `DataTable.tsx`.

Filter, Sort and Columns panels as described in 29.7. Filter state stays in **one place** so K-8
and any later URL support are a change of source, not a rewrite.

⚠️ **Keep the header click as the fast path.** The Sort panel is for what a header click cannot
express — sort by Pricing, then Name inside it. Replacing header sorting with a panel would make
the common case slower.

##### ✅ K-4a DONE — 11 Aug 2026 (toolbar shell + density)

`DataTable.tsx` had reached **892 lines** with the toolbar inlined mid-file. Extracted to
`DataTableToolbar.tsx` (215 lines), which fixes the layout rule for everything that follows:
**search left, controls right** — so K-4b…K-4d extend a group that already exists instead of
reshaping the row each time.

**Density control added.** ⚠️ **It is the visitor's, not the table's** — seeded from
`settings.ui.density`, overriding it for that visit only, resetting on reload. Identical shape
to the K-3 column widths and for the same reason: one reader preferring tighter rows must not
change the page for everyone.

⚠️ **A bug fixed in passing:** `getBadgeColumnFilters` offered a chip for **every** badge
column, ignoring `col.filterable`. A column explicitly marked unfilterable still got one. The
replacement honours it, and sorts the chip options so the list does not depend on row order.

Sub-text under each density option was removed at the user's request after testing.

##### ✅ K-4b DONE — 11 Aug 2026 (the Sort panel)

`DataTableSortPanel.tsx` — multi-column sort with precedence, drag to reorder, per-rule
direction.

⚠️ **The header click is untouched and remains the fast path.** The panel exists for what a
header click *cannot* express: an order of precedence — Pricing first, then Name within each
pricing group. Replacing header sorting with a panel would make the common case slower to
serve a rarer one.

**No second source of truth.** TanStack's `sorting` state is already an ordered array whose
first entry is the primary key; the panel edits that array directly rather than keeping its own
model, so the two cannot drift.

###### ⚠️ `sorting.multiSort` was `false` on all 654 tables — flipped, as in K-2

Same situation as `ui.alternatingRows`: one distinct value everywhere, stamped once at
creation, never edited because no screen writes it. Left alone it would have made the Sort
panel single-rule — **and a sort panel that cannot express "Pricing, then Name" is the header
click with extra steps.**

Default changed to `true` and **all 654 stored rows updated to match**, because a default only
applies where a stored value is absent. Verified afterwards: 20 settings paths still present,
every other field unchanged.

`enableMultiSort` is also passed to the table — it governs **shift-click on a header**, not the
panel, so setting it keeps the two routes consistent rather than letting an accidental
shift-click do what the setting forbids.

Smaller decisions:
- **"Sort by" / "then by" labels.** A list of identical rows does not convey precedence; someone
  would reasonably read them as independent sorts.
- **A column already used is removed from the other rules' menus** — two rules on one field
  have no effect.
- **"Add sort" is disabled, not hidden**, when every column is used. A control that vanishes
  leaves the reader wondering whether they imagined it.
- ⚠️ **`onDragOver` calls `preventDefault()`.** Without it the browser treats the row as an
  invalid drop target and the drop never fires — the usual reason hand-rolled HTML5 dragging
  silently does nothing.
- ⚠️ **`SelectValue` is given explicit children**, the G-3c trap: Radix renders a blank trigger
  server-side otherwise.

###### ⚠️ THE H-2 LESSON, A FOURTH TIME — this time in a data script, not a test

The verification read `multiSort: false` from the API while the database held `true` on all 654
rows. The bulk update went through Prisma, so `revalidateTag` never fired and
`getTableFromDB`'s `unstable_cache` kept serving the old value.

**Bounded, unlike the earlier occurrences:** `CACHE_DURATIONS.MEDIUM` is **60 seconds**, so a
bulk settings change becomes visible within a minute on its own. Confirmed by re-reading after
the TTL. It is not indefinite — but ⚠️ the service's own comment notes the Data Cache persists
**across deployments**, so "it will be fine after deploy" is not the reason it resolves; the TTL
is.

**Generalisable: a bulk script that writes settings directly is invisible for up to a minute.**
Any admin edit fires `invalidatePages()` and clears it immediately, if the wait matters.

###### 🔴 I MIGRATED DEVELOPMENT AND SHIPPED CODE THAT DEPENDED ON IT

**Found by the user on the deployed site, 11 Aug 2026.** Symptom: *"after clicking Add Sort
the first time it works, then the Add sort button greys out — but sometimes it works."*
Correct locally, wrong on Vercel.

Measured, read-only, across both Neon branches:

```
development   654 tables   multiSort:true = 654   alternatingRows:false = 654
PRODUCTION    652 tables   multiSort:true =   0   alternatingRows:false =   0
```

⚠️ **Both data migrations ran on development only.** `resolveTableSettings` merges the stored
blob *over* the code defaults, so the stored value always wins — changing a default is only
half the change.

Two live consequences on production, from one mistake:

| Field | Production held | Effect |
| --- | --- | --- |
| `sorting.multiSort` | `false` | **"Add sort" disabled after one rule** — the reported bug |
| `ui.alternatingRows` | `true` | ⚠️ **Tables striped on production**, since K-2 shipped the implementation — a visual regression nobody had reported yet |

The intermittency was the 60-second cache TTL straddling the local migration.

**Generalisable: a code change that depends on a data change is not done until every branch
has it.** The verification for K-2 and K-4b both asserted against the development database and
passed — they were measuring the environment the migration had run in. **A migration
verified only where it was run proves nothing about anywhere else.**

⚠️ It also survived the tests because both suites read `DATABASE_URL` from `.env`, which points
at development by design. Nothing in the process compared branches until this bug forced it.

**Fixed by** `scripts/align-table-settings.mjs` — one idempotent script covering both fields,
committed rather than left in a scratch directory precisely so it can be run per branch and
re-run safely. It reports which branch it is pointed at, only selects rows that still
disagree, spreads every level explicitly, and verifies afterwards that all 20 settings paths
survive.

###### Verification

| Check | Result |
| --- | --- |
| `tsc`, `next build` | clean |
| `/courses`, `/tools`, `/ytube` | 200 ×3 |
| development: 654/654 hold `multiSort: true` | confirmed |
| `multiSort` reaches the client | confirmed after the 60s TTL |
| All 20 settings paths intact after the update | confirmed |
| Script re-run on development | **0 rows to touch** — idempotent |
| **PRODUCTION** — script run by the user, 11 Aug | **652 updated**, 20 paths intact, all fields uniform |
| **PRODUCTION** — re-run to confirm | **0 rows to touch** — idempotent on both branches |

⚠️ **The data fix needed no deploy.** Both the live site and the preview read the same
production database, so each picked the corrected settings up within the 60-second TTL on
whatever code it was already running — the stripes stopped on `atno.io` (K-2 code) and
"Add sort" started working on the preview (K-4b code), with no merge involved.

That separation is worth keeping in mind: **when a bug comes from data rather than code, the
fix ships without a release** — and verifying it before merging isolates the data mistake from
whatever the next merge contains.

⚠️ **The panel's interactions cannot be tested here** — no headless browser, and the table is not
server-rendered (#30). Drag, precedence and the direction menus are the user's to check.

##### ✅ K-4c DONE — 11 Aug 2026 (the Filter panel)

`src/lib/table-filters.ts` (219 lines) + `DataTableFilterPanel.tsx` (353). The badge chips are
gone and the left side of the toolbar is now the search box alone.

###### What was actually broken

The faceted chips could only filter **badge** columns — 296 of 2,675. **Everything else on
every table was unfilterable**, and the reason was buried in a three-way ternary:

```ts
filterFn: col.type === 'badge' ? (hand-rolled array check)
        : col.type === 'text' || col.type === 'description' ? 'includesString'
        : 'auto'
```

A `link` column got whatever `'auto'` inferred, and no UI ever set a filter on one anyway.
Now every column is filterable, with operators chosen for its type — `link` gets
*contains / does not contain / is empty*, but not *starts with*, which on a URL asks about the
protocol rather than the content.

###### ⚠️ Conditions combine with AND. The And/Or selector was NOT built

The design note sketched one. Deliberately skipped:

- TanStack applies `columnFilters` with AND and gives no hook to change it. OR would mean
  bypassing `columnFilters` entirely and reimplementing the filter engine on `globalFilter` —
  a large change to the one part of the table that already works.
- **OR within a column already exists, and is where it is wanted:** `is any of` matches
  several badge values at once. Across *different* columns it is rare — nobody asks a 40-row
  table for "Pricing is Free OR Name contains adobe".

So the panel prints fixed **"Where" / "And"** labels rather than a dropdown. ⚠️ **A UI must not
offer a choice that does not exist**, which is what a disabled or single-option selector would
have done.

Known limit, stated rather than hidden: **one condition per column**, because `columnFilters`
is keyed by column id. "Name contains a AND Name contains b" is inexpressible. Supporting it
costs the same as OR — filter state outside the table — for a rarer case.

###### ⚠️ The predicate lives outside React, on purpose

`matchesCondition` is in `src/lib/table-filters.ts`, not in the component. The panel cannot be
tested here at all — no headless browser, table not server-rendered (#30) — and **the predicate
is the part that can be silently wrong**. An operator that quietly matches empty cells looks
like working software until someone notices rows missing.

Two judgements worth keeping:

- ⚠️ **`does not contain` KEEPS empty cells.** The other reading — a blank cell cannot be
  judged — silently drops every row with a gap in that column, the opposite of what someone
  excluding a term expects.
- ⚠️ **An incomplete condition matches everything.** Adding a condition is two steps, pick the
  column then type; emptying the table in between would read as a bug.

`tableFilterFn` also tolerates the two older filter shapes — a bare `string[]` from the chips
and a bare `string` from `includesString` — so a filter carried across a render degrades
instead of throwing on `undefined.op`.

###### TEST CASES — 44/44

| # | Case | Result |
| --- | --- | --- |
| 1–8 | Text operators, case-insensitive, whitespace-trimmed | correct |
| 9–12 | **`notContains` keeps empty and null cells** | correct |
| 13–18 | `isEmpty` / `isNotEmpty`, including whitespace-only and null | correct |
| 19–23 | `isAnyOf` / `isNoneOf`, **exact not substring** | correct |
| 24–27 | **Incomplete conditions hide nothing** | correct |
| 28–33 | Back-compatible with both older filter shapes | correct |
| 34–41 | Operator tables, defaults, `describeCondition` | correct |
| 42–44 | **15,911 column/operator combinations against the real 654 tables** — no filter returned more rows than exist, no incomplete condition hid a row, `isEmpty`+`isNotEmpty` partition every column exactly | correct |
| — | `tsc`, `next build`, 3 pages 200 | clean |

**Deleted:** `DataTableFacetedFilter.tsx`, 154 lines, now imported by nothing. ⚠️ Verified with
an unfiltered `grep` this time — the K-2 `export-table.ts` mistake was an exclusion pattern
that also matched the import lines it was looking for.

⚠️ **The panel's interactions are the user's to test** — same limitation as K-4b.

##### ✅ K-4d DONE — 11 Aug 2026 (the Columns panel)

`DataTableColumnsPanel.tsx` replaces `DataTableViewOptions.tsx`. Visibility and order in one
control, because those two questions are asked together: *which columns, in what order*.

###### ⚠️ The old View menu had three faults beyond the missing reorder

- **It closed on every toggle.** Radix's `DropdownMenuCheckboxItem` dismisses the menu on
  select unless `onSelect` calls `preventDefault()`, which it did not — so hiding three
  columns meant opening the menu three times. A `Popover` has no such behaviour.
- **It was `hidden lg:flex`.** ⚠️ Below 1024px there was **no column control at all** — on
  exactly the screens where hiding a column matters most, because horizontal space is scarce.
- **Nothing could reorder.** Column ordering was on the user's original list and had no home.

###### Notes

⚠️ **`columnOrder` must list EVERY column.** TanStack treats a partial array as the complete
order and drops whatever is missing — the columns simply disappear. The handler builds the
array from the current on-screen order, so it cannot be partial by construction.

⚠️ **Columns that cannot be hidden are still listed**, with a disabled checkbox. They can still
be *reordered*, and omitting them would make the panel's order disagree with the table's.

**Order is the visitor's and resets on reload** — consistent with column widths (K-3) and
density (K-4a). Reordering a shared page for everyone is an admin decision, and there is no
admin surface for it yet.

Smaller: the label is the checkbox's click target, so the row is usable rather than a 16px
square; *Reset order* and *Show all* are disabled rather than hidden, so the row does not jump
as you use it.

**Deleted:** `DataTableViewOptions.tsx`. ⚠️ Verified with an unfiltered `grep` — only its own
file and one comment referenced it.

###### Verification

| Check | Result |
| --- | --- |
| `tsc`, `next build` | clean |
| Grid tracks, `cursor-grab`, `cursor-grabbing` in built CSS | present |
| `/courses`, `/tools`, `/ytube`, `/domain`, `/sitemap.xml` | 200 ×5 |
| **All three suites re-run** — K-1 23/23, K-2 36/36, K-4c 44/44 | **103/103** |

⚠️ **Drag and toggle are the user's to test** — no headless browser, table not server-rendered
(#30).

---

## Phase K so far

| Step | State |
| --- | --- |
| K-1 badge colours | ✅ |
| K-2 stored settings | ✅ |
| K-3 alignment, widths, resizing | ✅ |
| K-4a toolbar + density | ✅ |
| K-4b Sort panel | ✅ |
| K-4c Filter panel | ✅ |
| K-4d Columns panel | ✅ |
| K-5 images | next — the only step adding infrastructure |
| K-6 admin table editor | after K-5 |
| K-7 icons on the upload path | deferred |
| K-8 rows out of JSON | deferred, trigger: a table crossing ~1,000 rows |

**The toolbar is complete.** `DataTable.tsx` is 847 lines with five focused components beside
it, against 892 lines of one file when Phase K started — while gaining density, resizing,
multi-sort, a condition builder and column reordering.

### K-5a — Storage adapter, Vercel Blob, upload endpoint

**Schema:**

```prisma
model TableImage {
  id        String   @id @default(uuid())
  key       String   @unique          // "pixabay" — what rows reference
  url       String                    // content-hashed object URL
  provider  String   @default("vercel-blob")  // survives the R2 move
  width     Int
  height    Int
  bytes     Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

⚠️ **`provider` exists from day one** so a partially-migrated bucket is representable. Without it,
the R2 move would be all-or-nothing with no way to serve old and new objects side by side —
see `BLOB-TO-R2-MIGRATION.md`.

**The adapter** — `src/lib/storage/index.ts`:

```ts
export type StorageAdapter = {
  put(key: string, body: Buffer, contentType: string): Promise<{ url: string }>;
  delete(url: string): Promise<void>;
  exists(url: string): Promise<boolean>;
};
```

`vercel-blob.ts` implements it. `cloudflare-r2.ts` ships **written and commented out**. Selection
is by `STORAGE_PROVIDER` env var. ⚠️ **No route, component or script may import a provider
directly** — that is the single rule that keeps the migration cheap.

**Upload endpoint** — `POST /api/admin/table-images`, admin-only:

| Step | Why |
| --- | --- |
| Cap request size before reading | A decompression bomb must not reach the decoder |
| **Magic-byte check**, not extension | A file named `.png` proves nothing |
| **Reject SVG** | The upload risk from #27 |
| `sharp` → 64×64 WebP | Consistency, and **re-encoding discards anything embedded** — the real defence, rather than trying to detect payloads |
| Content-hash the output | Immutability for free (29.7) |
| `put` via the adapter, then `TableImage` row | — |

**Test:** valid PNG → 2 KB WebP; JPG → same; **SVG → 400**; `.png` that is really an SVG → 400;
20 MB file → rejected before decode; duplicate bytes → same hash, no second object; unauthenticated
→ 401.

### K-5b — Image Management admin section

`/admin/images` per 29.7 — grid, usage counts, unused filter, upload, rename, replace, delete.

⚠️ **Usage must be computed by scanning row JSON**, since there is no join table. At 654 tables
that is one query and an in-memory pass — fine now, and it is exactly what K-8 would make cheap.

**Test:** an image used by 40 rows reports 40; delete is refused and names them; an unused image
appears under the filter and deletes cleanly; replacing artwork changes all 40 rows at once.

### K-5c — Images in cells, CSV, picker, guide

1. `formatCellValue` gains an image branch — currently **absent entirely**.
2. `col.meta.imageShape`: `'circle' | 'square'`; **`'cover'` written and commented out**.
3. Rendered **inside the name cell**, before the text.
4. CSV import maps an image-id column; unknown ids are **reported, not silently dropped**.
5. Row-editor picker, reusing `IconPicker`'s shape.
6. **`TABLE-IMAGES-GUIDE.md`** — sourcing, formats, what not to upload, the whole flow.

⚠️ **No `next/image`, no `remotePatterns`.** Objects are pre-sized at 64px and served from the
storage host with a long cache. Running them through the optimiser would add per-transformation
cost for no benefit. ⚠️ This reverses an earlier recommendation of mine that assumed hotlinked
third-party images — it does not apply to self-hosted, pre-sized objects.

##### ✅ K-5a DONE — 11 Aug 2026 (storage, upload endpoint, `TableImage`)

**Migration `20260811105907_add_table_images`.** Purely additive — a new table, nothing existing
touched, no backfill possible or needed. ⚠️ Applied to **both branches** before the code
merged, per the standing rule.

**New:** `src/lib/storage/{index,vercel-blob,cloudflare-r2}.ts`, `src/lib/image-processing.ts`,
`POST|GET /api/admin/table-images`. **Installed:** `@vercel/blob`, `sharp`.

###### The three decisions the rest of Phase K rests on

**1. Rows store a `key`, never a URL.** Measured reuse is 1.68× (7,602 rows → 4,521 distinct
things; `pixabay` alone serves 40 rows). Stored as URLs that is 40 writes to change one picture,
and moving storage provider would mean rewriting thousands of rows inside 654 JSON blobs.

**2. Object names are content hashes.** Different bytes ⇒ different URL, by construction. That
makes `immutable, max-age=31536000` safe and **removes the "never overwrite, use `-v2`"
discipline that `ICON-GUIDE.md` §9 needs** for repository-hosted icons. Replacement is a normal
operation here rather than a procedure.

**3. Nothing outside `src/lib/storage/` may import a provider.** One rule, asserted by a test
that walks `src/` looking for `@vercel/blob` or the S3 client. It is what keeps
`BLOB-TO-R2-MIGRATION.md` a short document.

⚠️ `TableImage.provider` exists from day one so a **partially** migrated bucket is
representable. Without it the R2 move would be all-or-nothing with a broken window in between.

###### Upload security — re-encoding is the defence, the rest are filters

⚠️ **This is the case #27.5's correction was about.** That entry noted stored SVGs are only
dangerous when uploads are accepted; this endpoint accepts uploads.

Size cap before decode · pixel cap · magic-byte sniffing (never the extension) · SVG rejected
outright · **then decode to raw pixels and re-encode as 64×64 WebP**.

**Filters can be evaded; re-encoding cannot.** It discards everything that is not image data
rather than trying to detect it. Proven, not asserted: a PNG carrying EXIF `Copyright: SECRET`
comes back with no EXIF, and a `<?php …?>` payload appended after the image data does not
survive. A useful side effect is that GPS coordinates in phone screenshots are destroyed before
anything is stored.

###### 🔴 Two real bugs, both found by the end-to-end test against the real store

**1. `allowOverwrite` was missing, and uploads failed for identical bytes.**

Vercel Blob throws if the destination pathname exists. Content hashing means **the same image
under a second key produces the same pathname** — so "upload this logo under another key"
returned a 500. Not an edge case: the same logo under two keys, and re-adding an image after
deleting it, both hit it.

⚠️ Overwriting is safe *precisely because* the name is a hash: the only file that can collide is
byte-identical. The write is idempotent by construction, which is the property the hash was
chosen for.

**2. Shared objects were deleted out from under each other.**

```
upload logo.png as "a"  -> object H
upload logo.png as "b"  -> object H     (same bytes, shared — by design)
replace "a"'s artwork   -> deleted H    -> "b" now points at nothing
```

**Dedup requires reference counting**, and the first version had the first without the second.
Both `PATCH` and `DELETE` now count other rows on that URL before removing the file.

###### ⚠️ And one bug that wasn't — a test that was not idempotent

A run showed a freshly uploaded object 404-ing *and* a deleted one still returning 200 —
contradictory, so neither could be believed. A direct probe of the Blob API showed the pipeline
correct throughout (`PUT → exists → 200 → delete → gone → 404`, `x-vercel-cache: MISS`).

The fixtures used **fixed colours**, so every run produced identical bytes, an identical hash and
therefore **the same URLs** — run 2 was fetching URLs run 1 had created and deleted, and getting
cached answers. **Generalisable: content-addressed storage makes a test that reuses fixtures
non-idempotent by construction.** Fixtures now vary per run.

###### Deployment — see #31

The endpoint worked perfectly on localhost and returned 500 on Vercel. Full record at **#31**;
it took two rounds and neither could be reproduced locally.

###### Verification — 30/30 end-to-end + 44/44 unit

| Check | Result |
| --- | --- |
| Auth refused before the body is parsed | correct |
| Upload → 64×64 WebP, ~200 bytes, content-hashed URL | correct |
| Served as `image/webp` with `max-age=31536000` | correct |
| SVG — plain, behind `<?xml`, uppercase, **and named `.png`** | rejected ×4 |
| GIF, text, empty, oversize | rejected |
| **EXIF destroyed; appended payload does not survive** | correct |
| Duplicate key → 409 (conflict, not silent overwrite) | correct |
| **Shared object survives a replace** | correct |
| Delete removes the object *and* the row | correct |
| **Nothing outside `lib/storage` imports a provider** | correct |
| Blob store left empty afterwards | correct |

##### ✅ K-5b DONE — 11 Aug 2026 (Image Management)

`/admin/images` — grid, usage counts, unused filter, drag-drop upload, rename, replace, delete.
Plus `src/lib/table-image-usage.ts` and `PATCH|DELETE /api/admin/table-images/[id]`.

Filed under **System**, not Content: an image is a shared resource referenced by rows across
many tables, not content belonging to a page, and the screen's main job is maintenance.

###### 🔴 The usage lookup took 7.4 SECONDS, and my comment claimed "a few hundred milliseconds"

That figure was a guess written into a code comment. Measuring disproved it — and it mattered
more than a slow grid, because `getImageUsage()` shares the scan, so **every delete and every
rename paid it too**.

| Attempt | Approach | Steady state |
| --- | --- | --- |
| 1 | Fetch all 654 tables **including `data`**, filter in JS | **7,375 ms** |
| 2 | Fetch schemas only, filter in JS | **1,648 ms** |
| 3 | `jsonb_path_exists` — Postgres does the filtering | **271 ms** |

⚠️ **Step 2 looked like the fix and was not.** Dropping `data` removed ~2 MB, but **654 schemas
still crossed the wire so JavaScript could reject all of them**. Only pushing the predicate into
the database made it cheap — today it returns zero ids and the second query never runs at all.

**Generalisable: moving less data is not the same as asking a better question.**

###### Two ordering decisions, deliberately opposite

| | Order | Why |
| --- | --- | --- |
| **Replace** | new object → update row → *then* delete the old | A failure leaves an orphan (2 KB, visible in the unused filter) rather than a row pointing at nothing |
| **Delete** | object first → *then* the row | The row is going regardless, so a failed object delete must abort **before** the row is touched, leaving the operation retryable |

⚠️ **Rename is refused while in use.** Rows store the key as plain text in JSON with no foreign
key, so nothing cascades — renaming a key 40 rows point at would silently blank 40 thumbnails.
Delete is refused for the same reason, and both refusals name what is in the way.

###### ⚠️ `next/image` → a plain `<img>`, mid-build

Written first with `next/image` and `unoptimized` — which **disables the only thing the component
provides** while still requiring the blob host in `next.config.ts`. Configuration for a
deliberately-disabled feature is a trap for whoever reads it next.

These objects are finished 64px WebP; there is nothing to optimise. Matches `ItemIcon` from
Phase J for the same reason. Bundle **12.9 kB → 7.94 kB**.

**Verification — 15/15:** unauthenticated → 307, page renders, nav lists it, uploads land with
the key taken from the filename, list is newest-first, every card carries a usage count,
thumbnails fetch.

##### ✅ K-5c DONE — 12 Aug 2026 (images on the site, admin controls, CSV)

Three parts, each shippable alone.

###### (i) Rendering

`col.meta.imageColumn` names the row field holding the key; the service resolves the keys **that
table actually uses** into a `TableImageMap` and sends it with the payload.

⚠️ **Resolved server-side.** A 40-row table would otherwise make 40 requests to translate names
into URLs, and every cell would need a "not resolved yet" state.

⚠️ **Resolved AFTER the country filter.** A row hidden from this visitor must not contribute its
key, or the response discloses that content exists for other countries — the same reasoning that
keeps `filterRowsByCountry` outside the cache.

⚠️ **The image wraps the cell rather than being a cell type**, so any column can carry one.
`image` stays a declared `ColumnType` with no branch: nothing uses it (0 of 2,675) and a column
whose only content is a picture is exactly what §29.6(d) rejected.

**A dangling key renders nothing** — no placeholder, no broken-image box. The admin surfaces it
instead.

###### (ii) Admin controls

Schema editor: a per-column **"Show an image beside this column"** checkbox writing
`meta.imageColumn` (derived as `<columnId>__image`, so it cannot collide with a data column and
nobody types a field name) plus a shape select. Row editor: `RowImagePicker`, shaped like
`IconPicker`.

⚠️ **A native `<select>`, matching the file.** `TableSchemaEditor` has not had its shadcn pass —
G-5b converted `TableEditor`, not this. Two dropdown styles in one panel reads as a bug before it
reads as a migration.

###### 🔴 THE SIXTH OCCURRENCE OF THE FIELD-LIST BUG — found by the user

Setting a row image saved correctly, rendered on the public table, and showed **"No image"** when
the row was reopened.

```ts
columns.forEach((column) => {
  initial[column.id] = row?.[column.id] ?? …    // ← only DECLARED columns
});
```

The image lives in `col_1__image`, a **row field, not a column**, so rebuilding the form's state
from the column list dropped it.

⚠️ **Sixth time this shape has appeared**: `icon` through five explicit field lists in Phase J,
`status` through `buildPageHierarchy` in I-1, now this. **A rebuild-by-field-list cannot complain
about a field it was never told about**, and TypeScript cannot help because the field name is
dynamic.

**Not data loss** — `handleSubmit` already spread the existing row before `values`, which is the
same defence on the way *out*. This was the missing half on the way *in*.

Fixed by seeding from the whole row and filling only gaps, which makes the class **impossible
here** rather than patching one field. ⚠️ The test uses **the old seeding as a negative control**
and asserts on *what the form would show*, not what the database holds — every earlier occurrence
passed its database-level test.

###### 🔴 The picker cried wolf — also found by the user

Reopening a row with an image showed **"Missing: thefutur"** in red, about an image that was
perfectly fine, because the picker fetched only when its popover opened.

⚠️ **"Missing" must mean "this key does not exist", not "I have not checked."** J-2 built that
state so a dangling reference names itself; firing it routinely would have trained the reader to
ignore it, and then a genuinely deleted image would scroll past. **A warning that fires when
nothing is wrong stops being read.**

A row *with* a key now fetches immediately — the URL is the field's content, not an aid. A row
without one still defers.

###### (iii) CSV import — the SEVENTH occurrence, caught before it shipped

`transformCsvToTableData` looked every mapping up in `schema.columns` and skipped what it could
not find, so **a header mapped to an image field would have been discarded without a word**.

Fixed with **one shared `getImportTargets(schema)`** that the mapping UI and the transform both
read, so they cannot disagree about what exists. ⚠️ Auto-mapping matches image fields **only on
an explicit word** (`image`, `logo`, `icon`…) and tries them first: loose matching is right for
columns — "Course" finds "Course Name" — but would otherwise let a column's own name claim its
image field.

**Also added:** `TABLE-IMAGES-GUIDE.md` and `csv-examples/` (three worked files + README).
⚠️ The examples are **verified importable**, with every key checked against the image library —
an example that does not work teaches the wrong shape and the reader blames themselves.

###### Verification — 31/31 on the full chain, against real endpoints and a real store

Built from nothing: domain → page → table → CSV import → public page.

| Check | Result |
| --- | --- |
| Import screen offers the image field as its own entry | correct |
| CSV import writes keys; a blank cell means no image | correct |
| Public payload resolves only the keys used; **a dangling key is absent** | correct |
| Rows still carry keys, never URLs | correct |
| Usage counts name the rows | correct |
| Delete and rename **refused** while in use, saying how many | correct |
| **Replace ALLOWED while in use — and the public page serves the new picture with no row edited** | correct |
| Table and images restored; 7 public pages still 200 | correct |

⚠️ **The domain 404'd at first** — created as `DRAFT`, the Phase H default, so correctly invisible.
Not a bug; the script simply never published it. Publishing went **through the admin API** so
invalidation fired — the H-2 lesson, now four occurrences.

### K-6 — Admin table editor

Badge colour list under each `badge` column, pre-filled by `assignBadgeColors` and editable;
image shape dropdown; width defaults; density selector.

⚠️ **The image shape dropdown and the image checkbox already shipped in K-5c(ii)**, so what
remains here is the badge colour override and the column/table defaults.

### ⏸️ K-7 — Icons onto the upload path (deferred)

J-4 was deferred because building an upload service to save one `git push` was not worth it. Once
K-5a exists, that reasoning changes. **User's call: *"Let it be there as of now — we can see that
later."*** When taken, `ICON-GUIDE.md` §5 is rewritten.

### ⏸️ K-8 — Rows out of the JSON blob (deferred)

Per 29.4. **Trigger: a real table crossing ~1,000 rows.** Keeping the render path
source-agnostic through K-1…K-4 is what keeps this from becoming a rewrite.

---

## 🟢 #33 — The Roadmap page type

**Raised 14 Aug 2026.** Not a defect — the first genuinely new *feature* since Phase H. Recorded
here because the design decisions are worth more than the code, and because two of them
(role-as-page, colour-free HTML) are the difference between this being cheap and being expensive.

### 33.1 — What was asked for

A **roadmap**: a domain-scoped, ordered learning path made of **topics and sub-topics, nested to
any depth**. Every topic *may or may not* have content behind it; when it does, clicking it opens
a **shadcn `Sheet` on the right**. Topics carry **icons** (the same manifest as tables) and
**badges**. The visitor picks a **role** from a dropdown, and can **collapse or expand** the whole
tree.

One domain can have several roles, each with a **completely different set of steps**:

| Domain | Roles |
| --- | --- |
| Graphic Designing | Beginner · Intermediate · Advanced |
| Data Science | Data Analyst · Data Engineer · Business Analyst |
| Web Development | Frontend · Backend · Full-stack |
| *(some domains)* | **none — one plain roadmap** |

Source material: a Miro spine sketch (Step 1 → 1.1/1.2, down to a third level at
`Kubernetes → EKS`, with `Recommended` badges) and a Figma "Domain Page (Web)" mockup showing the
role dropdown, collapse/expand controls, the tree on the left and the Sheet on the right
containing Description, Free Resources, a three-column list, a tools table and sub-page chips.

---

## 33.2 — Decisions, with the reasoning that produced them

### (a) ⚠️ A role is a `Page`. There is no category model.

This is the decision the whole phase rests on, and it was nearly missed.

The obvious design is a `RoadmapCategory` table holding name, slug, order, icon and status. But
every one of those columns **already exists on `Page`** — and so does the routing that turns them
into a URL. Modelling roles as pages means:

```
Domain: Web Development  (webdev)
└── Page "Roadmap"          contentType: subcategory_list  →  /domain/webdev/roadmap
      ├── Page "Frontend"   contentType: roadmap           →  /domain/webdev/roadmap/frontend
      ├── Page "Backend"    contentType: roadmap           →  /domain/webdev/roadmap/backend
      └── Page "Full-stack" contentType: roadmap           →  /domain/webdev/roadmap/fullstack
```

…and the following arrive with **no code written for them at all**:

| Capability | Comes from |
| --- | --- |
| A distinct, shareable URL per role | the existing `domain/[...slug]` catch-all |
| Order in the dropdown | `Page.order` |
| An icon beside each role | `Page.icon` |
| DRAFT / PUBLISHED / UPCOMING per role | `Page.status` |
| Country targeting per role | `Page.targetCountries` |
| Sitemap entry, canonical, `<title>`, breadcrumb JSON-LD | `sitemap.ts`, `seo.ts`, `structured-data.ts` |
| Appearing in the public left sidebar | `PageSidebar.tsx` |
| Nesting under whatever parent suits the domain | `Page.parentId` |

⚠️ **The "Choose Your Role" dropdown is therefore derived, not configured.** It is the answer to
*"which of my sibling pages have `contentType = 'roadmap'`?"* — there is nothing to keep in sync,
and a role cannot exist in the dropdown but 404 on click, because it is the same row deciding both.

**A domain with no roles falls out for free:** a single page at `/domain/gdesign/roadmap` with
`contentType: roadmap` and no parent chooser. Fewer than two siblings ⇒ the dropdown does not
render.

### (b) Topics get real tables, not JSON

`Table.data` proves a JSON blob works, and a roadmap is only ~30–60 nodes — nowhere near the
~1,000-row ceiling described in 29.4. So JSON was a serious candidate.

⚠️ **What rules it out is `icon`.** K-5b had to answer *"which tables use this image?"* by scanning
JSON, which needed `jsonb_path_exists` and a hand-written raw query to get from **7,375ms to
271ms**. Icons inside a JSON tree would recreate that exact problem in a **second** place —
`/admin/images`, `scripts/find-icon-usage.mjs`, and any future orphan check. A real column answers
it with a plain `WHERE` and an index.

Secondary, but real: a roadmap is **edited node by node**, not as a whole document. A JSON blob
means every single-field save rewrites the entire tree, and two admins editing two topics
last-write-wins each other's work.

### (c) Sheet content is **HTML**, exactly like rich text — and blocks come later

**User's call, and the right one.** The Figma sheet contains a description, bullet lists, a
three-column layout, a small table and link chips. That is exactly the "structured page templates"
model recorded at #23.5 — but designing that block schema *first* would put a month between now
and the first live roadmap.

So: `htmlContent`, the same editor, the same live preview, the same sanitiser. Content blocks
become **L-11**, and when they arrive they replace this *and* the 415 rich-text pages together.

### (d) ⚠️ The theme WILL follow — and that is a data rule, not a styling one

The user asked that roadmap content follow the theme, unlike rich text. That is achievable, but
only for one reason, and it must be enforced in the right place.

`RichTextLayout` pins its card to `bg-neutral-100 text-neutral-900` because inline colour in the
stored HTML beats any stylesheet on specificity, so on a dark surface that text would disappear
entirely — and `!important` would flatten the deliberate white-on-colour text instead.

⚠️ **The figure that decision was based on is wrong — see #34 below.** Only **58 of 415 rows (14%)**
carry inline *text* colour. It does not change what roadmap content should do; it changes how
expensive fixing rich text is.

Roadmap content is new, so the data can be kept clean.

### ⚠️ AMENDED 15 Aug 2026 — there is no `sanitizeRoadmapHtml()`

This decision originally read: *"A UI convention will not hold this… the rule has to be enforced
server-side: `sanitizeRoadmapHtml()` strips the `style` attribute outright."*

**Sanitisation was removed entirely (#35), so that mechanism does not exist.** Two options were
put, and the user chose **(a) — discipline plus a guide**, over (b) a 30-line `style` stripper.

⚠️ **I argued for enforcement and was overruled on reasonable grounds.** The case for (a): one
author, a narrow memorable rule ("never set a colour"), and it is the same discipline already
accepted for rich text — adding a stripper here while rich text has none would be an inconsistency
needing its own explanation.

⚠️ **And (b) was never complete protection anyway.** `style` is not the only route to a colour —
`class="text-…"` and `bg-…` utilities do the same thing, and a `style`-attribute stripper would not
have caught them.

**What replaces it:** **L-12**, a roadmap content guide covering the whole authoring process. And
one advantage rich text did not have — roadmap content is **new**, so if the discipline holds there
is no cleanup later. The signal to revisit is the first topic that renders wrong in one theme.

### (e) Progress tracking, drag-and-drop and blocks are all **deferred**

**User's call on all three.** Each is a genuine improvement and none is needed for a first live
roadmap. Recorded as L-9, L-10 and L-11 so the reasoning is not lost.

⚠️ Reorder is therefore **buttons** (↑ ↓ → ←), not drag-and-drop. That is not only a scope
decision: drag-to-*nest* a tree is where most of the bugs live, it needs a second implementation
for touch, and it is the hardest part of the editor to make accessible. Buttons are exact,
keyboard-native, and can be replaced later **without touching the schema**.

---

## 33.3 — The schema

Two new models, one added relation, one new `contentType` string.

```prisma
/// One roadmap. Sits on a Page exactly the way `Table` and `RichTextContent` do — one row per
/// page, `pageId @unique`, cascade-deleted with the page.
///
/// ⚠️ THIS MODEL IS NOT A "CATEGORY" OR A "ROLE". Frontend / Backend / Full-stack are three
/// separate PAGES, each owning its own Roadmap row. That is what gives every role a URL, a
/// status, a sitemap entry and a sidebar entry without any of it being written. See 33.2(a).
model Roadmap {
  id     String @id @default(uuid())
  pageId String @unique
  page   Page   @relation(fields: [pageId], references: [id], onDelete: Cascade)

  /// Heading above the tree, e.g. "Frontend Developer". Separate from `page.title` for the
  /// same reason `Table.name` is: the page is "Frontend" in the sidebar and the breadcrumb,
  /// but the heading on the page itself often wants to be longer.
  title       String
  /// One-line intro under the title. Plain text — it also feeds the meta description, which
  /// is why it is not HTML.
  description String?

  /// { defaultExpanded: boolean, showProgress: boolean, ... }
  /// JSON for the same reason `Table.settings` is: display preferences that will grow, each
  /// of which would otherwise be a migration.
  /// ⚠️ Read through a resolver using `??` throughout, never `||` — see #28. `defaultExpanded:
  /// false` and `||` would silently become `true`.
  settings Json?

  nodes RoadmapNode[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

/// One topic. Self-referencing, so nesting is unlimited.
model RoadmapNode {
  id String @id @default(uuid())

  roadmapId String
  roadmap   Roadmap @relation(fields: [roadmapId], references: [id], onDelete: Cascade)

  /// Self-relation — the same shape as `Page.parentId` / `Page.subPages`, which is already
  /// proven in this codebase. NULL = a top-level step ("Step 1: Programming / Scripting").
  ///
  /// ⚠️ `onDelete: Cascade` on the SELF relation too, so deleting a step takes its sub-topics
  /// with it rather than orphaning rows that then belong to no visible parent.
  parentId String?
  parent   RoadmapNode?  @relation("NodeToChildren", fields: [parentId], references: [id], onDelete: Cascade)
  children RoadmapNode[] @relation("NodeToChildren")

  title String

  /// Deep-link fragment: /domain/webdev/roadmap/frontend?topic=kubernetes
  ///
  /// ⚠️ Unique WITHIN one roadmap, not globally — see @@unique below. "docker" exists as an
  /// independent row in both the Frontend and Backend roadmaps. That duplication is the agreed
  /// design (shared nodes make ordering, and later progress, ambiguous), and scoping the
  /// constraint is what permits it.
  slug String

  /// Icon id from `public/icons/` — the SAME field and manifest as `Page.icon` and
  /// `Domain.icon`. ⚠️ Validate with `isValidIconId()` before writing: the value reaches an
  /// `src` attribute, and an unknown id renders a broken image with no error anywhere.
  icon String?

  order Int @default(0)

  /// The "Recommended" flag — AWS, Docker, Kubernetes, EKS in the Miro sketch.
  ///
  /// ⚠️ A boolean rather than just another entry in `badges`, because it changes how the NODE
  /// is drawn (a filled marker on the spine), not merely what pill sits beside it. As a string
  /// it would have to be styled by matching the literal text "Recommended", which breaks the
  /// first time someone types "recommended" or "Recommended ⭐".
  recommended Boolean @default(false)

  /// Free-text labels: "Free", "Paid", "Beginner". Coloured by `assignBadgeColors` (K-1) over
  /// the distinct set within ONE roadmap, so a given word is the same colour down the page.
  /// Free text rather than a fixed list — user's call — so adding a label is never a code change.
  badges String[] @default([])

  /// The Sheet body. Sanitised HTML — see `sanitizeRoadmapHtml` in L-5.
  ///
  /// ⚠️ NULL or empty means the topic has NO sheet: it is a label on the spine, not a link.
  /// Several nodes in the source mockup are exactly that (OSI Model, GCP, AKS). The renderer
  /// must not make them look clickable.
  htmlContent String? @db.Text
  /// Stripped text, for search and the meta description. Written by the API alongside the HTML
  /// in the same handler, so the two cannot disagree — the same arrangement as
  /// `RichTextContent.plainText` / `.wordCount`.
  plainText   String? @db.Text

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  /// One "kubernetes" per roadmap, so `?topic=` is never ambiguous.
  @@unique([roadmapId, slug])
  /// The tree read: every node of one roadmap, in order.
  @@index([roadmapId, parentId, order])
}
```

**On `Page`,** one line beside the existing `table` and `richTextContent` relations:

```prisma
  roadmap Roadmap?
```

…and `'roadmap'` added to the `contentType` doc comment. ⚠️ `contentType` is a **plain `String`,
not an enum**, so this is a comment change only — no migration for that part, and nothing
validates the value at the database level. Validation lives in the API.

### ⚠️ Why `htmlContent` sits on the node instead of a fourth table

Splitting content into `RoadmapNodeContent` would keep the tree query small. It is deliberately
**not** done, for v1:

- 50 nodes × ~3KB ≈ **150KB** — one query loads the whole tree, **server-rendered**
- The Sheet opens with **zero latency and no second request**
- ⚠️ It is therefore **indexable**, which is exactly what table content is *not* today (**#30**).
  A roadmap ships doing correctly the thing 650 table pages get wrong.
- Postgres **TOASTs** large `@db.Text` values out of the main row automatically, so if it ever does
  get heavy, dropping `htmlContent` from the tree `select` fixes it **with no migration**

That escape hatch is what makes the simple choice the safe one.

---

## 33.4 — The whole flow, against the flow that already exists

| | **Section-based (today)** | **Roadmap (new)** |
| --- | --- | --- |
| 1 | Admin → **Domains** → create "Web Development" (`webdev`), set PUBLISHED | *identical* |
| 2 | Admin → **Pages** → pick domain → new page "Courses", type `section_based` | Admin → **Pages** → new page "Roadmap", type **`subcategory_list`** — the role chooser |
| 3 | — | Admin → **Pages** → new page "Frontend", **parent = Roadmap**, type **`roadmap`**. Repeat per role. |
| 4 | Admin → **Section Layout** → arrange child pages into 3 columns | Admin → **Roadmap Management** → domain → "Frontend" → build the tree |
| 5 | Live at `/domain/webdev/courses` | Live at `/domain/webdev/roadmap/frontend` |

⚠️ **Step 2 is skipped entirely when the domain has no roles.** One page, type `roadmap`, and
`/domain/gdesign/roadmap` is the roadmap itself.

**Why a chooser page rather than auto-opening the first role** *(user's call)*: it gives each role
somewhere to be described, and landing a visitor on an arbitrary default role is worse than asking
which one they are. `subcategory_list` already renders exactly this and needs no new code.

---

## 33.5 — The URLs, and why the router barely changes

`src/app/domain/[...slug]/page.tsx` is a catch-all that already resolves arbitrary depth — the
comment at its metadata branch names `/domain/webdev/withcode/ytube` as a live three-segment
example. `/domain/webdev/roadmap/frontend` is the identical shape, so **`PageService.getByPath` is
not touched.**

The entire routing change is one case in the existing `switch (page.contentType)`:

```ts
case 'roadmap':
  content = <RoadmapLayout page={page} domain={domain} roadmap={roadmap} />;
  break;
```

**Topic deep links ride on a query parameter:** `?topic=kubernetes`. The server reads
`searchParams`, finds that node, and renders the Sheet **already open with its content in the
HTML**. Closing it strips the parameter with `history.replaceState`, so the back button is not
filled with one entry per topic opened.

⚠️ `?topic=` must be **`noindex` when present but canonical to the bare URL** — otherwise 50 topics
become 50 near-duplicate URLs competing with the page they came from. One line in
`generateMetadata`.

---

## Phase L — The Roadmap page type (#33) — PLAN (agreed 14 Aug 2026, not started)

| Step | What | Ships on its own? |
| --- | --- | --- |
| ✅ **L-1** | Fix #23 — the sanitiser on Vercel | **DONE 14 Aug**, then removed entirely (#35) |
| ✅ **L-2** | Schema, migration, `contentType`, page form | **DONE 15 Aug** — invisible but complete |
| ✅ **L-3** | Admin — Roadmap Management list screen | **DONE 15 Aug** |
| ✅ **L-4** | Admin — the tree editor (nodes, reorder, icons, badges) | **DONE 15 Aug** |
| **L-5** | Admin — the content editor + `sanitizeRoadmapHtml` | ✅ |
| **L-6** | Public — the roadmap page (spine, tree, role dropdown, collapse) | ✅ first visible result |
| **L-7** | Public — the Sheet, deep links, sub-topic chips | ✅ |
| **L-8** | SEO — metadata, sitemap, JSON-LD, canonical | ✅ |
| **L-12** | `ROADMAP-CONTENT-GUIDE.md` — ⚠️ **not optional**, see below | ships with L-5 |
| ⏸️ **L-9** | Progress tracking (localStorage) | deferred — user's call |
| ⏸️ **L-10** | Drag-and-drop reordering | deferred |
| ⏸️ **L-11** | Content blocks, replacing HTML here *and* in rich text | deferred — #23.5 |

---

### L-1 — Fix #23 first. It is a blocker now, not a backlog item.

Roadmap content goes through **the same sanitiser that is currently broken on production**.
`src/lib/sanitize-html.ts` imports `isomorphic-dompurify`, which pulls **jsdom**, which fails to
load on Vercel under Turbopack — the `Failed to load external module` error from
`[turbopack]_runtime.js`.

⚠️ Building L-5 on top of a broken sanitiser means the roadmap editor **fails on production and
works locally**, exactly as #31 and #23 both did. Fix it before there is any content to lose.

**The fix shape is proven** — it is what resolved #31 two days ago, with `sharp` in place of jsdom:

```ts
// next.config.ts
serverExternalPackages: ['sharp', 'isomorphic-dompurify', 'jsdom'],
outputFileTracingIncludes: {
  '/api/admin/rich-text':      ['./node_modules/jsdom/**/*'],
  '/api/admin/rich-text/[pageId]': ['./node_modules/jsdom/**/*'],
},
```

⚠️ **Do NOT reach for a webpack config.** Adding one silently opts the whole build out of
Turbopack; see the note under #31.

⚠️ `src/app/api/admin/rich-text/route.ts` currently imports the sanitiser **lazily, inside the
POST handler**, as a workaround. Once `serverExternalPackages` is correct, check whether that is
still needed — but **change one thing at a time**, and not in this step.

**Test before pushing:**

| Test | Expect |
| --- | --- |
| Save rich text locally | works (it already does — this is the negative control) |
| Save rich text on the **dev branch Vercel preview** | works — ⚠️ open the *new* deployment URL, not a refresh of the old one; preview URLs are pinned to one build |
| Same on production after merge | works |
| `<script>` in the input | stripped, on both environments |
| A page that renders existing rich text | byte-identical output to before |

---

### L-2 — Schema, migration, and making `roadmap` selectable

**Migration:** two new tables, one nullable relation. **Purely additive** — nothing existing is
altered, no backfill is possible or needed.

⚠️ **Applied to BOTH Neon branches before the code merges**, per the standing rule at the top of
this document. This is the fifth time; the rule exists because migrating dev only and shipping
code that depends on it produced a live production defect in K-2.

### ⚠️ The plan said four files. There are NINE.

The grep the plan called for was run before touching anything, and it more than doubled the list.
**This is the eighth occurrence of the rebuild-by-explicit-field-list bug** — except caught before
it shipped rather than after.

| # | Site | In the plan? | Silent failure if missed |
| --- | --- | --- | --- |
| 1 | `prisma/schema.prisma` — models + `Page.roadmap` | ✅ | — |
| 2 | `PageForm.tsx` `CONTENT_TYPE_OPTIONS` | ✅ | type cannot be chosen |
| 3 | `PageTree.tsx` `CONTENT_TYPE_ICONS` | ❌ | falls back to a generic icon |
| 4 | `PageTree.tsx` `formatContentType` | ❌ | shows the raw string `roadmap` |
| 5 | `SectionEditor.tsx` `PageTypeIcon` | ❌ | different icon from the tree, same page |
| 6 | `api/admin/pages/route.ts` `validContentTypes` | ✅ | **create rejected at runtime** |
| 7 | `api/admin/pages/[id]/route.ts` `validContentTypes` | ✅ | **edit rejected at runtime** |
| 8 | `domain/[...slug]` `buildPageDescription` | ⚠️ plan named the wrong file (`seo.ts`) | generic meta description |
| 9 | `sitemap.ts` `select` + `pageLastModified()` | ❌ | ⚠️ **stale `lastmod` on every roadmap URL** |

⚠️ **Not one of the five misses would have failed the build**, and each fails differently — a
missing icon degrades, a missing validator rejects at runtime, a missing sitemap relation is
invisible until Google stops trusting the whole file. The full inventory now lives as a comment on
`Page.contentType` in `schema.prisma`, so the next content type starts from a list rather than a
grep.

⚠️ The render `switch` in `domain/[...slug]` is deliberately **not** touched here — that is L-6.
Until then a roadmap page renders the narrative layout, which is the correct "complete but
invisible" state for this step.

### ⚠️ Site 9 had a warning addressed to exactly this moment

`sitemap.ts` carries: *"If a future `contentType` stores its content in a NEW table (the way
`table` and `rich_text` do), you must add that relation to the `select` and to
`pageLastModified()`. Otherwise pages of that type silently report a stale `lastmod` — which is how
this file was wrong the first time."*

**And roadmap is worse than the two before it.** `Table` and `RichTextContent` hold their content
*in* the row the sitemap reads, so their `updatedAt` moves when the content changes. A roadmap does
not — the visible content is in `RoadmapNode` rows, and editing a topic leaves `Roadmap.updatedAt`
untouched.

⚠️ **So L-4's node endpoints MUST touch the parent `Roadmap` row:**

```ts
await tx.roadmap.update({ where: { id: roadmapId }, data: {} })   // bumps @updatedAt
```

That is the "more durable alternative" the same file recommends, applied one level down. The
alternative — `MAX(RoadmapNode.updatedAt)` in the sitemap query — costs a second query per domain
**and still misses deletions**, since a deleted node leaves no timestamp behind.

### The migration

`20260815065626_add_roadmap` — created with `--create-only`, so it was **written but not applied**,
then run by hand on **both branches** per the standing rule. Purely additive: two `CREATE TABLE`,
three indexes, three foreign keys, and **no `ALTER` on anything that already exists**. Nothing to
backfill, nothing that can fail on existing data.

### ✅ VERIFIED 15 Aug 2026

| Check | Result |
| --- | --- |
| Migration applied to development **and** production | ✅ both, before the code shipped |
| Create a page with type **Roadmap** | ✅ saves, `contentType = 'roadmap'` |
| Visit it publicly | ✅ renders the narrative layout — not a 500, not a 404 |
| `/admin/pages` tree | ✅ Route icon, label "Roadmap" |
| Added to a section via `/admin/sections` | ✅ works, same icon as the tree |
| `sitemap.xml` | ✅ `/domain/gdesign/roadmap11` present with a `lastmod` |

⚠️ **The sitemap check is the one that proves site 9 mattered.** Had that relation been missed, the
URL would still have appeared — with a silently wrong date. Nothing about the page would have
looked broken.

⚠️ **Noted and dismissed:** roadmap pages currently render through `NarrativeLayout`, which is
pinned light throughout (`bg-white`, `text-slate-*`, `border-slate-*`) and ignores the theme — the
same island `RichTextLayout` was until #34. **User's call: ignore it, no real pages use that
layout.** It stops mattering for roadmaps at L-6, which gives them their own renderer.

**Test before pushing:**

| Test | Expect |
| --- | --- |
| `npx prisma migrate status` on **both** branches | up to date, before the merge |
| Create a page with type Roadmap | saves; `contentType` is `'roadmap'` in the DB |
| Visit that page | renders the `default:` narrative layout — **not a 500, not a 404** |
| Edit an existing `table` / `rich_text` page and save | unchanged; the dropdown still shows the right value |
| `/admin/pages` tree | the new page appears with the others |
| Sitemap | contains the new URL once published |

---

### L-3 — Roadmap Management

New nav item under **Content**, beside Tables and Rich Text — `/admin/roadmaps`, lucide icon
`Route` (or `Milestone`).

⚠️ **Content, not System.** The opposite call to Images (K-5b): an image is a shared resource
referenced from many places, whereas a roadmap belongs to exactly one page. See the note in
`admin-nav.ts`.

The screen mirrors `/admin/tables` and `/admin/rich-text` exactly — a domain dropdown, then the
pages in that domain whose `contentType` is `'roadmap'`, each row showing whether a `Roadmap` row
exists yet, its node count, and **Create** or **Edit**.

⚠️ It must also list roadmap-type pages that have **no `Roadmap` row at all** — that is the normal
state right after L-2, and a screen that filters them out gives no way to create the first one.

**Test:** a domain with three roles lists three; a domain with none shows an empty state that says
how to make one; a role page with no `Roadmap` row offers Create; creating one lands on L-4's
editor; the sidebar highlights **Roadmaps** on `/admin/roadmaps/<id>` (prefix matching in
`isAdminNavItemActive`); the breadcrumb reads `Admin › Roadmaps › Frontend`, not a raw uuid.

##### ✅ L-3 DONE — 15 Aug 2026

**New:** `src/app/admin/roadmaps/page.tsx`, `src/components/admin/roadmaps/RoadmapsManager.tsx`,
`GET|POST /api/admin/roadmaps`, one entry in `admin-nav.ts`.

**Three decisions worth keeping:**

**1. ⚠️ Pages with no `Roadmap` row are listed, not filtered out.** That is the normal state
straight after L-2 — nothing creates the row automatically. A screen showing only pages that
already have one would be empty *and* offer no way to make the first, the same dead end as
`/admin/images` hiding unused images. The `Create` / `Edit` split is driven entirely by whether
`roadmap` is null.

**2. ⚠️ `previewUrl` is resolved server-side, and roadmaps make this worse than rich text did.**
The naive `/domain/${domainSlug}/${page.slug}` was wrong for **323 of 418 rich-text pages (77.3%)**
under #22.4. Roadmap roles sit UNDER a `subcategory_list` chooser by design (33.4), so they are
*always* two levels down — the naive form would be wrong for **every role page in a multi-role
domain**. The client cannot compute it either: the response holds only roadmap pages, and the
ancestors are the chooser parents, which are not in the payload.

**3. ⚠️ Built theme-aware from the start.** `RichTextManager` and `TablesManager` both hardcode
`text-gray-*` / `bg-gray-50` / `bg-red-50`, so they are light islands inside a themed admin — cheap
to write, and #34 is the record of what a pinned surface costs once content depends on it. This
screen uses tokens throughout and needs no second pass.

**Also:** the node count comes from Prisma's `_count`, not by loading nodes — otherwise rendering
one number would pull every `htmlContent` blob in the domain. And `POST` refuses a page whose
`contentType` is not `roadmap`, because the render switch dispatches on `contentType` rather than
on which relations exist, so such a row would be editable in the admin and invisible on the site.

⚠️ **`Edit roadmap` links to `/admin/roadmaps/<pageId>`, which does not exist until L-4.** Expected.

---

### L-4 — The tree editor

`/admin/roadmaps/[pageId]` — two panes.

```
┌─ Topics ───────────────────┐  ┌─ Editing: Kubernetes ─────────────┐
│ ▸ Step 1: Programming   ⋮  │  │ Title    [Kubernetes            ] │
│ ▾ Step 2: Networking    ⋮  │  │ Slug     [kubernetes            ] │
│     OSI Model           ⋮  │  │ Icon     [ pick from manifest   ] │
│     Network Protocol    ⋮  │  │ Badges   [Free ×] [+ add        ] │
│ ▾ Step 3: Cloud         ⋮  │  │ ☑ Recommended                     │
│     AWS  ★              ⋮  │  ├───────────────────────────────────┤
│     Azure               ⋮  │  │ Content        [Edit] [Preview]   │
│ ▾ Step 4: Orchestration ⋮  │  │ ┌───────────────────────────────┐ │
│   ▾ Kubernetes ★        ⋮  │  │ │ <h3>Description</h3>          │ │
│       EKS ★             ⋮  │  │ └───────────────────────────────┘ │
│ [+ Add step]               │  │              [ Save ]             │
└────────────────────────────┘  └───────────────────────────────────┘
```

`⋮` → Add child · Move up · Move down · Indent · Outdent · Delete.

**API:**

| Route | Does |
| --- | --- |
| `POST /api/admin/roadmaps` | create the `Roadmap` row for a page |
| `PATCH /api/admin/roadmaps/[id]` | title, description, settings |
| `POST /api/admin/roadmaps/[id]/nodes` | add a node |
| `PATCH /api/admin/roadmap-nodes/[id]` | any field, including content |
| `DELETE /api/admin/roadmap-nodes/[id]` | cascades to children |
| `POST /api/admin/roadmap-nodes/[id]/move` | `{ direction: 'up'\|'down'\|'in'\|'out' }` |

⚠️ **Reordering must be one transaction.** Moving a node up rewrites `order` on at least two rows;
a partial write leaves two nodes claiming the same position, and the tree renders in an arbitrary
order with no error anywhere. Wrap it in `prisma.$transaction`.

⚠️ **Indent has one legal target: the sibling immediately above.** Anything else is ambiguous. If
there is no sibling above, the button is disabled — not silently ignored.

⚠️ **Outdent at the top level is a no-op**, and the button must be disabled rather than throwing.

⚠️ **`revalidateTag` on every write.** This is the fifth `unstable_cache` trap in this project
(H-2, J-3, K-2, K-4b). Mutating through Prisma without invalidating means the public page serves
the old tree for up to `CACHE_DURATIONS.MEDIUM` = 60s — and the Data Cache **survives
deployments**, so "it will fix itself on the next deploy" is false.

⚠️ **Seed the edit form from the whole node object, then fill gaps** — never rebuild it from an
explicit field list. That is the bug that has now landed **seven times**, most recently in K-5c's
`RowDialog`:

```ts
const [values, setValues] = useState(() => ({ ...node, ...defaultsForMissingKeys(node) }));
```

**Test:** add a root node, a child, a grandchild — all three persist and re-open correctly; move a
middle node up and down, and reload — the order holds; indent under the node above; outdent back
out; delete a parent and confirm its children go too and no orphan rows remain; **set an icon and
reopen the editor — the icon is still selected** (this is the exact K-5c picker defect); add two
badges, remove one; a duplicate slug within one roadmap is rejected with a readable message, and
the same slug in a *different* roadmap is accepted; edit a node, save, then load the public page
within 5 seconds and see the change (proves invalidation).

##### ✅ L-4 DONE — 15 Aug 2026

**New:** `src/lib/roadmap-tree.ts`, five API routes, `src/app/admin/roadmaps/[pageId]/page.tsx`,
and `RoadmapEditor` / `RoadmapTree` / `RoadmapNodeForm` / `types.ts`.

**1. ⚠️ L-2's sitemap obligation was made structural, not a comment.** `touchRoadmap(tx, id)` in
`roadmap-tree.ts` carries the whole explanation, and every one of the four node-writing
transactions calls it. A note saying "remember to bump the parent" in five handlers is a note
that gets missed in one of them — and the symptom would be an invisible, systematically wrong
`<lastmod>`, which is precisely what makes Google discard the field for an entire sitemap.

**2. ⚠️ Reordering renumbers whole sibling lists; it does not swap two rows.** The obvious
implementation — swap the two affected `order` values — works until the sequence has a gap or a
duplicate, and **gaps appear the first time a node is deleted**. From then on moves look
arbitrary with no error to follow. `renumber()` writes 0..n-1 and returns only rows that actually
change, so it is self-healing whatever state the data was in. The DELETE handler renumbers too,
which is what keeps the invariant true.

**3. ⚠️ Indent has exactly one legal target: the sibling immediately above.** Anything else is
ambiguous — "a child of what?" — so position 0 cannot be indented and a top-level node cannot be
outdented. Both are **disabled in the menu and refused with a 409 by the API**; the disabled state
is the point, because an enabled button that does nothing reads as broken. Outdent places the node
immediately *after* its former parent rather than at the end of the list, so it does not vanish
off screen.

**4. ⚠️ Every mutation re-fetches the tree instead of patching state.** A move rewrites several
rows' `order` and may change `parentId`; a delete cascades to an unknown number of descendants and
renumbers what is left. Reproducing that client-side means writing the reorder logic twice, in two
languages, and having the copies disagree the first time one is fixed.

**5. ⚠️ The field-list bug was headed off in TWO places** — the eighth and ninth times it would
have landed:

- The PATCH handler builds its update by testing `'key' in body`, so a caller omitting a field
  leaves it alone. Always writing every field would **blank an author's content**, which is the
  bug in its most destructive form.
- `RoadmapNodeForm` seeds from `{ ...node }` and never from a field list — the exact defect that
  made row images vanish on every edit in K-5c.

⚠️ And the form **re-seeds on `node.id` change**. Without that, `useState`'s initialiser runs once,
the pane keeps showing the first topic while the tree highlights another, and the next save writes
those values onto the wrong node.

**6.** Node creation is deliberately minimal — a title, then fill in the detail pane. A dialog
collecting title, slug, icon, badges and content before the node exists puts a form between the
author and the tree they are trying to think about.

⚠️ **Known gap, by design:** the content preview renders through `.roadmap-sheet`, which has no CSS
until **L-7**. HTML previews unstyled for now — structure is visible, spacing is not.

---

### L-5 — The content editor, and the rule that keeps the theme working

Reuses the rich-text editor's shape — a textarea of HTML with a live preview beside it — with
**one difference that matters more than the rest of the step**:

```ts
/**
 * ⚠️ STRIPS `style` ENTIRELY. This is not tidiness; it is what makes roadmap content
 * themeable at all.
 *
 * `sanitizeRichTextHtml` permits inline `style` because 415 existing rows depend on it, and
 * that is precisely why `RichTextLayout` is pinned to a light card: 395 of those rows carry
 * inline colours (2,519 declarations, 574 dark, 384 pure black). An inline style beats any
 * stylesheet, so on a dark surface that text vanishes.
 *
 * Roadmap content is new, so the data can be kept clean — but only if it is enforced HERE.
 * A convention in the editor UI will not survive the first paste out of Google Docs.
 */
export function sanitizeRoadmapHtml(html: string): string
```

The editor offers structure — headings, lists, links, tables, columns — and **no colour control**.

⚠️ The preview pane must render inside the **same** container classes the public Sheet uses, and
must follow the theme. A preview on a fixed white background would look right in the admin and
wrong on the site, which is worse than no preview.

**Test:** paste HTML containing `style="color:#000"` → saved without the attribute; paste
`<script>` → stripped; paste a Google Docs fragment → readable, unstyled, structure intact; a link
gets `rel="noopener noreferrer"`; a table renders; **toggle dark mode in the preview and again on
the public page — both readable**; `plainText` is populated and matches the HTML.

---

### L-6 — The public roadmap page

`RoadmapLayout` — server component, so the tree is in the HTML.

```
Frontend Developer                       Choose your role  [ Frontend ▾ ]
Everything you need, in order.           [ ⊟ Collapse all ]

  ●━━ Step 1: Programming / Scripting
  ┃    ├─ 1.1  Shell Scripting
  ┃    └─ 1.2  Python Scripting        [Free]
  ●━━ Step 2: Networking Concepts
  ┃    ├─ 2.1  OSI Model
  ●━━ Step 3: Cloud Services
  ┃    ├─ AWS               ★ Recommended        ← clickable: it has content
  ┃    ├─ Azure                                  ← not clickable: it has none
```

- **A vertical spine, topics branching right.** Chosen over roadmap.sh's 2D flowchart for one
  concrete reason: **a vertical trunk survives a phone**, and a wide diagram does not.
- **Role dropdown** = sibling pages with `contentType='roadmap'`, PUBLISHED, geo-visible, by
  `order`. Fewer than two ⇒ not rendered. Selecting one **navigates**, so the URL changes.
- **One collapse/expand toggle, not two checkboxes.** Two checkboxes are a single state with two
  values, and can display a combination ("both ticked") that means nothing.
- Expand state persists per visitor in `localStorage`, keyed by roadmap slug — the same treatment
  K-3 gives column widths.
- `recommended` draws a filled marker on the spine, so the happy path is findable in one pass.
- Badges use `assignBadgeColors` over the roadmap's distinct labels — ⚠️ compared with plain `<`,
  **not `localeCompare`**, or the server and client sort differently and React reports a hydration
  mismatch (K-1).
- ⚠️ **A node with no content must not look clickable** — no pointer cursor, no hover state.

**Test:** a 3-level roadmap renders all levels; **`curl` the page and grep for a topic title — it
is in the HTML** (this is the #30 failure, and roadmaps must not repeat it); the dropdown lists
exactly the published sibling roles; a DRAFT role is absent from the dropdown *and* 404s directly;
collapse all, reload, still collapsed; a one-role domain shows no dropdown; a domain with no
`Roadmap` row shows an empty state, not a crash; dark mode; 375px wide.

---

### L-7 — The Sheet

`side="right"`, `w-full sm:max-w-2xl` on desktop; `side="bottom"`, `h-[85vh]` on mobile.

- Opening pushes `?topic=<slug>`; closing removes it via `history.replaceState` so the back button
  is not filled with one entry per topic.
- Arriving at a `?topic=` URL renders the Sheet **already open, with content in the HTML**.
- **Sub-topic chips at the foot swap the content in place** — push the new `?topic=`, keep the
  Sheet open. It reads as moving *through* a topic rather than bouncing in and out.
- Content renders through the theme, per L-5.

**Test:** open a topic, copy the URL, open it in a fresh tab → the Sheet is open on the right
topic; `curl` that URL → the topic's text is in the HTML; close → the parameter is gone and one
back press leaves the page (not fifteen); an unknown `?topic=` value → the page renders normally
with the Sheet shut, **not a 404**; a chip swaps content without closing; Escape closes; mobile.

---

### L-8 — SEO

| Concern | Handling |
| --- | --- |
| `<title>` | `Frontend Developer · Web Development · ATNO` — via the existing template |
| Description | `Roadmap.description`, else a `case 'roadmap'` template in `buildPageDescription` |
| Canonical | the bare page URL — ⚠️ **even when `?topic=` is present** |
| `?topic=` | `robots: { index: false, follow: true }` — otherwise 50 topics become 50 near-duplicates competing with their own parent |
| Sitemap | free; role pages are `Page` rows and `sitemap.ts` already emits them |
| Breadcrumb JSON-LD | free, for the same reason |

⚠️ **Do not add `?topic=` URLs to the sitemap.** They are the same document.

**Test:** `curl -s <url> | grep -i '<title>'`; the canonical on a `?topic=` URL points at the bare
URL; the sitemap contains the role pages and no `?topic=`; a DRAFT role is in neither.

---

### L-12 — `ROADMAP-CONTENT-GUIDE.md`

⚠️ **This is not documentation-after-the-fact. It is the control that replaces server-side
enforcement**, per the amendment to 33.2(d) above, so it ships **with L-5**, not after Phase L.

Same shape as `ICON-GUIDE.md`, `TABLE-IMAGES-GUIDE.md` and `RICH-TEXT-GUIDE.md`, covering the whole
authoring process:

- ⚠️ **The one rule: never set a colour.** Not via `style`, and **not via `class` either** —
  `text-…` and `bg-…` utilities are the route a `style`-stripper would have missed. The worked
  example is #34: 26 rich-text pages that went unreadable the moment their card followed the theme.
- What `style` *is* for here — spacing, sizing, alignment — and mid-grey rules (`#9ca3af` reads on
  both grounds; `#dcdada` is too pale on dark).
- ⚠️ Nothing is stripped on save (#35): no `<script>`, no `on*`, no `javascript:` hrefs, no
  `<iframe>`. What to check before pasting from ChatGPT, Google Docs or a website.
- Add `rel="noopener noreferrer"` by hand to every `target="_blank"` link.
- Writing a topic: what belongs in the Sheet vs. what belongs as a sub-topic, when to use a badge,
  when `recommended` is warranted, and picking an icon from the manifest.
- Slugs — stable, lowercase, and ⚠️ **unique within one roadmap**, because they are the `?topic=`
  deep link.
- Structure patterns that work in the Sheet: description → resources → multi-column list → tools
  table → next-topic chips, matching the Figma.
- ⚠️ **Check every new topic in both themes before publishing.** This is the entire safety net.

### ⏸️ L-9 — Progress tracking (deferred)

A checkbox per topic in `localStorage`, keyed by roadmap slug; the spine fills in behind you and
the header reads "12 / 48". **User's call to defer.**

Recorded because the argument for it is strong: it is the single strongest reason a visitor
*returns* to a learning site, and it costs **no schema, no API and no accounts**. Worth revisiting
once real roadmaps exist and the shape has settled.

### ⏸️ L-10 — Drag-and-drop reordering (deferred)

Replaces L-4's buttons. **No schema change** — that is the point of choosing buttons first.
⚠️ Needs a separate touch implementation and a keyboard fallback, which is most of the cost.

### ⏸️ L-11 — Content blocks (deferred — this is #23.5)

The Sheet's content — description, resource lists, multi-column layout, a small table, link chips
— is exactly the structured-template model recorded at **#23.5** as the intended replacement for
the 415 rich-text pages.

⚠️ **Building it here first is materially safer than migrating rich text first**: new content, no
migration, small blast radius. When it lands it retires the HTML path in *both* places, and with it
`dangerouslySetInnerHTML`, the sanitiser's `style` allowance, and #21.4's permanently-light card.

---

### What Phase L touches that already exists

| Existing thing | Effect |
| --- | --- |
| `domain/[...slug]/page.tsx` | **one `case`** in the switch |
| `PageService.getByPath` | **untouched** |
| `PageForm.tsx` | one entry in `CONTENT_TYPE_OPTIONS` |
| `admin-nav.ts` | one item; sidebar + breadcrumb both follow |
| `seo.ts` | one `case` in `buildPageDescription` |
| `sanitize-html.ts` | one **new** export; ⚠️ `sanitizeRichTextHtml` unchanged — 415 rows depend on it |
| `next.config.ts` | L-1's jsdom entries |
| `sitemap.ts`, `PageSidebar.tsx`, `structured-data.ts` | **no change** — they work on `Page` |
| `assignBadgeColors`, `IconPicker`, `isValidIconId` | reused as-is |

⚠️ **The one real regression risk is L-1**, because it edits `next.config.ts`, which every route
depends on. Everything after L-1 is additive: new tables, new routes, new components, one switch
case. Nothing existing changes shape.

---

## 🔴 #30 — Table content is not server-rendered

**Found 11 Aug 2026 while trying to verify K-1 by fetching a page.** Unscheduled — this is a
rendering-architecture change, not part of Phase K.

`GET /domain/gdesign/courses` returns **200 with no table in the HTML**: no column headers, no row
values, no badges. `TableLayout` is `'use client'` and fetches its data in a `useEffect` from
`/api/domain/tables/by-page/{id}`, so the table exists only after the browser runs JavaScript and
completes a second round trip.

Across roughly **650 pages whose primary content is a table**:

- The content is **absent from the initial HTML** — a crawler must execute JS to see any of it
- Every table page pays an extra round trip after first paint
- ⚠️ It cuts directly against **#8**, which is about getting content indexed

⚠️ **It also blocked K-1's end-to-end verification**, and no headless browser is installed —
`playwright`/`puppeteer` are not dependencies. Any future work needing to assert on rendered table
markup hits the same wall.

**Not fixed yet, and not trivially fixable:** `TableLayout` fetches per-country
(`?country=…`) so the response is CDN-cacheable, which is a deliberate design from an earlier
phase. Server-rendering the table means resolving the country server-side, which is entangled with
the **#8 / #8-DR** geo decision. **Sequence #8 first.**

Interacts with **K-8** — if rows move out of the JSON blob, this is the moment to reconsider how
they reach the page.

---

## 🟡 #34 — The measurement behind the permanently-light rich-text card was wrong

**Found 14 Aug 2026,** because the user opened a rich-text page, looked at its HTML and said
*"I don't think any colour is applied here."* They were right, and checking it properly overturned
the number that `RichTextLayout.tsx` and #21.4 both rest on.

### What was claimed, and what is actually there

The comment in `RichTextLayout.tsx` says **"395 of 415 rows carry inline text colours — 2,519
declarations, 574 of them dark"**. Measured directly against the development branch, counting only
declarations *inside* `style="…"` attributes and anchoring each pattern so the three families
cannot be confused with one another:

| | rows | declarations |
| --- | --- | --- |
| any inline `style` at all | 405 / 415 (98%) | — |
| **`color:` — actual text colour** | **58 / 415 (14%)** | 568 (396 dark, 168 light) |
| `background` / `background-color:` | 37 / 415 (9%) | 532 |
| `border-color:` | **393 / 415 (95%)** | 1,411 |
| **no text colour whatsoever** | **357 / 415 (86%)** | — |

⚠️ **The original number counted all three families as one.** 393 border-colour rows became "395
rows"; 568 + 532 + 1,411 = **2,511 ≈ the "2,519 declarations"** that was quoted. The three were
summed and then described as text colour.

They are not interchangeable, and only one of them can make content unreadable:

- **`color:`** — a dark value on a dark ground **disappears**. This is the only real problem.
- **`background-color:`** — paints its own ground, so it stays self-consistent in either theme.
- **`border-color:`** — a rule or divider. On 393 of those rows it is one literal declaration,
  `border-color: #dcdada` on an `<hr>`, which on a dark surface is merely *pale*, never invisible.

The whole 393 comes from one template that every rich-text page was built from — which is why it
is near-universal and why it dominated the count.

### Why it matters

The conclusion in #21.4 — *"migrating rich text to be themeable is irreversible product work"* —
was reasonable against 395 rows. Against **58** it is a different size of job entirely, and the
two halves are independent:

1. **58 rows** need `color:` removed. Small enough to review by hand, and `#767c7c` ×180,
   `rgb(0,0,0)` ×168, `#000000` ×48 and `rgb(255,255,255)` ×168 account for **all but four** of
   the 568 declarations — so it is four find-and-replaces, not 568 judgement calls.
2. **393 rows** carry `border-color: #dcdada` on `<hr>`. Deleting that one declaration and letting
   `globals.css` style `<hr>` from a token is mechanical, and is worth doing on its own regardless
   of the theme question.

⚠️ **Not scheduled, and deliberately not part of Phase L.** It changes no roadmap decision — new
content must still be colour-free, enforced by `sanitizeRoadmapHtml` (33.2d) — and Phase L should
not grow a rich-text migration inside it. Recorded so the next person to weigh #21.4 weighs it
against the right number.

⚠️ **Measured on the development branch.** Production is a separate database (#32) and may differ
slightly; re-measure before acting. The measuring script is throwaway and was not kept — its logic
is described above precisely enough to rebuild.

### The lesson, which is the same one as `export-table.ts`

A measurement is only as good as the pattern that produced it. Searching for the string `color`
matches `background-color` and `border-color`; the fix is anchoring — `(^|;)\s*color\s*:` — and it
is the identical mistake as the grep whose exclusion pattern matched the very import lines it was
looking for. ⚠️ **A number in a code comment is an assertion, and assertions rot.** This one drove
a permanent styling decision for two months.

---

## ⏸️ #35 — Re-add rich text sanitisation (removed by choice 15 Aug 2026)

**Removed, not lost.** Full reasoning in `SANITISER-REMOVAL.md`; the short version is that #2's own
text rated this **Medium once #1 was fixed** and called it *"recommended… costs almost nothing"* —
and the cost turned out to be #23, four deploy cycles and a feature 500ing on production.

⚠️ **It was working when it was removed.** The fix was verified on Vercel (a pasted
`<script></script>` was stripped on save). This is a deliberate trade, not a retreat, so re-adding
it is a decision about appetite — not a bug to fix.

### When to reopen this

- ⚠️ **A second admin account exists.** This is the strong trigger. "I trust myself" does not
  generalise, and the create-user flow already exists.
- Content starts being pasted from sources that are not read line by line.
- Any public write path to HTML appears — comments, submissions, an import.
- Phase L's roadmap sheets grow beyond hand-authored content.

### The whole file is one command away

```bash
git show 872c341:src/lib/sanitize-html.ts > src/lib/sanitize-html.ts
```

`872c341` is the last commit that touched it, and it was unchanged from then until deletion.
⚠️ **`htmlToPlainText` moved out to `src/lib/html-text.ts`** — restoring the file wholesale would
duplicate that export. Delete it from the restored copy and keep the import pointing at
`html-text.ts`.

### ⚠️ The allow-list was DERIVED from the content, not guessed

All 415 rows (3.4 MB of HTML) were scanned first. A generic allow-list would have destroyed real
formatting the moment a page was re-saved.

```
tags (21):  li 17595  ul 4603  strong 1993  h5 1838  p 1617  div 1500  hr 1418
            h4 1366   a 590    ol 183       span 168  details 52  summary 52
            h3 37     h6 20    td 18        tr 9      th 9     table 3
            thead 3   tbody 3

attributes: style 28608   href 589   target 541   class 44
            onmouseover 199   onmouseout 199     <- stripped, deliberately
```

Two facts from that scan changed the design:

1. ⚠️ **`details` / `summary` are used 52 times each** — collapsible sections. A standard allow-list
   omits them, silently collapsing 52 working disclosure widgets into loose text.
2. ⚠️ **`style` appears 28,608 times across 407 of 415 rows (98%).** Inline styles are the *primary*
   formatting mechanism here, not classes. Dropping `style` would flatten essentially every
   rich-text page on the site.

### ⚠️ Six traps, each found by breaking something

**1. `#text` is load-bearing.** DOMPurify treats text nodes as a pseudo-tag `#text`. Omit it from a
custom `ALLOWED_TAGS` while `KEEP_CONTENT: false` and **every piece of visible text is destroyed**:

```
no #text, KEEP_CONTENT default   ->  <p>Hello</p>   fine
no #text, KEEP_CONTENT: false    ->  <p></p>        ALL TEXT GONE
with #text, KEEP_CONTENT: false  ->  <p>Hello</p>   fine
```

An earlier version omitted it and sanitising the real content **dropped 49% of its bytes — every
tag intact, every word gone.**

**2. `USE_PROFILES` is mutually exclusive with the allow-lists.** Setting it makes DOMPurify ignore
`ALLOWED_TAGS` and `ALLOWED_ATTR` entirely and substitute its own. An earlier version set
`USE_PROFILES: { html: true }` intending to block SVG and MathML, and got the opposite of what it
wanted: `target` was stripped from all 541 links, while **`<form>` and `<input>` survived**. SVG
and MathML are already excluded by not being listed, so the option was never needed.

**3. `ADD_URI_SAFE_ATTR: ['target']` is required.** DOMPurify validates every attribute it considers
URI-bearing against `ALLOWED_URI_REGEXP`. `target` is in that set and `_blank` does not match
`^(?:https?:|mailto:|tel:|#|\/)`, so **`target` is dropped from all 541 links even though it is
explicitly in `ALLOWED_ATTR`.** Confirmed this does not weaken the regex for real URLs —
`href="javascript:alert(1)"` is still stripped with it set.

**4. No `g` flag on the dangerous-CSS regex.** `RegExp.test()` with `/g` is **stateful** — it
advances `lastIndex` and resumes there next call, so alternating inputs miss matches they should
catch. An earlier version used `/gi` and silently stopped stripping `expression(...)` because a
previous call had left `lastIndex` past it.

**5. Duck-type the hook's node, never `instanceof Element`.** On the server DOMPurify runs against
jsdom, where `Element` is not a Node global — an `instanceof` check throws a `ReferenceError`
*inside the hook* and takes the whole sanitise call with it. Use
`if (!('tagName' in node) || typeof node.setAttribute !== 'function') return`.

**6. Scrub dangerous CSS per DECLARATION, not per attribute.** DOMPurify does not deeply parse CSS;
it relies on the browser discarding invalid declarations. Since `style` must be allowed here,
`expression()`, `behavior:`, `javascript:` in `url()`, `vbscript:` and `-moz-binding` are stripped
explicitly — **dropping the individual declaration**, so one bad value cannot flatten a page's
entire layout.

### ⚠️ The dependency trap that caused #23 — do not walk back into it

```
isomorphic-dompurify 3.x  ->  jsdom ^28  ->  html-encoding-sniffer@6  ->  @exodus/bytes
                                                                          "type": "module",
                                                                          NO CommonJS build
```

Turbopack hands external packages to Node at runtime, so loading that becomes a `require()` of an
ES Module → `ERR_REQUIRE_ESM`, on Vercel only. **jsdom ≤27 uses `html-encoding-sniffer@4` →
`whatwg-encoding`, which is pure CommonJS.** So:

```jsonc
"isomorphic-dompurify": "^2.26.0",        // 2.x pins jsdom to ^26.1.0
"overrides": { "dompurify": "^3.4.13" }   // 2.26.0 asks ^3.2.6, which resolves to a
                                          // version carrying GHSA-55q2-fjhq-7xh7
```

⚠️ **That advisory matters specifically here** — *"IN_PLACE hook removal leaves a detached subtree
executable, causing XSS"* — because this file registers an `afterSanitizeAttributes` hook.

`next.config.ts` also needs the packages back in `serverExternalPackages` **and**
`outputFileTracingIncludes` for both rich-text routes. Both were required; neither alone was enough.

⚠️ **`sanitize-html` is NOT a drop-in escape.** Its current version depends on `htmlparser2@12`,
which is `"type": "module"` with **no `require` condition in its exports map** — the identical shape
to `@exodus/bytes`. `sanitize-html@2.16.0` and earlier use `htmlparser2@8` (CommonJS) and would be
fine. **The ecosystem is mid-migration to ESM; any choice here means pinning below a boundary.**

### What removal gave up

No longer stripped on save: `<script>`, every `on*` handler, `javascript:` / `data:` hrefs,
`<iframe>`, `<form>` / `<input>`, `expression()` in CSS. And `rel="noopener noreferrer"` is no
longer added automatically to `target="_blank"` links — ⚠️ `ShareButton.tsx` used to rely on that
being automatic.

### Testing it, when it returns

⚠️ **`<script></script>` alone is a weak test** — it proves tag removal, not that the allow-list is
right. Test the allow-list:

| Input | Expect |
| --- | --- |
| `<img src=x onerror="alert(1)">` | `onerror` gone, `<img>` kept |
| `<a href="javascript:alert(1)">` | href stripped |
| `<iframe src="…">` | removed entirely |
| `<a href="…" target="_blank">` | ⚠️ `target` **survives**, gains `rel="noopener noreferrer"` |
| `<details><summary>x</summary>y</details>` | ⚠️ survives intact |
| a real page with inline `style` | ⚠️ formatting unchanged — re-save one and diff |
| `style="width:expression(alert(1));color:red"` | `expression` declaration dropped, `color:red` kept |

⚠️ **Run it against real stored content and diff the output before shipping.** Every trap above was
found that way, and none of them produced an error — only silent, wrong output.

---

## Related documents

| Document | Contents |
| --- | --- |
| [Table redesign design note](https://claude.ai/code/artifact/930079be-3d25-47bb-9d16-5f128abf9135) | Live mockups, both themes; the density control is interactive |
| [Roadmap page prototype](https://claude.ai/code/artifact/2d080e12-7280-49ae-bac9-d408ffe0d02c) | **#33 / Phase L.** Three working roles, nesting to three levels, the Sheet, deep-link URLs, both themes |
| `SANITISER-REMOVAL.md` | **#35.** Step-by-step removal of rich-text sanitisation, with the reasoning and the accepted risk |
| `BLOB-TO-R2-MIGRATION.md` | Step-by-step move from Vercel Blob to Cloudflare R2, mid-flight |
| `TABLE-IMAGES-GUIDE.md` | *(written in K-5c)* — how to add a row image |
| `ICON-GUIDE.md` | Domain and page icons — the **repository** path, deliberately different |
| `NEW-IMPROVEMENTS.md` | Items #1–#28, Phases A–J |
