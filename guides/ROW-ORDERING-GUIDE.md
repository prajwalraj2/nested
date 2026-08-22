# Row Ordering — user guide

How to decide which row of a table appears first, second, third — including when different countries
should see a different order.

> ⚠️ **The public page does not change.** No new column appears, nothing is added to the UI. This is
> an admin-only control over the sequence rows come out in.

---

## Contents

1. [The short version](#1-the-short-version)
2. [Two ways to set the order](#2-two-ways-to-set-the-order)
3. [Ordering by CSV](#3-ordering-by-csv)
4. [Moving rows by hand](#4-moving-rows-by-hand)
5. [Different countries, different order](#5-different-countries-different-order)
6. [Blanks, gaps and ties](#6-blanks-gaps-and-ties)
7. [Things that will catch you out](#7-things-that-will-catch-you-out)
8. [Why it works this way](#8-why-it-works-this-way)

---

## 1. The short version

Every table has a hidden **Display Order** column. Put `1` on the row you want first, `2` on the
next, and so on. Rows with no number fall to the bottom.

It behaves exactly like **Target Countries**: it is a real column in the schema, you can see and edit
it in the admin, and it is **stripped out before the public page ever sees it**.

---

## 2. Two ways to set the order

| | Best for |
| --- | --- |
| **A CSV column** (§3) | setting or re-shuffling a whole table at once |
| **Move up / Move down** (§4) | nudging one or two rows |

Both write to the same place, so you can mix them.

⚠️ **You do not create the Display Order column.** It is added automatically. If you add one by hand
in Schema & Settings you will end up with two order columns — yours, which nothing reads, and the
real one.

⚠️ **On a table you have never saved, the column may not be stored yet.** It shows in Schema &
Settings regardless, and the first save of anything on that table writes it. Nothing to do; just do
not be surprised if a brand-new table's export lacks the column until you save once.

---

## 3. Ordering by CSV

Add a column named **`Display Order`** (or just **`Order`**) and number the rows:

| Book Name | Link | Target Countries | Display Order |
| --- | --- | --- | --- |
| Thinking with Type | https://… | ALL | 1 |
| The Design of Everyday Things | https://… | ALL | 2 |
| Steal like an Artist | https://… | ALL | 3 |

Import as usual. On the mapping step it maps automatically:

```
Book Name         ->  Book Name (text)
Target Countries  ->  Target Countries (text)
Display Order     ->  Display Order (number)      <- this one
```

### Accepted header names

The importer lower-cases the header and compares it loosely against the column name
`Display Order`:

| Header | Works? |
| --- | --- |
| `Display Order` | ✅ **use this — it is what export writes** |
| `Order` | ✅ |
| `order` | ✅ |
| `DISPLAY ORDER` | ✅ |
| `Sort Order` | ❌ |
| `Position` | ❌ |
| `Rank` | ❌ |

⚠️ **A column of your own wins over the system one.** The importer takes the first match, and
`Display Order` is added last — so if your table has a real column called `Order Type`, a CSV header
of `Order` maps to *that*, not to Display Order. Use the full `Display Order` header when in doubt.

### Sample files

`csv-examples/display-order/` holds six ready-made CSVs, one per behaviour, with a README of expected
results. ⚠️ Including `6-no-order-column.csv`, which demonstrates the destructive case in §7.

---

## 4. Moving rows by hand

1. **Admin → Tables →** your table **→ Data View**
2. **⋯ on the row → Move up** or **Move down**
3. **Save rows**

Each move renumbers the whole table `1, 2, 3, …` in its new order.

⚠️ **Both items are disabled while the filter box has text in it.** The list you are looking at is
filtered, so "down" would move the row past a row you cannot see. Clear the filter to reorder.

⚠️ **Moving a row destroys deliberate ties.** If you set two rows to `1` on purpose (§6) and then
press a move button anywhere in the table, everything is renumbered sequentially and the tie is gone.

---

## 5. Different countries, different order

This is the case that sounds hard and is not. **One order column handles it**, because the country
filter runs *before* the sort.

| Row | Target Countries | Display Order |
| --- | --- | --- |
| Zerodha | `IN` | 1 |
| Groww | `IN` | 2 |
| Upstox | `IN` | 3 |
| Robinhood | `US` | 1 |
| Charles Schwab | `US` | 2 |

**An Indian visitor sees:** Zerodha · Groww · Upstox
**An American visitor sees:** Robinhood · Charles Schwab

⚠️ **The two `1`s do not collide**, because no visitor ever sees both sets. Number each country's
rows from 1 independently and it just works.

### The one case it cannot express

A row targeted at **several** countries at once — `IN,US` — that you want 1st for India and 3rd for
the US. One row, one number, so you pick one.

In practice this is vanishingly rare (2 tables out of 656 have a row visible in more than one named
country). If it ever matters, say so — there is a planned syntax for it that needs no migration.

---

## 6. Blanks, gaps and ties

**Blank means "no opinion" and sorts LAST.**

| Row | Display Order | Where it lands |
| --- | --- | --- |
| Pinned first | 1 | 1st |
| Gap of five | 5 | 2nd |
| Big number | 922 | 3rd |
| No opinion | *(blank)* | 4th |
| Not a number | `abc` | 5th |

⚠️ **`922` still beats a blank.** A large number is an opinion; no number is not. This surprises
people, so it is worth seeing once in `3-blanks-and-gaps.csv`.

**Gaps are fine.** `1, 5, 9` sorts exactly like `1, 2, 3`. You do not have to keep the numbers tidy —
leaving gaps is actually useful, because inserting a row later needs no renumbering.

**Ties are allowed.** Two rows both numbered `1` render in the order they already sit in.
⚠️ That order can flip later if one of them is deleted and re-added, so give them distinct numbers if
you actually care which is first.

---

## 7. Things that will catch you out

### ⚠️ A CSV with no order column WIPES the order

An import with **replace** overwrites every row. A file with no `Display Order` column writes no
order, so a table you carefully arranged becomes unordered. **Nothing errors.**

**Always export first if the current order matters.** The export includes the column, so the
round trip is safe.

### ⚠️ Your order is the STARTING order, not a lock

Sorting is enabled on every table. The moment a visitor clicks a column header, your sequence is
replaced by theirs. That is correct behaviour — they asked for it — but it means Display Order
controls what people see *first*, not permanently.

### ⚠️ It is invisible on the public page, on purpose

There is no Display Order column in the rendered table and none in the API response. If you are
looking for confirmation that it worked, compare the row *sequence*, not the columns.

### ⚠️ Do not add the column yourself

See §2. It is added automatically, and a hand-made copy will not be read.

---

## 8. Why it works this way

**It is a real column, not a hidden field**, unlike row images and tags. Two reasons: a CSV needs a
header to write into, and the admin grid needs something to display and edit. Images and tags need
neither.

**One order column instead of one per country.** Rows are already filtered by country before being
sorted, so per-country numbering falls out for free — see §5. Building per-country ordering would
have meant a column per country, or an `IN:1,US:3` syntax to hand-type, to serve two tables out of
656.

**Blank sorts last rather than first.** The obvious implementation treats a missing value as `0`,
which would push every unnumbered row *above* everything you had deliberately placed. That inversion
is guarded against explicitly.

**A move renumbers the whole table rather than swapping two rows.** Swapping assumes the numbers are
contiguous, and they are not — gaps are legal and deleting a row leaves one. With gaps, a swap can
jump a row past two neighbours or appear to do nothing.

---

## Related

| Document | Contents |
| --- | --- |
| `TABLE-GUIDE.md` | tables end to end, including Target Countries which this mirrors |
| `guides/ROW-TAGS-GUIDE.md` | row tags — the sibling feature |
| `csv-examples/display-order/` | six sample CSVs and a README of expected results |
| `NEW-IMPROVEMENTS-4.md` | #37 / Phase N — the decisions behind this |
