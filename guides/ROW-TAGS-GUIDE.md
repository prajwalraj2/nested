# Row Tags — user guide

How to put a small coloured label — **Recommended**, **Most Bought**, **Highly Recommended** — on
individual rows of a table.

> ⚠️ **A tag is per ROW, not per column.** You turn tags *on* for one column, then type a tag on
> whichever rows deserve one. Most rows will have none, and that is the intended shape: 3–4 tagged
> rows in a table of 12 is normal.

---

## Contents

1. [What a tag looks like](#1-what-a-tag-looks-like)
2. [Turning tags on for a column](#2-turning-tags-on-for-a-column)
3. [Giving each tag a colour](#3-giving-each-tag-a-colour)
4. [Adding a tag to a row](#4-adding-a-tag-to-a-row)
5. [Removing a tag](#5-removing-a-tag)
6. [Tags in a CSV](#6-tags-in-a-csv)
7. [The available colours](#7-the-available-colours)
8. [Things that will catch you out](#8-things-that-will-catch-you-out)
9. [Why it works this way](#9-why-it-works-this-way)

---

## 1. What a tag looks like

On the public page the tag renders as a small pill **above** the row's image and text, inside the
same cell:

```
+-----------------------------------------------+
| [Most Bought]                                 |
| (img)  The Design of Everyday Things           |
+-----------------------------------------------+
| [Recommended]                                 |
| (img)  Steal like an Artist                    |
+-----------------------------------------------+
| (img)  The Non-Designer Design Book            |   <- no tag, no gap
+-----------------------------------------------+
```

An untagged row renders exactly as it does today — **no empty space is reserved**, so a table with
two tagged rows out of twelve does not look half-empty.

---

## 2. Turning tags on for a column

Tags belong to **one column per table** — the one whose cell they appear in. In practice that is
almost always the name column.

1. **Admin → Tables →** your table **→ Schema & Settings**
2. Find the column the tag should appear above — e.g. `Book Name`
3. Tick **"Show a tag above this column"**
4. **Save the schema**

A colour manager appears underneath the checkbox.

⚠️ **Do NOT create a column called "Tag".** Tags are a *column option*, not a column. A column you
add by hand will not be recognised, will show up on the public page as an ordinary text column, and
will sit empty on most rows.

⚠️ **Unticking the box hides every tag on that column** but does not erase the values from the rows.
Tick it again and they come back. If you want them gone, clear each row's tag first.

---

## 3. Giving each tag a colour

A colour belongs to a **tag name**, not to a row — set "Recommended" to orange once and every row
using it is orange.

In the same panel, under the checkbox:

1. Type the tag name — **exactly** as you will type it on rows: `Recommended`
2. Pick a colour from the dropdown
3. Click **Add**
4. **Save the schema**

The pill previews in its colour beside each entry, so you can see the result before saving.

⚠️ **The name must match the rows exactly, including capitals.** `Recommended` and `recommended` are
two different tags as far as colours are concerned. See §8.

**Changing a colour:** pick a different one from that tag's dropdown and save.
**Removing a colour:** click **Remove**. ⚠️ The tag still shows on rows — it just goes **grey**.

---

## 4. Adding a tag to a row

1. **Data View → the ⋯ menu on the row → Edit row**
2. Find **"Tag above `<column name>`"** near the bottom of the dialog
3. Type the tag, or pick one from the suggestions that appear as you type
4. **Save**, then **Save rows**

⚠️ **Two saves.** The dialog's Save updates the row in the grid; **Save rows** writes it to the
database. Leaving the page after the first one loses the change — the same as any other row edit.

The suggestions come from the tag names you gave colours to in §3. ⚠️ **Use them.** Typing is
allowed — the field is deliberately free text — but a name you type fresh will not match any colour.

Tagged rows show their pill **in the admin grid too**, so you can see at a glance which rows carry
one without opening each.

---

## 5. Removing a tag

**Edit row → clear the tag field → Save → Save rows.** An empty field means no tag, and the row goes
back to rendering normally.

---

## 6. Tags in a CSV

### Exporting

**Export CSV** now includes a tag column, named after its parent column:

| Name | Name (image key) | Name (tag) | Link |
| --- | --- | --- | --- |
| The Design of Everyday Things | doet-cover | Most Bought | https://… |
| Steal like an Artist | steal-cover | Recommended | https://… |
| The Non-Designer Design Book | | | https://… |

Blank means no tag. ✅ **Export then re-import preserves tags, images, Display Order and Target
Countries.**

### Importing

Use the exact header the export writes: **`<Column Name> (tag)`** — e.g. `Name (tag)`.

On the mapping step it appears as its own row and maps automatically:

```
Name                  ->  Name (text)
Name (image key)      ->  Name (image key)
Name (tag)            ->  Name (tag)          <- this one
Link                  ->  Link (link)
```

⚠️ **If it says "Skip this column", the tag will not import.** The usual cause is that tags are not
switched on for that column yet — do §2 first, save, *then* import.

⚠️ **The header must end in `(tag)`.** `Tag`, `Tags` and `Recommended` will not be recognised, and a
header of just `Tag` may be matched onto a real column with "tag" in its name instead.

⚠️ **An import with `replace` overwrites every row.** A CSV with no tag column writes no tags, so
tags you added by hand are lost. **Export first if the current tags matter.**

---

## 7. The available colours

Ten, each with a light and dark variant so a pill is legible in both themes:

`emerald` · `amber` · `sky` · `violet` · `rose` · `teal` · `indigo` · `orange` · `pink` · `slate`

⚠️ **`slate` is also the fallback** for a tag with no colour set, so choosing it deliberately looks
identical to forgetting.

Suggested pairings, so the colour carries meaning rather than decoration:

| Tag | Colour | Why |
| --- | --- | --- |
| Most Bought | `emerald` | positive, factual |
| Recommended | `orange` | draws the eye without alarming |
| Highly Recommended | `rose` | stronger than Recommended, clearly different |
| Recently Added | `sky` | informational, not a judgement |
| Free | `teal` | reads as a fact, not a promotion |

⚠️ **Keep it to two or three tags per table.** A table where most rows carry a pill has no emphasis
left — everything highlighted is nothing highlighted.

---

## 8. Things that will catch you out

### ⚠️ A typo creates a new tag, silently

`Recomended` is a perfectly valid tag. It will render — in **grey**, because no colour matches it.
Nothing errors.

**The safeguard:** the row dialog warns *"No colour set for this tag — it will show grey"* the moment
you type one it does not recognise. If you see that and were not expecting it, check the spelling
before saving.

### ⚠️ Capitals matter

`Most Bought`, `most bought` and `MOST BOUGHT` are three different tags with three separate colours.
Pick one form and use the suggestions.

### ⚠️ Colours are per column, not per site

The colour map lives on the column, inside that table's schema. Setting "Recommended" to orange in
**Books** does **not** set it in **Courses** — you define it again there. Deliberate: it keeps each
table self-contained, but it means a consistent scheme across tables is your job.

### ⚠️ Only one column per table should show tags

Tick the box on a second column and you get two pills in two different cells on the same row. Not
prevented, and almost never what you want.

### ⚠️ Tags are not searchable or filterable

Global search and column filters work on **columns**, and a tag is a companion field. You cannot
search for "Recommended" or filter the table down to tagged rows. If that becomes important, say so
— it is a change to the filter layer, not a setting.

### ⚠️ Tags are invisible to Google

The whole table is rendered by JavaScript after the page loads (finding #30), so no crawler sees
tags, row order, or any other cell. Nothing to fix here specifically — it is the table's existing
limitation and is tracked separately.

---

## 9. Why it works this way

**A tag is a companion to a column, not a column of its own.** With 3–4 tagged rows per table, a
`Tags` column would be ~90% empty and would need hiding on mobile — the identical reason row images
became a companion rather than an "image column".

**The pill sits inside the cell rather than overlapping the row's top edge**, which is what the
original design sketched. It would have been clipped: the table card is `overflow-hidden`, and with
the sticky header on the scroll container is `overflow-y-auto` — and both of those exist on purpose
to make the sticky header work. Inside the cell looks nearly identical and cannot clip.

**Colours are stored, not computed.** The system could assign colours automatically, but it allocates
them by alphabetical position — so adding "Best Value" later would silently change "Recommended" from
orange to something else. For a label a reader learns to recognise, a colour that moves is worse than
one you had to type.

**Colours live in Schema & Settings, not the row dialog**, because a colour belongs to a tag name.
Editing it beside one row would make a change affecting every row look local to that one.

**The CSV header is ASCII.** It was going to be `Name — tag` with an em dash, until a real export
showed Excel reading these files as Latin-1 (`Josef MÃ¼ller-Brockmann`). An em dash would come back
as `â€"`, the header would stop matching, and the tag would silently fail to import.

---

## Related

| Document | Contents |
| --- | --- |
| `TABLE-GUIDE.md` | tables end to end — CSV rules, column types, the 4-step wizard |
| `TABLE-IMAGES-GUIDE.md` | row images, which tags are modelled on |
| `guides/ROW-ORDERING-GUIDE.md` | Display Order — the sibling feature |
| `csv-examples/display-order/` | sample CSVs for row ordering, with a README |
| `NEW-IMPROVEMENTS-4.md` | #37 / Phase N — the decisions behind tags, ordering and review dates |
