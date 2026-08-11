# NEW-IMPROVEMENTS-2

Continuation of `NEW-IMPROVEMENTS.md`, which passed 8,900 lines during Phase J and became slow to
open and search. **Nothing moved** — that file keeps items #1–#28 and Phases A–J exactly as
written. New work starts here at **#29 / Phase K**.

Same conventions as the original: ⚠️ marks a trap or a correction, every claim carries the
measurement behind it, and each phase step records what was verified rather than what was
intended.

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
| Export | — | `src/lib/export-table.ts`, 71 lines, **imported by nothing** |

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
| **Export** | User: *"not planning to have on public pages."* `src/lib/export-table.ts` is already dead — **delete it in K-2**. |
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
| **K-2** | Read the settings already stored — density, sticky header, page size, alternating rows. Delete dead code | none | Visible: consistent row height |
| **K-3** | `col.align`, `col.width`, working column resize | none | Visible: controlled column widths |
| **K-4** | Toolbar — Filter, Sort, Columns panels | none | **Large** — the tool feel |
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

**Proven, not assumed:** all 20 classes (10 light + 10 dark) are present in the built CSS, and
`bg-lime-100` — a colour deliberately not in the palette — is absent, so the check discriminates
rather than matching anything.

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
| — | Built CSS contains all 20 classes; `bg-lime-100` absent (control) | correct |
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

### K-3 — Alignment, width, resizing

1. Apply `col.align` — **already set on all 2,675 columns and ignored today**.
2. Apply `col.width` as the initial width; `minWidth`/`maxWidth` as bounds.
3. Re-enable resizing properly: `columnResizeMode: 'onChange'`, a real drag handle, **state only**
   — no persistence, per decision (c).
4. `font-variant-numeric: tabular-nums` wherever content is numeric.

**Test:** drag persists within the visit, **resets on reload**, respects min/max, and a table with
no widths set looks exactly as it does today.

### K-4 — The toolbar

**Files:** `DataTableToolbar.tsx`, `DataTableFilterPanel.tsx`, `DataTableSortPanel.tsx` (new),
`DataTableViewOptions.tsx` (gains reorder), `DataTable.tsx`.

Filter, Sort and Columns panels as described in 29.7. Filter state stays in **one place** so K-8
and any later URL support are a change of source, not a rewrite.

⚠️ **Keep the header click as the fast path.** The Sort panel is for what a header click cannot
express — sort by Pricing, then Name inside it. Replacing header sorting with a panel would make
the common case slower.

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
