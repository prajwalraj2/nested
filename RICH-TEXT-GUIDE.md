# Rich text — what to write, and what never to paste

Rich-text pages are the one place on ATNO where you author HTML directly. `/admin/rich-text` →
pick a domain → **Edit HTML**.

> ⚠️ **Nothing cleans what you save.** HTML sanitisation was removed on 15 Aug 2026 (#35), so
> whatever you paste is stored byte-for-byte and rendered to every public visitor. **This document
> is the control that replaced it.** Read §1 and §2 at least once.

---

## 1. The one rule: never set a colour

**Not with `style`. Not with a `class` either.**

```html
<h4 style="font-size: 1.25rem; margin-top: 2.5rem;">Heading</h4>   ✅ size and spacing
<hr  style="border-color: #9ca3af;">                               ✅ mid-grey rule
<p   style="color: #000000;">Body text</p>                         ❌ NEVER
<p   class="text-⟨any-colour⟩">Body text</p>                       ❌ NEVER
<div style="background-color: #fff;">…</div>                       ❌ NEVER
```

> ⚠️ The `⟨…⟩` brackets above are deliberate. Real class names written in this file would be
> generated into the CSS — see §3.

### Why — the worked example

The rich-text card used to be pinned to a light background in **both** themes, precisely because
stored HTML carried baked-in colours. On 15 Aug 2026 it was changed to follow the theme, and
**26 pages immediately became unreadable in dark mode** — black text on a near-black ground.

They were only two documents, duplicated across domains:

| Content | Pages | What broke |
| --- | --- | --- |
| 📩 Cold Emailing ( Template Included ) | 14 | `rgb(0, 0, 0)` ×12 each |
| 🍀 Facebook Groups | 12 | `#000000` ×4 each |

390 pages were fine — they set no text colour at all. **That is the standard to match.**

⚠️ **An inline `style` beats every stylesheet rule**, so no CSS anywhere in the app can rescue a
colour you bake in. It has to not be there.

### Colours you may use

Only for **borders and rules**, and only mid-greys that read on both a white and a near-black
ground:

```html
<hr style="border-color: #9ca3af;">    ✅ reads on both
<hr style="border-color: #dcdada;">    ⚠️ too pale on dark — legacy, don't copy it
```

Everything else — text, backgrounds, links — leave alone and let the theme handle it.

---

## 2. Nothing is stripped. Check pastes yourself.

Before the removal, saving a page silently deleted `<script>`, every `on*` handler, `javascript:`
hrefs and `<iframe>`. **None of that happens now.** If you paste it, it ships.

⚠️ **Search your paste for these before saving:**

| Search for | Why |
| --- | --- |
| `<script` | runs in every visitor's browser, same origin as the admin panel |
| `onclick` `onerror` `onload` `onmouseover` | same — any `on…=` attribute is executable JavaScript |
| `javascript:` | an `href` that runs code on click |
| `<iframe` `<embed` `<object` | loads someone else's page inside yours |
| `<form` `<input` | can post your visitors' data somewhere else |

⚠️ **The risk is not you typing these — it is pasting a block you did not read line by line.**
ChatGPT output, a Google Docs export and a "copy the HTML" button from a website can all carry
them. Skim before you save; the editor will not.

### Links opening in a new tab

```html
<a href="https://example.com" target="_blank" rel="noopener noreferrer">Link</a>
```

⚠️ **`rel="noopener noreferrer"` used to be added automatically** and no longer is. Without
`noopener`, the page you opened can reach back through `window.opener` and navigate the original
tab — a phishing route. Type it yourself, every time.

---

## 3. ⚠️ Tailwind classes only work if the class already exists somewhere else

This is the least obvious thing in this document, and it will silently produce an unstyled page.

Tailwind scans **source files** to decide which CSS to generate. **It does not read the database.**
So a class that appears *only* inside your stored HTML generates no CSS at all — the attribute is
there, the styling is not, and nothing warns you.

The classes in the **Insert Template** button work for one reason: they are written literally in
`src/components/admin/rich-text/HtmlEditor.tsx`, which *is* scanned. That is why
`font-[verdana]`, `text-[#afb6b5]`, `grid-cols-1 md:grid-cols-3`, `list-disc pl-6` and the rest
all render.

**So:**

- ✅ **Safe** — anything in the Insert Template output, or any class already used elsewhere in the
  app.
- ⚠️ **Not safe** — a class you invented. A different column count, a different font, a different
  hex, a padding step nothing else uses: all of them produce the attribute and no CSS.
  *(Deliberately not spelled out — writing them here would generate them and make them look safe.)*
- ✅ **Always safe** — inline `style`. It needs no build step and cannot be tree-shaken away.

**When in doubt, use `style`.** It is what 407 of the 415 existing pages do, and it is the reason
they still render correctly years later.

⚠️ There is a trap in verifying this: Tailwind also scans `.md` files, so **writing a class name
into a guide like this one creates it**. A class cannot be proven safe by finding it in
documentation — check `HtmlEditor.tsx` or the app's components.

---

## 4. Structure that works

`example-rich-text.txt` in the project root is the reference document — real content from a live
page, and disciplined: sizing, spacing, one mid-grey rule, no text colour anywhere.

### Section heading with a rule

```html
<h4 style="font-size: 1.25rem; margin-top: 2.5rem; margin-bottom: 0.5rem;">🎏 Description</h4>
<hr style="border-color: #9ca3af; margin-top: 0; margin-bottom: 0.75rem;">
```

### Nested lists

```html
<ul style="list-style-type: disc; padding-left: 1.5rem;">
    <li style="text-align: justify; margin-bottom: 0.75rem;">Top-level point.</li>
    <ul style="list-style-type: disc; padding-left: 2.5rem;">
        <li style="margin-bottom: 0.75rem;">Nested point.</li>
    </ul>
</ul>
```

### Emphasis inside a list item

```html
<li style="margin-bottom: 0.75rem;"><strong>Price Range:</strong> $150 - $300</li>
```

### Three columns

Use **Insert Template** and edit it — those classes are known-good (§3).

⚠️ **`prose` classes do nothing here.** `@tailwindcss/typography` is not installed, so every type
size and margin you see comes from your own inline styles. Do not expect defaults to fill gaps.

---

## 5. Before you publish

| Check | |
| --- | --- |
| Open the page in **light mode** | reads correctly |
| Open the page in **dark mode** | ⚠️ **the one that catches colour mistakes** — all text visible |
| Every `target="_blank"` link | has `rel="noopener noreferrer"` |
| Any pasted block | searched for the §2 list |
| Any invented Tailwind class | either present in `HtmlEditor.tsx`, or converted to `style` |

⚠️ **Dark mode is the check that matters.** A colour mistake looks perfect in light mode and
invisible in dark, and you will not notice unless you look.

---

## 6. Known-bad content, not yet cleaned

Two clean-ups are outstanding. If you are editing one of these pages, fix it while you are there —
it is one find-and-replace.

**Dark text colours (26 pages, 2 documents)** — see §1. Remove every `color:` declaration; the
theme handles it.

**Inline hover handlers (4 pages, 398 handlers)** — links carrying
`onmouseover="this.style.color='#000000';"`. These predate everything and still execute, so those
links still turn black on hover in dark mode. Delete the `onmouseover` and `onmouseout` attributes;
the links keep their normal hover.

```sql
SELECT p.slug FROM "RichTextContent" r JOIN "Page" p ON p.id = r."pageId"
WHERE r."htmlContent" ILIKE '%onmouseover%';
```

---

## 7. If a second person ever gets admin access

⚠️ **Reopen the sanitiser decision.** Everything above rests on one person authoring everything and
reviewing their own pastes. That does not generalise, and the failure is silent — a bad paste looks
exactly like a good one until a visitor's browser runs it.

`NEW-IMPROVEMENTS-2.md` **#35** has the full recipe to put sanitisation back, including every trap
found the hard way and the dependency pins that avoid #23. It is an afternoon's work, not a
rediscovery.

---

## Related

| Document | Contents |
| --- | --- |
| `example-rich-text.txt` | A live page's HTML — the reference for house style |
| `SANITISER-REMOVAL.md` | Why sanitisation was removed, and the accepted risk |
| `NEW-IMPROVEMENTS-2.md` #35 | How to put it back |
| `NEW-IMPROVEMENTS-2.md` #34 | The colour measurement, and the 26 pages |
| `TABLE-IMAGES-GUIDE.md` · `ICON-GUIDE.md` | The other two authoring guides |
