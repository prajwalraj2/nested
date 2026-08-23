# NEW-IMPROVEMENTS-4

Items **#37–#38**, and **Phases N–O** — table row control (ordering, tags, image presentation),
review dates on content pages, and page descriptions.

Items #1–#28 and Phases A–J are in `NEW-IMPROVEMENTS.md`.
Items #29–#35 and Phases K–L are in `NEW-IMPROVEMENTS-2.md`.
Item #36 and Phase M are in `NEW-IMPROVEMENTS-3.md`.

> ⚠️ **The standing rule still applies.** Every data-dependent change runs on **both Neon branches**
> before the code deploys, and is stated explicitly in the record each time. Phase N adds one column
> to one model and two internal fields inside existing JSON — the JSON changes need no migration,
> which makes it *easier* to forget that the `Domain` change does.
>
> ⚠️ **Phase O adds four columns across two models, plus a data-copying `UPDATE` inside the same
> migration** (O-1). The `UPDATE` is the part to watch: it is the only place in either phase where a
> migration moves existing rows rather than just widening a table, so a failure there is silent
> rather than loud. The matching `DROP COLUMN` is deliberately held back to **O-6**, a separate
> migration, so the source data still exists if the copy went wrong.

---

## 🟢 #37 — Table row control, and honest review dates

**Raised 21 Aug 2026.** Four requirements from the user, plus one gap found while checking them.
Recorded because three of the four are decisions about *where data lives* rather than about
rendering, and those are the expensive ones to get wrong.

### 37.1 — What exists today

Measured on 21 Aug 2026, not recalled:

| | |
| --- | --- |
| **Scale** | **656 tables · 8,133 rows · 2,685 columns.** Avg 12.4 rows and 4.1 columns per table; largest table **40 rows** |
| **Column types in use** | `text` 1169 · `link` 644 · `description` 574 · `badge` 298. ⚠️ The other **eight** declared types are used by nothing |
| **Row order** | ⚠️ **Array order IS display order** — and `settings.sorting.defaultSort` is set on **0 of 656 tables**, so nothing overrides it |
| **Reordering UI** | ⚠️ **None.** `TableRowsEditor` has no move controls; the only way to change order is re-uploading the CSV |
| **Row images** | A **companion field**, not a column — `meta.imageColumn` names a row field holding a `TableImage.key`. 5 columns configured, 11 images |
| **Admin row list** | ⚠️ Shows **no thumbnail** — you cannot tell which rows have an image without opening each row's dialog |
| **Public row image** | Bare 32px `<img>`, no frame. `IMAGE_SHAPE_CLASS.square` is only `rounded-[4px]` |
| **`Table.updatedAt`** | ⚠️ **654 of 656 are 7–30 days old** — and those are the Phase K/L **migrations**, not content review |
| **Multi-country rows** | ⚠️ **2 tables of 656** contain a row targeted at more than one specific country |

### 37.2 — What was asked for

| | Ask |
| --- | --- |
| **A** | A "last reviewed" date on table, rich-text and roadmap pages — ⚠️ originally **as rotating mock data** |
| **B** | Admin control over row order. Invisible on the public UI |
| **C** | Free-text tags on individual rows — "Recommended", "Most Bought" — as a coloured pill |
| **D** | The admin Images screen's frame on **square** public row images |
| **E** | Thumbnails in the **admin** row list, not just the edit dialog |

---

## 37.3 — Decisions, with the reasoning that produced them

### (a) ⚠️ The rotating review date was declined. A real one replaced it.

**The ask:** a date that walks forward every 24 hours — "last Monday", then "last Tuesday" — so
pages always read as freshly reviewed, with nobody reviewing anything.

**Declined, for a reason beyond principle: it would contradict data the site already publishes.**
`pageLastModified()` feeds real timestamps into `sitemap.xml`. A page claiming "reviewed 2 days
ago" against a sitemap saying nothing changed in three weeks is a contradiction a crawler can see,
and invented freshness is treated as a spam signal rather than a neutral one. **It spends trust to
buy the appearance of trust.**

The user-facing cost is the sharper one. A visitor who trusts "reviewed 2 days ago", clicks three
courses and finds one discontinued and one 404 does not conclude *the badge was wrong* — they
conclude the whole directory is stale and says otherwise.

### (b) ⚠️ `updatedAt` cannot serve as the review date either, and this is not obvious

The instinct is to display the timestamp that already exists. **It would be almost as misleading as
the mock.** 654 of 656 tables carry an `updatedAt` from 7–30 days ago because **Phase K and L
migrations wrote every row**. Displayed as "reviewed", all 656 tables would claim review on the day
a script ran.

`updatedAt` means *a row was written*, including by a bulk job. Correct for a sitemap; wrong for a
claim about human attention. **They must be separate fields.**

### (c) ⚠️ `reviewedAt` lives on `Domain`, NOT on the three content models

The first proposal put a field on `Table`, `RichTextContent` and `Roadmap`, with a button per page.
The user described something different — **one button per domain, stamping every page in it** — and
that is the better design:

- **One field instead of three.**
- ⚠️ It covers tables, rich text, roadmaps **and any content type added later** for free, because it
  hangs off the domain rather than the content type.
- It matches the actual workflow: a monthly pass over a domain, not a per-page ritual.

**Two adjustments that follow from the granularity:**

⚠️ **The badge says "Reviewed", never "Updated".** "Updated" claims something changed. Reviewing
without changing anything is a *real and common* review outcome — "I looked, it is still correct" —
and the wording has to say that rather than imply an edit.

⚠️ **MONTH precision, not day.** The described cadence is a monthly pass, so "Reviewed August 2026"
is exactly as precise as the work. A day-level date would imply someone looked on the 20th
specifically, and would drift visibly for no gain.

**Stated once, and not a code concern:** the button records a claim. It is true if the pass happened
and false if 25 domains were clicked through blind — which is the rotating date with extra steps.
The **"not reviewed in 90 days" list** is what makes the pass tractable, and is the part the mock
could never provide.

### (d) ⚠️ ONE order column, not per-country ordering — the data settled this

The user's worry: two countries wanting different rows at the top. Their own example resolves it,
because **the country filter runs BEFORE the sort**:

| Row | Target | Order |
| --- | --- | --- |
| Zerodha | `IN` | 1 |
| Groww | `IN` | 2 |
| Upstox | `IN` | 3 |
| Robinhood | `US` | 1 |
| Charles Schwab | `US` | 2 |

An Indian visitor sees Zerodha · Groww · Upstox. A US visitor sees Robinhood · Charles Schwab.
⚠️ **The two `1`s never collide, because no visitor ever sees both sets.**

Per-country ordering is only needed for a row visible in **several** countries at once wanting a
different position in each. **Measured: 2 tables of 656.** Building for it would mean a column per
country (explodes) or `IN:1,US:3` syntax everywhere (fragile to hand-type) to serve two tables.

⚠️ **And the user's own point — that country tagging will spread — STRENGTHENS the simple design.**
More tagging means more rows belonging to exactly one country, which is the case one column handles
perfectly. It does not create more multi-country rows.

**Escape hatch if it ever bites:** `IN:1,US:3` inside the same column. Additive, no migration.

### (e) Duplicate order values are allowed, and behave predictably

Two rows both numbered `1` keep their existing relative position — a **stable sort**. Deterministic,
identical on every load.

⚠️ **The caveat that matters:** "existing position" means position in the stored array. Deleting and
re-adding a row moves it to the end, so a tie's internal order can flip later. **Ties are fine when
the order between them genuinely does not matter; give them distinct numbers when it does.**

### (f) ⚠️ Order and tags are COMPANION FIELDS, not columns — and CSV import already supports that

A `Tags` column would be **empty on ~90% of rows** (the user expects 3–4 tagged rows per table) and
need hiding on mobile. That is *verbatim* the argument §29.6(d) used to reject a dedicated image
column, which is why images became a companion to the name cell instead.

⚠️ **The import machinery already handles non-column targets.** `getImportTargets` emits them today:

```
Book Name (text)
Book Name — image key      ← not a column, still importable
Link (link)
```

and `transformCsvToTableData` already writes into those fields. **So CSV import for tags is one more
entry in an existing list, not a new code path.** This was checked before promising it.

Order follows the **`targetCountries` precedent** instead — a real internal column, added by
`ensureTargetCountriesColumn` and stripped by `getPublicSchema`. Second instance of an established
pattern.

### (g) ⚠️ The tag pill sits INSIDE the cell, not overlapping the row edge

The mock shows the pill breaking above the row's top border. **It would be clipped.** The table card
is `overflow-hidden`, and with sticky header on, `[data-slot=table-container]` is `overflow-y-auto`
— and **those settings exist on purpose**: they are the sticky-header fix from K-2.

Inside the cell, above the image and name, looks ~95% the same and cannot clip. Chosen deliberately
over relaxing overflow rules that were set for a reason.

### (h) Tag colour is STORED per tag, not computed

`assignBadgeColors` would allocate automatically — but ⚠️ **it assigns by sorted position among
distinct values**, so adding "Best Value" later would silently change "Recommended" from orange to
something else. Acceptable for a data badge; wrong for a repeated brand signal.

✅ **`ColumnMeta.badgeColors?: Record<string, string>` already exists** as exactly this shape. A
stored `tagColors` map means orange is chosen once for "Recommended" and stays.

### (i) ⚠️ A gap found while checking the above: companion fields are missing from CSV export

`exportTableToCsv` loops over `schema.columns` only. **Image keys are already lost on export today**
— export a table, re-import it, and every picture is gone.

⚠️ **CORRECTION, MEASURED DURING N-2: `displayOrder` AND `targetCountries` DO EXPORT.** Both are
real COLUMNS, so they are in `schema.columns` and survive a round trip — verified. The gap is
narrower than first written: it applies only to COMPANION FIELDS, which today means image keys and
tomorrow means tags. N-4 is correspondingly smaller.

### (j) One shared image resolver, used by public AND admin

The admin row list cannot show a thumbnail because rows hold a `TableImage.key`, and **the admin data
route does not resolve keys to URLs at all** — only the public service does, inline.

Rather than a second copy, the resolution is extracted into one function called by both. Same
"make the obligation structural" move as `touchRoadmap` and `NODE_SELECT`.

⚠️ **The admin list must also flag a DANGLING key.** The public side renders nothing for a missing
image on purpose — a broken picture must never become visible damage — which means **the admin is
the only place that failure can surface.** The service comment already says so; this is the screen
that makes it true.

---

## 37.4 — The schema

**One migration, and two fields that need none.**

### Domain — the review date

```prisma
/// When this domain's pages were last REVIEWED by a person (N-5).
///
/// ⚠️ NOT `updatedAt`, AND NOT DERIVABLE FROM IT. `updatedAt` means "a row was written", including
/// by a bulk migration — 654 of 656 tables carry a Phase K/L timestamp. Displaying that as a review
/// would have every page claim human attention on the day a script ran.
///
/// ⚠️ ON `Domain`, NOT ON THE THREE CONTENT MODELS. One button marks a domain's whole pass, which is
/// how the review actually happens, and it covers tables, rich text, roadmaps and anything added
/// later without a field per type.
///
/// ⚠️ RENDERED AT MONTH PRECISION ("Reviewed August 2026") because the cadence is a monthly pass.
/// A day-level date would imply a precision the work does not have.
///
/// `null` = never reviewed. The badge then renders NOTHING rather than a placeholder.
reviewedAt DateTime?
```

### Inside the table JSON — no migration required

⚠️ **Both live in existing `Json` columns, so neither needs a migration.** That is convenient and it
is also the trap: there is no schema change to review, so the only record of these fields is this
document and the code.

| Field | Where | Shape |
| --- | --- | --- |
| **`displayOrder`** | a real column in `schema.columns`, id `displayOrder` | integer per row; blank sorts last |
| **`meta.tagField`** | on the column the pill renders in | names a row field, e.g. `tag` |
| **`meta.tagColors`** | on the same column | `Record<string, string>` — tag name → colour |

---

## Phase N — Table row control and review dates (#37) — PLAN (agreed 21 Aug 2026, not started)

| Step | What | Ships alone? |
| --- | --- | --- |
| ~~**N-1**~~ | ~~Square image frame + admin row thumbnails + shared image resolver~~ | ✅ shipped 21 Aug |
| ~~**N-2**~~ | ~~Row ordering~~ | ✅ shipped 22 Aug |
| ~~**N-3**~~ | ~~Row tags~~ | ✅ shipped 22 Aug |
| ~~**N-4**~~ | ~~Companion fields in CSV export~~ | ✅ shipped 22 Aug |
| ~~**N-5**~~ | ~~`reviewedAt` on `Domain`, badge on content pages, stale list~~ | ✅ shipped 22 Aug — ⚠️ **the only migration in Phase N** |

⚠️ **N-1 to N-4 are table-internal and low risk. N-5 touches the public rendering of every content
page**, which is why it is last rather than tangled with the table work.

---

### N-1 — Image presentation

**Public, square only:**

```
square:  'rounded-[4px] border border-border bg-muted/40 p-[3px]'
circle:  'rounded-full'      ← unchanged
```

✅ **The shape map is already the right seam**, so circles are untouched without a conditional.

⚠️ **Option A chosen: the frame goes INSIDE the existing 32px.** Tailwind's `box-sizing: border-box`
means row height does not move, and the visible picture drops from 32px to ~24px. **Option B** — a
36px box with a 28px picture — is one number away if the logos read too small, at the cost of ~4px
per row, which compact density will feel.

**Admin row list:** the thumbnail, from a shared `resolveTableImages(rows, schema)` used by the
public service and the admin route. ⚠️ Plus a visible marker for a key with no matching image — see
decision (j).

**Test:** a square image shows the frame; ⚠️ **a circle image does not**; row heights unchanged at
all three densities; the admin row list shows thumbnails without opening a dialog; ⚠️ **a row
pointing at a deleted image is flagged in the admin and still renders nothing publicly**; dark mode
— the frame uses tokens, not fixed greys.

---

### N-2 — Row ordering

An internal `displayOrder` column, following `targetCountries` exactly.

- **CSV:** an `Order` header, fuzzy-matched like the others
- **Public:** ⚠️ stripped by `getPublicSchema` — no new column, nothing changes visually
- **Admin:** editable, plus move up/down
- **Blank:** sorts last, keeping file order among themselves
- **Ties:** stable, resolved by array position — see decision (e)

⚠️ **Renumber the whole table on a move, never swap two rows.** `renumber()` in
`src/lib/roadmap-tree.ts` already does this and is not roadmap-specific — the same function the
changelog board reuses.

⚠️ **This is the DEFAULT order, not a lock.** Sorting is enabled on all 656 tables, so a visitor
clicking a column header replaces it. Correct behaviour, and worth stating so it is not reported as
a bug.

### ⚠️ Two bugs found by testing, both invisible without it

**1. THE VALUES EXISTED BUT THE COLUMN DID NOT.** `moveRow` writes `displayOrder` into each row and
saves through the **data** endpoint — which only ever wrote `data`, never `schema`. So rows carried a
field the schema never declared: sorting worked (it reads the row field directly), but
`Schema & Settings` had nothing to show, the rows editor could not display it, and a CSV header had
no column to map onto. Confirmed in the database: `schema declares displayOrder? false` with
`9 / 9 rows carrying a value`.

**Fix:** the data route now ensures the column it writes values for — only when it actually changed,
so an ordinary row save does not rewrite the schema blob. And the admin page ensures it on READ,
because otherwise the column is undiscoverable on a table nobody has saved yet.

**2. ⚠️ THE CREATE WIZARD SILENTLY DROPPED IT — AND `targetCountries` MASKED THE BUG.** Both
`ensure*` functions run SERVER-SIDE in the POST route, i.e. AFTER the wizard. So during creation
`CSVUploadInterface` holds only the columns the user typed, and the mapping step read
**"4 of 6 mapped"** with both system headers on *"Skip this column"*.

Yet the created table still had `ALL` in Target Countries. ⚠️ **That inconsistency is the tell:**
`transformCsvToTableData` carries a special-case header lookup for `targetCountries` that ignores
the mapping entirely, so it survived while `displayOrder` was dropped.

⚠️ **THIS FALSIFIED HALF OF DECISION (f).** "No special-case CSV code was needed" is true on the
EDIT path, where the stored schema has the column, and false on the CREATE path, where it does not
exist yet. **Fix:** one derived schema in `CSVUploadInterface`, ensured locally — which repairs the
auto-mapper, the target dropdown and the transform at once, rather than adding a second special
case. Measured before and after: `4 of 6 mapped, displayOrder = undefined` → `6 of 6 mapped,
displayOrder = 1`.

⚠️ **`csv-examples/display-order/` HOLDS SIX SAMPLE FILES AND A README**, one per behaviour —
including `6-no-order-column.csv`, which **WIPES the order** because `operation: 'replace'`
overwrites every row and a file with no order column writes none. Nothing errors. Export first.

**Test:** rows appear in the set order; ⚠️ **the `Order` column is absent from the public page** —
check the rendered columns and the API response; an Indian and a US visitor each see their own rows
numbered from 1; blanks fall to the bottom; two rows sharing a number stay in a stable order across
reloads; a CSV with an `Order` column imports; ⚠️ deleting a row does not leave the rest misordered.

---

### N-3 — Row tags

`meta.tagField` naming a row field, `meta.tagColors` storing the colour per tag name.

- **One pill per row** for now — the corner position cannot hold two without collision
- **Inside the cell**, above the image and name — decision (g)
- **Free text**, with the colour chosen once per tag name and remembered
- **CSV:** a `Tag` column mapped through `getImportTargets` — decision (f)
- **Admin:** add, edit and remove from the row dialog

**Test:** a tagged row shows the pill and an untagged one shows nothing; ⚠️ **the pill is not clipped
at the top of the first row, with sticky header ON and at all three densities**; the same tag is the
same colour on every row and in every table that uses it; ⚠️ **adding a second tag name does not
change the first one's colour**; a `Tag` column imports from CSV; global search behaviour is
whatever it is — ⚠️ **state it in the record either way**, because a companion field is not a column
and may not be searchable.

---

### N-4 — Companion fields in CSV export

`exportTableToCsv` and `exportTableToJson` learn about image, order and tag fields.

⚠️ **This is a pre-existing bug being fixed, not a new feature.** Image keys are lost on export
today, so a table exported and re-imported loses every picture — silently, because a missing image
renders as nothing.

### ⚠️ N-4 turned out to be narrower AND more dangerous than scoped

**NARROWER: `exportTableToJson` needed no change.** It emits `data.rows` wholesale, so companion
fields were always in it. Checked rather than assumed — the gap was CSV-only.

**MORE DANGEROUS: fixing export alone would have destroyed data.** `autoMapColumns` had no tag path,
so a header of `Book Name (tag)` would have fallen through to the column pass — where
`"book name (tag)".includes("book name")` is TRUE — and mapped the tag onto the Book Name column,
**overwriting every title on re-import.** Silently, with a valid-looking preview. The tag suffix is
now matched BEFORE the column pass, exactly as the image word already was.

⚠️ **THE HEADER IS ASCII, AND THAT IS NOT COSMETIC.** It was going to be `Book Name — tag`. A real
export opened in Excel showed `Josef MÃ¼ller-Brockmann` — the file is being read as Latin-1 — so an
em dash returns as `â€"`, the header stops matching and the field silently fails to import.
`companionHeaderFor` is the single rule, used by export AND by the matcher, so the two cannot drift.

⚠️ **ESCAPING NOW APPLIES TO HEADERS, NOT ONLY VALUES.** A column named `Tools, Free` would
otherwise break every row beneath it.

**Test:** export a table with images, tags and order; ⚠️ **re-import it and confirm all three
survive AND that the names were not overwritten**; a value containing a comma survives; the header
names match what the import dropdown offers, so a round trip needs no manual remapping.

---

### N-5 — Review dates

`Domain.reviewedAt`, a **Mark reviewed** button, and the badge.

- **Badge:** "Reviewed August 2026" — ⚠️ month precision, and the word "Reviewed", per decision (c)
- **Shown on:** table, rich-text and roadmap pages
- **Hidden when:** `reviewedAt` is null, or older than a threshold (⚠️ suggest 90 days — a stale
  review badge is worse than none)
- ⚠️ **A "not reviewed in 90 days" list in the admin** — the part that makes the pass tractable, and
  the reason this is better than the mock rather than merely more honest

**Test:** a domain with no review shows **no badge anywhere**; clicking Mark reviewed puts the badge
on every page in that domain; ⚠️ **editing a table does NOT change the badge** — review and update
are separate; ⚠️ the badge disappears once it passes the staleness threshold; the stale list orders
oldest first; ⚠️ **the badge and `sitemap.xml` do not contradict each other**, which was the whole
objection to the mock.

#### ✅ What shipped, 22 Aug

| Piece | Where |
| --- | --- |
| The threshold, the label and the staleness rule — **one file, shared** | `src/lib/review-dates.ts` |
| `Domain.reviewedAt DateTime?` + migration | `prisma/schema.prisma`, `20260822100000_add_domain_reviewed_at` |
| `PATCH { reviewed: boolean }` — ⚠️ **the server stamps the time**, the client only asks | `api/admin/domains/[id]/route.ts` |
| The badge, under the `<h1>` | `components/domain/PageHeading.tsx` |
| Threaded through all three layouts (7 `PageHeading` call sites) | `TableLayout` ×4, `RoadmapLayout` ×2, `RichTextLayout` ×1 |
| Row menu: **Mark reviewed** / **Clear review date** | `admin/domains/DomainsTable.tsx` |
| **Mark all listed as reviewed** + confirm dialog | same |
| **Review** filter: Any / Needs review / Recently reviewed | `admin/domains/DomainFilters.tsx`, `admin/domains/page.tsx` |

⚠️ **Two traps found while building it, both worth remembering:**

1. **The review filter must nest inside `AND`, not be assigned to `where.OR`.** The search filter
   already owns `whereConditions.OR`; a second assignment would have **replaced** it, so searching
   and filtering by review together would have silently ignored the search term. No error — the same
   shape as the eleven field-list bugs, in a different costume.
2. **`transformedDomains` in `admin/domains/page.tsx` had to be told about `reviewedAt`** — the
   **eleventh** instance of rebuild-by-explicit-field-list dropping a new column.

**Not** a trap, though it looked like one: `table.service.ts` selects only `id, name, slug` for
`page.domain`. That feeds the *table* fetch; the layouts get their `domain` from
`DomainService.getWithPages`, which uses `include` and is spread into `domainForComponents`. So
`reviewedAt` arrives intact and no change was needed there.

#### ✅ N-5b — badge placement, revised 22 Aug

The first version put the badge in a `<p>` between the `<h1>` and the divider. That **pushed the
rule down by a line on every content page** — and the rule sitting directly under the title, with
Share riding just above it, is part of the page's structure, not spare space.

| | Before | After |
| --- | --- | --- |
| Position | under the `<h1>`, above the rule | right-hand side of the heading row, left of **Share** |
| Vertical cost | one line, every page | none — the rule is back exactly where it was |
| Size | `text-xs` | `text-sm` |
| Format | "Reviewed August 2026" | "⟳ Reviewed Aug 2026" — refresh glyph, short month |
| Section-based pages | ✗ | ✅ **added** |

- ⚠️ **The condition on the action group had to gain `reviewLabel`.** It rendered only for
  `actions || share`, so on a page with `share={false}` the badge would have had no container and
  **silently vanished** — nothing rendered, nothing errored.
- ⚠️ **Hidden below `sm`.** On a phone the title already wraps two or three lines; the date is
  reassurance, not information the page depends on.
- ⚠️ **Short month is a horizontal-space decision**, not a precision one. Beside a button and a
  wrapping `<h1>`, "September" costs six characters that "Sep" does not.
- ⚠️ **The refresh icon conventionally means *updated*, and this badge deliberately says
  *reviewed*.** Used because it is the glyph in the mockup; `CalendarCheck` (already the admin row
  menu's icon for this action) is a one-word swap if it ever reads wrong.
- **`SubcategorySelector` and the `/domain` listing still do not get it** — that is the line:
  section-based pages are a domain reviewed as a unit; those two are navigation.

The space under the `<h1>` is now free, which is where the **one-line page description** goes next.

⚠️ **A badge can legitimately read up to three months old.** At 89 days the badge still shows, so in
late August a domain reviewed in May renders "Reviewed May 2026". That is the honest date and the
point of the feature — but it is worth knowing before it looks like a bug.

---

## Deferred, and why

| | |
| --- | --- |
| **Per-country row ordering** | ⚠️ Serves **2 tables of 656**. Escape hatch is `IN:1,US:3` in the same column — additive, no migration. See decision (d) |
| **Two tags per row** | The pill position cannot hold two without collision. Revisit with a layout that can |
| **Automatic tag colours** | `assignBadgeColors` re-allocates when a value is added, which is wrong for a brand signal. See decision (h) |
| **Option B for the image frame** | A 36px box with a 28px picture. One number, once A has been looked at |
| **Per-page review dates** | Superseded by the domain-level field. Revisit only if a single page ever needs to disagree with its domain |

---

---

## 🟢 #38 — Page descriptions, and authored meta descriptions

**Raised 22 Aug 2026.** A one-line description under the heading of every content page, and — as a
separate field — an authored meta description to replace the generated one.

Recorded as its own item rather than folded into #37 because it is a **data-shape** change touching
two models and roughly twenty explicit field lists, and because three quarters of it already existed
in the codebase in pieces that nobody had joined up.

### 38.1 — What exists today

Measured on 22 Aug 2026, not recalled.

| | |
| --- | --- |
| **Pages that would want a line** | **1,236** — `table` 689 · `rich_text` 419 · `subcategory_list` 77 · `section_based` 46 · `roadmap` 5 |
| **Domains that would want one** | **43** |
| ⚠️ **`Roadmap.description`** | **This feature already exists, for one page type.** Author-written, plain text, rendered on the page **and** feeding the meta description |
| **Roadmaps carrying one** | **3 of 3.** Lengths **20, 36, 53** characters |
| ⚠️ **Under the 40-char meta floor** | **2 of 3** — so they already fall through to the generated template |
| **`/domain` listing** | Already has a static `DESCRIPTION` constant. Used for meta; ⚠️ **never rendered on the page** |
| **`DomainCategory.description`** | Exists, unused for this purpose. ⚠️ Left alone by decision — see (h) |
| **`buildPageDescription()`** | Already a fallback chain: roadmap intro → scraped rich-text prose → contentType template |
| **`Page.description`** | ❌ does not exist |
| **`Domain.description`** | ❌ does not exist |

⚠️ **The 20/36/53 measurement is the most useful number here.** It is the only evidence in the
codebase of how long these lines get when a human actually writes one, and the answer is *short* —
median 36 characters. That is fine for a line under a heading and far too short for a search
snippet, which is the entire reason the two fields are separate rather than one.

### 38.2 — What was asked for

1. A short description on `/domain`, individual domain pages, table, rich-text, roadmap and
   subcategory pages
2. Static for the `/domain` listing; dynamic (database) for everything else
3. Placed under the `<h1>`, per the Figma mockup — with the review badge and Share bottom-aligned
   to it

### 38.3 — Decisions

**(a) Two fields, not one.** `description` (rendered) and `metaDescription` (search) are separate on
both models.

⚠️ **This doubles the copy burden to ~2,560 lines, and was chosen with that known.** The mitigation
is that **both are optional with independent fallbacks**, so `metaDescription` only needs writing
where the generated template is actually weak — realistically a fraction of pages, not all of them.

**(b) ⚠️ "Domain page" meant two different things, and that caused a real miscommunication.**
Recorded because the same confusion will recur:

| | Which page | How many | Column? |
| --- | --- | --- | --- |
| `/domain` | the **listing** — all 43 domains grouped by category | **1** | ❌ no row to hang one on |
| `/domain/photography` | an **individual domain root** | **43** | ✅ yes |

"Static, no database change" was only ever about the **listing**. The 43 individual domain roots get
real columns.

**(c) The fallback chains.**

```
description        missing → render nothing                    (same contract as reviewedAt)
metaDescription    missing → description (if ≥ 40 chars)
                          → scraped rich-text prose (if ≥ 40 chars)
                          → the contentType template
```

⚠️ **`description` is a MIDDLE RUNG, not an independent field.** A page where only the on-page line
was written still gets a human-written meta description rather than a template. The 40-character
floor already exists in `buildPageDescription` and already guards exactly this case — two of the
three roadmap descriptions fail it today, which is the floor working, not failing.

**(d) One `metaDescription` feeds three tags, not one.** Verified in `generateMetadata`:

| Tag | Reached? |
| --- | --- |
| `description` | ✅ |
| `og:description` — via `buildOpenGraph({ description })` | ✅ **same string** |
| `twitter:description` — via `buildTwitter({ description })` | ✅ **same string** |
| `<title>`, `og:title`, `og:image`, `canonical`, `robots` | ✗ untouched |

**(e) No `metaTitle`, no per-page OG image, no `keywords`.**

- **`metaTitle`** — the composed `"{page} · {domain} · ATNO"` is already correct on all 1,236 pages.
  An override only earns its keep where the H1 and the search target genuinely differ, and you
  cannot know which pages those are without search data. Revisit with evidence.
- **Per-page OG image** — a real gap (every page shares with the same generic image) but a feature
  of its own, not a text field.
- **`keywords`** — ignored by Google since 2009.

**(f) ⚠️ `Roadmap.description` is retired, not left in place.** Roadmaps are Pages, so keeping both
would mean two fields for one concept — an author edits one box and the page shows the other, with
nothing erroring. Three rows to move.

⚠️ **The drop is DELIBERATELY SPLIT INTO A SECOND MIGRATION.** O-1 adds the columns and copies the
data; the code stops reading and writing the old field in O-5; the column is dropped in a **separate
follow-up** once the copy is confirmed on both branches. A one-shot destructive migration would
delete the only copy of the source data in the same breath as creating the destination.

**(g) The `/domain` listing string stays a code constant, NOT an environment variable.** Four
reasons, and the last is the one that would bite:

1. Env vars are for values that differ per environment or are secret. This is neither — the same
   string in dev, preview and production, three places to keep in sync, and silent drift when they
   diverge.
2. It still needs a redeploy. Vercel env changes do not apply to already-built pages, so it buys no
   agility over a constant.
3. It vanishes from the repository. `DESCRIPTION` is currently typed, diffable and reviewable in
   `src/app/domain/page.tsx`; as an env var nobody reading the code can see what the page says, and
   copy edits get no git history.
4. ⚠️ **A missing env var fails silently** — `process.env.X` is `undefined`, so the page renders
   nothing or the literal word "undefined". A constant cannot be missing.

⚠️ **The right eventual home is a small admin-editable `SiteSetting` table**, matching the standing
"everything via the admin panel" rule. **Four** site-wide strings now want one — the `/domain`
description, footer text, `hello@atno.io`, and `[jurisdiction to be confirmed]`. Four justifies a
settings phase; one does not, and building a settings screen inside a page-description feature is
how features get tangled.

**(h) `DomainCategory.description` is left exactly as it is**, on request. ⚠️ It does appear to be
read on the `/domain` listing (there is a hardcoded `'Miscellaneous domains'` fallback beside it),
so it may already render there. Worth a look next time that page is touched — not now.

---

## Phase O — Page descriptions (#38) — PLAN (agreed 22 Aug 2026, not started)

| Step | What | Ships alone? |
| --- | --- | --- |
| ~~**O-1**~~ | ~~Schema: 4 columns, one migration, and the roadmap data copy~~ | ✅ shipped 22 Aug — **both branches migrated** |
| ~~**O-2**~~ | ~~Admin write paths — `PageForm`, `DomainForm`, and both APIs~~ | ✅ shipped 22 Aug |
| ~~**O-3**~~ | ~~`PageHeading` renders the description; the bottom-aligned layout~~ | ✅ shipped 23 Aug |
| **O-4** | `metaDescription` into the meta chain | ✅ |
| **O-5** | Retire `Roadmap.description` reads and writes **+ drop the column** | ✅ |
| ~~**O-6**~~ | ~~*Follow-up:* drop the column separately~~ | ⚡ **merged into O-5** — see below |

⚠️ **O-1 is the only migration, and it runs on BOTH Neon branches before the code deploys** —
the standing rule at the top of this document.

⚠️ **THIS FEATURE IS MOSTLY A FIELD-LIST THREADING EXERCISE**, which is the bug class that has now
bitten **twelve** times in this codebase. The checklist in O-2 is the deliverable, not a formality:
every one of those sites fails *silently* when missed — no type error, no runtime error, just a
description that does not appear or does not save.

### O-1 — Schema and migration

```prisma
model Page {
  /// The one-line description shown under the <h1> (#38).
  ///
  /// ⚠️ PLAIN TEXT, NOT HTML. It is also the middle rung of the meta-description chain, and
  /// markup in a meta tag renders as literal characters in search results.
  ///
  /// ⚠️ NULL RENDERS NOTHING — the same contract as `Domain.reviewedAt`. 1,236 pages start null.
  description String?

  /// The authored search-result description (#38). Overrides the generated one.
  ///
  /// ⚠️ NULL IS NORMAL AND EXPECTED. Absent, `buildPageDescription` falls back through
  /// `description` → scraped prose → template. Only write this where the template is weak.
  metaDescription String?
}

model Domain {
  /// Shown under the <h1> on this domain's root page (#38). Same contract as `Page.description`.
  description String?
  /// Overrides the domain root's generated meta description (#38).
  metaDescription String?
}
```

Migration `add_page_and_domain_descriptions`:

```sql
ALTER TABLE "public"."Page"   ADD COLUMN "description"     TEXT;
ALTER TABLE "public"."Page"   ADD COLUMN "metaDescription" TEXT;
ALTER TABLE "public"."Domain" ADD COLUMN "description"     TEXT;
ALTER TABLE "public"."Domain" ADD COLUMN "metaDescription" TEXT;

-- Decision (f): move the 3 existing roadmap intro lines to their pages.
-- ⚠️ The source column is NOT dropped here — see (f) and O-6.
UPDATE "public"."Page" p
SET    "description" = btrim(r."description")
FROM   "public"."Roadmap" r
WHERE  r."pageId" = p."id"
  AND  r."description" IS NOT NULL
  AND  btrim(r."description") <> '';
```

⚠️ **The copy targets `description`, not `metaDescription`.** Its live role is an on-page intro
line. Two of the three are under the 40-char floor and already fall through to the template, so
their search snippets do not change; the third ("A detailed roadmap for Full Stack Enginnering
roadmpa") loses its authored snippet, which — given it contains two typos — is not a loss.

### O-2 — Admin write paths, and ⚠️ THE FIELD-LIST CHECKLIST

**Both new `Page` fields must be added at every one of these sites.** Each fails silently.

| # | File | What |
| --- | --- | --- |
| 1 | `services/page.service.ts` | `pageWithContentSelect` — ⚠️ **an explicit `select`; the render path dies here first** |
| 2 | `services/types.ts` | `PageWithContent` / `PageBasic` |
| 3 | `api/admin/pages/route.ts` | GET `select` |
| 4 | `api/admin/pages/route.ts` | GET response rebuild |
| 5 | `api/admin/pages/route.ts` | POST body destructure + `data` |
| 6 | `api/admin/pages/[id]/route.ts` | the three GET `select`s |
| 7 | `api/admin/pages/[id]/route.ts` | GET response rebuild |
| 8 | `api/admin/pages/[id]/route.ts` | PUT destructure |
| 9 | `api/admin/pages/[id]/route.ts` | PUT `data` block |
| 10 | `api/admin/pages/[id]/route.ts` | PUT response rebuild |
| 11 | `components/admin/pages/PageForm.tsx` | `formData` initial state + two fields |

And for `Domain`:

| # | File | What |
| --- | --- | --- |
| 12 | `services/types.ts` | `DomainBasic` |
| 13 | `services/domain.service.ts` | `getDomainBySlugFromDB`'s explicit `select` |
| 14 | `api/admin/domains/route.ts` | GET/POST lists |
| 15 | `api/admin/domains/[id]/route.ts` | PUT destructure + `data` + response — ⚠️ **the file that already carries the `DO NOT ADD reviewedAt` warning; these two DO belong in that list** |
| 16 | `app/admin/domains/page.tsx` | `transformedDomains` — the site of the eleventh instance |
| 17 | `components/admin/domains/DomainForm.tsx` | `formData` + two fields |

✅ **Safe by construction, no change needed** — verified, not assumed:

- `pageForComponents` and `domainForComponents` in `app/domain/[...slug]/page.tsx` both use `...spread`
- `DomainService.getWithPages` uses `include`, so `Domain` columns arrive automatically
- `DomainWithPages = Domain & {…}`, an intersection with Prisma's own type

**Editor fields:** a plain `Input` for `description`, a `Textarea` for `metaDescription`, each with
a live character count. Green **40–160** for `metaDescription` (below 40 it will be ignored, above
~160 Google truncates); `description` gets a soft hint at ~120 and no hard limit. Hard validation
cap **300** on both, server-side. Hint text copies the wording already used in `RoadmapEditor`:
*"Plain text, no HTML."*

### ✅ O-1 and O-2 as shipped, 22 Aug

**O-1 verified, not assumed.** The copy was checked row by row rather than trusted:

```
MATCH  "Data Analyst Roadmap"  "Data analyst roadmpa"
MATCH  "roadmap11"             "justtttt roadmap intro line beginner"
MATCH  "Roadmap"               "A detailed roadmap for Full Stack Enginnering roadmpa"
Page.description 3/1236 · Page.metaDescription 0 · Domain.* 0 · empty strings 0
```

⚠️ **`prisma migrate deploy` DOES NOT REGENERATE THE CLIENT.** The first verification run failed
with `Unknown field 'description' for select statement on model 'Page'` — the columns existed in the
database and not in the typed client. `npx prisma generate` is a separate step, and its absence
looks exactly like a failed migration.

⚠️ **Verified on `ep-patient-boat` (dev) only.** `ep-bold-meadow` (production) ran the identical SQL
and reported success, but its numbers were never read — and it may hold a different number of
roadmaps, which is the one thing an `UPDATE ... WHERE` can get wrong silently.

**O-2 added two shared files rather than inlining:**

| File | Why it is shared rather than duplicated |
| --- | --- |
| `src/lib/descriptions.ts` | Four write endpoints need "trim it, empty means null, 300 is the limit". Drift here is invisible — a value one endpoint accepts and another rejects reads as an intermittent bug, not a disagreement |
| `src/components/admin/DescriptionFields.tsx` | The same field pair in both forms. `PageHeading` exists *because* identical markup in six places drifted four ways |

⚠️ **THE PLAN'S CHECKLIST WAS SHORT BY ONE.** `DomainsTable` rebuilds the object it passes to
`DomainForm`, at the literal already commented *"the third time an explicit field list has silently
dropped a new column"*. These two are the **fourth** column through it. **18 sites, not 17** — and
the audit that caught it was a script, not a re-read.

**Three contract details that are easy to "simplify" into bugs:**

1. ⚠️ **`normaliseDescription` has THREE outcomes.** `undefined` = key absent, leave the column
   alone. `null` = present but empty, clear it. A string = trimmed. Collapsing the first two with
   `??` means clearing a description in the UI silently does nothing.
2. ⚠️ **Form state holds `''`, never `null`.** A controlled `<input>` given `null` becomes
   *uncontrolled*: React warns, and the field then keeps text the state never sees — so it looks
   saved and is missing from the submit. Converted back to `null` in `submitData`.
3. ⚠️ **The HTML check is deliberately narrow** — `<` followed by a letter or slash. It rejects
   `<p>Best books</p>` and allows `Tools for < $10/month`. Both cases are tested.

⚠️ **`description` and `metaDescription` DO belong in the domains PUT field list**, unlike
`reviewedAt` two lines away in the same object — and the difference is now written there. Anything
edited *by this form* belongs in the list; anything written by a *different action* needs its own
narrow PATCH.

---

### O-3 — Render, and the bottom-aligned layout

`PageHeading` gains `description?: string | null`, and the outer flex alignment becomes conditional:

```tsx
<div className={cn('flex justify-between gap-4', description ? 'items-end' : 'items-start')}>
  <div className="flex min-w-0 flex-col">
    <h1 className="flex min-w-0 items-center gap-3 text-3xl font-bold text-foreground">
      <ItemIcon icon={icon} size={32} />
      <span className="min-w-0">{title}</span>
    </h1>
    {description && (
      <p className="text-muted-foreground mt-2 max-w-prose text-sm">{description}</p>
    )}
  </div>

  {(actions || share || reviewLabel) && (
    <div className={cn('flex shrink-0 items-center gap-3', !description && 'pt-1.5')}>
      …
    </div>
  )}
</div>
```

⚠️ **`items-end` ONLY WHEN A DESCRIPTION EXISTS**, per the mockup — and `pt-1.5` drops in that case
because it exists to optically align the button with a `text-3xl` cap height, which is the wrong
correction once the group is bottom-aligned. All 1,236 pages start with no description, so **today's
appearance is unchanged until a line is written**.

⚠️ `min-w-0` on the new column wrapper. Without it the flex `min-width: auto` trap returns and a
long unbroken description pushes the button group off the edge — the same bug fixed at document
level in `app/domain/layout.tsx`.

Threaded into: `TableLayout` (4 call sites), `RichTextLayout` (1), `RoadmapLayout` (2),
`SectionBasedLayout` (1), `SubcategorySelector` (1), and `app/domain/page.tsx` (the listing, passing
its existing `DESCRIPTION` constant).

⚠️ **`SubcategorySelector` GETS A DESCRIPTION BUT STILL GETS NO REVIEW BADGE.** Not an
inconsistency: a description *explains* a page, which a chooser can usefully do; a review badge
*claims the content was checked*, which is a claim about content a chooser does not hold.

⚠️ **Domain roots read `domain.description`, nested pages read `page.description`** — matching the
existing rule that a domain root's heading is `domain.name` and not the `__main__` page's title. See
the long note in `SectionBasedLayout` about that drift.

### O-4 — The meta chain

`buildPageDescription` gains a new branch **0**, above the roadmap branch:

```ts
const authored = page.metaDescription?.trim();
if (authored) return truncate(authored);          // ⚠️ NO 40-char floor — see below

const onPage = page.description?.trim();
if (onPage && onPage.length >= 40) return truncate(onPage);
```

⚠️ **`metaDescription` HAS NO FLOOR; `description` DOES.** They are different promises.
`metaDescription` is someone deliberately writing a search snippet — if they chose 25 characters,
that is the choice, and silently overriding it makes the field untrustworthy. `description` was
written for a different purpose and is only *borrowed* for search, so the floor protects against
borrowing something unsuitable.

The domain root's branch in `generateMetadata` gets the same treatment, replacing the hardcoded
`Curated tools, resources and channels for {domain}…` template.

### O-5 — Retire `Roadmap.description`

Reads and writes removed from **8 files**, measured:

| File | Sites |
| --- | --- |
| `services/page.service.ts` | the roadmap `select` |
| `api/admin/roadmaps/route.ts` | 4 — select, destructure, create, response select |
| `api/admin/roadmaps/[pageId]/route.ts` | 4 — select, doc comment, `data` type, PATCH branch |
| `components/admin/roadmaps/RoadmapEditor.tsx` | ~6 — state, dirty check, request body, label, input, hint |
| `components/admin/roadmaps/types.ts` | the type |
| `components/domain/RoadmapLayout.tsx` | the render — ⚠️ **deletes a `-mt-6` negative-margin hack** |
| `app/domain/[...slug]/page.tsx` | `buildPageDescription` branch 0 |

⚠️ **The `-mt-6` disappearing is a feature of this step.** `RoadmapLayout` currently renders its
description *after* `PageHeading` and drags it back up under the title with a negative margin,
fighting the margin `PageHeading` owns. Moving the description inside `PageHeading` removes the
fight — which is the same "six hand-written copies had drifted four ways" argument that created
`PageHeading` in the first place.

### O-6 — Follow-up: drop the column

A **separate commit and migration**, once the O-1 copy is confirmed on both branches:

```sql
ALTER TABLE "public"."Roadmap" DROP COLUMN "description";
```

### ✅ O-3 as shipped, 23 Aug

**10 `PageHeading` call sites**, all passing `description`, audited by script rather than re-reading:
TableLayout ×4, RoadmapLayout ×2 (including the "Coming soon" placeholder), RichTextLayout,
SectionBasedLayout, SubcategorySelector, and the `/domain` listing.

⚠️ **TWO BUGS OF MINE, BOTH FOUND BY THE USER, BOTH THE SAME MISTAKE:** a new field that needed an
existing conditional, and got a narrower test invented for it instead.

1. **`SubcategorySelector` passed `page?.description`** instead of following the `isDomainRoot`
   check sitting three lines above it — which was already used for exactly this decision, twice
   (title and icon). Result: a **hierarchical** domain root showed no description while a **direct**
   one did. Two kinds of domain root behaving differently from the same field.
2. ⚠️ **`SubcategorySelector` DEFINES ITS OWN `DomainWithPages` THAT SHADOWS `services/types.ts`.**
   The shared one is `Domain & {…}`, an intersection with Prisma's type, so it gains new columns for
   free. The local one lists its fields, so it does not. **Identical name, opposite behaviour.**
   TypeScript caught this one — unlike any of the API field lists.

**`/domain` needed TWO constants, not a shorter one.** `DESCRIPTION` (~120 chars) feeds the search
snippet and names the site, because a searcher has not arrived yet. `PAGE_DESCRIPTION` (63 chars) is
read by someone already on the page, where "on ATNO" is redundant and half the length reads better
under an `<h1>`. ⚠️ Shortening the single constant would have quietly weakened the search snippet —
invisible until traffic drops. The same reasoning that made `description` and `metaDescription`
separate fields, applied to a page with no row to hang them on.

**Description colour: `text-foreground/70`, not a lighter grey.** ⚠️ "Brighter" only means "lighter"
in dark mode; in light mode a lighter grey would LOSE contrast and read as disabled. Moving toward
`--foreground` moves in opposite directions per theme, which is what was actually wanted:

| | `--muted-foreground` | `text-foreground/70` |
| --- | --- | --- |
| light | oklch 0.556 | ≈ oklch 0.32 — **darker**, more contrast |
| dark | oklch 0.708 | ≈ oklch 0.80 — **lighter**, more contrast |

Verified in the built CSS as `color-mix(in oklab, var(--foreground) 70%, transparent)`. The review
badge deliberately keeps `text-muted-foreground` — it is a footnote; the description is the page
explaining itself.

⚠️ **`items-end` ONLY WHEN A DESCRIPTION EXISTS**, and `pt-1.5` drops in that case — it exists to
align a 36px control with a `text-3xl` cap height, which is the wrong correction once the group is
bottom-aligned. All 1,236 description-less pages keep their exact previous appearance.

⚠️ **`min-w-0` MOVED ONTO THE NEW COLUMN WRAPPER**, not just the `<h1>`. The wrapper is now the flex
child, so it inherits `min-width: auto` — without it a long unbroken description pushes the buttons
off the edge and the document scrolls sideways.

### ⚡ O-6 merged into O-5

The split existed to protect the three copied rows while the source still mattered. The user then
**emptied `Roadmap.description` and deleted every `Roadmap` row on both branches**, so there is
nothing left to protect and no reason for two migrations.

⚠️ **Two side effects of that deletion, both live and both expected:** 5 PUBLISHED pages still carry
`contentType: 'roadmap'` with no `Roadmap` row, so they render `RoadmapLayout`'s "Coming soon"
placeholder — verified, no 500. And their intro lines were invisible between the column being
emptied and O-3 landing, because the render still read the old field.

### Test matrix

**Inert-migration check (do this first):**

1. ⚠️ After O-1, **every page looks exactly as it does today** — 1,236 nulls, nothing renders, no
   layout shift. This is the check that the migration is visually inert.
2. ⚠️ **The 3 roadmap pages still show their intro line** — now from `Page.description`, and
   **without the `-mt-6`**, so confirm the spacing under the heading is right rather than merely
   present.

**Render:**

3. A table page with a description → line under the `<h1>`, **⟳ Reviewed + Share bottom-aligned to
   it** per the mockup.
4. The same page with the description cleared → layout returns exactly to today's (buttons back to
   `items-start` + `pt-1.5`).
5. ⚠️ A **long** description (250 chars) → wraps at `max-w-prose`, does **not** push Share off the
   edge, and the page does not scroll horizontally.
6. ⚠️ A description on a page with a **two-line wrapping title** → no overlap, no collision with
   the button group.
7. Below `sm`: description shows, review badge hides (its existing `sm:flex`), no cramping.
8. A domain root → reads `Domain.description`. A nested page under it → reads `Page.description`.
   Setting one must not change the other.
9. `/domain` listing → renders the existing constant. Subcategory page → description, **no badge**.

**Meta — check `view-source`, not just the page:**

10. `metaDescription` set → appears in `description`, `og:description` **and**
    `twitter:description`. All three.
11. `metaDescription` cleared, `description` ≥ 40 chars → the on-page line becomes the meta.
12. `metaDescription` cleared, `description` **under** 40 chars → falls through to the template.
    ⚠️ This is the floor working; it is not a bug.
13. A 20-char `metaDescription` → **used verbatim**, no floor. The asymmetry with 12 is deliberate.
14. A rich-text page with no fields set → still scrapes its prose, unchanged.

**Save paths — the field-list bug:**

15. ⚠️ Set both fields on a page, save, **reopen the edit dialog** — both must still be there. This
    is the check that catches a missing rebuild site, and it is the exact symptom that made the
    icon look broken in Phase J.
16. ⚠️ Set a domain description, then edit the domain's **name** and save → the description
    survives. Same shape as the `reviewedAt` PUT check.
17. ⚠️ Set a page description, then change the page's **status or icon** → description survives.
18. Create a **new** page and a **new** domain with descriptions → they save.

### Deferred out of Phase O

| | |
| --- | --- |
| **`metaTitle` per page** | The composed title is already right on 1,236 pages. Needs search data to justify — see (e) |
| **Per-page OG image** | A real gap, but an upload/generation feature rather than a text field |
| **`SiteSetting` table** | ⚠️ **Four** site-wide strings now want it. Its own small phase — see (g) |
| **Descriptions on `/domain` grid cards** | Declined for now; domain pages only |
| **`DomainCategory.description`** | Left exactly as-is — see (h) |

---

## Related documents

| Document | Contents |
| --- | --- |
| `NEW-IMPROVEMENTS.md` | Items #1–#28, Phases A–J |
| `NEW-IMPROVEMENTS-2.md` | Items #29–#35, Phases K–L — ⚠️ **Phase K is the table's own history; read it before changing table internals** |
| `NEW-IMPROVEMENTS-3.md` | Item #36, Phase M |
| `TABLE-GUIDE.md` | The end-user manual. ✅ Now carries a pointer to the two guides below, plus a warning that its CSV section no longer describes every header in an export |
| `guides/ROW-ORDERING-GUIDE.md` | ✅ **N-2 as an end-user guide** — admin steps, accepted CSV headers, blanks/gaps/ties, per-country ordering |
| `guides/ROW-TAGS-GUIDE.md` | ✅ **N-3 as an end-user guide** — turning tags on, colours, the CSV header, and the typo trap |
| `guides/README.md` | ⚠️ Records why the five older guides were NOT moved into the folder: **36 references to them from inside code comments**, which would break silently because they are prose rather than imports |
| `TABLE-IMAGES-GUIDE.md` | Row images — N-1 touches presentation, not the pipeline |

---

## ⚠️ Still open from earlier phases, not part of Phase N

Carried here so it stays visible:

| | |
| --- | --- |
| **Credential rotation** | R2 keys, Neon password, `BLOB_READ_WRITE_TOKEN` — all exposed in chat, all still live |
| **M-10** | `next` 15.5.9 → 15.5.23 plus four criticals. **20 vulnerabilities, 4 critical** as of 21 Aug |
| **#30** | ⚠️ Table content is not server-rendered — **so nothing in Phase N will be visible to a crawler either.** Blocked on #8/#8-DR, which needs a product decision |
| **`hello@atno.io`** | Live on Contact, Privacy and Terms |
| **`[jurisdiction to be confirmed]`** | Live in Terms |
