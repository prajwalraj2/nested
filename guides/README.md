# guides/

End-user guides — how to *use* a feature, not how it is built.

## The structure guides

These three cover the whole content hierarchy, and they are best read in this order — each one
assumes the one above it.

| Guide | Covers |
| --- | --- |
| `CATEGORY-GUIDE.md` | Categories — the 3-column menu grid, the Active gate, why delete usually refuses |
| `DOMAIN-GUIDE.md` | Domains — Direct vs Hierarchical, status, target countries, descriptions, review dates, the cascade on delete |
| `PAGE-GUIDE.md` | Pages — content types, `__main__`, parents and nesting, recursive delete |

```
Category  →  Domain  →  Page  →  content (table / rich text / roadmap / sections)
```

## Feature guides

| Guide | Covers |
| --- | --- |
| `ROW-ORDERING-GUIDE.md` | Display Order — deciding which table row appears first, including per country |
| `ROW-TAGS-GUIDE.md` | Row tags — the coloured pill on individual table rows, and its colours |

## What belongs here

A guide someone would read to **do a task in the admin panel**: where to click, what a CSV header
must be called, what will bite them. Written for the person maintaining the content, not the person
maintaining the code.

The reasoning behind a feature lives in `NEW-IMPROVEMENTS-*.md`; a guide only says *why* where the
reason changes what you should do.

⚠️ **Every ⚠️ in these guides marks something verified against the code, not remembered.** Where a
guide states a number — the 40-character borrowing floor, the 300-character limit, the 90-day review
window — that number was read out of the source. If you change one in the code, search the guides
for it.

## ⚠️ The older guides are still at the repository root, deliberately

`TABLE-GUIDE.md`, `TABLE-IMAGES-GUIDE.md`, `ICON-GUIDE.md`, `RICH-TEXT-GUIDE.md` and
`ROADMAP-CONTENT-GUIDE.md` predate this folder and have **not** been moved.

They are referenced **by filename from inside the code** — not as links, but in comments that say
things like `see ICON-GUIDE.md §4` or `ROADMAP-CONTENT-GUIDE.md §3 and §8 apply here verbatim`.
Measured on 22 Aug 2026:

| Guide | Files referencing it |
| --- | --- |
| `ICON-GUIDE.md` | 13 |
| `ROADMAP-CONTENT-GUIDE.md` | 12 |
| `RICH-TEXT-GUIDE.md` | 6 |
| `TABLE-IMAGES-GUIDE.md` | 4 |
| `TABLE-GUIDE.md` | 1 |

**36 references across the codebase.** Moving the files would leave every one of them pointing at a
path that no longer exists — and because they are prose in comments rather than imports, **nothing
would fail**. No build error, no broken link, just 36 quiet lies for the next person to follow.

Consolidating is worth doing; it is a deliberate pass that updates the references in the same commit,
not a side effect of adding a folder.
