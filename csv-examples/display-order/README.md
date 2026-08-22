# Display Order — sample CSVs (N-2)

Six files, each isolating one behaviour. Import with **replace** into a throwaway table, then check
the public page.

⚠️ **Every file needs a `Book Name` / `Link` / `Book Author` / `Description` shape to match the Books
table.** If your test table has different columns, edit the headers — only the last two columns
(`Target Countries`, `Display Order`) are what these files are actually testing.

| File | What it proves | Expected on the public page |
| --- | --- | --- |
| `1-basic-order.csv` | order is honoured | Thinking with Type · Design of Everyday Things · Steal like an Artist · Grid Systems |
| `2-per-country-order.csv` | ⚠️ **one order column serves every country** | **IN:** Zerodha · Groww · Upstox · Investopedia — **US:** Robinhood · Schwab · Investopedia |
| `3-blanks-and-gaps.csv` | blanks sort LAST; gaps and junk are fine | Pinned first · Gap of five · Big number · then the three no-opinion rows |
| `4-header-variants.csv` | a header of just `Order` auto-maps | two rows, in order |
| `5-ties.csv` | ties keep file order | Tie A · Tie B · Clear third |
| `6-no-order-column.csv` | ⚠️ **the destructive case** — see below | every row loses its order |

## ⚠️ The two things most likely to surprise you

**1. `6-no-order-column.csv` WIPES the order.** An import with `operation: 'replace'` overwrites every
row, and a file with no `Display Order` column writes no order — so a table you carefully arranged
becomes unordered. Nothing errors. **Always export first if the current order matters.**

**2. `3-blanks-and-gaps.csv` puts `922` ABOVE the blanks.** A blank means "no opinion" and sorts last,
so a large number still beats no number. `Number(null)` is `0`, and treating a blank as `0` would put
every unnumbered row at the TOP — the inversion `sortRowsByDisplayOrder` exists to prevent.

## Accepted header names

Measured, not guessed — `autoMapColumns` lower-cases the header and does a two-way substring test
against the column name (`Display Order`):

| Header | Maps? |
| --- | --- |
| `Display Order` | ✅ **use this — it is what export writes** |
| `Order` | ✅ |
| `order` | ✅ |
| `DISPLAY ORDER` | ✅ |
| `Sort Order` | ❌ |
| `Position` | ❌ |

⚠️ **A real column of your own wins over this one.** `autoMapColumns` takes the FIRST match and
`Display Order` is appended last, so a column you created called `Order Type` is matched by a CSV
header of `Order` before the system column is. That precedence is deliberate.

## What export does and does not carry

✅ **`Display Order` and `Target Countries` DO export**, because both are real columns — an
export → re-import round trip preserves them.

⚠️ **Row image keys DO NOT.** `exportTableToCsv` iterates `schema.columns`, and an image key lives in
a companion FIELD rather than a column, so it is absent from the file and `undefined` after
re-import — **every picture is silently lost.** That is a pre-existing gap, not new to N-2, and N-4
fixes it. Until then, do not round-trip a table that uses row images.
