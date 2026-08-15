# Removing rich-text HTML sanitisation

**Decision taken 15 Aug 2026.** A step-by-step working document — tick each box as it lands.

> ⚠️ **This document names Tailwind class strings.** Tailwind v4 scans `.md` files, so every
> literal class written here exists in the built CSS whether or not any component uses it. That is
> harmless (a few unused bytes) but it means **a class documented here cannot be used as evidence
> that the class is in use**. See NEW-IMPROVEMENTS.md K-1, where exactly this invalidated a test.

---

## Why

### What the sanitiser was for

Finding **#2** described a stored-XSS chain: `PUT /api/admin/rich-text/[pageId]` accepted raw
`htmlContent`, stored it verbatim, and `RichTextLayout` rendered it to every public visitor with
`dangerouslySetInnerHTML`. Anything stored executed in every visitor's browser, on the same origin
as the admin panel.

⚠️ **The critical part of that chain was #1 — the write endpoint was completely unauthenticated.**
Any stranger could plant a `<script>` tag. #2's own text is explicit about the split:

> **Severity:** Critical (while #1 is open) → **Medium** (after #1 is fixed).
>
> **Step 1 (mandatory):** Fix #1. That reduces this to *"admins can write raw HTML,"* **which is a
> deliberate feature of this editor.**
>
> **Step 2 (recommended):** Sanitize on write anyway… **it costs almost nothing.**

**#1 is fixed.** Step 2 was explicitly *recommended*, not mandatory, and justified on being free.

### Why it is being removed

⚠️ **The "costs almost nothing" premise turned out to be false.** The sanitiser pulls
`isomorphic-dompurify` → `jsdom`, and that dependency broke the rich-text editor on Vercel while
working perfectly on localhost — finding **#23**, which consumed four deploy cycles and left the
feature 500ing on production for days. The full diagnosis is in NEW-IMPROVEMENTS-2.md #23.

It *was* eventually fixed (pin `isomorphic-dompurify` to 2.x, verified on Vercel on the
`testing-sanitze` branch — a pasted `<script></script>` was stripped on save). So this is **not a
removal under duress**. It is a deliberate trade made with the fix in hand:

| Keep it | Remove it |
| --- | --- |
| Strips `<script>`, `on*`, `javascript:` on **future saves only** | Those survive |
| ⚠️ Requires `isomorphic-dompurify` pinned at 2.x **forever** — `npm update` silently re-breaks it | No pin, no landmine |
| ~5 MB of `jsdom` + `dompurify` in every deploy | Gone |
| Protects content authored by the single trusted admin | Guide + discipline instead |

### ⚠️ The argument that actually decided it

**The sanitiser runs on WRITE only, so it has never touched almost any content on this site.**

- Rendering does **no** sanitising — `RichTextLayout` passes stored HTML straight to
  `dangerouslySetInnerHTML`.
- The `phase14` branch (Feb 2026) had **no sanitiser at all**, and every one of the ~415 rich-text
  rows was written before it existed. Only rows edited *since* #2 landed have been through it.

So what it bought was: cleaning future edits, by the one person we already trust, on a corpus that
was never cleaned. **Removing it restores exactly the behaviour phase14 ran live with for months**
— with #1, the part that actually mattered, now fixed.

### Residual risk, accepted knowingly

On save these are **no longer removed**: `<script>`, every `on*` handler, `javascript:` and `data:`
hrefs, `<iframe>`, `<form>` / `<input>`, and `expression()` inside `style`. And
`rel="noopener noreferrer"` is no longer added automatically to new `target="_blank"` links.

Mitigations, in place of the sanitiser:

1. **`RICH-TEXT-GUIDE.md`** — step 8 below. What to paste, what never to paste, what to check.
2. **Single trusted admin**, authoring their own content and reviewing pastes before saving.
3. ⚠️ **Reassess the moment there is a second admin.** "I trust myself" does not generalise, and
   the create-user flow already exists.
4. **#35** in NEW-IMPROVEMENTS-2.md — the full recipe to put it back, including every trap found
   the hard way, so re-adding it is an afternoon rather than a rediscovery.

---

## Steps

### ✅ 0 — Bring the dark-mode fix across from `testing-sanitze`

**Done by the user, 15 Aug 2026.** `RichTextLayout.tsx` no longer pins its card light:

| | before | after |
| --- | --- | --- |
| page wrapper | `min-h-screen bg-background` | `min-h-screen` — `body` already paints it |
| content card | `border … bg-neutral-100 text-neutral-900` | `border …` — follows the theme |
| empty-state heading | `text-xl font-semibold text-neutral-900 mb-3` | `text-xl font-semibold mb-3` |

The empty-state paragraph briefly kept a pinned mid-neutral, which on the dark ground would have
landed near **2.9:1** — under the 4.5:1 WCAG AA floor for body text. **Caught and removed by the
user** before review; it now inherits.

⚠️ **Three comment blocks contradicted the code** after the change — the largest still opened
*"THIS CARD STAYS LIGHT IN DARK MODE, DELIBERATELY. DO NOT 'FIX' IT TO A TOKEN"* directly above
code that had stopped doing that. That is precisely the rot that produced **#34**, where a stale
number in a comment drove a styling decision for two months. All three rewritten to describe what
the code now does, including the note that `prose prose-neutral` is inert because
`@tailwindcss/typography` is not installed.

### ⚠️ This step created the hover bug — handled by commenting the rule out

Making the card theme-following meant `.rich-text-content a:hover { color: #000 !important; }`
would turn links black on a near-black ground. **The rule is commented out, not deleted** —
step 6 is deferred rather than done, and the CSS is kept so the reasoning survives with it.

⚠️ **One residual the comment-out does not cover.** That rule replaced **398 inline
`onmouseover` / `onmouseout` handlers across 4 pages**, which set `this.style.color='#000000'`
directly. Sanitising only ever ran on write, and those 4 pages have not been re-saved, so **the
handlers are still in the database and still execute** — meaning those specific pages still turn
their links black on hover in dark mode.

It affects 4 pages, only on hover, and it disappears the moment each is re-saved. Fold it into the
same pass as the 26 colour pages above; find them with:

```sql
SELECT p.slug FROM "RichTextContent" r JOIN "Page" p ON p.id = r."pageId"
WHERE r."htmlContent" ILIKE '%onmouseover%';
```

**Deployed and confirmed working in both themes on production, 15 Aug 2026.**

**Residual, named and small** — 26 pages of 416 still carry text colours too dark to read on the
themed ground, and they are only **two documents duplicated across domains**:

| Content | Pages | Declarations |
| --- | --- | --- |
| 📩 Cold Emailing ( Template Included ) | 14 | `rgb(0, 0, 0)` ×12 each |
| 🍀 Facebook Groups | 12 | `#000000` ×4 each |

390 pages carry no dark text colour and were never at risk. **User will clear these separately.**

**Test:** open a rich-text page in dark mode → readable; open `/domain/gdesign/coldemail` in dark
mode → expected to show the problem above; light mode unchanged.

---

### ✅ 1 — Preserve the sanitiser's knowledge, then plan its return (#35)

**Done 15 Aug 2026.** Written as **#35** in `NEW-IMPROVEMENTS-2.md`: the restore command, the
derived allow-list with its content scan, all six traps, the #23 dependency trap with the exact
pins, why `sanitize-html` is not an escape from it, what removal gives up, and a test table that
exercises the allow-list rather than just `<script>`.

⚠️ **`sanitize-html.ts` is safe to delete from here on** — `git show 872c341:src/lib/sanitize-html.ts`
restores it verbatim, and nothing in it is now undocumented.

<details>
<summary>Original step description, kept for the reasoning</summary>

⚠️ **This step comes before any deletion, deliberately.** `sanitize-html.ts` is ~250 lines of
findings that were each discovered by breaking something. Deleting the file without capturing them
means whoever re-adds sanitisation rediscovers all of it.

Write **#35 — Re-add rich text sanitisation** into `NEW-IMPROVEMENTS-2.md`, carrying:

- The full `ALLOWED_TAGS` / `ALLOWED_ATTR` lists **and the content scan that produced them** — 21
  tags and their real usage counts, `style` used 28,608 times across 407 of 415 rows.
- ⚠️ **`#text` is load-bearing.** Omitting it from a custom `ALLOWED_TAGS` while `KEEP_CONTENT` is
  `false` deletes *every piece of visible text* — an earlier version lost 49% of the content's
  bytes with every tag intact and every word gone.
- ⚠️ **`USE_PROFILES` is mutually exclusive with the allow-lists.** Setting it makes DOMPurify
  ignore both and substitute its own — which stripped `target` from all 541 links while *allowing*
  `<form>` and `<input>` through.
- ⚠️ **`ADD_URI_SAFE_ATTR: ['target']` is required**, or `ALLOWED_URI_REGEXP` silently deletes
  `target` from every link, because DOMPurify treats it as URI-bearing and `_blank` does not match.
- ⚠️ **No `g` flag on the dangerous-CSS regex.** `RegExp.test()` with `/g` is stateful — it
  advances `lastIndex` and resumes there, so alternating inputs miss matches. An earlier version
  silently stopped stripping `expression(...)` for this reason.
- ⚠️ **`details` / `summary` are used 52 times each.** A generic allow-list omits them and collapses
  52 working disclosure widgets into loose text.
- The hook that duck-types `'tagName' in node` rather than `node instanceof Element` — `Element`
  is not a global under jsdom, and an `instanceof` there throws inside the hook and takes the whole
  sanitise call with it.
- ⚠️ **The dependency trap that caused #23**, so it is not walked into again: `isomorphic-dompurify`
  3.x → `jsdom ^28` → `html-encoding-sniffer@6` → `@exodus/bytes`, which is ESM-only with no
  CommonJS build. Turbopack hands external packages to Node at runtime, so it becomes a `require()`
  of an ES Module. **jsdom ≤27 uses `html-encoding-sniffer@4` → `whatwg-encoding`, pure CommonJS.**
- ⚠️ **`sanitize-html` is not a safe substitute in its current version** — `htmlparser2@12` is
  `"type": "module"` with **no `require` condition** in its exports map, the identical shape.
  `sanitize-html@2.16.0` and earlier use `htmlparser2@8` (CommonJS) and would be fine.
- The exact commit to restore the file from.

**Test:** none — documentation.

</details>

---

### ✅ 2 — Move `htmlToPlainText` out before deleting anything

**Done 15 Aug 2026.** ✚ `src/lib/html-text.ts`, moved verbatim. Two things recorded in the new
file that were not obvious:

- ⚠️ **It no longer runs on sanitised input.** It used to receive the output of
  `sanitizeRichTextHtml`, so anything stripped could not reach the search column. It now receives
  raw author HTML, and its own tag-stripping is the only thing between a `<script>` body and
  `plainText`. Acceptable — `plainText` is only ever searched, never rendered — but it is a change
  in what the function can promise, and it matters if anyone reuses it somewhere that *does*
  render.
- ⚠️ **Do not merge it with `htmlToText` in `src/lib/seo.ts`.** Similar name, different job: that
  one truncates for a ~160-character meta description.

<details>
<summary>Original step description, kept for the reasoning</summary>

⚠️ **`sanitize-html.ts` cannot simply be deleted.** It also exports `htmlToPlainText`, which has
**nothing to do with DOMPurify** — it is pure regex string work — and **both** rich-text routes
call it to populate `RichTextContent.plainText` and `wordCount`. Deleting the file breaks the
search text and the word counts with no type error at the call sites that matter.

- ✚ **`src/lib/html-text.ts`** — `htmlToPlainText`, moved **verbatim**, including the note that
  `&amp;` must be decoded last or `&amp;lt;` double-decodes into `<`.
- ⚠️ Do **not** confuse it with `htmlToText` in `src/lib/seo.ts`. Different function, different
  purpose (meta descriptions), unaffected by any of this.

**Test:** `npm run build` passes; save a rich-text page and confirm `plainText` and `wordCount` are
still written correctly.

</details>

---

### ✅ 3 — Strip sanitisation from the two API routes

**Done 15 Aug 2026.** Both routes now store `htmlContent.trim()` directly, with the local renamed
from `safeHtml` to `html` — the old name asserted a guarantee the code no longer provides, and
`safeHtml` is exactly what a future reader trusts without checking.

The lazy `await import` in `route.ts` is a normal top-level import again. It existed only to keep
jsdom out of that file's module graph; `htmlToPlainText` has no dependencies at all.

The error string changed too: *"htmlContent contained no safe content after sanitisation"* was no
longer true, so both routes now say *"htmlContent cannot be empty"*.

### ⚠️ The comment deleted from `route.ts` held the answer to #23 for two weeks

Dated **30 Jul**, it recorded the failure verbatim:

```
Failed to load external module jsdom: [ERR_REQUIRE_ESM]
require() of ES Module @exodus/bytes/encoding-lite.js
from html-encoding-sniffer/lib/html-encoding-sniffer.js not supported
```

Every term needed to solve #23 — the error code, the ESM-only package, the CommonJS package
requiring it — **was already in this repository** while four deploy cycles went into rediscovering
it from Vercel logs.

⚠️ Its stated root cause was also **wrong**: *"a Node version mismatch, fixed by pinning
`engines.node`"*. The runtime was on Node 24 the whole time, and `engines` had come from an
unrelated Phase G commit. So the lesson is two-sided:

> **Grep the repository for the error string before investigating an error — and treat a recorded
> diagnosis as a lead, not a conclusion.**

The text is preserved in the replacement comment rather than deleted, so the next person finds it
by the same grep that would have worked this time.

<details>
<summary>Original step description, kept for the reasoning</summary>

Only two files import it — verified by grep, not assumed.

**`src/app/api/admin/rich-text/[pageId]/route.ts`**
- Import `htmlToPlainText` from `@/lib/html-text`.
- `sanitizeRichTextHtml(htmlContent).trim()` → `htmlContent.trim()`.
- ⚠️ **Rename the local `safeHtml` to `html`.** Keeping the name would assert something that is no
  longer true, and the next reader would believe it.

**`src/app/api/admin/rich-text/route.ts`**
- Same three changes, **plus**: convert the lazy `await import('@/lib/sanitize-html')` inside the
  POST handler back to a normal top-level import.
- ⚠️ Delete the comment block above it explaining why the import is lazy. Its entire purpose was
  keeping jsdom out of the module graph; with jsdom gone the comment is a false explanation.

**Test:** save from both paths (create new content, and edit existing); `<script>` now **survives**
— that is the confirmation, not a regression; existing pages render byte-identically.

</details>

---

### ✅ 4 — Delete `sanitize-html.ts`

**Done 15 Aug 2026.** ✖ `src/lib/sanitize-html.ts`. Grep of `src/` confirms **no code references
remain** — only comments, which are step 7.

---

### ✅ 5 — Unwind the build configuration

**Done 15 Aug 2026.**

- `serverExternalPackages: ['sharp']` — ⚠️ `sharp` and the `./node_modules/@img/**/*` globs
  untouched, since they fix #31 and are load-bearing for Phase K image uploads.
- Both `/api/admin/rich-text` entries removed from `outputFileTracingIncludes`.
- `isomorphic-dompurify` removed from `package.json`; `npm install` re-run.

⚠️ **Verified gone from `node_modules`, not assumed:** `isomorphic-dompurify`, `jsdom`, `dompurify`,
`html-encoding-sniffer` and `@exodus/bytes` are all absent. That last one is the package whose
ESM-only packaging caused #23 — its removal is what makes this class of failure impossible rather
than merely pinned away from.

<details>
<summary>Original step description, kept for the reasoning</summary>

**`next.config.ts`**
- `serverExternalPackages: ['sharp', 'isomorphic-dompurify', 'dompurify', 'jsdom']` → `['sharp']`
- Delete both `/api/admin/rich-text` and `/api/admin/rich-text/[pageId]` entries from
  `outputFileTracingIncludes`.
- Delete the `isomorphic-dompurify` comment block; leave a one-line pointer to #35.

⚠️ **`sharp` and the `./node_modules/@img/**/*` globs must not be touched.** They fix a different
finding (#31), they are load-bearing for Phase K's image uploads, and breaking them fails only on
Vercel — never locally, because Windows ships sharp's native code in a single package while linux
splits it across two.

**`package.json`**
- Remove `"isomorphic-dompurify": "^3.3.0"`.
- ⚠️ There is no `overrides` block on `dev-3.0` — the `dompurify` override lives only on
  `testing-sanitze` and is not being brought across.

**`package-lock.json`** — regenerated by `npm install`. Expect ~5 MB and a few hundred lock lines
to disappear.

**Test:** `npm run build` passes; ⚠️ **upload an image at `/admin/images`** — that is the sharp
regression check, and it must be done **on a deploy**, not locally, since the failure mode does not
exist on Windows.

</details>

---

### ⏸️ 6 — Fix the link-hover rule in `globals.css` (DEFERRED — commented out 15 Aug 2026)

```css
.rich-text-content a:hover { color: #000 !important; }
```

That rule exists because the sanitiser strips `on*` handlers — it replaces 398 inline
`onmouseover` / `onmouseout` hover effects across 4 pages. Its own comment warns:

> ⚠️ *"if the rich-text card is ever made theme-following … THIS RULE MUST GAIN A DARK VARIANT at
> the same time."*

**Step 0 did exactly that.** So today, hovering a link in dark mode turns it black on a near-black
ground — invisible.

⚠️ **Removing the sanitiser does not remove this problem** — it is caused by the theme change, not
by the sanitiser. Keep the rule (it is genuinely better than the inline handlers: consistent across
every rich-text link rather than only the 4 pages that carried them), give it a dark variant, and
rewrite the comment so it no longer explains itself through a sanitiser that is gone.

**Test:** hover a rich-text link in **both** themes — visible in both; hover on one of the 4 pages
that still carry the inline handlers and confirm no conflict.

---

### ✅ 7 — Correct the comments that now lie

**Done 15 Aug 2026.** Not cosmetic — each was a claim a future reader would have acted on.

| File | Was |
| --- | --- |
| `ShareButton.tsx` | *"the same protection `sanitize-html.ts` adds to every `target="_blank"` link"* — ⚠️ **a real behaviour change**: `rel` is no longer added automatically, so rich-text links carry only what the author typed, which for existing content is nothing |
| `structured-data.ts` | *"#2 already sanitises rich-text HTML"* offered as reassurance — the escape never depended on it, but the surrounding net is thinner than the wording implied |
| `globals.css` | the whole hover-rule rationale, rewritten around **why it is disabled**, with the SQL to find the 4 pages whose inline handlers still fire |

---

### ✅ 8 — `RICH-TEXT-GUIDE.md`

**Done 15 Aug 2026.** ⚠️ **This is the control that replaced the sanitiser**, so it was written as
part of the change, not after it.

### ⚠️ Writing it turned up a real defect nobody had noticed

**Tailwind classes inside stored HTML only work by accident.**

Tailwind scans **source files** to decide what CSS to emit — it never reads the database. So a
class appearing *only* in stored rich-text HTML generates nothing: the attribute is present, the
styling is absent, and there is no warning.

The template classes work for exactly one reason — they are written literally in
`src/components/admin/rich-text/HtmlEditor.tsx`, which **is** scanned:

```html
<h5 class="mt-5 mb-2 font-[verdana]">
<div class="grid grid-cols-1 md:grid-cols-3 gap-6 my-3 font-[verdana]">
<a class="text-[#afb6b5] underline">
```

Verified against the built CSS (492 KB across 6 files): `verdana`, `afb6b5`, `grid-cols-3`,
`list-disc`, `pl-6`, `gap-6` all present. **Any class an author invents that is not in that
template and not used elsewhere in the app will silently do nothing.**

⚠️ **Getting to that answer took three attempts, all my own errors, and the pattern is worth
recording**: first I searched a 3.6 KB CSS chunk instead of the real 492 KB set; then I used regexes
that did not account for Tailwind escaping `:` and `[` in selectors, which reported present classes
as absent. **Plain substring matching over the full corpus was what finally worked.** Same failure
as #34's colour count and the `export-table.ts` grep — three occurrences now of *the search was
wrong, not the answer*.

⚠️ And a trap for anyone verifying this later: **Tailwind scans `.md` files too**, so writing a
class name into a guide creates it. A class cannot be proven safe by finding it in documentation.

<details>
<summary>Original step description, kept for the reasoning</summary>

Not cosmetic. Every one of these is a claim a future reader would act on.

| File | Claim that becomes false |
| --- | --- |
| `src/components/domain/ShareButton.tsx` ~232 | says `sanitize-html.ts` adds `rel` to every `target="_blank"` link — ⚠️ it no longer does, and that is a real behaviour change |
| `src/lib/structured-data.ts` ~55 | *"titles … never pass through DOMPurify"* — reword; DOMPurify is gone entirely |
| `src/app/globals.css` ~127-171 | the whole hover-rule rationale — covered by step 6 |
| `NEW-IMPROVEMENTS-2.md` #23 | rewrite: fixed, verified, then removed **by choice**, with the reasoning above |
| `NEW-IMPROVEMENTS.md` #2 | mark Step 2 as reverted, pointing at #35 |

**Test:** grep `src/` for `dompurify`, `DOMPurify`, `sanitize-html`, `sanitizeRichTextHtml` — only
intentional references remain.

---

### ☐ 8 — Write `RICH-TEXT-GUIDE.md`

Same shape as `ICON-GUIDE.md` and `TABLE-IMAGES-GUIDE.md`. ⚠️ **This is now the only thing standing
between a careless paste and a public page**, so it is part of the change, not a follow-up.

- ⚠️ **The one rule: never set `color:` or `background-color:`.** Worked example: the 26 pages in
  step 0 that went unreadable when the card started following the theme.
- Rule colours must be mid-grey — `#9ca3af` reads on both themes, `#dcdada` is too pale on dark.
- ⚠️ **What to check before pasting** from ChatGPT, Google Docs or a website: no `<script>`, no
  `on*` attributes, no `javascript:` hrefs, no `<iframe>`. Nothing removes these any more.
- Add `rel="noopener noreferrer"` by hand to any `target="_blank"` link — this used to be automatic.
- Structure patterns that work: heading + `<hr>`, nested lists, the three-column grid.
- ⚠️ `prose` classes are **inert** — `@tailwindcss/typography` is not installed, so spacing and
  type size come entirely from the inline styles in the stored HTML.
- `example-rich-text.txt` as the reference document: sizing, spacing and one mid-grey
  `border-color`, and no text colour anywhere.

</details>

---

### ✅ 9 — Ship

**Shipped and confirmed on `atno.io`, 15 Aug 2026.** Editor opens, edits and saves; public pages
render in both themes; image upload unaffected.

⚠️ **`sharp` was the regression to watch** and it came through clean — steps 5's edit touched the
same `serverExternalPackages` array, and that failure mode exists only on the linux runtime, never
on Windows.

---

## Remaining, not part of this change

| | |
| --- | --- |
| ⏸️ Step 6 | Hover rule — commented out, needs a two-theme colour before it returns |
| ☐ | The 26 dark-colour pages (2 documents) — user clearing by hand |
| ☐ | The 4 pages with 398 inline `onmouseover` handlers — same pass |
| ⚠️ | **Reopen #35 the day a second admin account exists** |

---

## Amendment this forces on Phase L

⚠️ **Phase L decision (d) loses its enforcement mechanism.** It states that roadmap content follows
the theme *because* `sanitizeRoadmapHtml()` strips the `style` attribute server-side — with the
explicit reasoning that a convention in the editor UI would not survive the first paste out of
Google Docs.

With no sanitiser there is no server-side enforcement. Two options were put:

- **(a)** Accept it as discipline plus a guide, consistent with this decision.
- **(b)** Write a ~30-line `style`-attribute stripper for roadmap content only.

### ✅ DECIDED: (a) — discipline and a guide. *(user's call, 15 Aug 2026)*

> *"I can ensure that style attributes are only used at places for something else — not for
> colouring things. We will also have a separate guide for the roadmap content process, in full
> detail, with everything."*

⚠️ **I argued for enforcement and was overruled on reasonable grounds.** Recording both sides,
because the failure mode is slow and silent:

**For (a)** — the same person authors everything, the rule is narrow and memorable ("never set a
colour"), and it is exactly the discipline already accepted for rich text three sections above.
Adding a stripper for roadmap content while rich text has none is an inconsistency that would
itself need explaining.

**The risk that remains** — a `style` attribute is not the only way colour arrives. `class="text-…"`
and `bg-…` utilities do the same thing, and a stripper aimed at `style` would not have caught those
either. So (b) was never complete protection, which weakens the case for it.

⚠️ **The signal to revisit:** the first roadmap topic that renders wrong in one theme. Unlike rich
text, where the damage was 26 pages found by measurement, roadmap content is **new** — so if the
discipline holds, there is nothing to clean up later. If it slips, catch it early.

**Deliverable:** a roadmap content guide, written as part of Phase L, covering the full authoring
process — not only the colour rule. Recorded as **L-12** in NEW-IMPROVEMENTS-2.md.

---

## Related

| Document | Contents |
| --- | --- |
| `NEW-IMPROVEMENTS.md` #1, #2 | The original XSS chain and why #1 was the part that mattered |
| `NEW-IMPROVEMENTS-2.md` #23 | Why the dependency broke on Vercel and not locally |
| `NEW-IMPROVEMENTS-2.md` #34 | The colour measurement that was wrong, and the correct figures |
| `NEW-IMPROVEMENTS-2.md` #35 | *(step 1)* — how to put sanitisation back |
| `RICH-TEXT-GUIDE.md` | *(step 8)* — what to write, and what never to paste |
