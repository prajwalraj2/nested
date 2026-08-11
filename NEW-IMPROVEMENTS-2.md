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
| **K-5a** | Storage adapter + Vercel Blob + upload endpoint + `TableImage` model | **`TableImage` table** | none |
| **K-5b** | Image Management admin section | none | none |
| **K-5c** | Image rendering in cells, CSV id column, row-editor picker, guide | `col.meta.imageShape` | **Visible** — images appear |
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

### K-6 — Admin table editor

Badge colour list under each `badge` column, pre-filled by `assignBadgeColors` and editable;
image shape dropdown; width defaults; density selector.

### ⏸️ K-7 — Icons onto the upload path (deferred)

J-4 was deferred because building an upload service to save one `git push` was not worth it. Once
K-5a exists, that reasoning changes. **User's call: *"Let it be there as of now — we can see that
later."*** When taken, `ICON-GUIDE.md` §5 is rewritten.

### ⏸️ K-8 — Rows out of the JSON blob (deferred)

Per 29.4. **Trigger: a real table crossing ~1,000 rows.** Keeping the render path
source-agnostic through K-1…K-4 is what keeps this from becoming a rewrite.

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

## Related documents

| Document | Contents |
| --- | --- |
| [Table redesign design note](https://claude.ai/code/artifact/930079be-3d25-47bb-9d16-5f128abf9135) | Live mockups, both themes; the density control is interactive |
| `BLOB-TO-R2-MIGRATION.md` | Step-by-step move from Vercel Blob to Cloudflare R2, mid-flight |
| `TABLE-IMAGES-GUIDE.md` | *(written in K-5c)* — how to add a row image |
| `ICON-GUIDE.md` | Domain and page icons — the **repository** path, deliberately different |
| `NEW-IMPROVEMENTS.md` | Items #1–#28, Phases A–J |
