# NEW-IMPROVEMENTS-4

Item **#37** onward, and **Phase N** — table row control (ordering, tags, image presentation) and
review dates on content pages.

Items #1–#28 and Phases A–J are in `NEW-IMPROVEMENTS.md`.
Items #29–#35 and Phases K–L are in `NEW-IMPROVEMENTS-2.md`.
Item #36 and Phase M are in `NEW-IMPROVEMENTS-3.md`.

> ⚠️ **The standing rule still applies.** Every data-dependent change runs on **both Neon branches**
> before the code deploys, and is stated explicitly in the record each time. Phase N adds one column
> to one model and two internal fields inside existing JSON — the JSON changes need no migration,
> which makes it *easier* to forget that the `Domain` change does.

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
— export a table, re-import it, and every picture is gone. Order and tags would inherit the same
hole. Fixed in the same phase.

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
| **N-1** | Square image frame + admin row thumbnails + shared image resolver | ✅ ⚡ smallest, and visible immediately |
| **N-2** | Row ordering — internal column, CSV target, admin move up/down | ✅ |
| **N-3** | Row tags — companion field, stored colours, in-cell pill | ✅ |
| **N-4** | Companion fields in CSV export | ✅ small — N-2 and N-3 both want it |
| **N-5** | `reviewedAt` on `Domain`, badge on content pages, stale list | ✅ |

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

**Test:** export a table with images, tags and order; ⚠️ **re-import it and confirm all three
survive**; the header names match what the import dropdown offers, so a round trip needs no manual
remapping.

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

## Related documents

| Document | Contents |
| --- | --- |
| `NEW-IMPROVEMENTS.md` | Items #1–#28, Phases A–J |
| `NEW-IMPROVEMENTS-2.md` | Items #29–#35, Phases K–L — ⚠️ **Phase K is the table's own history; read it before changing table internals** |
| `NEW-IMPROVEMENTS-3.md` | Item #36, Phase M |
| `TABLE-GUIDE.md` | ⚠️ **The end-user manual. N-2, N-3 and N-4 all change it** — CSV rules, the column reference and the import walkthrough all need the new columns |
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
