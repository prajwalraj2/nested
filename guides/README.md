# guides/

End-user guides — how to *use* a feature, not how it is built.

| Guide | Covers |
| --- | --- |
| `ROW-ORDERING-GUIDE.md` | Display Order — deciding which row appears first, including per country |
| `ROW-TAGS-GUIDE.md` | Row tags — the coloured pill on individual rows, and its colours |

## What belongs here

A guide someone would read to **do a task in the admin panel**: where to click, what a CSV header
must be called, what will bite them. Written for the person maintaining the content, not the person
maintaining the code.

The reasoning behind a feature lives in `NEW-IMPROVEMENTS-*.md`; a guide only says *why* where the
reason changes what you should do.

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
