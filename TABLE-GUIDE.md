# Table Management Guide

Everything about data tables in this app: preparing a CSV, creating a table, editing one
safely, and the traps to avoid.

Written 3 Aug 2026, against the code as it stands after Phase G-5. Every rule below was read
out of the source, and the file/line references let you re-check any of it.

---

## Contents

1. [How tables fit together](#1-how-tables-fit-together)
2. [Before you start: you need a page](#2-before-you-start-you-need-a-page)
3. [Preparing your CSV](#3-preparing-your-csv)
4. [The Target Countries column](#4-the-target-countries-column) ← read this one properly
5. [Creating a table: the 4-step wizard](#5-creating-a-table-the-4-step-wizard)
6. [Column types reference](#6-column-types-reference)
7. [Editing an existing table](#7-editing-an-existing-table)
8. [Adding rows](#8-adding-rows)
9. [Adding or changing columns](#9-adding-or-changing-columns)
10. [Bulk edits: the safe round-trip](#10-bulk-edits-the-safe-round-trip)
11. [Deleting things, and what it takes with it](#11-deleting-things-and-what-it-takes-with-it)
12. [Making a table visible publicly](#12-making-a-table-visible-publicly)
13. [Traps and gotchas](#13-traps-and-gotchas)
14. [Troubleshooting](#14-troubleshooting)
15. [Cheat sheet](#15-cheat-sheet)

---

## ⚠️ Two features are documented separately

Added in Phase N and covered by their own guides rather than folded in here, because each has its
own CSV rules and its own set of traps:

| Guide | Covers |
| --- | --- |
| `guides/ROW-ORDERING-GUIDE.md` | **Display Order** — which row appears first, including per country |
| `guides/ROW-TAGS-GUIDE.md` | **Row tags** — the coloured pill on individual rows |

⚠️ **Both add a column to what an export contains**, so §3 (Preparing your CSV) and the column
reference below do not describe every header you will see in a freshly exported file. `Display Order`
is a real column; `<Column> (tag)` and `<Column> (image key)` are companion fields.

---

## 1. How tables fit together

```
Domain  ("🖌️ Graphic Designing", slug: gdesign)
  └── Page  ("YouTube Channels", slug: ytube, contentType: "table")
        └── Table  ("YouTube Channels Table")
              ├── schema   → the columns
              ├── data     → the rows
              └── settings → pagination, sorting, filtering
```

Four things to hold onto:

- **A table belongs to a page, one-to-one.** A page can hold at most one table, and a table
  cannot exist without a page. This is why the wizard starts by choosing a page.
- **The public URL comes from the page, not the table.** `/domain/<domainSlug>/<pagePath>`.
  The table's own name is admin-only.
- **Rows are keyed by column *id*, not column name.** A row looks like
  `{ id: "row_…", col_1: "Figma", col_2: "figma.com" }`. This one fact explains most of the
  behaviour in [§13](#13-traps-and-gotchas) — renaming a column is safe, deleting one is not
  quite what you'd expect.
- **There is no undo. Anywhere.** No trash, no soft delete, no revision history. Export before
  anything destructive.

---

## 2. Before you start: you need a page

A table needs a page to live on, and not any page will do.

**Eligible pages** are those whose `contentType` is:

| contentType | Eligible? | Note |
| ----------- | --------- | ---- |
| `table` | ✅ | The normal case |
| `narrative` | ✅ **only if it has no table yet** | Creating a table converts it to `table` |
| anything else (`section_based`, `rich_text`, `subcategory_list`, `mixed_content`) | ❌ | Not offered by the wizard |

**A page that already has a table is shown but disabled**, marked *"Already has a table: …"*.
To change that table, don't create a new one — go and [edit the existing one](#7-editing-an-existing-table).

### Two ways to get a page

1. **Use an existing one** — Admin → Pages, create a page with type *Table*, then pick it in
   the wizard.
2. **Let the wizard create it** — step 2 has a *Create New Page* form. It makes a page of type
   `table` in the selected domain, with a slug auto-generated from the title.

> ⚠️ The page's **slug** becomes part of the public URL. Choose it deliberately — changing it
> later breaks every existing link to that page, and there is no redirect table
> (see [§13](#13-traps-and-gotchas)).

---

## 3. Preparing your CSV

### Creating the file

**Google Sheets:** File → Download → *Comma-separated values (.csv)*
**Excel:** File → Save As → *CSV UTF-8 (Comma delimited) (.csv)*

> ⚠️ In Excel, pick **CSV UTF-8**, not plain "CSV". Plain CSV writes the file in a legacy
> Windows encoding and any emoji, curly quotes, or accented characters arrive as mojibake
> (`â€™`, `ðŸ–Œ`). Your data has plenty of emoji, so this matters.

### The rules

| Rule | Detail |
| ---- | ------ |
| **First row is headers** | Row 1 is column names, every row after it is data |
| **Comma-separated** | Not semicolons, not tabs |
| **Quote anything containing a comma** | `"Editing, trimming and effects"` |
| **Max size** | **10 MB** — larger files are rejected outright (`CSVUploadInterface.tsx:78`) |
| **Empty rows** | Skipped automatically |
| **Encoding** | UTF-8 |

### Header names don't have to match exactly

After upload, the wizard shows a **mapping step**: every CSV header on the left, a dropdown of
your table's columns on the right. It pre-fills the mapping by fuzzy name match — if a CSV
header contains a column name or vice versa (case-insensitive), it's matched automatically.

So `Channel Name` maps to a column called `Channel Name` or even just `Name`. Anything it
can't guess, you set by hand.

> **An unmapped header is silently ignored.** Its column of data is simply not imported. Check
> the "N of M mapped" counter before continuing.

### Example CSV

```csv
Channel Name,Channel Link,Speaking Language,Description,Target Countries
CodeWithHarry,https://youtube.com/@CodeWithHarry,Hindi,"Programming tutorials, DSA and web dev",IN
Fireship,https://youtube.com/@Fireship,English,Fast-paced dev explainers,ALL
Think Media,https://youtube.com/@ThinkMediaTV,English,"Gear reviews, YouTube growth",ALL
Aksh Verma,https://youtube.com/@AkshVerma,Hindi,Channel growth and sponsorships,"IN,US"
```

Note: `"IN,US"` is quoted, because the comma inside it would otherwise be read as a column
separator.

### How values are converted on import

`transformValue` in `src/lib/table-utils.ts:344` decides this, per the column's type:

| Column type | CSV value → stored as |
| ----------- | --------------------- |
| *(anything empty)* | `null` |
| `number`, `currency` | a real number; **unparseable becomes `null`**, not 0 |
| `boolean` | `true` only for `true`, `1`, `yes`, `y` (any case). ⚠️ **Everything else is `false`** — including a typo |
| `date` | parsed and stored as a full ISO timestamp; unparseable becomes `null` |
| everything else | plain text |

> ⚠️ **Known inconsistency:** `rating` is *not* in the numeric branch, so a rating imported
> from CSV is stored as **text** (`"4.5"`), while the same field edited in the row dialog
> stores a **number** (`4.5`). Harmless for display, but don't rely on rating being numeric.

**Dates:** `YYYY-MM-DD` is the safest. `MM/DD/YYYY` also parses. Avoid `DD/MM/YYYY` — it will
be read American-style and silently give you the wrong date whenever the day is ≤ 12.

---

## 4. The Target Countries column

This is the per-row geo filter: it decides **which visitors see which rows**. Worth
understanding properly, because a mistake here silently hides content.

### Exact header names accepted

The importer lowercases the header and strips **all whitespace**, then compares it to
`targetcountries` (`table-utils.ts:299`). So:

| Header in your CSV | Works? |
| ------------------ | ------ |
| `Target Countries` | ✅ **← use this one** |
| `targetCountries` | ✅ |
| `TARGET COUNTRIES` | ✅ |
| `target countries` | ✅ |
| `TargetCountries` | ✅ |
| `Target_Countries` | ❌ underscores are not stripped |
| `Target-Countries` | ❌ |
| `Countries` / `Country` | ❌ |
| `Target Country` (singular) | ❌ |

**Recommended: `Target Countries`** — it matches the column's own name, so it also auto-maps
cleanly in the mapping step.

### Values accepted

Split on commas, trimmed, upper-cased (`countries.ts:112`):

| Cell value | Meaning |
| ---------- | ------- |
| `ALL` | Everyone, everywhere |
| *(blank)* | Everyone — treated as `ALL` |
| `IN` | India only |
| `IN,US` | India and the US |
| `in, us` | Same thing — case and spaces don't matter |

**Supported codes: `IN`, `US`, `GB`, `AU`, `CA`.** That's the whole list
(`countries.ts:9`).

> ⚠️ **A typo hides the row from everyone.** Matching is exact string equality against the
> visitor's country. `INDIA`, `IND`, `In dia` match nothing, so the row becomes invisible
> worldwide — with no warning anywhere in the UI. If a row mysteriously never appears
> publicly, check this first.

### What if you don't include the column?

**Nothing breaks — every row becomes visible to everyone.** There are two independent
safeguards:

1. The importer has an explicit fallback: no such header → every row gets `ALL`
   (`table-utils.ts:326`).
2. The API applies `ensureRowsHaveTargetCountries` on both create and data-save, filling `ALL`
   for anything missing or blank.

So it **fails open** (public), never closed (hidden). A forgotten column can't accidentally
hide your content.

> ⚠️ **But re-importing without it CAN un-hide content.** See
> [§7](#7-editing-an-existing-table) — a *replace* import from a CSV lacking the column resets
> every row to `ALL`.

### Do I add it to the schema myself?

**No. Never.** Two reasons:

1. **It's added for you.** When the table is created, the API appends a system column
   `Target Countries` automatically (`ensureTargetCountriesColumn`). Adding your own would
   give you a *duplicate* — a user column sitting next to the system one.
2. **It's added even to older tables now.** Saving any table's schema re-adds it if missing,
   so it self-heals.

**In the wizard's schema step, define only your real columns.** Target Countries will not
appear there, and that's correct.

> **A cosmetic quirk to expect:** because the draft schema has no such column yet, your CSV's
> `Target Countries` header will show as **unmapped** in the mapping step. **That's fine — the
> values are still imported.** The importer scans the raw headers for it independently of the
> mapping. Don't "fix" it by adding a column.

### Where it shows up afterwards

| Place | Visible? |
| ----- | -------- |
| Admin → schema editor | ✅ listed, and **cannot be deleted** (deliberately) |
| Admin → row editor | ✅ editable per row |
| **Public site** | ❌ **stripped** — both the column and the row field, by
  `getPublicSchema` / `getPublicRows` (`table-utils.ts:599` and `:612`) |

---

## 5. Creating a table: the 4-step wizard

**Admin → Tables → New table.** Nothing is written until you press *Create table* on step 4 —
you can back out at any point with *Cancel*.

### Step 1 · Select a domain

Searchable by name or slug. Each card shows how many table pages the domain has.

### Step 2 · Select or create a page

Lists that domain's eligible pages, with a **search box** (title or slug) once there are more
than five. Pages that already have a table are shown but disabled.

Or use *Create New Page* to make one inline.

### Step 3 · Define schema

Add a column per field you want. For each one:

- **Column Name** — what visitors see as the header
- **Data Type** — see [§6](#6-column-types-reference)
- **Sortable** — visitors can sort by it
- **Filterable** — it can be filtered
- **Searchable** — it's included in the table's search box
- **Required** — a row cannot be saved with this field empty

Also on this step: **Table Settings** — pagination (on/off, page size), sorting, filtering.

**Quick Start Templates** (Course / Tools / Contacts) pre-fill a set of columns. Fine here;
you'll notice they're **not offered when editing an existing table**, because applying one
replaces the whole schema — see [§13](#13-traps-and-gotchas).

### Step 4 · Upload data (optional)

Drag in a CSV, or skip it and add rows later. You get:

1. A **mapping** panel — CSV headers → your columns
2. A **validation summary** — total / valid / invalid rows
3. A **preview** of the first 5 rows
4. **Errors listed per row and column** if any fail validation

You can go back and fix the schema, then re-upload.

### Step 5 · Preview and create

A summary: destination, the public URL it will have, column configuration, and a sample of the
data. Press **Create table**.

---

## 6. Column types reference

| Type | Use for | Put in the CSV |
| ---- | ------- | -------------- |
| `text` | Short plain text | Anything |
| `description` | Long text, truncated in the table | Full sentences; quote if it contains commas |
| `link` | Clickable URL | Full URL, `https://…` |
| `image` | Image URL | Full URL to the image |
| `email` | Email address | `someone@example.com` |
| `phone` | Phone number | Any format |
| `badge` | Short status/category label | A single word or two — `English`, `Freemium` |
| `number` | Plain numbers | `42`, `3.5` — no thousands separators |
| `currency` | Money | The bare number, `499` not `₹499` |
| `rating` | Star rating | `4.5` (⚠️ stored as text on CSV import — see [§3](#3-preparing-your-csv)) |
| `date` | Dates | `YYYY-MM-DD` |
| `boolean` | Yes/no | `true`/`false`, `yes`/`no`, `1`/`0` |

---

## 7. Editing an existing table

**Admin → Tables → click a table.** Two tabs:

### Data View — edit rows

- **Filter rows** — matches across every column
- **Add row** — a dialog with the right input per column type
- **Edit row** (row menu → *Edit row*)
- **Delete row** (row menu → *Delete row*)

> ⚠️ **Nothing is saved until you press *Save rows*.** Edits accumulate locally, and the
> footer reads "Unsaved changes" while they do. Navigating away or reloading discards them.
> This is deliberate: the API replaces the entire rows array in one write, so saving on every
> keystroke would rewrite the whole table repeatedly.

### Schema & Settings — edit columns

Add, remove, reorder and reconfigure columns, and change pagination/sorting/filtering. Again,
**press *Save schema*** — and *Discard changes* genuinely reverts to what's stored.

If a save would remove a column, a warning names it and tells you the data isn't deleted, only
hidden. See [§13](#13-traps-and-gotchas).

### Import/Export — bulk data

Export as CSV or JSON; import a CSV with a choice of two operations:

| Operation | Effect |
| --------- | ------ |
| **Append** | Adds the CSV's rows to the existing ones. Existing rows untouched. |
| **Replace** | ⚠️ **Deletes every existing row** and stores only the CSV's rows. |

> ⚠️⚠️ **The single most important thing in this document:**
>
> **A *replace* import from a CSV that lacks the `Target Countries` column resets every row to
> `ALL`.** Any row that was India-only becomes visible worldwide, silently, with no warning.
>
> **Always Export CSV first, edit that file, and import it back.** The export includes the
> column, so a round-trip preserves your targeting. Hand-building a fresh CSV and choosing
> *replace* is what loses it.

Uploads are **staged**: you see the resulting row count and pick the operation deliberately
before anything is written.

---

## 8. Adding rows

| How many | Do this |
| -------- | ------- |
| **One or two** | Data View → **Add row** → fill the dialog → *Apply changes* → **Save rows** |
| **Many** | Prepare a CSV of just the new rows → Import/Export → upload → choose **Append** |

For the bulk case, the CSV only needs the columns you're filling — but **include `Target
Countries`** if any new row should be geo-limited, otherwise they all default to `ALL`.

Append is safe: it never touches existing rows.

---

## 9. Adding or changing columns

All in **Schema & Settings**.

### Adding a column

1. *Add Column* → set name, type and flags
2. **Save schema**

The new column exists immediately but is **empty for every existing row** — a new column can't
invent data. Fill it either:

- **row by row** in Data View, or
- **in bulk** via the [round-trip](#10-bulk-edits-the-safe-round-trip): export, add the new
  column's values in the CSV, import with *replace*.

### Renaming a column

Safe. Rows are keyed by column **id**, not name, so renaming doesn't touch any data. Rename
freely.

### Changing a column's type

The stored values don't change — only how they're rendered and validated. Changing `text` →
`number` on a column holding `"Freemium"` will not convert it; it stays as it is and simply
won't behave numerically. If you need a real conversion, do it in the CSV and re-import.

### Removing a column

The column disappears from the table, and **the values stay in storage**, unreachable. That's
deliberate and non-destructive: a mistaken removal is recoverable. But it does mean the
stored JSON keeps growing — see [§13](#13-traps-and-gotchas).

### Adding multiple columns at once

Add them one after another in the schema editor, then **one** *Save schema*. Then fill them all
in one round-trip.

---

## 10. Bulk edits: the safe round-trip

**The recommended way to make any large change**, because it never risks the geo-targeting:

```
1. Table → Import/Export → Export CSV
2. Open it in Sheets/Excel
     - edit values
     - add rows
     - add a column (add the header AND its values)
     - delete rows (delete the whole line)
3. Save as CSV UTF-8
4. Table → Import/Export → upload → choose REPLACE
5. Check the validation summary and preview before confirming
```

Why this is safe: **the export contains the `Target Countries` column**, so a replace
round-trip preserves every row's targeting.

Two caveats:

- If you **add a column** in the CSV, also add it in the **schema editor** — otherwise there's
  no column to map it to and the data is ignored.
- **Deleting a row means deleting its whole line**, including its `id`. Don't leave blank rows.

---

## 11. Deleting things, and what it takes with it

| Deleting | Also deletes | Recoverable? |
| -------- | ------------ | ------------ |
| **A row** (row editor) | Just that row | Only if you haven't saved yet |
| **A column** (schema editor) | Nothing — values stay hidden in storage | ✅ re-add a column and the data may resurface |
| **A table** (`Delete Table` on the editor page) | The table, its schema, its rows | ❌ **permanent** |
| **A page** (Admin → Pages) | The page, **its table**, and every descendant page with their tables | ❌ **permanent** |
| **A domain** (Admin → Domains) | Every page under it, and every table on those pages | ❌ **permanent** |

The domain and page deletes both tell you the count first. **Export anything you might want
back — there is no undo.**

---

## 12. Making a table visible publicly

A table shows up on the public site when **all** of these hold:

1. **The domain is published** — Admin → Domains → the row's *Publish* action
2. **The page is reachable** — it needs a valid parent chain. The table editor shows *View live
   table*; if it's **disabled**, the page has no reachable public URL and that's the problem.
3. **The domain's own country targeting** allows the visitor (Domains → edit → Target
   Countries)
4. **The row's `Target Countries`** allows the visitor

> Testing locally resolves you to **US**. A row marked `IN` will *correctly* not appear on
> `localhost`. That isn't a bug — it's the filter working.

Changes appear immediately: saving rows or schema invalidates the public cache, so you don't
wait for a revalidation window.

---

## 13. Traps and gotchas

### Rows are keyed by column id, and ids look like `col_1`

This is behind most of the surprising behaviour:

- **Renaming a column is completely safe** — the id doesn't change.
- **Deleting a column leaves its values in every row**, orphaned. Not visible, not deleted.
- **A newly added column gets an id that no row is using**, so it can't accidentally show a
  deleted column's data. *(This was a real bug — a new "empty" column used to resurrect the
  deleted column's values. Fixed; worth knowing it once existed.)*

### Quick Start Templates replace the whole schema

Applying a template rebuilds every column from scratch with fresh ids. On an empty table
that's the point. On a table **with rows**, it would remap your existing values onto columns
with different meanings — `"Figma"` appearing under "Course Name".

**That's why templates are only offered while creating**, never when editing.

### Changing a page's slug breaks its URLs

The slug *is* the public address. There is **no redirect table** in this app, so renaming it
404s every existing link, bookmark and search result for that page — and for every page nested
under it. The form warns you and names the count. Treat it as near-permanent.

### `Required` is only enforced in the admin

The row dialog refuses to save a blank required field. A CSV import reports invalid rows, but
the check is per-row — read the validation summary rather than assuming.

### Storage grows with every removed column

Non-destructive column removal means dead values accumulate in the stored JSON. Harmless at
your scale, but if you remove and re-add columns a lot, a round-trip
([§10](#10-bulk-edits-the-safe-round-trip)) rewrites the rows cleanly and drops the orphans.

### One table per page

If the page you want already has a table, you edit that table — you can't add a second.

---

## 14. Troubleshooting

| Symptom | Likely cause |
| ------- | ------------ |
| **A row never appears publicly** | Its `Target Countries` has a typo (`INDIA` instead of `IN`) — matches nobody. Or it's set to a country you're not browsing from. |
| **All rows went worldwide after an import** | You used **replace** with a CSV lacking the `Target Countries` column. Restore from your export. |
| **A CSV column wasn't imported** | Its header was left **unmapped** in the mapping step. Check the "N of M mapped" counter. |
| **`Target Countries` shows as unmapped when creating** | Expected and harmless — the importer handles that header separately. Don't add a column for it. |
| **Numbers came in blank** | Unparseable values become `null`, not 0. Currency symbols and thousands separators are the usual culprits — put `499`, not `₹4,99`. |
| **A boolean is `false` when it should be `true`** | Only `true`, `1`, `yes`, `y` count as true. Anything else, including a typo, is false. |
| **Dates are a day or a month out** | The CSV used `DD/MM/YYYY`, read as `MM/DD/YYYY`. Use `YYYY-MM-DD`. |
| **Emoji/accents look like `â€™`** | Saved as plain CSV rather than **CSV UTF-8**. |
| **My edits vanished** | Row and schema edits are staged — you have to press *Save rows* / *Save schema*. |
| **"View live table" is greyed out** | The page has no reachable public URL — check its parent chain. |
| **The table isn't on the site at all** | The domain is unpublished, or its own country targeting excludes you. |
| **File rejected on upload** | Over **10 MB**, or not a `.csv` extension. |
| **A new column is empty everywhere** | Correct — a new column has no historical data. Fill it via the row editor or a round-trip. |

---

## 15. Cheat sheet

**Creating**
```
Admin → Tables → New table
  1. domain  →  2. page  →  3. schema  →  4. CSV (optional)  →  Create
```

**Target Countries**
```
header  : Target Countries        (any case/spacing; NOT underscores or hyphens)
values  : ALL | IN | US | GB | AU | CA | "IN,US" | (blank = ALL)
omitted : every row becomes ALL — safe
schema  : do NOT add it yourself; it is added automatically
public  : always stripped — visitors never see it
```

**Editing**
```
one row      → Data View → Add/Edit row → SAVE ROWS
many rows    → Import/Export → CSV → APPEND
replace all  → Export CSV → edit → Import → REPLACE     ← keeps geo-targeting
new column   → Schema & Settings → Add Column → SAVE SCHEMA (then fill it)
rename       → safe, any time
```

**The three rules worth memorising**
1. **Export before any bulk change.** There is no undo anywhere in this app.
2. **Never *replace* from a CSV without the `Target Countries` column** — it silently resets
   every row to worldwide.
3. **Staged edits need saving.** "Unsaved changes" means exactly that.
